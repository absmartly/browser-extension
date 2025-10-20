import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

test.describe('Settings Flow Debug', () => {
  test('Debug settings save behavior', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
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
    const isWelcome = await page.locator('text=Welcome to ABSmartly').isVisible()
    if (isWelcome) {
      await page.click('button:has-text("Configure Settings")')
    } else {
      await page.click('button[aria-label="Settings"]')
    }
    
    // Fill settings
    await page.fill('input[type="url"]', 'https://api.absmartly.com')
    await page.fill('input[type="password"]', 'test-key-123')
    
    console.log('Before save - current URL:', page.url())
    console.log('Before save - visible text:', await page.locator('body').innerText())
    
    // Save settings
    await page.click('button:has-text("Save Settings")')
    
    // Wait for any navigation or state change
    await page.waitForTimeout(2000)
    
    console.log('After save - current URL:', page.url())
    console.log('After save - visible text:', await page.locator('body').innerText())
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/after-save-debug.png' })
    
    // Check what's visible
    const elements = {
      welcome: await page.locator('text=Welcome to ABSmartly').isVisible().catch(() => false),
      settings: await page.locator('h2:has-text("ABSmartly Settings")').isVisible().catch(() => false),
      experiments: await page.locator('h1:has-text("ABSmartly Experiments")').isVisible().catch(() => false),
      error: await page.locator('div[role="alert"]').isVisible().catch(() => false),
      loading: await page.locator('div[role="status"]').isVisible().catch(() => false)
    }
    
    console.log('Visible elements:', elements)
    
    await context.close()
  })
})