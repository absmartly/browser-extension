/**
 * Orchestrator Unit Tests
 */

import { Orchestrator } from '../../core/orchestrator'
import { SDKDetector } from '../../sdk/sdk-detector'
import { PluginDetector } from '../../sdk/plugin-detector'
import { SDKInterceptor } from '../../sdk/sdk-interceptor'
import { CodeInjector } from '../../experiment/code-injector'
import { OverrideManager } from '../../experiment/override-manager'
import { Logger } from '../../utils/logger'

jest.mock('../../sdk/sdk-detector')
jest.mock('../../sdk/plugin-detector')
jest.mock('../../sdk/sdk-interceptor')
jest.mock('../../experiment/code-injector')
jest.mock('../../experiment/override-manager')
jest.mock('../../utils/logger')

describe('Orchestrator', () => {
  let orchestrator: Orchestrator
  let mockSDKDetector: jest.Mocked<SDKDetector>
  let mockPluginDetector: jest.Mocked<PluginDetector>
  let mockSDKInterceptor: jest.Mocked<SDKInterceptor>
  let mockCodeInjector: jest.Mocked<CodeInjector>
  let mockOverrideManager: jest.Mocked<OverrideManager>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Create mocked instances
    mockSDKDetector = {
      detectSDK: jest.fn().mockReturnValue({ sdk: null, context: null, contextPath: null })
    } as any

    mockPluginDetector = {
      detectPlugin: jest.fn()
    } as any

    mockSDKInterceptor = {
      interceptEventLogger: jest.fn()
    } as any

    mockCodeInjector = {
      injectExperimentCode: jest.fn()
    } as any

    mockOverrideManager = {
      checkOverridesCookie: jest.fn(),
      getCookieValue: jest.fn(),
      getOverrides: jest.fn(),
      parseCookieOverrides: jest.fn()
    } as any

    // Mock constructors to return our mocked instances
    ;(SDKDetector as jest.MockedClass<typeof SDKDetector>).mockImplementation(() => mockSDKDetector)
    ;(PluginDetector as jest.MockedClass<typeof PluginDetector>).mockImplementation(() => mockPluginDetector)
    ;(SDKInterceptor as jest.MockedClass<typeof SDKInterceptor>).mockImplementation(() => mockSDKInterceptor)
    ;(CodeInjector as jest.MockedClass<typeof CodeInjector>).mockImplementation(() => mockCodeInjector)
    ;(OverrideManager as jest.MockedClass<typeof OverrideManager>).mockImplementation(() => mockOverrideManager)

    orchestrator = new Orchestrator()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const orch = new Orchestrator()
      const state = orch.getState()

      expect(state.isInitializing).toBe(false)
      expect(state.isInitialized).toBe(false)
      expect(state.cachedContext).toBeNull()
      expect(state.contextPropertyPath).toBeNull()
    })

    it('should initialize with custom config', () => {
      const orch = new Orchestrator({
        maxAttempts: 10,
        attemptInterval: 200,
        debug: false
      })

      expect(orch).toBeDefined()
    })
  })

  describe('start', () => {
    it('should wait for DOMContentLoaded if document is loading', () => {
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        writable: true,
        configurable: true
      })

      const addEventListenerSpy = jest.spyOn(document, 'addEventListener')
      orchestrator.start()

      expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function))
    })

    it('should start immediately if document is ready', () => {
      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true
      })

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      orchestrator.start()

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100)
    })
  })

  describe('waitForSDKAndInitialize', () => {
    beforeEach(() => {
      // Reset mock implementations for this describe block
    })

    it('should detect and cache SDK context on first attempt', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn()
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValue(null)

      orchestrator.start()
      jest.runOnlyPendingTimers()

      const state = orchestrator.getState()
      expect(state.cachedContext).toBe(mockContext)
      expect(state.contextPropertyPath).toBe('window.absmartly.context')
    })

    it('should use cached context on subsequent attempts', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn()
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValueOnce(null).mockReturnValueOnce(null)

      orchestrator.start()
      jest.runOnlyPendingTimers()
      jest.runOnlyPendingTimers()

      expect(mockSDKDetector.detectSDK).toHaveBeenCalledTimes(1)
    })

    it('should stop if plugin is already loaded', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValue('plugin-loaded')

      const postMessageSpy = jest.spyOn(window, 'postMessage')

      orchestrator.start()
      jest.runOnlyPendingTimers()

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'absmartly-page',
          type: 'REQUEST_CUSTOM_CODE'
        }),
        '*'
      )
    })

    it('should stop if plugin is active-but-inaccessible', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn()
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValue('active-but-inaccessible')

      orchestrator.start()
      jest.runOnlyPendingTimers()

      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Plugin is active but we cannot access it to inject custom code'
      )
    })

    it('should send SDK_CONTEXT_READY when context is found', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn()
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValue(null)

      const postMessageSpy = jest.spyOn(window, 'postMessage')

      orchestrator.start()
      jest.runOnlyPendingTimers()

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'absmartly-page',
          type: 'SDK_CONTEXT_READY'
        }),
        '*'
      )
    })

    it('should retry if no context found', () => {
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: null,
        context: null,
        contextPath: null
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      expect(mockSDKDetector.detectSDK).toHaveBeenCalledTimes(1)

      jest.runOnlyPendingTimers()
      expect(mockSDKDetector.detectSDK).toHaveBeenCalledTimes(2)
    })

    it('should stop after max attempts', () => {
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: null,
        context: null,
        contextPath: null
      })

      const orch = new Orchestrator({ maxAttempts: 3, attemptInterval: 100 })
      orch.start()

      for (let i = 0; i < 3; i++) {
        jest.runOnlyPendingTimers()
      }

      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] No ABsmartly SDK found after 5 seconds'
      )
    })

    it('should wait for context.ready() if context is pending', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn(() => ({ experiments: [] })),
        ready: jest.fn(() => Promise.resolve()),
        pending: jest.fn(() => true)
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValue(null)

      orchestrator.start()
      jest.runOnlyPendingTimers()

      expect(mockContext.ready).toHaveBeenCalled()
    })

    it('should handle context.ready() rejection', async () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn(() => ({ experiments: [] })),
        ready: jest.fn(() => Promise.reject(new Error('Context failed'))),
        pending: jest.fn(() => true)
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValue(null)

      orchestrator.start()
      jest.runOnlyPendingTimers()

      // Flush all promises in the microtask queue
      await Promise.resolve()
      await Promise.resolve()

      expect(Logger.error).toHaveBeenCalledWith(
        '[ABsmartly Extension] Error waiting for context:',
        expect.any(Error)
      )
    })
  })

  describe('setupMessageListener', () => {
    it('should setup message listener only once', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

      orchestrator.setupMessageListener()
      orchestrator.setupMessageListener()

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1)
    })

    it('should ignore messages without source', () => {
      orchestrator.setupMessageListener()

      const event = new MessageEvent('message', {
        data: { type: 'TEST' }
      })

      window.dispatchEvent(event)

      expect(Logger.log).not.toHaveBeenCalledWith(
        '[ABsmartly Page] Received message from extension:',
        expect.anything()
      )
    })

    it('should ignore messages from wrong source', () => {
      orchestrator.setupMessageListener()

      const event = new MessageEvent('message', {
        data: { source: 'other-extension', type: 'TEST' }
      })

      window.dispatchEvent(event)

      expect(Logger.log).not.toHaveBeenCalledWith(
        '[ABsmartly Page] Received message from extension:',
        expect.anything()
      )
    })

    it('should handle messages from correct source', () => {
      orchestrator.setupMessageListener()

      const event = new MessageEvent('message', {
        data: { source: 'absmartly-extension', type: 'TEST' }
      })

      window.dispatchEvent(event)

      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Page] Received message from extension:',
        expect.objectContaining({ source: 'absmartly-extension', type: 'TEST' })
      )
    })
  })

  describe('handleExtensionMessage', () => {
    beforeEach(() => {
      orchestrator.setupMessageListener()
    })

    it('should handle APPLY_OVERRIDES message', () => {
      mockOverrideManager.checkOverridesCookie = jest.fn()

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'APPLY_OVERRIDES',
          payload: { overrides: { exp1: 0 } }
        }
      })

      window.dispatchEvent(event)

      expect(mockOverrideManager.checkOverridesCookie).toHaveBeenCalled()
    })

    it('should handle PREVIEW_CHANGES message', () => {
      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: { experimentName: 'test-exp', changes: [] }
        }
      })

      window.dispatchEvent(event)

      expect(Logger.log).toHaveBeenCalledWith('[ABsmartly Page] Handling PREVIEW_CHANGES message')
    })

    it('should handle REMOVE_PREVIEW message', () => {
      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'REMOVE_PREVIEW',
          payload: { experimentName: 'test-exp' }
        }
      })

      window.dispatchEvent(event)

      expect(Logger.log).toHaveBeenCalledWith('[ABsmartly Page] Handling REMOVE_PREVIEW message')
    })

    it('should handle INJECT_CUSTOM_CODE message', () => {
      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'INJECT_CUSTOM_CODE'
        }
      })

      window.dispatchEvent(event)

      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] INJECT_CUSTOM_CODE message received but not used'
      )
    })

    it('should warn on unknown message type', () => {
      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'UNKNOWN_TYPE'
        }
      })

      window.dispatchEvent(event)

      expect(Logger.warn).toHaveBeenCalledWith('[ABsmartly Extension] Unknown message type:', 'UNKNOWN_TYPE')
    })
  })

  describe('handleInitializePlugin', () => {
    beforeEach(() => {
      orchestrator.setupMessageListener()
    })

    it('should prevent multiple initializations', () => {
      const mockContext = { treatment: jest.fn() }
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      const event1 = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'INITIALIZE_PLUGIN',
          payload: { config: {} }
        }
      })

      const event2 = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'INITIALIZE_PLUGIN',
          payload: { config: {} }
        }
      })

      window.dispatchEvent(event1)
      window.dispatchEvent(event2)

      expect(mockCodeInjector.injectExperimentCode).toHaveBeenCalledTimes(1)
    })

    it('should skip if plugin already loaded', () => {
      const mockContext = { treatment: jest.fn() }
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValue('plugin-loaded')

      orchestrator.start()
      jest.runOnlyPendingTimers()

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'INITIALIZE_PLUGIN',
          payload: { config: {} }
        }
      })

      window.dispatchEvent(event)

      expect(mockCodeInjector.injectExperimentCode).not.toHaveBeenCalled()
    })

    it('should skip if no context available', () => {
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: null,
        context: null,
        contextPath: null
      })

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'INITIALIZE_PLUGIN',
          payload: { config: {} }
        }
      })

      window.dispatchEvent(event)

      expect(Logger.error).toHaveBeenCalledWith(
        '[ABsmartly Extension] No context available for plugin initialization'
      )
    })

    it('should skip if plugin already registered with context', () => {
      const mockContext = {
        treatment: jest.fn(),
        __domPlugin: { initialized: true }
      }
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'INITIALIZE_PLUGIN',
          payload: { config: {} }
        }
      })

      window.dispatchEvent(event)

      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Plugin already initialized via context.__domPlugin'
      )
    })

    it('should inject experiment code', () => {
      const mockContext = { treatment: jest.fn() }
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValue(null)

      orchestrator.start()
      jest.runOnlyPendingTimers()

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'INITIALIZE_PLUGIN',
          payload: { config: {} }
        }
      })

      window.dispatchEvent(event)

      expect(mockCodeInjector.injectExperimentCode).toHaveBeenCalledWith(mockContext)
    })

    it('should send PLUGIN_INITIALIZED message', () => {
      const mockContext = { treatment: jest.fn() }
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValue(null)

      const postMessageSpy = jest.spyOn(window, 'postMessage')

      orchestrator.start()
      jest.runOnlyPendingTimers()

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'INITIALIZE_PLUGIN',
          payload: { config: {} }
        }
      })

      window.dispatchEvent(event)

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'absmartly-page',
          type: 'PLUGIN_INITIALIZED',
          payload: {
            version: '1.0.0',
            capabilities: ['code-injection']
          }
        }),
        '*'
      )
    })

    it('should handle injection error gracefully', () => {
      const mockContext = { treatment: jest.fn() }
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })
      mockPluginDetector.detectPlugin.mockReturnValue(null)
      mockCodeInjector.injectExperimentCode.mockImplementation(() => {
        throw new Error('Injection failed')
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'INITIALIZE_PLUGIN',
          payload: { config: {} }
        }
      })

      window.dispatchEvent(event)

      expect(Logger.error).toHaveBeenCalledWith(
        '[ABsmartly Extension] Failed to inject experiment code:',
        expect.any(Error)
      )
    })
  })

  describe('handleSDKEvent', () => {
    it('should send SDK_EVENT message', () => {
      const postMessageSpy = jest.spyOn(window, 'postMessage')

      // Get the onSDKEvent callback from the SDKInterceptor constructor
      const SDKInterceptorConstructor = SDKInterceptor as jest.MockedClass<typeof SDKInterceptor>
      const constructorCall = SDKInterceptorConstructor.mock.calls[SDKInterceptorConstructor.mock.calls.length - 1]
      const onSDKEvent = constructorCall[0].onSDKEvent

      onSDKEvent('exposure', { experimentName: 'test-exp', variant: 0 })

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'absmartly-page',
          type: 'SDK_EVENT',
          payload: expect.objectContaining({
            eventName: 'exposure',
            data: { experimentName: 'test-exp', variant: 0 },
            timestamp: expect.any(String)
          })
        }),
        '*'
      )
    })
  })

  describe('getContext', () => {
    it('should return cached context', () => {
      const mockContext = { treatment: jest.fn() }
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      expect(orchestrator.getContext()).toBe(mockContext)
    })

    it('should return null if no context', () => {
      expect(orchestrator.getContext()).toBeNull()
    })
  })

  describe('getState', () => {
    it('should return initialization state', () => {
      const state = orchestrator.getState()

      expect(state).toEqual({
        isInitializing: false,
        isInitialized: false,
        cachedContext: null,
        contextPropertyPath: null
      })
    })

    it('should return copy of state', () => {
      const state1 = orchestrator.getState()
      const state2 = orchestrator.getState()

      expect(state1).not.toBe(state2)
      expect(state1).toEqual(state2)
    })
  })

  describe('exposeVariantAssignments', () => {
    beforeEach(() => {
      delete (window as any).__absmartlyGetVariantAssignments
      // Reset mock for this describe block
    })

    it('should expose __absmartlyGetVariantAssignments function', () => {
      orchestrator.exposeVariantAssignments()

      expect((window as any).__absmartlyGetVariantAssignments).toBeDefined()
      expect(typeof (window as any).__absmartlyGetVariantAssignments).toBe('function')
    })

    it('should return empty assignments if no context', async () => {
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: null,
        context: null,
        contextPath: null
      })

      orchestrator.exposeVariantAssignments()

      const result = await (window as any).__absmartlyGetVariantAssignments(['exp1', 'exp2'])

      expect(result).toEqual({
        assignments: {},
        experimentsInContext: []
      })
    })

    it('should wait for context.ready() if pending', async () => {
      const mockContext = {
        peek: jest.fn((name) => (name === 'exp1' ? 0 : -1)),
        data: jest.fn(() => ({ experiments: { exp1: {} } })),
        ready: jest.fn(() => Promise.resolve())
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      orchestrator.exposeVariantAssignments()

      const result = await (window as any).__absmartlyGetVariantAssignments(['exp1'])

      expect(mockContext.ready).toHaveBeenCalled()
      expect(result.assignments).toEqual({ exp1: 0 })
    })

    it('should get variant assignments', async () => {
      const mockContext = {
        peek: jest.fn((name) => {
          if (name === 'exp1') return 0
          if (name === 'exp2') return 1
          return -1
        }),
        data: jest.fn(() => ({
          experiments: {
            exp1: {},
            exp2: {},
            exp3: {}
          }
        })),
        ready: jest.fn(() => Promise.resolve())
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      orchestrator.exposeVariantAssignments()

      const result = await (window as any).__absmartlyGetVariantAssignments(['exp1', 'exp2', 'exp3'])

      expect(result).toEqual({
        assignments: {
          exp1: 0,
          exp2: 1
        },
        experimentsInContext: ['exp1', 'exp2', 'exp3']
      })
    })

    it('should include variant 0 in assignments', async () => {
      const mockContext = {
        peek: jest.fn(() => 0),
        data: jest.fn(() => ({ experiments: { exp1: {} } })),
        ready: jest.fn(() => Promise.resolve())
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      orchestrator.exposeVariantAssignments()

      const result = await (window as any).__absmartlyGetVariantAssignments(['exp1'])

      expect(result.assignments).toEqual({ exp1: 0 })
    })

    it('should exclude variant -1 from assignments', async () => {
      const mockContext = {
        peek: jest.fn(() => -1),
        data: jest.fn(() => ({ experiments: {} })),
        ready: jest.fn(() => Promise.resolve())
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      orchestrator.exposeVariantAssignments()

      const result = await (window as any).__absmartlyGetVariantAssignments(['exp1'])

      expect(result.assignments).toEqual({})
    })

    it('should handle peek errors gracefully', async () => {
      const mockContext = {
        peek: jest.fn(() => {
          throw new Error('Peek failed')
        }),
        data: jest.fn(() => ({ experiments: {} })),
        ready: jest.fn(() => Promise.resolve())
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      orchestrator.exposeVariantAssignments()

      const result = await (window as any).__absmartlyGetVariantAssignments(['exp1'])

      expect(result.assignments).toEqual({})
      expect(Logger.warn).toHaveBeenCalled()
    })
  })

  describe('exposeContextPath', () => {
    beforeEach(() => {
      delete (window as any).__absmartlyGetContextPath
      // Reset mock for this describe block
    })

    it('should expose __absmartlyGetContextPath function', () => {
      orchestrator.exposeContextPath()

      expect((window as any).__absmartlyGetContextPath).toBeDefined()
      expect(typeof (window as any).__absmartlyGetContextPath).toBe('function')
    })

    it('should detect context if not cached', () => {
      const mockContext = {
        peek: jest.fn(),
        treatment: jest.fn()
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.absmartly.context'
      })

      orchestrator.exposeContextPath()

      const result = (window as any).__absmartlyGetContextPath()

      expect(result).toEqual({
        found: true,
        path: 'window.absmartly.context',
        hasContext: true,
        hasPeek: true,
        hasTreatment: true
      })
    })

    it('should return cached context path', () => {
      const mockContext = {
        peek: jest.fn(),
        treatment: jest.fn()
      }

      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: {},
        context: mockContext,
        contextPath: 'window.sdk.context'
      })

      orchestrator.start()
      jest.runOnlyPendingTimers()

      orchestrator.exposeContextPath()

      const result = (window as any).__absmartlyGetContextPath()

      expect(result).toEqual({
        found: true,
        path: 'window.sdk.context',
        hasContext: true,
        hasPeek: true,
        hasTreatment: true
      })
    })

    it('should return not found if no context', () => {
      mockSDKDetector.detectSDK.mockReturnValue({
        sdk: null,
        context: null,
        contextPath: null
      })

      orchestrator.exposeContextPath()

      const result = (window as any).__absmartlyGetContextPath()

      expect(result).toEqual({
        found: false,
        path: null,
        hasContext: false,
        hasPeek: false,
        hasTreatment: false
      })
    })
  })
})
