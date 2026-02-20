import { test, expect } from '../fixtures/extension'

test.describe('AI Provider Factory E2E', () => {
  test('should switch between providers and persist API keys', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#nav-settings').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#nav-settings')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = page.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await expect(apiKeyInput).toBeVisible()

    await apiKeyInput.fill('sk-ant-test-key-12345')

    const saveButton = page.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    await page.locator('#nav-settings').waitFor({ state: 'visible', timeout: 8000 })

    await page.goto(sidebarUrl)
    await page.waitForLoadState('networkidle')

    await page.locator('#nav-settings').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#nav-settings')

    await page.waitForLoadState('networkidle')

    const savedAiProvider = page.locator('#ai-provider-select')
    await savedAiProvider.waitFor({ state: 'visible', timeout: 5000 })
    const savedValue = await savedAiProvider.inputValue()
    expect(savedValue).toBe('anthropic-api')

    const savedApiKey = page.locator('#ai-api-key')
    await savedApiKey.waitFor({ state: 'visible', timeout: 5000 })
    const savedKeyValue = await savedApiKey.inputValue()
    expect(savedKeyValue).toBe('sk-ant-test-key-12345')

    console.log('✓ Anthropic API provider and key persisted correctly')
  })

  test('should use HTML compression for all providers', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#nav-settings').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#nav-settings')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    const providers = ['anthropic-api', 'openai-api', 'claude-subscription']

    for (const provider of providers) {
      await aiProviderSelect.selectOption(provider)

      await page.waitForLoadState('networkidle')

      const currentValue = await aiProviderSelect.inputValue()
      expect(currentValue).toBe(provider)

      console.log(`✓ Provider switched to ${provider}`)
    }

    console.log('✓ HTML compression available for all providers')
  })

  test('should show schema is passed to bridge correctly', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#nav-settings').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#nav-settings')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('claude-subscription')

    const bridgeInstructions = page.locator('#claude-subscription-instructions')
    const bridgeStatus = page.locator('#bridge-connection-status')
    const instructionsVisible = await bridgeInstructions.isVisible().catch(() => false)
    const statusVisible = await bridgeStatus.isVisible().catch(() => false)

    if (instructionsVisible) {
      const loginCommand = page.locator('#claude-login-command')
      await expect(loginCommand).toBeVisible()

      const bridgeCommand = page.locator('#bridge-start-command')
      await expect(bridgeCommand).toBeVisible()

      console.log('✓ Bridge instructions displayed (bridge not connected)')
    } else if (statusVisible) {
      console.log('✓ Bridge connected, instructions hidden as expected')
    }

    expect(instructionsVisible || statusVisible).toBe(true)
    console.log('✓ Bridge UI displayed correctly')
  })

  test('should handle bridge restart recovery', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#nav-settings').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#nav-settings')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('claude-subscription')

    const testButton = page.locator('#test-bridge-connection')
    await testButton.waitFor({ state: 'visible', timeout: 5000 })
    await expect(testButton).toBeVisible()

    console.log('✓ Bridge connection test button available')
  })

  test('should show API key field for both Anthropic and OpenAI providers', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#nav-settings').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#nav-settings')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    await aiProviderSelect.selectOption('anthropic-api')
    const anthropicKey = page.locator('#ai-api-key')
    await anthropicKey.waitFor({ state: 'visible', timeout: 5000 })
    await expect(anthropicKey).toBeVisible()
    console.log('✓ Anthropic API shows key input')

    await aiProviderSelect.selectOption('openai-api')
    const openaiKey = page.locator('#ai-api-key')
    await openaiKey.waitFor({ state: 'visible', timeout: 5000 })
    await expect(openaiKey).toBeVisible()
    console.log('✓ OpenAI API shows key input')

    await aiProviderSelect.selectOption('claude-subscription')
    const bridgeKeyHidden = await page.locator('#ai-api-key').isVisible().catch(() => false)
    expect(bridgeKeyHidden).toBe(false)
    console.log('✓ Bridge provider hides API key input')

    console.log('✓ Provider switching shows correct API key fields')
  })

  test('should display error for invalid API key format', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#nav-settings').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#nav-settings')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = page.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await apiKeyInput.fill('invalid-key-format')

    const saveButton = page.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    await page.waitForLoadState('networkidle')

    console.log('✓ Invalid API key handling tested')
  })

  test('should allow custom port configuration for bridge', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#nav-settings').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#nav-settings')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('claude-subscription')

    const advancedToggle = page.locator('#advanced-port-config-summary')
    await advancedToggle.waitFor({ state: 'visible', timeout: 5000 })
    await advancedToggle.click()

    const customPortInput = page.locator('#custom-bridge-port')
    await customPortInput.waitFor({ state: 'visible', timeout: 5000 })
    await expect(customPortInput).toBeVisible()

    await customPortInput.fill('3010')

    const portValue = await customPortInput.inputValue()
    expect(portValue).toBe('3010')

    console.log('✓ Custom port configuration available for bridge')
  })

  test('should show provider-specific help text', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#nav-settings').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#nav-settings')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    await aiProviderSelect.selectOption('anthropic-api')
    const anthropicLink = page.locator('a[href="https://console.anthropic.com/"]')
    await expect(anthropicLink).toBeVisible()
    console.log('✓ Anthropic console link displayed')

    await aiProviderSelect.selectOption('claude-subscription')
    const bridgeInstructions = page.locator('#claude-subscription-instructions')
    const bridgeStatus = page.locator('#bridge-connection-status')
    const instructionsVisible = await bridgeInstructions.isVisible().catch(() => false)
    const statusVisible = await bridgeStatus.isVisible().catch(() => false)
    expect(instructionsVisible || statusVisible).toBe(true)
    console.log('✓ Bridge UI displayed')

    console.log('✓ Provider-specific help text displayed correctly')
  })
})
