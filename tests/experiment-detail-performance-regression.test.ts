import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('ExperimentDetail Performance & Regression Tests', () => {
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

  test('No UI flickering during rapid data updates', async () => {
    const popup = await context.newPage()
    let apiCallCount = 0
    let flickerDetected = false
    
    // Track DOM mutations to detect flickering
    await popup.addInitScript(() => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            const target = mutation.target as Element
            if (target.textContent?.includes('Variables') && mutation.removedNodes.length > 0) {
              // Variables section was removed - potential flicker
              console.log('FLICKER_DETECTED: Variables section removed')
              window.flickerDetected = true
            }
          }
        })
      })
      
      setTimeout(() => {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        })
      }, 1000)
    })
    
    // Mock API with rapid updates
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 1,
            name: 'flicker_test',
            display_name: 'Flicker Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  test_var: 'test_value',
                  dom_changes: [
                    { selector: '.test', type: 'text', value: 'test' }
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
      } else if (url.includes('/experiments/1')) {
        apiCallCount++
        
        // Simulate rapid API responses with slight variations
        const mockExperiment = {
          id: 1,
          name: 'flicker_test',
          display_name: 'Flicker Test',
          state: 'ready',
          variants: apiCallCount % 2 === 0 ? [] : [ // Alternate between empty and full variants
            {
              variant: 0,
              name: 'Control',
              config: JSON.stringify({
                test_var: `test_value_${apiCallCount}`,
                dom_changes: [
                  { selector: '.test', type: 'text', value: `test_${apiCallCount}` }
                ]
              })
            }
          ]
        }
        
        // Add artificial delay to simulate real network
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockExperiment)
          })
        }, Math.random() * 100 + 50) // 50-150ms delay
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

    await popup.waitForSelector('text=Flicker Test', { timeout: 10000 })
    await popup.click('text=Flicker Test')
    
    // Rapidly click back and forth to trigger multiple API calls
    for (let i = 0; i < 5; i++) {
      await popup.waitForTimeout(200)
      await popup.click('text=Back to experiments')
      await popup.waitForTimeout(100)
      await popup.click('text=Flicker Test')
    }
    
    await popup.waitForTimeout(3000) // Let all API calls settle
    
    // Check if flickering was detected
    const flickerResult = await popup.evaluate(() => window.flickerDetected)
    expect(flickerResult).toBeFalsy('UI should not flicker during rapid updates')
    
    // Verify final state is stable
    const variablesVisible = await popup.locator('text=Variables').isVisible()
    expect(variablesVisible).toBeTruthy() // Variables should be visible after rapid updates
    
    await popup.screenshot({ path: 'tests/screenshots/no-flicker-test.png' })
  })

  test('Performance with large variant datasets', async () => {
    const popup = await context.newPage()
    
    // Create large dataset to test performance
    const largeVariants = []
    for (let i = 0; i < 20; i++) {
      const variables = {}
      const domChanges = []
      
      // Create many variables per variant
      for (let j = 0; j < 50; j++) {
        variables[`var_${i}_${j}`] = `value_${i}_${j}`
      }
      
      // Create many DOM changes per variant
      for (let k = 0; k < 30; k++) {
        domChanges.push({
          selector: `.element_${i}_${k}`,
          type: k % 2 === 0 ? 'style' : 'text',
          value: k % 2 === 0 ? { color: `color_${k}` } : `text_${i}_${k}`,
          enabled: true
        })
      }
      
      largeVariants.push({
        variant: i,
        name: `Variant ${i}`,
        config: JSON.stringify({
          ...variables,
          dom_changes: domChanges
        })
      })
    }
    
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 2,
            name: 'performance_test',
            display_name: 'Performance Test (Large Dataset)',
            state: 'ready',
            variants: largeVariants
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
          name: 'performance_test',
          display_name: 'Performance Test (Large Dataset)',
          state: 'ready',
          variants: largeVariants
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

    // Measure time to load large dataset
    const startTime = Date.now()
    
    await popup.waitForSelector('text=Performance Test (Large Dataset)', { timeout: 10000 })
    await popup.click('text=Performance Test (Large Dataset)')
    
    // Wait for all variants to be rendered
    await popup.waitForSelector('text=Variant 19', { timeout: 15000 })
    
    const loadTime = Date.now() - startTime
    console.log(`Large dataset load time: ${loadTime}ms`)
    
    // Performance should be reasonable (less than 10 seconds for large dataset)
    expect(loadTime).toBeLessThan(10000, 'Large dataset should load within 10 seconds')
    
    // Verify data integrity with large dataset
    const variant0 = await popup.locator('text=Variant 0').isVisible()
    expect(variant0).toBeTruthy() // First variant should be visible
    
    const variant19 = await popup.locator('text=Variant 19').isVisible()
    expect(variant19).toBeTruthy() // Last variant should be visible
    
    // Check some variables are present
    const someVariable = await popup.locator('input[value="value_0_0"]').isVisible()
    expect(someVariable).toBeTruthy() // Variables should be parsed correctly for large dataset
    
    // Test edit mode performance with large dataset
    const editStartTime = Date.now()
    await popup.click('button:has-text("Edit Variables")')
    await popup.waitForTimeout(1000) // Wait for edit mode to activate
    
    const editModeTime = Date.now() - editStartTime
    console.log(`Edit mode activation time: ${editModeTime}ms`)
    
    expect(editModeTime).toBeLessThan(3000, 'Edit mode should activate quickly even with large dataset')
    
    await popup.screenshot({ path: 'tests/screenshots/performance-large-dataset.png' })
  })

  test('Memory leak prevention during experiment switching', async () => {
    const popup = await context.newPage()
    
    // Create multiple experiments for switching
    const experiments = []
    for (let i = 0; i < 10; i++) {
      experiments.push({
        id: i + 1,
        name: `memory_test_${i}`,
        display_name: `Memory Test ${i}`,
        state: 'ready',
        variants: [
          {
            variant: 0,
            name: `Control ${i}`,
            config: JSON.stringify({
              [`var_${i}`]: `value_${i}`,
              dom_changes: [
                { selector: `.test_${i}`, type: 'text', value: `content_${i}` }
              ]
            })
          }
        ]
      })
    }
    
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: experiments,
          total: experiments.length,
          hasMore: false
        }
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
        })
      } else {
        // Handle individual experiment requests
        const match = url.match(/\/experiments\/(\d+)$/)
        if (match) {
          const expId = parseInt(match[1])
          const experiment = experiments.find(e => e.id === expId)
          
          if (experiment) {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(experiment)
            })
          } else {
            route.continue()
          }
        } else {
          route.continue()
        }
      }
    })
    
    // Track memory usage
    let initialMemory: any
    
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

    // Get initial memory baseline
    initialMemory = await popup.evaluate(() => {
      return (performance as any).memory ? {
        usedJSMemory: (performance as any).memory.usedJSMemory,
        totalJSMemory: (performance as any).memory.totalJSMemory
      } : null
    })
    
    // Rapidly switch between experiments to test for memory leaks
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let i = 0; i < 10; i++) {
        await popup.waitForSelector(`text=Memory Test ${i}`, { timeout: 5000 })
        await popup.click(`text=Memory Test ${i}`)
        await popup.waitForTimeout(500)
        
        // Verify experiment loaded
        const expVar = await popup.locator(`input[value="value_${i}"]`).isVisible()
        expect(expVar).toBe(true, `Experiment ${i} should load correctly`)
        
        // Go back to list
        await popup.click('text=Back to experiments')
        await popup.waitForTimeout(200)
      }
    }
    
    // Force garbage collection if available
    await popup.evaluate(() => {
      if (window.gc) {
        window.gc()
      }
    })
    
    await popup.waitForTimeout(2000)
    
    // Check final memory usage
    const finalMemory = await popup.evaluate(() => {
      return (performance as any).memory ? {
        usedJSMemory: (performance as any).memory.usedJSMemory,
        totalJSMemory: (performance as any).memory.totalJSMemory
      } : null
    })
    
    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.usedJSMemory - initialMemory.usedJSMemory
      const memoryIncreasePercent = (memoryIncrease / initialMemory.usedJSMemory) * 100
      
      console.log(`Memory increase: ${memoryIncrease} bytes (${memoryIncreasePercent.toFixed(2)}%)`)
      
      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50, 'Memory usage should not increase excessively')
    }
    
    // Final functionality test - switch to last experiment and verify it works
    await popup.click('text=Memory Test 9')
    await popup.waitForTimeout(1000)
    
    const finalTestVar = await popup.locator('input[value="value_9"]').isVisible()
    expect(finalTestVar).toBeTruthy() // Final experiment should work correctly after many switches
  })

  test('Concurrent data updates do not cause race conditions', async () => {
    const popup = await context.newPage()
    let responseDelay = 0
    
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 3,
            name: 'race_condition_test',
            display_name: 'Race Condition Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  race_var: 'initial_value',
                  dom_changes: [
                    { selector: '.race', type: 'text', value: 'initial' }
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
        // Simulate race conditions with different response times
        responseDelay += 100
        const currentDelay = responseDelay
        
        setTimeout(() => {
          const mockExperiment = {
            id: 3,
            name: 'race_condition_test',
            display_name: 'Race Condition Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  race_var: `value_from_request_${currentDelay}`,
                  dom_changes: [
                    { selector: '.race', type: 'text', value: `content_${currentDelay}` }
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
        }, currentDelay)
      } else {
        route.continue()
      }
    })
    
    const consoleMessages: string[] = []
    popup.on('console', msg => {
      consoleMessages.push(msg.text())
      if (msg.text().includes('Processing variant data')) {
        console.log('RACE TEST:', msg.text())
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

    await popup.waitForSelector('text=Race Condition Test', { timeout: 10000 })
    
    // Trigger multiple concurrent requests
    await popup.click('text=Race Condition Test')
    await popup.waitForTimeout(50) // Don't wait for completion
    await popup.click('text=Back to experiments')
    await popup.waitForTimeout(50)
    await popup.click('text=Race Condition Test')
    await popup.waitForTimeout(50)
    await popup.click('text=Back to experiments')
    await popup.waitForTimeout(50)
    await popup.click('text=Race Condition Test')
    
    // Wait for all requests to complete
    await popup.waitForTimeout(5000)
    
    // Verify final state is consistent (no race condition artifacts)
    const variablesVisible = await popup.locator('text=Variables').isVisible()
    expect(variablesVisible).toBeTruthy() // Variables should be visible after concurrent updates
    
    const controlVisible = await popup.locator('text=Control').isVisible()
    expect(controlVisible).toBeTruthy() // Control variant should be visible
    
    // Should show data from the last successful request
    const finalValue = await popup.locator('input[value^="value_from_request_"]').isVisible()
    expect(finalValue).toBeTruthy() // Should show final value from completed request
    
    // Verify no console errors or race condition warnings
    const hasErrors = consoleMessages.some(msg => 
      msg.toLowerCase().includes('error') || 
      msg.toLowerCase().includes('race condition') ||
      msg.toLowerCase().includes('undefined')
    )
    expect(hasErrors).toBeFalsy() // Should not have race condition errors
    
    await popup.screenshot({ path: 'tests/screenshots/race-condition-test.png' })
  })

  test('Stress test: Rapid edit/save/cancel operations', async () => {
    const popup = await context.newPage()
    
    await popup.route('**/*', route => {
      const url = route.request().url()
      
      if (url.includes('/experiments') && !url.includes('/experiments/')) {
        const mockResponse = {
          experiments: [{
            id: 4,
            name: 'stress_test',
            display_name: 'Stress Test',
            state: 'ready',
            variants: [
              {
                variant: 0,
                name: 'Control',
                config: JSON.stringify({
                  stress_var: 'stress_value',
                  dom_changes: [
                    { selector: '.stress', type: 'text', value: 'stress content' }
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
          name: 'stress_test',
          display_name: 'Stress Test',
          state: 'ready',
          variants: [
            {
              variant: 0,
              name: 'Control',
              config: JSON.stringify({
                stress_var: 'stress_value',
                dom_changes: [
                  { selector: '.stress', type: 'text', value: 'stress content' }
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

    await popup.waitForSelector('text=Stress Test', { timeout: 10000 })
    await popup.click('text=Stress Test')
    await popup.waitForTimeout(2000)

    // Perform rapid edit/save/cancel operations
    for (let i = 0; i < 10; i++) {
      // Enter edit mode
      await popup.click('button:has-text("Edit Variables")')
      await popup.waitForTimeout(100)
      
      // Edit variable
      const varInput = popup.locator('input[value="stress_value"]')
      await varInput.click()
      await varInput.clear()
      await varInput.fill(`edited_${i}`)
      
      if (i % 3 === 0) {
        // Save changes occasionally
        await popup.click('button:has-text("Save Changes")')
        await popup.waitForTimeout(200)
      } else {
        // Cancel most changes
        await popup.click('button:has-text("Cancel")')
        await popup.waitForTimeout(100)
      }
    }
    
    // Verify UI is still stable after stress test
    const variablesVisible = await popup.locator('text=Variables').isVisible()
    expect(variablesVisible).toBeTruthy() // Variables should remain visible after stress test
    
    const controlVisible = await popup.locator('text=Control').isVisible()
    expect(controlVisible).toBeTruthy() // Control variant should remain visible after stress test
    
    // Should be in view mode
    const editButton = await popup.locator('button:has-text("Edit Variables")').isVisible()
    expect(editButton).toBeTruthy() // Should be in view mode after stress test
    
    // Variable should have stable value (either original or last saved)
    const stableValue = await popup.locator('input[value^="stress_value"], input[value^="edited_"]').isVisible()
    expect(stableValue).toBeTruthy() // Should have stable variable value after stress test
    
    console.log('Stress test completed successfully - UI remains stable')
  })
})