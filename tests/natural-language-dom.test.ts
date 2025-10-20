import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

test.describe('Natural Language DOM Manipulation', () => {
  test.setTimeout(120000) // 2 minutes for full E2E test

  test('Create experiment with natural language "make all buttons have rounded corners"', async () => {
    // Launch Chrome with extension
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
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

    // Create a new page with test buttons
    const testPage = await context.newPage()
    const testPagePath = path.join(__dirname, 'test-pages', 'buttons-test.html')
    await testPage.goto(`file://${testPagePath}`)
    await testPage.waitForLoadState('networkidle')

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

    // Fill experiment details
    const experimentName = `test_rounded_buttons_${Date.now()}`
    await popup.fill('input[placeholder="my_experiment_name"]', experimentName)
    await popup.fill('input[placeholder="My Experiment"]', 'Rounded Buttons Test')
    
    // Open DOM editor for Variant 1
    console.log('Opening DOM editor for variant...')
    await popup.click('button:has-text("Edit DOM Changes"):nth-of-type(2)') // Second variant
    await popup.waitForSelector('text=Natural Language Description')

    // Use natural language input
    console.log('Entering natural language description...')
    const nlInput = popup.locator('textarea[placeholder*="Describe what you want to change"]')
    await nlInput.fill('Create an experiment that makes all buttons have rounded corners')
    
    // Generate DOM changes
    await popup.click('button:has-text("Generate DOM Changes")')
    await popup.waitForTimeout(1500) // Wait for processing

    // Verify DOM changes were generated
    const domChangesSection = popup.locator('text=DOM Changes JSON')
    await expect(domChangesSection).toBeVisible()

    // Get the generated JSON
    const jsonTextarea = popup.locator('textarea[placeholder*=\'[{"selector":\']')
    const generatedJson = await jsonTextarea.inputValue()
    console.log('Generated DOM changes:', generatedJson)

    // Parse and verify the JSON contains button styling
    const domChanges = JSON.parse(generatedJson)
    expect(domChanges).toBeInstanceOf(Array)
    expect(domChanges.length).toBeGreaterThan(0)
    
    // Verify it contains border radius for buttons
    const borderRadiusChange = domChanges.find(
      (change: any) => 
        change.selector === 'button' && 
        change.action === 'style' && 
        change.property === 'borderRadius'
    )
    expect(borderRadiusChange).toBeDefined()
    expect(borderRadiusChange.value).toBeTruthy()
    console.log('Border radius change:', borderRadiusChange)

    // Save the experiment
    console.log('Saving experiment...')
    await popup.click('button:has-text("Create Experiment")')
    
    // Wait for save and potential navigation
    await popup.waitForTimeout(3000)

    // Take screenshots
    await popup.screenshot({ path: 'tests/screenshots/natural-language-experiment.png' })
    await testPage.screenshot({ path: 'tests/screenshots/test-page-buttons.png' })

    // Store experiment data for next test
    const experimentData = {
      name: experimentName,
      domChanges: domChanges
    }
    
    // Save to file for API verification test
    const fs = require('fs')
    fs.writeFileSync(
      path.join(__dirname, 'temp-experiment-data.json'),
      JSON.stringify(experimentData, null, 2)
    )

    console.log('Test completed successfully!')
    console.log('Experiment name:', experimentName)
    console.log('DOM changes generated:', domChanges.length)

    await context.close()
  })
})