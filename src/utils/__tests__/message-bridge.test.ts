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
        lastError: null,
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
      parent: {},
      parent: { postMessage: jest.fn() }
    } as any
  })

  afterEach(() => {
    global.window = originalWindow
  })

  describe('sendMessage - Production Mode', () => {
    it('should send message via chrome.runtime in production', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true, data: 'test' })

      const result = await sendMessage({ type: 'TEST_MESSAGE', payload: { test: true } })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TEST_MESSAGE',
          payload: { test: true }
        })
      )
      expect(result).toEqual({ success: true, data: 'test' })
    })

    it('should handle chrome.runtime errors', async () => {
      mockChrome.runtime.lastError = { message: 'Chrome error' }
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: false })
      })

      await expect(sendMessage({ type: 'TEST_MESSAGE' })).rejects.toThrow()
    })

    it('should support callback-based responses', async () => {
      const callback = jest.fn()
      mockChrome.runtime.sendMessage.mockImplementation((msg, chromeCallback) => {
        chromeCallback({ success: true, data: 'callback response' })
      })

      await sendMessage({ type: 'TEST_MESSAGE' }, callback)

      expect(callback).toHaveBeenCalledWith({ success: true, data: 'callback response' })
    })
  })

  describe('sendMessage - Test Mode', () => {
    beforeEach(() => {
      global.window.parent = global.window
    })

    it('should send message via postMessage in test mode', async () => {
      const callback = jest.fn()
      global.window.postMessage = jest.fn((message, origin) => {
        setTimeout(() => {
          global.window.dispatchEvent(
            new MessageEvent('message', {
              data: {
                source: 'absmartly-extension',
                responseId: message.responseId,
                response: { success: true }
              }
            })
          )
        }, 0)
      })

      const result = await sendMessage({ type: 'TEST_MESSAGE' }, callback)

      expect(global.window.postMessage).toHaveBeenCalled()
    })

    it('should handle postMessage timeout', async () => {
      global.window.postMessage = jest.fn()

      const promise = sendMessage({ type: 'TEST_MESSAGE' })

      await expect(promise).rejects.toThrow()
    }, 35000)

    it('should clean up event listeners on response', async () => {
      const removeEventListenerSpy = jest.spyOn(global.window, 'removeEventListener')

      global.window.postMessage = jest.fn((message, origin) => {
        setTimeout(() => {
          global.window.dispatchEvent(
            new MessageEvent('message', {
              data: {
                source: 'absmartly-extension',
                responseId: message.responseId,
                response: { success: true }
              }
            })
          )
        }, 0)
      })

      await sendMessage({ type: 'TEST_MESSAGE' })

      expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function))
    })
  })

  describe('AI Generation Messages', () => {
    it('should handle AI_GENERATE_DOM_CHANGES message', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        changes: [
          { selector: '#test', type: 'text', value: 'Updated' }
        ]
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
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        html: mockHtml
      })

      const result = await sendMessage({ type: 'CAPTURE_HTML' })

      expect(result.success).toBe(true)
      expect(result.html).toBe(mockHtml)
    })

    it('should propagate errors from AI generation', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('API key is required')
      )

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
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined)

      sendMessageNoResponse({ type: 'NOTIFICATION', message: 'test' })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled()
    })

    it('should handle errors silently in fire-and-forget', () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Send failed'))

      sendMessageNoResponse({ type: 'NOTIFICATION' })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled()
    })

    it('should use postMessage in test mode', () => {
      global.window.parent = global.window
      const sidebarIframe = document.createElement('iframe')
      sidebarIframe.id = 'absmartly-sidebar-iframe'
      sidebarIframe.contentWindow = {
        postMessage: jest.fn()
      } as any

      document.body.appendChild(sidebarIframe)

      sendMessageNoResponse({ type: 'NOTIFICATION' })

      expect(sidebarIframe.contentWindow.postMessage).toHaveBeenCalled()

      document.body.removeChild(sidebarIframe)
    })
  })

  describe('Message Error Handling', () => {
    it('should handle malformed responses gracefully', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue(null)

      const result = await sendMessage({ type: 'TEST_MESSAGE' })

      expect(result).toBeNull()
    })

    it('should throw error with Chrome runtime lastError', async () => {
      mockChrome.runtime.lastError = { message: 'Specified item not found' }

      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback(undefined)
      })

      await expect(sendMessage({ type: 'TEST' })).rejects.toThrow()
    })

    it('should handle exceptions in chrome.runtime.sendMessage', async () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('sendMessage threw exception')
      })

      await expect(sendMessage({ type: 'TEST' })).rejects.toThrow('sendMessage threw exception')
    })
  })

  describe('Response ID Tracking', () => {
    it('should generate unique response IDs for multiple messages', async () => {
      const responseIds = new Set()

      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        responseIds.add(msg.responseId)
        callback({ success: true })
      })

      await sendMessage({ type: 'MSG1' })
      await sendMessage({ type: 'MSG2' })
      await sendMessage({ type: 'MSG3' })

      expect(responseIds.size).toBe(3)
    })
  })

  describe('Callback Handling', () => {
    it('should call callback before resolving promise', async () => {
      const callback = jest.fn()
      const callOrder: string[] = []

      mockChrome.runtime.sendMessage.mockImplementation((msg, chromeCallback) => {
        callOrder.push('chrome-callback')
        chromeCallback({ success: true, data: 'response' })
      })

      const promise = sendMessage(
        { type: 'TEST' },
        (response) => {
          callOrder.push('user-callback')
        }
      )

      await promise

      callOrder.push('promise-resolved')

      expect(callOrder[0]).toBe('chrome-callback')
      expect(callOrder[1]).toBe('user-callback')
    })

    it('should handle missing callback gracefully', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      const result = await sendMessage({ type: 'TEST' })

      expect(result).toEqual({ success: true })
    })
  })

  describe('Message Type Detection', () => {
    it('should detect test mode correctly', async () => {
      global.window.parent = global.window

      mockChrome.runtime = undefined

      const promise = sendMessage({ type: 'TEST' })

      await expect(promise).rejects.toThrow()
    })

    it('should use chrome.runtime when available', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      global.window.parent = {}

      const result = await sendMessage({ type: 'TEST' })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled()
    })
  })
})
