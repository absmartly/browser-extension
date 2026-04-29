import { test, expect } from '../fixtures/extension'
import { injectSidebar } from './utils/test-helpers'
import path from 'path'
import type { FrameLocator } from '@playwright/test'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

// SettingsView keeps `loading=true` while useSettingsForm.loadConfig awaits
// checkAuthStatus, which under workers=4 + prod-bundle CI can exceed the
// per-element 5s timeout. While loading is true the AI provider section
// isn't rendered, so the bare nav-settings click + ai-provider-select wait
// pattern times out. Block on the loading spinner clearing instead.
async function openSettings(sidebar: FrameLocator): Promise<void> {
  const settingsButton = sidebar.locator('#nav-settings')
  await settingsButton.waitFor({ state: 'visible', timeout: 10000 })
  await settingsButton.click()
  await sidebar
    .locator('[aria-label="Loading settings"]')
    .waitFor({ state: 'hidden', timeout: 15000 })
    .catch(() => {})
}

test.describe('AI Provider Settings', () => {
  test('should display AI provider selection with Claude Subscription by default', async ({ page, extensionId, extensionUrl, seedStorage }) => {
    // This test asserts the first-install default. The shared fixture seeds
    // aiProvider=anthropic-api whenever ANTHROPIC_API_KEY is set in the env,
    // which masks the default. Explicitly re-seed a config that has no
    // aiProvider so the UI falls back to its claude-subscription default.
    await seedStorage({
      'absmartly-config': {
        apiKey: '',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || '',
        authMethod: process.env.PLASMO_PUBLIC_ABSMARTLY_AUTH_METHOD || 'apikey',
        domChangesFieldName: '__dom_changes',
        vibeStudioEnabled: true
      }
    })

    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await sidebar.locator('#nav-settings').waitFor({ state: 'visible' })
    await sidebar.locator('#nav-settings').click()
    await sidebar
      .locator('[aria-label="Loading settings"]')
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {})

    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 15000 })

    const selectedValue = await aiProviderSelect.inputValue()
    expect(selectedValue).toBe('claude-subscription')

    const bridgeInstructions = sidebar.locator('#claude-subscription-instructions')
    const bridgeStatus = sidebar.locator('#bridge-connection-status')
    const instructionsVisible = await bridgeInstructions.isVisible().catch(() => false)
    const statusVisible = await bridgeStatus.isVisible().catch(() => false)

    if (instructionsVisible) {
      await expect(sidebar.locator('#claude-login-command')).toBeVisible()
      await expect(sidebar.locator('#bridge-start-command')).toBeVisible()
    }

    expect(instructionsVisible || statusVisible).toBe(true)
    console.log('✓ AI Provider section displays correctly with Claude Subscription default')
  })

  test('should show API key input when switching to Anthropic API', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await sidebar.locator('#nav-settings').waitFor({ state: 'visible' })
    await sidebar.locator('#nav-settings').click()
    await sidebar
      .locator('[aria-label="Loading settings"]')
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {})


    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 15000 })

    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 2000 })
    await expect(apiKeyInput).toBeVisible()

    const anthropicLink = sidebar.locator('a[href="https://console.anthropic.com/"]')
    await expect(anthropicLink).toBeVisible()

    const bridgeInstructions = sidebar.locator('#claude-subscription-instructions')
    await expect(bridgeInstructions).not.toBeVisible()

    console.log('✓ Anthropic API option shows API key input')
  })

  test('should show API key input when selecting OpenAI API', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await openSettings(sidebar)

    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 15000 })

    await aiProviderSelect.selectOption('openai-api')

    const apiKeyInput = sidebar.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 2000 })
    await expect(apiKeyInput).toBeVisible()

    console.log('✓ OpenAI API shows API key input')
  })

  test('should persist AI provider selection', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await openSettings(sidebar)

    const endpointInput = sidebar.locator('#absmartly-endpoint')
    await endpointInput.waitFor({ state: 'visible', timeout: 5000 })
    const currentEndpoint = await endpointInput.inputValue()
    if (!currentEndpoint) {
      await endpointInput.fill('https://demo-2.absmartly.com/v1')
    }

    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 15000 })
    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 2000 })
    await apiKeyInput.fill('sk-ant-test-key-12345')

    const saveButton = sidebar.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    await openSettings(sidebar)

    const savedAiProvider = sidebar.locator('#ai-provider-select')
    await savedAiProvider.waitFor({ state: 'visible', timeout: 5000 })
    const savedValue = await savedAiProvider.inputValue()
    expect(savedValue).toBe('anthropic-api')

    const savedApiKey = sidebar.locator('#ai-api-key')
    await savedApiKey.waitFor({ state: 'visible', timeout: 2000 })
    const savedKeyValue = await savedApiKey.inputValue()
    expect(savedKeyValue).toBe('sk-ant-test-key-12345')

    console.log('✓ AI provider and API key persisted correctly')
  })

  test('should connect to Claude Code Bridge when available', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await openSettings(sidebar)

    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 15000 })

    const selectedValue = await aiProviderSelect.inputValue()
    if (selectedValue !== 'claude-subscription') {
      await aiProviderSelect.selectOption('claude-subscription')
    }

    await page.waitForLoadState('networkidle')

    const connectionStatus = sidebar.locator('#bridge-connection-status')
    await connectionStatus.waitFor({ state: 'visible', timeout: 5000 })

    const statusText = await connectionStatus.textContent()
    console.log(`Bridge connection status: ${statusText}`)

    const testButton = sidebar.locator('#test-bridge-connection')
    await testButton.waitFor({ state: 'visible', timeout: 2000 })
    await expect(testButton).toBeVisible()

    console.log('✓ Claude Code Bridge connection UI is functional')
  })

  test('should allow custom port configuration', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await openSettings(sidebar)

    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 15000 })
    await aiProviderSelect.selectOption('claude-subscription')

    const advancedToggle = sidebar.locator('#advanced-endpoint-config-summary')
    await advancedToggle.waitFor({ state: 'visible', timeout: 2000 })
    await advancedToggle.click()

    const customPortInput = sidebar.locator('#custom-bridge-endpoint')
    await customPortInput.waitFor({ state: 'visible', timeout: 2000 })
    await expect(customPortInput).toBeVisible()

    await customPortInput.fill('http://localhost:3010')

    const testButton = sidebar.locator('#test-bridge-connection')
    await testButton.click()

    await page.waitForLoadState('networkidle')

    console.log('✓ Custom port configuration is accessible')
  })
})
