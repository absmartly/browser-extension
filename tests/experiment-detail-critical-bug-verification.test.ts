import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Critical Bug Fix Verification: Variables Disappearing', () => {
  test('Variables remain visible after API structure changes - Core Bug Fix Test', async () => {
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

    const popup = await context.newPage()
    let experimentApiCallCount = 0
    
    // Enable detailed console logging to track the bug
    popup.on('console', msg => {
      if (msg.text().includes('ExperimentDetail') || msg.text().includes('variant')) {
        console.log('DEBUG:', msg.text())
      }
    })
    popup.on('pageerror', err => console.error('POPUP ERROR:', err))
    
    // Mock API to reproduce the exact bug scenario from the console logs
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && route.request().method() === 'GET' && !url.includes('/experiments/')) {
        // Mock experiments list call
        const mockResponse = {
          experiments: [{
            id: 1,
            name: 'critical_bug_test',
            display_name: 'Critical Bug Test - Variables Should Stay Visible',
            state: 'ready',
            percentage_of_traffic: 100,
            variants: [ // This has variants initially
              {
                id: 1,
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  critical_var: 'critical_value',
                  feature_enabled: true,
                  dom_changes: [
                    {
                      selector: '.critical-button',
                      type: 'style',
                      value: { 'background-color': 'green' },
                      enabled: true
                    }
                  ]
                })
              },
              {
                id: 2,
                variant: 1,
                name: 'Test Variant',
                config: JSON.stringify({
                  critical_var: 'test_value',
                  feature_enabled: false,
                  test_feature: 'enabled',
                  dom_changes: [
                    {
                      selector: '.critical-button',
                      type: 'style',
                      value: { 'background-color': 'red' },
                      enabled: true
                    },
                    {
                      selector: '.critical-text',
                      type: 'text',
                      value: 'Test Version',
                      enabled: true
                    }
                  ]
                })
              }
            ]
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
        experimentApiCallCount++
        console.log(`EXPERIMENT API CALL #${experimentApiCallCount}`)
        
        if (experimentApiCallCount === 1) {
          // First call - return the complete data with variants (mimics cache hit)
          const fullExperiment = {
            id: 1,
            name: 'critical_bug_test',
            display_name: 'Critical Bug Test - Variables Should Stay Visible',
            state: 'ready',
            percentage_of_traffic: 100,
            variants: [
              {
                id: 1,
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  critical_var: 'critical_value',
                  feature_enabled: true,
                  dom_changes: [
                    {
                      selector: '.critical-button',
                      type: 'style',
                      value: { 'background-color': 'green' },
                      enabled: true
                    }
                  ]
                })
              },
              {
                id: 2,
                variant: 1,
                name: 'Test Variant',
                config: JSON.stringify({
                  critical_var: 'test_value',
                  feature_enabled: false,
                  test_feature: 'enabled',
                  dom_changes: [
                    {
                      selector: '.critical-button',
                      type: 'style',
                      value: { 'background-color': 'red' },
                      enabled: true
                    },
                    {
                      selector: '.critical-text',
                      type: 'text',
                      value: 'Test Version',
                      enabled: true
                    }
                  ]
                })
              }
            ]
          }
          
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(fullExperiment)
          })
        } else {
          // Second call - return the PROBLEMATIC structure that causes the bug
          // This is what happens in the real ABSmartly API response
          const problematicResponse = {
            experiment: { // Note: wrapped in 'experiment' object
              id: 1,
              name: 'critical_bug_test',
              display_name: 'Critical Bug Test - Variables Should Stay Visible',
              state: 'ready',
              percentage_of_traffic: 100
              // CRITICAL: No 'variants' property here - this is what was causing the bug!
            },
            experiment_template_permissions: null
          }
          
          console.log('SENDING PROBLEMATIC RESPONSE (no variants):', problematicResponse)
          
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(problematicResponse)
          })
        }
      } else {
        route.continue()
      }
    })
    
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await popup.waitForTimeout(3000)

    // Configure settings if needed
    if (await popup.locator('text=Welcome to ABSmartly').isVisible()) {
      await popup.click('button:has-text("Configure Settings")')
      await popup.fill('input[type="url"]', 'http://localhost:8080')
      await popup.fill('input[type="password"]', 'test-api-key')
      await popup.click('button:has-text("Save Settings")')
      await popup.waitForTimeout(2000)
    }

    // Wait for experiments to load
    await popup.waitForSelector('text=Critical Bug Test', { timeout: 10000 })
    console.log('✅ Experiment found in list')

    // Click on the experiment to go to detail view
    await popup.click('text=Critical Bug Test')
    
    // Wait longer to ensure both API calls complete
    await popup.waitForTimeout(5000)
    
    console.log('🔍 Taking screenshot of current state...')
    await popup.screenshot({ path: 'tests/screenshots/critical-bug-fix-verification.png' })

    // CRITICAL ASSERTION: Variables should STILL be visible after the second API call
    // This is the core bug - variables would disappear when API returns structure without variants
    const variablesHeaderVisible = await popup.locator('text=Variables').isVisible()
    expect(variablesHeaderVisible).toBeTruthy() // CRITICAL: Variables section must remain visible after API structure change

    // Check that both variants are still displayed
    const controlVariantVisible = await popup.locator('text=Control').isVisible()
    expect(controlVariantVisible).toBeTruthy() // Control variant must remain visible

    const testVariantVisible = await popup.locator('text=Test Variant').isVisible()
    expect(testVariantVisible).toBeTruthy() // Test Variant must remain visible

    // Check that actual variable values are still displayed
    const criticalVarControl = await popup.locator('input[value="critical_value"]').isVisible()
    expect(criticalVarControl).toBeTruthy() // Control critical_var must remain visible

    const criticalVarTest = await popup.locator('input[value="test_value"]').isVisible()
    expect(criticalVarTest).toBeTruthy() // Test Variant critical_var must remain visible

    // Check that DOM changes sections are still displayed
    const domChangesControl = await popup.locator('text=DOM Changes for Control').isVisible()
    expect(domChangesControl).toBeTruthy() // DOM Changes for Control must remain visible

    const domChangesTest = await popup.locator('text=DOM Changes for Test Variant').isVisible()
    expect(domChangesTest).toBeTruthy() // DOM Changes for Test Variant must remain visible

    // Verify that Edit Variables button is still functional
    const editButton = await popup.locator('button:has-text("Edit Variables")').isVisible()
    expect(editButton).toBeTruthy() // Edit Variables button must remain visible and functional

    // Test edit functionality to ensure data integrity
    await popup.click('button:has-text("Edit Variables")')
    await popup.waitForTimeout(1000)

    // Should be able to edit variables
    const saveButton = await popup.locator('button:has-text("Save Changes")').isVisible()
    expect(saveButton).toBeTruthy() // Save Changes button should appear in edit mode

    const cancelButton = await popup.locator('button:has-text("Cancel")').isVisible()
    expect(cancelButton).toBeTruthy() // Cancel button should appear in edit mode

    // Test editing a variable value
    const editableInput = popup.locator('input[value="critical_value"]')
    await editableInput.click()
    await editableInput.clear()
    await editableInput.fill('edited_critical_value')

    // Cancel to verify data stability
    await popup.click('button:has-text("Cancel")')
    await popup.waitForTimeout(1000)

    // Variable should revert to original value (proving data integrity)
    const revertedValue = await popup.locator('input[value="critical_value"]').isVisible()
    expect(revertedValue).toBeTruthy() // Variable should revert to original value after cancel

    const editedValueGone = await popup.locator('input[value="edited_critical_value"]').isVisible()
    expect(editedValueGone).toBeFalsy() // Edited value should be discarded after cancel

    console.log('🎉 SUCCESS: Critical bug fix verified!')
    console.log('✅ Variables remain visible after API structure change')
    console.log('✅ All functionality remains intact')
    console.log('✅ Data integrity is preserved')

    await context.close()
  })

  test('Edge case: Verify parseVariantConfig helper handles problematic data', async () => {
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

    const popup = await context.newPage()
    
    // Track console warnings for invalid JSON parsing
    const consoleWarnings: string[] = []
    popup.on('console', msg => {
      if (msg.text().includes('Invalid JSON') || msg.text().includes('Failed to parse')) {
        consoleWarnings.push(msg.text())
        console.log('PARSE WARNING:', msg.text())
      }
    })
    
    // Mock API with various problematic variant configs
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && route.request().method() === 'GET' && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 2,
            name: 'edge_case_test',
            display_name: 'Edge Case Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Null Config',
                config: null // Null config
              },
              {
                variant: 1,
                name: 'Invalid JSON',
                config: '{invalid json string' // Invalid JSON
              },
              {
                variant: 2,
                name: 'Empty String',
                config: '' // Empty string
              },
              {
                variant: 3,
                name: 'Valid Config',
                config: JSON.stringify({
                  valid_var: 'valid_value',
                  dom_changes: [{ selector: '.valid', type: 'text', value: 'valid' }]
                })
              }
            ]
          }],
          total: 1,
          hasMore: false
        }
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
        })
      } else if (url.includes('/experiments/2')) {
        const mockExperiment = {
          id: 2,
          name: 'edge_case_test',
          display_name: 'Edge Case Test',
          state: 'ready',
          variants: [
            {
              variant: 0,
              name: 'Null Config',
              config: null
            },
            {
              variant: 1,
              name: 'Invalid JSON',
              config: '{invalid json string'
            },
            {
              variant: 2,
              name: 'Empty String',
              config: ''
            },
            {
              variant: 3,
              name: 'Valid Config',
              config: JSON.stringify({
                valid_var: 'valid_value',
                dom_changes: [{ selector: '.valid', type: 'text', value: 'valid' }]
              })
            }
          ]
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

    await popup.waitForSelector('text=Edge Case Test', { timeout: 10000 })
    await popup.click('text=Edge Case Test')
    await popup.waitForTimeout(3000)

    // All variants should be visible despite problematic configs
    const nullConfigVisible = await popup.locator('text=Null Config').isVisible()
    expect(nullConfigVisible).toBeTruthy() // Null config variant should be handled gracefully

    const invalidJsonVisible = await popup.locator('text=Invalid JSON').isVisible()
    expect(invalidJsonVisible).toBeTruthy() // Invalid JSON variant should be handled gracefully

    const emptyStringVisible = await popup.locator('text=Empty String').isVisible()
    expect(emptyStringVisible).toBeTruthy() // Empty string variant should be handled gracefully

    const validConfigVisible = await popup.locator('text=Valid Config').isVisible()
    expect(validConfigVisible).toBeTruthy() // Valid config variant should work normally

    // Valid config should show its variable
    const validVar = await popup.locator('input[value="valid_value"]').isVisible()
    expect(validVar).toBeTruthy() // Valid config should display its variables

    // Should have logged warnings for invalid configs
    expect(consoleWarnings.length).toBeGreaterThan(0) // Should log warnings for invalid JSON configs

    await popup.screenshot({ path: 'tests/screenshots/edge-case-handling.png' })

    await context.close()
  })

  test('User edits preservation during API data changes', async () => {
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

    const popup = await context.newPage()
    let apiCallCount = 0
    
    // Mock API that simulates server data changes
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 3,
            name: 'user_edit_test',
            display_name: 'User Edit Preservation Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  editable_var: 'original_server_value',
                  dom_changes: []
                })
              }
            ]
          }],
          total: 1,
          hasMore: false
        }
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
        })
      } else if (url.includes('/experiments/3')) {
        apiCallCount++
        
        const mockExperiment = {
          id: 3,
          name: 'user_edit_test',
          display_name: 'User Edit Preservation Test',
          state: 'ready',
          variants: [
            {
              variant: 0,
              name: 'Control',
              config: apiCallCount === 1 
                ? JSON.stringify({
                    editable_var: 'original_server_value',
                    dom_changes: []
                  })
                : null // Subsequent calls return null config to test preservation
            }
          ]
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

    await popup.waitForSelector('text=User Edit Preservation Test', { timeout: 10000 })
    await popup.click('text=User Edit Preservation Test')
    await popup.waitForTimeout(2000)

    // Enter edit mode and make changes
    await popup.click('button:has-text("Edit Variables")')
    await popup.waitForTimeout(500)

    // Edit the variable
    const editableInput = popup.locator('input[value="original_server_value"]')
    await editableInput.click()
    await editableInput.clear()
    await editableInput.fill('user_edited_value')

    // Simulate a data refresh by going back and returning (triggers API call)
    await popup.click('text=Back to experiments')
    await popup.waitForTimeout(1000)
    await popup.click('text=User Edit Preservation Test')
    await popup.waitForTimeout(2000)

    // User edit should be preserved despite server returning null config
    const userEditPreserved = await popup.locator('input[value="user_edited_value"]').isVisible()
    expect(userEditPreserved).toBeTruthy() // User edits should be preserved during server data updates

    // Original server value should not reappear
    const originalValueGone = await popup.locator('input[value="original_server_value"]').isVisible()
    expect(originalValueGone).toBeFalsy() // Original server value should not overwrite user edit

    console.log('✅ User edit preservation verified')

    await context.close()
  })
})