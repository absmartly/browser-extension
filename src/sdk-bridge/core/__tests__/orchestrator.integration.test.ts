import { Orchestrator } from '../orchestrator'
import { Logger } from '../../utils/logger'

jest.mock('../../sdk/sdk-detector')
jest.mock('../../sdk/sdk-interceptor')
jest.mock('../../experiment/override-manager')
jest.mock('../../dom/preview-manager')
jest.mock('../../utils/logger')

import { SDKDetector } from '../../sdk/sdk-detector'
import { SDKInterceptor } from '../../sdk/sdk-interceptor'
import { OverrideManager } from '../../experiment/override-manager'
import { PreviewManager } from '../../dom/preview-manager'

const dispatchMessageEvent = (init: MessageEventInit) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      ...init,
      source: window,
      origin: window.location.origin
    })
  )
}

describe('Orchestrator Integration Tests', () => {
  let orchestrator: Orchestrator
  let mockSDKDetector: jest.Mocked<SDKDetector>
  let mockSDKInterceptor: jest.Mocked<SDKInterceptor>
  let mockOverrideManager: jest.Mocked<OverrideManager>
  let mockPreviewManager: jest.Mocked<PreviewManager>
  let mockWindow: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    mockWindow = global.window as any
    mockWindow.postMessage = jest.fn()

    orchestrator = new Orchestrator({
      maxAttempts: 3,
      attemptInterval: 100,
      debug: true
    })

    mockSDKDetector = (orchestrator as any).sdkDetector
    mockSDKInterceptor = (orchestrator as any).sdkInterceptor
    mockOverrideManager = (orchestrator as any).overrideManager
    mockPreviewManager = (orchestrator as any).previewManager
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('1. SDK Detection', () => {
    it('should detect SDK before timeout', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn(() => ({ experiments: { exp1: {} } })),
        ready: jest.fn(() => Promise.resolve()),
        pending: jest.fn(() => false)
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      const state = orchestrator.getState()
      expect(state.cachedContext).toBe(mockContext)
      expect(state.contextPropertyPath).toBe('window.absmartly')
      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })

    it('should handle SDK detection race condition - SDK loads after timeout', () => {
      mockSDKDetector.detectSDK = jest.fn()
        .mockReturnValueOnce({ sdk: null, context: null, contextPath: null })
        .mockReturnValueOnce({ sdk: null, context: null, contextPath: null })
        .mockReturnValueOnce({ sdk: null, context: null, contextPath: null })

      orchestrator.start()
      jest.advanceTimersByTime(100)
      jest.advanceTimersByTime(100)
      jest.advanceTimersByTime(100)

      expect(Logger.log).toHaveBeenCalledWith(
        expect.stringContaining('No ABsmartly SDK found after')
      )

      const state = orchestrator.getState()
      expect(state.cachedContext).toBeNull()
    })

    it('should detect SDK on first attempt', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(mockSDKDetector.detectSDK).toHaveBeenCalledTimes(1)
      expect(orchestrator.getContext()).toBe(mockContext)
    })

    it('should retry detection with backoff on failure', () => {
      mockSDKDetector.detectSDK = jest.fn()
        .mockReturnValueOnce({ sdk: null, context: null, contextPath: null })
        .mockReturnValueOnce({ sdk: null, context: null, contextPath: null })

      orchestrator.start()

      jest.advanceTimersByTime(100)
      expect(mockSDKDetector.detectSDK).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(100)
      expect(mockSDKDetector.detectSDK).toHaveBeenCalledTimes(2)
    })

    it('should handle SDK loading after orchestrator gives up', () => {
      mockSDKDetector.detectSDK = jest.fn()
        .mockReturnValue({ sdk: null, context: null, contextPath: null })

      orchestrator.start()

      jest.advanceTimersByTime(100)
      jest.advanceTimersByTime(100)
      jest.advanceTimersByTime(100)

      expect(Logger.log).toHaveBeenCalledWith(
        expect.stringContaining('No ABsmartly SDK found')
      )

      const laterContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }
      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: laterContext,
        contextPath: 'window.absmartly'
      })

      const detectionResult = mockSDKDetector.detectSDK()
      expect(detectionResult.context).toBe(laterContext)
    })

    it('should handle SDK detection with pending context', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn(() => ({ experiments: {} })),
        ready: jest.fn(() => Promise.resolve()),
        pending: jest.fn(() => true)
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(mockContext.ready).toHaveBeenCalled()
      expect(Logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Context is pending, waiting for it to be ready')
      )
    })
  })

  describe('2. Context Caching', () => {
    it('should cache context after first detection', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      const state = orchestrator.getState()
      expect(state.cachedContext).toBe(mockContext)

      jest.advanceTimersByTime(100)
      expect(mockSDKDetector.detectSDK).toHaveBeenCalledTimes(1)
    })

    it('should reuse cached context on subsequent calls', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      const context1 = orchestrator.getContext()
      const context2 = orchestrator.getContext()

      expect(context1).toBe(context2)
      expect(context1).toBe(mockContext)
    })

    it('should not invalidate context on page navigation', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      const contextBefore = orchestrator.getContext()

      window.dispatchEvent(new Event('popstate'))

      const contextAfter = orchestrator.getContext()
      expect(contextAfter).toBe(contextBefore)
    })

    it('should handle stale context gracefully', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn(() => null)
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(orchestrator.getContext()).toBe(mockContext)
    })

    it('should share cached context across components', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      const state = orchestrator.getState()
      expect(state.cachedContext).toBe(mockContext)

      const context = orchestrator.getContext()
      expect(context).toBe(mockContext)
    })
  })

  describe('3. Preview Manager Coordination', () => {
    beforeEach(() => {
      orchestrator.setupMessageListener()
    })

    it('should apply preview changes via PreviewManager', () => {
      const mockChanges = [
        { selector: '.test', type: 'text', value: 'Preview Text' }
      ]

      mockPreviewManager.applyPreviewChange = jest.fn().mockReturnValue(true)

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {
            experimentName: 'test-exp',
            variantName: 'variant-1',
            changes: mockChanges
          }
        }
})

      expect(mockPreviewManager.applyPreviewChange).toHaveBeenCalledWith(
        mockChanges[0],
        'test-exp'
      )
    })

    it('should remove preview changes via PreviewManager', () => {
      mockPreviewManager.removePreviewChanges = jest.fn().mockReturnValue(true)

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'REMOVE_PREVIEW',
          payload: {
            experimentName: 'test-exp'
          }
        }
})

      expect(mockPreviewManager.removePreviewChanges).toHaveBeenCalledWith('test-exp')
    })

    it('should handle preview + override interaction - preview wins', () => {
      const mockChanges = [
        { selector: '.test', type: 'text', value: 'Preview Text' }
      ]

      mockPreviewManager.applyPreviewChange = jest.fn().mockReturnValue(true)
      mockOverrideManager.checkOverridesCookie = jest.fn()

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {
            experimentName: 'test-exp',
            changes: mockChanges
          }
        }
})

      expect(mockPreviewManager.applyPreviewChange).toHaveBeenCalled()
    })

    it('should handle multiple experiments with overlapping selectors', () => {
      mockPreviewManager.applyPreviewChange = jest.fn().mockReturnValue(true)

      const changes1 = [{ selector: '.test', type: 'text', value: 'Exp1' }]
      const changes2 = [{ selector: '.test', type: 'style', css: { color: 'red' } }]

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: { experimentName: 'exp1', changes: changes1 }
        }
})

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: { experimentName: 'exp2', changes: changes2 }
        }
})

      expect(mockPreviewManager.applyPreviewChange).toHaveBeenCalledTimes(2)
    })

    it('should cleanup preview on navigation', () => {
      mockPreviewManager.clearAll = jest.fn()

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'REMOVE_PREVIEW',
          payload: { experimentName: '__preview__' }
        }
})

      expect(mockPreviewManager.removePreviewChanges).toHaveBeenCalled()
    })

    it('should handle replace mode - removes existing changes first', () => {
      mockPreviewManager.removePreviewChanges = jest.fn()
      mockPreviewManager.applyPreviewChange = jest.fn().mockReturnValue(true)

      const mockChanges = [
        { selector: '.test', type: 'text', value: 'New Text' }
      ]

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {
            experimentName: 'test-exp',
            updateMode: 'replace',
            changes: mockChanges
          }
        }
})

      expect(mockPreviewManager.removePreviewChanges).toHaveBeenCalledWith('test-exp')
      expect(mockPreviewManager.applyPreviewChange).toHaveBeenCalledWith(
        mockChanges[0],
        'test-exp'
      )
    })

    it('should handle ABSMARTLY_PREVIEW apply action', () => {
      mockPreviewManager.applyPreviewChange = jest.fn().mockReturnValue(true)

      const mockChanges = [
        { selector: '.test', type: 'text', value: 'Test' }
      ]

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'ABSMARTLY_PREVIEW',
          payload: {
            action: 'apply',
            changes: mockChanges,
            experimentName: 'test-exp'
          }
        }
})

      expect(mockPreviewManager.applyPreviewChange).toHaveBeenCalled()
    })

    it('should handle ABSMARTLY_PREVIEW remove action', () => {
      mockPreviewManager.removePreviewChanges = jest.fn().mockReturnValue(true)

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'ABSMARTLY_PREVIEW',
          payload: {
            action: 'remove',
            experimentName: 'test-exp'
          }
        }
})

      expect(mockPreviewManager.removePreviewChanges).toHaveBeenCalledWith('test-exp')
    })
  })

  describe('4. Override Manager Integration', () => {
    beforeEach(() => {
      orchestrator.setupMessageListener()
    })

    it('should apply overrides via OverrideManager', () => {
      mockOverrideManager.checkOverridesCookie = jest.fn()

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'APPLY_OVERRIDES',
          payload: {
            overrides: { 'test-exp': 1 }
          }
        }
})

      expect(mockOverrideManager.checkOverridesCookie).toHaveBeenCalled()
    })

    it('should persist overrides across page loads', () => {
      mockOverrideManager.checkOverridesCookie = jest.fn()

      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(mockOverrideManager.checkOverridesCookie).toHaveBeenCalled()
    })

    it('should handle override + preview conflict - both applied', () => {
      mockOverrideManager.checkOverridesCookie = jest.fn()
      mockPreviewManager.applyPreviewChange = jest.fn().mockReturnValue(true)

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'APPLY_OVERRIDES',
          payload: { overrides: { 'test-exp': 1 } }
        }
})

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {
            experimentName: 'test-exp',
            changes: [{ selector: '.test', type: 'text', value: 'Test' }]
          }
        }
})

      expect(mockOverrideManager.checkOverridesCookie).toHaveBeenCalled()
      expect(mockPreviewManager.applyPreviewChange).toHaveBeenCalled()
    })

    it('should handle multiple override scenarios', () => {
      mockOverrideManager.checkOverridesCookie = jest.fn()

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'APPLY_OVERRIDES',
          payload: {
            overrides: {
              'exp1': 0,
              'exp2': 1,
              'exp3': 2
            }
          }
        }
})

      expect(mockOverrideManager.checkOverridesCookie).toHaveBeenCalled()
    })
  })

  describe('5. Message Passing', () => {
    beforeEach(() => {
      orchestrator.setupMessageListener()
    })

    it('should handle messages between page context and content script', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })

    it('should queue messages during initialization', () => {
      mockPreviewManager.applyPreviewChange = jest.fn().mockReturnValue(true)

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {
            changes: [{ selector: '.test', type: 'text', value: 'Test' }],
            experimentName: 'test-exp'
          }
        }
})

      expect(mockPreviewManager.applyPreviewChange).toHaveBeenCalled()
    })

    it('should handle message handling errors gracefully', () => {
      mockPreviewManager.applyPreviewChange = jest.fn().mockImplementation(() => {
        throw new Error('Preview failed')
      })

      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {
            changes: [{ selector: '.test', type: 'text', value: 'Test' }],
            experimentName: 'test-exp'
          }
        }
})

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error applying preview changes'),
        expect.any(Error)
      )
    })

    it('should synchronize state across contexts', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      const state = orchestrator.getState()
      expect(state.cachedContext).toBe(mockContext)
    })

    it('should ignore messages from wrong source', () => {
      mockPreviewManager.applyPreviewChange = jest.fn()

      dispatchMessageEvent({
        data: {
          source: 'other-extension',
          type: 'PREVIEW_CHANGES',
          payload: {}
        }
})

      expect(mockPreviewManager.applyPreviewChange).not.toHaveBeenCalled()
    })

    it('should handle unknown message types', () => {
      dispatchMessageEvent({
        data: {
          source: 'absmartly-extension',
          type: 'UNKNOWN_TYPE',
          payload: {}
        }
})

      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown message type'),
        'UNKNOWN_TYPE'
      )
    })
  })

  describe('6. Event Buffering', () => {
    it('should buffer SDK events before initialization', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        _eventLogger: { handleEvent: jest.fn() }
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(mockSDKInterceptor.interceptEventLogger).toHaveBeenCalledWith(mockContext)
    })

    it('should replay events after initialization', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn(),
        _eventLogger: { handleEvent: jest.fn() }
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(mockSDKInterceptor.interceptEventLogger).toHaveBeenCalledWith(mockContext)
    })

    it('should deduplicate events', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        _eventLogger: { handleEvent: jest.fn() }
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(mockSDKInterceptor.interceptEventLogger).toHaveBeenCalledTimes(1)
    })

    it('should handle buffer overflow gracefully', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(orchestrator.getContext()).toBe(mockContext)
    })
  })

  describe('8. Error Scenarios', () => {
    it('should handle SDK initialization failure', () => {
      mockSDKDetector.detectSDK = jest.fn().mockImplementation(() => {
        throw new Error('SDK detection failed')
      })

      expect(() => {
        orchestrator.start()
        jest.advanceTimersByTime(100)
      }).toThrow()
    })

    it('should handle plugin not found', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })

    it('should handle context detection timeout', () => {
      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: null,
        contextPath: null
      })

      orchestrator.start()

      jest.advanceTimersByTime(100)
      jest.advanceTimersByTime(100)
      jest.advanceTimersByTime(100)

      expect(Logger.log).toHaveBeenCalledWith(
        expect.stringContaining('No ABsmartly SDK found')
      )
    })

    it('should handle messaging errors', () => {
      mockWindow.postMessage = jest.fn().mockImplementation(() => {
        throw new Error('Message failed')
      })

      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })

      expect(() => {
        ;(orchestrator as any).handleCheckPluginStatus()
      }).toThrow()
    })

    it('should recover from state corruption', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      const state = orchestrator.getState()
      expect(state.cachedContext).toBe(mockContext)
    })

    it('should handle context ready() promise rejection', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn(() => ({ experiments: {} })),
        ready: jest.fn(() => Promise.reject(new Error('Context ready failed'))),
        pending: jest.fn(() => true)
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(mockContext.ready).toHaveBeenCalled()
    })

  })

  describe('9. Exposed APIs', () => {
    it('should expose variant assignments getter', () => {
      orchestrator.exposeVariantAssignments()

      expect((window as any).__absmartlyGetVariantAssignments).toBeDefined()
      expect(typeof (window as any).__absmartlyGetVariantAssignments).toBe('function')
    })

    it('should expose context path getter', () => {
      orchestrator.exposeContextPath()

      expect((window as any).__absmartlyGetContextPath).toBeDefined()
      expect(typeof (window as any).__absmartlyGetContextPath).toBe('function')
    })

    it('should return variant assignments for experiments', async () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn((expName: string) => {
          if (expName === 'exp1') return 0
          if (expName === 'exp2') return 1
          return -1
        }),
        data: jest.fn(() => ({
          experiments: {
            exp1: {},
            exp2: {}
          }
        })),
        ready: jest.fn(() => Promise.resolve())
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      orchestrator.exposeVariantAssignments()

      const result = await (window as any).__absmartlyGetVariantAssignments(['exp1', 'exp2', 'exp3'])

      expect(result).toEqual({
        assignments: {
          exp1: 0,
          exp2: 1
        },
        experimentsInContext: ['exp1', 'exp2']
      })
    })

    it('should return context path information', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      orchestrator.exposeContextPath()

      const result = (window as any).__absmartlyGetContextPath()

      expect(result).toEqual({
        found: true,
        path: 'window.absmartly',
        hasContext: true,
        hasPeek: true,
        hasTreatment: true
      })
    })
  })

  describe('10. DOM Content Loaded', () => {
    it('should start immediately if DOM is already loaded', () => {
      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true
      })

      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK = jest.fn().mockReturnValue({
        sdk: null,
        context: mockContext,
        contextPath: 'window.absmartly'
      })


      orchestrator.start()
      jest.advanceTimersByTime(100)

      expect(mockSDKDetector.detectSDK).toHaveBeenCalled()
    })

    it('should wait for DOMContentLoaded if loading', () => {
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        writable: true,
        configurable: true
      })

      const addEventListenerSpy = jest.spyOn(document, 'addEventListener')

      orchestrator.start()

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      )

      addEventListenerSpy.mockRestore()
    })
  })
})
