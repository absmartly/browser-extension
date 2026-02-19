import { test, expect } from '@playwright/test'

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

test.describe('Claude Code Bridge Direct Integration', () => {
  test('should create conversation and receive response from bridge', async () => {
    test.skip(true, 'EventSource API is not available in Node.js/Playwright test runner context; this test requires a browser environment for SSE streaming')
    test.setTimeout(60000)
    const available = await isBridgeAvailable()
    if (!available) {
      test.skip(true, 'Bridge not reachable or not authenticated on port 3000')
      return
    }

    const healthResp = await fetch(`${BRIDGE_URL}/health`)
    expect(healthResp.ok).toBeTruthy()
    const health = await healthResp.json()
    console.log('Bridge health:', health)
    expect(health.ok).toBe(true)
    expect(health.authenticated).toBe(true)

    // 2. Create conversation
    const convResp = await fetch(`${BRIDGE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: `test-${Date.now()}`,
        cwd: '/',
        permissionMode: 'allow'
      })
    })

    expect(convResp.ok).toBeTruthy()
    const { conversationId } = await convResp.json()
    expect(conversationId).toBeTruthy()
    console.log('✓ Conversation created:', conversationId)

    // 3. Set up stream and send message
    const responseText = await new Promise<string>((resolve, reject) => {
      let fullResponse = ''
      const eventSource = new EventSource(`${BRIDGE_URL}/conversations/${conversationId}/stream`)

      eventSource.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data)
        console.log(`[${new Date().toISOString()}] Event:`, data.type, data.data?.substring(0, 100))

        if (data.type === 'text') {
          fullResponse += data.data
        } else if (data.type === 'done') {
          console.log('✓ Stream complete, response length:', fullResponse.length)
          eventSource.close()
          resolve(fullResponse)
        } else if (data.type === 'error') {
          console.error('Claude error:', data.data)
          eventSource.close()
          reject(new Error(`Claude error: ${data.data}`))
        }
      }

      eventSource.onerror = (err: Event) => {
        console.error('Stream error:', err)
        eventSource.close()
        reject(new Error('Stream connection error'))
      }

      // Send message after stream is set up
      setTimeout(async () => {
        console.log(`[${new Date().toISOString()}] Sending message...`)
        try {
          const msgResp = await fetch(`${BRIDGE_URL}/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: 'Return only this exact JSON array with no markdown or explanation: [{"selector":"button","type":"style","value":{"background-color":"orange"},"enabled":true}]',
              files: []
            })
          })

          const msgResult = await msgResp.json()
          console.log('✓ Message sent:', msgResult)
        } catch (error) {
          console.error('Failed to send message:', error)
          eventSource.close()
          reject(error)
        }
      }, 100)

      // Timeout after 45 seconds
      setTimeout(() => {
        console.error('Timeout after 45s')
        eventSource.close()
        reject(new Error('Timeout after 45s'))
      }, 45000)
    })

    console.log('Full response received:', responseText.substring(0, 500))
    expect(responseText).toBeTruthy()
    expect(responseText.length).toBeGreaterThan(0)

    // Try to parse as JSON
    let cleanedResponse = responseText.trim()
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    console.log('Cleaned response:', cleanedResponse)
    const parsed = JSON.parse(cleanedResponse)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
    console.log('✓ Successfully parsed as JSON array with', parsed.length, 'DOM changes')
    console.log('First change:', JSON.stringify(parsed[0], null, 2))
  })
})
