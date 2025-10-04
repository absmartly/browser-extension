import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('ExperimentDetail Bug Fix - Comprehensive Tests', () => {
  let context: any
  let extensionId: string
  
  test.beforeEach(async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-default-apps'
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    extensionId = background.url().split('/')[2]
  })

  test.afterEach(async () => {
    await context.close()
  })

  test('Critical Bug Fix: Variables remain visible after API data structure changes', async () => {
    const popup = await context.newPage()
    let apiCallCount = 0
    
    // Enable detailed console logging
    popup.on('console', msg => console.log('POPUP:', msg.text()))
    popup.on('pageerror', err => console.error('POPUP ERROR:', err))
    
    // Mock API to simulate the exact bug scenario
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && route.request().method() === 'GET' && !url.includes('/experiments/')) {
        // First call - return experiments list
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
                  feature_flag: true,
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
                  feature_flag: false,
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
        apiCallCount++
        
        if (apiCallCount === 1) {
          // First call - return full experiment data with variants
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
                  feature_flag: true,
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
                  feature_flag: false,
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
            ]
          }
          
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockExperiment)
          })
        } else {
          // Second call - return the problematic API structure that causes the bug
          // This simulates what happens in the real ABSmartly API
          const mockExperiment = {
            experiment: {
              id: 1,
              name: 'test_experiment',
              display_name: 'Test Experiment',
              state: 'ready',
              percentage_of_traffic: 100
              // Note: NO variants property here - this is what causes the bug
            },
            experiment_template_permissions: null
          }
          
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockExperiment)
          })
        }
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

    // Wait for experiments to load
    await popup.waitForSelector('text=Test Experiment', { timeout: 10000 })
    
    // Click on the experiment to go to detail view
    await popup.click('text=Test Experiment')
    await popup.waitForTimeout(3000) // Wait for both API calls to complete

    // Take screenshot before assertions
    await popup.screenshot({ path: 'tests/screenshots/bug-fix-verification.png' })

    // CRITICAL TEST: Variables should still be visible after the second API call
    const variablesHeader = await popup.locator('text=Variables').isVisible()
    expect(variablesHeader).toBeTruthy() // Variables section should remain visible after API structure change

    // Check that both variants are still displayed
    const controlVariant = await popup.locator('text=Control').isVisible()
    expect(controlVariant).toBeTruthy() // Control variant should remain visible

    const variant1 = await popup.locator('text=Variant 1').isVisible()
    expect(variant1).toBeTruthy() // Variant 1 should remain visible

    // Check that variables are still displayed
    const testVariableInput = await popup.locator('input[value="control_value"]').isVisible()
    expect(testVariableInput).toBeTruthy() // Control variable should remain visible

    const variantVariableInput = await popup.locator('input[value="variant_value"]').isVisible()
    expect(variantVariableInput).toBeTruthy() // Variant variable should remain visible

    // Check that DOM changes are still displayed
    const domChangesControl = await popup.locator('text=DOM Changes for Control').isVisible()
    expect(domChangesControl).toBeTruthy() // DOM Changes for Control should remain visible

    const domChangesVariant = await popup.locator('text=DOM Changes for Variant 1').isVisible()
    expect(domChangesVariant).toBeTruthy() // DOM Changes for Variant 1 should remain visible

    console.log('SUCCESS: Bug fix verified - Variables and DOM changes remain visible!')
  })

  test('Edge Case: Empty experiment.variants array handling', async () => {
    const popup = await context.newPage()
    
    // Mock API with empty variants array
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 2,
            name: 'empty_experiment',
            display_name: 'Empty Experiment',
            state: 'draft',
            variants: [] // Empty variants array
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
          name: 'empty_experiment',
          display_name: 'Empty Experiment',
          state: 'draft',
          variants: [] // Empty variants array
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

    // Wait for experiments to load and click
    await popup.waitForSelector('text=Empty Experiment', { timeout: 10000 })
    await popup.click('text=Empty Experiment')
    await popup.waitForTimeout(2000)

    // Should show experiment details but no variants section
    const backButton = await popup.locator('text=Back to experiments').isVisible()
    expect(backButton).toBeTruthy() // Should be in experiment detail view

    const experimentTitle = await popup.locator('text=Empty Experiment').isVisible()
    expect(experimentTitle).toBeTruthy() // Experiment title should be visible

    // Variables section should not be visible for empty variants
    const variablesHeader = await popup.locator('text=Variables').isVisible()
    expect(variablesHeader).toBeFalsy() // Variables section should not be visible for empty variants
  })

  test('Edge Case: Malformed variant config JSON handling', async () => {
    const popup = await context.newPage()
    
    // Mock API with malformed JSON in variant config
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 3,
            name: 'malformed_experiment',
            display_name: 'Malformed JSON Experiment',
            state: 'ready',
            variants: [
              {
                id: 1,
                variant: 0,
                name: 'Control',
                config: '{invalid json}' // Malformed JSON
              },
              {
                id: 2,
                variant: 1,
                name: 'Variant 1',
                config: JSON.stringify({
                  valid_variable: 'valid_value'
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
        const mockExperiment = {
          id: 3,
          name: 'malformed_experiment',
          display_name: 'Malformed JSON Experiment',
          state: 'ready',
          variants: [
            {
              id: 1,
              variant: 0,
              name: 'Control',
              config: '{invalid json}' // Malformed JSON
            },
            {
              id: 2,
              variant: 1,
              name: 'Variant 1',
              config: JSON.stringify({
                valid_variable: 'valid_value'
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
    
    popup.on('console', msg => {
      if (msg.text().includes('Invalid JSON')) {
        console.log('Expected warning caught:', msg.text())
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

    await popup.waitForSelector('text=Malformed JSON Experiment', { timeout: 10000 })
    await popup.click('text=Malformed JSON Experiment')
    await popup.waitForTimeout(2000)

    // Should show experiment details
    const variablesHeader = await popup.locator('text=Variables').isVisible()
    expect(variablesHeader).toBeTruthy() // Variables section should be visible even with malformed JSON

    // Control variant should show empty variables (fallback)
    const controlVariant = await popup.locator('text=Control').isVisible()
    expect(controlVariant).toBeTruthy() // Control variant should be visible

    // Variant 1 should show valid variables
    const variant1 = await popup.locator('text=Variant 1').isVisible()
    expect(variant1).toBeTruthy() // Variant 1 should be visible

    const validVariableInput = await popup.locator('input[value="valid_value"]').isVisible()
    expect(validVariableInput).toBeTruthy() // Valid variable should be displayed
  })

  test('Rapid experiment switching does not cause UI flickering', async () => {
    const popup = await context.newPage()
    
    // Mock multiple experiments
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [
            {
              id: 4,
              name: 'experiment_a',
              display_name: 'Experiment A',
              state: 'ready',
              variants: [
                {
                  variant: 0,
                  name: 'Control A',
                  config: JSON.stringify({ var_a: 'value_a' })
                }
              ]
            },
            {
              id: 5,
              name: 'experiment_b',
              display_name: 'Experiment B',
              state: 'ready',
              variants: [
                {
                  variant: 0,
                  name: 'Control B',
                  config: JSON.stringify({ var_b: 'value_b' })
                }
              ]
            }
          ],
          total: 2,
          hasMore: false
        }
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
        })
      } else if (url.includes('/experiments/4')) {
        const mockExperiment = {
          id: 4,
          name: 'experiment_a',
          display_name: 'Experiment A',
          state: 'ready',
          variants: [
            {
              variant: 0,
              name: 'Control A',
              config: JSON.stringify({ var_a: 'value_a' })
            }
          ]
        }
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockExperiment)
        })
      } else if (url.includes('/experiments/5')) {
        const mockExperiment = {
          id: 5,
          name: 'experiment_b',
          display_name: 'Experiment B',
          state: 'ready',
          variants: [
            {
              variant: 0,
              name: 'Control B',
              config: JSON.stringify({ var_b: 'value_b' })
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

    // Rapidly switch between experiments
    await popup.waitForSelector('text=Experiment A', { timeout: 10000 })
    
    // Go to Experiment A
    await popup.click('text=Experiment A')
    await popup.waitForTimeout(1000)
    
    // Verify Experiment A variables are visible
    const varAInput = await popup.locator('input[value="value_a"]').isVisible()
    expect(varAInput).toBeTruthy() // Experiment A variables should be visible
    
    // Go back to list
    await popup.click('text=Back to experiments')
    await popup.waitForTimeout(500)
    
    // Go to Experiment B quickly
    await popup.click('text=Experiment B')
    await popup.waitForTimeout(1000)
    
    // Verify Experiment B variables are visible (no flickering/disappearing)
    const varBInput = await popup.locator('input[value="value_b"]').isVisible()
    expect(varBInput).toBeTruthy() // Experiment B variables should be visible after rapid switching
    
    // Go back and forth rapidly to test for flickering
    await popup.click('text=Back to experiments')
    await popup.waitForTimeout(200)
    await popup.click('text=Experiment A')
    await popup.waitForTimeout(500)
    
    // Should still show correct variables
    const varAInputAgain = await popup.locator('input[value="value_a"]').isVisible()
    expect(varAInputAgain).toBeTruthy() // Experiment A variables should remain stable after rapid switching
  })

  test('User edits are preserved during data refreshes', async () => {
    const popup = await context.newPage()
    let refreshCount = 0
    
    // Mock API that changes data on refresh
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 6,
            name: 'refresh_experiment',
            display_name: 'Refresh Test Experiment',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  original_var: 'original_value',
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
      } else if (url.includes('/experiments/6')) {
        refreshCount++
        
        const mockExperiment = {
          id: 6,
          name: 'refresh_experiment',
          display_name: 'Refresh Test Experiment',
          state: 'ready',
          variants: [
            {
              variant: 0,
              name: 'Control',
              config: JSON.stringify({
                original_var: refreshCount === 1 ? 'original_value' : 'updated_from_server',
                dom_changes: []
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

    await popup.waitForSelector('text=Refresh Test Experiment', { timeout: 10000 })
    await popup.click('text=Refresh Test Experiment')
    await popup.waitForTimeout(2000)

    // Enter edit mode
    await popup.click('button:has-text("Edit Variables")')
    await popup.waitForTimeout(500)

    // Make user edits
    const originalVarInput = popup.locator('input[value="original_value"]')
    await originalVarInput.click()
    await originalVarInput.clear()
    await originalVarInput.fill('user_edited_value')

    // Add a new variable
    await popup.click('button:has-text("Add Variable")')
    // Handle the prompt dialog
    popup.on('dialog', async dialog => {
      await dialog.accept('user_added_var')
    })
    await popup.waitForTimeout(500)

    // Fill the new variable value
    const newVarInput = popup.locator('input[value=""]').last()
    await newVarInput.fill('user_added_value')

    // Simulate a data refresh (this would happen in real usage)
    await popup.reload()
    await popup.waitForTimeout(3000)

    // Navigate back to the experiment
    if (await popup.locator('text=Welcome to ABSmartly').isVisible()) {
      await popup.click('button:has-text("Configure Settings")')
      await popup.fill('input[type="url"]', 'http://localhost:8080')
      await popup.fill('input[type="password"]', 'test-api-key')
      await popup.click('button:has-text("Save Settings")')
      await popup.waitForTimeout(2000)
    }

    await popup.waitForSelector('text=Refresh Test Experiment', { timeout: 10000 })
    await popup.click('text=Refresh Test Experiment')
    await popup.waitForTimeout(2000)

    // User edits should be preserved, not overwritten by server data
    const editedVarStillThere = await popup.locator('input[value="user_edited_value"]').isVisible()
    expect(editedVarStillThere).toBeTruthy() // User edited variable value should be preserved during refresh

    // Original server value should not overwrite user edits
    const originalValueGone = await popup.locator('input[value="original_value"]').isVisible()
    expect(originalValueGone).toBeFalsy() // Original server value should not overwrite user edit
  })

  test('Save functionality properly updates variant configurations', async () => {
    const popup = await context.newPage()
    let saveRequestData: any = null
    
    // Mock API and capture save requests
    await popup.route('**/*', route => {
      const url = route.request().url()
      const method = route.request().method()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 7,
            name: 'save_test_experiment',
            display_name: 'Save Test Experiment',
            state: 'ready',
            variants: [
              {
                id: 1,
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  test_var: 'initial_value',
                  dom_changes: [
                    {
                      selector: '.button',
                      type: 'style',
                      value: { color: 'blue' },
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
      } else if (url.includes('/experiments/7') && method === 'GET') {
        const mockExperiment = {
          id: 7,
          name: 'save_test_experiment',
          display_name: 'Save Test Experiment',
          state: 'ready',
          variants: [
            {
              id: 1,
              variant: 0,
              name: 'Control',
              config: JSON.stringify({
                test_var: 'initial_value',
                dom_changes: [
                  {
                    selector: '.button',
                    type: 'style',
                    value: { color: 'blue' },
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
          body: JSON.stringify(mockExperiment)
        })
      } else if (url.includes('/experiments/7') && (method === 'PUT' || method === 'PATCH')) {
        // Capture save request data
        const postData = route.request().postData()
        if (postData) {
          saveRequestData = JSON.parse(postData)
        }
        
        // Return success response
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
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

    await popup.waitForSelector('text=Save Test Experiment', { timeout: 10000 })
    await popup.click('text=Save Test Experiment')
    await popup.waitForTimeout(2000)

    // Enter edit mode
    await popup.click('button:has-text("Edit Variables")')
    await popup.waitForTimeout(500)

    // Edit existing variable
    const testVarInput = popup.locator('input[value="initial_value"]')
    await testVarInput.click()
    await testVarInput.clear()
    await testVarInput.fill('edited_value')

    // Add a new variable
    await popup.click('button:has-text("Add Variable")')
    popup.on('dialog', async dialog => {
      await dialog.accept('new_variable')
    })
    await popup.waitForTimeout(500)

    const newVarInput = popup.locator('input[value=""]').last()
    await newVarInput.fill('new_value')

    // Save changes
    await popup.click('button:has-text("Save Changes")')
    await popup.waitForTimeout(2000)

    // Verify save request was made with correct data
    expect(saveRequestData).toBeTruthy('Save request should have been made')
    expect(saveRequestData.variants).toBeTruthy('Save request should include variants')
    
    const savedVariant = saveRequestData.variants[0]
    const savedConfig = JSON.parse(savedVariant.config)
    
    expect(savedConfig.test_var).toBe('edited_value', 'Edited variable should be saved')
    expect(savedConfig.new_variable).toBe('new_value', 'New variable should be saved')
    expect(savedConfig.dom_changes).toBeTruthy('DOM changes should be preserved in save')
    expect(savedConfig.dom_changes[0].selector).toBe('.button', 'DOM change details should be preserved')
    
    console.log('SUCCESS: Save functionality properly serializes variant configurations!')
  })
})