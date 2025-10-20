import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

let context: BrowserContext
let extensionId: string

test.describe('ABSmartly Extension Popup Tests', () => {
  test.beforeAll(async () => {
    // Launch Chrome with the extension
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-prod')
    context = await chromium.launchPersistentContext('', {
      headless: true,
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

  test('Extension popup loads successfully', async () => {
    // Navigate to the extension popup
    const page = await context.newPage()
    const popupUrl = `chrome-extension://${extensionId}/popup.html`
    console.log('Navigating to:', popupUrl)
    
    await page.goto(popupUrl)
    
    // Wait for the popup to load
    await page.waitForLoadState('networkidle')
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'tests/screenshots/popup-initial.png' })
    
    // Check if the popup loads with initial content
    const content = await page.content()
    console.log('Popup content loaded:', content.length > 0)
    
    // Check for either the welcome screen or the main UI
    const welcomeHeading = page.locator('h2:has-text("Welcome to ABSmartly")')
    const mainHeading = page.locator('h1:has-text("ABSmartly Experiments")')
    
    // Either welcome screen or main screen should be visible
    const isWelcomeVisible = await welcomeHeading.isVisible().catch(() => false)
    const isMainVisible = await mainHeading.isVisible().catch(() => false)
    
    expect(isWelcomeVisible || isMainVisible).toBeTruthy()
  })

  test('Settings button opens settings view', async () => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.waitForLoadState('networkidle')
    
    // Check if we're on the welcome screen
    const configureButton = page.locator('button:has-text("Configure Settings")')
    if (await configureButton.isVisible()) {
      // Click configure settings from welcome screen
      await configureButton.click()
    } else {
      // Click settings icon from main screen
      const settingsButton = page.locator('button[aria-label="Settings"]')
      await expect(settingsButton).toBeVisible()
      await settingsButton.click()
    }
    
    // Verify settings view loads
    await expect(page.locator('h2:has-text("ABSmartly Settings")')).toBeVisible()
    
    // Check for settings form fields
    await expect(page.locator('input[type="url"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/settings-view.png' })
  })

  test('Can enter and save settings', async () => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.waitForLoadState('networkidle')
    
    // Navigate to settings
    const configureButton = page.locator('button:has-text("Configure Settings")')
    if (await configureButton.isVisible()) {
      await configureButton.click()
    } else {
      await page.locator('button[aria-label="Settings"]').click()
    }
    
    // Fill in settings
    const apiEndpointInput = page.locator('input[type="url"]')
    const apiKeyInput = page.locator('input[type="password"]')
    
    await apiEndpointInput.fill('https://api.absmartly.com')
    await apiKeyInput.fill('test-api-key')
    
    // Save settings
    await page.locator('button:has-text("Save Settings")').click()
    
    // Wait for navigation back to main view
    await page.waitForTimeout(1000)
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/after-settings-save.png' })
    
    // Verify we're back on main screen (might show error if API key is invalid)
    const mainHeading = page.locator('h1:has-text("ABSmartly Experiments")')
    const errorMessage = page.locator('div[role="alert"]')
    
    // Either main screen or error should be visible
    const isMainVisible = await mainHeading.isVisible().catch(() => false)
    const isErrorVisible = await errorMessage.isVisible().catch(() => false)
    
    expect(isMainVisible || isErrorVisible).toBeTruthy()
  })
})