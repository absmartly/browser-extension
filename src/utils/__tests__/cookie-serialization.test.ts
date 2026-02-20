import { describe, it, expect } from '@jest/globals'
import { parseCookieValue, serializeOverrides, generateCookieParserScript } from '../cookie-serialization'
import type { ExperimentOverrides } from '../overrides'

describe('cookie-serialization', () => {
  describe('parseCookieValue', () => {
    it('should return empty overrides for empty string', () => {
      const result = parseCookieValue('')
      expect(result).toEqual({ overrides: {} })
    })

    it('should parse simple running experiment format', () => {
      const result = parseCookieValue('exp1:2')
      expect(result).toEqual({
        overrides: {
          exp1: 2
        }
      })
    })

    it('should parse multiple running experiments', () => {
      const result = parseCookieValue('exp1:1,exp2:2,exp3:0')
      expect(result).toEqual({
        overrides: {
          exp1: 1,
          exp2: 2,
          exp3: 0
        }
      })
    })

    it('should parse experiment with env', () => {
      const result = parseCookieValue('exp1:2.1')
      expect(result).toEqual({
        overrides: {
          exp1: {
            variant: 2,
            env: 1
          }
        }
      })
    })

    it('should parse experiment with env and id', () => {
      const result = parseCookieValue('exp1:2.1.123')
      expect(result).toEqual({
        overrides: {
          exp1: {
            variant: 2,
            env: 1,
            id: 123
          }
        }
      })
    })

    it('should parse dev environment with experiments', () => {
      const result = parseCookieValue('devEnv=staging|exp1:1,exp2:2')
      expect(result).toEqual({
        overrides: {
          exp1: 1,
          exp2: 2
        },
        devEnv: 'staging'
      })
    })

    it('should decode URL-encoded experiment names', () => {
      const result = parseCookieValue('my%20exp:1')
      expect(result).toEqual({
        overrides: {
          'my exp': 1
        }
      })
    })

    it('should decode URL-encoded dev environment', () => {
      const result = parseCookieValue('devEnv=my%20env|exp1:1')
      expect(result).toEqual({
        overrides: {
          exp1: 1
        },
        devEnv: 'my env'
      })
    })

    it('should handle mixed experiment formats', () => {
      const result = parseCookieValue('exp1:1,exp2:2.1,exp3:3.2.456')
      expect(result).toEqual({
        overrides: {
          exp1: 1,
          exp2: {
            variant: 2,
            env: 1
          },
          exp3: {
            variant: 3,
            env: 2,
            id: 456
          }
        }
      })
    })

    it('should skip malformed experiment entries', () => {
      const result = parseCookieValue('exp1:1,invalid,exp2:2')
      expect(result).toEqual({
        overrides: {
          exp1: 1,
          exp2: 2
        }
      })
    })

    it('should handle dev env without experiments', () => {
      const result = parseCookieValue('devEnv=staging|')
      expect(result).toEqual({
        overrides: {},
        devEnv: 'staging'
      })
    })
  })

  describe('serializeOverrides', () => {
    it('should serialize empty overrides', () => {
      const result = serializeOverrides({})
      expect(result).toBe('')
    })

    it('should serialize simple running experiment', () => {
      const overrides: ExperimentOverrides = {
        exp1: 2
      }
      const result = serializeOverrides(overrides)
      expect(result).toBe('exp1:2')
    })

    it('should serialize multiple running experiments', () => {
      const overrides: ExperimentOverrides = {
        exp1: 1,
        exp2: 2,
        exp3: 0
      }
      const result = serializeOverrides(overrides)
      expect(result).toContain('exp1:1')
      expect(result).toContain('exp2:2')
      expect(result).toContain('exp3:0')
      expect(result.split(',').length).toBe(3)
    })

    it('should serialize experiment with env', () => {
      const overrides: ExperimentOverrides = {
        exp1: {
          variant: 2,
          env: 1
        }
      }
      const result = serializeOverrides(overrides)
      expect(result).toBe('exp1:2.1')
    })

    it('should serialize experiment with env and id', () => {
      const overrides: ExperimentOverrides = {
        exp1: {
          variant: 2,
          env: 1,
          id: 123
        }
      }
      const result = serializeOverrides(overrides)
      expect(result).toBe('exp1:2.1.123')
    })

    it('should not include env when it is PRODUCTION (0)', () => {
      const overrides: ExperimentOverrides = {
        exp1: {
          variant: 2,
          env: 0
        }
      }
      const result = serializeOverrides(overrides)
      expect(result).toBe('exp1:2')
    })

    it('should serialize with dev environment', () => {
      const overrides: ExperimentOverrides = {
        exp1: 1
      }
      const result = serializeOverrides(overrides, 'staging')
      expect(result).toBe('devEnv=staging|exp1:1')
    })

    it('should URL-encode experiment names', () => {
      const overrides: ExperimentOverrides = {
        'my exp': 1
      }
      const result = serializeOverrides(overrides)
      expect(result).toBe('my%20exp:1')
    })

    it('should URL-encode dev environment', () => {
      const overrides: ExperimentOverrides = {
        exp1: 1
      }
      const result = serializeOverrides(overrides, 'my env')
      expect(result).toBe('devEnv=my%20env|exp1:1')
    })

    it('should handle mixed experiment formats', () => {
      const overrides: ExperimentOverrides = {
        exp1: 1,
        exp2: {
          variant: 2,
          env: 1
        },
        exp3: {
          variant: 3,
          env: 2,
          id: 456
        }
      }
      const result = serializeOverrides(overrides)
      expect(result).toContain('exp1:1')
      expect(result).toContain('exp2:2.1')
      expect(result).toContain('exp3:3.2.456')
    })

    it('should ignore null dev environment', () => {
      const overrides: ExperimentOverrides = {
        exp1: 1
      }
      const result = serializeOverrides(overrides, null)
      expect(result).toBe('exp1:1')
    })
  })

  describe('generateCookieParserScript', () => {
    it('should generate script with correct cookie name', () => {
      const script = generateCookieParserScript('test_cookie')
      expect(script).toContain("startsWith('test_cookie=')")
    })

    it('should generate valid JavaScript', () => {
      const script = generateCookieParserScript('test_cookie')

      // Should be a self-executing function
      expect(script).toMatch(/^\s*\(\(\) => \{/)
      expect(script).toMatch(/\}\)\(\)\s*$/)

      // Should contain cookie parsing logic
      expect(script).toContain('document.cookie')
      expect(script).toContain('.split')
      expect(script).toContain('.find')
    })

    it('should handle empty cookie value', () => {
      const script = generateCookieParserScript('test_cookie')
      expect(script).toContain('if (!cookieValue) return {}')
    })

    it('should parse dev environment', () => {
      const script = generateCookieParserScript('test_cookie')
      expect(script).toContain("cookieValue.startsWith('devEnv=')")
      expect(script).toContain('decodeURIComponent')
    })

    it('should parse experiment formats', () => {
      const script = generateCookieParserScript('test_cookie')

      // Should handle simple format
      expect(script).toContain('if (parts.length === 1)')

      // Should handle env format
      expect(script).toContain('else if (parts.length === 2)')

      // Should handle full format
      expect(script).toContain('else')
      expect(script).toContain('variant:')
      expect(script).toContain('env:')
      expect(script).toContain('id:')
    })
  })

  describe('round-trip serialization', () => {
    it('should correctly round-trip simple overrides', () => {
      const original: ExperimentOverrides = {
        exp1: 1,
        exp2: 2
      }
      const serialized = serializeOverrides(original)
      const parsed = parseCookieValue(serialized)
      expect(parsed.overrides).toEqual(original)
    })

    it('should correctly round-trip complex overrides', () => {
      const original: ExperimentOverrides = {
        exp1: 1,
        exp2: {
          variant: 2,
          env: 1
        },
        exp3: {
          variant: 3,
          env: 2,
          id: 456
        }
      }
      const serialized = serializeOverrides(original)
      const parsed = parseCookieValue(serialized)
      expect(parsed.overrides).toEqual(original)
    })

    it('should correctly round-trip with dev environment', () => {
      const original: ExperimentOverrides = {
        exp1: 1,
        exp2: 2
      }
      const devEnv = 'staging'
      const serialized = serializeOverrides(original, devEnv)
      const parsed = parseCookieValue(serialized)
      expect(parsed.overrides).toEqual(original)
      expect(parsed.devEnv).toBe(devEnv)
    })

    it('should correctly round-trip with URL-encoded names', () => {
      const original: ExperimentOverrides = {
        'my exp': 1,
        'another/exp': 2
      }
      const serialized = serializeOverrides(original)
      const parsed = parseCookieValue(serialized)
      expect(parsed.overrides).toEqual(original)
    })
  })
})
