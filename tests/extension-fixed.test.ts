import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

test.describe('Extension with Error Handling', () => {
  let context: BrowserContext
  let extensionId: string

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    extensionId = background.url().split('/')[2]
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('Extension handles API errors gracefully', async () => {
    const page = await context.newPage()
    
    // Monitor console
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Navigate to settings
    const isWelcome = await page.locator('text=Welcome to ABSmartly').isVisible()
    if (isWelcome) {
      await page.click('button:has-text("Configure Settings")')
    } else {
      await page.click('button[aria-label="Settings"]')
    }
    
    // Fill with invalid API endpoint
    await page.fill('input[type="url"]', 'https://invalid-api-endpoint.com')
    await page.fill('input[type="password"]', 'invalid-key')
    
    // Save
    await page.click('button:has-text("Save Settings")')
    
    // Wait for navigation
    await page.waitForTimeout(3000)
    
    // Check that the page didn't crash
    const bodyText = await page.locator('body').innerText()
    console.log('Page content after error:', bodyText)
    
    // Should show error message, not blank page
    expect(bodyText.length).toBeGreaterThan(0)
    
    // Check for error message
    const errorMessage = page.locator('div[role="alert"]')
    const hasError = await errorMessage.isVisible().catch(() => false)
    
    if (hasError) {
      const errorText = await errorMessage.innerText()
      console.log('Error message shown:', errorText)
      expect(errorText).toContain('Failed to load experiments')
    }
    
    // Check that main UI elements are still visible
    const mainHeading = await page.locator('h1:has-text("ABSmartly Experiments")').isVisible().catch(() => false)
    const settingsButton = await page.locator('button[aria-label="Settings"]').isVisible().catch(() => false)
    
    expect(mainHeading || settingsButton).toBeTruthy()
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/error-handled.png' })
  })

  test('Can recover from errors by fixing settings', async () => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Should be on main screen with error from previous test
    const errorAlert = page.locator('div[role="alert"]')
    if (await errorAlert.isVisible()) {
      console.log('Error from previous test visible')
    }
    
    // Go back to settings
    await page.click('button[aria-label="Settings"]')
    
    // Fix settings with valid endpoint (mock)
    await page.fill('input[type="url"]', 'https://api.absmartly.com/v1')
    await page.fill('input[type="password"]', 'valid-api-key')
    
    // Save
    await page.click('button:has-text("Save Settings")')
    
    // Wait
    await page.waitForTimeout(2000)
    
    // Should still show main UI (with potential API error but not crash)
    const mainUI = await page.locator('h1:has-text("ABSmartly Experiments")').isVisible().catch(() => false)
    expect(mainUI).toBeTruthy()
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/settings-fixed.png' })
  })
})