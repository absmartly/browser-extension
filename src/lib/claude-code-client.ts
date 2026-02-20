import { debugLog, debugError } from '~src/utils/debug'
import { Storage } from '@plasmohq/storage'

const DEFAULT_PORTS = [3000, 3001, 3002, 3003, 3004]
const CONNECTION_TIMEOUT = 2000
const STORAGE_KEY_BRIDGE_PORT = 'claudeBridgePort'

export enum ConnectionState {
  NOT_CONFIGURED = 'not_configured',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  CONNECTION_FAILED = 'failed',
  SERVER_NOT_FOUND = 'not_found'
}

export interface BridgeConnection {
  url: string
  port: number
  authenticated: boolean
  subscriptionType?: string
}

export interface BridgeHealthResponse {
  ok: boolean
  authenticated: boolean
  subscriptionType?: string
  claudeProcess?: string
  expiresAt?: number
}

export class ClaudeCodeBridgeClient {
  private storage: Storage
  private connection: BridgeConnection | null = null
  private connectionState: ConnectionState = ConnectionState.NOT_CONFIGURED

  constructor() {
    this.storage = new Storage()
  }

  async findBridgePort(): Promise<number> {
    debugLog('[Bridge] Finding bridge port...')
    const failedAttempts: Array<{ port: number; error: string }> = []
    const customPort = await this.storage.get<number>(STORAGE_KEY_BRIDGE_PORT)
    debugLog(`[Bridge] Storage returned custom port: ${customPort || 'null'}`)

    if (customPort) {
      debugLog(`[Bridge] Trying saved custom port: ${customPort}`)
      try {
        await this.tryConnect(customPort)
        debugLog(`[Bridge] Custom port ${customPort} connected successfully`)
        return customPort
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        debugLog(`[Bridge] Custom port ${customPort} failed:`, errorMsg)
        debugLog(`[Bridge] Trying default ports...`)
        failedAttempts.push({
          port: customPort,
          error: errorMsg
        })
      }
    }

    for (const port of DEFAULT_PORTS) {
      debugLog(`[Bridge] Trying port ${port}...`)
      try {
        await this.tryConnect(port)
        await this.storage.set(STORAGE_KEY_BRIDGE_PORT, port)
        debugLog(`[Bridge] ✅ Found bridge on port ${port}`)
        return port
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        debugLog(`[Bridge] Port ${port} failed: ${errorMsg}`)
        failedAttempts.push({
          port,
          error: errorMsg
        })
      }
    }

    debugLog(`[Bridge] ❌ Could not find AI CLI Bridge on any port`)

    const attemptedPorts = failedAttempts.map(a => a.port).join(', ')
    const errorSummary = failedAttempts
      .map(a => {
        let errorDetail = a.error
        if (errorDetail.includes('timeout')) {
          errorDetail += ' (connection timeout - server not responding)'
        } else if (errorDetail.includes('Failed to fetch') || errorDetail.includes('ECONNREFUSED')) {
          errorDetail += ' (connection refused - server not running)'
        } else if (errorDetail.includes('NetworkError') || errorDetail.includes('network')) {
          errorDetail += ' (network error - check firewall/permissions)'
        }
        return `  Port ${a.port}: ${errorDetail}`
      })
      .join('\n')

    throw new Error(`Could not connect to AI CLI Bridge on any port (${attemptedPorts}).

Failed attempts:
${errorSummary}

Please ensure AI CLI Bridge is running:
  npx @absmartly/ai-cli-bridge

Or configure a custom port in extension settings if running on a different port.

Common issues:
  - Bridge server not running (most common)
  - Firewall blocking localhost connections
  - Bridge running on a different port than expected
  - Insufficient permissions to access network`)
  }

  private async tryConnect(port: number): Promise<BridgeHealthResponse> {
    const url = `http://localhost:${port}/health`
    debugLog(`[Bridge] Fetching ${url}...`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        method: 'GET'
      })

      clearTimeout(timeout)
      debugLog(`[Bridge] Fetch response status: ${response.status}`)

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`)
      }

      const data = await response.json() as BridgeHealthResponse
      debugLog(`[Bridge] Health check data:`, data)

      if (!data.ok) {
        throw new Error('Bridge health check returned not ok')
      }

      return data
    } catch (error) {
      clearTimeout(timeout)
      debugLog(`[Bridge] Fetch failed: ${error.name} - ${error.message}`)
      if (error.name === 'AbortError') {
        throw new Error(`Connection timeout to port ${port}`)
      }
      throw error
    }
  }

  async connect(): Promise<BridgeConnection> {
    debugLog('[Bridge] connect() called')
    this.connectionState = ConnectionState.CONNECTING

    try {
      const port = await this.findBridgePort()
      const url = `http://localhost:${port}`
      debugLog(`[Bridge] Found port ${port}, full URL: ${url}`)

      const healthResponse = await this.tryConnect(port)

      this.connection = {
        url,
        port,
        authenticated: healthResponse.authenticated,
        subscriptionType: healthResponse.subscriptionType
      }

      this.connectionState = ConnectionState.CONNECTED
      debugLog(`[Bridge] ✅ Connected to ${url}`, this.connection)

