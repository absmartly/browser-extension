/**
 * Unit tests for APIError class
 * Tests error construction, type guards, and helper methods
 */

import { APIError } from '../errors'

describe('APIError', () => {
  describe('constructor', () => {
    it('should create APIError with message only', () => {
      const error = new APIError('Test error')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(APIError)
      expect(error.message).toBe('Test error')
      expect(error.name).toBe('APIError')
      expect(error.isAuthError).toBe(false)
    })

    it('should create APIError with auth flag', () => {
      const error = new APIError('Auth failed', true)
      expect(error.message).toBe('Auth failed')
      expect(error.isAuthError).toBe(true)
      expect(error.name).toBe('APIError')
    })

    it('should create APIError with status code', () => {
      const error = new APIError('Not found', false, 404)
      expect(error.message).toBe('Not found')
      expect(error.isAuthError).toBe(false)
      expect(error.status).toBe(404)
      expect(error.name).toBe('APIError')
    })

    it('should create APIError with error code', () => {
      const error = new APIError('Invalid request', false, 400, 'INVALID_REQUEST')
      expect(error.message).toBe('Invalid request')
      expect(error.isAuthError).toBe(false)
      expect(error.status).toBe(400)
      expect(error.code).toBe('INVALID_REQUEST')
      expect(error.name).toBe('APIError')
    })

    it('should create APIError with all parameters', () => {
      const error = new APIError('Unauthorized', true, 401, 'AUTH_REQUIRED')
      expect(error.message).toBe('Unauthorized')
      expect(error.isAuthError).toBe(true)
      expect(error.status).toBe(401)
      expect(error.code).toBe('AUTH_REQUIRED')
      expect(error.name).toBe('APIError')
    })

    it('should set isAuthError to false by default', () => {
      const error = new APIError('Test')
      expect(error.isAuthError).toBe(false)
    })

    it('should leave status undefined if not provided', () => {
      const error = new APIError('Test')
      expect(error.status).toBeUndefined()
    })

    it('should leave code undefined if not provided', () => {
      const error = new APIError('Test')
      expect(error.code).toBeUndefined()
    })

    it('should be throwable', () => {
      expect(() => {
        throw new APIError('Test error')
      }).toThrow(APIError)
    })

    it('should preserve error stack trace', () => {
      const error = new APIError('Test error')
      expect(error.stack).toBeDefined()
      expect(typeof error.stack).toBe('string')
    })
  })

  describe('isAPIError type guard', () => {
    it('should return true for APIError instance', () => {
      const error = new APIError('Test')
      expect(APIError.isAPIError(error)).toBe(true)
    })

    it('should return true for APIError with all fields', () => {
      const error = new APIError('Test', true, 500, 'SERVER_ERROR')
      expect(APIError.isAPIError(error)).toBe(true)
    })

    it('should return false for regular Error', () => {
      const error = new Error('Test')
      expect(APIError.isAPIError(error)).toBe(false)
    })

    it('should return false for TypeError', () => {
      const error = new TypeError('Test')
      expect(APIError.isAPIError(error)).toBe(false)
    })

    it('should return false for string', () => {
      expect(APIError.isAPIError('error string')).toBe(false)
    })

    it('should return false for null', () => {
      expect(APIError.isAPIError(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(APIError.isAPIError(undefined)).toBe(false)
    })

    it('should return false for number', () => {
      expect(APIError.isAPIError(404)).toBe(false)
    })

    it('should return false for object', () => {
      expect(APIError.isAPIError({ message: 'error' })).toBe(false)
    })

    it('should return false for plain object with APIError properties', () => {
      const fakeError = {
        message: 'test',
        name: 'APIError',
        isAuthError: false
      }
      expect(APIError.isAPIError(fakeError)).toBe(false)
    })

    it('should work in try-catch blocks', () => {
      try {
        throw new APIError('Test error', true)
      } catch (err) {
        expect(APIError.isAPIError(err)).toBe(true)
        if (APIError.isAPIError(err)) {
          expect(err.isAuthError).toBe(true)
        }
      }
    })
  })

  describe('fromError static method', () => {
    describe('converting APIError', () => {
      it('should return same instance if already APIError', () => {
        const original = new APIError('Test', true, 401)
        const converted = APIError.fromError(original)
        expect(converted).toBe(original)
        expect(converted.message).toBe('Test')
        expect(converted.isAuthError).toBe(true)
        expect(converted.status).toBe(401)
      })

      it('should preserve all properties when returning existing APIError', () => {
        const original = new APIError('Test', false, 500, 'SERVER_ERROR')
        const converted = APIError.fromError(original)
        expect(converted).toBe(original)
        expect(converted.code).toBe('SERVER_ERROR')
      })
    })

    describe('converting regular Error', () => {
      it('should convert Error to APIError', () => {
        const error = new Error('Regular error')
        const converted = APIError.fromError(error)
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('Regular error')
        expect(converted.isAuthError).toBe(false)
      })

      it('should convert Error with auth flag', () => {
        const error = new Error('Auth error')
        const converted = APIError.fromError(error, true)
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('Auth error')
        expect(converted.isAuthError).toBe(true)
      })

      it('should convert TypeError', () => {
        const error = new TypeError('Type error')
        const converted = APIError.fromError(error)
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('Type error')
      })

      it('should convert RangeError', () => {
        const error = new RangeError('Range error')
        const converted = APIError.fromError(error)
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('Range error')
      })

      it('should preserve error message from Error', () => {
        const error = new Error('Detailed error message')
        const converted = APIError.fromError(error)
        expect(converted.message).toBe('Detailed error message')
      })
    })

    describe('converting non-Error values', () => {
      it('should convert string to APIError', () => {
        const converted = APIError.fromError('String error')
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('String error')
        expect(converted.isAuthError).toBe(false)
      })

      it('should convert number to APIError', () => {
        const converted = APIError.fromError(404)
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('404')
      })

      it('should convert null to APIError', () => {
        const converted = APIError.fromError(null)
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('null')
      })

      it('should convert undefined to APIError', () => {
        const converted = APIError.fromError(undefined)
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('undefined')
      })

      it('should convert boolean to APIError', () => {
        const converted = APIError.fromError(false)
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('false')
      })

      it('should convert object to APIError', () => {
        const obj = { error: 'test' }
        const converted = APIError.fromError(obj)
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('[object Object]')
      })

      it('should convert array to APIError', () => {
        const converted = APIError.fromError(['error', 'array'])
        expect(converted).toBeInstanceOf(APIError)
        expect(typeof converted.message).toBe('string')
      })

      it('should convert string with auth flag', () => {
        const converted = APIError.fromError('Auth failed', true)
        expect(converted.isAuthError).toBe(true)
        expect(converted.message).toBe('Auth failed')
      })
    })

    describe('edge cases', () => {
      it('should handle empty string', () => {
        const converted = APIError.fromError('')
        expect(converted).toBeInstanceOf(APIError)
        expect(converted.message).toBe('')
      })

      it('should handle Error with empty message', () => {
        const error = new Error('')
        const converted = APIError.fromError(error)
        expect(converted.message).toBe('')
      })

      it('should handle very long error message', () => {
        const longMessage = 'error '.repeat(1000)
        const error = new Error(longMessage)
        const converted = APIError.fromError(error)
        expect(converted.message).toBe(longMessage)
      })

      it('should handle Error with special characters', () => {
        const error = new Error('Error: 💥 Something went wrong! @#$%')
        const converted = APIError.fromError(error)
        expect(converted.message).toContain('💥')
      })

      it('should handle symbol', () => {
        const sym = Symbol('test')
        const converted = APIError.fromError(sym as any)
        expect(converted).toBeInstanceOf(APIError)
        expect(typeof converted.message).toBe('string')
      })
    })
  })

  describe('integration scenarios', () => {
    it('should handle typical API error flow', () => {
      try {
        throw new APIError('Unauthorized', true, 401, 'AUTH_REQUIRED')
      } catch (err) {
        expect(APIError.isAPIError(err)).toBe(true)
        if (APIError.isAPIError(err)) {
          expect(err.isAuthError).toBe(true)
          expect(err.status).toBe(401)
          expect(err.code).toBe('AUTH_REQUIRED')
        }
      }
    })

    it('should handle converting caught errors', () => {
      try {
        JSON.parse('invalid json')
      } catch (err) {
        const apiError = APIError.fromError(err)
        expect(apiError).toBeInstanceOf(APIError)
        expect(apiError.message).toContain('JSON')
      }
    })

    it('should handle error propagation', () => {
      function throwAPIError() {
        throw new APIError('Network error', false, 500, 'NETWORK_ERROR')
      }

      try {
        throwAPIError()
      } catch (err) {
        expect(APIError.isAPIError(err)).toBe(true)
        if (APIError.isAPIError(err)) {
          expect(err.code).toBe('NETWORK_ERROR')
        }
      }
    })

    it('should handle unknown error types in catch block', () => {
      try {
        throw 'string error'
      } catch (err) {
        const apiError = APIError.fromError(err)
        expect(apiError.message).toBe('string error')
      }
    })

    it('should differentiate between auth and non-auth errors', () => {
      const authError = new APIError('Token expired', true, 401)
      const networkError = new APIError('Connection failed', false, 500)

      expect(authError.isAuthError).toBe(true)
      expect(networkError.isAuthError).toBe(false)
    })

    it('should work with error instanceof checks', () => {
      const apiError = new APIError('Test')
      expect(apiError instanceof Error).toBe(true)
      expect(apiError instanceof APIError).toBe(true)
    })

    it('should maintain error chain with fromError', () => {
      const originalError = new Error('Original')
      const apiError = APIError.fromError(originalError)
      expect(apiError.message).toBe(originalError.message)
    })

    it('should handle re-throwing as APIError', () => {
      function innerFunction() {
        throw new Error('Inner error')
      }

      function outerFunction() {
        try {
          innerFunction()
        } catch (err) {
          throw APIError.fromError(err, true)
        }
      }

      expect(() => outerFunction()).toThrow(APIError)

      try {
        outerFunction()
      } catch (err) {
        if (APIError.isAPIError(err)) {
          expect(err.isAuthError).toBe(true)
          expect(err.message).toBe('Inner error')
        }
      }
    })
  })

  describe('property access', () => {
    it('should allow reading all properties', () => {
      const error = new APIError('Test', true, 404, 'NOT_FOUND')

      expect(error.message).toBe('Test')
      expect(error.isAuthError).toBe(true)
      expect(error.status).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
      expect(error.name).toBe('APIError')
    })

    it('should have readonly properties', () => {
      const error = new APIError('Test', false, 500, 'ERROR')

      expect(error.isAuthError).toBe(false)
      expect(error.status).toBe(500)
      expect(error.code).toBe('ERROR')
    })
  })

  describe('error serialization', () => {
    it('should convert to string', () => {
      const error = new APIError('Test error')
      const str = String(error)
      expect(str).toContain('Test error')
    })

    it('should have toString method', () => {
      const error = new APIError('Test error')
      expect(typeof error.toString).toBe('function')
      expect(error.toString()).toContain('Test error')
    })

    it('should work with JSON.stringify on basic properties', () => {
      const error = new APIError('Test', true, 404, 'NOT_FOUND')
      const json = JSON.stringify({
        message: error.message,
        isAuthError: error.isAuthError,
        status: error.status,
        code: error.code
      })
      expect(json).toContain('Test')
      expect(json).toContain('404')
      expect(json).toContain('NOT_FOUND')
    })
  })
})
