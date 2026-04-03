import { ExtensionHttpClient, AuthExpiredError } from '../absmartly-client'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { unsafeAPIEndpoint } from '~src/types/branded'

jest.mock('~src/lib/api-retry', () => ({
  withNetworkRetry: jest.fn(async (fn: () => Promise<any>) => fn()),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('ExtensionHttpClient', () => {
  const apiKeyConfig: ABsmartlyConfig = {
    apiEndpoint: unsafeAPIEndpoint('https://api.absmartly.com/v1'),
    apiKey: 'test-api-key',
    authMethod: 'apikey'
  }

  const jwtApiKeyConfig: ABsmartlyConfig = {
    apiEndpoint: unsafeAPIEndpoint('https://api.absmartly.com/v1'),
    apiKey: 'header.payload.signature',
    authMethod: 'apikey'
  }

  const jwtCookieConfig: ABsmartlyConfig = {
    apiEndpoint: unsafeAPIEndpoint('https://api.absmartly.com/v1'),
    authMethod: 'jwt'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getBaseUrl', () => {
    it('should normalize endpoint to /v1', () => {
      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', apiKeyConfig)
      expect(client.getBaseUrl()).toBe('https://api.absmartly.com/v1')
    })

    it('should add /v1 if missing', () => {
      const client = new ExtensionHttpClient('https://api.absmartly.com', apiKeyConfig)
      expect(client.getBaseUrl()).toBe('https://api.absmartly.com/v1')
    })

    it('should strip trailing slashes', () => {
      const client = new ExtensionHttpClient('https://api.absmartly.com///', apiKeyConfig)
      expect(client.getBaseUrl()).toBe('https://api.absmartly.com/v1')
    })
  })

  describe('request - auth headers', () => {
    it('should set Api-Key header for apikey auth', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', apiKeyConfig)
      await client.request({ method: 'GET', url: 'https://api.absmartly.com/v1/experiments' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.absmartly.com/v1/experiments',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Api-Key test-api-key'
          })
        })
      )
    })

    it('should set JWT header for JWT-format API key', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', jwtApiKeyConfig)
      await client.request({ method: 'GET', url: 'https://api.absmartly.com/v1/experiments' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'JWT header.payload.signature'
          })
        })
      )
    })

    it('should not set Authorization header for JWT cookie auth', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', jwtCookieConfig)
      await client.request({ method: 'GET', url: 'https://api.absmartly.com/v1/experiments' })

      const headers = mockFetch.mock.calls[0][1].headers
      expect(headers).not.toHaveProperty('Authorization')
    })

    it('should set credentials: include for cookie auth', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', jwtCookieConfig)
      await client.request({ method: 'GET', url: 'https://api.absmartly.com/v1/experiments' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })

  describe('request - status code handling', () => {
    it('should throw AuthExpiredError on 401', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', apiKeyConfig)

      await expect(client.request({
        method: 'GET',
        url: 'https://api.absmartly.com/v1/experiments'
      })).rejects.toThrow(AuthExpiredError)
    })

    it('should throw AuthExpiredError on 403', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', apiKeyConfig)

      await expect(client.request({
        method: 'GET',
        url: 'https://api.absmartly.com/v1/experiments'
      })).rejects.toThrow(AuthExpiredError)
    })

    it('should throw AuthExpiredError even with non-JSON 401 body', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => { throw new SyntaxError('Unexpected token <') },
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', apiKeyConfig)

      await expect(client.request({
        method: 'GET',
        url: 'https://api.absmartly.com/v1/experiments'
      })).rejects.toThrow(AuthExpiredError)
    })

    it('should throw on non-2xx responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', apiKeyConfig)

      await expect(client.request({
        method: 'GET',
        url: 'https://api.absmartly.com/v1/experiments'
      })).rejects.toThrow('API request failed with status 500')
    })

    it('should throw descriptive error for non-JSON response body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token <') },
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', apiKeyConfig)

      await expect(client.request({
        method: 'GET',
        url: 'https://api.absmartly.com/v1/experiments'
      })).rejects.toThrow('API returned non-JSON response (status 200)')
    })
  })

  describe('request - query params', () => {
    it('should append params to URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', apiKeyConfig)
      await client.request({
        method: 'GET',
        url: 'https://api.absmartly.com/v1/experiments',
        params: { state: 'running', items: 50 }
      })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain('state=running')
      expect(calledUrl).toContain('items=50')
    })

    it('should skip undefined and null params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Map()
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', apiKeyConfig)
      await client.request({
        method: 'GET',
        url: 'https://api.absmartly.com/v1/experiments',
        params: { state: 'running', limit: undefined as any, offset: undefined as any }
      })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain('state=running')
      expect(calledUrl).not.toContain('limit')
      expect(calledUrl).not.toContain('offset')
    })
  })

  describe('request - successful response', () => {
    it('should return parsed response with status, data, and headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ experiments: [] }),
        headers: new Map([['content-type', 'application/json']])
      })

      const client = new ExtensionHttpClient('https://api.absmartly.com/v1', apiKeyConfig)
      const response = await client.request({
        method: 'GET',
        url: 'https://api.absmartly.com/v1/experiments'
      })

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ experiments: [] })
      expect(response.headers).toBeDefined()
    })
  })
})
