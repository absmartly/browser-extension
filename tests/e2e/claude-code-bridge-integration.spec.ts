import { test, expect } from '../fixtures/extension'
import { setupTestPage, click } from './utils/test-helpers'
import { createExperiment, fillMetadataForSave, saveExperiment } from './helpers/ve-experiment-setup'
import crypto from 'crypto'

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

  test('extension connects to bridge and generates DOM changes', async ({ context, extensionUrl }) => {
    const available = await isBridgeAvailable()
    if (!available) { test.skip(true, 'Bridge not reachable or not authenticated'); return }

    test.setTimeout(180000)

    const testPage = await context.newPage()
    const { sidebar } = await setupTestPage(testPage, extensionUrl)

    await sidebar.locator('[role="status"][aria-label="Loading experiments"]')
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => {})

    console.log('Creating experiment...')
    const experimentName = await createExperiment(sidebar)
    console.log('Experiment form filled:', experimentName)

    console.log('Filling metadata for save...')
    await fillMetadataForSave(sidebar, testPage)

    console.log('Saving experiment...')
    await saveExperiment(sidebar, testPage, experimentName)
    console.log('Experiment saved')

    await sidebar.locator('[data-experiment-name]').first()
      .waitFor({ state: 'visible', timeout: 10000 })
    await click(sidebar, sidebar.locator('[data-experiment-name]').first())
    console.log('Opened experiment detail')

    const generateAIButton = sidebar.locator('#generate-with-ai-button').first()
    await generateAIButton.scrollIntoViewIfNeeded()
    await generateAIButton.waitFor({ state: 'visible', timeout: 15000 })
    await click(sidebar, generateAIButton)
    console.log('Clicked Generate with AI')

    const aiPrompt = sidebar.locator('#ai-prompt')
    await aiPrompt.waitFor({ state: 'visible', timeout: 10000 })

    await aiPrompt.fill('Change the h1 text to "Hello from Bridge!"')
    console.log('Sending AI request to bridge...')
    await click(sidebar, '#ai-generate-button')

    console.log('Waiting for AI response...')
    const assistantMessage = sidebar.locator('[data-message-index]').last()
    await assistantMessage.waitFor({ state: 'visible', timeout: 60000 })

    const responseText = await assistantMessage.textContent()
    console.log('AI Response received:', responseText?.substring(0, 200))

    expect(responseText).toBeTruthy()
    expect(responseText!.length).toBeGreaterThan(10)

    console.log('Bridge integration test completed successfully')
    await testPage.close()
  })

  test('bridge handles conversation lifecycle', async () => {
    const available = await isBridgeAvailable()
    if (!available) { test.skip(true, 'Bridge not reachable or not authenticated'); return }
    const conversationId = crypto.randomUUID()
    const createResponse = await fetch(`${BRIDGE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: conversationId })
    })

    expect(createResponse.ok).toBe(true)
    const createData = await createResponse.json()
    expect(createData.success).toBe(true)
    expect(createData.conversationId).toBe(conversationId)

    const messageResponse = await fetch(`${BRIDGE_URL}/conversations/${conversationId}/messages`, {
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
  })
})
