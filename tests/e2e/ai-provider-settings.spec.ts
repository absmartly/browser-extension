import { test, expect } from '../fixtures/extension'
import { injectSidebar } from './utils/test-helpers'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

test.describe('AI Provider Settings', () => {
  test('should display AI provider selection with Claude Subscription by default', async ({ page, extensionId, extensionUrl }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    const sidebar = await injectSidebar(page, extensionUrl)

    await sidebar.locator('#nav-settings').waitFor({ state: 'visible' })
    await sidebar.locator('#nav-settings').click()

    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

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


    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

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

    await sidebar.locator('#nav-settings').waitFor({ state: 'visible' })
    await sidebar.locator('#nav-settings').click()

    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

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

    await sidebar.locator('#nav-settings').waitFor({ state: 'visible' })
    await sidebar.locator('#nav-settings').click()

    const endpointInput = sidebar.locator('#absmartly-endpoint')
    await endpointInput.waitFor({ state: 'visible', timeout: 5000 })
    const currentEndpoint = await endpointInput.inputValue()
    if (!currentEndpoint) {
      await endpointInput.fill('https://demo-2.absmartly.com/v1')
    }

    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 2000 })
    await apiKeyInput.fill('sk-ant-test-key-12345')

    const saveButton = sidebar.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.evaluate((el: HTMLElement) => el.click())

    await sidebar.locator('#nav-settings').waitFor({ state: 'visible', timeout: 10000 })
    await sidebar.locator('#nav-settings').click()

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

    await sidebar.locator('#nav-settings').waitFor({ state: 'visible' })
    await sidebar.locator('#nav-settings').click()


    const aiProviderSelect = sidebar.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

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

    await sidebar.locator('#nav-settings').waitFor({ state: 'visible' })
    await sidebar.locator('#nav-settings').click()


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

    await page.waitForLoadState('networkidle')

    console.log('✓ Custom port configuration is accessible')
  })
})
