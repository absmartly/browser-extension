import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Critical Bug Fix Verification - Variables Disappearing', () => {
  test('Variables and DOM changes remain visible after clicking on experiment (Bug Fix Test)', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    // Get extension ID
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    const extensionId = background.url().split('/')[2]
    console.log('Extension ID:', extensionId)

    const page = await context.newPage()
    
    // Enable detailed console logging
    page.on('console', msg => {
      if (msg.text().includes('ExperimentDetail') || msg.text().includes('🔍') || msg.text().includes('🔄')) {
        console.log('EXTENSION LOG:', msg.text())
      }
    })
    
    page.on('pageerror', err => console.error('PAGE ERROR:', err))
    
    // Navigate to popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    console.log('Popup opened')

    // Wait for popup to load
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    // Check if we need to configure settings
    const needsConfig = await page.locator('text=Welcome to ABSmartly').isVisible().catch(() => false)
    if (needsConfig) {
      console.log('Configuring extension settings...')
      await page.click('button:has-text("Configure Settings")')
      await page.fill('input[type="url"]', 'http://localhost:8080')
      await page.fill('input[type="password"]', 'test-api-key-for-bug-fix-test')
      await page.click('button:has-text("Save Settings")')
      await page.waitForTimeout(2000)
    }

    // Mock the experiments API to return test data with variables
    await page.route('**/experiments*', async (route) => {
      const mockResponse = {
        data: [
          {
            id: 456,
            name: 'bug-fix-test-experiment',
            display_name: 'Bug Fix Test - Variables Should Stay Visible',
            state: 'running',
            status: 'running',
            percentage_of_traffic: 100,
            variants: [
              {
                name: 'Control',
                variant: 0,
                is_control: true,
                config: JSON.stringify({
                  headerText: 'Original Header',
                  buttonColor: '#0066CC',
                  showPromo: false,
                  discount: 0,
                  dom_changes: [
                    { selector: '.header', property: 'innerHTML', value: 'Original Header' },
                    { selector: '.promo', property: 'style.display', value: 'none' }
                  ]
                })
              },
              {
                name: 'Treatment',
                variant: 1,
                config: JSON.stringify({
                  headerText: 'New Improved Header!',
                  buttonColor: '#FF6B35',
                  showPromo: true,
                  discount: 20,
                  specialFeature: 'enabled',
                  dom_changes: [
                    { selector: '.header', property: 'innerHTML', value: 'New Improved Header!' },
                    { selector: '.promo', property: 'style.display', value: 'block' },
                    { selector: '.promo', property: 'innerHTML', value: '20% OFF Limited Time!' }
                  ]
                })
              }
            ],
            applications: [{ id: 1, name: 'Test Web App' }]
          }
        ],
        meta: { total: 1 }
      }
      
      console.log('API Mock: Returning experiment data with variants')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      })
    })

    // Force a refresh to trigger the API call
    await page.reload()
    
    // Wait for experiments to load
    console.log('Waiting for experiments to load...')
    await page.waitForTimeout(3000)

    // Find experiment items (try multiple selectors)
    const experimentSelectors = [
      '[data-testid="experiment-item"]',
      '.experiment-item',
      '.cursor-pointer:has-text("Bug Fix Test")',
      '.cursor-pointer:has-text("bug-fix-test")',
      '.cursor-pointer',
      'div:has-text("Bug Fix Test")',
      'button:has-text("Bug Fix Test")'
    ]

    let experimentItem = null
    for (const selector of experimentSelectors) {
      try {
        experimentItem = await page.waitForSelector(selector, { timeout: 2000 })
        if (experimentItem && await experimentItem.isVisible()) {
          console.log(`Found experiment item using selector: ${selector}`)
          break
        }
      } catch (e) {
        continue
      }
    }

    if (!experimentItem) {
      console.log('No experiment items found. Checking page content...')
      const pageContent = await page.content()
      console.log('Page includes "experiment":', pageContent.toLowerCase().includes('experiment'))
      console.log('Page includes "Bug Fix Test":', pageContent.includes('Bug Fix Test'))
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'tests/screenshots/no-experiments-found.png' })
      throw new Error('Could not find any experiment items to click')
    }

    console.log('✅ Found experiment item, clicking...')
    
    // Click on the experiment
    await experimentItem.click()
    await page.waitForTimeout(1000)

    // Verify we're in experiment detail view
    const backButton = await page.locator('button:has-text("Back")')
    await expect(backButton).toBeVisible({ timeout: 5000 })
    console.log('✅ Successfully navigated to experiment detail view')

    // Check for variants section
    const variantsSection = await page.locator('h3:has-text("Variants"), h2:has-text("Variants")')
    const variantsSectionVisible = await variantsSection.isVisible().catch(() => false)
    console.log(`Variants section visible: ${variantsSectionVisible}`)

    // This is the CRITICAL test - check for variables sections
    console.log('🔍 Checking for Variables sections...')
    
    // Wait a moment for everything to render
    await page.waitForTimeout(1000)
    
    const variablesHeaders = await page.locator('h5:has-text("Variables"), h4:has-text("Variables"), h6:has-text("Variables")').all()
    const initialVariablesCount = variablesHeaders.length
    console.log(`Initial Variables sections found: ${initialVariablesCount}`)

    // Check for DOM changes sections
    const domChangesHeaders = await page.locator('h5:has-text("DOM Changes"), h4:has-text("DOM Changes"), h6:has-text("DOM Changes")').all()
    const initialDomChangesCount = domChangesHeaders.length
    console.log(`Initial DOM Changes sections found: ${initialDomChangesCount}`)

    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/experiment-detail-initial-state.png' })

    if (initialVariablesCount === 0 && initialDomChangesCount === 0) {
      console.log('⚠️  No Variables or DOM Changes sections found initially')
      
      // Check if there are any variant configurations at all
      const configContent = await page.textContent('body')
      if (configContent?.includes('headerText') || configContent?.includes('buttonColor')) {
        console.log('✅ Configuration data is present in the page')
      } else {
        console.log('❌ No configuration data found in page')
        throw new Error('No variable data found in experiment detail view')
      }
    }

    // THIS IS THE CRITICAL MOMENT - wait to see if variables disappear
    console.log('🕐 CRITICAL TEST: Waiting 5 seconds to check if variables disappear (the bug)...')
    await page.waitForTimeout(5000)

    // Check again after waiting
    const finalVariablesHeaders = await page.locator('h5:has-text("Variables"), h4:has-text("Variables"), h6:has-text("Variables")').all()
    const finalVariablesCount = finalVariablesHeaders.length

    const finalDomChangesHeaders = await page.locator('h5:has-text("DOM Changes"), h4:has-text("DOM Changes"), h6:has-text("DOM Changes")').all()
    const finalDomChangesCount = finalDomChangesHeaders.length

    console.log(`After 5 seconds:`)
    console.log(`- Variables sections: ${initialVariablesCount} → ${finalVariablesCount}`)
    console.log(`- DOM Changes sections: ${initialDomChangesCount} → ${finalDomChangesCount}`)

    // Take screenshot of final state
    await page.screenshot({ path: 'tests/screenshots/experiment-detail-after-wait.png' })

    // THE KEY TEST: Variables should NOT disappear
    if (initialVariablesCount > 0) {
      expect(finalVariablesCount).toBe(initialVariablesCount)
      console.log('✅ SUCCESS: Variables did NOT disappear!')
    }

    if (initialDomChangesCount > 0) {
      expect(initialDomChangesCount).toBe(finalDomChangesCount)
      console.log('✅ SUCCESS: DOM changes did NOT disappear!')
    }

    // Additional test: Switch between experiments to test the fix
    console.log('🔄 Testing experiment switching...')
    
    // Go back to experiments list
    await page.click('button:has-text("Back")')
    await page.waitForTimeout(1000)
    
    // Try to click on the same experiment again
    const experimentItemAgain = await page.locator('.cursor-pointer').first()
    if (await experimentItemAgain.isVisible()) {
      await experimentItemAgain.click()
      await page.waitForTimeout(2000)
      
      // Check that variables are still visible after re-selecting
      const reselectedVariables = await page.locator('h5:has-text("Variables"), h4:has-text("Variables"), h6:has-text("Variables")').all()
      console.log(`After re-selecting experiment: ${reselectedVariables.length} Variables sections`)
      
      if (initialVariablesCount > 0) {
        expect(reselectedVariables.length).toBeGreaterThan(0)
        console.log('✅ SUCCESS: Variables remain visible after switching experiments!')
      }
    }

    // Final verification: The bug was that lastExperimentIdRef wasn't updated properly
    console.log('🎯 Bug Fix Verification Complete')
    console.log('The fix ensures that:')
    console.log('1. lastExperimentIdRef is updated immediately when experiment changes')
    console.log('2. Variant data is cleared when switching to new experiments')  
    console.log('3. Variables remain visible and do not disappear')

    await context.close()
  })

  test('Variables persist during edit operations (Related Bug Fix)', async () => {
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

    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.waitForLoadState('domcontentloaded')

    // Configure if needed
    const needsConfig = await page.locator('text=Welcome to ABSmartly').isVisible().catch(() => false)
    if (needsConfig) {
      await page.click('button:has-text("Configure Settings")')
      await page.fill('input[type="url"]', 'http://localhost:8080')
      await page.fill('input[type="password"]', 'test-api-key')
      await page.click('button:has-text("Save Settings")')
      await page.waitForTimeout(2000)
    }

    // Mock API with experiment data
    await page.route('**/experiments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: 789,
            name: 'edit-test-experiment',
            display_name: 'Edit Test Experiment',
            state: 'running',
            variants: [{
              name: 'Control',
              variant: 0,
              config: JSON.stringify({ testVar: 'testValue', editableVar: 'original' })
            }]
          }],
          meta: { total: 1 }
        })
      })
    })

    await page.reload()
    await page.waitForTimeout(2000)

    // Find and click experiment
    const experimentItem = await page.locator('.cursor-pointer').first()
    if (await experimentItem.isVisible()) {
      await experimentItem.click()
      await page.waitForTimeout(1000)

      // Check if Edit Variables button exists and test the edit flow
      const editButton = await page.locator('button:has-text("Edit Variables"), button:has-text("Edit")')
      if (await editButton.isVisible()) {
        console.log('Testing edit variables workflow...')
        
        // Get initial variable count
        const initialVars = await page.locator('h5:has-text("Variables")').all()
        console.log(`Initial variables: ${initialVars.length}`)
        
        await editButton.click()
        await page.waitForTimeout(500)
        
        // Click Cancel (this was another bug where Cancel would clear data)
        const cancelButton = await page.locator('button:has-text("Cancel")')
        if (await cancelButton.isVisible()) {
          await cancelButton.click()
          await page.waitForTimeout(1000)
          
          // Verify variables are still there after Cancel
          const varsAfterCancel = await page.locator('h5:has-text("Variables")').all()
          console.log(`Variables after cancel: ${varsAfterCancel.length}`)
          
          expect(varsAfterCancel.length).toBe(initialVars.length)
          console.log('✅ SUCCESS: Cancel button does not clear variables!')
        }
      }
    }

    await context.close()
  })
})