import { sendMessage, sendMessageNoResponse } from '../message-bridge'
import { jest } from '@jest/globals'

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

describe('Message Bridge Communication', () => {
  let mockChrome: any
  let originalWindow: any

  beforeEach(() => {
    jest.clearAllMocks()
    originalWindow = global.window

    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        lastError: null as any,
        onMessage: {
          addListener: jest.fn()
        }
      }
    }

    global.chrome = mockChrome as any
    global.window = {
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      parent: { postMessage: jest.fn() }
    } as any
  })

  afterEach(() => {
    global.window = originalWindow
  })

  describe('sendMessage - Production Mode', () => {
    it('should send message via chrome.runtime in production', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg: any, callback: (response: any) => void) => {
        callback({ success: true, data: 'test' })
      })

      const result = await sendMessage({ type: 'TEST_MESSAGE', payload: { test: true } })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TEST_MESSAGE',
          payload: { test: true }
        }),
        expect.any(Function)
      )
      expect(result).toEqual({ success: true, data: 'test' })
    })

    it('should handle chrome.runtime errors', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg: any, callback: (response: any) => void) => {
        mockChrome.runtime.lastError = { message: 'Chrome error' }
        callback({ success: false })
      })

      await expect(sendMessage({ type: 'TEST_MESSAGE' })).rejects.toThrow('Chrome error')
    })

    it('should support callback-based responses', async () => {
      const userCallback = jest.fn()
      mockChrome.runtime.sendMessage.mockImplementation((msg: any, chromeCallback: (response: any) => void) => {
        chromeCallback({ success: true, data: 'callback response' })
      })

      await sendMessage({ type: 'TEST_MESSAGE' }, userCallback)

      expect(userCallback).toHaveBeenCalledWith({ success: true, data: 'callback response' })
    })
  })

  describe('AI Generation Messages', () => {
    it('should handle AI_GENERATE_DOM_CHANGES message', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg: any, callback: (response: any) => void) => {
        callback({
          success: true,
          changes: [
            { selector: '#test', type: 'text', value: 'Updated' }
          ]
        })
      })

      const result = await sendMessage({
        type: 'AI_GENERATE_DOM_CHANGES',
        html: '<p>Test</p>',
        prompt: 'Change text',
        apiKey: 'test-key'
      })

      expect(result.success).toBe(true)
      expect(result.changes).toBeDefined()
      expect(result.changes).toHaveLength(1)
    })

    it('should handle CAPTURE_HTML message', async () => {
      const mockHtml = '<html><body><p>Test</p></body></html>'
      mockChrome.runtime.sendMessage.mockImplementation((msg: any, callback: (response: any) => void) => {
        callback({
          success: true,
          html: mockHtml
        })
      })

      const result = await sendMessage({ type: 'CAPTURE_HTML' })

      expect(result.success).toBe(true)
      expect(result.html).toBe(mockHtml)
    })

    it('should propagate errors from AI generation', async () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('API key is required')
      })

      await expect(
        sendMessage({
          type: 'AI_GENERATE_DOM_CHANGES',
          html: '<p>Test</p>',
          prompt: 'Test',
          apiKey: ''
        })
      ).rejects.toThrow('API key is required')
    })
  })

  describe('sendMessageNoResponse - Fire and Forget', () => {
    it('should send fire-and-forget message without waiting for response', () => {
      mockChrome.runtime.sendMessage.mockReturnValue(Promise.resolve(undefined))

      sendMessageNoResponse({ type: 'NOTIFICATION', message: 'test' })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled()
    })

    it('should handle errors silently in fire-and-forget', () => {
      mockChrome.runtime.sendMessage.mockReturnValue(Promise.reject(new Error('Send failed')))

      sendMessageNoResponse({ type: 'NOTIFICATION' })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled()
    })
  })

  describe('Message Error Handling', () => {
    it('should handle malformed responses gracefully', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg: any, callback: (response: any) => void) => {
        callback(null)
      })

      const result = await sendMessage({ type: 'TEST_MESSAGE' })

      expect(result).toBeNull()
    })

    it('should throw error with Chrome runtime lastError', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg: any, callback: (response: any) => void) => {
        mockChrome.runtime.lastError = { message: 'Specified item not found' }
        callback(undefined)
      })

      await expect(sendMessage({ type: 'TEST' })).rejects.toThrow('Specified item not found')
    })

    it('should handle exceptions in chrome.runtime.sendMessage', async () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('sendMessage threw exception')
      })

      await expect(sendMessage({ type: 'TEST' })).rejects.toThrow('sendMessage threw exception')
    })
  })

  describe('Callback Handling', () => {
    it('should call callback before resolving promise', async () => {
      const callback = jest.fn()
      const callOrder: string[] = []

      mockChrome.runtime.sendMessage.mockImplementation((msg: any, chromeCallback: (response: any) => void) => {
        callOrder.push('chrome-callback')
        chromeCallback({ success: true, data: 'response' })
      })

      const promise = sendMessage(
        { type: 'TEST' },
        () => {
          callOrder.push('user-callback')
        }
      )

      await promise

      callOrder.push('promise-resolved')

      expect(callOrder[0]).toBe('chrome-callback')
      expect(callOrder[1]).toBe('user-callback')
    })

    it('should handle missing callback gracefully', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg: any, callback: (response: any) => void) => {
        callback({ success: true })
      })

      const result = await sendMessage({ type: 'TEST' })

      expect(result).toEqual({ success: true })
    })
  })

  describe('Message Type Detection', () => {
    it('should use chrome.runtime when available', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((msg: any, callback: (response: any) => void) => {
        callback({ success: true })
      })

      ;(global.window as any).parent = {}

      const result = await sendMessage({ type: 'TEST' })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })
  })
})
