const mockStorageInstance = {
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn()
}

jest.mock('@plasmohq/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => mockStorageInstance)
  }
})

import { ClaudeCodeBridgeClient, ConnectionState, type BridgeHealthResponse } from '../claude-code-client'

describe('ClaudeCodeBridgeClient', () => {
  let client: ClaudeCodeBridgeClient
  let mockStorage: typeof mockStorageInstance
  let mockFetch: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()

    mockStorage = mockStorageInstance
    mockStorage.get.mockClear()
    mockStorage.set.mockClear()
    mockStorage.remove.mockClear()

    mockFetch = global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

    client = new ClaudeCodeBridgeClient()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Port Discovery Logic', () => {
    const createMockResponse = (ok: boolean, data?: any): Response => ({
      ok,
      status: ok ? 200 : 500,
      json: jest.fn().mockResolvedValue(data || { ok }),
      headers: new Headers(),
      redirected: false,
      statusText: ok ? 'OK' : 'Error',
      type: 'basic',
      url: '',
      clone: jest.fn(),
      body: null,
      bodyUsed: false,
      arrayBuffer: jest.fn(),
      blob: jest.fn(),
      formData: jest.fn(),
      text: jest.fn()
    } as any)

    it('should try custom port first when saved in storage', async () => {
      mockStorage.get.mockResolvedValue(3002)
      mockFetch.mockResolvedValueOnce(createMockResponse(true, { ok: true, authenticated: true }))

      const port = await client.findBridgePort()

      expect(mockStorage.get).toHaveBeenCalledWith('claudeBridgePort')
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/health',
        expect.objectContaining({ method: 'GET' })
      )
      expect(port).toBe(3002)
    })

    it('should fall back to default ports when custom port fails', async () => {
      mockStorage.get.mockResolvedValue(3002)
      mockFetch
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce(createMockResponse(true, { ok: true, authenticated: true }))

      const port = await client.findBridgePort()

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3002/health', expect.any(Object))
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/health', expect.any(Object))
      expect(port).toBe(3000)
    })

    it('should try default ports in order: 3000, 3001, 3002, 3003, 3004', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockRejectedValueOnce(new Error('Port 3000 refused'))
        .mockRejectedValueOnce(new Error('Port 3001 refused'))
        .mockResolvedValueOnce(createMockResponse(true, { ok: true, authenticated: true }))

      const port = await client.findBridgePort()

      expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://localhost:3000/health', expect.any(Object))
      expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://localhost:3001/health', expect.any(Object))
      expect(mockFetch).toHaveBeenNthCalledWith(3, 'http://localhost:3002/health', expect.any(Object))
      expect(port).toBe(3002)
    })

    it('should save working port to storage', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch.mockResolvedValueOnce(createMockResponse(true, { ok: true, authenticated: true }))

      await client.findBridgePort()

      expect(mockStorage.set).toHaveBeenCalledWith('claudeBridgePort', 3000)
    })

    it('should throw error after trying all ports without success', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch.mockRejectedValue(new Error('Connection refused'))

      await expect(client.findBridgePort()).rejects.toThrow(
        'Could not connect to Claude Code Bridge on any port (3000, 3001, 3002, 3003, 3004)'
      )

      expect(mockFetch).toHaveBeenCalledTimes(5)
    })

    it('should not save custom port to storage when it succeeds', async () => {
      mockStorage.get.mockResolvedValue(3002)
      mockFetch.mockResolvedValueOnce(createMockResponse(true, { ok: true, authenticated: true }))

      await client.findBridgePort()

      expect(mockStorage.set).not.toHaveBeenCalled()
    })
  })

  describe('Connection Timeout Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should timeout gracefully on unresponsive port', async () => {
      mockStorage.get.mockResolvedValue(null)

      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'

      mockFetch.mockRejectedValue(abortError)

      const promise = client.findBridgePort()

      await expect(promise).rejects.toThrow('Could not connect to Claude Code Bridge on any port')
    })

    it('should handle network timeouts without hanging', async () => {
      mockStorage.get.mockResolvedValue(3001)

      const abortError = new Error('Timeout')
      abortError.name = 'AbortError'

      mockFetch.mockRejectedValueOnce(abortError)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, authenticated: false })
      } as any)

      const promise = client.findBridgePort()
      jest.advanceTimersByTime(2000)
      await jest.runAllTimersAsync()

      const port = await promise
      expect(port).toBe(3000)
    })

    it('should retry with next port on timeout', async () => {
      mockStorage.get.mockResolvedValue(null)

      const abortError = new Error('Timeout')
      abortError.name = 'AbortError'

      mockFetch
        .mockRejectedValueOnce(abortError)
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)

      const promise = client.findBridgePort()
      jest.advanceTimersByTime(6000)
      await jest.runAllTimersAsync()

      const port = await promise
      expect(port).toBe(3002)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should give up after trying all ports on timeout', async () => {
      mockStorage.get.mockResolvedValue(null)

      const abortError = new Error('Timeout')
      abortError.name = 'AbortError'
      mockFetch.mockRejectedValue(abortError)

      await expect(client.findBridgePort()).rejects.toThrow('Could not connect to Claude Code Bridge on any port')
      expect(mockFetch).toHaveBeenCalledTimes(5)
    })

    it('should clear timeout after successful connection', async () => {
      mockStorage.get.mockResolvedValue(null)
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
      } as any)

      await client.findBridgePort()

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })
  })

  describe('Health Check Validation', () => {
    it('should validate /health endpoint response structure', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
      } as any)

      const port = await client.findBridgePort()

      expect(port).toBe(3000)
    })

    it('should detect when bridge server returns not ok', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: false, authenticated: false })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)

      const port = await client.findBridgePort()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(port).toBe(3001)
    })

    it('should handle non-200 HTTP status codes', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: jest.fn().mockResolvedValue({ ok: false })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)

      const port = await client.findBridgePort()

      expect(port).toBe(3001)
    })

    it('should handle malformed JSON in health response', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: false })
        } as any)

      const port = await client.findBridgePort()

      expect(port).toBe(3001)
    })

    it('should validate health response contains ok field', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)

      const port = await client.findBridgePort()

      expect(port).toBe(3001)
    })

    it('should accept optional subscriptionType in health response', async () => {
      mockStorage.get.mockResolvedValue(null)
      const healthResponse: BridgeHealthResponse = {
        ok: true,
        authenticated: true,
        subscriptionType: 'premium',
        claudeProcess: 'running',
        expiresAt: Date.now() + 3600000
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(healthResponse)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(healthResponse)
        } as any)

      const connection = await client.connect()

      expect(connection.authenticated).toBe(true)
      expect(connection.subscriptionType).toBe('premium')
    })
  })

  describe('EventSource Stream Handling', () => {
    let mockEventSourceInstance: any

    beforeEach(() => {
      mockEventSourceInstance = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        close: jest.fn(),
        onmessage: null,
        onerror: null,
        readyState: 1
      }

      ;(global.EventSource as any) = jest.fn(() => mockEventSourceInstance)
    })

    it('should create EventSource with correct URL', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)

      await client.connect()
      const onMessage = jest.fn()
      const onError = jest.fn()

      client.streamResponses('conv-123', onMessage, onError)

      expect(global.EventSource).toHaveBeenCalledWith('http://localhost:3000/conversations/conv-123/stream')
    })

    it('should parse SSE messages correctly', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)

      await client.connect()
      const onMessage = jest.fn()
      const onError = jest.fn()

      client.streamResponses('conv-123', onMessage, onError)

      const testEvent = { data: JSON.stringify({ type: 'message', content: 'test' }) }
      mockEventSourceInstance.onmessage(testEvent)

      expect(onMessage).toHaveBeenCalledWith({ type: 'message', content: 'test' })
    })

    it('should handle malformed JSON in SSE messages', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)

      await client.connect()
      const onMessage = jest.fn()
      const onError = jest.fn()

      client.streamResponses('conv-123', onMessage, onError)

      const testEvent = { data: 'invalid json{' }
      mockEventSourceInstance.onmessage(testEvent)

      expect(onMessage).not.toHaveBeenCalled()
    })

    it('should handle stream disconnection gracefully', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)

      await client.connect()
      const onMessage = jest.fn()
      const onError = jest.fn()

      client.streamResponses('conv-123', onMessage, onError)

      mockEventSourceInstance.readyState = 2
      mockEventSourceInstance.onerror(new Event('error'))

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Stream connection closed')
        })
      )
      expect(mockEventSourceInstance.close).toHaveBeenCalled()
    })

    it('should allow reconnection when EventSource is in CONNECTING state', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
      } as any)

      await client.connect()
      const onMessage = jest.fn()
      const onError = jest.fn()

      client.streamResponses('conv-123', onMessage, onError)

      mockEventSourceInstance.readyState = 0
      mockEventSourceInstance.onerror(new Event('error'))

      expect(onError).not.toHaveBeenCalled()
      expect(mockEventSourceInstance.close).not.toHaveBeenCalled()
    })

    it('should throw error when streaming without connection', () => {
      const onMessage = jest.fn()
      const onError = jest.fn()

      expect(() => {
        client.streamResponses('conv-123', onMessage, onError)
      }).toThrow('Not connected to bridge')
    })
  })

  describe('Error Recovery', () => {
    it('should distinguish network errors from server not found', async () => {
      mockStorage.get.mockResolvedValue(null)
      const networkError = new Error('ECONNREFUSED')
      mockFetch.mockRejectedValue(networkError)

      await expect(client.findBridgePort()).rejects.toThrow(
        'Could not connect to Claude Code Bridge on any port'
      )
    })

    it('should set connection state to SERVER_NOT_FOUND on failure', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch.mockRejectedValue(new Error('Connection refused'))

      await expect(client.connect()).rejects.toThrow()
      expect(client.getConnectionState()).toBe(ConnectionState.SERVER_NOT_FOUND)
    })

    it('should set connection state to CONNECTING during connection', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any), 100))
      )

      const connectPromise = client.connect()
      expect(client.getConnectionState()).toBe(ConnectionState.CONNECTING)
      await connectPromise
    })

    it('should cleanup resources on connection failure', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch.mockRejectedValue(new Error('Connection failed'))

      await expect(client.connect()).rejects.toThrow()

      expect(client.getConnection()).toBeNull()
    })

    it('should handle race conditions between multiple tabs', async () => {
      mockStorage.get.mockResolvedValue(3001)

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)

      const port1 = await client.findBridgePort()

      mockStorage.get.mockResolvedValue(3001)
      const port2 = await client.findBridgePort()

      expect(port1).toBe(3001)
      expect(port2).toBe(3001)
    })

    it('should recover from temporary network issues', async () => {
      mockStorage.get.mockResolvedValue(null)

      mockFetch
        .mockRejectedValueOnce(new Error('Network unstable'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)

      const port = await client.findBridgePort()
      expect(port).toBe(3001)
    })
  })

  describe('connect()', () => {
    it('should establish connection successfully', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, authenticated: true, subscriptionType: 'free' })
      } as any)

      const connection = await client.connect()

      expect(connection).toEqual({
        url: 'http://localhost:3000',
        port: 3000,
        authenticated: true,
        subscriptionType: 'free'
      })
      expect(client.getConnectionState()).toBe(ConnectionState.CONNECTED)
    })

    it('should store connection details', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, authenticated: false })
      } as any)

      await client.connect()
      const connection = client.getConnection()

      expect(connection).not.toBeNull()
      expect(connection?.port).toBe(3000)
      expect(connection?.authenticated).toBe(false)
    })
  })

  describe('testConnection()', () => {
    it('should test connection with custom port', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
      } as any)

      const result = await client.testConnection(3005)

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3005/health', expect.any(Object))
      expect(result).toBe(true)
      expect(mockStorage.set).toHaveBeenCalledWith('claudeBridgePort', 3005)
    })

    it('should return false on connection failure', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch.mockRejectedValue(new Error('Connection refused'))

      const result = await client.testConnection()

      expect(result).toBe(false)
    })
  })

  describe('createConversation()', () => {
    it('should auto-connect if not connected', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ conversationId: 'conv-123' })
        } as any)

      const result = await client.createConversation('session-1', '/path/to/cwd')

      expect(result.conversationId).toBe('conv-123')
    })

    it('should send correct request body', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ conversationId: 'conv-123' })
        } as any)

      await client.createConversation('session-1', '/cwd', 'allow', { type: 'object' }, '<html></html>', 'claude-opus-4')

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3000/conversations',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: 'session-1',
            cwd: '/cwd',
            permissionMode: 'allow',
            jsonSchema: { type: 'object' },
            html: '<html></html>',
            model: 'claude-opus-4'
          })
        })
      )
    })

    it('should throw error on failed request', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: jest.fn()
        } as any)

      await expect(client.createConversation('session-1', '/cwd')).rejects.toThrow(
        'Failed to create conversation: 400'
      )
    })
  })

  describe('refreshHtml()', () => {
    it('should send HTML refresh request', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn()
        } as any)

      await client.connect()
      await client.refreshHtml('conv-123', '<html>updated</html>')

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3000/conversations/conv-123/refresh',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ html: '<html>updated</html>' })
        })
      )
    })

    it('should auto-connect if not connected', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn()
        } as any)

      await client.refreshHtml('conv-123', '<html></html>')

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/health', expect.any(Object))
    })
  })

  describe('getHtmlChunks()', () => {
    it('should fetch HTML chunks for selectors', async () => {
      mockStorage.get.mockResolvedValue(null)
      const mockResponse = {
        results: [
          { selector: '.header', html: '<div class="header"></div>', found: true },
          { selector: '.footer', html: '', found: false, error: 'Not found' }
        ]
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockResponse)
        } as any)

      await client.connect()
      const result = await client.getHtmlChunks('conv-123', ['.header', '.footer'])

      expect(result.results).toHaveLength(2)
      expect(result.results[0].found).toBe(true)
      expect(result.results[1].found).toBe(false)
    })
  })

  describe('queryXPath()', () => {
    it('should execute XPath query', async () => {
      mockStorage.get.mockResolvedValue(null)
      const mockResponse = {
        xpath: '//div[@class="content"]',
        matches: [
          { selector: '.content', html: '<div class="content"></div>', textContent: '', nodeType: 'ELEMENT_NODE' }
        ],
        found: true
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockResponse)
        } as any)

      await client.connect()
      const result = await client.queryXPath('conv-123', '//div[@class="content"]', 10)

      expect(result.found).toBe(true)
      expect(result.matches).toHaveLength(1)
    })

    it('should use default maxResults of 10', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ xpath: '//div', matches: [], found: false })
        } as any)

      await client.connect()
      await client.queryXPath('conv-123', '//div')

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3000/conversations/conv-123/xpath',
        expect.objectContaining({
          body: JSON.stringify({ xpath: '//div', maxResults: 10 })
        })
      )
    })
  })

  describe('sendMessage()', () => {
    it('should send message with all parameters', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn()
        } as any)

      await client.connect()
      await client.sendMessage('conv-123', 'Hello', ['file1.txt', 'file2.txt'], 'System prompt', { type: 'object' })

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3000/conversations/conv-123/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            content: 'Hello',
            files: ['file1.txt', 'file2.txt'],
            systemPrompt: 'System prompt',
            jsonSchema: { type: 'object' }
          })
        })
      )
    })

    it('should use default empty files array', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn()
        } as any)

      await client.connect()
      await client.sendMessage('conv-123', 'Hello')

      expect(mockFetch).toHaveBeenLastCalledWith(
        'http://localhost:3000/conversations/conv-123/messages',
        expect.objectContaining({
          body: expect.stringContaining('"files":[]')
        })
      )
    })
  })

  describe('disconnect()', () => {
    it('should clear connection and reset state', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, authenticated: true })
      } as any)

      await client.connect()
      expect(client.getConnection()).not.toBeNull()

      client.disconnect()

      expect(client.getConnection()).toBeNull()
      expect(client.getConnectionState()).toBe(ConnectionState.NOT_CONFIGURED)
    })
  })

  describe('setCustomPort()', () => {
    it('should save custom port and disconnect', async () => {
      await client.setCustomPort(3010)

      expect(mockStorage.set).toHaveBeenCalledWith('claudeBridgePort', 3010)
      expect(client.getConnection()).toBeNull()
      expect(client.getConnectionState()).toBe(ConnectionState.NOT_CONFIGURED)
    })
  })

  describe('clearCustomPort()', () => {
    it('should remove custom port from storage and disconnect', async () => {
      await client.clearCustomPort()

      expect(mockStorage.remove).toHaveBeenCalledWith('claudeBridgePort')
      expect(client.getConnection()).toBeNull()
      expect(client.getConnectionState()).toBe(ConnectionState.NOT_CONFIGURED)
    })
  })

  describe('getConnectionStateMessage()', () => {
    it('should return correct message for each state', async () => {
      const { getConnectionStateMessage } = await import('../claude-code-client')

      expect(getConnectionStateMessage(ConnectionState.NOT_CONFIGURED)).toContain('not configured')
      expect(getConnectionStateMessage(ConnectionState.CONNECTING)).toContain('Connecting')
      expect(getConnectionStateMessage(ConnectionState.CONNECTED)).toContain('Connected')
      expect(getConnectionStateMessage(ConnectionState.CONNECTION_FAILED)).toContain('Connection failed')
      expect(getConnectionStateMessage(ConnectionState.SERVER_NOT_FOUND)).toContain('not found')
    })
  })
})
