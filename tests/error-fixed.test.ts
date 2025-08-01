import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

test.describe('Fixed Error Handling', () => {
  test('Extension no longer crashes with experiments.map error', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    const extensionId = background.url().split('/')[2]

    const page = await context.newPage()
    
    // Monitor console
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.waitForTimeout(2000)
    
    // Check that we don't have the experiments.map error
    const hasMapError = errors.some(e => e.includes('experiments.map'))
    console.log('Has experiments.map error:', hasMapError)
    console.log('All errors:', errors)
    
    expect(hasMapError).toBeFalsy()
    
    // Check page has content
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(0)
    
    // Should not show error boundary message
    const hasErrorBoundary = bodyText.includes('Something went wrong')
    expect(hasErrorBoundary).toBeFalsy()
    
    // Save settings to test main view
    if (await page.locator('text=Welcome to ABSmartly').isVisible()) {
      await page.click('button:has-text("Configure Settings")')
      await page.fill('input[type="url"]', 'http://localhost:8080')
      await page.fill('input[type="password"]', 'test-key')
      await page.click('button:has-text("Save Settings")')
      await page.waitForTimeout(2000)
    }
    
    // Should show main UI (with potential API error but not crash)
    const mainUI = await page.locator('h1:has-text("ABSmartly Experiments")').isVisible().catch(() => false)
    const apiError = await page.locator('div[role="alert"]').isVisible().catch(() => false)
    
    console.log('Main UI visible:', mainUI)
    console.log('API error visible:', apiError)
    
    expect(mainUI || apiError).toBeTruthy()
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/no-crash.png' })
    
    await context.close()
  })
})