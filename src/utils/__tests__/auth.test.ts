import { checkAuthentication, buildAuthFetchOptions } from '../auth'
import { getJWTCookie } from '../cookies'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { setupAuthMocks, mockAuthResponse, mockJWTToken, resetAuthMocks } from '../../../tests/mocks/auth-mocks'
import { unsafeAPIEndpoint } from '~src/types/branded'

jest.mock('../cookies')

describe('Authentication Utils - API Key', () => {
  beforeEach(() => {
    setupAuthMocks()
  })

  afterEach(() => {
    resetAuthMocks()
  })

  it('should authenticate with valid API Key', async () => {
    const config: ABsmartlyConfig = {
      apiKey: 'test-api-key-12345',
      apiEndpoint: unsafeAPIEndpoint('https://demo-2.absmartly.com/v1'),
      authMethod: 'apikey'
    }

    const result = await checkAuthentication(config)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data.user).toBeDefined()
    expect(result.data.user.id).toBeDefined()
    expect(result.data.user.email).toBeDefined()
  })

  it('should fail with invalid API Key', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' })
    } as Response)

    const config: ABsmartlyConfig = {
      apiKey: 'invalid-api-key-12345',
      apiEndpoint: unsafeAPIEndpoint('https://demo-2.absmartly.com/v1'),
      authMethod: 'apikey'
    }

    const result = await checkAuthentication(config)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should fail with no authentication', async () => {
    const config: ABsmartlyConfig = {
      apiKey: '',
      apiEndpoint: unsafeAPIEndpoint('https://demo-2.absmartly.com/v1'),
      authMethod: 'apikey'
    }

    const result = await checkAuthentication(config)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('No API key configured')
  })

  it('should handle missing endpoint', async () => {
    const config: ABsmartlyConfig = {
      apiKey: 'test-api-key',
      apiEndpoint: unsafeAPIEndpoint(''),
      authMethod: 'apikey'
    }

    const result = await checkAuthentication(config)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('endpoint')
  })

  it('should handle network errors gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const config: ABsmartlyConfig = {
      apiKey: 'test-api-key',
      apiEndpoint: unsafeAPIEndpoint('https://invalid-domain-that-does-not-exist-12345.com/v1'),
      authMethod: 'apikey'
    }

    const result = await checkAuthentication(config)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('Authentication Utils - JWT', () => {
  beforeEach(() => {
    setupAuthMocks()
    ;(getJWTCookie as jest.Mock).mockResolvedValue(mockJWTToken)
  })

  afterEach(() => {
    resetAuthMocks()
  })

  it('should authenticate with JWT cookie', async () => {
    const config: ABsmartlyConfig = {
      apiEndpoint: unsafeAPIEndpoint('https://demo-2.absmartly.com/v1'),
      authMethod: 'jwt'
    }

    const result = await checkAuthentication(config)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data.user).toBeDefined()
    expect(result.data.user.email).toBe('test@example.com')
  })

  it('should fail when JWT cookie is missing', async () => {
    ;(getJWTCookie as jest.Mock).mockResolvedValue(null)

    const config: ABsmartlyConfig = {
      apiEndpoint: unsafeAPIEndpoint('https://demo-2.absmartly.com/v1'),
      authMethod: 'jwt'
    }

    const result = await checkAuthentication(config)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No JWT token available')
  })

  it('should extract JWT cookie from browser', async () => {
    const jwt = await getJWTCookie('https://demo-2.absmartly.com')

    expect(jwt).toBe(mockJWTToken)
    expect(jwt).toContain('.')
    expect(jwt.split('.').length).toBe(3)
  })
})

describe('buildAuthFetchOptions', () => {
  it('should build options for API key auth', () => {
    const config: ABsmartlyConfig = {
      apiKey: 'test-api-key',
      apiEndpoint: unsafeAPIEndpoint('https://demo-2.absmartly.com/v1'),
      authMethod: 'apikey'
    }

    const options = buildAuthFetchOptions('apikey', config, null, false)

    expect(options.credentials).toBe('omit')
    expect(options.headers).toHaveProperty('Authorization')
    expect(options.headers['Authorization']).toContain('Api-Key')
  })

  it('should build options for JWT auth with cookie', () => {
    const config: ABsmartlyConfig = {
      apiEndpoint: unsafeAPIEndpoint('https://demo-2.absmartly.com/v1'),
      authMethod: 'jwt'
    }

    const options = buildAuthFetchOptions('jwt', config, mockJWTToken, false)

    expect(options.credentials).toBe('include')
  })

  it('should build options for JWT auth with header', () => {
    const config: ABsmartlyConfig = {
      apiEndpoint: unsafeAPIEndpoint('https://demo-2.absmartly.com/v1'),
      authMethod: 'jwt'
    }

    const options = buildAuthFetchOptions('jwt', config, mockJWTToken, true)

    expect(options.credentials).toBe('omit')
    expect(options.headers).toHaveProperty('Authorization')
    expect(options.headers['Authorization']).toContain('JWT')
  })
})
