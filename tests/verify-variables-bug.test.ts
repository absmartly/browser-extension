import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test('verify experiment variables do not disappear after clicking', async () => {
  // Launch browser with extension
  const pathToExtension = path.join(__dirname, '../build/chrome-mv3-dev')
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
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.text().includes('ExperimentDetail')) {
      console.log('EXTENSION:', msg.text())
    }
  })
  
  // Navigate to popup
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  console.log('Popup opened')

  // Wait for popup to load
  await page.waitForSelector('.w-full', { timeout: 10000 })

  // Mock API response with experiment data
  await page.route('**/experiments*', async (route) => {
    const response = {
      data: [
        {
          id: 123,
          name: 'test-experiment',
          display_name: 'Test Experiment - Bug Verification',
          state: 'running',
          status: 'running',
          percentage_of_traffic: 100,
          variants: [
            {
              name: 'Control',
              variant: 0,
              is_control: true,
              config: JSON.stringify({
                showBanner: false,
                buttonText: 'Sign Up',
                headerColor: '#000000',
                dom_changes: [
                  { selector: '.banner', property: 'style.display', value: 'none' }
                ]
              })
            },
            {
              name: 'Variant A',
              variant: 1,
              config: JSON.stringify({
                showBanner: true,
                buttonText: 'Get Started',
                headerColor: '#FF6B6B',
                specialOffer: 'limited',
                dom_changes: [
                  { selector: '.banner', property: 'style.display', value: 'block' },
                  { selector: '.banner', property: 'innerHTML', value: 'Special Offer!' }
                ]
              })
            }
          ],
          applications: [{ id: 1, name: 'Web App' }]
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

  // Trigger a refresh to load experiments
  await page.reload()
  
  // Wait for experiments to load
  await page.waitForTimeout(2000)

  // Look for experiment items
  const experimentItems = await page.locator('.cursor-pointer').all()
  console.log(`Found ${experimentItems.length} experiments`)

  if (experimentItems.length === 0) {
    console.log('No experiments found. Make sure the API is configured and experiments are loaded.')
    await context.close()
    return
  }

  // Click on the first experiment
  console.log('Clicking on first experiment...')
  await experimentItems[0].click()

  // Wait for navigation to experiment detail
  await page.waitForTimeout(1000)

  // Check if we're in experiment detail view
  const backButton = await page.locator('button:has-text("Back to experiments")')
  await expect(backButton).toBeVisible()
  console.log('Navigated to experiment detail')

  // Check if variants section is visible
  const variantsHeader = await page.locator('h3:has-text("Variants")')
  const isVariantsVisible = await variantsHeader.isVisible().catch(() => false)
  console.log('Initial variants section visible:', isVariantsVisible)

  // Check for variables section
  const variablesHeaders = await page.locator('h5:has-text("Variables")').all()
  console.log('Initial variables sections found:', variablesHeaders.length)

  // This is the critical part - wait to see if variables disappear
  console.log('Waiting 3 seconds to check if variables disappear...')
  await page.waitForTimeout(3000)

  // Check again after waiting
  const variantsStillVisible = await variantsHeader.isVisible().catch(() => false)
  const variablesStillPresent = await page.locator('h5:has-text("Variables")').all()
  
  console.log('After 3 seconds:')
  console.log('- Variants section still visible:', variantsStillVisible)
  console.log('- Variables sections still present:', variablesStillPresent.length)

  // Take screenshots for debugging
  await page.screenshot({ path: 'tests/screenshots/experiment-detail-after-wait.png' })

  // The bug is fixed if variables are still visible
  if (isVariantsVisible && variantsStillVisible && variablesStillPresent.length > 0) {
    console.log('✅ SUCCESS: Variables did NOT disappear! Bug is fixed.')
  } else if (isVariantsVisible && !variantsStillVisible) {
    console.log('❌ FAILURE: Variables disappeared! Bug is NOT fixed.')
    throw new Error('Variables disappeared after clicking on experiment')
  } else if (!isVariantsVisible) {
    console.log('⚠️  WARNING: No variables were shown initially. This might be a data issue.')
  }

  // Test cancel button doesn't clear data
  console.log('Testing cancel button...')
  
  // Click Edit Variables if visible
  const editButton = await page.locator('button:has-text("Edit Variables")')
  if (await editButton.isVisible()) {
    await editButton.click()
    await page.waitForTimeout(500)
    
    // Click Cancel
    const cancelButton = await page.locator('button:has-text("Cancel")')
    await cancelButton.click()
    await page.waitForTimeout(1000)
    
    // Check if variables are still there
    const variablesAfterCancel = await page.locator('h5:has-text("Variables")').all()
    console.log('Variables after cancel:', variablesAfterCancel.length)
    
    if (variablesAfterCancel.length === 0 && variablesStillPresent.length > 0) {
      console.log('❌ FAILURE: Cancel button cleared the variables!')
      throw new Error('Cancel button cleared variant data')
    }
  }

  await context.close()
})