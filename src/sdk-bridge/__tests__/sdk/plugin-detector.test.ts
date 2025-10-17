/**
 * Plugin Detector Unit Tests
 */

import { PluginDetector } from '../../sdk/plugin-detector'
import { Logger } from '../../utils/logger'

jest.mock('../../utils/logger')

describe('PluginDetector', () => {
  let detector: PluginDetector
  let mockWindow: any

  beforeEach(() => {
    detector = new PluginDetector()
    mockWindow = global.window as any
    // Clear window properties
    delete mockWindow.__absmartlyPlugin
    delete mockWindow.__absmartlyDOMChangesPlugin
    // Clear any DOM elements
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  describe('detectPlugin', () => {
    it('should return null when no plugin is found', () => {
      const result = detector.detectPlugin()

      expect(result).toBeNull()
    })

    it('should detect plugin via context.__domPlugin registration', () => {
      const mockPlugin = { apply: jest.fn() }
      const mockContext = {
        __domPlugin: {
          initialized: true,
          version: '1.0.0',
          capabilities: ['auto-apply'],
          timestamp: Date.now(),
          instance: mockPlugin
        }
      }

      const result = detector.detectPlugin(mockContext)

      expect(result).toBe(mockPlugin)
      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Plugin detected via context.__domPlugin registration:',
        {
          version: '1.0.0',
          capabilities: ['auto-apply'],
          timestamp: expect.any(Number)
        }
      )
    })

    it('should return null if __domPlugin exists but not initialized', () => {
      const mockContext = {
        __domPlugin: {
          initialized: false,
          instance: {}
        }
      }

      const result = detector.detectPlugin(mockContext)

      expect(result).toBeNull()
    })

    it('should detect plugin at window.__absmartlyPlugin', () => {
      const mockPlugin = { apply: jest.fn() }
      mockWindow.__absmartlyPlugin = mockPlugin

      const result = detector.detectPlugin()

      expect(result).toBe(mockPlugin)
      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Site plugin instance found at window.__absmartlyPlugin'
      )
    })

    it('should detect plugin at window.__absmartlyDOMChangesPlugin', () => {
      const mockPlugin = { apply: jest.fn() }
      mockWindow.__absmartlyDOMChangesPlugin = mockPlugin

      const result = detector.detectPlugin()

      expect(result).toBe(mockPlugin)
      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Site plugin instance found at window.__absmartlyDOMChangesPlugin'
      )
    })

    it('should prioritize context.__domPlugin over window properties', () => {
      const contextPlugin = { apply: jest.fn(), source: 'context' }
      const windowPlugin = { apply: jest.fn(), source: 'window' }

      const mockContext = {
        __domPlugin: {
          initialized: true,
          instance: contextPlugin
        }
      }
      mockWindow.__absmartlyPlugin = windowPlugin

      const result = detector.detectPlugin(mockContext)

      expect(result).toBe(contextPlugin)
      expect(result).not.toBe(windowPlugin)
    })

    it('should prioritize window.__absmartlyPlugin over __absmartlyDOMChangesPlugin', () => {
      const plugin1 = { apply: jest.fn(), source: 'plugin1' }
      const plugin2 = { apply: jest.fn(), source: 'plugin2' }

      mockWindow.__absmartlyPlugin = plugin1
      mockWindow.__absmartlyDOMChangesPlugin = plugin2

      const result = detector.detectPlugin()

      expect(result).toBe(plugin1)
    })

    it('should detect plugin via DOM artifacts with data-absmartly-modified', () => {
      const element = document.createElement('div')
      element.setAttribute('data-absmartly-modified', 'true')
      document.body.appendChild(element)

      const result = detector.detectPlugin()

      expect(result).toBe('active-but-inaccessible')
      expect(Logger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] DOM Changes Plugin artifacts found in DOM - plugin is active but instance not accessible'
      )
    })

    it('should detect plugin via DOM artifacts with data-absmartly-created', () => {
      const element = document.createElement('div')
      element.setAttribute('data-absmartly-created', 'true')
      document.body.appendChild(element)

      const result = detector.detectPlugin()

      expect(result).toBe('active-but-inaccessible')
    })

    it('should detect plugin via DOM artifacts with data-absmartly-injected', () => {
      const element = document.createElement('div')
      element.setAttribute('data-absmartly-injected', 'true')
      document.body.appendChild(element)

      const result = detector.detectPlugin()

      expect(result).toBe('active-but-inaccessible')
    })

    it('should detect plugin via multiple DOM artifacts', () => {
      const element1 = document.createElement('div')
      element1.setAttribute('data-absmartly-modified', 'true')
      const element2 = document.createElement('span')
      element2.setAttribute('data-absmartly-created', 'true')

      document.body.appendChild(element1)
      document.body.appendChild(element2)

      const result = detector.detectPlugin()

      expect(result).toBe('active-but-inaccessible')
    })

    it('should return null when context is null', () => {
      const result = detector.detectPlugin(null)

      expect(result).toBeNull()
    })

    it('should return null when context is undefined', () => {
      const result = detector.detectPlugin(undefined)

      expect(result).toBeNull()
    })

    it('should handle context without __domPlugin property', () => {
      const mockContext = {
        treatment: jest.fn()
      }

      const result = detector.detectPlugin(mockContext)

      expect(result).toBeNull()
    })
  })

  describe('isPluginAccessible', () => {
    it('should return true for plugin instance', () => {
      const mockPlugin = { apply: jest.fn() }

      expect(detector.isPluginAccessible(mockPlugin)).toBe(true)
    })

    it('should return false for "active-but-inaccessible"', () => {
      expect(detector.isPluginAccessible('active-but-inaccessible')).toBe(false)
    })

    it('should return false for null', () => {
      expect(detector.isPluginAccessible(null)).toBe(false)
    })

    it('should return true for any object instance', () => {
      const obj = { some: 'property' }

      expect(detector.isPluginAccessible(obj)).toBe(true)
    })
  })

  describe('isPluginActive', () => {
    it('should return true for plugin instance', () => {
      const mockPlugin = { apply: jest.fn() }

      expect(detector.isPluginActive(mockPlugin)).toBe(true)
    })

    it('should return true for "active-but-inaccessible"', () => {
      expect(detector.isPluginActive('active-but-inaccessible')).toBe(true)
    })

    it('should return false for null', () => {
      expect(detector.isPluginActive(null)).toBe(false)
    })

    it('should return true for any truthy value', () => {
      expect(detector.isPluginActive({})).toBe(true)
      expect(detector.isPluginActive([])).toBe(true)
      expect(detector.isPluginActive('string')).toBe(true)
      expect(detector.isPluginActive(123)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle DOM query selector errors gracefully', () => {
      // Mock querySelector to throw error
      const originalQuerySelectorAll = document.querySelectorAll
      document.querySelectorAll = jest.fn(() => {
        throw new Error('Query error')
      })

      expect(() => detector.detectPlugin()).toThrow()

      // Restore
      document.querySelectorAll = originalQuerySelectorAll
    })

    it('should work with empty context object', () => {
      const result = detector.detectPlugin({})

      expect(result).toBeNull()
    })

    it('should detect multiple detection methods simultaneously', () => {
      const mockPlugin = { apply: jest.fn() }
      mockWindow.__absmartlyPlugin = mockPlugin

      const element = document.createElement('div')
      element.setAttribute('data-absmartly-modified', 'true')
      document.body.appendChild(element)

      const result = detector.detectPlugin()

      // Should return window plugin (higher priority than DOM artifacts)
      expect(result).toBe(mockPlugin)
    })

    it('should handle context with initialized=false', () => {
      const mockContext = {
        __domPlugin: {
          initialized: false,
          instance: { apply: jest.fn() }
        }
      }

      const result = detector.detectPlugin(mockContext)

      expect(result).toBeNull()
    })
  })
})
