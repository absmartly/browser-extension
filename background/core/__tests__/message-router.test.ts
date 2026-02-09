import {
  routeMessage,
  validateSender,
  isUnifiedMessage,
  forwardToActiveTab,
  broadcastToExtension
} from '../message-router'
import type { ExtensionMessage } from '~src/lib/messaging'

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
}

global.chrome = mockChrome as any

describe('message-router', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateSender', () => {
    it('should accept valid sender from same extension', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        url: 'chrome-extension://test-extension-id/index.html'
      }

      expect(validateSender(sender)).toBe(true)
    })

    it('should accept sender from localhost', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        url: 'http://localhost:3000'
      }

      expect(validateSender(sender)).toBe(true)
    })

    it('should accept sender from 127.0.0.1', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        url: 'http://127.0.0.1:8080'
      }

      expect(validateSender(sender)).toBe(true)
    })

    it('should accept sender from absmartly.com domain', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        url: 'https://app.absmartly.com'
      }

      expect(validateSender(sender)).toBe(true)
    })

    it('should accept sender from absmartly.io domain', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        url: 'https://api.absmartly.io'
      }

      expect(validateSender(sender)).toBe(true)
    })

    it('should reject sender with invalid URL format', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        url: 'not-a-valid-url'
      }

      expect(validateSender(sender)).toBe(false)
    })

    it('should reject sender from unauthorized domain', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        url: 'https://malicious-site.com'
      }

      expect(validateSender(sender)).toBe(false)
    })

    it('should reject sender with different extension ID', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'different-extension-id',
        url: 'chrome-extension://different-extension-id/index.html'
      }

      expect(validateSender(sender)).toBe(false)
    })

    it('should reject sender without ID', () => {
      const sender: chrome.runtime.MessageSender = {
        url: 'https://example.com'
      }

      expect(validateSender(sender)).toBe(false)
    })

    it('should reject iframe from unauthorized origin', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        frameId: 1,
        url: 'https://malicious-site.com'
      }

      expect(validateSender(sender)).toBe(false)
    })

    it('should reject iframe without URL', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        frameId: 1
      }

      expect(validateSender(sender)).toBe(false)
    })

    it('should accept iframe from authorized origin', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        frameId: 1,
        url: 'https://app.absmartly.com'
      }

      expect(validateSender(sender)).toBe(true)
    })

    it('should accept main frame (frameId = 0) without URL validation', () => {
      const sender: chrome.runtime.MessageSender = {
        id: 'test-extension-id',
        frameId: 0
      }

      expect(validateSender(sender)).toBe(true)
    })
  })

  describe('isUnifiedMessage', () => {
    it('should return true for message with from and to fields', () => {
      const message: ExtensionMessage = {
        type: 'TEST',
        from: 'sidebar',
        to: 'content'
      }

      expect(isUnifiedMessage(message)).toBe(true)
    })

    it('should return false for message without from field', () => {
      const message = {
        type: 'TEST',
        to: 'content'
      }

      expect(isUnifiedMessage(message)).toBe(false)
    })

    it('should return false for message without to field', () => {
      const message = {
        type: 'TEST',
        from: 'sidebar'
      }

      expect(isUnifiedMessage(message)).toBe(false)
    })

    it('should return false for non-object messages', () => {
      expect(isUnifiedMessage(null)).toBe(false)
      expect(isUnifiedMessage(undefined)).toBe(false)
      expect(isUnifiedMessage('string')).toBe(false)
      expect(isUnifiedMessage(123)).toBe(false)
    })
  })

  describe('routeMessage', () => {
    const validSender: chrome.runtime.MessageSender = {
      id: 'test-extension-id'
    }

    const sendResponse = jest.fn()

    it('should route message to content script', async () => {
      const message: ExtensionMessage = {
        type: 'TOGGLE_VISUAL_EDITOR',
        from: 'sidebar',
        to: 'content'
      }

      const mockTab = { id: 123 }
      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true })

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))
      {
        expect(mockChrome.tabs.query).toHaveBeenCalledWith({
          active: true,
          currentWindow: true
        })
        expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(123, message)
      }
    })

    it('should route message to sidebar', async () => {
      const message: ExtensionMessage = {
        type: 'UPDATE_STATE',
        from: 'content',
        to: 'sidebar'
      }

      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))
      {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message)
      }
    })

    it('should not route message without from/to fields', () => {
      const message = {
        type: 'LEGACY_MESSAGE'
      }

      const result = routeMessage(message as any, validSender, sendResponse)

      expect(result.handled).toBe(false)
      expect(result.async).toBe(false)
    })

    it('should not route message from unauthorized sender', () => {
      const invalidSender: chrome.runtime.MessageSender = {
        id: 'different-extension-id'
      }

      const message: ExtensionMessage = {
        type: 'TEST',
        from: 'sidebar',
        to: 'content'
      }

      const result = routeMessage(message, invalidSender, sendResponse)

      expect(result.handled).toBe(false)
      expect(result.async).toBe(false)
    })

    it('should handle error when no active tab found', async () => {
      const message: ExtensionMessage = {
        type: 'TEST',
        from: 'sidebar',
        to: 'content'
      }

      mockChrome.tabs.query.mockResolvedValue([])

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))
      {
        expect(sendResponse).toHaveBeenCalledWith({ error: 'No active tab found' })
      }
    })

    it('should handle tab sendMessage error', async () => {
      const message: ExtensionMessage = {
        type: 'TEST',
        from: 'sidebar',
        to: 'content'
      }

      const mockTab = { id: 123 }
      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab closed'))

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))
      {
        expect(sendResponse).toHaveBeenCalledWith({ error: 'Tab closed' })
      }
    })

    it('should handle runtime sendMessage error', async () => {
      const message: ExtensionMessage = {
        type: 'TEST',
        from: 'content',
        to: 'sidebar'
      }

      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('No listener'))

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))
      {
        expect(sendResponse).toHaveBeenCalledWith({ error: 'No listener' })
      }
    })

    it('should not route message to background', () => {
      const message: ExtensionMessage = {
        type: 'TEST',
        from: 'sidebar',
        to: 'background'
      }

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(false)
      expect(result.async).toBe(false)
    })
  })

  describe('forwardToActiveTab', () => {
    it('should forward message to active tab', async () => {
      const message = { type: 'TEST_MESSAGE' }
      const mockTab = { id: 456 }

      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true })

      const response = await forwardToActiveTab(message)

      expect(response).toEqual({ success: true })
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true
      })
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(456, message)
    })

    it('should throw error when no active tab', async () => {
      mockChrome.tabs.query.mockResolvedValue([])

      await expect(forwardToActiveTab({ type: 'TEST' })).rejects.toThrow('No active tab found')
    })

    it('should throw error when tab has no ID', async () => {
      mockChrome.tabs.query.mockResolvedValue([{}])

      await expect(forwardToActiveTab({ type: 'TEST' })).rejects.toThrow('No active tab found')
    })
  })

  describe('broadcastToExtension', () => {
    it('should broadcast message to extension', async () => {
      const message = { type: 'BROADCAST_MESSAGE' }

      mockChrome.runtime.sendMessage.mockResolvedValue(undefined)

      await broadcastToExtension(message)

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message)
    })

    it('should handle error when no listeners (sidebar not open)', async () => {
      const message = { type: 'BROADCAST_MESSAGE' }

      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('No listeners'))

      await expect(broadcastToExtension(message)).resolves.toBeUndefined()
    })

    it('should not throw on broadcast errors', async () => {
      const message = { type: 'BROADCAST_MESSAGE' }

      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Any error'))

      await expect(broadcastToExtension(message)).resolves.toBeUndefined()
    })
  })

  describe('concurrent message handling', () => {
    const validSender: chrome.runtime.MessageSender = {
      id: 'test-extension-id'
    }

    beforeEach(() => {
      const mockTab = { id: 123 }
      mockChrome.tabs.query.mockResolvedValue([mockTab])
    })

    it('should handle multiple messages in parallel', async () => {
      const messages: ExtensionMessage[] = [
        { type: 'MESSAGE_1', from: 'sidebar', to: 'content' },
        { type: 'MESSAGE_2', from: 'sidebar', to: 'content' },
        { type: 'MESSAGE_3', from: 'sidebar', to: 'content' }
      ]

      mockChrome.tabs.sendMessage.mockImplementation((tabId, msg) =>
        Promise.resolve({ success: true, type: msg.type })
      )

      const responses: any[] = []
      const sendResponses = messages.map(() => jest.fn((response) => responses.push(response)))

      messages.forEach((msg, index) => {
        routeMessage(msg, validSender, sendResponses[index])
      })

      await new Promise(resolve => setTimeout(resolve, 200))

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(3)
      expect(responses).toHaveLength(3)
      responses.forEach((response, index) => {
        expect(response).toEqual({ success: true, type: messages[index].type })
      })
    })

    it('should not lose messages under concurrent load', async () => {
      const messageCount = 10
      const messages: ExtensionMessage[] = Array.from({ length: messageCount }, (_, i) => ({
        type: `MESSAGE_${i}`,
        from: 'sidebar',
        to: 'content'
      }))

      let resolveCount = 0
      mockChrome.tabs.sendMessage.mockImplementation((tabId, msg) => {
        resolveCount++
        return Promise.resolve({ success: true, type: msg.type, order: resolveCount })
      })

      const responses: any[] = []
      const sendResponses = messages.map(() => jest.fn((response) => responses.push(response)))

      messages.forEach((msg, index) => {
        routeMessage(msg, validSender, sendResponses[index])
      })

      await new Promise(resolve => setTimeout(resolve, 300))

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(messageCount)
      expect(responses).toHaveLength(messageCount)
      expect(resolveCount).toBe(messageCount)
    })

    it('should handle mixed success and failure in parallel', async () => {
      const messages: ExtensionMessage[] = [
        { type: 'SUCCESS_MSG', from: 'sidebar', to: 'content' },
        { type: 'FAIL_MSG', from: 'sidebar', to: 'content' },
        { type: 'SUCCESS_MSG_2', from: 'sidebar', to: 'content' }
      ]

      mockChrome.tabs.sendMessage.mockImplementation((tabId, msg) => {
        if (msg.type === 'FAIL_MSG') {
          return Promise.reject(new Error('Message failed'))
        }
        return Promise.resolve({ success: true, type: msg.type })
      })

      const responsesByType: Record<string, any> = {}
      const sendResponses = messages.map((msg) =>
        jest.fn((response) => {
          responsesByType[msg.type] = response
        })
      )

      messages.forEach((msg, index) => {
        routeMessage(msg, validSender, sendResponses[index])
      })

      await new Promise(resolve => setTimeout(resolve, 250))

      expect(Object.keys(responsesByType)).toHaveLength(3)
      expect(responsesByType['SUCCESS_MSG']).toEqual({ success: true, type: 'SUCCESS_MSG' })
      expect(responsesByType['FAIL_MSG']).toEqual({ error: 'Message failed' })
      expect(responsesByType['SUCCESS_MSG_2']).toEqual({ success: true, type: 'SUCCESS_MSG_2' })
    })

    it('should handle errors from tabs.query', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Query failed'))

      const message: ExtensionMessage = {
        type: 'TEST',
        from: 'sidebar',
        to: 'content'
      }

      const sendResponse = jest.fn()
      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(sendResponse).toHaveBeenCalledWith({ error: 'Query failed' })
    })
  })

  describe('message routing for different message types', () => {
    const validSender: chrome.runtime.MessageSender = {
      id: 'test-extension-id'
    }

    const sendResponse = jest.fn()

    beforeEach(() => {
      const mockTab = { id: 123 }
      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true })
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true })
    })

    it('should route TOGGLE_VISUAL_EDITOR message', async () => {
      const message: ExtensionMessage = {
        type: 'TOGGLE_VISUAL_EDITOR',
        from: 'sidebar',
        to: 'content'
      }

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(123, message)
    })

    it('should route SDK_STATUS message', async () => {
      const message: ExtensionMessage = {
        type: 'SDK_STATUS',
        from: 'content',
        to: 'sidebar',
        payload: { ready: true }
      }

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message)
    })

    it('should route UPDATE_STATE message', async () => {
      const message: ExtensionMessage = {
        type: 'UPDATE_STATE',
        from: 'content',
        to: 'sidebar',
        payload: { active: true }
      }

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message)
    })

    it('should route GET_CONFIG message', async () => {
      const message: ExtensionMessage = {
        type: 'GET_CONFIG',
        from: 'content',
        to: 'sidebar',
        requestId: 'req-123'
      }

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message)
    })

    it('should route API_REQUEST message', async () => {
      const message: ExtensionMessage = {
        type: 'API_REQUEST',
        from: 'sidebar',
        to: 'content',
        payload: { method: 'GET', path: '/api/test' }
      }

      const result = routeMessage(message, validSender, sendResponse)

      expect(result.handled).toBe(true)
      expect(result.async).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(123, message)
    })
  })
})