      return this.connection
    } catch (error) {
      console.error('[Bridge] ❌ Connection failed:', error)
      this.connectionState = ConnectionState.SERVER_NOT_FOUND
      throw error
    }
  }

  async testConnection(customPort?: number): Promise<boolean> {
    try {
      const port = customPort || await this.findBridgePort()
      await this.tryConnect(port)

      if (customPort) {
        await this.storage.set(STORAGE_KEY_BRIDGE_PORT, customPort)
      }

      return true
    } catch (error) {
      debugError('[Bridge] Test connection failed:', error)
      return false
    }
  }

  async createConversation(
    sessionId: string,
    cwd: string,
    permissionMode: 'ask' | 'allow' = 'ask',
    jsonSchema?: any,
    html?: string,
    model?: string,
    provider?: string
  ): Promise<{ conversationId: string }> {
    if (!this.connection) {
      await this.connect()
    }

    const response = await fetch(`${this.connection!.url}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        cwd,
        permissionMode,
        jsonSchema,
        html,
        model,
        provider
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.status}`)
    }

    return await response.json()
  }

  async refreshHtml(conversationId: string, html: string): Promise<void> {
    if (!this.connection) {
      await this.connect()
    }

    const response = await fetch(`${this.connection!.url}/conversations/${conversationId}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html })
    })

    if (!response.ok) {
      throw new Error(`Failed to refresh HTML: ${response.status}`)
    }
  }

  async getHtmlChunks(conversationId: string, selectors: string[]): Promise<{ results: Array<{ selector: string, html: string, found: boolean, error?: string }> }> {
    if (!this.connection) {
      await this.connect()
    }

    const response = await fetch(`${this.connection!.url}/conversations/${conversationId}/chunks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectors })
    })

    if (!response.ok) {
      throw new Error(`Failed to get HTML chunks: ${response.status}`)
    }

    return await response.json()
  }

  async queryXPath(conversationId: string, xpath: string, maxResults: number = 10): Promise<{ xpath: string, matches: Array<{ selector: string, html: string, textContent: string, nodeType: string }>, found: boolean, error?: string }> {
    if (!this.connection) {
      await this.connect()
    }

    const response = await fetch(`${this.connection!.url}/conversations/${conversationId}/xpath`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xpath, maxResults })
    })

    if (!response.ok) {
      throw new Error(`Failed to execute XPath: ${response.status}`)
    }

    return await response.json()
  }

  async sendMessage(conversationId: string, content: string, files: string[] = [], systemPrompt?: string, jsonSchema?: any): Promise<void> {
    if (!this.connection) {
      await this.connect()
    }

    const response = await fetch(`${this.connection!.url}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        files,
        systemPrompt,
        jsonSchema // Send schema with every message for bridge restart safety
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`)
    }
  }

  streamResponses(conversationId: string, onMessage: (event: any) => void, onError: (error: Error) => void): EventSource {
    if (!this.connection) {
      throw new Error('Not connected to bridge')
    }

    const streamUrl = `${this.connection.url}/conversations/${conversationId}/stream`
    debugLog('[Bridge] Creating EventSource for:', streamUrl)
    const eventSource = new EventSource(streamUrl)
    let reconnectAttempts = 0
    const MAX_RECONNECT_ATTEMPTS = 3

    eventSource.onmessage = (event) => {
      reconnectAttempts = 0
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (error) {
        debugError('[Bridge] Failed to parse SSE message:', error, 'Raw data:', event.data?.substring(0, 200))
        onError(new Error(`Failed to parse bridge response: ${error instanceof Error ? error.message : String(error)}`))
      }
    }

    eventSource.onerror = (error) => {
      const readyState = eventSource.readyState
      console.error('[Bridge] SSE error event received')
      console.error('[Bridge] EventSource readyState:', readyState)
      console.error('[Bridge] EventSource URL:', streamUrl)

      // EventSource readyState values: 0=CONNECTING, 1=OPEN, 2=CLOSED
      let errorMessage: string
      switch (readyState) {
        case 0: // CONNECTING
          reconnectAttempts++
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            errorMessage = `Connection lost, attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
            debugLog('[Bridge] Allowing reconnection attempt:', reconnectAttempts)
            return
          } else {
            errorMessage = `Connection failed after ${MAX_RECONNECT_ATTEMPTS} reconnection attempts`
            eventSource.close()
          }
          break
        case 2: // CLOSED
          errorMessage = 'Stream connection closed. The bridge server may have stopped or the conversation may have ended.'
          break
        default:
          errorMessage = `Stream connection failed (readyState: ${readyState})`
      }

      debugError('[Bridge] SSE error:', errorMessage)
      onError(new Error(errorMessage))
      eventSource.close()
    }

    return eventSource
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  getConnection(): BridgeConnection | null {
    return this.connection
  }

  disconnect(): void {
    this.connection = null
    this.connectionState = ConnectionState.NOT_CONFIGURED
  }

  async setCustomPort(port: number): Promise<void> {
    await this.storage.set(STORAGE_KEY_BRIDGE_PORT, port)
    this.disconnect()
  }

  async clearCustomPort(): Promise<void> {
    await this.storage.remove(STORAGE_KEY_BRIDGE_PORT)
    this.disconnect()
  }
}

export const getConnectionStateMessage = (state: ConnectionState): string => {
  switch (state) {
    case ConnectionState.NOT_CONFIGURED:
      return 'AI features not configured. Select an AI provider to get started.'
    case ConnectionState.CONNECTING:
      return 'Connecting to AI CLI Bridge...'
    case ConnectionState.CONNECTED:
      return 'Connected to AI CLI Bridge'
    case ConnectionState.CONNECTION_FAILED:
      return 'Connection failed. Check if the bridge server is running.'
    case ConnectionState.SERVER_NOT_FOUND:
      return 'AI CLI Bridge not found. Start it with: npx @absmartly/ai-cli-bridge'
    default:
      return ''
  }
}
