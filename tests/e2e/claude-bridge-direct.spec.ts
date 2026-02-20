import { test, expect } from '@playwright/test'
import http from 'http'
import crypto from 'crypto'

const BRIDGE_URL = 'http://localhost:3000'

async function isBridgeAvailable(): Promise<boolean> {
  try {
    const resp = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(3000) })
    const data = await resp.json()
    return data.ok && data.authenticated
  } catch {
    return false
  }
}

interface SSEResult {
  textChunks: string[]
  toolUseData: Record<string, unknown>[]
  events: Array<{ type: string; data: unknown }>
}

function createSSEReader(conversationId: string, timeoutMs: number): Promise<SSEResult> {
  return new Promise((resolve, reject) => {
    const result: SSEResult = { textChunks: [], toolUseData: [], events: [] }
    let buffer = ''
    let resolved = false

    const done = () => {
      if (!resolved) { resolved = true; clearTimeout(timer); resolve(result) }
    }
    const fail = (err: Error) => {
      if (!resolved) { resolved = true; clearTimeout(timer); req.destroy(); reject(err) }
    }

    const timer = setTimeout(() => fail(new Error(`SSE timeout after ${timeoutMs}ms`)), timeoutMs)

    const req = http.get(
      `${BRIDGE_URL}/conversations/${conversationId}/stream`,
      { headers: { 'Accept': 'text/event-stream' } },
      (res) => {
        res.setEncoding('utf8')

        res.on('data', (chunk: string) => {
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const jsonStr = line.startsWith('data: ') ? line.slice(6) : line.slice(5)
            if (!jsonStr.trim()) continue

            try {
              const data = JSON.parse(jsonStr)
              result.events.push(data)

              if (data.type === 'text') {
                result.textChunks.push(data.data)
              } else if (data.type === 'tool_use') {
                result.toolUseData.push(data.data)
              } else if (data.type === 'done') {
                req.destroy()
                done()
                return
              } else if (data.type === 'error') {
                fail(new Error(`Claude error: ${data.data}`))
                return
              }
            } catch (e) {
              if (!(e instanceof SyntaxError)) { fail(e as Error); return }
            }
          }
        })

        res.on('end', () => done())
        res.on('error', (err: Error) => fail(err))
      }
    )

    req.on('error', (err: Error) => fail(err))
  })
}

test.describe('Claude Code Bridge Direct Integration', () => {
  test('should create conversation and receive response from bridge', async () => {
    test.setTimeout(120000)
    const available = await isBridgeAvailable()
    if (!available) {
      test.skip(true, 'Bridge not reachable or not authenticated on port 3000')
      return
    }

    const healthResp = await fetch(`${BRIDGE_URL}/health`)
    expect(healthResp.ok).toBeTruthy()
    const health = await healthResp.json()
    expect(health.ok).toBe(true)
    expect(health.authenticated).toBe(true)

    const conversationId = crypto.randomUUID()
    const convResp = await fetch(`${BRIDGE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: conversationId })
    })

    expect(convResp.ok).toBeTruthy()
    const convData = await convResp.json()
    expect(convData.conversationId).toBeTruthy()

    const streamPromise = createSSEReader(conversationId, 90000)
    await new Promise(resolve => setTimeout(resolve, 500))

    const msgResp = await fetch(`${BRIDGE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Change the h1 element text color to red. Use selector "h1".',
        files: []
      })
    })
    expect(msgResp.ok).toBeTruthy()

    const sseResult = await streamPromise

    const hasResponse = sseResult.textChunks.length > 0 || sseResult.toolUseData.length > 0
    expect(hasResponse).toBe(true)

    if (sseResult.toolUseData.length > 0) {
      const domChangesPayload = sseResult.toolUseData[0] as Record<string, unknown>
      expect(domChangesPayload.domChanges).toBeDefined()
      expect(Array.isArray(domChangesPayload.domChanges)).toBe(true)
      expect(domChangesPayload.action).toBeDefined()
    }

    if (sseResult.textChunks.length > 0) {
      const fullText = sseResult.textChunks.join('')
      expect(fullText.length).toBeGreaterThan(0)
    }
  })
})
