import { test, expect } from '../fixtures/extension'
import { setupTestPage, click } from '../e2e/utils/test-helpers'
import { createExperiment, fillMetadataForSave, saveExperiment } from '../e2e/helpers/ve-experiment-setup'

// Explicitly opt in through the separate integration config. Never run in routine CI.
test.use({ liveAI: true, liveBackend: true })

test.describe('Live provider compatibility', () => {
  test('extension generates DOM changes via Anthropic API', async ({ context, extensionUrl }) => {
    test.setTimeout(180000)

    const testPage = await context.newPage()
    const { sidebar } = await setupTestPage(testPage, extensionUrl)

    await sidebar.locator('[role="status"][aria-label="Loading experiments"]')
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => {})

    const experimentName = await createExperiment(sidebar)
    await fillMetadataForSave(sidebar, testPage)
    const createdName = await sidebar.locator('#experiment-name-input').inputValue()
    await saveExperiment(sidebar, testPage, experimentName)

    const createdRow = sidebar.locator(`[data-experiment-name=${JSON.stringify(createdName)}]`)
    await createdRow.waitFor({ state: 'visible', timeout: 10000 })
    await click(sidebar, createdRow)

    const generateAIButton = sidebar.locator('#generate-with-ai-button').first()
    await generateAIButton.scrollIntoViewIfNeeded()
    await generateAIButton.waitFor({ state: 'visible', timeout: 15000 })
    await click(sidebar, generateAIButton)

    const aiPrompt = sidebar.locator('#ai-prompt')
    await aiPrompt.waitFor({ state: 'visible', timeout: 10000 })
    await aiPrompt.fill('Use the DOM-change tool to change the h1 text to "Hello from Anthropic!". Apply the change, not just describe it.')
    const modelResponse = context.waitForEvent('response', {
      predicate: response => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/messages'),
      timeout: 90000
    })
    await click(sidebar, '#ai-generate-button')
    const response = await modelResponse
    expect(response.status(), 'Live provider response (a quota error is not generation success)').toBe(200)

    // The last message immediately after click is the USER prompt. Require
    // the rendered assistant role and actual generated changes as well.
    const assistantMessage = sidebar.locator('[data-message-index].justify-start').last()
    await assistantMessage.waitFor({ state: 'visible', timeout: 60000 })

    const responseText = await assistantMessage.textContent()
    expect(responseText).toBeTruthy()
    expect(responseText!.length).toBeGreaterThan(10)
    await expect.poll(async () => sidebar.locator('body').evaluate(() =>
      JSON.stringify((window as any).__absmartlyLatestDomChanges?.changes || [])
    )).toContain('Hello from Anthropic!')

    await testPage.close()
  })
})
