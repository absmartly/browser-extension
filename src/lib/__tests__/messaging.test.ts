import { sendMessage, setupMessageResponseHandler, setupContentScriptMessageListener } from '../messaging'
import type { ExtensionMessage } from '../messaging'

describe('Messaging System', () => {
  describe('sendMessage - Production Mode', () => {
    beforeEach(() => {
      // Mock chrome API
      global.chrome = {
        runtime: {
          sendMessage: jest.fn().mockResolvedValue({ success: true }),
        },
        tabs: {
          query: jest.fn().mockResolvedValue([{ id: 123 }]),
          sendMessage: jest.fn().mockResolvedValue({ success: true }),
        },
      } as any

      // Mock window to simulate production (not in iframe)
      global.window = {
        self: global.window,
        top: global.window,
      } as any
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should send message to background via chrome.runtime.sendMessage', async () => {
      const message: ExtensionMessage = {
        type: 'TEST_MESSAGE',
        from: 'sidebar',
        to: 'background',
        expectsResponse: true,
        payload: { data: 'test' }
      }

      await sendMessage(message)

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TEST_MESSAGE',
          from: 'sidebar',
          to: 'background',
          payload: { data: 'test' }
        })
      )
    })

    it('should send message to content via chrome.tabs.sendMessage', async () => {
      const message: ExtensionMessage = {
        type: 'ABSMARTLY_PREVIEW',
        from: 'sidebar',
        to: 'content',
        expectsResponse: false,
        payload: { action: 'apply' }
      }

      await sendMessage(message)

      expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true })
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          type: 'ABSMARTLY_PREVIEW',
          from: 'sidebar',
          to: 'content'
        })
      )
    })

    it('should generate unique requestId for each message', async () => {
      const message1: ExtensionMessage = {
        type: 'TEST_1',
        from: 'sidebar',
        to: 'background'
      }

      const message2: ExtensionMessage = {
        type: 'TEST_2',
        from: 'sidebar',
        to: 'background'
      }

      await sendMessage(message1)
      await sendMessage(message2)

      const calls = (chrome.runtime.sendMessage as any).mock.calls
      const requestId1 = calls[0][0].requestId
      const requestId2 = calls[1][0].requestId

      expect(requestId1).toBeDefined()
      expect(requestId2).toBeDefined()
      expect(requestId1).not.toBe(requestId2)
    })

    it('should throw error when no active tab found for content messages', async () => {
      (chrome.tabs.query as any).mockResolvedValue([])

      const message: ExtensionMessage = {
        type: 'TEST',
        from: 'sidebar',
        to: 'content'
      }

      await expect(sendMessage(message)).rejects.toThrow('No active tab found')
    })
  })

  describe('sendMessage - Test Mode (iframe)', () => {
    let mockParentWindow: any

    beforeEach(() => {
      mockParentWindow = {
        postMessage: jest.fn()
      }

      // Mock window to simulate test mode (in iframe)
      global.window = {
        self: {} as Window,
        top: mockParentWindow as Window,
        parent: mockParentWindow,
        addEventListener: jest.fn(),
        postMessage: jest.fn()
      } as any
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should send message via window.parent.postMessage in test mode', async () => {
      const message: ExtensionMessage = {
        type: 'ABSMARTLY_PREVIEW',
        from: 'sidebar',
        to: 'content',
        expectsResponse: false,
        payload: { action: 'apply' }
      }

      // Don't await since we're testing fire-and-forget
      sendMessage(message)

      // Wait a tick for async operation
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockParentWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'absmartly-extension',
          type: 'ABSMARTLY_PREVIEW',
          from: 'sidebar',
          to: 'content',
          payload: { action: 'apply' }
        }),
        '*'
      )
    })

    it('should handle response for messages expecting response in test mode', async () => {
      const message: ExtensionMessage = {
        type: 'API_REQUEST',
        from: 'sidebar',
        to: 'background',
        expectsResponse: true,
        payload: { method: 'GET', path: '/test' }
      }

      // Setup response handler first
      let messageEvent: any
      ;(window.addEventListener as any).mockImplementation((event: string, handler: Function) => {
        if (event === 'message') {
          messageEvent = handler
        }
      })
      setupMessageResponseHandler()

      // Send message
      const responsePromise = sendMessage(message)

      // Wait a tick
      await new Promise(resolve => setTimeout(resolve, 0))

      // Get the requestId from the call
      const call = mockParentWindow.postMessage.mock.calls[0]
      const sentMessage = call[0]
      const requestId = sentMessage.requestId

      // Simulate response
      messageEvent({
        data: {
          source: 'absmartly-extension-response',
          requestId: requestId,
          response: { success: true, data: 'test data' }
        }
      })

      const response = await responsePromise
      expect(response).toEqual({ success: true, data: 'test data' })
    })

    it('should timeout if no response received in test mode', async () => {
      const message: ExtensionMessage = {
        type: 'API_REQUEST',
        from: 'sidebar',
        to: 'background',
        expectsResponse: true
      }

      setupMessageResponseHandler()

      // This should timeout (we're not sending a response)
      await expect(sendMessage(message)).rejects.toThrow('Message timeout')
    }, 15000) // Increase timeout for this test
  })

  describe('setupContentScriptMessageListener', () => {
    let mockSidebarIframe: any
    let mockListeners: Function[]

    beforeEach(() => {
      mockListeners = []

      mockSidebarIframe = {
        id: 'absmartly-sidebar-iframe',
        contentWindow: {
          postMessage: jest.fn()
        }
      }

      global.document = {
        getElementById: jest.fn().mockImplementation((id: string) => {
          if (id === 'absmartly-sidebar-iframe') {
            return mockSidebarIframe
          }
          return null
        })
      } as any

      global.window = {
        addEventListener: jest.fn().mockImplementation((event: string, handler: Function) => {
          if (event === 'message') {
            mockListeners.push(handler)
          }
        })
      } as any

      global.chrome = {
        runtime: {
          onMessage: {
            hasListeners: () => true,
            _listeners: [] as Function[]
          }
        }
      } as any
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should set up window message listener for sidebar iframe', () => {
      setupContentScriptMessageListener()

      expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('should forward postMessage to chrome.runtime.onMessage listeners', () => {
      const mockOnMessageListener = jest.fn()
      ;(chrome.runtime.onMessage as any)._listeners = [mockOnMessageListener]

      setupContentScriptMessageListener()

      // Simulate postMessage from sidebar
      const messageEvent = {
        source: mockSidebarIframe.contentWindow,
        data: {
          source: 'absmartly-extension',
          type: 'ABSMARTLY_PREVIEW',
          from: 'sidebar',
          to: 'content',
          payload: { action: 'apply' }
        }
      }

      mockListeners[0](messageEvent)

      expect(mockOnMessageListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ABSMARTLY_PREVIEW',
          from: 'sidebar',
          to: 'content'
        }),
        {},
        expect.any(Function)
      )
    })

    it('should send response back to sidebar iframe via postMessage', () => {
      const mockOnMessageListener = jest.fn((message, sender, sendResponse) => {
        sendResponse({ success: true })
        return true
      })
      ;(chrome.runtime.onMessage as any)._listeners = [mockOnMessageListener]

      setupContentScriptMessageListener()

      // Simulate postMessage from sidebar with requestId
      const messageEvent = {
        source: mockSidebarIframe.contentWindow,
        data: {
          source: 'absmartly-extension',
          type: 'ABSMARTLY_PREVIEW',
          from: 'sidebar',
          to: 'content',
          requestId: 'test-request-id-123',
          payload: { action: 'apply' }
        }
      }

      mockListeners[0](messageEvent)

      expect(mockSidebarIframe.contentWindow.postMessage).toHaveBeenCalledWith(
        {
          source: 'absmartly-extension-response',
          requestId: 'test-request-id-123',
          response: { success: true }
        },
        '*'
      )
    })

    it('should ignore messages not from sidebar iframe', () => {
      const mockOnMessageListener = jest.fn()
      ;(chrome.runtime.onMessage as any)._listeners = [mockOnMessageListener]

      setupContentScriptMessageListener()

      // Simulate postMessage from different source
      const messageEvent = {
        source: { postMessage: jest.fn() }, // Different window
        data: {
          source: 'absmartly-extension',
          type: 'TEST'
        }
      }

      mockListeners[0](messageEvent)

      expect(mockOnMessageListener).not.toHaveBeenCalled()
    })

    it('should not set up listener if sidebar iframe not found', () => {
      (document.getElementById as any).mockReturnValue(null)

      setupContentScriptMessageListener()

      // Should still add listener but log that iframe not found
      expect(window.addEventListener).not.toHaveBeenCalled()
    })
  })

  describe('Message Routing', () => {
    it('should preserve all message fields when routing', async () => {
      global.chrome = {
        runtime: {
          sendMessage: jest.fn().mockResolvedValue({ success: true }),
        }
      } as any

      global.window = {
        self: global.window,
        top: global.window,
      } as any

      const message: ExtensionMessage = {
        type: 'CUSTOM_MESSAGE',
        from: 'sidebar',
        to: 'background',
        expectsResponse: true,
        requestId: 'custom-id',
        payload: {
          nested: {
            data: [1, 2, 3]
          }
        },
        customField: 'custom value'
      }

      await sendMessage(message)

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CUSTOM_MESSAGE',
          from: 'sidebar',
          to: 'background',
          payload: {
            nested: {
              data: [1, 2, 3]
            }
          },
          customField: 'custom value'
        })
      )
    })
  })
})
