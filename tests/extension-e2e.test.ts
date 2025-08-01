import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'path'

let context: BrowserContext
let extensionId: string

test.describe('ABSmartly Extension E2E Tests', () => {
  test.beforeAll(async () => {
    // Use dev build for testing
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    // Get the extension ID
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    extensionId = background.url().split('/')[2]
    console.log('Extension ID:', extensionId)
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('Extension popup loads with welcome screen', async () => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Check welcome screen elements
    await expect(page.locator('h2:has-text("Welcome to ABSmartly")')).toBeVisible()
    await expect(page.locator('text=Please configure your API settings')).toBeVisible()
    await expect(page.locator('button:has-text("Configure Settings")')).toBeVisible()
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/welcome-screen.png' })
  })

  test('Can navigate to settings and fill form', async () => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Click configure settings
    await page.click('button:has-text("Configure Settings")')
    
    // Verify settings page loaded
    await expect(page.locator('h2:has-text("ABSmartly Settings")')).toBeVisible()
    
    // Check form fields exist
    const apiEndpointInput = page.locator('input[type="url"]')
    const apiKeyInput = page.locator('input[type="password"]')
    const applicationIdInput = page.locator('input[placeholder="Enter application ID"]')
    
    await expect(apiEndpointInput).toBeVisible()
    await expect(apiKeyInput).toBeVisible()
    await expect(applicationIdInput).toBeVisible()
    
    // Fill form
    await apiEndpointInput.fill('https://api.absmartly.com')
    await apiKeyInput.fill('test-api-key-12345')
    await applicationIdInput.fill('1')
    
    // Check values were entered
    await expect(apiEndpointInput).toHaveValue('https://api.absmartly.com')
    await expect(apiKeyInput).toHaveValue('test-api-key-12345')
    await expect(applicationIdInput).toHaveValue('1')
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/settings-filled.png' })
    
    // Check save and cancel buttons exist
    await expect(page.locator('button:has-text("Save Settings")')).toBeVisible()
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible()
  })

  test('Settings validation works', async () => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Navigate to settings
    await page.click('button:has-text("Configure Settings")')
    
    // Try to save with empty fields
    await page.click('button:has-text("Save Settings")')
    
    // Check for validation errors
    await expect(page.locator('text=API Key is required')).toBeVisible()
    await expect(page.locator('text=API Endpoint is required')).toBeVisible()
    
    // Fill with invalid URL
    await page.fill('input[type="url"]', 'not-a-url')
    await page.click('button:has-text("Save Settings")')
    
    await expect(page.locator('text=Please enter a valid URL')).toBeVisible()
    
    // Fill with invalid application ID
    await page.fill('input[placeholder="Enter application ID"]', 'abc')
    await page.click('button:has-text("Save Settings")')
    
    await expect(page.locator('text=Application ID must be a number')).toBeVisible()
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/settings-validation.png' })
  })

  test('Can save settings and navigate to main view', async () => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Navigate to settings
    await page.click('button:has-text("Configure Settings")')
    
    // Fill valid settings
    await page.fill('input[type="url"]', 'https://api.absmartly.com')
    await page.fill('input[type="password"]', 'test-api-key-12345')
    
    // Save settings
    await page.click('button:has-text("Save Settings")')
    
    // Wait for navigation
    await page.waitForTimeout(1000)
    
    // Should show main view or error (if API key is invalid)
    const mainHeading = page.locator('h1:has-text("ABSmartly Experiments")')
    const errorAlert = page.locator('div[role="alert"]')
    
    // Either main screen or API error should be visible
    const isMainVisible = await mainHeading.isVisible().catch(() => false)
    const isErrorVisible = await errorAlert.isVisible().catch(() => false)
    
    expect(isMainVisible || isErrorVisible).toBeTruthy()
    
    if (isMainVisible) {
      // Check main UI elements
      await expect(page.locator('button[aria-label="Visual Editor"]')).toBeVisible()
      await expect(page.locator('button[aria-label="Create Experiment"]')).toBeVisible()
      await expect(page.locator('button[aria-label="Settings"]')).toBeVisible()
    }
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/main-view-or-error.png' })
  })

  test('Settings persist across sessions', async () => {
    // First page - save settings
    const page1 = await context.newPage()
    await page1.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Check if we're already on main screen (settings were saved)
    const isOnMainScreen = await page1.locator('h1:has-text("ABSmartly Experiments")').isVisible().catch(() => false)
    
    if (!isOnMainScreen) {
      // Configure settings
      await page1.click('button:has-text("Configure Settings")')
      await page1.fill('input[type="url"]', 'https://api.absmartly.com')
      await page1.fill('input[type="password"]', 'persistent-test-key')
      await page1.click('button:has-text("Save Settings")')
      await page1.waitForTimeout(1000)
    }
    
    await page1.close()
    
    // Second page - check settings persist
    const page2 = await context.newPage()
    await page2.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Should go directly to main view (not welcome screen)
    const welcomeScreen = page2.locator('h2:has-text("Welcome to ABSmartly")')
    const mainScreen = page2.locator('h1:has-text("ABSmartly Experiments")')
    
    const isWelcomeVisible = await welcomeScreen.isVisible().catch(() => false)
    const isMainVisible = await mainScreen.isVisible().catch(() => false)
    
    // Should NOT show welcome screen if settings are saved
    expect(isWelcomeVisible).toBeFalsy()
    expect(isMainVisible || (await page2.locator('div[role="alert"]').isVisible())).toBeTruthy()
    
    // Navigate to settings to verify values
    if (await page2.locator('button[aria-label="Settings"]').isVisible()) {
      await page2.click('button[aria-label="Settings"]')
      
      // Check saved values
      const apiEndpoint = await page2.locator('input[type="url"]').inputValue()
      expect(apiEndpoint).toBe('https://api.absmartly.com')
    }
    
    await page2.close()
  })
})