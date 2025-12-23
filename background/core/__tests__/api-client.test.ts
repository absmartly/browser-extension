import axios from 'axios'
import {
  isAuthError,
  getJWTCookie,
  makeAPIRequest,
  validateAPIRequest,
  openLoginPage
} from '../api-client'
import type { ABsmartlyConfig } from '~src/types/absmartly'

jest.mock('axios')
jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

const mockChrome = {
  cookies: {
    getAll: jest.fn()
  },
  tabs: {
    create: jest.fn()
  }
}

global.chrome = mockChrome as any

describe('api-client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('isAuthError', () => {
    it('should return true for 401 status', () => {
      const error = { response: { status: 401 } }
      expect(isAuthError(error)).toBe(true)
    })

    it('should return true for 403 status', () => {
      const error = { response: { status: 403 } }
      expect(isAuthError(error)).toBe(true)
    })

    it('should return false for 404 status', () => {
      const error = { response: { status: 404 } }
      expect(isAuthError(error)).toBe(false)
    })

    it('should return false for 500 status', () => {
      const error = { response: { status: 500 } }
      expect(isAuthError(error)).toBe(false)
    })

    it('should return false for errors without response', () => {
      const error = { message: 'Network error' }
      expect(isAuthError(error)).toBe(false)
    })
  })

  describe('getJWTCookie', () => {
    it('should find JWT cookie by exact name "jwt"', async () => {
      mockChrome.cookies.getAll.mockResolvedValue([
        { name: 'jwt', value: 'header.payload.signature', domain: '.absmartly.com' }
      ])

      const token = await getJWTCookie('https://api.absmartly.com')
      expect(token).toBe('header.payload.signature')
    })

    it('should NOT find cookie by name "JWT" (only lowercase jwt is supported)', async () => {
      mockChrome.cookies.getAll.mockResolvedValue([
        { name: 'JWT', value: 'header.payload.signature', domain: '.absmartly.com' }
      ])

      const token = await getJWTCookie('https://api.absmartly.com')
      expect(token).toBeNull()
    })

    it('should NOT find cookie by name "access_token" (only jwt is supported)', async () => {
      mockChrome.cookies.getAll.mockResolvedValue([
        { name: 'access_token', value: 'token123', domain: '.absmartly.com' }
      ])

      const token = await getJWTCookie('https://api.absmartly.com')
      expect(token).toBeNull()
    })

    it('should NOT find cookie by custom name (only jwt is supported)', async () => {
      mockChrome.cookies.getAll.mockResolvedValue([
        { name: 'custom_token', value: 'part1.part2.part3', domain: '.absmartly.com' }
      ])

      const token = await getJWTCookie('https://api.absmartly.com')
      expect(token).toBeNull()
    })

    it('should return null when no JWT cookie is found', async () => {
      mockChrome.cookies.getAll.mockResolvedValue([
        { name: 'session', value: 'abc123', domain: '.absmartly.com' }
      ])

      const token = await getJWTCookie('https://api.absmartly.com')
      expect(token).toBeNull()
    })

    it('should handle invalid domain gracefully', async () => {
      const token = await getJWTCookie('invalid-url')
      expect(token).toBeNull()
    })

    it('should deduplicate cookies from multiple sources', async () => {
      const cookie = { name: 'jwt', value: 'token', domain: '.absmartly.com' }
      mockChrome.cookies.getAll.mockResolvedValue([cookie, cookie, cookie])

      const token = await getJWTCookie('https://api.absmartly.com')
      expect(token).toBe('token')
    })

    it('should handle errors from chrome.cookies API', async () => {
      mockChrome.cookies.getAll.mockRejectedValue(new Error('Cookie API error'))

      const token = await getJWTCookie('https://api.absmartly.com')
      expect(token).toBeNull()
    })
  })

  describe('validateAPIRequest', () => {
    it('should validate GET request', () => {
      const result = validateAPIRequest('GET', '/experiments')
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should validate POST request with data', () => {
      const result = validateAPIRequest('POST', '/experiments', { name: 'Test' })
      expect(result.valid).toBe(true)
    })

    it('should validate all HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']
      for (const method of methods) {
        const result = validateAPIRequest(method, '/test')
        expect(result.valid).toBe(true)
      }
    })

    it('should reject invalid HTTP method', () => {
      const result = validateAPIRequest('INVALID', '/test')
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject empty path', () => {
      const result = validateAPIRequest('GET', '')
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('makeAPIRequest', () => {
    const mockConfig: ABsmartlyConfig = {
      apiEndpoint: 'https://api.absmartly.com/v1',
      apiKey: 'test-api-key',
      authMethod: 'apikey'
    }

    it('should make successful GET request with API key', async () => {
      const mockData = { experiments: [] }
      jest.mocked(axios).mockResolvedValue({ data: mockData })

      const result = await makeAPIRequest('GET', '/experiments', undefined, true, mockConfig)

      expect(result).toEqual(mockData)
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        method: 'GET',
        url: 'https://api.absmartly.com/v1/experiments',
        headers: expect.objectContaining({
          'Authorization': 'Api-Key test-api-key'
        })
      }))
    })

    it('should make successful POST request with data', async () => {
      const postData = { name: 'New Experiment' }
      const mockResponse = { id: 123, ...postData }
      jest.mocked(axios).mockResolvedValue({ data: mockResponse })

      const result = await makeAPIRequest('POST', '/experiments', postData, true, mockConfig)

      expect(result).toEqual(mockResponse)
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        url: 'https://api.absmartly.com/v1/experiments',
        data: postData
      }))
    })

    it('should convert GET request data to query parameters', async () => {
      const queryData = { state: 'running', limit: 10 }
      jest.mocked(axios).mockResolvedValue({ data: [] })

      await makeAPIRequest('GET', '/experiments', queryData, true, mockConfig)

      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://api.absmartly.com/v1/experiments?state=running&limit=10'
      }))
    })

    it('should use JWT authentication when authMethod is jwt', async () => {
      const jwtConfig: ABsmartlyConfig = {
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'jwt'
      }

      mockChrome.cookies.getAll.mockResolvedValue([
        { name: 'jwt', value: 'header.payload.signature', domain: '.absmartly.com' }
      ])

      jest.mocked(axios).mockResolvedValue({ data: {} })

      await makeAPIRequest('GET', '/auth/current-user', undefined, true, jwtConfig)

      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'JWT header.payload.signature'
        })
      }))
    })

    it('should use JWT prefix for all JWT tokens', async () => {
      const jwtConfig: ABsmartlyConfig = {
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'jwt'
      }

      mockChrome.cookies.getAll.mockResolvedValue([
        { name: 'jwt', value: 'not-a-jwt-token', domain: '.absmartly.com' }
      ])

      jest.mocked(axios).mockResolvedValue({ data: {} })

      await makeAPIRequest('GET', '/auth/current-user', undefined, true, jwtConfig)

      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'JWT not-a-jwt-token'
        })
      }))
    })

    it('should throw AUTH_EXPIRED on 401 error', async () => {
      jest.mocked(axios).mockRejectedValue({
        response: { status: 401, data: {} }
      })

      mockChrome.cookies.getAll.mockResolvedValue([])

      await expect(makeAPIRequest('GET', '/experiments', undefined, true, mockConfig)).rejects.toThrow('AUTH_EXPIRED')
    })

    it('should throw AUTH_EXPIRED when API key fails with 401', async () => {
      const jwtToken = 'header.payload.signature'
      mockChrome.cookies.getAll.mockResolvedValue([
        { name: 'jwt', value: jwtToken, domain: '.absmartly.com' }
      ])

      jest.mocked(axios).mockRejectedValue({ response: { status: 401 } })

      // No retries - auth failures throw AUTH_EXPIRED immediately
      await expect(makeAPIRequest('GET', '/experiments', undefined, true, mockConfig)).rejects.toThrow('AUTH_EXPIRED')
      expect(axios).toHaveBeenCalledTimes(1)
    })

    it('should throw AUTH_EXPIRED when JWT fails with 401', async () => {
      const jwtConfig: ABsmartlyConfig = {
        apiEndpoint: 'https://api.absmartly.com',
        apiKey: 'backup-api-key',
        authMethod: 'jwt'
      }

      mockChrome.cookies.getAll.mockResolvedValue([
        { name: 'jwt', value: 'expired.jwt.token', domain: '.absmartly.com' }
      ])

      jest.mocked(axios).mockRejectedValue({ response: { status: 401 } })

      // No retries - auth failures throw AUTH_EXPIRED immediately
      await expect(makeAPIRequest('GET', '/experiments', undefined, true, jwtConfig)).rejects.toThrow('AUTH_EXPIRED')
      expect(axios).toHaveBeenCalledTimes(1)
    })

    it('should not retry when retryWithJWT is false', async () => {
      jest.mocked(axios).mockRejectedValue({ response: { status: 401 } })

      await expect(makeAPIRequest('GET', '/experiments', undefined, false, mockConfig)).rejects.toThrow('AUTH_EXPIRED')
      expect(axios).toHaveBeenCalledTimes(1)
    })

    it('should throw original error for non-auth errors', async () => {
      const networkError = new Error('Network timeout')
      mockChrome.cookies.getAll.mockResolvedValue([])
      jest.mocked(axios).mockRejectedValue(networkError)

      await expect(makeAPIRequest('GET', '/experiments', undefined, true, mockConfig)).rejects.toThrow('Network timeout')
    })

    it('should throw error when no API endpoint is configured', async () => {
      const invalidConfig = { apiEndpoint: '' } as ABsmartlyConfig

      await expect(makeAPIRequest('GET', '/experiments', undefined, true, invalidConfig)).rejects.toThrow('No API endpoint configured')
    })

    it('should clean up API endpoint with trailing slashes', async () => {
      const configWithSlash: ABsmartlyConfig = {
        apiEndpoint: 'https://api.absmartly.com///',
        apiKey: 'test-key',
        authMethod: 'apikey'
      }

      jest.mocked(axios).mockResolvedValue({ data: {} })

      await makeAPIRequest('GET', '/experiments', undefined, true, configWithSlash)

      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://api.absmartly.com/v1/experiments'
      }))
    })

    it('should add /v1 to endpoint if not present', async () => {
      const configNoV1: ABsmartlyConfig = {
        apiEndpoint: 'https://api.absmartly.com',
        apiKey: 'test-key',
        authMethod: 'apikey'
      }

      jest.mocked(axios).mockResolvedValue({ data: {} })

      await makeAPIRequest('GET', '/experiments', undefined, true, configNoV1)

      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://api.absmartly.com/v1/experiments'
      }))
    })

    it('should handle path without leading slash', async () => {
      jest.mocked(axios).mockResolvedValue({ data: {} })

      await makeAPIRequest('GET', 'experiments', undefined, true, mockConfig)

      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        url: expect.stringMatching(/\/experiments$/)
      }))
    })

    it('should filter out undefined and null query parameters', async () => {
      const queryData = {
        state: 'running',
        limit: undefined,
        offset: null,
        search: 'test'
      }

      jest.mocked(axios).mockResolvedValue({ data: [] })

      await makeAPIRequest('GET', '/experiments', queryData, true, mockConfig)

      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://api.absmartly.com/v1/experiments?state=running&search=test'
      }))
    })
  })

  describe('openLoginPage', () => {
    it('should open login page when config is valid', async () => {
      const config: ABsmartlyConfig = {
        apiEndpoint: 'https://api.absmartly.com/v1',
        authMethod: 'jwt'
      }

      mockChrome.cookies.getAll.mockResolvedValue([])
      jest.mocked(axios).mockRejectedValue({ response: { status: 401 } })

      const result = await openLoginPage(config)

      expect(result.authenticated).toBe(false)
      expect(mockChrome.tabs.create).toHaveBeenCalledWith({ url: 'https://api.absmartly.com' })
    })

    it('should not open login page when user is authenticated', async () => {
      const config: ABsmartlyConfig = {
        apiEndpoint: 'https://api.absmartly.com/v1',
        authMethod: 'jwt'
      }

      mockChrome.cookies.getAll.mockResolvedValue([
        { name: 'jwt', value: 'valid.jwt.token', domain: '.absmartly.com' }
      ])
      jest.mocked(axios).mockResolvedValue({ data: { user: {} } })

      const result = await openLoginPage(config)

      expect(result.authenticated).toBe(true)
      expect(mockChrome.tabs.create).not.toHaveBeenCalled()
    })

    it('should return false when no config is provided', async () => {
      const result = await openLoginPage(null)

      expect(result.authenticated).toBe(false)
      expect(mockChrome.tabs.create).not.toHaveBeenCalled()
    })

    it('should strip /v1 from endpoint URL', async () => {
      const config: ABsmartlyConfig = {
        apiEndpoint: 'https://subdomain.api.absmartly.com/v1',
        authMethod: 'jwt'
      }

      mockChrome.cookies.getAll.mockResolvedValue([])
      jest.mocked(axios).mockRejectedValue({ response: { status: 401 } })

      await openLoginPage(config)

      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://subdomain.api.absmartly.com'
      })
    })
  })
})
