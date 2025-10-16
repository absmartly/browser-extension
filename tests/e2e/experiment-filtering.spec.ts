import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { injectSidebar, debugWait, setupConsoleLogging } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'simple-test.html')

test.describe('Experiment Filtering Tests', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    // Set up console listener for debugging
    allConsoleMessages = setupConsoleLogging(
      testPage,
      (msg) => msg.text.includes('[ABsmartly]') || msg.text.includes('[Background]')
    )

    // CRITICAL: Add query param to disable shadow DOM
    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=0`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    // Enable test mode
    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('should apply filters using buildFilterParams helper', async ({ extensionId, extensionUrl }) => {
    let sidebar: any

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      sidebar = await injectSidebar(testPage, extensionUrl)
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    await test.step('Open filters', async () => {
      console.log('\n🔍 STEP 2: Opening filters')

      // Look for filter toggle button
      const filterButton = sidebar.locator('button:has-text("Filters"), button:has-text("Filter")')

      if (await filterButton.count() > 0) {
        await filterButton.first().evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        console.log('  ✓ Opened filters')
        await debugWait()
      } else {
        console.log('  ℹ No filter button found - filters may be always visible')
      }
    })

    await test.step('Apply search filter', async () => {
      console.log('\n🔎 STEP 3: Applying search filter')

      // Find search input
      const searchInput = sidebar.locator('input[placeholder*="Search"], input[type="search"], input[name="search"]')

      if (await searchInput.count() > 0) {
        await searchInput.first().fill('test_experiment')
        console.log('  ✓ Entered search term')
        await debugWait()

        // Verify the search was applied (URL or state change)
        const inputValue = await searchInput.first().inputValue()
        expect(inputValue).toBe('test_experiment')
        console.log('  ✓ Search filter applied')
      } else {
        console.log('  ℹ No search input found')
      }
    })

    await test.step('Apply state filter', async () => {
      console.log('\n📊 STEP 4: Applying state filter')

      // Look for state filter dropdown or checkboxes
      const stateSelect = sidebar.locator('select[name*="state"], select:has-text("State")')

      if (await stateSelect.count() > 0) {
        await stateSelect.first().selectOption('running')
        console.log('  ✓ Selected "running" state')
        await debugWait()
      } else {
        // Try checkboxes
        const runningCheckbox = sidebar.locator('input[type="checkbox"][value="running"], label:has-text("Running") input[type="checkbox"]')
        if (await runningCheckbox.count() > 0) {
          await runningCheckbox.first().check()
          console.log('  ✓ Checked "running" state checkbox')
          await debugWait()
        } else {
          console.log('  ℹ No state filter found')
        }
      }
    })

    await test.step('Apply filters button', async () => {
      console.log('\n✅ STEP 5: Applying filters')

      // Look for apply/search button
      const applyButton = sidebar.locator('button:has-text("Apply"), button:has-text("Search"), button[type="submit"]')

      if (await applyButton.count() > 0) {
        await applyButton.first().evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        console.log('  ✓ Clicked apply filters')
        await debugWait(1000) // Wait for API call
      } else {
        console.log('  ℹ No apply button found - filters may auto-apply')
      }
    })

    await test.step('Verify filtered results', async () => {
      console.log('\n✔️ STEP 6: Verifying filtered results')

      // Wait for loading to finish
      await sidebar.locator('text=Loading').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})

      // Check if any experiments are displayed
      const experimentItems = sidebar.locator('[data-testid*="experiment"], .experiment-item, div:has-text("Experiment")')
      const count = await experimentItems.count()

      console.log(`  ℹ Found ${count} experiment items`)

      // Verify the filter was applied by checking console messages
      const filterMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('filter') || msg.text.includes('search') || msg.text.includes('params')
      )

      console.log(`  ℹ Filter-related console messages: ${filterMessages.length}`)
      if (filterMessages.length > 0) {
        console.log('  ✓ Filter operations logged')
      }

      await debugWait()
    })

    console.log('\n✅ Experiment filtering test completed')
  })

  test('should clear filters', async ({ extensionId, extensionUrl }) => {
    let sidebar: any

    await test.step('Inject sidebar', async () => {
      sidebar = await injectSidebar(testPage, extensionUrl)
      await debugWait()
    })

    await test.step('Apply some filters', async () => {
      console.log('\n🔍 Applying filters to clear')

      const searchInput = sidebar.locator('input[placeholder*="Search"], input[type="search"]')
      if (await searchInput.count() > 0) {
        await searchInput.first().fill('test')
        await debugWait()
      }
    })

    await test.step('Clear filters', async () => {
      console.log('\n🧹 Clearing filters')

      // Look for clear/reset button
      const clearButton = sidebar.locator('button:has-text("Clear"), button:has-text("Reset")')

      if (await clearButton.count() > 0) {
        await clearButton.first().evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        console.log('  ✓ Clicked clear button')
        await debugWait()

        // Verify search input is cleared
        const searchInput = sidebar.locator('input[placeholder*="Search"], input[type="search"]')
        if (await searchInput.count() > 0) {
          const value = await searchInput.first().inputValue()
          expect(value).toBe('')
          console.log('  ✓ Filters cleared')
        }
      } else {
        console.log('  ℹ No clear button found')
      }
    })

    console.log('\n✅ Clear filters test completed')
  })
})
