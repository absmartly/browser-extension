import {
  isBlockedHost,
  handleAvatarFetch,
  handleFetchEvent,
  initializeAvatarProxy
} from '../avatar-proxy'

jest.mock('~src/utils/debug', () => ({
  debugError: jest.fn(),
  debugLog: jest.fn()
}))

jest.mock('~src/utils/auth', () => ({
  buildAuthFetchOptions: jest.fn((authMethod, config, jwtToken, useAuthHeader) => {
    const options: any = {
      method: 'GET',
      headers: {}
    }
    if (authMethod === 'jwt') {
      if (useAuthHeader && jwtToken) {
        options.credentials = 'omit'
        options.headers['Authorization'] = `JWT ${jwtToken}`
      } else {
        options.credentials = 'include'
      }
    } else if (authMethod === 'apikey' && config.apiKey) {
      options.credentials = 'omit'
      options.headers['Authorization'] = `Api-Key ${config.apiKey}`
    }
    return options
  })
}))

jest.mock('../../core/api-client', () => ({
  getJWTCookie: jest.fn()
}))

jest.mock('@plasmohq/storage', () => {
  const mockRegularStorage = {
    get: jest.fn(),
    set: jest.fn()
  }

  const mockSecureStorage = {
    get: jest.fn(),
    set: jest.fn()
  }

  return {
    Storage: jest.fn().mockImplementation((options?: any) => {
      if (options?.secretKeyring) {
        return mockSecureStorage
      }
      return mockRegularStorage
    }),
    __mockStorageInstances: {
      regular: mockRegularStorage,
      secure: mockSecureStorage
    }
  }
})

import { getJWTCookie } from '../../core/api-client'

const { __mockStorageInstances: mockStorageInstances } = jest.requireMock('@plasmohq/storage')

class MockResponse {
  status: number
  headers: any
  private _body: any

  constructor(body: any, init?: { status?: number; headers?: Record<string, string> }) {
    this._body = body
    this.status = init?.status || 200
    const headerMap = new Map(Object.entries(init?.headers || {}))
    this.headers = {
      get: (name: string) => headerMap.get(name) || null,
      set: (name: string, value: string) => headerMap.set(name, value),
      has: (name: string) => headerMap.has(name),
      entries: () => headerMap.entries()
    }
  }

  async text(): Promise<string> {
    if (typeof this._body === 'string') return this._body
    if (this._body instanceof Blob) {
      return await this._body.text()
    }
    return String(this._body)
  }

  async blob(): Promise<Blob> {
    if (this._body instanceof Blob) return this._body
    return new Blob([this._body])
  }

  clone(): MockResponse {
    const headerObj: Record<string, string> = {}
    for (const [key, value] of this.headers.entries()) {
      headerObj[key] = value
    }
    return new MockResponse(this._body, {
      status: this.status,
      headers: headerObj
    })
  }

  get ok(): boolean {
    return this.status >= 200 && this.status < 300
  }
}

class MockRequest {
  url: string
  method: string

  constructor(url: string, init?: { method?: string }) {
    this.url = url
    this.method = init?.method || 'GET'
  }
}

