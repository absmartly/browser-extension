import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('ExperimentDetail Variant Data Fallback', () => {
  test('should handle malformed variant configs with fallback data', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    console.log('Loading extension from:', pathToExtension)
    
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-default-apps'
      ],
      timeout: 30000
    })

    const page = await context.newPage()
    
    // Navigate to popup
    await page.goto(`chrome-extension://${await getExtensionId(context)}/popup.html`)
    console.log('Popup opened')

    // Navigate to settings to configure API first
    const isWelcome = await page.locator('text=Welcome to ABSmartly').isVisible().catch(() => false)
    if (isWelcome) {
      await page.click('button:has-text("Configure Settings")')
    } else {
      const settingsButton = page.locator('button[aria-label="Settings"]')
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
      }
    }

    const settingsVisible = await page.locator('input[placeholder="Enter your API key"]').isVisible({ timeout: 5000 }).catch(() => false)
    if (settingsVisible) {
      console.log('Settings page loaded')

      // Check environment variables are auto-loaded in development
      const apiKeyInput = await page.locator('input[placeholder="Enter your API key"]').first()
      const apiEndpointInput = await page.locator('input[placeholder*="endpoint"]').first()
      
      // Wait for environment variables to be loaded
      await page.waitForTimeout(1000)
      
      const apiKeyValue = await apiKeyInput.inputValue()
      const apiEndpointValue = await apiEndpointInput.inputValue()
      
      console.log('API Key loaded from env:', apiKeyValue ? 'YES' : 'NO')
      console.log('API Endpoint loaded from env:', apiEndpointValue ? 'YES' : 'NO')
      
      // Environment variables should be auto-loaded in development mode
      expect(apiKeyValue).toBeTruthy()
      expect(apiEndpointValue).toBeTruthy()
      
      // Save settings
      const saveButton = await page.locator('button:has-text("Save")').first()
      await saveButton.click()
      console.log('Settings saved')
    }

    // Mock API response with malformed variant config to test fallback
    await page.route('**/experiments*', async (route) => {
      const response = {
        data: [
          {
            id: 1,
            name: 'test-experiment',
            display_name: 'Test Experiment with Malformed Config',
            status: 'ready',
            variants: [
              {
                name: 'Control',
                variant: 0,
                config: '{"invalid": json}' // Invalid JSON to test fallback
              },
              {
                name: 'Treatment',
                variant: 1,
                config: null // Null config to test fallback
              },
              {
                name: 'Treatment 2', 
                variant: 2,
                config: undefined // Undefined config to test fallback
              },
              {
                name: 'Treatment 3',
                variant: 3,
                config: {
                  dom_changes: 'not_an_array', // Invalid type to test validation
                  variables: 'not_an_object', // Invalid type to test validation
                  validVariable: 'test'
                }
              }
            ]
          }
        ],
        meta: { total: 1 }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })

    // Mock individual experiment fetch with same malformed data
    await page.route('**/experiment/*', async (route) => {
      const response = {
        id: 1,
        name: 'test-experiment',
        display_name: 'Test Experiment with Malformed Config',
        status: 'ready',
        variants: [
          {
            name: 'Control',
            variant: 0,
            config: '{"invalid": json}' // Invalid JSON to test fallback
          },
          {
            name: 'Treatment',
            variant: 1,
            config: null // Null config to test fallback
          },
          {
            name: 'Treatment 2',
            variant: 2,
            config: undefined // Undefined config to test fallback
          },
          {
            name: 'Treatment 3',
            variant: 3,
            config: {
              dom_changes: 'not_an_array', // Invalid type to test validation
              variables: 'not_an_object', // Invalid type to test validation
              validVariable: 'test'
            }
          }
        ]
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })

    // Wait for experiments to load
    await page.waitForSelector('text=Test Experiment with Malformed Config', { timeout: 10000 })
    console.log('Mock experiment with malformed config loaded')

    // Click on the experiment to open detail view
    await page.click('text=Test Experiment with Malformed Config')
    console.log('Clicked on experiment')

    // Wait for experiment detail to load
    await page.waitForSelector('text=Test Experiment with Malformed Config', { timeout: 5000 })
    
    // Verify that variables section is rendered (should show fallback empty data)
    const variablesSection = await page.locator('text=Variables').first()
    await expect(variablesSection).toBeVisible()
    console.log('Variables section is visible with fallback data')

    // Verify that DOM changes section is rendered (should show fallback empty array)
    const domChangesSection = await page.locator('text=DOM Changes').first()
    await expect(domChangesSection).toBeVisible()
    console.log('DOM Changes section is visible with fallback data')

    // Verify that all variant cards are rendered despite malformed configs
    const variantCards = await page.locator('[class*="border"][class*="rounded"]').all()
    const visibleVariantCards = []
    for (const card of variantCards) {
      if (await card.isVisible()) {
        visibleVariantCards.push(card)
      }
    }
    expect(visibleVariantCards.length).toBeGreaterThanOrEqual(4) // Should have 4 variants
    console.log(`Found ${visibleVariantCards.length} variant cards rendered`)

    // Test that the component doesn't crash and handles the errors gracefully
    // by verifying core UI elements are still visible
    const backButton = await page.locator('button:has-text("Back")').first()
    await expect(backButton).toBeVisible()
    console.log('Back button is still functional after handling malformed data')

    // Verify error handling doesn't break the UI state
    const experimentTitle = await page.locator('text=Test Experiment with Malformed Config').first()
    await expect(experimentTitle).toBeVisible()
    console.log('Experiment title remains visible after error handling')

    console.log('✅ Variant data fallback mechanism test completed successfully')
    
    await context.close()
  })

  test('should preserve variant data across re-renders and prevent disappearing UI', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-default-apps'
      ],
      timeout: 30000
    })

    const page = await context.newPage()
    
    // Navigate to popup
    await page.goto(`chrome-extension://${await getExtensionId(context)}/popup.html`)

    // Wait for popup to load
    await page.waitForSelector('.w-full', { timeout: 10000 })

    // Mock API response with valid experiment data
    await page.route('**/experiments*', async (route) => {
      const response = {
        data: [
          {
            id: 2,
            name: 'persistence-test',
            display_name: 'Persistence Test Experiment',
            status: 'running',
            variants: [
              {
                name: 'Control',
                variant: 0,
                config: {
                  testVariable: 'control_value',
                  dom_changes: [
                    { selector: '.test-element', property: 'innerHTML', value: 'Control Content' }
                  ]
                }
              },
              {
                name: 'Treatment',
                variant: 1,
                config: {
                  testVariable: 'treatment_value',
                  secondVariable: 42,
                  dom_changes: [
                    { selector: '.test-element', property: 'innerHTML', value: 'Treatment Content' },
                    { selector: '.another-element', property: 'style.color', value: 'red' }
                  ]
                }
              }
            ]
          }
        ],
        meta: { total: 1 }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })

    // Mock individual experiment fetch
    await page.route('**/experiment/*', async (route) => {
      const response = {
        id: 2,
        name: 'persistence-test',
        display_name: 'Persistence Test Experiment',
        status: 'running',
        variants: [
          {
            name: 'Control',
            variant: 0,
            config: {
              testVariable: 'control_value',
              dom_changes: [
                { selector: '.test-element', property: 'innerHTML', value: 'Control Content' }
              ]
            }
          },
          {
            name: 'Treatment',
            variant: 1,
            config: {
              testVariable: 'treatment_value',
              secondVariable: 42,
              dom_changes: [
                { selector: '.test-element', property: 'innerHTML', value: 'Treatment Content' },
                { selector: '.another-element', property: 'style.color', value: 'red' }
              ]
            }
          }
        ]
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })

    // Wait for experiment to load and click it
    await page.waitForSelector('text=Persistence Test Experiment', { timeout: 10000 })
    await page.click('text=Persistence Test Experiment')

    // Wait for detail view
    await page.waitForSelector('text=Persistence Test Experiment', { timeout: 5000 })
    console.log('Experiment detail view loaded')

    // Verify variables are visible initially
    const variablesSection = await page.locator('text=Variables').first()
    await expect(variablesSection).toBeVisible()
    
    // Verify DOM changes are visible initially
    const domChangesSection = await page.locator('text=DOM Changes').first()
    await expect(domChangesSection).toBeVisible()

    // Verify specific variable values are shown
    const testVariableText = await page.locator('text=testVariable').first()
    await expect(testVariableText).toBeVisible()
    console.log('Variables content is visible')

    // Verify DOM changes content is shown
    const domChangeText = await page.locator('text=.test-element').first()
    await expect(domChangeText).toBeVisible()
    console.log('DOM changes content is visible')

    // Simulate user interactions that might trigger re-renders
    // Click on variant tabs/cards to switch between them
    const treatmentVariant = await page.locator('text=Treatment').first()
    if (await treatmentVariant.isVisible()) {
      await treatmentVariant.click()
      console.log('Clicked Treatment variant')
      
      // Wait a moment for any state updates
      await page.waitForTimeout(500)
      
      // Verify variables are STILL visible after interaction
      await expect(variablesSection).toBeVisible()
      console.log('Variables section still visible after variant switch')
      
      // Verify DOM changes are STILL visible after interaction
      await expect(domChangesSection).toBeVisible()
      console.log('DOM changes section still visible after variant switch')
    }

    // Test Edit Variables button functionality (should not cause disappearing UI)
    const editVariablesButton = await page.locator('button:has-text("Edit Variables")').first()
    if (await editVariablesButton.isVisible()) {
      await editVariablesButton.click()
      console.log('Clicked Edit Variables button')
      
      // Wait for edit mode
      await page.waitForTimeout(500)
      
      // Verify UI elements are still visible in edit mode
      await expect(variablesSection).toBeVisible()
      await expect(domChangesSection).toBeVisible()
      console.log('Variables and DOM changes remain visible in edit mode')
      
      // Cancel editing
      const cancelButton = await page.locator('button:has-text("Cancel")').first()
      if (await cancelButton.isVisible()) {
        await cancelButton.click()
        console.log('Clicked Cancel button')
        
        // Wait for view mode
        await page.waitForTimeout(500)
        
        // CRITICAL TEST: Verify variables and DOM changes are STILL visible after canceling
        // This was the main bug - they would disappear after cancel
        await expect(variablesSection).toBeVisible()
        await expect(domChangesSection).toBeVisible()
        console.log('✅ CRITICAL: Variables and DOM changes remain visible after Cancel (bug fixed)')
      }
    }

    // Test going back and forth to ensure data persistence
    const backButton = await page.locator('button:has-text("Back")').first()
    await backButton.click()
    console.log('Clicked Back button')
    
    // Wait for experiment list
    await page.waitForSelector('text=Persistence Test Experiment', { timeout: 5000 })
    
    // Click experiment again
    await page.click('text=Persistence Test Experiment')
    
    // Verify data is still there (useRef prevents unnecessary clearing)
    await page.waitForSelector('text=Variables', { timeout: 5000 })
    await expect(variablesSection).toBeVisible()
    await expect(domChangesSection).toBeVisible()
    console.log('✅ Data persists correctly when navigating back and forth')

    console.log('✅ UI persistence test completed successfully')
    
    await context.close()
  })
})

async function getExtensionId(context: any): Promise<string> {
  let [background] = context.serviceWorkers()
  if (!background) {
    background = await context.waitForEvent('serviceworker')
  }
  const extensionId = background.url().split('/')[2]
  return extensionId
}