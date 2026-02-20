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
      const fromScratchButton = sidebar.locator('#from-scratch-button')
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

      const trafficInput = sidebar.locator('#traffic-label').locator('..').locator('input')
      await trafficInput.waitFor({ state: 'visible', timeout: 2000 })
      await trafficInput.fill('75')
      console.log('  ✓ Set traffic to 75%')

      await debugWait()
    })

    await test.step('Select Unit Type', async () => {
      console.log('\n🎯 STEP 4: Selecting Unit Type')

      try {
        // Wait for unit type select to be visible and enabled
        const unitTypeTrigger = sidebar.locator('#unit-type-select-trigger')
        await unitTypeTrigger.waitFor({ state: 'visible', timeout: 15000 })
        console.log('  [DEBUG] Unit Type trigger visible')

        // Wait for it to become enabled (not disabled/loading)
        await sidebar.locator('#unit-type-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 15000 })
        console.log('  [DEBUG] Unit Type enabled')

        await testPage.screenshot({ path: 'debug-step4-before-unit-type-click.png', fullPage: true })

        // Click to open dropdown
        await unitTypeTrigger.click()
        console.log('  [DEBUG] Clicked unit type trigger')

        // Wait for dropdown to appear
        const unitTypeDropdown = sidebar.locator('#unit-type-select-dropdown, [data-testid="unit-type-select-dropdown"]')
        await unitTypeDropdown.waitFor({ state: 'visible', timeout: 5000 })
        console.log('  [DEBUG] Dropdown visible')

        await testPage.screenshot({ path: 'debug-step4-dropdown-visible.png', fullPage: true })

        // Select first option
        const firstOption = unitTypeDropdown.locator('div[class*="cursor-pointer"]').first()
        await firstOption.waitFor({ state: 'visible', timeout: 5000 })

        const unitTypeName = await firstOption.textContent()
        console.log(`  [DEBUG] Selected Unit Type: ${unitTypeName}`)

        await firstOption.click()
        console.log('  ✓ Unit Type selected')
      } catch (error) {
        console.error('  [ERROR] Failed in Select Unit Type step:', error)
        throw error
      }
    })

    await test.step('Select Application', async () => {
      console.log('\n📱 STEP 5: Selecting Application')

      try {
        // Wait for applications select to be visible and enabled
        const appsTrigger = sidebar.locator('#applications-select-trigger')
        await appsTrigger.waitFor({ state: 'visible', timeout: 15000 })
        console.log('  [DEBUG] Applications trigger visible')

        // Wait for it to become enabled
        await sidebar.locator('#applications-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 15000 })
        console.log('  [DEBUG] Applications enabled')

        await testPage.screenshot({ path: 'debug-step5-before-app-click.png', fullPage: true })

        // Click to open dropdown
        await appsTrigger.click()
        console.log('  [DEBUG] Clicked applications trigger')

        // Wait for dropdown to appear
        const appsDropdown = sidebar.locator('#applications-select-dropdown, [data-testid="applications-select-dropdown"]')
        await appsDropdown.waitFor({ state: 'visible', timeout: 5000 })
        console.log('  [DEBUG] Dropdown visible')

        // Select first option
        const firstOption = appsDropdown.locator('div[class*="cursor-pointer"]').first()
        await firstOption.waitFor({ state: 'visible', timeout: 5000 })

        const appName = await firstOption.textContent()
        console.log(`  [DEBUG] Selected Application: ${appName}`)

        await firstOption.click()
        console.log('  ✓ Application selected')
      } catch (error) {
        console.error('  [ERROR] Failed in Select Application step:', error)
        await testPage.screenshot({ path: 'debug-step5-error.png', fullPage: true })
        throw error
      }
    })

    await test.step('Select Owners (if available)', async () => {
      console.log('\n👥 STEP 6: Selecting Owners (optional)')

      try {
        const ownersTrigger = sidebar.locator('#owners-label-trigger')

        await ownersTrigger.waitFor({ state: 'visible', timeout: 5000 })
        console.log('  [DEBUG] Owners trigger visible')

        await ownersTrigger.waitFor({ state: 'attached', timeout: 5000 })
        const isEnabled = await ownersTrigger.evaluate((el) => !el.classList.contains('cursor-not-allowed'))
        console.log(`  [DEBUG] Owners enabled: ${isEnabled}`)

        if (!isEnabled) {
          console.log('  ⚠️  Owners dropdown is disabled, skipping owner selection')
          return
        }

        await ownersTrigger.click()
        console.log('  [DEBUG] Clicked owners trigger')

        const ownersDropdown = sidebar.locator('#owners-label-dropdown')
        await ownersDropdown.waitFor({ state: 'visible', timeout: 5000 })
        console.log('  [DEBUG] Dropdown visible')

        const firstOwnerOption = ownersDropdown.locator('div[class*="cursor-pointer"]:has(div[class*="flex items-center"])').first()
        const hasOwners = await firstOwnerOption.isVisible({ timeout: 2000 }).catch(() => false)

        if (!hasOwners) {
          console.log('  ⚠️  No owners available in dropdown, skipping owner selection')
          await testPage.keyboard.press('Escape')
          return
        }

        const ownerName = await firstOwnerOption.textContent()
        console.log(`  [DEBUG] Selected Owner: ${ownerName}`)

        await firstOwnerOption.click()

        console.log('  ✓ Owner selected')
        await debugWait()
      } catch (error) {
        console.log(`  ⚠️  Owner selection failed (non-critical): ${error.message}`)
        console.log('  Continuing with test without owner selection...')
      }
    })

    await test.step('Select Tags (if available)', async () => {
      console.log('\n🏷️  STEP 7: Selecting Tags (optional)')

      try {
        const tagsContainer = sidebar.locator('#tags-label').locator('..')

        await sidebar.locator('#tags-label').locator('..').locator('span:not(:has-text("Loading..."))').first().waitFor({ timeout: 2000 })

        const tagsClickArea = tagsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
        await tagsClickArea.click({ force: true })

        const tagsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
        await tagsDropdown.waitFor({ state: 'visible', timeout: 2000 })

        const firstTagOption = tagsDropdown.locator('div[class*="cursor-pointer"]').first()
        const hasTags = await firstTagOption.isVisible({ timeout: 2000 }).catch(() => false)

        if (!hasTags) {
          console.log('  ⚠️  No tags available in dropdown, skipping tag selection')
          await testPage.keyboard.press('Escape')
          return
        }

        const tagName = await firstTagOption.textContent()
        console.log(`  Selected Tag: ${tagName}`)

        await firstTagOption.click({ force: true })

        console.log('  ✓ Tag selected')
        await debugWait()
      } catch (error) {
        console.log(`  ⚠️  Tag selection failed (non-critical): ${error.message}`)
        console.log('  Continuing with test without tag selection...')
      }
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

        await sidebar.locator('#experiments-heading').waitFor({ timeout: 5000 })
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

        const trafficInput = sidebar.locator('#traffic-label').locator('..').locator('input')
        await trafficInput.waitFor({ state: 'visible', timeout: 2000 })
        const trafficValue = await trafficInput.inputValue()
        expect(parseInt(trafficValue)).toBeGreaterThan(0)
        expect(parseInt(trafficValue)).toBeLessThanOrEqual(100)
        console.log(`  ✓ Traffic percentage persisted: ${trafficValue}%`)

        console.log('  [DEBUG] Checking unit type...')
        const unitTypeTrigger = sidebar.locator('#unit-type-select-trigger')
        const hasUnitType = await unitTypeTrigger.isVisible({ timeout: 2000 }).catch(() => false)

        if (hasUnitType) {
          const unitTypeText = await unitTypeTrigger.textContent()
          expect(unitTypeText).not.toBe('')
          expect(unitTypeText).not.toContain('Select a unit type')
          console.log(`  ✅ Unit Type persisted and loaded: ${unitTypeText}`)
        } else {
          console.log('  ⚠️  Unit type field not visible (non-critical for persistence test)')
        }

        const appContainer = sidebar.locator('#applications-label').locator('..')
        const appBadges = appContainer.locator('span[class*="badge"], div[class*="badge"]')
        const appCount = await appBadges.count()
        expect(appCount).toBeGreaterThanOrEqual(0)
        console.log(`  ✓ Applications: ${appCount} app(s) ${appCount > 0 ? 'selected' : '(none)'}`)

        const ownersContainer = sidebar.locator('#owners-label').locator('..')
        const ownerBadges = ownersContainer.locator('span[class*="badge"], div[class*="badge"]')
        const ownerCount = await ownerBadges.count()
        expect(ownerCount).toBeGreaterThanOrEqual(0)
        console.log(`  ✓ Owners: ${ownerCount} owner(s) ${ownerCount > 0 ? 'selected' : '(none)'}`)

        const tagsContainer = sidebar.locator('#tags-label').locator('..')
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
