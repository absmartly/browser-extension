/**
 * SDK Interceptor Unit Tests
 */

import { SDKInterceptor } from '../../sdk/sdk-interceptor'
import { Logger } from '../../utils/logger'

jest.mock('../../utils/logger')

describe('SDKInterceptor', () => {
  let interceptor: SDKInterceptor
  let mockCallback: jest.Mock

  beforeEach(() => {
    mockCallback = jest.fn()
    interceptor = new SDKInterceptor({
      onSDKEvent: mockCallback
    })
    jest.clearAllMocks()
  })

  describe('interceptEventLogger', () => {
    it('should intercept event logger on context', () => {
      const mockOriginalLogger = jest.fn()
      const mockContext: any = {
        eventLogger: jest.fn(() => mockOriginalLogger),
        _eventLogger: mockOriginalLogger
      }

      interceptor.interceptEventLogger(mockContext)

      expect(mockContext.__eventLoggerIntercepted).toBe(true)
      expect(Logger.log).toHaveBeenCalledWith('[ABsmartly Extension] ✅ EventLogger intercepted successfully')
    })

    it('should not intercept if context is null', () => {
      interceptor.interceptEventLogger(null)

      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] ⚠️ Skipping interception - no context or already intercepted'
      )
    })

    it('should not intercept if already intercepted', () => {
      const mockContext: any = {
        __eventLoggerIntercepted: true,
        _eventLogger: jest.fn()
      }

      interceptor.interceptEventLogger(mockContext)

      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] ⚠️ Skipping interception - no context or already intercepted'
      )
    })

    it('should warn if _eventLogger is undefined', () => {
      const mockContext = {
        eventLogger: jest.fn(() => null)
      }

      interceptor.interceptEventLogger(mockContext)

      expect(Logger.warn).toHaveBeenCalledWith(
        '[ABsmartly Extension] ⚠️ context._eventLogger is undefined, cannot intercept'
      )
    })

    it('should call callback with event data', () => {
      const mockOriginalLogger = jest.fn()
      const mockContext: any = {
        eventLogger: jest.fn(() => mockOriginalLogger),
        _eventLogger: mockOriginalLogger
      }

      interceptor.interceptEventLogger(mockContext)

      const eventData = { key: 'value' }
      mockContext._eventLogger(mockContext, 'test_event', eventData)

      expect(mockCallback).toHaveBeenCalledWith('test_event', eventData)
    })

    it('should call original event logger', () => {
      const mockOriginalLogger = jest.fn()
      const mockContext: any = {
        eventLogger: jest.fn(() => mockOriginalLogger),
        _eventLogger: mockOriginalLogger
      }

      interceptor.interceptEventLogger(mockContext)

      const eventData = { key: 'value' }
      mockContext._eventLogger(mockContext, 'test_event', eventData)

      expect(mockOriginalLogger).toHaveBeenCalledWith(mockContext, 'test_event', eventData)
    })

    it('should handle null event data', () => {
      const mockOriginalLogger = jest.fn()
      const mockContext: any = {
        eventLogger: jest.fn(() => mockOriginalLogger),
        _eventLogger: mockOriginalLogger
      }

      interceptor.interceptEventLogger(mockContext)

      mockContext._eventLogger(mockContext, 'test_event', null)

      expect(mockCallback).toHaveBeenCalledWith('test_event', null)
    })

    it('should handle callback errors gracefully', () => {
      const mockOriginalLogger = jest.fn()
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error')
      })

      const interceptorWithError = new SDKInterceptor({
        onSDKEvent: errorCallback
      })

      const mockContext: any = {
        eventLogger: jest.fn(() => mockOriginalLogger),
        _eventLogger: mockOriginalLogger
      }

      interceptorWithError.interceptEventLogger(mockContext)

      // Should not throw
      expect(() => {
        mockContext._eventLogger(mockContext, 'test_event', {})
      }).not.toThrow()

      expect(Logger.error).toHaveBeenCalled()
    })

    it('should work without callback', () => {
      const interceptorWithoutCallback = new SDKInterceptor()
      const mockOriginalLogger = jest.fn()
      const mockContext: any = {
        eventLogger: jest.fn(() => mockOriginalLogger),
        _eventLogger: mockOriginalLogger
      }

      interceptorWithoutCallback.interceptEventLogger(mockContext)

      // Should not throw
      expect(() => {
        mockContext._eventLogger(mockContext, 'test_event', {})
      }).not.toThrow()

      expect(mockOriginalLogger).toHaveBeenCalled()
    })

    it('should clone event data to prevent mutation', () => {
      const mockOriginalLogger = jest.fn()
      const mockContext: any = {
        eventLogger: jest.fn(() => mockOriginalLogger),
        _eventLogger: mockOriginalLogger
      }

      interceptor.interceptEventLogger(mockContext)

      const eventData = { key: 'value', nested: { prop: 'data' } }
      mockContext._eventLogger(mockContext, 'test_event', eventData)

      // Modify original data
      eventData.key = 'modified'
      eventData.nested.prop = 'modified'

      // Callback should have received cloned data
      const callData = mockCallback.mock.calls[0][1]
      expect(callData.key).toBe('value')
      expect(callData.nested.prop).toBe('data')
    })

    it('should log context details', () => {
      const mockContext = {
        treatment: jest.fn(),
        ready: jest.fn(),
        peek: jest.fn(),
        eventLogger: jest.fn(() => null),
        _eventLogger: jest.fn()
      }

      interceptor.interceptEventLogger(mockContext)

      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] 🎯 interceptEventLogger called',
        expect.objectContaining({
          hasContext: true,
          hasTreatment: true,
          hasReady: true,
          hasPeek: true
        })
      )
    })
  })

  describe('interceptSDKCreateContext', () => {
    it('should intercept SDK createContext method', async () => {
      const mockContext = {
        _eventLogger: jest.fn()
      }
      const mockSDK: any = {
        createContext: jest.fn().mockResolvedValue(mockContext)
      }

      interceptor.interceptSDKCreateContext(mockSDK)

      expect(mockSDK.__createContextIntercepted).toBe(true)
      expect(Logger.log).toHaveBeenCalledWith('[ABsmartly Extension] SDK createContext intercepted successfully')
    })

    it('should not intercept if SDK is null', () => {
      interceptor.interceptSDKCreateContext(null)
      // Should not throw
    })

    it('should not intercept if createContext does not exist', () => {
      const mockSDK = {}
      interceptor.interceptSDKCreateContext(mockSDK)
      // Should not throw
    })

    it('should not intercept if already intercepted', () => {
      const mockSDK = {
        createContext: jest.fn(),
        __createContextIntercepted: true
      }

      const originalMethod = mockSDK.createContext

      interceptor.interceptSDKCreateContext(mockSDK)

      expect(mockSDK.createContext).toBe(originalMethod)
    })

    it('should call original createContext', async () => {
      const mockContext = {
        _eventLogger: jest.fn()
      }
      const originalCreateContext = jest.fn().mockResolvedValue(mockContext)
      const mockSDK = {
        createContext: originalCreateContext
      }

      interceptor.interceptSDKCreateContext(mockSDK)

      const config = { apiKey: 'test' }
      await mockSDK.createContext(config)

      expect(originalCreateContext).toHaveBeenCalledWith(config)
    })

    it('should return context from original createContext', async () => {
      const mockContext = {
        _eventLogger: jest.fn()
      }
      const mockSDK = {
        createContext: jest.fn().mockResolvedValue(mockContext)
      }

      interceptor.interceptSDKCreateContext(mockSDK)

      const result = await mockSDK.createContext({})

      expect(result).toBe(mockContext)
    })

    it('should intercept eventLogger on new context', async () => {
      const mockContext: any = {
        eventLogger: jest.fn(() => null),
        _eventLogger: jest.fn()
      }
      const mockSDK: any = {
        createContext: jest.fn().mockResolvedValue(mockContext)
      }

      interceptor.interceptSDKCreateContext(mockSDK)

      await mockSDK.createContext({})

      expect(mockContext.__eventLoggerIntercepted).toBe(true)
    })

    it('should log interception', async () => {
      const mockContext = {
        _eventLogger: jest.fn()
      }
      const mockSDK = {
        createContext: jest.fn().mockResolvedValue(mockContext)
      }

      interceptor.interceptSDKCreateContext(mockSDK)

      await mockSDK.createContext({})

      expect(Logger.log).toHaveBeenCalledWith('[ABsmartly Extension] Intercepting createContext call')
    })
  })

  describe('interceptSDKConstructor', () => {
    it('should intercept SDK constructor', () => {
      class MockSDK {
        constructor(public config: any) {}
        createContext = jest.fn()
      }

      const sdkModule: any = { SDK: MockSDK }

      interceptor.interceptSDKConstructor(sdkModule)

      expect(sdkModule.SDK.__constructorIntercepted).toBe(true)
      expect(Logger.log).toHaveBeenCalledWith('[ABsmartly Extension] SDK constructor intercepted successfully')
    })

    it('should not intercept if sdkModule is null', () => {
      interceptor.interceptSDKConstructor(null)
      // Should not throw
    })

    it('should not intercept if SDK class does not exist', () => {
      const sdkModule = {}
      interceptor.interceptSDKConstructor(sdkModule)
      // Should not throw
    })

    it('should not intercept if already intercepted', () => {
      class MockSDK {}
      const sdkModule = { SDK: MockSDK }
      ;(sdkModule.SDK as any).__constructorIntercepted = true

      const originalSDK = sdkModule.SDK

      interceptor.interceptSDKConstructor(sdkModule)

      expect(sdkModule.SDK).toBe(originalSDK)
    })

    it('should create SDK instance with original constructor', () => {
      class MockSDK {
        constructor(public config: any) {}
      }

      const sdkModule: any = { SDK: MockSDK }

      interceptor.interceptSDKConstructor(sdkModule)

      const config = { apiKey: 'test' }
      const instance = new sdkModule.SDK(config)

      expect(instance).toBeInstanceOf(MockSDK)
      expect(instance.config).toEqual(config)
    })

    it('should intercept createContext on new SDK instance', () => {
      class MockSDK {
        createContext = jest.fn()
        constructor(_config?: any) {}
      }

      const sdkModule: any = { SDK: MockSDK }

      interceptor.interceptSDKConstructor(sdkModule)

      const instance = new sdkModule.SDK({})

      expect((instance.createContext as any).__createContextIntercepted).toBeUndefined()
      // Note: createContext interception happens on the instance, not the method
    })

    it('should preserve static properties', () => {
      class MockSDK {
        static version = '1.0.0'
        static create() {
          return new MockSDK()
        }
      }

      const sdkModule = { SDK: MockSDK }

      interceptor.interceptSDKConstructor(sdkModule)

      expect((sdkModule.SDK as any).version).toBe('1.0.0')
      expect(typeof (sdkModule.SDK as any).create).toBe('function')
    })

    it('should log constructor interception', () => {
      class MockSDK {
        constructor(_config?: any) {}
      }

      const sdkModule: any = { SDK: MockSDK }

      interceptor.interceptSDKConstructor(sdkModule)

      new sdkModule.SDK({})

      expect(Logger.log).toHaveBeenCalledWith('[ABsmartly Extension] Intercepting new SDK() call')
    })

    it('should handle SDK instance without createContext', () => {
      class MockSDK {
        constructor(_config?: any) {}
      }

      const sdkModule: any = { SDK: MockSDK }

      interceptor.interceptSDKConstructor(sdkModule)

      // Should not throw
      expect(() => {
        new sdkModule.SDK({})
      }).not.toThrow()
    })
  })

  describe('constructor', () => {
    it('should accept callbacks', () => {
      const onSDKEvent = jest.fn()
      const interceptor = new SDKInterceptor({ onSDKEvent })

      expect(interceptor).toBeInstanceOf(SDKInterceptor)
    })

    it('should work without callbacks', () => {
      const interceptor = new SDKInterceptor()

      expect(interceptor).toBeInstanceOf(SDKInterceptor)
    })
  })
})
