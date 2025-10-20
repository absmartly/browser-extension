import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Debug Experiment Editor', () => {
  test('Check DOM editor UI elements', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
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

    const popup = await context.newPage()
    
    // Enable console logging
    popup.on('console', msg => console.log('POPUP:', msg.text()))
    popup.on('pageerror', err => console.error('POPUP ERROR:', err))
    
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await popup.waitForTimeout(1000)

    // Configure if needed
    if (await popup.locator('text=Welcome to ABSmartly').isVisible()) {
      await popup.click('button:has-text("Configure Settings")')
      await popup.fill('input[type="url"]', 'http://localhost:8080')
      await popup.fill('input[type="password"]', 'test-api-key')
      await popup.click('button:has-text("Save Settings")')
      await popup.waitForTimeout(2000)
    }

    // Create experiment
    await popup.click('button[aria-label="Create Experiment"]')
    await popup.waitForSelector('h2:has-text("Create New Experiment")')
    
    // Fill basic info
    await popup.fill('input[placeholder="my_experiment_name"]', 'debug_test')

    // Screenshot before clicking
    await popup.screenshot({ path: 'tests/screenshots/before-dom-edit-click.png' })

    // Try clicking with different methods
    console.log('Attempting to click DOM editor...')
    
    // Method 1: nth selector
    try {
      await popup.locator('button:has-text("Edit DOM Changes")').nth(1).click()
      console.log('Clicked using nth(1)')
    } catch (e) {
      console.error('Method 1 failed:', e.message)
    }

    await popup.waitForTimeout(2000)
    await popup.screenshot({ path: 'tests/screenshots/after-dom-edit-click.png' })

    // Check what's visible
    const nlDescVisible = await popup.locator('text=Natural Language Description').isVisible().catch(() => false)
    const nlTextareaVisible = await popup.locator('textarea[placeholder*="Describe what you want to change"]').isVisible().catch(() => false)
    const generateBtnVisible = await popup.locator('button:has-text("Generate DOM Changes")').isVisible().catch(() => false)
    
    console.log('Natural Language Description visible:', nlDescVisible)
    console.log('Natural Language textarea visible:', nlTextareaVisible)
    console.log('Generate button visible:', generateBtnVisible)

    // Check for any error boundaries
    const errorBoundary = await popup.locator('text=Something went wrong').isVisible().catch(() => false)
    console.log('Error boundary visible:', errorBoundary)

    // Get the full page HTML
    const pageContent = await popup.content()
    const fs = require('fs')
    fs.writeFileSync('tests/debug-popup-content.html', pageContent)
    console.log('Saved page content to debug-popup-content.html')

    await context.close()
  })
})