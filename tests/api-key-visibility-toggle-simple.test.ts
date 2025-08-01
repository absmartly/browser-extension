import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

test.describe('API Key Password Toggle Feature', () => {
  test('should allow toggling API key visibility in settings', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    // Get extension ID
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    const extensionId = background.url().split('/')[2]

    const page = await context.newPage()
    
    // Monitor console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text())
      }
    })
    
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Navigate to settings
    const isWelcome = await page.locator('text=Welcome to ABSmartly').isVisible().catch(() => false)
    if (isWelcome) {
      await page.click('button:has-text("Configure Settings")')
    } else {
      const settingsButton = page.locator('button[aria-label="Settings"]')
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
      }
    }
    
    // Wait for settings view to load
    await page.waitForSelector('input[placeholder="Enter your API key"]', { timeout: 5000 })
    
    const apiKeyInput = page.locator('input[placeholder="Enter your API key"]')
    
    // Verify API key field is password type by default (for security)
    await expect(apiKeyInput).toHaveAttribute('type', 'password')
    
    // Verify toggle button exists
    const toggleButton = page.locator('button[aria-label="Show password"]')
    await expect(toggleButton).toBeVisible()
    
    // Verify eye icon is present
    const eyeIcon = toggleButton.locator('svg')
    await expect(eyeIcon).toBeVisible()
    
    // Enter a test API key
    const testApiKey = 'sk-test-1234567890abcdef'
    await apiKeyInput.fill(testApiKey)
    await expect(apiKeyInput).toHaveValue(testApiKey)
    
    // Should still be password type (masked)
    await expect(apiKeyInput).toHaveAttribute('type', 'password')
    
    // Click toggle button to reveal password
    await toggleButton.click()
    
    // Should now be text type (visible)
    await expect(apiKeyInput).toHaveAttribute('type', 'text')
    await expect(apiKeyInput).toHaveValue(testApiKey)
    
    // Toggle button should now show "Hide password"
    const hideButton = page.locator('button[aria-label="Hide password"]')
    await expect(hideButton).toBeVisible()
    
    // Click again to hide password
    await hideButton.click()
    
    // Should be back to password type (masked)
    await expect(apiKeyInput).toHaveAttribute('type', 'password')
    await expect(apiKeyInput).toHaveValue(testApiKey) // Value should still be there
    
    // Original toggle button should be visible again
    await expect(toggleButton).toBeVisible()
    
    // Take a screenshot to verify visual state
    await page.screenshot({ path: 'tests/screenshots/api-key-toggle-test.png' })
    
    console.log('✅ API key visibility toggle test completed successfully')
    
    await context.close()
  })
})