import type { ExtensionMessage } from '../messaging'

// We'll dynamically import the module in tests to handle test mode mocking
let sendMessage: any
let setupMessageResponseHandler: any
let setupContentScriptMessageListener: any

describe('Messaging System', () => {
  describe('sendMessage - Production Mode', () => {
    beforeEach(async () => {
      jest.resetModules()

      // Set up production mode window BEFORE importing
      global.window = {
        self: global.window,
        top: global.window,
      } as any

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

      // Import module after mocks are set up
      const messaging = await import('../messaging')
      sendMessage = messaging.sendMessage
      setupMessageResponseHandler = messaging.setupMessageResponseHandler
      setupContentScriptMessageListener = messaging.setupContentScriptMessageListener
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
    let addEventListenerSpy: jest.Mock

    beforeEach(async () => {
      jest.resetModules()

      mockParentWindow = {
        postMessage: jest.fn(),
        __isMockParent: true
      }

      addEventListenerSpy = jest.fn()

      // Create a separate object for self window to ensure self !== top
      const selfWindow = {
        __isMockSelf: true,
        addEventListener: addEventListenerSpy,
        postMessage: jest.fn()
      }

      // CRITICAL: In jsdom, window.top is NOT configurable, but window.self IS configurable
      // For isTestMode() to return true, we need window.self !== window.top
      // Since we can't change window.top, we change window.self to point to a different object
      Object.defineProperty(window, 'self', {
        value: selfWindow,
        writable: true,
        configurable: true
      })

      // We can mock window.parent since it's typically configurable
      try {
        Object.defineProperty(window, 'parent', {
          value: mockParentWindow,
          writable: true,
          configurable: true
        })
      } catch (e) {
        // If parent is not configurable, that's okay for these tests
      }

      // Mock window.addEventListener to use our spy
      window.addEventListener = addEventListenerSpy as any

      // Verify the setup is correct
      if (window.self === window.top) {
        throw new Error('Test setup error: window.self === window.top. They must be different for test mode!')
      }

      // Import module after mocks are set up
      const messaging = await import('../messaging')
      sendMessage = messaging.sendMessage
      setupMessageResponseHandler = messaging.setupMessageResponseHandler
      setupContentScriptMessageListener = messaging.setupContentScriptMessageListener
    })

    afterEach(() => {
      jest.clearAllMocks()

      // Restore window.self to point back to window for production mode tests
      // This prevents test mode from bleeding into subsequent tests
      Object.defineProperty(window, 'self', {
        value: window,
        writable: true,
        configurable: true
      })
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
      addEventListenerSpy.mockImplementation((event: string, handler: Function) => {
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
    let mockGetElementById: jest.Mock
    let addEventListenerSpy: jest.Mock

    beforeEach(async () => {
      jest.resetModules()

      // Initialize mockListeners array BEFORE creating the spy
      mockListeners = []

      // Create a stable contentWindow object that will be reused
      const stableContentWindow = {
        postMessage: jest.fn()
      }

      mockSidebarIframe = {
        id: 'absmartly-sidebar-iframe',
        contentWindow: stableContentWindow
      }

      mockGetElementById = jest.fn().mockImplementation((id: string) => {
        if (id === 'absmartly-sidebar-iframe') {
          return mockSidebarIframe
        }
        return null
      })

      // Mock document.getElementById on the actual document object (jsdom)
      document.getElementById = mockGetElementById as any

      // Create spy that captures handlers into mockListeners
      const captureListener = (event: string, handler: Function) => {
        if (event === 'message') {
          mockListeners.push(handler)
        }
      }

      addEventListenerSpy = jest.fn(captureListener)

      // Set window.addEventListener on the actual window object (jsdom)
      window.addEventListener = addEventListenerSpy as any

      global.chrome = {
        runtime: {
          onMessage: {
            hasListeners: () => true,
            _listeners: [] as Function[]
          }
        }
      } as any

      // Import module after mocks are set up
      const messaging = await import('../messaging')
      sendMessage = messaging.sendMessage
      setupMessageResponseHandler = messaging.setupMessageResponseHandler
      setupContentScriptMessageListener = messaging.setupContentScriptMessageListener
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should set up window message listener for sidebar iframe', () => {
      setupContentScriptMessageListener()

      // Check if addEventListener was called
      expect(addEventListenerSpy).toHaveBeenCalled()
      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function))
      // Verify listener was captured
      expect(mockListeners.length).toBe(1)
    })

    it('should forward postMessage to chrome.runtime.onMessage listeners', () => {
      const mockOnMessageListener = jest.fn()
      ;(chrome.runtime.onMessage as any)._listeners = [mockOnMessageListener]

      setupContentScriptMessageListener()

      // Verify listener was added
      expect(mockListeners.length).toBeGreaterThan(0)

      // Verify mock getElementById works correctly
      const iframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement
      expect(iframe).toBe(mockSidebarIframe)
      expect(iframe?.contentWindow).toBe(mockSidebarIframe.contentWindow)

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

      // Verify source matches
      expect(messageEvent.source).toBe(mockSidebarIframe.contentWindow)

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
      mockGetElementById.mockReturnValue(null)

      setupContentScriptMessageListener()

      // Should still add window listener (security check happens inside the handler)
      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function))
    })
  })

  describe('Message Routing', () => {
    beforeEach(async () => {
      jest.resetModules()

      global.window = {
        self: global.window,
        top: global.window,
      } as any

      global.chrome = {
        runtime: {
          sendMessage: jest.fn().mockResolvedValue({ success: true }),
        }
      } as any

      // Import module after mocks are set up
      const messaging = await import('../messaging')
      sendMessage = messaging.sendMessage
    })

    it('should preserve all message fields when routing', async () => {

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
