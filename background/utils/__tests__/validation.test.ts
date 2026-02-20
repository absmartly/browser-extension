/**
 * Unit tests for validation utilities
 * Tests all Zod schemas and validation functions
 */

import {
  ConfigSchema,
  APIRequestSchema,
  validateConfig,
  validateAPIRequest,
  safeValidateConfig,
  safeValidateAPIRequest
} from '../validation'

describe('Validation Utilities', () => {
  describe('ConfigSchema', () => {
    describe('valid configurations', () => {
      it('should validate minimal valid config', () => {
        const config = {
          apiEndpoint: 'https://api.absmartly.com'
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.apiEndpoint).toBe('https://api.absmartly.com')
        }
      })

      it('should validate full valid config with all fields', () => {
        const config = {
          apiKey: 'test-api-key-123',
          apiEndpoint: 'https://api.absmartly.com/v1',
          applicationId: 12345,
          authMethod: 'jwt' as const,
          domChangesFieldName: 'dom_changes',
          sdkEndpoint: 'https://sdk.absmartly.com',
          queryPrefix: 'ab_',
          persistQueryToCookie: true,
          injectSDK: true,
          sdkUrl: 'https://cdn.absmartly.com/sdk.js'
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toEqual(config)
        }
      })

      it('should validate config with apikey auth method', () => {
        const config = {
          apiKey: 'test-api-key',
          apiEndpoint: 'https://api.absmartly.com',
          authMethod: 'apikey' as const
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(true)
      })

      it('should accept optional fields as undefined', () => {
        const config = {
          apiEndpoint: 'https://api.absmartly.com',
          apiKey: undefined,
          applicationId: undefined
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(true)
      })
    })

    describe('invalid configurations', () => {
      it('should reject config without apiEndpoint', () => {
        const config = {
          apiKey: 'test-key'
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(false)
      })

      it('should reject config with invalid URL for apiEndpoint', () => {
        const config = {
          apiEndpoint: 'not-a-url'
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(false)
      })

      it('should reject config with invalid URL for sdkEndpoint', () => {
        const config = {
          apiEndpoint: 'https://api.absmartly.com',
          sdkEndpoint: 'invalid-url'
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(false)
      })

      it('should reject config with invalid URL for sdkUrl', () => {
        const config = {
          apiEndpoint: 'https://api.absmartly.com',
          sdkUrl: 'not a url'
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(false)
      })

      it('should reject config with negative applicationId', () => {
        const config = {
          apiEndpoint: 'https://api.absmartly.com',
          applicationId: -1
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(false)
      })

      it('should reject config with zero applicationId', () => {
        const config = {
          apiEndpoint: 'https://api.absmartly.com',
          applicationId: 0
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(false)
      })

      it('should reject config with non-integer applicationId', () => {
        const config = {
          apiEndpoint: 'https://api.absmartly.com',
          applicationId: 3.14
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(false)
      })

      it('should reject config with invalid authMethod', () => {
        const config = {
          apiEndpoint: 'https://api.absmartly.com',
          authMethod: 'oauth'
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(false)
      })

      it('should reject config with non-boolean injectSDK', () => {
        const config = {
          apiEndpoint: 'https://api.absmartly.com',
          injectSDK: 'yes'
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(false)
      })

      it('should reject config with non-boolean persistQueryToCookie', () => {
        const config = {
          apiEndpoint: 'https://api.absmartly.com',
          persistQueryToCookie: 1
        }

        const result = ConfigSchema.safeParse(config)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('APIRequestSchema', () => {
    describe('valid requests', () => {
      it('should validate GET request without data', () => {
        const request = {
          method: 'GET',
          path: '/api/experiments'
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.method).toBe('GET')
          expect(result.data.path).toBe('/api/experiments')
        }
      })

      it('should validate POST request with data', () => {
        const request = {
          method: 'POST',
          path: '/api/experiments',
          data: { name: 'Test Experiment' }
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.data).toEqual({ name: 'Test Experiment' })
        }
      })

      it('should validate all HTTP methods', () => {
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']

        methods.forEach(method => {
          const request = { method, path: '/api/test' }
          const result = APIRequestSchema.safeParse(request)
          expect(result.success).toBe(true)
        })
      })

      it('should validate request with complex data', () => {
        const request = {
          method: 'PUT',
          path: '/api/experiments/123',
          data: {
            name: 'Updated Experiment',
            variants: [{ name: 'Control' }, { name: 'Treatment' }],
            config: { traffic: 0.5 }
          }
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(true)
      })

      it('should validate request with null data', () => {
        const request = {
          method: 'POST',
          path: '/api/test',
          data: null
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(true)
      })

      it('should validate request with undefined data', () => {
        const request = {
          method: 'GET',
          path: '/api/test',
          data: undefined
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(true)
      })
    })

    describe('invalid requests', () => {
      it('should reject request without method', () => {
        const request = {
          path: '/api/test'
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(false)
      })

      it('should reject request without path', () => {
        const request = {
          method: 'GET'
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(false)
      })

      it('should reject request with empty path', () => {
        const request = {
          method: 'GET',
          path: ''
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(false)
      })

      it('should reject request with invalid HTTP method', () => {
        const request = {
          method: 'INVALID',
          path: '/api/test'
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(false)
      })

      it('should reject request with lowercase method', () => {
        const request = {
          method: 'get',
          path: '/api/test'
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(false)
      })

      it('should reject request with number as path', () => {
        const request = {
          method: 'GET',
          path: 123
        }

        const result = APIRequestSchema.safeParse(request)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('validateConfig', () => {
    it('should return validated config for valid input', () => {
      const config = {
        apiEndpoint: 'https://api.absmartly.com',
        applicationId: 123
      }

      const validated = validateConfig(config)
      expect(validated.apiEndpoint).toBe('https://api.absmartly.com')
      expect(validated.applicationId).toBe(123)
    })

    it('should throw ZodError for invalid input', () => {
      const config = {
        apiEndpoint: 'not-a-url'
      }

      expect(() => validateConfig(config)).toThrow()
    })

    it('should throw for missing required fields', () => {
      const config = {
        apiKey: 'test'
      }

      expect(() => validateConfig(config)).toThrow()
    })
  })

  describe('validateAPIRequest', () => {
    it('should return validated request for valid input', () => {
      const request = {
        method: 'POST',
        path: '/api/test',
        data: { key: 'value' }
      }

      const validated = validateAPIRequest(request)
      expect(validated.method).toBe('POST')
      expect(validated.path).toBe('/api/test')
      expect(validated.data).toEqual({ key: 'value' })
    })

    it('should throw ZodError for invalid method', () => {
      const request = {
        method: 'INVALID',
        path: '/api/test'
      }

      expect(() => validateAPIRequest(request)).toThrow()
    })

    it('should throw for missing path', () => {
      const request = {
        method: 'GET'
      }

      expect(() => validateAPIRequest(request)).toThrow()
    })
  })

  describe('safeValidateConfig', () => {
    it('should return success result for valid config', () => {
      const config = {
        apiEndpoint: 'https://api.absmartly.com'
      }

      const result = safeValidateConfig(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.apiEndpoint).toBe('https://api.absmartly.com')
      }
    })

    it('should return error result for invalid config', () => {
      const config = {
        apiEndpoint: 'invalid'
      }

      const result = safeValidateConfig(config)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    it('should not throw for invalid input', () => {
      const config = { invalid: 'data' }

      expect(() => safeValidateConfig(config)).not.toThrow()
    })
  })

  describe('safeValidateAPIRequest', () => {
    it('should return success result for valid request', () => {
      const request = {
        method: 'GET',
        path: '/test'
      }

      const result = safeValidateAPIRequest(request)
      expect(result.success).toBe(true)
    })

    it('should return error result for invalid request', () => {
      const request = {
        method: 'INVALID',
        path: '/test'
      }

      const result = safeValidateAPIRequest(request)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    it('should not throw for invalid input', () => {
      const request = { invalid: 'data' }

      expect(() => safeValidateAPIRequest(request)).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle null input', () => {
      const result = safeValidateConfig(null)
      expect(result.success).toBe(false)
    })

    it('should handle undefined input', () => {
      const result = safeValidateAPIRequest(undefined)
      expect(result.success).toBe(false)
    })

    it('should handle array input', () => {
      const result = safeValidateConfig([])
      expect(result.success).toBe(false)
    })

    it('should handle string input', () => {
      const result = safeValidateAPIRequest('invalid')
      expect(result.success).toBe(false)
    })

    it('should handle number input', () => {
      const result = safeValidateConfig(123)
      expect(result.success).toBe(false)
    })
  })
})
