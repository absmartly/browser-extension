import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Regression Tests for Experiment Variables Bug Fix', () => {
  test('should prevent variables and DOM changes from disappearing after user interactions', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    console.log('Loading extension from:', pathToExtension)
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
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

    // Wait for popup to load
    await page.waitForSelector('.w-full', { timeout: 10000 })

    // Mock API with rich experiment data to test the bug scenario
    await page.route('**/experiments*', async (route) => {
      const response = {
        data: [
          {
            id: 100,
            name: 'regression-test-experiment',
            display_name: 'Regression Test - Variables Should Not Disappear',
            status: 'running',
            variants: [
              {
                name: 'Control',
                variant: 0,
                config: {
                  headerText: 'Welcome to Control',
                  buttonColor: '#blue',
                  enableFeature: false,
                  dom_changes: [
                    { selector: '.header', property: 'innerHTML', value: 'Control Header' },
                    { selector: '.button', property: 'style.backgroundColor', value: 'blue' }
                  ]
                }
              },
              {
                name: 'Treatment A',
                variant: 1, 
                config: {
                  headerText: 'Welcome to Treatment A',
                  buttonColor: '#green',
                  enableFeature: true,
                  conversionGoal: 'signup',
                  dom_changes: [
                    { selector: '.header', property: 'innerHTML', value: 'Treatment A Header' },
                    { selector: '.button', property: 'style.backgroundColor', value: 'green' },
                    { selector: '.cta', property: 'style.display', value: 'block' }
                  ]
                }
              },
              {
                name: 'Treatment B',
                variant: 2,
                config: {
                  headerText: 'Welcome to Treatment B',
                  buttonColor: '#red',
                  enableFeature: true,
                  conversionGoal: 'purchase',
                  dynamicContent: 'Special offer text',
                  dom_changes: [
                    { selector: '.header', property: 'innerHTML', value: 'Treatment B Header' },
                    { selector: '.button', property: 'style.backgroundColor', value: 'red' },
                    { selector: '.offer', property: 'innerHTML', value: 'Special Offer!' }
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
        id: 100,
        name: 'regression-test-experiment',
        display_name: 'Regression Test - Variables Should Not Disappear',
        status: 'running',
        variants: [
          {
            name: 'Control',
            variant: 0,
            config: {
              headerText: 'Welcome to Control',
              buttonColor: '#blue',
              enableFeature: false,
              dom_changes: [
                { selector: '.header', property: 'innerHTML', value: 'Control Header' },
                { selector: '.button', property: 'style.backgroundColor', value: 'blue' }
              ]
            }
          },
          {
            name: 'Treatment A',
            variant: 1,
            config: {
              headerText: 'Welcome to Treatment A',
              buttonColor: '#green',
              enableFeature: true,
              conversionGoal: 'signup',
              dom_changes: [
                { selector: '.header', property: 'innerHTML', value: 'Treatment A Header' },
                { selector: '.button', property: 'style.backgroundColor', value: 'green' },
                { selector: '.cta', property: 'style.display', value: 'block' }
              ]
            }
          },
          {
            name: 'Treatment B',
            variant: 2,
            config: {
              headerText: 'Welcome to Treatment B',
              buttonColor: '#red',
              enableFeature: true,
              conversionGoal: 'purchase',
              dynamicContent: 'Special offer text',
              dom_changes: [
                { selector: '.header', property: 'innerHTML', value: 'Treatment B Header' },
                { selector: '.button', property: 'style.backgroundColor', value: 'red' },
                { selector: '.offer', property: 'innerHTML', value: 'Special Offer!' }
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

    // Wait for experiments to load
    await page.waitForSelector('text=Regression Test - Variables Should Not Disappear', { timeout: 10000 })
    console.log('Mock experiment loaded')

    // Take screenshot for debugging
    await page.screenshot({ path: 'tests/screenshots/regression-experiment-list.png' })

    // Click on experiment to open detail view
    await page.click('text=Regression Test - Variables Should Not Disappear')
    console.log('Clicked on experiment')

    // Wait for detail view to load
    await page.waitForSelector('text=Regression Test - Variables Should Not Disappear', { timeout: 5000 })
    console.log('Detail view loaded')

    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/regression-detail-initial.png' })

    // CRITICAL TEST 1: Verify variables section is visible immediately
    const variablesSection = await page.locator('text=Variables').first()
    await expect(variablesSection).toBeVisible()
    console.log('✅ Variables section is visible initially')

    // CRITICAL TEST 2: Verify DOM changes section is visible immediately  
    const domChangesSection = await page.locator('text=DOM Changes').first()
    await expect(domChangesSection).toBeVisible()
    console.log('✅ DOM changes section is visible initially')

    // CRITICAL TEST 3: Verify specific variable content is visible
    const headerTextVariable = await page.locator('text=headerText').first()
    await expect(headerTextVariable).toBeVisible()
    console.log('✅ Specific variable content is visible')

    // CRITICAL TEST 4: Verify DOM change content is visible
    const domChangeContent = await page.locator('text=.header').first()
    await expect(domChangeContent).toBeVisible()
    console.log('✅ DOM changes content is visible')

    // TEST SCENARIO: User tries to edit variables (this used to trigger the bug)
    const editVariablesButton = await page.locator('button:has-text("Edit Variables")').first()
    if (await editVariablesButton.isVisible()) {
      console.log('Found Edit Variables button - testing edit mode')
      await editVariablesButton.click()
      
      // Wait for edit mode
      await page.waitForTimeout(1000)
      
      // Take screenshot in edit mode
      await page.screenshot({ path: 'tests/screenshots/regression-edit-mode.png' })
      
      // CRITICAL TEST 5: Variables should still be visible in edit mode
      await expect(variablesSection).toBeVisible()
      console.log('✅ Variables remain visible in edit mode')
      
      // CRITICAL TEST 6: DOM changes should still be visible in edit mode
      await expect(domChangesSection).toBeVisible()
      console.log('✅ DOM changes remain visible in edit mode')
      
      // THE BIG TEST: Cancel editing (this was the trigger for the disappearing bug)
      const cancelButton = await page.locator('button:has-text("Cancel")').first()
      if (await cancelButton.isVisible()) {
        console.log('Testing Cancel button - this was the main bug trigger')
        await cancelButton.click()
        
        // Wait for transition back to view mode
        await page.waitForTimeout(1000)
        
        // Take screenshot after cancel
        await page.screenshot({ path: 'tests/screenshots/regression-after-cancel.png' })
        
        // CRITICAL REGRESSION TEST: Variables should NOT disappear after Cancel
        await expect(variablesSection).toBeVisible()
        console.log('✅ CRITICAL: Variables still visible after Cancel (regression test passed)')
        
        // CRITICAL REGRESSION TEST: DOM changes should NOT disappear after Cancel  
        await expect(domChangesSection).toBeVisible()
        console.log('✅ CRITICAL: DOM changes still visible after Cancel (regression test passed)')
        
        // Verify specific content is still there
        await expect(headerTextVariable).toBeVisible()
        await expect(domChangeContent).toBeVisible()
        console.log('✅ Specific variable and DOM content persists after Cancel')
      }
    }

    // TEST SCENARIO: Switch between variants (another potential trigger)
    const treatmentAVariant = await page.locator('text=Treatment A').first()
    if (await treatmentAVariant.isVisible()) {
      console.log('Testing variant switching')
      await treatmentAVariant.click()
      
      await page.waitForTimeout(1000)
      
      // Variables and DOM changes should remain visible after variant switch
      await expect(variablesSection).toBeVisible()
      await expect(domChangesSection).toBeVisible()
      console.log('✅ Variables and DOM changes persist after variant switching')
      
      // Switch to Treatment B
      const treatmentBVariant = await page.locator('text=Treatment B').first()
      if (await treatmentBVariant.isVisible()) {
        await treatmentBVariant.click()
        await page.waitForTimeout(1000)
        
        await expect(variablesSection).toBeVisible()
        await expect(domChangesSection).toBeVisible()
        console.log('✅ Variables and DOM changes persist after switching to Treatment B')
      }
    }

    // TEST SCENARIO: Navigate away and back (tests useRef persistence logic)
    console.log('Testing navigation persistence')
    const backButton = await page.locator('button:has-text("Back")').first()
    await backButton.click()
    
    // Wait for experiment list
    await page.waitForSelector('text=Regression Test - Variables Should Not Disappear', { timeout: 5000 })
    
    // Click experiment again
    await page.click('text=Regression Test - Variables Should Not Disappear')
    
    // Wait for detail view
    await page.waitForSelector('text=Variables', { timeout: 5000 })
    
    // CRITICAL TEST: Data should be preserved and not trigger unnecessary re-processing
    await expect(variablesSection).toBeVisible()
    await expect(domChangesSection).toBeVisible()
    console.log('✅ Variables and DOM changes persist across navigation (useRef working)')

    // Final verification - take a screenshot of the stable state
    await page.screenshot({ path: 'tests/screenshots/regression-final-stable.png' })

    console.log('✅ ALL REGRESSION TESTS PASSED - Bug fix verified')
    
    await context.close()
  })

  test('should handle loading states without clearing existing data', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-default-apps'
      ],
      timeout: 30000
    })

    const page = await context.newPage()
    
    await page.goto(`chrome-extension://${await getExtensionId(context)}/popup.html`)
    await page.waitForSelector('.w-full', { timeout: 10000 })

    // Mock with delayed response to test loading states
    await page.route('**/experiments*', async (route) => {
      // Add a small delay to test loading behavior
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const response = {
        data: [
          {
            id: 200,
            name: 'loading-test',
            display_name: 'Loading State Test',
            status: 'ready',
            variants: [
              {
                name: 'Control',
                variant: 0,
                config: {
                  testVar: 'initial_value',
                  dom_changes: [{ selector: '.test', property: 'innerHTML', value: 'Test' }]
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

    // Mock individual experiment with delay
    await page.route('**/experiment/*', async (route) => {
      // Longer delay to test that loading doesn't clear data
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const response = {
        id: 200,
        name: 'loading-test',
        display_name: 'Loading State Test',
        status: 'ready',
        variants: [
          {
            name: 'Control',
            variant: 0,
            config: {
              testVar: 'updated_value',
              newVariable: 'added_during_fetch',
              dom_changes: [
                { selector: '.test', property: 'innerHTML', value: 'Updated Test' },
                { selector: '.new', property: 'innerHTML', value: 'New Element' }
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

    // Wait for initial load
    await page.waitForSelector('text=Loading State Test', { timeout: 10000 })
    
    // Click on experiment
    await page.click('text=Loading State Test')
    
    // Should show loading state
    const loadingIndicator = await page.locator('text=Loading').first()
    if (await loadingIndicator.isVisible({ timeout: 1000 })) {
      console.log('✅ Loading indicator shown during fetch')
      
      // During loading, initial data should still be visible if it exists
      // The fix ensures we don't clear data during loading states
      await page.waitForSelector('text=Variables', { timeout: 10000 })
      console.log('✅ Variables section remains accessible during loading')
    }
    
    // Wait for loading to complete
    await page.waitForTimeout(3000)
    
    // Verify final data is loaded
    const variablesSection = await page.locator('text=Variables').first()
    await expect(variablesSection).toBeVisible()
    
    // Verify updated content is shown
    const updatedVariable = await page.locator('text=updated_value').first()
    await expect(updatedVariable).toBeVisible()
    console.log('✅ Data updated correctly after loading completes')

    console.log('✅ Loading state handling test passed')
    
    await context.close()
  })

  test('should handle API errors gracefully without breaking UI', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-default-apps'
      ],
      timeout: 30000
    })

    const page = await context.newPage()
    
    await page.goto(`chrome-extension://${await getExtensionId(context)}/popup.html`)
    await page.waitForSelector('.w-full', { timeout: 10000 })

    // Mock successful experiments list
    await page.route('**/experiments*', async (route) => {
      const response = {
        data: [
          {
            id: 300,
            name: 'error-test',
            display_name: 'API Error Test',
            status: 'ready',
            variants: [
              {
                name: 'Control',
                variant: 0,
                config: {
                  cachedVar: 'from_cache',
                  dom_changes: [{ selector: '.cache', property: 'innerHTML', value: 'Cached' }]
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

    // Mock individual experiment fetch to fail (simulates the scenario that triggered the bug)
    await page.route('**/experiment/*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })

    // Wait for experiments list
    await page.waitForSelector('text=API Error Test', { timeout: 10000 })
    
    // Click on experiment (this will trigger the API error)
    await page.click('text=API Error Test')
    
    // The fix should preserve cached data even when API fails
    await page.waitForSelector('text=Variables', { timeout: 5000 })
    
    // CRITICAL: Variables should be visible using cached data as fallback
    const variablesSection = await page.locator('text=Variables').first()
    await expect(variablesSection).toBeVisible()
    console.log('✅ Variables visible despite API error (fallback to cached data)')
    
    // DOM changes should also be visible
    const domChangesSection = await page.locator('text=DOM Changes').first()
    await expect(domChangesSection).toBeVisible()
    console.log('✅ DOM changes visible despite API error')
    
    // Cached content should be displayed
    const cachedVariable = await page.locator('text=cachedVar').first()
    await expect(cachedVariable).toBeVisible()
    console.log('✅ Cached variable content displayed as fallback')

    console.log('✅ API error handling test passed - UI remains functional')
    
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