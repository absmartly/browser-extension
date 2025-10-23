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
})