describe('AvatarProxy', () => {
  let mockCaches: any
  let mockFetch: jest.Mock
  let mockChrome: any

  beforeEach(() => {
    global.Response = MockResponse as any
    global.Request = MockRequest as any

    mockCaches = {
      open: jest.fn(),
      match: jest.fn(),
      put: jest.fn()
    }

    mockFetch = jest.fn()
    global.fetch = mockFetch
    global.caches = mockCaches as any
    global.console.log = jest.fn()
    global.console.error = jest.fn()

    mockChrome = {
      runtime: {
        id: 'test-extension-id'
      }
    }
    global.chrome = mockChrome as any

    jest.clearAllMocks()
  })

  describe('isBlockedHost', () => {
    it('should block localhost', () => {
      expect(isBlockedHost('localhost')).toBe(true)
    })

    it('should block 127.0.0.1', () => {
      expect(isBlockedHost('127.0.0.1')).toBe(true)
    })

    it('should block 0.0.0.0', () => {
      expect(isBlockedHost('0.0.0.0')).toBe(true)
    })

    it('should block private network ranges', () => {
      expect(isBlockedHost('192.168.1.1')).toBe(true)
      expect(isBlockedHost('10.0.0.1')).toBe(true)
      expect(isBlockedHost('172.16.0.1')).toBe(true)
      expect(isBlockedHost('172.31.255.255')).toBe(true)
    })

    it('should allow public domains', () => {
      expect(isBlockedHost('example.com')).toBe(false)
      expect(isBlockedHost('absmartly.com')).toBe(false)
      expect(isBlockedHost('cdn.example.com')).toBe(false)
    })
  })

  describe('handleAvatarFetch', () => {
    beforeEach(() => {
      mockCaches.open.mockResolvedValue({
        match: mockCaches.match,
        put: mockCaches.put
      })
      mockCaches.match.mockResolvedValue(null)
      mockCaches.put.mockResolvedValue(undefined)
    })

    it('should block SSRF attempts', async () => {
      const response = await handleAvatarFetch(
        'https://localhost/avatar.png',
        'jwt'
      )

      expect(response.status).toBe(403)
      const text = await response.text()
      expect(text).toBe('Access to internal network addresses is blocked')
    })

    it('should return cached avatar if available', async () => {
      const mockCachedResponse = new Response(new Blob(['cached']), {
        status: 200,
        headers: { 'Content-Type': 'image/png' }
      })
      mockCaches.match.mockResolvedValue(mockCachedResponse)

      const response = await handleAvatarFetch(
        'https://cdn.example.com/avatar.png',
        'jwt'
      )

      expect(response).toBe(mockCachedResponse)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should fetch avatar with JWT authentication', async () => {
      mockStorageInstances.regular.get.mockResolvedValue({
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'jwt'
      })
      mockStorageInstances.secure.get.mockResolvedValue(null)
      ;(getJWTCookie as jest.Mock).mockResolvedValue('test-jwt-token')

      const mockBlob = new Blob(['avatar-data'])
      const mockFetchResponse = new MockResponse(mockBlob, {
        status: 200,
        headers: { 'content-type': 'image/png' }
      })
      mockFetch.mockResolvedValue(mockFetchResponse)

      const response = await handleAvatarFetch(
        'https://cdn.example.com/avatar.png',
        'jwt'
      )

      expect(response.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdn.example.com/avatar.png',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'image/*'
          })
        })
      )
      expect(mockCaches.put).toHaveBeenCalled()
    })

    it('should fetch avatar with API key authentication', async () => {
      mockStorageInstances.regular.get.mockResolvedValue({
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'apikey',
        apiKey: 'test-api-key'
      })
      mockStorageInstances.secure.get.mockResolvedValue('test-api-key')

      const mockBlob = new Blob(['avatar-data'])
      const mockFetchResponse = new MockResponse(mockBlob, {
        status: 200,
        headers: { 'content-type': 'image/jpeg' }
      })
      mockFetch.mockResolvedValue(mockFetchResponse)

      const response = await handleAvatarFetch(
        'https://cdn.example.com/avatar.jpg',
        'apikey'
      )

      expect(response.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdn.example.com/avatar.jpg',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'image/*',
            'Authorization': 'Api-Key test-api-key'
          })
        })
      )
    })


    it('should handle fetch failure', async () => {
      mockStorageInstances.regular.get.mockResolvedValue({
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'jwt'
      })
      mockStorageInstances.secure.get.mockResolvedValue(null)
      ;(getJWTCookie as jest.Mock).mockResolvedValue('test-jwt-token')

      const mockFetchResponse = new MockResponse('Not found', {
        status: 404
      })
      mockFetch.mockResolvedValue(mockFetchResponse)

      const response = await handleAvatarFetch(
        'https://cdn.example.com/avatar.png',
        'jwt'
      )

      expect(response.status).toBe(404)
      const text = await response.text()
      expect(text).toBe('Avatar fetch failed')
    })

    it('should handle missing endpoint configuration', async () => {
      mockStorageInstances.regular.get.mockResolvedValue(null)

      const response = await handleAvatarFetch(
        'https://cdn.example.com/avatar.png',
        'jwt'
      )

      expect(response.status).toBe(500)
      const text = await response.text()
      expect(text).toBe('No endpoint configured')
    })

    it('should handle exceptions during fetch', async () => {
      mockStorageInstances.regular.get.mockResolvedValue({
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'jwt'
      })
      mockStorageInstances.secure.get.mockResolvedValue(null)
      ;(getJWTCookie as jest.Mock).mockResolvedValue('test-jwt-token')

      const mockError = new Error('Network error')
      mockFetch.mockRejectedValue(mockError)

      const response = await handleAvatarFetch(
        'https://cdn.example.com/avatar.png',
        'jwt'
      )

      expect(response.status).toBe(500)
      const text = await response.text()
      expect(text).toContain('Avatar proxy error')
      expect(text).toContain('Network error')
    })

    it('should cache successful avatar fetches', async () => {
      mockStorageInstances.regular.get.mockResolvedValue({
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'jwt'
      })
      mockStorageInstances.secure.get.mockResolvedValue(null)
      ;(getJWTCookie as jest.Mock).mockResolvedValue('test-jwt-token')

      const mockBlob = new Blob(['avatar-data'], { type: 'image/png' })
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => name === 'content-type' ? 'image/png' : null
        },
        blob: () => Promise.resolve(mockBlob)
      })

      await handleAvatarFetch(
        'https://cdn.example.com/avatar.png',
        'jwt'
      )

      expect(mockCaches.put).toHaveBeenCalledWith(
        expect.any(Request),
        expect.objectContaining({
          status: 200
        })
      )
    })

    it('should set appropriate cache headers with restricted CORS', async () => {
      mockStorageInstances.regular.get.mockResolvedValue({
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'jwt'
      })
      mockStorageInstances.secure.get.mockResolvedValue(null)
      ;(getJWTCookie as jest.Mock).mockResolvedValue('test-jwt-token')

      const mockBlob = new Blob(['avatar-data'])
      const mockFetchResponse = new MockResponse(mockBlob, {
        status: 200,
        headers: { 'content-type': 'image/png' }
      })
      mockFetch.mockResolvedValue(mockFetchResponse)

      const response = await handleAvatarFetch(
        'https://cdn.example.com/avatar.png',
        'jwt'
      )

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('chrome-extension://test-extension-id')
      expect(response.headers.get('Content-Type')).toBe('image/png')
    })
  })

  describe('handleFetchEvent', () => {
    let mockEvent: any

    beforeEach(() => {
      mockEvent = {
        request: {
          url: ''
        },
        respondWith: jest.fn()
      }
      mockCaches.open.mockResolvedValue({
        match: mockCaches.match,
        put: mockCaches.put
      })
      mockCaches.match.mockResolvedValue(null)
    })

    it('should intercept /api/avatar requests', () => {
      mockEvent.request.url = 'chrome-extension://test-id/api/avatar?url=https://example.com/avatar.png'

      handleFetchEvent(mockEvent)

      expect(mockEvent.respondWith).toHaveBeenCalledWith(expect.any(Promise))
    })

    it('should not intercept non-avatar requests', () => {
      mockEvent.request.url = 'chrome-extension://test-id/other-path'

      handleFetchEvent(mockEvent)

      expect(mockEvent.respondWith).not.toHaveBeenCalled()
    })

    it('should extract URL parameters correctly', async () => {
      mockStorageInstances.regular.get.mockResolvedValue({
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'jwt'
      })
      mockStorageInstances.secure.get.mockResolvedValue(null)
      ;(getJWTCookie as jest.Mock).mockResolvedValue('test-jwt-token')

      const mockBlob = new Blob(['avatar-data'])
      const mockFetchResponse = new MockResponse(mockBlob, {
        status: 200,
        headers: { 'content-type': 'image/png' }
      })
      mockFetch.mockResolvedValue(mockFetchResponse)

      mockEvent.request.url = 'chrome-extension://test-id/api/avatar?url=https://example.com/avatar.png&authMethod=jwt'

      handleFetchEvent(mockEvent)

      const responsePromise = mockEvent.respondWith.mock.calls[0][0]
      await responsePromise

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/avatar.png',
        expect.any(Object)
      )
    })

    it('should use apikey auth method from URL params', async () => {
      mockStorageInstances.regular.get.mockResolvedValue({
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'apikey',
        apiKey: 'stored-key'
      })
      mockStorageInstances.secure.get.mockResolvedValue('stored-key')

      const mockBlob = new Blob(['avatar-data'])
      const mockFetchResponse = new MockResponse(mockBlob, {
        status: 200,
        headers: { 'content-type': 'image/png' }
      })
      mockFetch.mockResolvedValue(mockFetchResponse)

      mockEvent.request.url = 'chrome-extension://test-id/api/avatar?url=https://example.com/avatar.png&authMethod=apikey'

      handleFetchEvent(mockEvent)

      const responsePromise = mockEvent.respondWith.mock.calls[0][0]
      await responsePromise

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/avatar.png',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Api-Key stored-key'
          })
        })
      )
    })
  })

  describe('initializeAvatarProxy', () => {
    it('should register fetch event listener in Service Worker context', () => {
      const mockSelf = {
        addEventListener: jest.fn()
      }
      global.self = mockSelf as any

      initializeAvatarProxy()

      expect(mockSelf.addEventListener).toHaveBeenCalledWith(
        'fetch',
        expect.any(Function)
      )
    })

    it('should not register if not in Service Worker context', () => {
      const originalSelf = global.self
      delete (global as any).self

      initializeAvatarProxy()

      global.self = originalSelf
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      mockCaches.open.mockResolvedValue({
        match: mockCaches.match,
        put: mockCaches.put
      })
      mockCaches.match.mockResolvedValue(null)
    })

    it('should handle missing Content-Type header', async () => {
      mockStorageInstances.regular.get.mockResolvedValue({
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'jwt'
      })
      mockStorageInstances.secure.get.mockResolvedValue(null)
      ;(getJWTCookie as jest.Mock).mockResolvedValue('test-jwt-token')

      const mockBlob = new Blob(['avatar-data'])
      const mockFetchResponse = new MockResponse(mockBlob, {
        status: 200,
        headers: {}
      })
      mockFetch.mockResolvedValue(mockFetchResponse)

      const response = await handleAvatarFetch(
        'https://cdn.example.com/avatar.png',
        'jwt'
      )

      expect(response.headers.get('Content-Type')).toBe('image/png')
    })

    it('should handle empty API key', async () => {
      mockStorageInstances.regular.get.mockResolvedValue({
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'apikey',
        apiKey: ''
      })
      mockStorageInstances.secure.get.mockResolvedValue('')

      const mockBlob = new Blob(['avatar-data'])
      const mockFetchResponse = new MockResponse(mockBlob, {
        status: 200,
        headers: { 'content-type': 'image/png' }
      })
      mockFetch.mockResolvedValue(mockFetchResponse)

      const response = await handleAvatarFetch(
        'https://cdn.example.com/avatar.png',
        'apikey'
      )

      expect(response.status).toBe(200)
    })
  })
})
