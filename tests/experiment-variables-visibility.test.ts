import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Experiment Variables UI Visibility', () => {
  test('Variables and DOM changes remain visible in experiment detail view', async () => {
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
    await popup.waitForTimeout(2000)

    // Configure settings if needed
    if (await popup.locator('text=Welcome to ABSmartly').isVisible()) {
      await popup.click('button:has-text("Configure Settings")')
      await popup.fill('input[type="url"]', 'http://localhost:8080')
      await popup.fill('input[type="password"]', 'test-api-key')
      await popup.click('button:has-text("Save Settings")')
      await popup.waitForTimeout(2000)
    }

    // Check if we have experiments loaded or create one
    let experimentExists = false
    try {
      // Look for any experiment item
      await popup.waitForSelector('[data-testid="experiment-item"], .experiment-item, button:has-text("test_"), a:has-text("test_")', { timeout: 3000 })
      experimentExists = true
      console.log('Found existing experiments')
    } catch (e) {
      console.log('No experiments found, will create one')
    }

    if (!experimentExists) {
      // Create a test experiment
      console.log('Creating new experiment...')
      await popup.click('button[aria-label="Create Experiment"]')
      await popup.waitForSelector('h2:has-text("Create New Experiment")')
      
      // Fill basic info
      await popup.fill('input[placeholder="my_experiment_name"]', 'variables_test')
      await popup.fill('input[placeholder="My Experiment"]', 'Variables Test')
      
      // Add some DOM changes to the second variant
      console.log('Adding DOM changes to variant...')
      const domChangeButtons = await popup.locator('button:has-text("Edit DOM Changes")')
      const secondVariantButton = domChangeButtons.nth(1)
      await secondVariantButton.click()
      
      // Wait for the DOM editor to appear
      await popup.waitForSelector('textarea[placeholder*="Describe what you want to change"]')
      
      // Add a manual DOM change via JSON
      const jsonTextarea = popup.locator('textarea[placeholder*="selector"]')
      await jsonTextarea.fill('[{"selector": ".test-button", "type": "style", "value": {"background-color": "red"}, "enabled": true}]')
      await popup.click('button:has-text("Apply JSON Changes")')
      
      // Create the experiment
      await popup.click('button:has-text("Create Experiment")')
      await popup.waitForTimeout(3000)
    }

    // Now test clicking on an experiment to go to detail view
    console.log('Looking for experiment items...')
    
    // Try different selectors to find experiment items
    const experimentSelectors = [
      '[data-testid="experiment-item"]',
      '.experiment-item',
      'button:has-text("variables_test")',
      'button:has-text("test_")',
      'div:has-text("variables_test")',
      'div:has-text("Variables Test")'
    ]
    
    let experimentClicked = false
    for (const selector of experimentSelectors) {
      try {
        const elements = await popup.locator(selector)
        const count = await elements.count()
        console.log(`Found ${count} elements with selector: ${selector}`)
        
        if (count > 0) {
          await elements.first().click()
          experimentClicked = true
          console.log('Clicked experiment with selector:', selector)
          break
        }
      } catch (e) {
        console.log(`Selector ${selector} failed:`, e.message)
      }
    }

    if (!experimentClicked) {
      // Try to click any clickable element that might be an experiment
      console.log('Trying to find any clickable experiment element...')
      const allButtons = await popup.locator('button, div[role="button"], [onclick]')
      const buttonCount = await allButtons.count()
      console.log(`Found ${buttonCount} clickable elements`)
      
      for (let i = 0; i < buttonCount; i++) {
        const button = allButtons.nth(i)
        const text = await button.textContent()
        console.log(`Button ${i}: "${text}"`)
        
        if (text && (text.includes('test') || text.includes('experiment') || text.includes('Variables'))) {
          await button.click()
          experimentClicked = true
          console.log('Clicked experiment button:', text)
          break
        }
      }
    }

    // Wait a bit for the detail view to load
    await popup.waitForTimeout(2000)

    // Take screenshot of current state
    await popup.screenshot({ path: 'tests/screenshots/experiment-detail-view.png' })

    // Check if we're in the detail view
    const backButton = await popup.locator('text=Back to experiments').isVisible().catch(() => false)
    console.log('Back button visible (indicates detail view):', backButton)

    if (backButton) {
      // We're in detail view, now check for variables and DOM changes visibility
      console.log('Checking for variables section...')
      const variablesSection = await popup.locator('text=Variables').isVisible().catch(() => false)
      console.log('Variables section visible:', variablesSection)

      console.log('Checking for DOM changes section...')
      const domChangesSection = await popup.locator('text=DOM Changes for').isVisible().catch(() => false)
      console.log('DOM Changes section visible:', domChangesSection)

      // Check for Edit Variables button (should be visible in view mode)
      const editButton = await popup.locator('button:has-text("Edit Variables")').isVisible().catch(() => false)
      console.log('Edit Variables button visible:', editButton)

      // Check if any input fields are visible (variables should be shown)
      const inputFields = await popup.locator('input[type="text"]').count()
      console.log('Number of input fields visible:', inputFields)

      // The key test: Variables and DOM changes should both be visible
      expect(variablesSection).toBeTruthy() // Variables section should be visible
      expect(domChangesSection).toBeTruthy() // DOM Changes section should be visible
      expect(editButton).toBeTruthy() // Edit Variables button should be visible in view mode

      console.log('SUCCESS: Both variables and DOM changes are visible!')
    } else {
      console.log('WARNING: Could not navigate to experiment detail view')
      
      // Take a screenshot of the current state for debugging
      await popup.screenshot({ path: 'tests/screenshots/failed-to-navigate.png' })
      
      // Log the current page content
      const content = await popup.content()
      require('fs').writeFileSync('tests/debug-no-detail-view.html', content)
      
      throw new Error('Could not navigate to experiment detail view to test variables visibility')
    }

    await context.close()
  })

  test('Variables remain visible after clicking Cancel in edit mode', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    // This test specifically checks that clicking Cancel doesn't break the UI
    // (This was the original bug - variables would disappear after Cancel)
    
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    const extensionId = background.url().split('/')[2]

    const popup = await context.newPage()
    popup.on('console', msg => console.log('POPUP:', msg.text()))
    
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

    // Create a simple experiment with variables for testing
    await popup.click('button[aria-label="Create Experiment"]')
    await popup.waitForSelector('h2:has-text("Create New Experiment")')
    await popup.fill('input[placeholder="my_experiment_name"]', 'cancel_test')
    await popup.click('button:has-text("Create Experiment")')
    await popup.waitForTimeout(3000)

    // Try to click on the created experiment
    const experimentButton = popup.locator('button:has-text("cancel_test"), div:has-text("cancel_test")')
    if (await experimentButton.count() > 0) {
      await experimentButton.first().click()
      await popup.waitForTimeout(2000)

      // Should be in detail view - check for Edit Variables button
      const editVarsButton = popup.locator('button:has-text("Edit Variables")')
      if (await editVarsButton.isVisible()) {
        console.log('Clicking Edit Variables...')
        await editVarsButton.click()
        await popup.waitForTimeout(1000)

        // Now we should see Save/Cancel buttons
        const cancelButton = popup.locator('button:has-text("Cancel")')
        const saveButton = popup.locator('button:has-text("Save Changes")')
        
        expect(await cancelButton.isVisible()).toBeTruthy() // Cancel button should be visible in edit mode
        expect(await saveButton.isVisible()).toBeTruthy() // Save button should be visible in edit mode

        // The critical test: Click Cancel and ensure DOM changes are still visible
        await cancelButton.click()
        await popup.waitForTimeout(1000)

        // After cancel, we should be back in view mode
        const editButtonAgain = await popup.locator('button:has-text("Edit Variables")').isVisible()
        const domChangesStillVisible = await popup.locator('text=DOM Changes for').isVisible()
        const variablesStillVisible = await popup.locator('text=Variables').isVisible()

        expect(editButtonAgain).toBeTruthy() // Edit Variables button should reappear after cancel
        expect(domChangesStillVisible).toBeTruthy() // DOM Changes should still be visible after cancel
        expect(variablesStillVisible).toBeTruthy() // Variables should still be visible after cancel

        console.log('SUCCESS: Variables and DOM changes remain visible after Cancel!')
      }
    }

    await context.close()
  })
})