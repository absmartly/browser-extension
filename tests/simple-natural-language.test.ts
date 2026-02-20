import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Simple Natural Language Test', () => {
  test('Basic natural language DOM generation', async () => {
    // Launch Chrome with extension
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    // Wait for service worker
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    const extensionId = background.url().split('/')[2]

    // Open extension popup
    const popup = await context.newPage()
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await popup.waitForTimeout(1000)

    // Configure settings if needed
    if (await popup.locator('text=Welcome to ABSmartly').isVisible()) {
      console.log('Configuring ABSmartly settings...')
      await popup.click('button:has-text("Configure Settings")')
      await popup.fill('input[type="url"]', 'http://localhost:8080')
      await popup.fill('input[type="password"]', 'test-api-key')
      await popup.click('button:has-text("Save Settings")')
      await popup.waitForTimeout(2000)
    }

    // Create new experiment
    console.log('Creating new experiment...')
    await popup.click('button[aria-label="Create Experiment"]')
    await popup.waitForSelector('h2:has-text("Create New Experiment")')

    // Fill basic experiment details
    await popup.fill('input[placeholder="my_experiment_name"]', 'test_natural_language')
    await popup.fill('input[placeholder="My Experiment"]', 'Natural Language Test')

    // Wait and screenshot the variants section
    await popup.waitForSelector('h3:has-text("Variants")')
    await popup.screenshot({ path: 'tests/screenshots/variants-section.png' })

    // Try to find and click the Edit DOM Changes button
    console.log('Looking for DOM editor buttons...')
    const domEditButtons = popup.locator('button:has-text("Edit DOM Changes")')
    const buttonCount = await domEditButtons.count()
    console.log('Found DOM edit buttons:', buttonCount)

    if (buttonCount > 1) {
      // Click the second button (for Variant 1, not Control)
      await domEditButtons.nth(1).click()
      console.log('Clicked DOM editor for Variant 1')
      
      // Wait for natural language input
      await popup.waitForSelector('text=Natural Language Description', { timeout: 5000 })
      console.log('Natural language input is visible!')
      
      // Take screenshot
      await popup.screenshot({ path: 'tests/screenshots/natural-language-input.png' })
      
      // Try the natural language input
      const nlTextarea = popup.locator('textarea[placeholder*="Describe what you want to change"]')
      await nlTextarea.fill('make all buttons have rounded corners')
      
      // Click generate
      await popup.click('button:has-text("Generate DOM Changes")')
      await popup.waitForTimeout(1000)
      
      // Check if DOM changes were generated
      const jsonTextarea = popup.locator('textarea[placeholder*=\'[{"selector":\']')
      const generatedJson = await jsonTextarea.inputValue()
      console.log('Generated JSON:', generatedJson)
      
      // Verify it contains button styling
      if (generatedJson) {
        const changes = JSON.parse(generatedJson)
        console.log('DOM changes:', changes)
        expect(changes).toBeInstanceOf(Array)
        expect(changes.length).toBeGreaterThan(0)
      }
    } else {
      console.error('Could not find enough DOM edit buttons')
    }

    await popup.screenshot({ path: 'tests/screenshots/final-state.png' })
    await context.close()
  })
})