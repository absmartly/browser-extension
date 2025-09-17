import {
  ENV_TYPE,
  ExperimentOverrides,
  OverrideValue,
  OVERRIDES_COOKIE_NAME,
  OVERRIDES_STORAGE_KEY,
  DEV_ENV_STORAGE_KEY,
  DEV_ENV_COOKIE_NAME,
  loadOverridesFromStorage,
  saveOverrides,
  saveDevelopmentEnvironment,
  getDevelopmentEnvironment,
  getCookieOverridesScript,
  setCookieOverridesScript,
  parseCookieFormat,
  serializeToCookieFormat,
} from '../utils/overrides'

// Mock @plasmohq/storage
jest.mock('@plasmohq/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}))

describe('overrides.ts', () => {

  beforeEach(() => {
    jest.clearAllMocks()
    document.cookie = '' // Reset document.cookie
  })

  describe('ENV_TYPE constants', () => {
    it('should have correct environment type values', () => {
      expect(ENV_TYPE.PRODUCTION).toBe(0)
      expect(ENV_TYPE.DEVELOPMENT).toBe(1)
      expect(ENV_TYPE.API_FETCH).toBe(2)
    })
  })

  describe('parseCookieFormat', () => {
    it('should return empty overrides for null/empty input', () => {
      expect(parseCookieFormat('')).toEqual({ overrides: {} })
      expect(parseCookieFormat(null as any)).toEqual({ overrides: {} })
      expect(parseCookieFormat(undefined as any)).toEqual({ overrides: {} })
    })

    it('should parse simple running experiment format', () => {
      const cookieValue = 'experiment1:0;experiment2:1'
      const result = parseCookieFormat(cookieValue)

      expect(result.overrides).toEqual({
        experiment1: 0,
        experiment2: 1,
      })
      expect(result.devEnv).toBeUndefined()
    })

    it('should parse development experiment format with env', () => {
      const cookieValue = 'experiment1:0,1;experiment2:1,1'
      const result = parseCookieFormat(cookieValue)

      expect(result.overrides).toEqual({
        experiment1: {
          variant: 0,
          env: 1,
        },
        experiment2: {
          variant: 1,
          env: 1,
        },
      })
    })

    it('should parse full format with env and id', () => {
      const cookieValue = 'experiment1:0,2,123;experiment2:1,2,456'
      const result = parseCookieFormat(cookieValue)

      expect(result.overrides).toEqual({
        experiment1: {
          variant: 0,
          env: 2,
          id: 123,
        },
        experiment2: {
          variant: 1,
          env: 2,
          id: 456,
        },
      })
    })

    it('should parse dev environment prefix', () => {
      const cookieValue = 'devEnv=development|experiment1:0;experiment2:1'
      const result = parseCookieFormat(cookieValue)

      expect(result.overrides).toEqual({
        experiment1: 0,
        experiment2: 1,
      })
      expect(result.devEnv).toBe('development')
    })

    it('should handle URL encoded dev environment names', () => {
      const cookieValue = 'devEnv=my%20dev%20env|experiment1:0'
      const result = parseCookieFormat(cookieValue)

      expect(result.devEnv).toBe('my dev env')
      expect(result.overrides).toEqual({
        experiment1: 0,
      })
    })

    it('should handle URL encoded experiment names', () => {
      const cookieValue = 'my%20experiment:0;another%2Bexp:1'
      const result = parseCookieFormat(cookieValue)

      expect(result.overrides).toEqual({
        'my experiment': 0,
        'another+exp': 1,
      })
    })

    it('should handle mixed formats in the same cookie', () => {
      const cookieValue = 'exp1:0;exp2:1,1;exp3:2,2,789'
      const result = parseCookieFormat(cookieValue)

      expect(result.overrides).toEqual({
        exp1: 0,
        exp2: {
          variant: 1,
          env: 1,
        },
        exp3: {
          variant: 2,
          env: 2,
          id: 789,
        },
      })
    })

    it('should skip malformed entries', () => {
      const cookieValue = 'exp1:0;;:invalid;exp3:2'
      const result = parseCookieFormat(cookieValue)

      expect(result.overrides).toEqual({
        exp1: 0,
        exp3: 2,
      })
    })

    it('should handle empty experiments string with dev env', () => {
      const cookieValue = 'devEnv=test|'
      const result = parseCookieFormat(cookieValue)

      expect(result.overrides).toEqual({})
      expect(result.devEnv).toBe('test')
    })

    it('should handle malformed cookie gracefully', () => {
      const cookieValue = '::'
      const result = parseCookieFormat(cookieValue)

      // Should not throw and return empty overrides
      expect(result.overrides).toEqual({})
    })

    it('should handle special characters in experiment names', () => {
      const cookieValue = 'test%20exp%20%2B%20special:1;normal:2'
      const result = parseCookieFormat(cookieValue)

      expect(result.overrides).toEqual({
        'test exp + special': 1,
        normal: 2,
      })
    })
  })

  describe('serializeToCookieFormat', () => {
    it('should serialize simple running experiments', () => {
      const overrides: ExperimentOverrides = {
        experiment1: 0,
        experiment2: 1,
      }

      const result = serializeToCookieFormat(overrides)
      expect(result).toBe('experiment1:0;experiment2:1')
    })

    it('should serialize development experiments with env', () => {
      const overrides: ExperimentOverrides = {
        experiment1: {
          variant: 0,
          env: ENV_TYPE.DEVELOPMENT,
        },
        experiment2: {
          variant: 1,
          env: ENV_TYPE.DEVELOPMENT,
        },
      }

      const result = serializeToCookieFormat(overrides)
      expect(result).toBe('experiment1:0,1;experiment2:1,1')
    })

    it('should serialize API fetch experiments with full format', () => {
      const overrides: ExperimentOverrides = {
        experiment1: {
          variant: 0,
          env: ENV_TYPE.API_FETCH,
          id: 123,
        },
        experiment2: {
          variant: 1,
          env: ENV_TYPE.API_FETCH,
          id: 456,
        },
      }

      const result = serializeToCookieFormat(overrides)
      expect(result).toBe('experiment1:0,2,123;experiment2:1,2,456')
    })

    it('should handle mixed experiment types', () => {
      const overrides: ExperimentOverrides = {
        running: 0,
        development: {
          variant: 1,
          env: ENV_TYPE.DEVELOPMENT,
        },
        api_fetch: {
          variant: 2,
          env: ENV_TYPE.API_FETCH,
          id: 789,
        },
      }

      const result = serializeToCookieFormat(overrides)
      expect(result).toBe('running:0;development:1,1;api_fetch:2,2,789')
    })

    it('should include dev environment prefix when provided', () => {
      const overrides: ExperimentOverrides = {
        experiment1: 0,
        experiment2: 1,
      }

      const result = serializeToCookieFormat(overrides, 'development')
      expect(result).toBe('devEnv=development|experiment1:0;experiment2:1')
    })

    it('should URL encode dev environment names', () => {
      const overrides: ExperimentOverrides = {
        experiment1: 0,
      }

      const result = serializeToCookieFormat(overrides, 'my dev env')
      expect(result).toBe('devEnv=my%20dev%20env|experiment1:0')
    })

    it('should URL encode experiment names with special characters', () => {
      const overrides: ExperimentOverrides = {
        'test exp + special': 1,
        'normal': 2,
      }

      const result = serializeToCookieFormat(overrides)
      expect(result).toBe('test%20exp%20%2B%20special:1;normal:2')
    })

    it('should handle object experiments with production env as simple format', () => {
      const overrides: ExperimentOverrides = {
        experiment1: {
          variant: 1,
          env: ENV_TYPE.PRODUCTION,
        },
      }

      const result = serializeToCookieFormat(overrides)
      expect(result).toBe('experiment1:1')
    })

    it('should handle development experiments without id', () => {
      const overrides: ExperimentOverrides = {
        experiment1: {
          variant: 1,
          env: ENV_TYPE.DEVELOPMENT,
        },
      }

      const result = serializeToCookieFormat(overrides)
      expect(result).toBe('experiment1:1,1')
    })

    it('should return empty string for empty overrides without dev env', () => {
      const result = serializeToCookieFormat({})
      expect(result).toBe('')
    })

    it('should include dev env prefix even with empty experiments', () => {
      const result = serializeToCookieFormat({}, 'test')
      expect(result).toBe('devEnv=test|')
    })
  })

  describe('round-trip tests (serialize then parse)', () => {
    it('should preserve simple running experiments', () => {
      const original: ExperimentOverrides = {
        experiment1: 0,
        experiment2: 1,
        experiment3: 2,
      }

      const serialized = serializeToCookieFormat(original)
      const parsed = parseCookieFormat(serialized)

      expect(parsed.overrides).toEqual(original)
    })

    it('should preserve development experiments', () => {
      const original: ExperimentOverrides = {
        experiment1: {
          variant: 0,
          env: ENV_TYPE.DEVELOPMENT,
        },
        experiment2: {
          variant: 1,
          env: ENV_TYPE.DEVELOPMENT,
        },
      }

      const serialized = serializeToCookieFormat(original)
      const parsed = parseCookieFormat(serialized)

      expect(parsed.overrides).toEqual(original)
    })

    it('should preserve API fetch experiments with IDs', () => {
      const original: ExperimentOverrides = {
        experiment1: {
          variant: 0,
          env: ENV_TYPE.API_FETCH,
          id: 123,
        },
        experiment2: {
          variant: 1,
          env: ENV_TYPE.API_FETCH,
          id: 456,
        },
      }

      const serialized = serializeToCookieFormat(original)
      const parsed = parseCookieFormat(serialized)

      expect(parsed.overrides).toEqual(original)
    })

    it('should preserve mixed experiment types', () => {
      const original: ExperimentOverrides = {
        running: 0,
        development: {
          variant: 1,
          env: ENV_TYPE.DEVELOPMENT,
        },
        api_fetch: {
          variant: 2,
          env: ENV_TYPE.API_FETCH,
          id: 789,
        },
      }

      const serialized = serializeToCookieFormat(original)
      const parsed = parseCookieFormat(serialized)

      expect(parsed.overrides).toEqual(original)
    })

    it('should preserve dev environment names', () => {
      const original: ExperimentOverrides = {
        experiment1: 0,
      }
      const devEnv = 'my development environment'

      const serialized = serializeToCookieFormat(original, devEnv)
      const parsed = parseCookieFormat(serialized)

      expect(parsed.overrides).toEqual(original)
      expect(parsed.devEnv).toBe(devEnv)
    })

    it('should preserve experiment names with special characters', () => {
      const original: ExperimentOverrides = {
        'test exp + special chars': 1,
        'another/exp with spaces': {
          variant: 2,
          env: ENV_TYPE.DEVELOPMENT,
        },
      }

      const serialized = serializeToCookieFormat(original)
      const parsed = parseCookieFormat(serialized)

      expect(parsed.overrides).toEqual(original)
    })
  })

  describe('getCookieOverridesScript', () => {
    it('should generate script that parses cookie correctly', () => {
      const script = getCookieOverridesScript()

      // The script should contain the cookie parsing logic
      expect(script).toContain(OVERRIDES_COOKIE_NAME)
      expect(script).toContain('document.cookie')
      expect(script).toContain('decodeURIComponent')
    })

    it('should generate script that handles empty cookie', () => {
      const script = getCookieOverridesScript()

      // Should return empty object if no cookie
      expect(script).toContain('return {}')
    })
  })

  describe('setCookieOverridesScript', () => {
    it('should generate script to set cookie with overrides', () => {
      const overrides: ExperimentOverrides = {
        experiment1: 0,
        experiment2: 1,
      }

      const script = setCookieOverridesScript(overrides)

      expect(script).toContain(OVERRIDES_COOKIE_NAME)
      expect(script).toContain('experiment1:0;experiment2:1')
      expect(script).toContain('document.cookie')
    })

    it('should generate script to clear cookie when no overrides', () => {
      const script = setCookieOverridesScript({})

      expect(script).toContain('expires=Thu, 01 Jan 1970 00:00:00 UTC')
    })

    it('should filter out disabled experiments (variant -1)', () => {
      const overrides: ExperimentOverrides = {
        enabled: 1,
        disabled: -1,
        object_disabled: {
          variant: -1,
          env: ENV_TYPE.DEVELOPMENT,
        },
        object_enabled: {
          variant: 2,
          env: ENV_TYPE.DEVELOPMENT,
        },
      }

      const script = setCookieOverridesScript(overrides)

      expect(script).toContain('enabled:1')
      expect(script).toContain('object_enabled:2,1')
      expect(script).not.toContain('disabled')
      expect(script).not.toContain('-1')
    })

    it('should set expiration date 30 days in future', () => {
      const overrides: ExperimentOverrides = {
        experiment1: 0,
      }

      const script = setCookieOverridesScript(overrides)

      expect(script).toContain('expires=')
      expect(script).toMatch(/expires=.*GMT/)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle very long experiment names', () => {
      const longName = 'a'.repeat(1000)
      const overrides: ExperimentOverrides = {
        [longName]: 1,
      }

      const serialized = serializeToCookieFormat(overrides)
      const parsed = parseCookieFormat(serialized)

      expect(parsed.overrides[longName]).toBe(1)
    })

    it('should handle invalid numeric values gracefully', () => {
      const cookieValue = 'exp1:invalid;exp2:1'
      const result = parseCookieFormat(cookieValue)

      expect(result.overrides.exp1).toBeNaN()
      expect(result.overrides.exp2).toBe(1)
    })

    it('should handle empty experiment names', () => {
      const cookieValue = ':1;exp2:2'
      const result = parseCookieFormat(cookieValue)

      // Should skip empty names
      expect(result.overrides).toEqual({
        exp2: 2,
      })
    })

    it('should handle empty values', () => {
      const cookieValue = 'exp1:;exp2:1'
      const result = parseCookieFormat(cookieValue)

      // Should skip empty values
      expect(result.overrides).toEqual({
        exp2: 1,
      })
    })

    it('should handle maximum cookie size considerations', () => {
      // Test with a reasonable number of experiments to stay under cookie limits
      const overrides: ExperimentOverrides = {}

      for (let i = 0; i < 50; i++) {
        overrides[`experiment_${i}`] = i % 3
      }

      const serialized = serializeToCookieFormat(overrides)

      // Should stay under typical cookie size limits (~4KB)
      expect(serialized.length).toBeLessThan(4000)

      const parsed = parseCookieFormat(serialized)
      expect(Object.keys(parsed.overrides)).toHaveLength(50)
    })

    it('should handle Unicode characters in experiment names', () => {
      const overrides: ExperimentOverrides = {
        'тест': 1,
        '测试': 2,
        '🚀 emoji test': 3,
      }

      const serialized = serializeToCookieFormat(overrides)
      const parsed = parseCookieFormat(serialized)

      expect(parsed.overrides).toEqual(overrides)
    })

    it('should handle malformed dev environment', () => {
      const cookieValue = 'devEnv=|exp1:1'
      const result = parseCookieFormat(cookieValue)

      expect(result.devEnv).toBe('')
      expect(result.overrides).toEqual({
        exp1: 1,
      })
    })
  })
})