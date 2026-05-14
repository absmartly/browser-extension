import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

/**
 * E2E test for the AI provider wiring in the full-screen modal (FT-1905).
 *
 * Verifies that the modal reads `aiProvider` from the user's stored
 * ABsmartly config rather than being hard-coded to `claude-subscription`.
 *
 * We seed `aiProvider: "anthropic-api"` into chrome.storage so that
 * fillExperimentFromAI() spins up the AnthropicProvider, which does NOT
 * implement `generateStructured`. The orchestrator throws a message of the
 * form:
 *   Provider "anthropic-api" does not implement structured generation. ...
 *
 * This message surfaces in #ai-fill-error inside the modal — the cleanest
 * end-to-end signal that the provider config flowed through from settings.
 *
 * If the editor were still hard-coding `aiProvider: "claude-subscription"`,
 * the BridgeProvider's `generateStructured` would run, and we would hit a
 * bridge-connection error instead (not containing "anthropic-api").
 */
test.describe('Full-screen experiment modal — provider config from settings (FT-1905)', () => {
  test('uses aiProvider from user settings (anthropic-api surfaces in #ai-fill-error)', async ({
    context,
    extensionUrl,
    seedStorage
  }) => {
    test.setTimeout(60_000)

    // Override the default config seeded by the fixture. The fixture seeds
    // `aiProvider: 'anthropic-api'` only if ANTHROPIC_API_KEY is in the env;
    // we seed it explicitly here so the test is hermetic and doesn't depend
    // on the operator's environment.
    const config = {
      apiKey: '',
      apiEndpoint: 'https://api.absmartly.test',
      authMethod: 'apikey',
      domChangesFieldName: '__dom_changes',
      vibeStudioEnabled: true,
      aiProvider: 'anthropic-api',
      aiApiKey: 'sk-test',
      llmModel: 'claude-sonnet-4-5',
      providerModels: { 'anthropic-api': 'claude-sonnet-4-5' },
      providerEndpoints: {}
    }
    await seedStorage({
      'absmartly-config': config,
      'plasmo:absmartly-config': config,
      'ai-apikey': 'sk-test',
      'plasmo:ai-apikey': 'sk-test'
    })

    const testPage = await context.newPage()
    const { sidebar } = await setupTestPage(
      testPage,
      extensionUrl,
      '/visual-editor-test.html'
    )

    // Open Create-experiment dropdown then "From scratch".
    await sidebar.locator('button[title="Create New Experiment"]').click()
    const fromScratchButton = sidebar.locator('#from-scratch-button')
    await fromScratchButton.waitFor({ state: 'visible', timeout: 10_000 })
    await fromScratchButton.click()

    await sidebar
      .locator('#create-experiment-header')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // Trigger the full-screen modal.
    await sidebar.locator('#open-fullscreen-button').click()

    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // Click AI Fill → Skip & Fill. With aiProvider=anthropic-api, the
    // AnthropicProvider has no generateStructured() and the orchestrator
    // throws "Provider \"anthropic-api\" does not implement structured
    // generation." That message lands in #ai-fill-error.
    await sidebar.locator('#ai-fill-button').click()
    const skipButton = sidebar.locator('#ai-fill-prompt-skip')
    await skipButton.waitFor({ state: 'visible', timeout: 5_000 })
    await skipButton.click()

    const errorEl = sidebar.locator('#ai-fill-error')
    await errorEl.waitFor({ state: 'visible', timeout: 10_000 })
    const errorText = (await errorEl.textContent())?.trim() || ''
    expect(errorText.length).toBeGreaterThan(0)
    expect(errorText).toContain('anthropic-api')
    expect(errorText).toContain('does not implement structured generation')
  })
})
