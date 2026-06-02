import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

/**
 * E2E test for the AI provider wiring in the full-screen modal (FT-1905).
 *
 * Verifies that the modal reads `aiProvider` from the user's stored
 * ABsmartly config rather than being hard-coded to `claude-subscription`.
 *
 * We seed `aiProvider: "anthropic-api"` into chrome.storage and stub
 * `window.fetch` so that any POST to `api.anthropic.com/v1/messages`
 * returns a synthetic Anthropic `tool_use` block calling
 * `fill_experiment_fields`. With both pieces in place:
 *   - The modal's AI Fill must route through `AnthropicProvider.generateStructured`
 *     (i.e. it must hit `api.anthropic.com/v1/messages`).
 *   - The form fields must populate with the values returned by the stub.
 *
 * The Anthropic endpoint capture proves the provider config flowed from
 * settings through to the API call. The field population proves the
 * tool_use response was parsed correctly.
 */
test.describe('Full-screen experiment modal — provider config from settings (FT-1905)', () => {
  test('uses aiProvider from user settings (anthropic-api hits api.anthropic.com and populates fields)', async ({
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

    // Stub `window.fetch` so any POST to api.anthropic.com/v1/messages
    // returns a synthetic Anthropic `tool_use` response calling
    // `fill_experiment_fields`. Tracks every Anthropic call so we can assert
    // the provider actually reached the Anthropic API.
    await context.addInitScript(() => {
      const realFetch = window.fetch.bind(window)
      ;(window as any).__anthropicCalls = [] as string[]

      function jsonResponse(body: unknown, status = 200): Response {
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' }
        })
      }

      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url

        // Capture and stub Anthropic messages endpoint.
        if (/api\.anthropic\.com\/v1\/messages$/.test(urlStr)) {
          ;(window as any).__anthropicCalls.push(
            `${(init?.method || 'GET').toUpperCase()} ${urlStr}`
          )
          return jsonResponse({
            id: 'msg_stub_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-sonnet-4-5',
            stop_reason: 'tool_use',
            content: [
              {
                type: 'tool_use',
                id: 'toolu_stub_1',
                name: 'fill_experiment_fields',
                input: {
                  display_name: 'AI-Generated Test',
                  name: 'ai_generated_test',
                  hypothesis:
                    'We believe the new layout improves engagement.',
                  prediction: '+3% conversion lift',
                  description: 'Filled by the AI end-to-end test.',
                  audience: '{"filter":[{"and":[]}]}',
                  audience_strict: false,
                  percentage_of_traffic: 100,
                  percentages: '50/50'
                }
              }
            ]
          })
        }
        return realFetch(input as any, init as any)
      }) as typeof window.fetch
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
    // AnthropicProvider.generateStructured() now runs, posts to
    // api.anthropic.com/v1/messages (captured by our fetch stub above),
    // and the tool_use response populates the form fields.
    await sidebar.locator('#ai-fill-button').click()
    const skipButton = sidebar.locator('#ai-fill-prompt-skip')
    await skipButton.waitFor({ state: 'visible', timeout: 5_000 })
    await skipButton.click()

    // Wait for the AI fill to populate the modal fields. This proves the
    // tool_use response from api.anthropic.com flowed back through the form.
    const fsDisplay = sidebar.locator('#fs-display-name-input')
    const fsName = sidebar.locator('#fs-experiment-name-input')
    await expect(fsDisplay).toHaveValue('AI-Generated Test', {
      timeout: 15_000
    })
    await expect(fsName).toHaveValue('ai_generated_test', { timeout: 15_000 })

    // Confirm the AnthropicProvider actually hit the Anthropic API endpoint —
    // this proves the provider config from settings flowed all the way to
    // the underlying HTTP call (and not to the Claude Subscription bridge).
    const anthropicCalls = await sidebar
      .locator('body')
      .evaluate(() => (window as any).__anthropicCalls as string[])
    expect(anthropicCalls.length).toBeGreaterThan(0)
    expect(anthropicCalls[0]).toContain('POST')
    expect(anthropicCalls[0]).toContain('api.anthropic.com/v1/messages')
  })
})
