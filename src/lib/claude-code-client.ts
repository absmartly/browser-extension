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
    console.log('[Bridge] Finding bridge port...')
    const customPort = await this.storage.get<number>(STORAGE_KEY_BRIDGE_PORT)
    console.log(`[Bridge] Storage returned custom port: ${customPort || 'null'}`)

    if (customPort) {
      console.log(`[Bridge] Trying saved custom port: ${customPort}`)
      try {
        await this.tryConnect(customPort)
        console.log(`[Bridge] Custom port ${customPort} connected successfully`)
        return customPort
      } catch (error) {
        console.log(`[Bridge] Custom port ${customPort} failed:`, error.message)
        console.log(`[Bridge] Trying default ports...`)
      }
    }

    for (const port of DEFAULT_PORTS) {
      console.log(`[Bridge] Trying port ${port}...`)
      try {
        await this.tryConnect(port)
        await this.storage.set(STORAGE_KEY_BRIDGE_PORT, port)
        console.log(`[Bridge] ✅ Found bridge on port ${port}`)
        return port
      } catch (error) {
        console.log(`[Bridge] Port ${port} failed: ${error.message}`)
        continue
      }
    }

    console.log(`[Bridge] ❌ Could not find Claude Code Bridge on any port`)
    throw new Error('Could not find Claude Code Bridge on any port (3000-3004)')
  }

  private async tryConnect(port: number): Promise<BridgeHealthResponse> {
    const url = `http://localhost:${port}/health`
    console.log(`[Bridge] Fetching ${url}...`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        method: 'GET'
      })

      clearTimeout(timeout)
      console.log(`[Bridge] Fetch response status: ${response.status}`)

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`)
      }

      const data = await response.json() as BridgeHealthResponse
      console.log(`[Bridge] Health check data:`, data)

      if (!data.ok) {
        throw new Error('Bridge health check returned not ok')
      }

      return data
    } catch (error) {
      clearTimeout(timeout)
      console.log(`[Bridge] Fetch failed: ${error.name} - ${error.message}`)
      if (error.name === 'AbortError') {
        throw new Error(`Connection timeout to port ${port}`)
      }
      throw error
    }
  }

  async connect(): Promise<BridgeConnection> {
    console.log('[Bridge] connect() called')
    this.connectionState = ConnectionState.CONNECTING

    try {
      const port = await this.findBridgePort()
      const url = `http://localhost:${port}`
      console.log(`[Bridge] Found port ${port}, full URL: ${url}`)

      const healthResponse = await this.tryConnect(port)

      this.connection = {
        url,
        port,
        authenticated: healthResponse.authenticated,
        subscriptionType: healthResponse.subscriptionType
      }

      this.connectionState = ConnectionState.CONNECTED
      console.log(`[Bridge] ✅ Connected to ${url}`, this.connection)

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

  async createConversation(sessionId: string, cwd: string, permissionMode: 'ask' | 'allow' = 'ask', jsonSchema?: any): Promise<{ conversationId: string }> {
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
        jsonSchema // Pass schema to bridge if provided
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.status}`)
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

    const eventSource = new EventSource(`${this.connection.url}/conversations/${conversationId}/stream`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (error) {
        debugError('[Bridge] Failed to parse SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      debugError('[Bridge] SSE error:', error)
      onError(new Error('Stream connection error'))
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
      return 'Connecting to Claude Code Bridge...'
    case ConnectionState.CONNECTED:
      return 'Connected to Claude Code Bridge'
    case ConnectionState.CONNECTION_FAILED:
      return 'Connection failed. Check if the bridge server is running.'
    case ConnectionState.SERVER_NOT_FOUND:
      return 'Claude Code Bridge not found. Start it with: npx @absmartly/claude-code-bridge'
    default:
      return ''
  }
}
