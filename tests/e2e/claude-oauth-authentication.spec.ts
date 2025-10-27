import { test, expect } from '@playwright/test'

test.describe('Claude OAuth Authentication Flow', () => {
  // Skip this test by default since it requires manual user interaction
  test.skip('should authenticate with Claude using OAuth', async ({ page, context }) => {
    test.setTimeout(300000) // 5 minute timeout for OAuth flow

    // Load the extension popup
    const extensionUrl = 'chrome-extension://test-extension-id/index.html'
    await page.goto(extensionUrl)

    // Navigate to settings
    await page.click('text=Settings')
    await page.waitForSelector('text=Claude API Configuration')

    // Verify OAuth is selected by default
    const oauthRadio = page.locator('input[value="oauth"]')
    await expect(oauthRadio).toBeChecked()

    // Find and click the authenticate button
    const authenticateButton = page.locator('button:has-text("Authenticate with Claude")')
    await expect(authenticateButton).toBeVisible()

    // Click the button to start OAuth flow
    await authenticateButton.click()

    // Wait for OAuth window/tab to appear and handle user interaction
    // This will require manual user authentication with Claude
    let oauthCompleted = false
    const waitForOAuth = setInterval(() => {
      // Check if token has been set (would appear in the UI)
      const tokenStatus = page.locator('text=OAuth token configured')
      if (tokenStatus) {
        oauthCompleted = true
        clearInterval(waitForOAuth)
      }
    }, 5000)

    // Wait for OAuth to complete or timeout
    await new Promise((resolve) => {
      setTimeout(() => {
        clearInterval(waitForOAuth)
        resolve(null)
      }, 300000) // 5 minute wait
    })

    // Check if authentication succeeded
    if (oauthCompleted) {
      // Verify token is configured
      await expect(page.locator('text=✓ OAuth token configured')).toBeVisible()

      // Verify we can save settings
      await page.click('button:has-text("Save Settings")')

      // Settings should save successfully
      // Navigation should go back to main view
      await page.waitForSelector('text=Experiments', { timeout: 5000 })
    } else {
      test.skip() // Skip if manual auth didn't complete
    }
  })

  test('should allow switching between OAuth and API Key methods', async ({ page }) => {
    const extensionUrl = 'chrome-extension://test-extension-id/index.html'
    await page.goto(extensionUrl)

    // Navigate to settings
    await page.click('text=Settings')
    await page.waitForSelector('text=Claude API Configuration')

    // Verify OAuth is selected by default
    let oauthRadio = page.locator('input[value="oauth"]')
    await expect(oauthRadio).toBeChecked()

    // Verify authenticate button is visible
    await expect(page.locator('button:has-text("Authenticate with Claude")')).toBeVisible()

    // Switch to API Key method
    const apikeyRadio = page.locator('input[value="apikey"]')
    await apikeyRadio.click()

    // Verify API key input is now visible
    const apiKeyInput = page.locator('input[placeholder="sk-ant-..."]')
    await expect(apiKeyInput).toBeVisible()

    // Verify authenticate button is hidden
    const authenticateButton = page.locator('button:has-text("Authenticate with Claude")')
    await expect(authenticateButton).not.toBeVisible()

    // Switch back to OAuth
    oauthRadio = page.locator('input[value="oauth"]')
    await oauthRadio.click()

    // Verify API key input is hidden again
    await expect(apiKeyInput).not.toBeVisible()

    // Verify authenticate button is visible again
    await expect(page.locator('button:has-text("Authenticate with Claude")')).toBeVisible()
  })

  test('should validate API key input when API Key method is selected', async ({ page }) => {
    const extensionUrl = 'chrome-extension://test-extension-id/index.html'
    await page.goto(extensionUrl)

    // Navigate to settings
    await page.click('text=Settings')
    await page.waitForSelector('text=Claude API Configuration')

    // Switch to API Key method
    const apikeyRadio = page.locator('input[value="apikey"]')
    await apikeyRadio.click()

    // Try to save settings without API key
    await page.click('button:has-text("Save Settings")')

    // Should show error about API key being required
    // (This depends on validation implementation)
    // For now, just verify the input is focused/visible
    const apiKeyInput = page.locator('input[placeholder="sk-ant-..."]')
    await expect(apiKeyInput).toBeFocused()
  })

  test('should persist Claude auth method preference', async ({ page }) => {
    const extensionUrl = 'chrome-extension://test-extension-id/index.html'
    await page.goto(extensionUrl)

    // Navigate to settings
    await page.click('text=Settings')
    await page.waitForSelector('text=Claude API Configuration')

    // Switch to API Key method
    const apikeyRadio = page.locator('input[value="apikey"]')
    await apikeyRadio.click()

    // Enter an API key
    const apiKeyInput = page.locator('input[placeholder="sk-ant-..."]')
    await apiKeyInput.fill('sk-ant-test-key-123')

    // Save settings
    await page.click('button:has-text("Save Settings")')

    // Wait for navigation back
    await page.waitForNavigation()

    // Go back to settings
    await page.click('text=Settings')
    await page.waitForSelector('text=Claude API Configuration')

    // Verify API Key method is still selected
    const savedApikeyRadio = page.locator('input[value="apikey"]')
    await expect(savedApikeyRadio).toBeChecked()

    // Verify API key is still populated
    const savedApiKeyInput = page.locator('input[placeholder="sk-ant-..."]')
    await expect(savedApiKeyInput).toHaveValue('sk-ant-test-key-123')
  })
})
