/**
 * Override Manager Unit Tests
 */

import { OverrideManager } from '../../experiment/override-manager'
import { Logger } from '../../utils/logger'

jest.mock('../../utils/logger')

describe('OverrideManager', () => {
  let manager: OverrideManager
  let mockLogger: jest.Mocked<typeof Logger>
  let mockCookies: Record<string, string>

  // Setup mock cookies once before all tests
  beforeAll(() => {
    mockCookies = {}
    // Mock document.cookie once
    Object.defineProperty(document, 'cookie', {
      get: () => {
        return Object.entries(mockCookies)
          .map(([name, value]) => `${name}=${value}`)
          .join('; ')
      },
      set: (cookieString: string) => {
        const [nameValue] = cookieString.split(';')
        const [name, value] = nameValue.split('=')
        if (value) {
          mockCookies[name.trim()] = value.trim()
        } else {
          delete mockCookies[name.trim()]
        }
      },
      configurable: true
    })
  })

  beforeEach(() => {
    manager = new OverrideManager()
    mockLogger = Logger as jest.Mocked<typeof Logger>
    jest.clearAllMocks()
    // Clear cookies
    mockCookies = {}
  })

  describe('parseCookieOverrides', () => {
    it('should return empty overrides for empty string', () => {
      const result = manager.parseCookieOverrides('')

      expect(result).toEqual({
        overrides: {},
        devEnv: null
      })
    })

    it('should parse simple format (variant only)', () => {
      const result = manager.parseCookieOverrides('exp1:0,exp2:1')

      expect(result).toEqual({
        overrides: {
          exp1: 0,
          exp2: 1
        },
        devEnv: null
      })
    })

    it('should parse format with env (variant.env)', () => {
      const result = manager.parseCookieOverrides('exp1:0.1,exp2:1.2')

      expect(result).toEqual({
        overrides: {
          exp1: {
            variant: 0,
            env: 1
          },
          exp2: {
            variant: 1,
            env: 2
          }
        },
        devEnv: null
      })
    })

    it('should parse full format (variant.env.id)', () => {
      const result = manager.parseCookieOverrides('exp1:0.1.123,exp2:1.2.456')

      expect(result).toEqual({
        overrides: {
          exp1: {
            variant: 0,
            env: 1,
            id: 123
          },
          exp2: {
            variant: 1,
            env: 2,
            id: 456
          }
        },
        devEnv: null
      })
    })

    it('should parse devEnv prefix', () => {
      const result = manager.parseCookieOverrides('devEnv=https://example.com|exp1:0,exp2:1')

      expect(result).toEqual({
        overrides: {
          exp1: 0,
          exp2: 1
        },
        devEnv: 'https://example.com'
      })
    })

    it('should decode URL-encoded devEnv', () => {
      const result = manager.parseCookieOverrides('devEnv=https%3A%2F%2Fexample.com|exp1:0')

      expect(result).toEqual({
        overrides: {
          exp1: 0
        },
        devEnv: 'https://example.com'
      })
    })

    it('should decode URL-encoded experiment names', () => {
      const result = manager.parseCookieOverrides('my%20exp:0,other%2Dexp:1')

      expect(result).toEqual({
        overrides: {
          'my exp': 0,
          'other-exp': 1
        },
        devEnv: null
      })
    })

    it('should handle mixed format overrides', () => {
      const result = manager.parseCookieOverrides('exp1:0,exp2:1.2,exp3:1.2.789')

      expect(result).toEqual({
        overrides: {
          exp1: 0,
          exp2: {
            variant: 1,
            env: 2
          },
          exp3: {
            variant: 1,
            env: 2,
            id: 789
          }
        },
        devEnv: null
      })
    })

    it('should skip invalid entries with no name', () => {
      const result = manager.parseCookieOverrides(':0,exp2:1')

      expect(result).toEqual({
        overrides: {
          exp2: 1
        },
        devEnv: null
      })
    })

    it('should skip invalid entries with no values', () => {
      const result = manager.parseCookieOverrides('exp1:,exp2:1')

      expect(result).toEqual({
        overrides: {
          exp2: 1
        },
        devEnv: null
      })
    })

    it('should skip invalid entries with no colon', () => {
      const result = manager.parseCookieOverrides('exp1,exp2:1')

      expect(result).toEqual({
        overrides: {
          exp2: 1
        },
        devEnv: null
      })
    })

    it('should handle devEnv without experiments', () => {
      const result = manager.parseCookieOverrides('devEnv=https://example.com|')

      expect(result).toEqual({
        overrides: {},
        devEnv: 'https://example.com'
      })
    })

    it('should handle empty devEnv', () => {
      const result = manager.parseCookieOverrides('devEnv=|exp1:0')

      expect(result).toEqual({
        overrides: {
          exp1: 0
        },
        devEnv: ''
      })
    })

    it('should handle malformed cookie gracefully', () => {
      const result = manager.parseCookieOverrides('invalid format')

      expect(result).toEqual({
        overrides: {},
        devEnv: null
      })
    })

    it('should log warning for parsing errors', () => {
      // Force parsing error by mocking parseInt to throw
      const originalParseInt = global.parseInt
      global.parseInt = (() => {
        throw new Error('Parse error')
      }) as any

      manager.parseCookieOverrides('exp1:0')

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ABsmartly Extension] Failed to parse override cookie:',
        expect.any(Error)
      )

      global.parseInt = originalParseInt
    })

    it('should handle single experiment', () => {
      const result = manager.parseCookieOverrides('exp1:0')

      expect(result).toEqual({
        overrides: {
          exp1: 0
        },
        devEnv: null
      })
    })

    it('should parse variant numbers correctly', () => {
      const result = manager.parseCookieOverrides('exp1:0,exp2:1,exp3:2,exp4:99')

      expect(result.overrides).toEqual({
        exp1: 0,
        exp2: 1,
        exp3: 2,
        exp4: 99
      })
    })
  })

  describe('checkOverridesCookie', () => {
    it('should log when cookie is found', () => {
      document.cookie = 'absmartly_overrides=exp1:0,exp2:1'

      manager.checkOverridesCookie()

      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Found absmartly_overrides cookie (will be handled by OverridesPlugin)'
      )
    })

    it('should log when cookie is not found', () => {
      manager.checkOverridesCookie()

      expect(mockLogger.log).toHaveBeenCalledWith('[ABsmartly Extension] No experiment overrides cookie found')
    })

    it('should log devEnv when present', () => {
      document.cookie = 'absmartly_overrides=devEnv=https://example.com|exp1:0'

      manager.checkOverridesCookie()

      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Development environment in cookie:',
        'https://example.com'
      )
    })

    it('should decode devEnv URL encoding', () => {
      document.cookie = 'absmartly_overrides=devEnv=https%3A%2F%2Fexample.com|exp1:0'

      manager.checkOverridesCookie()

      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Development environment in cookie:',
        'https://example.com'
      )
    })

    it('should handle errors gracefully', () => {
      // Mock document.cookie to throw
      Object.defineProperty(document, 'cookie', {
        get: () => {
          throw new Error('Cookie error')
        },
        configurable: true
      })

      manager.checkOverridesCookie()

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ABsmartly Extension] Error checking overrides cookie:',
        expect.any(Error)
      )
    })
  })

  describe('getCookieValue', () => {
    it('should return cookie value when cookie exists', () => {
      document.cookie = 'absmartly_overrides=exp1:0,exp2:1'

      const result = manager.getCookieValue()

      expect(result).toBe('exp1:0,exp2:1')
    })

    it('should return null when cookie does not exist', () => {
      const result = manager.getCookieValue()

      expect(result).toBeNull()
    })

    it('should handle multiple cookies', () => {
      document.cookie = 'other_cookie=value'
      document.cookie = 'absmartly_overrides=exp1:0'
      document.cookie = 'another_cookie=value2'

      const result = manager.getCookieValue()

      expect(result).toBe('exp1:0')
    })

    it('should handle errors gracefully', () => {
      // Mock document.cookie to throw
      Object.defineProperty(document, 'cookie', {
        get: () => {
          throw new Error('Cookie error')
        },
        configurable: true
      })

      const result = manager.getCookieValue()

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ABsmartly Extension] Error getting cookie value:',
        expect.any(Error)
      )
    })
  })

  describe('getOverrides', () => {
    it('should return parsed overrides when cookie exists', () => {
      document.cookie = 'absmartly_overrides=exp1:0,exp2:1.2'

      const result = manager.getOverrides()

      expect(result).toEqual({
        overrides: {
          exp1: 0,
          exp2: {
            variant: 1,
            env: 2
          }
        },
        devEnv: null
      })
    })

    it('should return empty overrides when cookie does not exist', () => {
      const result = manager.getOverrides()

      expect(result).toEqual({
        overrides: {},
        devEnv: null
      })
    })

    it('should return parsed overrides with devEnv', () => {
      document.cookie = 'absmartly_overrides=devEnv=https://example.com|exp1:0'

      const result = manager.getOverrides()

      expect(result).toEqual({
        overrides: {
          exp1: 0
        },
        devEnv: 'https://example.com'
      })
    })
  })

  describe('custom cookie name', () => {
    it('should use custom cookie name', () => {
      const customManager = new OverrideManager('my_custom_cookie')
      document.cookie = 'my_custom_cookie=exp1:0'

      const result = customManager.getCookieValue()

      expect(result).toBe('exp1:0')
    })

    it('should check custom cookie name', () => {
      const customManager = new OverrideManager('my_custom_cookie')
      document.cookie = 'my_custom_cookie=exp1:0'

      customManager.checkOverridesCookie()

      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Found absmartly_overrides cookie (will be handled by OverridesPlugin)'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle very long experiment names', () => {
      const longName = 'a'.repeat(1000)
      const result = manager.parseCookieOverrides(`${encodeURIComponent(longName)}:0`)

      expect(result.overrides[longName]).toBe(0)
    })

    it('should handle many experiments', () => {
      const experiments = Array.from({ length: 100 }, (_, i) => `exp${i}:${i % 3}`)
      const cookieValue = experiments.join(',')

      const result = manager.parseCookieOverrides(cookieValue)

      expect(Object.keys(result.overrides)).toHaveLength(100)
    })

    it('should handle special characters in experiment names', () => {
      const result = manager.parseCookieOverrides('exp-1:0,exp_2:1,exp.3:2')

      expect(result.overrides).toEqual({
        'exp-1': 0,
        exp_2: 1,
        'exp.3': 2
      })
    })

    it('should handle whitespace in cookie value', () => {
      const result = manager.parseCookieOverrides('exp1:0, exp2:1')

      // Whitespace in exp name should be preserved
      expect(result.overrides).toEqual({
        exp1: 0,
        ' exp2': 1
      })
    })

    it('should handle variant value of 0', () => {
      const result = manager.parseCookieOverrides('exp1:0')

      expect(result.overrides.exp1).toBe(0)
    })

    it('should handle large variant numbers', () => {
      const result = manager.parseCookieOverrides('exp1:9999')

      expect(result.overrides.exp1).toBe(9999)
    })
  })
})
