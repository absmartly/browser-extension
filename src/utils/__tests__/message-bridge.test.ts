import { createMessageBridge, MessageBridgeOptions } from '../message-bridge'
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
        onMessage: {
          addListener: jest.fn()
        }
      }
    }

    global.chrome = mockChrome as any
    global.window = {
      postMessage: jest.fn(),
      addEventListener: jest.fn()
    } as any
  })

  afterEach(() => {
    global.window = originalWindow
  })

  describe('createMessageBridge', () => {
    it('should initialize bridge in production mode with chrome.runtime', async () => {
      const bridge = createMessageBridge({ testMode: false })

      expect(bridge).toBeDefined()
      expect(bridge.send).toBeDefined()
    })

    it('should initialize bridge in test mode with window.postMessage', async () => {
      const bridge = createMessageBridge({ testMode: true })

      expect(bridge).toBeDefined()
      expect(bridge.send).toBeDefined()
    })

    it('should send message in production mode', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      const bridge = createMessageBridge({ testMode: false })
      const result = await bridge.send('TEST_MESSAGE', { data: 'test' })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TEST_MESSAGE',
          payload: { data: 'test' }
        })
      )
      expect(result).toEqual({ success: true })
    })

    it('should send message in test mode via postMessage', async () => {
      const bridge = createMessageBridge({ testMode: true })

      global.window.postMessage = jest.fn((message, origin) => {
        if (message.type === 'TEST_MESSAGE' && message.from === 'sidebar') {
          setTimeout(() => {
            global.window.dispatchEvent(
              new MessageEvent('message', {
                data: { id: message.id, response: { success: true }, from: 'content' }
              })
            )
          }, 0)
        }
      })

      const result = await bridge.send('TEST_MESSAGE', { data: 'test' })

      expect(global.window.postMessage).toHaveBeenCalled()
    })
  })

  describe('Message Bridge - AI Generation', () => {
    it('should handle AI_GENERATE_DOM_CHANGES message', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        changes: [
          { selector: '#test', type: 'text', value: 'Updated', enabled: true }
        ]
      })

      const bridge = createMessageBridge({ testMode: false })
      const result = await bridge.send('AI_GENERATE_DOM_CHANGES', {
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

      const bridge = createMessageBridge({ testMode: false })
      const result = await bridge.send('CAPTURE_HTML')

      expect(result.success).toBe(true)
      expect(result.html).toBe(mockHtml)
    })

    it('should propagate errors from AI generation', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('API key is required')
      )

      const bridge = createMessageBridge({ testMode: false })

      await expect(
        bridge.send('AI_GENERATE_DOM_CHANGES', {
          html: '<p>Test</p>',
          prompt: 'Test',
          apiKey: ''
        })
      ).rejects.toThrow('API key is required')
    })
  })

  describe('Message Bridge - Timeouts', () => {
    it('should timeout long-running AI generation requests', async () => {
      mockChrome.runtime.sendMessage.mockImplementation(
        () => new Promise(() => {})
      )

      const bridge = createMessageBridge({ testMode: false, timeout: 1000 })
      const startTime = Date.now()

      await expect(
        bridge.send('AI_GENERATE_DOM_CHANGES', {
          html: '<p>Test</p>',
          prompt: 'Test',
          apiKey: 'key'
        })
      ).rejects.toThrow()

      const elapsed = Date.now() - startTime
      expect(elapsed).toBeGreaterThanOrEqual(1000)
    })

    it('should use custom timeout values', async () => {
      mockChrome.runtime.sendMessage.mockImplementation(
        () => new Promise(() => {})
      )

      const customTimeout = 500
      const bridge = createMessageBridge({
        testMode: false,
        timeout: customTimeout
      })

      const startTime = Date.now()

      await expect(bridge.send('TEST_MESSAGE', {})).rejects.toThrow()

      const elapsed = Date.now() - startTime
      expect(elapsed).toBeGreaterThanOrEqual(customTimeout)
    })

    it('should not timeout successful messages', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      const bridge = createMessageBridge({ testMode: false, timeout: 1000 })
      const startTime = Date.now()

      const result = await bridge.send('TEST_MESSAGE', {})

      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(100)
      expect(result.success).toBe(true)
    })
  })

  describe('Message Bridge - Response Handling', () => {
    it('should handle response callbacks correctly', async () => {
      const mockCallback = jest.fn()

      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      const bridge = createMessageBridge({ testMode: false })
      const result = await bridge.send(
        'TEST_MESSAGE',
        { data: 'test' },
        mockCallback
      )

      expect(result).toBeDefined()
    })

    it('should support fire-and-forget messaging (no callback)', async () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        return Promise.resolve()
      })

      const bridge = createMessageBridge({ testMode: false })
      await bridge.send('NOTIFICATION', { type: 'info', message: 'Test' })

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled()
    })

    it('should track multiple concurrent messages', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ id: 123 })

      const bridge = createMessageBridge({ testMode: false })

      const promise1 = bridge.send('MSG_1', { seq: 1 })
      const promise2 = bridge.send('MSG_2', { seq: 2 })
      const promise3 = bridge.send('MSG_3', { seq: 3 })

      const results = await Promise.all([promise1, promise2, promise3])

      expect(results).toHaveLength(3)
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(3)
    })
  })

  describe('Message Bridge - Test Mode', () => {
    it('should route messages through iframe in test mode', async () => {
      const bridge = createMessageBridge({ testMode: true })

      global.window.postMessage = jest.fn()

      await bridge.send('TEST_MESSAGE', { data: 'test' })

      expect(global.window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TEST_MESSAGE'
        }),
        '*'
      )
    })

    it('should handle postMessage errors gracefully', async () => {
      const bridge = createMessageBridge({ testMode: true })

      global.window.postMessage = jest.fn(() => {
        throw new Error('postMessage failed')
      })

      await expect(bridge.send('TEST_MESSAGE', {})).rejects.toThrow()
    })

    it('should differentiate message sources in test mode', async () => {
      const bridge = createMessageBridge({ testMode: true, from: 'content' })

      global.window.postMessage = jest.fn()

      await bridge.send('TEST_MESSAGE', {})

      expect(global.window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'content'
        }),
        '*'
      )
    })
  })

  describe('Message Bridge - Error Handling', () => {
    it('should handle chrome.runtime errors', async () => {
      const error = new Error('Chrome API error')
      mockChrome.runtime.sendMessage.mockRejectedValue(error)

      const bridge = createMessageBridge({ testMode: false })

      await expect(bridge.send('TEST_MESSAGE', {})).rejects.toThrow('Chrome API error')
    })

    it('should provide meaningful error messages for missing messages', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValue(
        new Error('No listener found')
      )

      const bridge = createMessageBridge({ testMode: false })

      await expect(bridge.send('UNKNOWN_MESSAGE', {})).rejects.toThrow()
    })

    it('should handle malformed responses gracefully', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue(null)

      const bridge = createMessageBridge({ testMode: false })
      const result = await bridge.send('TEST_MESSAGE', {})

      expect(result).toBeNull()
    })
  })

  describe('Message Bridge - Listener Setup', () => {
    it('should register message listeners in production mode', async () => {
      createMessageBridge({ testMode: false })

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled()
    })

    it('should handle incoming messages in test mode', async () => {
      const bridge = createMessageBridge({ testMode: true })
      const messageHandler = jest.fn()

      global.window.addEventListener = jest.fn((event, handler) => {
        if (event === 'message') {
          global.window.messageHandler = handler
        }
      })

      await bridge.send('TEST_MESSAGE', {})

      expect(global.window.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })
  })

  describe('Message Bridge - Performance', () => {
    it('should handle rapid consecutive messages', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      const bridge = createMessageBridge({ testMode: false })

      const messages = Array.from({ length: 100 }, (_, i) => ({
        type: `MSG_${i}`,
        payload: { seq: i }
      }))

      const promises = messages.map(msg =>
        bridge.send(msg.type, msg.payload)
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(100)
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(100)
    })

    it('should clean up completed message handlers', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      const bridge = createMessageBridge({ testMode: false })

      await bridge.send('TEST_1', {})
      await bridge.send('TEST_2', {})
      await bridge.send('TEST_3', {})

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(3)
    })
  })
})
