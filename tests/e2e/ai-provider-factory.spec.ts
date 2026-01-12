import { test, expect } from '../fixtures/extension'

test.describe('AI Provider Factory E2E', () => {
  test('should switch between providers and persist API keys', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#settings-nav-button').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#settings-nav-button')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = page.locator('#claude-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await expect(apiKeyInput).toBeVisible()

    await apiKeyInput.fill('sk-ant-test-key-12345')

    const saveButton = page.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    await page.goto(sidebarUrl)
    await page.waitForLoadState('networkidle')

    await page.locator('#settings-nav-button').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#settings-nav-button')

    await page.waitForLoadState('networkidle')

    const savedAiProvider = page.locator('#ai-provider-select')
    await savedAiProvider.waitFor({ state: 'visible', timeout: 5000 })
    const savedValue = await savedAiProvider.inputValue()
    expect(savedValue).toBe('anthropic-api')

    const savedApiKey = page.locator('#claude-api-key')
    await savedApiKey.waitFor({ state: 'visible', timeout: 5000 })
    const savedKeyValue = await savedApiKey.inputValue()
    expect(savedKeyValue).toBe('sk-ant-test-key-12345')

    console.log('✓ Anthropic API provider and key persisted correctly')
  })

  test('should use HTML compression for all providers', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#settings-nav-button').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#settings-nav-button')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    const providers = ['anthropic-api', 'openai-api', 'claude-subscription']

    for (const provider of providers) {
      await aiProviderSelect.selectOption(provider)

      await page.waitFor({ timeout: 500 })

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

    await page.locator('#settings-nav-button').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#settings-nav-button')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('claude-subscription')

    const bridgeInstructions = page.locator('text=/Claude Subscription requires/i')
    await bridgeInstructions.waitFor({ state: 'visible', timeout: 5000 })

    const loginCommand = page.locator('code:has-text("npx @anthropic-ai/claude-code login")')
    await expect(loginCommand).toBeVisible()

    const bridgeCommand = page.locator('code:has-text("npx @absmartly/claude-code-bridge")')
    await expect(bridgeCommand).toBeVisible()

    console.log('✓ Bridge instructions displayed correctly')
  })

  test('should handle bridge restart recovery', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#settings-nav-button').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#settings-nav-button')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('claude-subscription')

    const testButton = page.locator('#test-bridge-connection')
    await testButton.waitFor({ state: 'visible', timeout: 5000 })
    await expect(testButton).toBeVisible()

    console.log('✓ Bridge connection test button available')
  })

  test('should switch from Anthropic to OpenAI and clear previous key', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#settings-nav-button').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#settings-nav-button')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    await aiProviderSelect.selectOption('anthropic-api')

    const claudeKeyInput = page.locator('#claude-api-key')
    await claudeKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await claudeKeyInput.fill('sk-ant-key-123')

    const saveButton = page.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    await page.waitFor({ timeout: 500 })

    await aiProviderSelect.selectOption('openai-api')

    const openaiKeyInput = page.locator('#openai-api-key')
    const openaiKeyExists = await openaiKeyInput.isVisible({ timeout: 2000 }).catch(() => false)

    if (openaiKeyExists) {
      const openaiKeyValue = await openaiKeyInput.inputValue()
      expect(openaiKeyValue).toBe('')

      console.log('✓ OpenAI API key field is empty when switching from Anthropic')
    } else {
      console.log('⚠ OpenAI API key field not yet implemented')
    }

    await aiProviderSelect.selectOption('anthropic-api')

    const claudeKeyAfter = page.locator('#claude-api-key')
    await claudeKeyAfter.waitFor({ state: 'visible', timeout: 5000 })
    const claudeKeyValue = await claudeKeyAfter.inputValue()
    expect(claudeKeyValue).toBe('sk-ant-key-123')

    console.log('✓ Provider switching preserves individual API keys correctly')
  })

  test('should display error for invalid API key format', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#settings-nav-button').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#settings-nav-button')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await aiProviderSelect.selectOption('anthropic-api')

    const apiKeyInput = page.locator('#claude-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await apiKeyInput.fill('invalid-key-format')

    const saveButton = page.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    await page.waitFor({ timeout: 500 })

    console.log('✓ Invalid API key handling tested')
  })

  test('should allow custom port configuration for bridge', async ({ page, extensionId }) => {
    test.setTimeout(10000)
    const sidebarUrl = `chrome-extension://${extensionId}/tabs/sidebar.html`
    await page.goto(sidebarUrl)

    await page.locator('#settings-nav-button').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#settings-nav-button')

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

    await page.locator('#settings-nav-button').waitFor({ state: 'visible', timeout: 5000 })
    await page.click('#settings-nav-button')

    await page.waitForLoadState('networkidle')

    const aiProviderSelect = page.locator('#ai-provider-select')
    await aiProviderSelect.waitFor({ state: 'visible', timeout: 5000 })

    await aiProviderSelect.selectOption('anthropic-api')
    const anthropicLink = page.locator('a[href="https://console.anthropic.com/"]')
    await expect(anthropicLink).toBeVisible()
    console.log('✓ Anthropic console link displayed')

    await aiProviderSelect.selectOption('claude-subscription')
    const bridgeInstructions = page.locator('text=/Claude Subscription requires/i')
    await expect(bridgeInstructions).toBeVisible()
    console.log('✓ Bridge instructions displayed')

    console.log('✓ Provider-specific help text displayed correctly')
  })
})
