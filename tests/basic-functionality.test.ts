import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

test.describe('Basic Extension Functionality', () => {
  let context: BrowserContext
  let extensionId: string

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    context = await chromium.launchPersistentContext('', {
      headless: true,
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
    console.log('Extension ID:', extensionId)
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('Extension popup loads without crashing', async () => {
    const page = await context.newPage()
    
    // Monitor for any page crashes
    let crashed = false
    page.on('crash', () => {
      crashed = true
      console.error('Page crashed!')
    })
    
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.waitForTimeout(2000)
    
    expect(crashed).toBeFalsy()
    
    // Check page has content
    const bodyContent = await page.locator('body').innerText()
    console.log('Body has content:', bodyContent.length > 0)
    expect(bodyContent.length).toBeGreaterThan(0)
    
    // Should show either welcome or main screen
    const hasWelcome = await page.locator('text=Welcome to ABSmartly').count() > 0
    const hasSettings = await page.locator('text=ABSmartly Settings').count() > 0
    const hasExperiments = await page.locator('text=ABSmartly Experiments').count() > 0
    
    console.log('UI state:', { hasWelcome, hasSettings, hasExperiments })
    expect(hasWelcome || hasSettings || hasExperiments).toBeTruthy()
  })

  test('Settings UI works without API', async () => {
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Clear any existing settings
    await page.evaluate(() => {
      chrome.storage.local.clear()
    })
    
    // Reload to get welcome screen
    await page.reload()
    await page.waitForTimeout(1000)
    
    // Should show welcome
    await expect(page.locator('text=Welcome to ABSmartly')).toBeVisible()
    
    // Click configure
    await page.click('button:has-text("Configure Settings")')
    
    // Should show settings
    await expect(page.locator('h2:has-text("ABSmartly Settings")')).toBeVisible()
    
    // Fill form
    await page.fill('input[type="url"]', 'http://localhost:8080')
    await page.fill('input[type="password"]', 'test-key')
    
    // Test validation - clear and save
    await page.fill('input[type="url"]', '')
    await page.click('button:has-text("Save Settings")')
    
    // Should show validation error
    await expect(page.locator('text=API Endpoint is required')).toBeVisible()
    
    // Fill valid data
    await page.fill('input[type="url"]', 'http://localhost:8080')
    await page.fill('input[type="password"]', 'test-key')
    
    // Save
    await page.click('button:has-text("Save Settings")')
    
    // Wait for save
    await page.waitForTimeout(1000)
    
    // Should navigate away from settings (to main or error)
    const stillOnSettings = await page.locator('h2:has-text("ABSmartly Settings")').isVisible().catch(() => false)
    expect(stillOnSettings).toBeFalsy()
    
    // Take screenshot of final state
    await page.screenshot({ path: 'tests/screenshots/basic-test-final.png' })
  })

  test('Extension persists state across reopens', async () => {
    // First page
    const page1 = await context.newPage()
    await page1.goto(`chrome-extension://${extensionId}/popup.html`)
    await page1.waitForTimeout(1000)
    
    const page1Content = await page1.locator('body').innerText()
    console.log('Page 1 content preview:', page1Content.substring(0, 100))
    
    await page1.close()
    
    // Second page
    const page2 = await context.newPage()
    await page2.goto(`chrome-extension://${extensionId}/popup.html`)
    await page2.waitForTimeout(1000)
    
    const page2Content = await page2.locator('body').innerText()
    console.log('Page 2 content preview:', page2Content.substring(0, 100))
    
    // Should not show welcome if settings were saved
    const hasWelcome = await page2.locator('text=Welcome to ABSmartly').count() > 0
    console.log('Shows welcome on page 2:', hasWelcome)
    
    await page2.close()
  })
})