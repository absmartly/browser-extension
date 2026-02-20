import type { ExtensionMessage } from '../messaging'
import { sendToContent, sendToBackground, broadcastToExtension } from '../messaging'

describe('Messaging System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.chrome = {
      tabs: {
        query: jest.fn().mockResolvedValue([{ id: 123 }]),
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
      },
      runtime: {
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
      },
    } as any
  })

  describe('sendToContent', () => {
    it('should send message to content via chrome.tabs.sendMessage', async () => {
      const message: ExtensionMessage = {
        type: 'PREVIEW_CHANGES',
        from: 'sidebar',
        to: 'content',
        payload: { changes: [] },
      }

      await sendToContent(message)

      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, message)
    })

    it('should throw error when no active tab found', async () => {
      ;(chrome.tabs.query as any).mockResolvedValue([])

      const message: ExtensionMessage = {
        type: 'PREVIEW_CHANGES',
        from: 'sidebar',
        to: 'content',
      }

      await expect(sendToContent(message)).rejects.toThrow('No active tab found')
    })

    it('should return response from content script', async () => {
      const expectedResponse = { success: true, data: 'test' }
      ;(chrome.tabs.sendMessage as any).mockResolvedValue(expectedResponse)

      const message: ExtensionMessage = {
        type: 'PREVIEW_CHANGES',
        from: 'sidebar',
        to: 'content',
      }

      const response = await sendToContent(message)

      expect(response).toEqual(expectedResponse)
    })
  })

  describe('sendToBackground', () => {
    it('should send message to background via chrome.runtime.sendMessage', async () => {
      const message: ExtensionMessage = {
        type: 'API_REQUEST',
        from: 'sidebar',
        to: 'background',
        payload: { method: 'GET', path: '/experiments' },
      }

      await sendToBackground(message)

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message)
    })

    it('should return response from background', async () => {
      const expectedResponse = { success: true, data: [] }
      ;(chrome.runtime.sendMessage as any).mockResolvedValue(expectedResponse)

      const message: ExtensionMessage = {
        type: 'API_REQUEST',
        from: 'sidebar',
        to: 'background',
      }

      const response = await sendToBackground(message)

      expect(response).toEqual(expectedResponse)
    })

    it('should propagate errors from background', async () => {
      const error = new Error('Network error')
      ;(chrome.runtime.sendMessage as any).mockRejectedValue(error)

      const message: ExtensionMessage = {
        type: 'API_REQUEST',
        from: 'sidebar',
        to: 'background',
      }

      await expect(sendToBackground(message)).rejects.toThrow('Network error')
    })
  })

  describe('broadcastToExtension', () => {
    it('should broadcast message to extension pages', async () => {
      const message: ExtensionMessage = {
        type: 'STATE_UPDATE',
        from: 'background',
        payload: { updated: true },
      }

      await broadcastToExtension(message)

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message)
    })

    it('should handle error when no listeners (sidebar not open)', async () => {
      ;(chrome.runtime.sendMessage as any).mockRejectedValue(new Error('No listeners'))

      const message: ExtensionMessage = {
        type: 'STATE_UPDATE',
        from: 'background',
      }

      // Should not throw, broadcasts handle no listeners gracefully
      await expect(broadcastToExtension(message)).resolves.toBeUndefined()
    })

    it('should accept any message type for broadcast', async () => {
      const message = {
        type: 'CUSTOM_EVENT',
        from: 'content',
        payload: { custom: 'data' },
      }

      await broadcastToExtension(message)

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message)
    })
  })

  describe('Message Routing', () => {
    it('should route message with from and to fields', async () => {
      const message: ExtensionMessage = {
        type: 'EXPERIMENT_UPDATE',
        from: 'background',
        to: 'sidebar',
        payload: { id: '123', name: 'Experiment 1' },
      }

      await sendToBackground(message)

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXPERIMENT_UPDATE',
          from: 'background',
          to: 'sidebar',
        })
      )
    })

    it('should preserve all message fields', async () => {
      const message: ExtensionMessage = {
        type: 'CUSTOM_MESSAGE',
        from: 'sidebar',
        to: 'background',
        payload: {
          nested: {
            data: [1, 2, 3],
          },
        },
        requestId: 'req-123',
        expectsResponse: true,
        customField: 'custom value',
      }

      await sendToBackground(message)

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CUSTOM_MESSAGE',
          from: 'sidebar',
          to: 'background',
          payload: {
            nested: {
              data: [1, 2, 3],
            },
          },
          requestId: 'req-123',
          expectsResponse: true,
          customField: 'custom value',
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle tab messaging errors', async () => {
      const error = new Error('Tab closed')
      ;(chrome.tabs.sendMessage as any).mockRejectedValue(error)

      const message: ExtensionMessage = {
        type: 'TEST',
        from: 'sidebar',
        to: 'content',
      }

      await expect(sendToContent(message)).rejects.toThrow('Tab closed')
    })

    it('should handle runtime messaging errors', async () => {
      const error = new Error('No listener')
      ;(chrome.runtime.sendMessage as any).mockRejectedValue(error)

      const message: ExtensionMessage = {
        type: 'TEST',
        from: 'sidebar',
        to: 'background',
      }

      await expect(sendToBackground(message)).rejects.toThrow('No listener')
    })
  })
})
