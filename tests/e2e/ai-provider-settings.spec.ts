import { test, expect } from '../fixtures/extension'
import { injectSidebar } from './utils/test-helpers'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

test.describe('AI Provider Settings', () => {
  test('should display AI provider selection with Claude Subscription by default', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await sidebar.locator('#settings-nav-button').waitFor({ state: 'visible' })
    await sidebar.locator('#settings-nav-button').click()

    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    const selectedValue = await aiProviderSelect.inputValue()
    expect(selectedValue).toBe('claude-subscription')

    const bridgeInstructions = sidebar.locator('text=/Claude Subscription requires/i')
    await bridgeInstructions.waitFor({ state: 'visible', timeout: 2000 })

    const loginCommand = sidebar.locator('code:has-text("npx @anthropic-ai/claude-code login")')
    await expect(loginCommand).toBeVisible()

    const bridgeCommand = sidebar.locator('code:has-text("npx @absmartly/claude-code-bridge")')
    await expect(bridgeCommand).toBeVisible()

    console.log('✓ AI Provider section displays correctly with Claude Subscription default')
  })

  test('should show API key input when switching to Anthropic API', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await sidebar.locator('#settings-nav-button').waitFor({ state: 'visible' })
    await sidebar.locator('#settings-nav-button').click()


    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#claude-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 2000 })
    await expect(apiKeyInput).toBeVisible()

    const anthropicLink = sidebar.locator('a[href="https://console.anthropic.com/"]')
    await expect(anthropicLink).toBeVisible()

    const bridgeInstructions = sidebar.locator('text=/Claude Subscription requires/i')
    await expect(bridgeInstructions).not.toBeVisible()

    console.log('✓ Anthropic API option shows API key input')
  })

  test('should show warning when selecting OpenAI API', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await sidebar.locator('#settings-nav-button').waitFor({ state: 'visible' })
    await sidebar.locator('#settings-nav-button').click()


    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    await aiProviderSelect.selectOption('openai-api')

    const warningMessage = sidebar.locator('text=/OpenAI API integration is not yet implemented/i')
    await warningMessage.waitFor({ state: 'visible', timeout: 2000 })
    await expect(warningMessage).toBeVisible()

    console.log('✓ OpenAI API shows not implemented warning')
  })

  test('should persist AI provider selection', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await sidebar.locator('#settings-nav-button').waitFor({ state: 'visible' })
    await sidebar.locator('#settings-nav-button').click()


    const apiEndpointInput = sidebar.locator('#absmartly-endpoint')
    await apiEndpointInput.waitFor({ state: 'visible', timeout: 5000 })
    await apiEndpointInput.fill('http://demo.absmartly.io:8090/v1')

    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#claude-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 2000 })
    await apiKeyInput.fill('sk-ant-test-key-12345')

    const saveButton = sidebar.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    await sidebar.locator('#settings-nav-button').waitFor({ state: 'visible' })
    await sidebar.locator('#settings-nav-button').click()

    const savedAiProvider = sidebar.locator('#ai-provider-select')
    await savedAiProvider.waitFor({ state: 'visible', timeout: 5000 })
    const savedValue = await savedAiProvider.inputValue()
    expect(savedValue).toBe('anthropic-api')

    const savedApiKey = sidebar.locator('#claude-api-key')
    await savedApiKey.waitFor({ state: 'visible', timeout: 2000 })
    const savedKeyValue = await savedApiKey.inputValue()
    expect(savedKeyValue).toBe('sk-ant-test-key-12345')

    console.log('✓ AI provider and API key persisted correctly')
  })

  test('should connect to Claude Code Bridge when available', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await sidebar.locator('#settings-nav-button').waitFor({ state: 'visible' })
    await sidebar.locator('#settings-nav-button').click()


    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    const selectedValue = await aiProviderSelect.inputValue()
    if (selectedValue !== 'claude-subscription') {
      await aiProviderSelect.selectOption('claude-subscription')
    }

    await page.waitFor({ timeout: 2000 })

    const connectionStatus = sidebar.locator('text=/Connected|Not Connected|Connecting/i')
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

    await sidebar.locator('#settings-nav-button').waitFor({ state: 'visible' })
    await sidebar.locator('#settings-nav-button').click()


    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('claude-subscription')

    const advancedToggle = sidebar.locator('#advanced-port-config-summary')
    await advancedToggle.waitFor({ state: 'visible', timeout: 2000 })
    await advancedToggle.click()

    const customPortInput = sidebar.locator('#custom-bridge-port')
    await customPortInput.waitFor({ state: 'visible', timeout: 2000 })
    await expect(customPortInput).toBeVisible()

    await customPortInput.fill('3010')

    const testButton = sidebar.locator('#test-bridge-connection')
    await testButton.click()

    await page.waitFor({ timeout: 1000 })

    console.log('✓ Custom port configuration is accessible')
  })
})
