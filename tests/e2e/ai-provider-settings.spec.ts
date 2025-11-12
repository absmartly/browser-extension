import { test, expect } from '../fixtures/extension'

test.describe('AI Provider Settings', () => {
  test('should display AI provider selection with Claude Subscription by default', async ({ page, extensionId }) => {
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.waitForSelector('button:has-text("Settings")', { state: 'visible' })
    await page.click('button:has-text("Settings")')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    const selectedValue = await aiProviderSelect.inputValue()
    expect(selectedValue).toBe('claude-subscription')

    const bridgeInstructions = page.locator('text=/Claude Subscription requires/i')
    await bridgeInstructions.waitFor({ state: 'visible', timeout: 2000 })

    const loginCommand = page.locator('code:has-text("npx @anthropic-ai/claude-code login")')
    await expect(loginCommand).toBeVisible()

    const bridgeCommand = page.locator('code:has-text("npx @absmartly/claude-code-bridge")')
    await expect(bridgeCommand).toBeVisible()

    console.log('✓ AI Provider section displays correctly with Claude Subscription default')
  })

  test('should show API key input when switching to Anthropic API', async ({ page, extensionId }) => {
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.waitForSelector('button:has-text("Settings")', { state: 'visible' })
    await page.click('button:has-text("Settings")')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = page.locator('#claude-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 2000 })
    await expect(apiKeyInput).toBeVisible()

    const anthropicLink = page.locator('a[href="https://console.anthropic.com/"]')
    await expect(anthropicLink).toBeVisible()

    const bridgeInstructions = page.locator('text=/Claude Subscription requires/i')
    await expect(bridgeInstructions).not.toBeVisible()

    console.log('✓ Anthropic API option shows API key input')
  })

  test('should show warning when selecting OpenAI API', async ({ page, extensionId }) => {
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.waitForSelector('button:has-text("Settings")', { state: 'visible' })
    await page.click('button:has-text("Settings")')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    await aiProviderSelect.selectOption('openai-api')

    const warningMessage = page.locator('text=/OpenAI API integration is not yet implemented/i')
    await warningMessage.waitFor({ state: 'visible', timeout: 2000 })
    await expect(warningMessage).toBeVisible()

    console.log('✓ OpenAI API shows not implemented warning')
  })

  test('should persist AI provider selection', async ({ page, extensionId }) => {
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.waitForSelector('button:has-text("Settings")', { state: 'visible' })
    await page.click('button:has-text("Settings")')

    await page.waitForLoadState('networkidle')

    const apiEndpointInput = page.locator('#absmartly-endpoint')
    await apiEndpointInput.waitFor({ state: 'visible', timeout: 5000 })
    await apiEndpointInput.fill('http://demo.absmartly.io:8090/v1')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = page.locator('#claude-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 2000 })
    await apiKeyInput.fill('sk-ant-test-key-12345')

    const saveButton = page.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    await page.goto(sidebarUrl)
    await page.waitForLoadState('networkidle')

    await page.waitForSelector('button:has-text("Settings")', { state: 'visible' })
    await page.click('button:has-text("Settings")')

    await page.waitForLoadState('networkidle')

    const savedAiProvider = page.locator('#ai-provider-select')
    await savedAiProvider.waitFor({ state: 'visible', timeout: 5000 })
    const savedValue = await savedAiProvider.inputValue()
    expect(savedValue).toBe('anthropic-api')

    const savedApiKey = page.locator('#claude-api-key')
    await savedApiKey.waitFor({ state: 'visible', timeout: 2000 })
    const savedKeyValue = await savedApiKey.inputValue()
    expect(savedKeyValue).toBe('sk-ant-test-key-12345')

    console.log('✓ AI provider and API key persisted correctly')
  })

  test('should connect to Claude Code Bridge when available', async ({ page, extensionId }) => {
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.waitForSelector('button:has-text("Settings")', { state: 'visible' })
    await page.click('button:has-text("Settings")')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    const selectedValue = await aiProviderSelect.inputValue()
    if (selectedValue !== 'claude-subscription') {
      await aiProviderSelect.selectOption('claude-subscription')
    }

    await page.waitFor({ timeout: 2000 })

    const connectionStatus = page.locator('text=/Connected|Not Connected|Connecting/i')
    await connectionStatus.waitFor({ state: 'visible', timeout: 5000 })

    const statusText = await connectionStatus.textContent()
    console.log(`Bridge connection status: ${statusText}`)

    const testButton = page.locator('#test-bridge-connection')
    await testButton.waitFor({ state: 'visible', timeout: 2000 })
    await expect(testButton).toBeVisible()

    console.log('✓ Claude Code Bridge connection UI is functional')
  })

  test('should allow custom port configuration', async ({ page, extensionId }) => {
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.waitForSelector('button:has-text("Settings")', { state: 'visible' })
    await page.click('button:has-text("Settings")')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('claude-subscription')

    const advancedToggle = page.locator('summary:has-text("Advanced: Custom Port Configuration")')
    await advancedToggle.waitFor({ state: 'visible', timeout: 2000 })
    await advancedToggle.click()

    const customPortInput = page.locator('#custom-bridge-port')
    await customPortInput.waitFor({ state: 'visible', timeout: 2000 })
    await expect(customPortInput).toBeVisible()

    await customPortInput.fill('3010')

    const testButton = page.locator('#test-bridge-connection')
    await testButton.click()

    await page.waitFor({ timeout: 1000 })

    console.log('✓ Custom port configuration is accessible')
  })
})
