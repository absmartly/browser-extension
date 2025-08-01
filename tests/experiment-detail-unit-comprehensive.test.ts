import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('ExperimentDetail Component Unit Tests', () => {
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

  test('parseVariantConfig helper function handles all edge cases', async () => {
    const popup = await context.newPage()
    
    // Test various edge cases for variant config parsing
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [
            {
              id: 1,
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
                  name: 'Undefined Config',
                  config: undefined // Undefined config
                },
                {
                  variant: 2,
                  name: 'Empty String Config',
                  config: '' // Empty string config
                },
                {
                  variant: 3,
                  name: 'Invalid JSON Config',
                  config: '{invalid json' // Invalid JSON
                },
                {
                  variant: 4,
                  name: 'Non-String Config',
                  config: { 
                    direct_object: 'value',
                    dom_changes: [{ selector: '.test', type: 'text', value: 'test' }]
                  } // Direct object config
                },
                {
                  variant: 5,
                  name: 'Valid JSON Config',
                  config: JSON.stringify({
                    test_var: 'test_value',
                    nested_obj: { prop: 'value' },
                    dom_changes: [
                      { selector: '.valid', type: 'style', value: { color: 'red' } }
                    ]
                  })
                }
              ]
            }
          ],
          total: 1,
          hasMore: false
        }
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
        })
      } else if (url.includes('/experiments/1')) {
        // Return the same data for detail view
        const mockExperiment = {
          id: 1,
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
              name: 'Undefined Config',
              config: undefined
            },
            {
              variant: 2,
              name: 'Empty String Config',
              config: ''
            },
            {
              variant: 3,
              name: 'Invalid JSON Config',
              config: '{invalid json'
            },
            {
              variant: 4,
              name: 'Non-String Config',
              config: { 
                direct_object: 'value',
                dom_changes: [{ selector: '.test', type: 'text', value: 'test' }]
              }
            },
            {
              variant: 5,
              name: 'Valid JSON Config',
              config: JSON.stringify({
                test_var: 'test_value',
                nested_obj: { prop: 'value' },
                dom_changes: [
                  { selector: '.valid', type: 'style', value: { color: 'red' } }
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
        route.continue()
      }
    })
    
    // Enable console logging to catch parsing warnings
    const consoleMessages: string[] = []
    popup.on('console', msg => {
      consoleMessages.push(msg.text())
      console.log('POPUP:', msg.text())
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

    // All variants should be displayed, even with problematic configs
    const nullConfigVariant = await popup.locator('text=Null Config').isVisible()
    expect(nullConfigVariant).toBe(true, 'Null config variant should be displayed')

    const undefinedConfigVariant = await popup.locator('text=Undefined Config').isVisible()
    expect(undefinedConfigVariant).toBe(true, 'Undefined config variant should be displayed')

    const emptyStringConfigVariant = await popup.locator('text=Empty String Config').isVisible()
    expect(emptyStringConfigVariant).toBe(true, 'Empty string config variant should be displayed')

    const invalidJsonConfigVariant = await popup.locator('text=Invalid JSON Config').isVisible()
    expect(invalidJsonConfigVariant).toBe(true, 'Invalid JSON config variant should be displayed')

    const nonStringConfigVariant = await popup.locator('text=Non-String Config').isVisible()
    expect(nonStringConfigVariant).toBe(true, 'Non-string config variant should be displayed')

    const validJsonConfigVariant = await popup.locator('text=Valid JSON Config').isVisible()
    expect(validJsonConfigVariant).toBe(true, 'Valid JSON config variant should be displayed')

    // Check that valid config produces correct variables
    const testVarInput = await popup.locator('input[value="test_value"]').isVisible()
    expect(testVarInput).toBe(true, 'Valid config should produce correct variables')

    // Check that direct object config works
    const directObjectInput = await popup.locator('input[value="value"]').isVisible()
    expect(directObjectInput).toBe(true, 'Direct object config should work')

    // Check that DOM changes are parsed correctly
    const validDomChanges = await popup.locator('text=DOM Changes for Valid JSON Config').isVisible()
    expect(validDomChanges).toBe(true, 'Valid DOM changes should be displayed')

    const testDomChanges = await popup.locator('text=DOM Changes for Non-String Config').isVisible()
    expect(testDomChanges).toBe(true, 'Direct object DOM changes should be displayed')

    // Verify that parsing warnings were logged for invalid configs
    const hasInvalidJsonWarning = consoleMessages.some(msg => 
      msg.includes('Invalid JSON') || msg.includes('Failed to parse variant config')
    )
    expect(hasInvalidJsonWarning).toBe(true, 'Should log warnings for invalid JSON configs')

    await popup.screenshot({ path: 'tests/screenshots/edge-case-parsing.png' })
  })

  test('shouldUpdateVariantConfig helper function logic verification', async () => {
    const popup = await context.newPage()
    let apiCallCount = 0
    
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 2,
            name: 'update_logic_test',
            display_name: 'Update Logic Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  initial_var: 'initial_value'
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
        apiCallCount++
        
        if (apiCallCount === 1) {
          // First call - return initial config
          const mockExperiment = {
            id: 2,
            name: 'update_logic_test',
            display_name: 'Update Logic Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  initial_var: 'initial_value'
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
          // Second call - return no config (should preserve user edits)
          const mockExperiment = {
            id: 2,
            name: 'update_logic_test',
            display_name: 'Update Logic Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: null // No config - should not overwrite existing data
              }
            ]
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

    await popup.waitForSelector('text=Update Logic Test', { timeout: 10000 })
    await popup.click('text=Update Logic Test')
    await popup.waitForTimeout(2000)

    // Verify initial variable is loaded
    const initialVarInput = await popup.locator('input[value="initial_value"]').isVisible()
    expect(initialVarInput).toBe(true, 'Initial variable should be loaded')

    // Enter edit mode and make changes
    await popup.click('button:has-text("Edit Variables")')
    await popup.waitForTimeout(500)

    const varInput = popup.locator('input[value="initial_value"]')
    await varInput.click()
    await varInput.clear()
    await varInput.fill('user_edited_value')

    // Force a refresh by going back and returning (triggers second API call)
    await popup.click('text=Back to experiments')
    await popup.waitForTimeout(1000)
    await popup.click('text=Update Logic Test')
    await popup.waitForTimeout(2000)

    // The user edit should be preserved, not overwritten by null config
    const editedVarStillThere = await popup.locator('input[value="user_edited_value"]').isVisible()
    expect(editedVarStillThere).toBe(true, 'User edited value should be preserved when server returns null config')

    // Original value should not reappear
    const originalValueGone = await popup.locator('input[value="initial_value"]').isVisible()
    expect(originalValueGone).toBe(false, 'Original value should not overwrite user edit')
  })

  test('Enhanced useEffect with smart experiment ID tracking', async () => {
    const popup = await context.newPage()
    
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [
            {
              id: 100,
              name: 'experiment_100',
              display_name: 'Experiment 100',
              state: 'ready',
              variants: [
                {
                  variant: 0,
                  name: 'Control 100',
                  config: JSON.stringify({ exp100_var: 'exp100_value' })
                }
              ]
            },
            {
              id: 200,
              name: 'experiment_200',
              display_name: 'Experiment 200',
              state: 'ready',
              variants: [
                {
                  variant: 0,
                  name: 'Control 200',
                  config: JSON.stringify({ exp200_var: 'exp200_value' })
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
      } else if (url.includes('/experiments/100')) {
        const mockExperiment = {
          id: 100,
          name: 'experiment_100',
          display_name: 'Experiment 100',
          state: 'ready',
          variants: [
            {
              variant: 0,
              name: 'Control 100',
              config: JSON.stringify({ exp100_var: 'exp100_value' })
            }
          ]
        }
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockExperiment)
        })
      } else if (url.includes('/experiments/200')) {
        const mockExperiment = {
          id: 200,
          name: 'experiment_200',
          display_name: 'Experiment 200',
          state: 'ready',
          variants: [
            {
              variant: 0,
              name: 'Control 200',
              config: JSON.stringify({ exp200_var: 'exp200_value' })
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
    
    const consoleMessages: string[] = []
    popup.on('console', msg => {
      consoleMessages.push(msg.text())
      if (msg.text().includes('Processing variant data for experiment')) {
        console.log('TRACKING:', msg.text())
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

    // Test switching between experiments
    await popup.waitForSelector('text=Experiment 100', { timeout: 10000 })
    
    // Go to first experiment
    await popup.click('text=Experiment 100')
    await popup.waitForTimeout(2000)
    
    // Verify experiment 100 data is loaded
    const exp100Var = await popup.locator('input[value="exp100_value"]').isVisible()
    expect(exp100Var).toBe(true, 'Experiment 100 variables should be visible')
    
    // Go back and switch to second experiment
    await popup.click('text=Back to experiments')
    await popup.waitForTimeout(1000)
    await popup.click('text=Experiment 200')
    await popup.waitForTimeout(2000)
    
    // Verify experiment 200 data is loaded and 100's data is gone
    const exp200Var = await popup.locator('input[value="exp200_value"]').isVisible()
    expect(exp200Var).toBe(true, 'Experiment 200 variables should be visible')
    
    const exp100VarGone = await popup.locator('input[value="exp100_value"]').isVisible()
    expect(exp100VarGone).toBe(false, 'Experiment 100 variables should be cleared when switching')
    
    // Verify the experiment ID tracking worked correctly
    const hasNewExperimentLogs = consoleMessages.some(msg => 
      msg.includes('Processing variant data for experiment 100') && msg.includes('isNewExperiment: true')
    )
    expect(hasNewExperimentLogs).toBe(true, 'Should detect new experiment correctly')
    
    const hasExperiment200Logs = consoleMessages.some(msg => 
      msg.includes('Processing variant data for experiment 200') && msg.includes('isNewExperiment: true')
    )
    expect(hasExperiment200Logs).toBe(true, 'Should detect second new experiment correctly')
  })

  test('Single source of truth rendering using variantData', async () => {
    const popup = await context.newPage()
    
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 3,
            name: 'rendering_test',
            display_name: 'Rendering Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  render_var: 'render_value',
                  dom_changes: [
                    { selector: '.test', type: 'text', value: 'test content' }
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
      } else if (url.includes('/experiments/3')) {
        const mockExperiment = {
          id: 3,
          name: 'rendering_test',
          display_name: 'Rendering Test',
          state: 'ready',
          variants: [
            {
              variant: 0,
              name: 'Control',
              config: JSON.stringify({
                render_var: 'render_value',
                dom_changes: [
                  { selector: '.test', type: 'text', value: 'test content' }
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
        route.continue()
      }
    })
    
    const consoleMessages: string[] = []
    popup.on('console', msg => {
      consoleMessages.push(msg.text())
      if (msg.text().includes('Rendering variant:')) {
        console.log('RENDER:', msg.text())
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

    await popup.waitForSelector('text=Rendering Test', { timeout: 10000 })
    await popup.click('text=Rendering Test')
    await popup.waitForTimeout(2000)

    // Verify that rendering is based on variantData (single source of truth)
    const renderVar = await popup.locator('input[value="render_value"]').isVisible()
    expect(renderVar).toBe(true, 'Variable should be rendered from variantData')

    const domChangesSection = await popup.locator('text=DOM Changes for Control').isVisible()
    expect(domChangesSection).toBe(true, 'DOM changes should be rendered from variantData')

    // Check console logs to verify variantData is being used for rendering
    const hasRenderingLogs = consoleMessages.some(msg => 
      msg.includes('Rendering variant:') && 
      msg.includes('hasData: true') && 
      msg.includes('variablesCount: 1') &&
      msg.includes('domChangesCount: 1')
    )
    expect(hasRenderingLogs).toBe(true, 'Should log rendering details from variantData')

    // Enter edit mode to verify state consistency
    await popup.click('button:has-text("Edit Variables")')
    await popup.waitForTimeout(500)

    // Edit the variable
    const varInput = popup.locator('input[value="render_value"]')
    await varInput.click()
    await varInput.clear()
    await varInput.fill('edited_render_value')

    // Exit edit mode without saving
    await popup.click('button:has-text("Cancel")')
    await popup.waitForTimeout(500)

    // Variable should revert to original value (proving single source of truth)
    const originalValueBack = await popup.locator('input[value="render_value"]').isVisible()
    expect(originalValueBack).toBe(true, 'Should revert to original value from variantData after cancel')

    const editedValueGone = await popup.locator('input[value="edited_render_value"]').isVisible()
    expect(editedValueGone).toBe(false, 'Edited value should be discarded after cancel')
  })

  test('Variable and DOM change operations work correctly', async () => {
    const popup = await context.newPage()
    
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 4,
            name: 'operations_test',
            display_name: 'Operations Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  existing_var: 'existing_value',
                  dom_changes: [
                    { selector: '.existing', type: 'text', value: 'existing content', enabled: true }
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
      } else if (url.includes('/experiments/4')) {
        const mockExperiment = {
          id: 4,
          name: 'operations_test',
          display_name: 'Operations Test',
          state: 'ready',
          variants: [
            {
              variant: 0,
              name: 'Control',
              config: JSON.stringify({
                existing_var: 'existing_value',
                dom_changes: [
                  { selector: '.existing', type: 'text', value: 'existing content', enabled: true }
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

    await popup.waitForSelector('text=Operations Test', { timeout: 10000 })
    await popup.click('text=Operations Test')
    await popup.waitForTimeout(2000)

    // Enter edit mode
    await popup.click('button:has-text("Edit Variables")')
    await popup.waitForTimeout(500)

    // Test variable operations
    // 1. Edit existing variable
    const existingVarInput = popup.locator('input[value="existing_value"]')
    await existingVarInput.click()
    await existingVarInput.clear()
    await existingVarInput.fill('modified_value')

    // 2. Add new variable
    await popup.click('button:has-text("Add Variable")')
    popup.on('dialog', async dialog => {
      await dialog.accept('new_test_var')
    })
    await popup.waitForTimeout(500)

    const newVarInput = popup.locator('input[value=""]').last()
    await newVarInput.fill('new_test_value')

    // 3. Delete a variable (we'll add another first to test deletion)
    await popup.click('button:has-text("Add Variable")')
    popup.on('dialog', async dialog => {
      await dialog.accept('delete_me_var')
    })
    await popup.waitForTimeout(500)

    const deleteVarInput = popup.locator('input[value=""]').last()
    await deleteVarInput.fill('delete_me_value')

    // Find and click delete button for the variable we want to delete
    const deleteButton = popup.locator('button').filter({ hasText: '×' }).last()
    await deleteButton.click()
    await popup.waitForTimeout(500)

    // Verify operations worked
    const modifiedVar = await popup.locator('input[value="modified_value"]').isVisible()
    expect(modifiedVar).toBe(true, 'Existing variable should be modified')

    const newVar = await popup.locator('input[value="new_test_value"]').isVisible()
    expect(newVar).toBe(true, 'New variable should be added')

    const deletedVarGone = await popup.locator('input[value="delete_me_value"]').isVisible()
    expect(deletedVarGone).toBe(false, 'Deleted variable should be removed')

    // Test DOM changes operations
    const domChangesExpanded = await popup.locator('text=DOM Changes for Control').isVisible()
    expect(domChangesExpanded).toBe(true, 'DOM changes section should be visible')

    // Verify existing DOM change is there
    const existingDomChange = await popup.locator('text=.existing').isVisible()
    expect(existingDomChange).toBe(true, 'Existing DOM change should be visible')

    // Save changes to verify everything persists
    await popup.click('button:has-text("Save Changes")')
    await popup.waitForTimeout(2000)

    // Verify we're back in view mode
    const editButton = await popup.locator('button:has-text("Edit Variables")').isVisible()
    expect(editButton).toBe(true, 'Should be back in view mode after save')

    // Verify all changes persisted
    const persistedModifiedVar = await popup.locator('input[value="modified_value"]').isVisible()
    expect(persistedModifiedVar).toBe(true, 'Modified variable should persist after save')

    const persistedNewVar = await popup.locator('input[value="new_test_value"]').isVisible()
    expect(persistedNewVar).toBe(true, 'New variable should persist after save')

    await popup.screenshot({ path: 'tests/screenshots/operations-test-result.png' })
  })
})