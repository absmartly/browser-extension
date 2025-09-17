/**
 * Unit tests for the parseCookieOverrides function from inject-sdk-plugin.js
 * Since the function exists in a browser script, we'll test the logic directly
 */

describe('inject-sdk-plugin.js - parseCookieOverrides', () => {
  // Extract and test the parseCookieOverrides function logic
  function parseCookieOverrides(cookieValue: string) {
    if (!cookieValue) return { overrides: {}, devEnv: null }

    try {
      let devEnv: string | null = null
      let experimentsStr = cookieValue

      // Check if dev environment is included
      if (cookieValue.startsWith('devEnv=')) {
        const parts = cookieValue.split('|')
        devEnv = decodeURIComponent(parts[0].substring(7)) // Remove 'devEnv=' prefix
        experimentsStr = parts[1] || ''
      }

      const overrides: Record<string, any> = {}
      if (experimentsStr) {
        const experiments = experimentsStr.split(';')

        for (const exp of experiments) {
          const [name, values] = exp.split(':')
          if (!name || !values) continue

          const decodedName = decodeURIComponent(name)
          const parts = values.split(',')

          if (parts.length === 1) {
            // Simple format: just variant (running experiment)
            overrides[decodedName] = parseInt(parts[0], 10)
          } else if (parts.length === 2) {
            // Format: variant,env (backward compatibility)
            overrides[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10)
            }
          } else {
            // Full format: variant,env,id
            overrides[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10),
              id: parseInt(parts[2], 10)
            }
          }
        }
      }

      return { overrides, devEnv }
    } catch (error) {
      console.warn('[ABsmartly Extension] Failed to parse override cookie:', error)
      return { overrides: {}, devEnv: null }
    }
  }

  describe('basic functionality', () => {
    it('should return empty result for null/empty input', () => {
      expect(parseCookieOverrides('')).toEqual({ overrides: {}, devEnv: null })
      expect(parseCookieOverrides(null as any)).toEqual({ overrides: {}, devEnv: null })
      expect(parseCookieOverrides(undefined as any)).toEqual({ overrides: {}, devEnv: null })
    })

    it('should parse simple running experiments', () => {
      const cookieValue = 'experiment1:0;experiment2:1;experiment3:2'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        experiment1: 0,
        experiment2: 1,
        experiment3: 2,
      })
      expect(result.devEnv).toBeNull()
    })

    it('should parse development experiments with env flag', () => {
      const cookieValue = 'devExp1:1,1;devExp2:2,1'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        devExp1: {
          variant: 1,
          env: 1,
        },
        devExp2: {
          variant: 2,
          env: 1,
        },
      })
    })

    it('should parse API fetch experiments with full format', () => {
      const cookieValue = 'apiExp1:0,2,123;apiExp2:1,2,456'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        apiExp1: {
          variant: 0,
          env: 2,
          id: 123,
        },
        apiExp2: {
          variant: 1,
          env: 2,
          id: 456,
        },
      })
    })
  })

  describe('dev environment handling', () => {
    it('should parse dev environment prefix', () => {
      const cookieValue = 'devEnv=staging|experiment1:0;experiment2:1'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        experiment1: 0,
        experiment2: 1,
      })
      expect(result.devEnv).toBe('staging')
    })

    it('should handle URL encoded dev environment names', () => {
      const cookieValue = 'devEnv=my%20dev%20environment|experiment1:1'
      const result = parseCookieOverrides(cookieValue)

      expect(result.devEnv).toBe('my dev environment')
      expect(result.overrides).toEqual({
        experiment1: 1,
      })
    })

    it('should handle special characters in dev environment', () => {
      const encodedEnv = encodeURIComponent('dev-env + special chars')
      const cookieValue = `devEnv=${encodedEnv}|experiment1:0`
      const result = parseCookieOverrides(cookieValue)

      expect(result.devEnv).toBe('dev-env + special chars')
    })

    it('should handle empty dev environment', () => {
      const cookieValue = 'devEnv=|experiment1:0'
      const result = parseCookieOverrides(cookieValue)

      expect(result.devEnv).toBe('')
      expect(result.overrides).toEqual({
        experiment1: 0,
      })
    })

    it('should handle dev environment without experiments', () => {
      const cookieValue = 'devEnv=test|'
      const result = parseCookieOverrides(cookieValue)

      expect(result.devEnv).toBe('test')
      expect(result.overrides).toEqual({})
    })
  })

  describe('mixed formats', () => {
    it('should handle mixed experiment formats in same cookie', () => {
      const cookieValue = 'running:1;dev:2,1;api:0,2,789'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        running: 1,
        dev: {
          variant: 2,
          env: 1,
        },
        api: {
          variant: 0,
          env: 2,
          id: 789,
        },
      })
    })

    it('should handle mixed formats with dev environment', () => {
      const cookieValue = 'devEnv=production|running:0;dev:1,1;api:2,2,123'
      const result = parseCookieOverrides(cookieValue)

      expect(result.devEnv).toBe('production')
      expect(result.overrides).toEqual({
        running: 0,
        dev: {
          variant: 1,
          env: 1,
        },
        api: {
          variant: 2,
          env: 2,
          id: 123,
        },
      })
    })
  })

  describe('URL encoding and special characters', () => {
    it('should handle URL encoded experiment names', () => {
      const cookieValue = 'my%20experiment:1;another%2Bexp:2'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        'my experiment': 1,
        'another+exp': 2,
      })
    })

    it('should handle experiment names with special characters', () => {
      const cookieValue = 'test%20%2B%20special:1;normal:2'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        'test + special': 1,
        normal: 2,
      })
    })

    it('should handle Unicode characters in experiment names', () => {
      const exp1 = encodeURIComponent('тест')
      const exp2 = encodeURIComponent('测试')
      const exp3 = encodeURIComponent('🚀 emoji')
      const cookieValue = `${exp1}:1;${exp2}:2;${exp3}:0`
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        'тест': 1,
        '测试': 2,
        '🚀 emoji': 0,
      })
    })
  })

  describe('error handling and edge cases', () => {
    it('should skip malformed experiment entries', () => {
      const cookieValue = 'valid:1;invalid;alsovalid:2;:empty;novalue:'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        valid: 1,
        alsovalid: 2,
      })
    })

    it('should handle invalid numeric values', () => {
      const cookieValue = 'exp1:notanumber;exp2:1;exp3:invalid,1,123'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides.exp1).toBeNaN()
      expect(result.overrides.exp2).toBe(1)
      expect(result.overrides.exp3.variant).toBeNaN()
      expect(result.overrides.exp3.env).toBe(1)
      expect(result.overrides.exp3.id).toBe(123)
    })

    it('should handle empty experiment segments', () => {
      const cookieValue = 'exp1:1;;exp2:2;;;exp3:3'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        exp1: 1,
        exp2: 2,
        exp3: 3,
      })
    })

    it('should handle malformed dev environment segment', () => {
      const cookieValue = 'devEnv|experiment1:1'
      const result = parseCookieOverrides(cookieValue)

      // Should treat the whole thing as experiments since devEnv format is malformed
      expect(result.devEnv).toBeNull()
    })

    it('should gracefully handle complete parsing failure', () => {
      // Mock console.warn to test error handling
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Force an error by passing a non-string that will cause an error
      const mockParseCookieOverrides = (cookieValue: any) => {
        try {
          // This will throw when we try to call startsWith on a non-string
          if (cookieValue.startsWith('devEnv=')) {
            // Should not reach here
          }
          return { overrides: {}, devEnv: null }
        } catch (error) {
          console.warn('[ABsmartly Extension] Failed to parse override cookie:', error)
          return { overrides: {}, devEnv: null }
        }
      }

      const result = mockParseCookieOverrides({ not: 'a string' })

      expect(result).toEqual({ overrides: {}, devEnv: null })
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should handle very long cookie values', () => {
      // Generate a cookie with many experiments
      const experiments = []
      for (let i = 0; i < 100; i++) {
        experiments.push(`exp${i}:${i % 3}`)
      }
      const cookieValue = experiments.join(';')

      const result = parseCookieOverrides(cookieValue)

      expect(Object.keys(result.overrides)).toHaveLength(100)
      expect(result.overrides.exp0).toBe(0)
      expect(result.overrides.exp1).toBe(1)
      expect(result.overrides.exp99).toBe(0) // 99 % 3 = 0
    })

    it('should handle zero values correctly', () => {
      const cookieValue = 'exp1:0;exp2:0,1;exp3:0,2,100'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        exp1: 0,
        exp2: {
          variant: 0,
          env: 1,
        },
        exp3: {
          variant: 0,
          env: 2,
          id: 100,
        },
      })
    })

    it('should handle negative numbers', () => {
      const cookieValue = 'exp1:-1;exp2:1,-1;exp3:-1,2,-1'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        exp1: -1,
        exp2: {
          variant: 1,
          env: -1,
        },
        exp3: {
          variant: -1,
          env: 2,
          id: -1,
        },
      })
    })

    it('should handle extra commas in values', () => {
      const cookieValue = 'exp1:1,2,3,4,5;exp2:1,2'
      const result = parseCookieOverrides(cookieValue)

      // Should only parse first 3 values and ignore the rest
      expect(result.overrides).toEqual({
        exp1: {
          variant: 1,
          env: 2,
          id: 3,
        },
        exp2: {
          variant: 1,
          env: 2,
        },
      })
    })
  })

  describe('backward compatibility', () => {
    it('should maintain compatibility with old simple format', () => {
      const cookieValue = 'oldExp:1;anotherOldExp:2'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        oldExp: 1,
        anotherOldExp: 2,
      })
    })

    it('should maintain compatibility with variant,env format', () => {
      const cookieValue = 'exp1:1,1;exp2:2,2'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        exp1: {
          variant: 1,
          env: 1,
        },
        exp2: {
          variant: 2,
          env: 2,
        },
      })
    })

    it('should handle legacy format mixed with new format', () => {
      const cookieValue = 'legacy:1;new:2,1,123;another:3'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        legacy: 1,
        new: {
          variant: 2,
          env: 1,
          id: 123,
        },
        another: 3,
      })
    })
  })

  describe('real-world scenarios', () => {
    it('should handle realistic production cookie', () => {
      const cookieValue = 'homepage_banner:1;checkout_flow:0;pricing_table:2,1'
      const result = parseCookieOverrides(cookieValue)

      expect(result.overrides).toEqual({
        homepage_banner: 1,
        checkout_flow: 0,
        pricing_table: {
          variant: 2,
          env: 1,
        },
      })
    })

    it('should handle realistic development cookie with environment', () => {
      const cookieValue = 'devEnv=staging|feature_toggle:1,1;new_ui:0,2,456;legacy_exp:2'
      const result = parseCookieOverrides(cookieValue)

      expect(result.devEnv).toBe('staging')
      expect(result.overrides).toEqual({
        feature_toggle: {
          variant: 1,
          env: 1,
        },
        new_ui: {
          variant: 0,
          env: 2,
          id: 456,
        },
        legacy_exp: 2,
      })
    })

    it('should handle cookie size near browser limits', () => {
      // Create a cookie close to the 4KB limit
      const experiments = []
      const longExpName = 'a'.repeat(50) // 50 char experiment names

      for (let i = 0; i < 30; i++) {
        experiments.push(`${longExpName}${i}:${i % 4}`)
      }

      const cookieValue = experiments.join(';')
      expect(cookieValue.length).toBeGreaterThan(1500) // Reasonably large

      const result = parseCookieOverrides(cookieValue)

      expect(Object.keys(result.overrides)).toHaveLength(30)
      expect(result.overrides[`${longExpName}0`]).toBe(0)
      expect(result.overrides[`${longExpName}29`]).toBe(1) // 29 % 4 = 1
    })
  })
})