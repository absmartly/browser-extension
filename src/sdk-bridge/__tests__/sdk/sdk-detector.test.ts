/**
 * SDK Detector Unit Tests
 */

import { SDKDetector } from '../../sdk/sdk-detector'
import { Logger } from '../../utils/logger'

jest.mock('../../utils/logger')

describe('SDKDetector', () => {
  let detector: SDKDetector
  let mockWindow: any

  beforeEach(() => {
    detector = new SDKDetector()
    mockWindow = global.window as any
    // Clear window properties
    delete mockWindow.sdk
    delete mockWindow.absmartly
    delete mockWindow.ABsmartly
    delete mockWindow.__absmartly
    delete mockWindow.ABsmartlyContext
    delete mockWindow.abSmartly
    delete mockWindow.context
    delete mockWindow.absmartlyContext
    delete mockWindow.__context
    jest.clearAllMocks()
  })

  describe('detectSDK', () => {
    it('should return null when no SDK or context is found', () => {
      const result = detector.detectSDK()

      expect(result).toEqual({
        sdk: null,
        context: null,
        contextPath: null
      })
      expect(Logger.warn).toHaveBeenCalledWith(
        '[ABsmartly Extension] ⚠️ No context found after detection'
      )
    })

    it('should detect SDK instance with createContext method', () => {
      const mockSDK = {
        createContext: jest.fn()
      }
      mockWindow.sdk = mockSDK

      const result = detector.detectSDK()

      expect(result.sdk).toBe(mockSDK)
      expect(Logger.log).toHaveBeenCalledWith('[ABsmartly Extension] SDK instance found')
    })

    it('should detect context at window.ABsmartlyContext', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn()
      }
      mockWindow.ABsmartlyContext = mockContext

      const result = detector.detectSDK()

      expect(result.context).toBe(mockContext)
      expect(result.contextPath).toBe('ABsmartlyContext')
      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] ✅ Context found and cached at:',
        'ABsmartlyContext'
      )
    })

    it('should detect context at window.absmartly', () => {
      const mockContext = {
        treatment: jest.fn()
      }
      mockWindow.absmartly = mockContext

      const result = detector.detectSDK()

      expect(result.context).toBe(mockContext)
      expect(result.contextPath).toBe('absmartly')
    })

    it('should detect context at window.sdk.context', () => {
      const mockContext = {
        treatment: jest.fn()
      }
      mockWindow.sdk = {
        context: mockContext
      }

      const result = detector.detectSDK()

      expect(result.context).toBe(mockContext)
      expect(result.contextPath).toBe('sdk.context')
    })

    it('should detect context with context property', () => {
      const mockContext = {
        treatment: jest.fn()
      }
      mockWindow.ABsmartly = {
        context: mockContext
      }

      const result = detector.detectSDK()

      expect(result.context).toBe(mockContext)
      expect(result.contextPath).toBe('unknown')
    })

    it('should detect context from contexts array', () => {
      const mockContext = {
        treatment: jest.fn()
      }
      mockWindow.absmartly = {
        contexts: [mockContext]
      }

      const result = detector.detectSDK()

      expect(result.context).toBe(mockContext)
    })

    it('should skip invalid contexts in array', () => {
      const mockContext = {
        treatment: jest.fn()
      }
      mockWindow.absmartly = {
        contexts: [
          null,
          {},
          { noTreatment: true },
          mockContext
        ]
      }

      const result = detector.detectSDK()

      expect(result.context).toBe(mockContext)
    })

    it('should log context details when found', () => {
      const mockContext = {
        treatment: jest.fn(),
        peek: jest.fn(),
        data: jest.fn(),
        eventLogger: jest.fn(),
        _eventLogger: jest.fn()
      }
      mockWindow.ABsmartlyContext = mockContext

      detector.detectSDK()

      expect(Logger.log).toHaveBeenCalledWith('[ABsmartly Extension] 📊 Context details:', {
        hasTreatment: true,
        hasPeek: true,
        hasData: true,
        hasEventLogger: true,
        has_eventLogger: true,
        contextType: 'object'
      })
    })

    it('should return cached context on subsequent calls', () => {
      const mockContext = {
        treatment: jest.fn()
      }
      mockWindow.ABsmartlyContext = mockContext

      const result1 = detector.detectSDK()
      const result2 = detector.detectSDK()

      expect(result1.context).toBe(mockContext)
      expect(result2.context).toBe(mockContext)
      expect(result1).toEqual(result2)
    })

    it('should prioritize SDK locations in order', () => {
      const mockSDK1 = { createContext: jest.fn() }
      const mockSDK2 = { createContext: jest.fn() }

      mockWindow.sdk = mockSDK1
      mockWindow.absmartly = mockSDK2

      const result = detector.detectSDK()

      expect(result.sdk).toBe(mockSDK1)
    })

    it('should prioritize context locations in order', () => {
      const mockContext1 = { treatment: jest.fn() }
      const mockContext2 = { treatment: jest.fn() }

      mockWindow.ABsmartlyContext = mockContext1
      mockWindow.absmartly = mockContext2

      const result = detector.detectSDK()

      expect(result.context).toBe(mockContext1)
    })
  })

  describe('getCachedContext', () => {
    it('should return null when no context is cached', () => {
      expect(detector.getCachedContext()).toBeNull()
    })

    it('should return cached context after detection', () => {
      const mockContext = {
        treatment: jest.fn()
      }
      mockWindow.ABsmartlyContext = mockContext

      detector.detectSDK()

      expect(detector.getCachedContext()).toBe(mockContext)
    })
  })

  describe('getContextPath', () => {
    it('should return null when no context is cached', () => {
      expect(detector.getContextPath()).toBeNull()
    })

    it('should return context path after detection', () => {
      const mockContext = {
        treatment: jest.fn()
      }
      mockWindow.absmartly = mockContext

      detector.detectSDK()

      expect(detector.getContextPath()).toBe('absmartly')
    })
  })

  describe('clearCache', () => {
    it('should clear cached context and path', () => {
      const mockContext = {
        treatment: jest.fn()
      }
      mockWindow.ABsmartlyContext = mockContext

      detector.detectSDK()
      expect(detector.getCachedContext()).toBe(mockContext)
      expect(detector.getContextPath()).toBe('ABsmartlyContext')

      detector.clearCache()

      expect(detector.getCachedContext()).toBeNull()
      expect(detector.getContextPath()).toBeNull()
    })

    it('should allow re-detection after clearing cache', () => {
      const mockContext1 = {
        treatment: jest.fn()
      }
      const mockContext2 = {
        treatment: jest.fn()
      }

      mockWindow.ABsmartlyContext = mockContext1
      detector.detectSDK()
      expect(detector.getCachedContext()).toBe(mockContext1)

      detector.clearCache()
      delete mockWindow.ABsmartlyContext
      mockWindow.absmartly = mockContext2

      detector.detectSDK()
      expect(detector.getCachedContext()).toBe(mockContext2)
      expect(detector.getContextPath()).toBe('absmartly')
    })
  })
})
