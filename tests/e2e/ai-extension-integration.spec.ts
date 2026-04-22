import { test, expect } from '../fixtures/extension'
import { setupTestPage, click } from './utils/test-helpers'
import { createExperiment, fillMetadataForSave, saveExperiment } from './helpers/ve-experiment-setup'

test.describe('Extension AI Integration (Anthropic API)', () => {
  test('extension generates DOM changes via Anthropic API', async ({ context, extensionUrl, seedStorage }) => {
    test.setTimeout(180000)

    // Prefer the proxy-specific key when the endpoint is the internal proxy;
    // otherwise use the direct Anthropic key.
    const anthropicEndpoint = process.env.PLASMO_PUBLIC_ANTHROPIC_ENDPOINT || ''
    const anthropicApiKey = anthropicEndpoint
      ? (process.env.PLASMO_PUBLIC_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)
      : (process.env.ANTHROPIC_API_KEY || process.env.PLASMO_PUBLIC_ANTHROPIC_API_KEY)
    test.skip(
      !anthropicApiKey,
      'ANTHROPIC_API_KEY / PLASMO_PUBLIC_ANTHROPIC_API_KEY required; test hits the real Anthropic API'
    )

    const config = {
      apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || '',
      apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || '',
      authMethod: 'apikey',
      aiProvider: 'anthropic-api',
      aiApiKey: '',
      vibeStudioEnabled: true,
      // Proxy expects model aliases (no date suffix); aliases also work
      // against api.anthropic.com.
      llmModel: 'claude-sonnet-4-5',
      providerModels: { 'anthropic-api': 'claude-sonnet-4-5' },
      providerEndpoints: anthropicEndpoint ? { 'anthropic-api': anthropicEndpoint } : {}
    }

    await seedStorage({
      'absmartly-config': config,
      'plasmo:absmartly-config': config,
      'ai-apikey': anthropicApiKey,
      'plasmo:ai-apikey': anthropicApiKey
    })

    const testPage = await context.newPage()
    const { sidebar } = await setupTestPage(testPage, extensionUrl)

    await sidebar.locator('[role="status"][aria-label="Loading experiments"]')
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => {})

    const experimentName = await createExperiment(sidebar)
    await fillMetadataForSave(sidebar, testPage)
    await saveExperiment(sidebar, testPage, experimentName)

    await sidebar.locator('[data-experiment-name]').first()
      .waitFor({ state: 'visible', timeout: 10000 })
    await click(sidebar, sidebar.locator('[data-experiment-name]').first())

    const generateAIButton = sidebar.locator('#generate-with-ai-button').first()
    await generateAIButton.scrollIntoViewIfNeeded()
    await generateAIButton.waitFor({ state: 'visible', timeout: 15000 })
    await click(sidebar, generateAIButton)

    const aiPrompt = sidebar.locator('#ai-prompt')
    await aiPrompt.waitFor({ state: 'visible', timeout: 10000 })
    await aiPrompt.fill('Change the h1 text to "Hello from Anthropic!"')
    await click(sidebar, '#ai-generate-button')

    const assistantMessage = sidebar.locator('[data-message-index]').last()
    await assistantMessage.waitFor({ state: 'visible', timeout: 60000 })

    const responseText = await assistantMessage.textContent()
    expect(responseText).toBeTruthy()
    expect(responseText!.length).toBeGreaterThan(10)

    await testPage.close()
  })
})
