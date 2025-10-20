import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Experiment Detail UI State', () => {
  test('Variables UI shows correctly with mock data', async () => {
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
    
    // Intercept API calls and return mock data
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && route.request().method() === 'GET') {
        // Mock experiments list with one experiment that has variables and DOM changes
        const mockResponse = {
          experiments: [{
            id: 1,
            name: 'test_experiment',
            display_name: 'Test Experiment',
            state: 'ready',
            percentage_of_traffic: 100,
            variants: [
              {
                id: 1,
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  test_variable: 'control_value',
                  dom_changes: [
                    {
                      selector: '.test-button',
                      type: 'style',
                      value: { 'background-color': 'blue' },
                      enabled: true
                    }
                  ]
                })
              },
              {
                id: 2,
                variant: 1,
                name: 'Variant 1',
                config: JSON.stringify({
                  test_variable: 'variant_value',
                  another_var: 'test_value',
                  dom_changes: [
                    {
                      selector: '.test-button',
                      type: 'style',
                      value: { 'background-color': 'red' },
                      enabled: true
                    },
                    {
                      selector: '.header',
                      type: 'text',
                      value: 'New Header Text',
                      enabled: true
                    }
                  ]
                })
              }
            ],
            applications: [{ application_id: 1, name: 'Test App' }]
          }],
          total: 1,
          hasMore: false
        }
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
        })
      } else if (url.includes('/experiments/1') && route.request().method() === 'GET') {
        // Mock single experiment detail (same as above but individual)
        const mockExperiment = {
          id: 1,
          name: 'test_experiment',
          display_name: 'Test Experiment',
          state: 'ready',
          percentage_of_traffic: 100,
          variants: [
            {
              id: 1,
              variant: 0,
              name: 'Control',
              config: JSON.stringify({
                test_variable: 'control_value',
                dom_changes: [
                  {
                    selector: '.test-button',
                    type: 'style',
                    value: { 'background-color': 'blue' },
                    enabled: true
                  }
                ]
              })
            },
            {
              id: 2,
              variant: 1,
              name: 'Variant 1',
              config: JSON.stringify({
                test_variable: 'variant_value',
                another_var: 'test_value',
                dom_changes: [
                  {
                    selector: '.test-button',
                    type: 'style',
                    value: { 'background-color': 'red' },
                    enabled: true
                  },
                  {
                    selector: '.header',
                    type: 'text',
                    value: 'New Header Text',
                    enabled: true
                  }
                ]
              })
            }
          ],
          applications: [{ application_id: 1, name: 'Test App' }]
        }
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockExperiment)
        })
      } else {
        route.continue()
      }
    })
    
    // Enable console logging
    popup.on('console', msg => console.log('POPUP:', msg.text()))
    popup.on('pageerror', err => console.error('POPUP ERROR:', err))
    
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await popup.waitForTimeout(2000)

    // Configure settings
    if (await popup.locator('text=Welcome to ABSmartly').isVisible()) {
      await popup.click('button:has-text("Configure Settings")')
      await popup.fill('input[type="url"]', 'http://localhost:8080')
      await popup.fill('input[type="password"]', 'test-api-key')
      await popup.click('button:has-text("Save Settings")')
      await popup.waitForTimeout(2000)
    }

    // Wait for experiments to load
    await popup.waitForSelector('text=Test Experiment', { timeout: 5000 })
    console.log('Mock experiment loaded successfully!')

    // Click on the experiment to go to detail view
    await popup.click('text=Test Experiment')
    await popup.waitForTimeout(2000)

    // Take screenshot of detail view
    await popup.screenshot({ path: 'tests/screenshots/mock-experiment-detail.png' })

    // Verify we're in detail view
    const backButton = await popup.locator('text=Back to experiments').isVisible()
    expect(backButton).toBeTruthy() // Should be in experiment detail view

    // The key tests: Check that both Variables and DOM Changes are visible
    const variablesHeader = await popup.locator('text=Variables').isVisible()
    expect(variablesHeader).toBeTruthy() // Variables section should be visible

    const domChangesHeader = await popup.locator('text=DOM Changes for Control').isVisible()
    expect(domChangesHeader).toBeTruthy() // DOM Changes section should be visible for Control variant

    const domChangesVariant = await popup.locator('text=DOM Changes for Variant 1').isVisible()
    expect(domChangesVariant).toBeTruthy() // DOM Changes section should be visible for Variant 1

    // Check that Edit Variables button is visible (view mode)
    const editButton = await popup.locator('button:has-text("Edit Variables")').isVisible()
    expect(editButton).toBeTruthy() // Edit Variables button should be visible in view mode

    // Check that variables are displayed
    const testVariableInput = await popup.locator('input[value="control_value"]').isVisible()
    expect(testVariableInput).toBeTruthy() // Control variable should be visible

    const variantVariableInput = await popup.locator('input[value="variant_value"]').isVisible()
    expect(variantVariableInput).toBeTruthy() // Variant variable should be visible

    // Check that DOM changes are listed
    const domChangeButton = await popup.locator('text=.test-button').isVisible()
    expect(domChangeButton).toBeTruthy() // DOM change selector should be visible

    console.log('SUCCESS: All UI elements are visible in view mode!')

    // Now test the edit mode functionality
    console.log('Testing edit mode...')
    await popup.click('button:has-text("Edit Variables")')
    await popup.waitForTimeout(1000)

    // In edit mode, we should see Save and Cancel buttons
    const saveButton = await popup.locator('button:has-text("Save Changes")').isVisible()
    const cancelButton = await popup.locator('button:has-text("Cancel")').isVisible()
    expect(saveButton).toBeTruthy() // Save Changes button should be visible in edit mode
    expect(cancelButton).toBeTruthy() // Cancel button should be visible in edit mode

    // Edit Variables button should be hidden in edit mode
    const editButtonHidden = await popup.locator('button:has-text("Edit Variables")').isVisible()
    expect(editButtonHidden).toBeFalsy() // Edit Variables button should be hidden in edit mode

    console.log('Testing cancel behavior...')
    await popup.click('button:has-text("Cancel")')
    await popup.waitForTimeout(1000)

    // After cancel, we should be back in view mode
    const editButtonBack = await popup.locator('button:has-text("Edit Variables")').isVisible()
    expect(editButtonBack).toBeTruthy() // Edit Variables button should reappear after cancel

    // Most importantly: DOM Changes should still be visible after cancel
    const domChangesStillVisible = await popup.locator('text=DOM Changes for Control').isVisible()
    expect(domChangesStillVisible).toBeTruthy() // DOM Changes should remain visible after cancel

    const variablesStillVisible = await popup.locator('text=Variables').isVisible()
    expect(variablesStillVisible).toBeTruthy() // Variables section should remain visible after cancel

    console.log('SUCCESS: Variables and DOM changes remain visible after Cancel!')

    await context.close()
  })
})