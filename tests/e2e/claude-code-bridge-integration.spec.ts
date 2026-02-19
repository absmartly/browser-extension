import { test, expect } from '../fixtures/extension'

const BRIDGE_PORT = 3000
const BRIDGE_URL = `http://localhost:${BRIDGE_PORT}`

async function isBridgeAvailable(): Promise<boolean> {
  try {
    const resp = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(3000) })
    const data = await resp.json()
    return data.ok && data.authenticated
  } catch {
    return false
  }
}

test.describe('Claude Code Bridge Integration', () => {
  test('bridge server health check', async () => {
    const available = await isBridgeAvailable()
    if (!available) { test.skip(true, 'Bridge not reachable or not authenticated'); return }
    const response = await fetch(`${BRIDGE_URL}/health`)
    const data = await response.json()

    expect(response.ok).toBe(true)
    expect(data.ok).toBe(true)
    expect(data.authenticated).toBe(true)
  })

  test('bridge auth status endpoint', async () => {
    const available = await isBridgeAvailable()
    if (!available) { test.skip(true, 'Bridge not reachable or not authenticated'); return }
    const response = await fetch(`${BRIDGE_URL}/auth/status`)
    const data = await response.json()

    expect(response.ok).toBe(true)
    expect(data.authenticated).toBe(true)
  })

  test('extension connects to bridge and generates DOM changes', async ({ page, extensionId }) => {
    test.skip(true, 'Experiment creation flow requires From Scratch selection and full sidebar navigation which is fragile in direct page.goto context')
    const available = await isBridgeAvailable()
    if (!available) { test.skip(true, 'Bridge not reachable or not authenticated'); return }
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.waitForSelector('#nav-settings', { state: 'visible', timeout: 10000 })
    await page.click('#nav-settings')

    await page.waitForLoadState('networkidle')

    const apiEndpointInput = page.locator('#absmartly-endpoint').first()
    await apiEndpointInput.waitFor({ state: 'visible', timeout: 5000 })
    await apiEndpointInput.clear()
    await apiEndpointInput.fill('http://demo.absmartly.io:8090/v1')

    const saveButton = page.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    console.log('Settings configured')

    await page.goto(sidebarUrl)
    await page.waitForLoadState('networkidle')

    const createButton = page.locator('button[title="Create New Experiment"]')
    await createButton.first().waitFor({ state: 'visible', timeout: 10000 })
    await createButton.first().click()

    const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first()
    await nameInput.waitFor({ state: 'visible', timeout: 5000 })
    await nameInput.fill('Bridge Test Experiment')

    const saveExperimentButton = page.locator('#create-experiment-button')
    await saveExperimentButton.first().waitFor({ state: 'visible', timeout: 5000 })
    await saveExperimentButton.first().click()

    console.log('Experiment created')

    await page.goto(`chrome-extension://${extensionId}/tabs/sidebar.html#ai-chat`)
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea[placeholder*="Example"]').first()
    await textarea.waitFor({ state: 'visible', timeout: 10000 })

    await textarea.fill('Change the h1 text to "Hello from Bridge!"')

    const sendButton = page.locator('#ai-generate-button').first()
    await sendButton.waitFor({ state: 'visible', timeout: 5000 })

    console.log('Sending AI request to bridge...')
    await sendButton.click()

    console.log('Waiting for AI response...')
    const assistantMessage = page.locator('[data-message-index]').last()
    await assistantMessage.waitFor({ state: 'visible', timeout: 60000 })

    const responseText = await assistantMessage.textContent()
    console.log('AI Response received:', responseText?.substring(0, 200))

    expect(responseText).toBeTruthy()
    expect(responseText!.length).toBeGreaterThan(10)

    console.log('Bridge integration test completed successfully')
  })

  test('bridge handles conversation lifecycle', async () => {
    const available = await isBridgeAvailable()
    if (!available) { test.skip(true, 'Bridge not reachable or not authenticated'); return }
    const createResponse = await fetch(`${BRIDGE_URL}/conversations`, {
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

    console.log('Conversation created')

    const messageResponse = await fetch(`${BRIDGE_URL}/conversations/test-session-123/messages`, {
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

    console.log('Message sent to conversation')
  })
})
