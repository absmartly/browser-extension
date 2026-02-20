import { describe, it, expect } from '@jest/globals'

describe('Claude Code Bridge Integration', () => {
  const BRIDGE_URL = 'http://localhost:3000'

  it('should create conversation and receive response', async () => {
    // 1. Create conversation
    const convResp = await fetch(`${BRIDGE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: `test-${Date.now()}`,
        cwd: '/',
        permissionMode: 'allow'
      })
    })

    expect(convResp.ok).toBe(true)
    const { conversationId } = await convResp.json()
    expect(conversationId).toBeTruthy()
    console.log('✓ Conversation created:', conversationId)

    // 2. Set up stream listener
    const responseText = await new Promise<string>((resolve, reject) => {
      let fullResponse = ''
      const eventSource = new EventSource(`${BRIDGE_URL}/conversations/${conversationId}/stream`)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log('Event:', data.type, data.data?.substring(0, 50))

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

      eventSource.onerror = (err) => {
        console.error('Stream error:', err)
        eventSource.close()
        reject(new Error('Stream connection error'))
      }

      // 3. Send message after stream is set up
      setTimeout(async () => {
        console.log('Sending message...')
        const msgResp = await fetch(`${BRIDGE_URL}/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Return only this exact JSON array with no explanation: [{"selector":"button","type":"style","value":{"background-color":"orange"},"enabled":true}]',
            files: []
          })
        })

        const msgResult = await msgResp.json()
        console.log('✓ Message sent:', msgResult)
      }, 100)

      // Timeout after 30 seconds
      setTimeout(() => {
        eventSource.close()
        reject(new Error('Timeout after 30s'))
      }, 30000)
    })

    expect(responseText).toBeTruthy()
    expect(responseText.length).toBeGreaterThan(0)
    console.log('Response preview:', responseText.substring(0, 200))

    // Try to parse as JSON
    let cleanedResponse = responseText.trim()
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(cleanedResponse)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
    console.log('✓ Parsed as JSON array with', parsed.length, 'changes')
  }, 60000) // 60 second timeout for this test

  it('should check bridge health', async () => {
    const resp = await fetch(`${BRIDGE_URL}/health`)
    expect(resp.ok).toBe(true)

    const health = await resp.json()
    expect(health.ok).toBe(true)
    expect(health.authenticated).toBe(true)
    console.log('Bridge health:', health)
  })
})
