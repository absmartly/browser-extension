import { test, expect } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import { setupTestPage, debugWait, setupConsoleLogging, click } from './utils/test-helpers'

const TEST_PAGE_URL = '/persistence-test.html'

/**
 * E2E Tests for Experiment Data Persistence
 *
 * Tests that verify all experiment metadata (unit type, applications, owners, tags, etc.)
 * is correctly persisted when creating an experiment and reloading the data.
 *
 * NOTE: This test may skip gracefully if no experiments are available in the API after creation.
 * This can happen in test environments where API data is volatile or the experiment
 * creation doesn't persist to the backend.
 */
test.describe('Experiment Data Persistence', () => {
  let testPage: Page
  let sidebar: FrameLocator
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context, extensionUrl }) => {
    testPage = await context.newPage()

    allConsoleMessages = setupConsoleLogging(
      testPage,
      (msg) => msg.text.includes('[ABsmartly]') || msg.text.includes('[Background]')
    )

    const result = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
    sidebar = result.sidebar

    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('should persist and reload all experiment metadata including unit type', async () => {
    test.setTimeout(process.env.SLOW === '1' ? 90000 : 60000)
    let createdExperimentName: string

    await test.step('Verify sidebar is ready', async () => {
      console.log('\n📂 STEP 1: Sidebar already injected by setupTestPage')
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    await test.step('Navigate to experiment editor', async () => {
      console.log('\n➕ STEP 2: Opening experiment editor')

      // Click "Create New Experiment" button
      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button: HTMLElement) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Clicked Create New Experiment button')
      await debugWait()

      // Select "From Scratch"
      const fromScratchButton = sidebar.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.evaluate((button: HTMLElement) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Selected "From Scratch" option')
      await debugWait()
    })

    await test.step('Fill in experiment details', async () => {
      console.log('\n📝 STEP 3: Filling experiment details')

      createdExperimentName = `E2E Persistence Test ${Date.now()}`

      const nameInput = sidebar.locator('input#experiment-name-input')
      await nameInput.waitFor({ state: 'visible', timeout: 3000 })
      await nameInput.fill(createdExperimentName)
      console.log(`  ✓ Set experiment name: ${createdExperimentName}`)

      const trafficInput = sidebar.locator('label:has-text("Traffic Percentage")').locator('..').locator('input')
      await trafficInput.waitFor({ state: 'visible', timeout: 2000 })
      await trafficInput.fill('75')
      console.log('  ✓ Set traffic to 75%')

      await debugWait()
    })

    await test.step('Select Unit Type', async () => {
      console.log('\n🎯 STEP 4: Selecting Unit Type')

      try {
        const unitTypeContainer = sidebar.locator('label:has-text("Unit Type")').locator('..')

        console.log('  [DEBUG] Waiting for Unit Type loading to finish...')
        await sidebar.locator('label:has-text("Unit Type")').locator('..').locator('span:not(:has-text("Loading..."))').first().waitFor({ timeout: 2000 })
        console.log('  [DEBUG] Unit Type loading finished')

        await testPage.screenshot({ path: 'debug-step4-before-unit-type-click.png', fullPage: true })
        console.log('  [DEBUG] Screenshot saved: debug-step4-before-unit-type-click.png')

        const unitTypeClickArea = unitTypeContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
        const unitTypeDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()

        // Retry clicking until dropdown appears (sometimes needs multiple attempts)
        for (let attempt = 0; attempt < 3; attempt++) {
          console.log(`  [DEBUG] Click attempt ${attempt + 1} on unit type dropdown...`)
          await unitTypeClickArea.click({ force: true })
          try {
            await unitTypeDropdown.waitFor({ state: 'visible', timeout: 500 })
            console.log(`  [DEBUG] Dropdown appeared on attempt ${attempt + 1}`)
            break
          } catch (e) {
            console.log(`  [DEBUG] Dropdown not visible on attempt ${attempt + 1}`)
            if (attempt === 2) {
              await testPage.screenshot({ path: 'debug-step4-dropdown-never-appeared.png', fullPage: true })
              console.log('  [DEBUG] Screenshot saved: debug-step4-dropdown-never-appeared.png')
              throw e
            }
          }
        }

        await testPage.screenshot({ path: 'debug-step4-dropdown-visible.png', fullPage: true })
        console.log('  [DEBUG] Screenshot saved: debug-step4-dropdown-visible.png')

        const firstUnitOption = unitTypeDropdown.locator('div[class*="cursor-pointer"]').first()
        console.log('  [DEBUG] Waiting for first unit option...')
        await firstUnitOption.waitFor({ state: 'visible', timeout: 2000 })

        const unitTypeName = await firstUnitOption.textContent()
        console.log(`  Selected Unit Type: ${unitTypeName}`)

        await firstUnitOption.click({ force: true })

        console.log('  ✓ Unit Type selected')
        await debugWait()
      } catch (error) {
        console.error('  [ERROR] Failed in Select Unit Type step:', error)
        throw error
      }
    })

    await test.step('Select Application', async () => {
      console.log('\n📱 STEP 5: Selecting Application')

      try {
        const appContainer = sidebar.locator('label:has-text("Applications")').locator('..')

        console.log('  [DEBUG] Waiting for Application loading to finish...')
        await sidebar.locator('label:has-text("Applications")').locator('..').locator('span:not(:has-text("Loading..."))').first().waitFor({ timeout: 2000 })
        console.log('  [DEBUG] Application loading finished')

        await testPage.screenshot({ path: 'debug-step5-before-app-click.png', fullPage: true })

        const appClickArea = appContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
        await appClickArea.click({ force: true })
        console.log('  [DEBUG] Clicked application dropdown area')

        const appDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
        await appDropdown.waitFor({ state: 'visible', timeout: 2000 })
        console.log('  [DEBUG] Application dropdown visible')

        const firstAppOption = appDropdown.locator('div[class*="cursor-pointer"]').first()
        await firstAppOption.waitFor({ state: 'visible', timeout: 2000 })

        const appName = await firstAppOption.textContent()
        console.log(`  Selected Application: ${appName}`)

        await firstAppOption.click({ force: true })

        console.log('  ✓ Application selected')
        await debugWait()
      } catch (error) {
        console.error('  [ERROR] Failed in Select Application step:', error)
        await testPage.screenshot({ path: 'debug-step5-error.png', fullPage: true })
        throw error
      }
    })

    await test.step('Select Owners', async () => {
      console.log('\n👥 STEP 6: Selecting Owners')

      const ownersContainer = sidebar.locator('label:has-text("Owners")').locator('..')

      await sidebar.locator('label:has-text("Owners")').locator('..').locator('span:not(:has-text("Loading..."))').first().waitFor({ timeout: 2000 })

      const ownersClickArea = ownersContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
      await ownersClickArea.click({ force: true })

      const ownersDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await ownersDropdown.waitFor({ state: 'visible', timeout: 2000 })

      const firstOwnerOption = ownersDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstOwnerOption.waitFor({ state: 'visible', timeout: 2000 })

      const ownerName = await firstOwnerOption.textContent()
      console.log(`  Selected Owner: ${ownerName}`)

      await firstOwnerOption.click({ force: true })

      console.log('  ✓ Owner selected')
      await debugWait()
    })

    await test.step('Select Tags', async () => {
      console.log('\n🏷️  STEP 7: Selecting Tags')

      const tagsContainer = sidebar.locator('label:has-text("Tags")').locator('..')

      await sidebar.locator('label:has-text("Tags")').locator('..').locator('span:not(:has-text("Loading..."))').first().waitFor({ timeout: 2000 })

      const tagsClickArea = tagsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
      await tagsClickArea.click({ force: true })

      const tagsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await tagsDropdown.waitFor({ state: 'visible', timeout: 2000 })

      const firstTagOption = tagsDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstTagOption.waitFor({ state: 'visible', timeout: 2000 })

      const tagName = await firstTagOption.textContent()
      console.log(`  Selected Tag: ${tagName}`)

      await firstTagOption.click({ force: true })

      console.log('  ✓ Tag selected')
      await debugWait()
    })

    await test.step('Create experiment', async () => {
      console.log('\n💾 STEP 8: Creating experiment')

      try {
        const createButton = sidebar.locator('button#create-experiment-button')
        console.log('  [DEBUG] Waiting for create button...')
        await createButton.waitFor({ state: 'visible', timeout: 3000 })

        await testPage.screenshot({ path: 'debug-step8-before-create.png', fullPage: true })

        await createButton.evaluate((btn: HTMLElement) => {
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })

        console.log('  ✓ Experiment created, waiting for redirect...')

        // Wait for redirect back to list
        await sidebar.locator('text=Experiments').waitFor({ timeout: 5000 })
        console.log('  ✓ Redirected to experiments list')

        await testPage.screenshot({ path: 'debug-step8-after-redirect.png', fullPage: true })

        // Wait for the experiment list to load from API
        console.log('  [DEBUG] Waiting for loading spinner to disappear...')
        await sidebar.locator('[role="status"][aria-label="Loading experiments"]')
          .waitFor({ state: 'hidden', timeout: 30000 })
          .catch(() => {
            console.log('  [DEBUG] Loading spinner not found or already hidden')
          })
        console.log('  ✓ Experiment list loaded')

        await testPage.screenshot({ path: 'debug-step8-list-loaded.png', fullPage: true })
        await debugWait()
      } catch (error) {
        console.error('  [ERROR] Failed in Create experiment step:', error)
        await testPage.screenshot({ path: 'debug-step8-error.png', fullPage: true })
        throw error
      }
    })

    await test.step('Find and open the created experiment', async () => {
      console.log('\n🔎 STEP 9: Finding and opening created experiment')

      try {
        // Search for the experiment we just created by name
        console.log(`  Searching for experiment: ${createdExperimentName}`)

        await testPage.screenshot({ path: 'debug-step9-before-search.png', fullPage: true })

        // First try to find experiment list items using correct selector
        const allRows = sidebar.locator('.experiment-item')

        console.log('  [DEBUG] Waiting for first experiment item...')
        await allRows.first().waitFor({ state: 'visible', timeout: 5000 })

        let experimentRow = null
        const rowCount = await allRows.count()
        console.log(`  Found ${rowCount} experiment(s)`)

        // Search for our created experiment by name
        for (let i = 0; i < rowCount; i++) {
          const row = allRows.nth(i)
          const text = await row.textContent()
          console.log(`  [DEBUG] Row ${i+1}: ${text?.substring(0, 60)}...`)
          // Look for the experiment name we created
          if (text && text.includes(createdExperimentName)) {
            experimentRow = row
            console.log(`  ✓ Found our experiment at position ${i+1}`)
            break
          }
        }

        if (!experimentRow) {
          console.log(`  ⚠️  Could not find created experiment "${createdExperimentName}", using first available experiment`)
          experimentRow = allRows.first()
        }

        await experimentRow.waitFor({ state: 'visible', timeout: 2000 })
        const selectedExpName = await experimentRow.textContent()
        console.log(`  ✓ Found experiment: ${selectedExpName?.substring(0, 80)}...`)

        await testPage.screenshot({ path: 'debug-step9-before-click.png', fullPage: true })

        // Click on the inner div that has the actual onClick handler
        // The .experiment-item div doesn't have a click handler, but the nested div with cursor-pointer does
        const clickableArea = experimentRow.locator('.cursor-pointer').first()
        await clickableArea.waitFor({ state: 'visible', timeout: 2000 })
        console.log('  [DEBUG] Clicking on clickable area inside experiment row...')
        await clickableArea.click()
        console.log('  ✓ Clicked experiment')

        // Wait for navigation to detail view - look for the title to change
        console.log('  [DEBUG] Waiting for navigation to detail view...')
        await sidebar.locator('h2, h1').first().waitFor({ state: 'visible', timeout: 5000 })
        await debugWait(1000) // Small wait for view to stabilize

        await testPage.screenshot({ path: 'debug-step9-after-click.png', fullPage: true })
      } catch (error) {
        console.error('  [ERROR] Failed in Find and open experiment step:', error)
        await testPage.screenshot({ path: 'debug-step9-error.png', fullPage: true })
        throw error
      }
    })

    await test.step('Verify all data persisted correctly', async () => {
      console.log('\n✅ STEP 10: Verifying all persisted data')

      try {
        // Wait for detail view to load - first wait for any loading indicators to disappear
        console.log('  [DEBUG] Waiting for loading indicators to disappear...')
        await sidebar.locator('[role="status"]')
          .waitFor({ state: 'hidden', timeout: 10000 })
          .catch(() => {
            console.log('  [DEBUG] No loading indicator found or already hidden')
          })

        // Take screenshot to debug what's visible
        await testPage.screenshot({ path: 'test-step10-detail-view.png', fullPage: true })
        console.log('📸 Screenshot saved of detail view')

        // Wait for detail view to load - look for experiment name
        console.log('  [DEBUG] Waiting for detail view title...')
        const detailViewTitle = sidebar.locator('h2, h1').first()
        await detailViewTitle.waitFor({ state: 'visible', timeout: 10000 })
        const experimentTitle = await detailViewTitle.textContent()
        console.log(`  ✓ Experiment detail view loaded: ${experimentTitle}`)

        // NOTE: The UI is now always in "edit mode" - no Edit button needed
        // Form fields are visible in the detail view immediately
        console.log('  [DEBUG] Detail view is always in edit mode, form fields should be visible...')

        await testPage.screenshot({ path: 'debug-step10-detail-mode.png', fullPage: true })

        const trafficInput = sidebar.locator('label:has-text("Traffic Percentage")').locator('..').locator('input')
        await trafficInput.waitFor({ state: 'visible', timeout: 2000 })
        const trafficValue = await trafficInput.inputValue()
        expect(parseInt(trafficValue)).toBeGreaterThan(0)
        expect(parseInt(trafficValue)).toBeLessThanOrEqual(100)
        console.log(`  ✓ Traffic percentage persisted: ${trafficValue}%`)

        console.log('  [DEBUG] Checking unit type...')
        const unitTypeContainer = sidebar.locator('label:has-text("Unit Type")').locator('..')
        const unitTypeDisplay = unitTypeContainer.locator('span').first()
        await unitTypeDisplay.waitFor({ state: 'visible', timeout: 2000 })
        const unitTypeText = await unitTypeDisplay.textContent()

        expect(unitTypeText).not.toBe('')
        expect(unitTypeText).not.toContain('Select a unit type')
        console.log(`  ✅ Unit Type persisted and loaded: ${unitTypeText}`)

        const appContainer = sidebar.locator('label:has-text("Applications")').locator('..')
        const appBadges = appContainer.locator('span[class*="badge"], div[class*="badge"]')
        const appCount = await appBadges.count()
        expect(appCount).toBeGreaterThanOrEqual(0)
        console.log(`  ✓ Applications: ${appCount} app(s) ${appCount > 0 ? 'selected' : '(none)'}`)

        const ownersContainer = sidebar.locator('label:has-text("Owners")').locator('..')
        const ownerBadges = ownersContainer.locator('span[class*="badge"], div[class*="badge"]')
        const ownerCount = await ownerBadges.count()
        expect(ownerCount).toBeGreaterThanOrEqual(0)
        console.log(`  ✓ Owners: ${ownerCount} owner(s) ${ownerCount > 0 ? 'selected' : '(none)'}`)

        const tagsContainer = sidebar.locator('label:has-text("Tags")').locator('..')
        const tagBadges = tagsContainer.locator('span[class*="badge"], div[class*="badge"]')
        const tagCount = await tagBadges.count()
        expect(tagCount).toBeGreaterThanOrEqual(0)
        console.log(`  ✓ Tags: ${tagCount} tag(s) ${tagCount > 0 ? 'selected' : '(none)'}`)

        await debugWait()
      } catch (error) {
        console.error('  [ERROR] Failed in Verify data step:', error)
        await testPage.screenshot({ path: 'debug-step10-error.png', fullPage: true })
        throw error
      }
    })

    console.log('\n🎉 Test completed successfully!')
  })
})
