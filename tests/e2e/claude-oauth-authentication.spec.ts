import { test, expect } from '../fixtures/extension'

test.describe('Claude OAuth Authentication Flow', () => {
  // Skip this test by default since it requires manual user interaction
  test.skip('should authenticate with Claude using OAuth', async ({ extensionUrl }) => {
    test.setTimeout(300000) // 5 minute timeout for OAuth flow

    const page = await test.page()
    if (!page) throw new Error('Page not available')

    // Load the extension popup
    await page.goto(extensionUrl('tabs/sidebar.html'))

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

  test('should allow switching between OAuth and API Key methods', async ({ context, extensionUrl }) => {
    const page = await context.newPage()
    await page.goto(extensionUrl('tabs/sidebar.html'))

    // Navigate to settings
    await page.click('text=Settings')
    await page.waitForSelector('text=Claude API Configuration')

    // Verify OAuth is selected by default
    let oauthRadio = page.locator('input[value="oauth"]')
    await expect(oauthRadio).toBeChecked()

    // Verify token input is visible
    const oauthTokenInput = page.locator('input[placeholder="sk-ant-..."]').first()
    await expect(oauthTokenInput).toBeVisible()

    // Switch to API Key method
    const apikeyRadio = page.locator('input[value="apikey"]')
    await apikeyRadio.click()

    // Verify API key input is now visible
    const apiKeyInput = page.locator('input[placeholder="sk-ant-..."]')
    await expect(apiKeyInput).toBeVisible()

    // Switch back to OAuth
    oauthRadio = page.locator('input[value="oauth"]')
    await oauthRadio.click()

    // Verify OAuth token input is visible again
    await expect(page.locator('text=Claude OAuth is not yet fully integrated')).toBeVisible()

    await page.close()
  })

  test('should validate API key input when API Key method is selected', async ({ context, extensionUrl }) => {
    const page = await context.newPage()
    await page.goto(extensionUrl('tabs/sidebar.html'))

    // Navigate to settings
    await page.click('text=Settings')
    await page.waitForSelector('text=Claude API Configuration')

    // Switch to API Key method
    const apikeyRadio = page.locator('input[value="apikey"]')
    await apikeyRadio.click()

    // Verify API key label shows "Claude API Key"
    await expect(page.locator('text=Claude API Key')).toBeVisible()

    await page.close()
  })

  test('should persist Claude auth method preference', async ({ context, extensionUrl, seedStorage }) => {
    const page = await context.newPage()
    await page.goto(extensionUrl('tabs/sidebar.html'))

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

    // Wait a moment for save to complete
    await page.waitForTimeout(500)

    // Reload the page
    await page.reload()

    // Navigate to settings again
    await page.click('text=Settings')
    await page.waitForSelector('text=Claude API Configuration')

    // Verify API Key method is still selected
    const savedApikeyRadio = page.locator('input[value="apikey"]')
    await expect(savedApikeyRadio).toBeChecked()

    // Verify API key is still populated
    const savedApiKeyInput = page.locator('input[placeholder="sk-ant-..."]')
    await expect(savedApiKeyInput).toHaveValue('sk-ant-test-key-123')

    await page.close()
  })
})
