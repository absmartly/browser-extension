import { test, expect } from '../fixtures/extension'
import { spawn, ChildProcess } from 'child_process'

let bridgeProcess: ChildProcess | null = null
const BRIDGE_PORT = 3020

async function startBridge(): Promise<void> {
  return new Promise((resolve, reject) => {
    bridgeProcess = spawn('claude-code-bridge', [], {
      env: {
        ...process.env,
        PORT: String(BRIDGE_PORT)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    bridgeProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      console.log('[Bridge]', output)

      if (output.includes('Ready for connections')) {
        resolve()
      }
    })

    bridgeProcess.stderr?.on('data', (data) => {
      console.error('[Bridge Error]', data.toString())
    })

    bridgeProcess.on('error', (err) => {
      reject(err)
    })

    setTimeout(() => {
      reject(new Error('Bridge startup timeout'))
    }, 10000)
  })
}

async function stopBridge(): Promise<void> {
  if (bridgeProcess) {
    bridgeProcess.kill('SIGTERM')
    bridgeProcess = null
  }
}

test.describe('Claude Code Bridge Integration', () => {
  test.beforeAll(async () => {
    console.log('Starting Claude Code Bridge server...')
    await startBridge()
    console.log('Bridge server started successfully')

    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  test.afterAll(async () => {
    console.log('Stopping Claude Code Bridge server...')
    await stopBridge()
  })

  test('bridge server health check', async () => {
    const response = await fetch(`http://localhost:${BRIDGE_PORT}/health`)
    const data = await response.json()

    expect(response.ok).toBe(true)
    expect(data.ok).toBe(true)
    expect(data.authenticated).toBe(true)
    expect(data.subscriptionType).toBe('max')
  })

  test('bridge auth status endpoint', async () => {
    const response = await fetch(`http://localhost:${BRIDGE_PORT}/auth/status`)
    const data = await response.json()

    expect(response.ok).toBe(true)
    expect(data.authenticated).toBe(true)
    expect(data.subscriptionType).toBe('max')
  })

  test('extension connects to bridge and generates DOM changes', async ({ page, extensionId }) => {
    await page.goto('https://example.com')

    const sidebarUrl = `chrome-extension://${extensionId}/sidepanel.html`
    await page.goto(sidebarUrl)

    await page.waitForSelector('#settings-nav-button', { state: 'visible' })
    await page.click('#settings-nav-button')

    await page.waitForLoadState('networkidle')

    await page.waitForSelector('text=AI Provider', { timeout: 10000 })

    const apiEndpointInput = page.locator('input[placeholder*="api.absmartly"]').first()
    await apiEndpointInput.waitFor({ state: 'visible', timeout: 5000 })
    await apiEndpointInput.clear()
    await apiEndpointInput.fill('http://demo.absmartly.io:8090/v1')

    await page.waitForTimeout(500)

    const applicationInput = page.locator('input[placeholder*="website"]').first()
    await applicationInput.waitFor({ state: 'visible', timeout: 5000 })
    await applicationInput.clear()
    await applicationInput.fill('e2e-test-app')

    await page.waitForTimeout(500)

    const environmentInput = page.locator('input[placeholder*="production"]').first()
    await environmentInput.waitFor({ state: 'visible', timeout: 5000 })
    await environmentInput.clear()
    await environmentInput.fill('development')

    await page.waitForTimeout(500)

    const saveButton = page.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    await page.waitForTimeout(1000)

    const notification = page.locator('text=/Settings saved|Configuration saved/i')
    await notification.waitFor({ state: 'visible', timeout: 5000 })

    console.log('✓ Settings configured')

    await page.goto(sidebarUrl)
    await page.waitForLoadState('networkidle')

    await page.waitForSelector('#experiments-nav-button', { state: 'visible', timeout: 10000 })
    await page.click('#experiments-nav-button')

    await page.waitForTimeout(1000)

    const createButton = page.locator('#create-experiment-button')
    await createButton.first().waitFor({ state: 'visible', timeout: 5000 })
    await createButton.first().click()

    await page.waitForTimeout(500)

    const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first()
    await nameInput.waitFor({ state: 'visible', timeout: 5000 })
    await nameInput.fill('Bridge Test Experiment')

    await page.waitForTimeout(500)

    const saveExperimentButton = page.locator('#save-experiment-button, #create-experiment-draft-button')
    await saveExperimentButton.first().waitFor({ state: 'visible', timeout: 5000 })
    await saveExperimentButton.first().click()

    await page.waitForTimeout(2000)

    console.log('✓ Experiment created')

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html#ai-chat`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea[placeholder*="AI" i], textarea[placeholder*="Claude" i]').first()
    await textarea.waitFor({ state: 'visible', timeout: 10000 })

    await textarea.fill('Change the h1 text to "Hello from Bridge!"')

    const sendButton = page.locator('#ai-send-button, button[type="submit"]').first()
    await sendButton.waitFor({ state: 'visible', timeout: 5000 })

    console.log('Sending AI request to bridge...')
    await sendButton.click()

    console.log('Waiting for AI response...')
    const assistantMessage = page.locator('.bg-gray-100, [role="assistant"], .assistant-message').last()
    await assistantMessage.waitFor({ state: 'visible', timeout: 60000 })

    const responseText = await assistantMessage.textContent()
    console.log('AI Response received:', responseText?.substring(0, 200))

    expect(responseText).toBeTruthy()
    expect(responseText!.length).toBeGreaterThan(10)

    console.log('✓ Bridge integration test completed successfully')
  })

  test('bridge handles conversation lifecycle', async () => {
    const createResponse = await fetch(`http://localhost:${BRIDGE_PORT}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'test-session-123',
        cwd: process.cwd(),
        permissionMode: 'ask'
      })
    })

    expect(createResponse.ok).toBe(true)
    const createData = await createResponse.json()
    expect(createData.success).toBe(true)
    expect(createData.conversationId).toBe('test-session-123')

    console.log('✓ Conversation created')

    const messageResponse = await fetch(`http://localhost:${BRIDGE_PORT}/conversations/test-session-123/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Hello, Claude!',
        files: []
      })
    })

    expect(messageResponse.ok).toBe(true)
    const messageData = await messageResponse.json()
    expect(messageData.success).toBe(true)

    console.log('✓ Message sent to conversation')
  })

  test('bridge rejects requests when Claude CLI not started', async () => {
    const messageResponse = await fetch(`http://localhost:${BRIDGE_PORT}/conversations/nonexistent/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Test message',
        files: []
      })
    })

    expect(messageResponse.ok).toBe(false)
    expect(messageResponse.status).toBe(400)
  })
})
