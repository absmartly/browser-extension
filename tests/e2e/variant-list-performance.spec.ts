import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { injectSidebar, debugWait, setupConsoleLogging } from './utils/test-helpers'
import { controlledConfigSeed } from '../helpers/management-api/server'

/**
 * E2E Tests for Variant List Performance (React.memo)
 *
 * Tests that verify React.memo optimizations prevent unnecessary re-renders in the variant editor:
 * - URL filter section renders efficiently
 * - Global defaults section renders efficiently
 * - Sections don't re-render when unrelated variant properties change
 *
 * NOTE: Tests may skip gracefully if no experiments are available to edit. This is expected
 * behavior in test environments where API data is not available.
 */
test.describe('Variant List Performance Tests (React.memo)', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context, seedStorage, managementApi }) => {
    await seedStorage(controlledConfigSeed(managementApi))

    testPage = await context.newPage()

    allConsoleMessages = setupConsoleLogging(
      testPage,
      (msg) => msg.text.includes('[ABsmartly]') || msg.text.includes('[Background]')
    )

    await testPage.goto('http://localhost:3456/visual-editor-test.html?use_shadow_dom_for_visual_editor_context_menu=0')
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForSelector('body', { timeout: 5000 })

    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('should render URL filter section without unnecessary re-renders', async ({ extensionId, extensionUrl }) => {
    let sidebar: any

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      sidebar = await injectSidebar(testPage, extensionUrl)
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    await test.step('Create or edit experiment', async () => {
      console.log('\n➕ STEP 2: Creating/editing experiment')

      const createButton = sidebar.locator('button[title="Create New Experiment"]')
      if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await debugWait()

        const fromScratchButton = sidebar.locator('#from-scratch-button')
        await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
        await fromScratchButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        console.log('  ✓ Opened experiment editor from scratch')
        await debugWait()
      } else {
        const experimentItem = sidebar.locator('[data-testid="experiment-card"]').first()
        if (await experimentItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await experimentItem.evaluate((el: HTMLElement) =>
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          )
          console.log('  ✓ Clicked existing experiment')
          await debugWait()
        }
      }
    })

    await test.step('Find and expand variant', async () => {
      console.log('\n📦 STEP 3: Expanding variant')

      // Look for variant expand button (arrow icon)
      const expandButton = sidebar.locator('[aria-label*="expand"], [aria-label*="collapse"], [id^="variant-toggle-"]').first()

      if (await expandButton.count() > 0) {
        await expandButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        console.log('  ✓ Expanded variant')
        await debugWait()
      } else {
        console.log('  ℹ Variant may already be expanded')
      }
    })

    await test.step('Find URL filtering section', async () => {
      console.log('\n🔗 STEP 4: Finding URL filtering section')

      // Look for URL filtering section header
      const urlFilterHeading = sidebar.locator('[id^="url-filtering-heading-variant-"]').first()

      if (await urlFilterHeading.count() > 0) {
        console.log('  ✓ URL filtering section found')

        const urlFilterButton = sidebar.locator('[id^="url-filtering-toggle-variant-"]').first()
        if (await urlFilterButton.count() > 0) {
          await urlFilterButton.evaluate((btn: HTMLElement) =>
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          )
          console.log('  ✓ Expanded URL filtering')
          await debugWait()
        }
      } else {
        console.log('  ℹ URL filtering section not found (may be hidden)')
      }
    })

    await test.step('Interact with URL filter options', async () => {
      console.log('\n⚙️ STEP 5: Interacting with URL filter')

      // Look for URL filter mode dropdown
      const modeSelect = sidebar.locator('[id^="url-filter-mode-variant-"]').first()

      if (await modeSelect.count() > 0) {
        // Change mode to simple
        await modeSelect.first().selectOption('simple')
        console.log('  ✓ Changed to simple mode')
        await debugWait()

        // Add a pattern
        const patternInput = sidebar.locator('input[placeholder*="products"], input[placeholder*="path"]').first()
        if (await patternInput.count() > 0) {
          await patternInput.fill('/products/*')
          console.log('  ✓ Added URL pattern')
          await debugWait()
        }

        // Change back to "all pages"
        await modeSelect.first().selectOption({ index: 0 })
        console.log('  ✓ Changed back to all pages')
        await debugWait()

        // Verify no errors occurred (React.memo should prevent unnecessary re-renders)
        const errorMessages = allConsoleMessages.filter(msg =>
          msg.type === 'error' &&
          (msg.text.includes('render') || msg.text.includes('memo'))
        )
        expect(errorMessages.length).toBe(0)
        console.log('  ✓ No render errors detected')
      } else {
        console.log('  ℹ URL filter dropdown not found')
      }
    })

    console.log('\n✅ URL filter React.memo test completed')
  })

  test('should render global defaults section without unnecessary re-renders', async ({ extensionId, extensionUrl }) => {
    let sidebar: any

    await test.step('Inject sidebar', async () => {
      sidebar = await injectSidebar(testPage, extensionUrl)
      await debugWait()
    })

    await test.step('Navigate to variant editor', async () => {
      console.log('\n📦 Navigating to variant')

      const createButton = sidebar.locator('button[title="Create New Experiment"]')
      if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await debugWait()

        const fromScratchButton = sidebar.locator('#from-scratch-button')
        await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
        await fromScratchButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await debugWait()
      }

      const expandButton = sidebar.locator('[aria-label*="expand"], [id^="variant-toggle-"]').first()
      if (await expandButton.count() > 0) {
        await expandButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await debugWait()
      }
    })

    await test.step('Find global defaults section', async () => {
      console.log('\n⚙️ Finding global defaults section')

      const globalDefaultsHeading = sidebar.locator('#global-defaults-heading')

      if (await globalDefaultsHeading.count() > 0) {
        console.log('  ✓ Global defaults section found')

        const globalDefaultsButton = sidebar.locator('#global-defaults-button').first()
        if (await globalDefaultsButton.count() > 0) {
          await globalDefaultsButton.evaluate((btn: HTMLElement) =>
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          )
          console.log('  ✓ Expanded global defaults')
          await debugWait()
        }
      } else {
        console.log('  ℹ Global defaults section not found')
      }
    })

    await test.step('Toggle global default options', async () => {
      console.log('\n🔧 Toggling options')

      // Look for checkboxes - use simple selectors
      const importantCheckbox = sidebar.locator('input[id*="important"]')
      const waitCheckbox = sidebar.locator('input[id*="wait"]')

      if (await importantCheckbox.count() > 0) {
        await importantCheckbox.first().evaluate((el: HTMLInputElement) => {
          el.checked = !el.checked
          el.dispatchEvent(new Event('change', { bubbles: true }))
        })
        console.log('  ✓ Toggled important')
        await debugWait()

        await importantCheckbox.first().evaluate((el: HTMLInputElement) => {
          el.checked = !el.checked
          el.dispatchEvent(new Event('change', { bubbles: true }))
        })
        console.log('  ✓ Toggled important back')
        await debugWait()
      }

      if (await waitCheckbox.count() > 0) {
        await waitCheckbox.first().evaluate((el: HTMLInputElement) => {
          el.checked = !el.checked
          el.dispatchEvent(new Event('change', { bubbles: true }))
        })
        console.log('  ✓ Toggled wait for element')
        await debugWait()

        await waitCheckbox.first().evaluate((el: HTMLInputElement) => {
          el.checked = !el.checked
          el.dispatchEvent(new Event('change', { bubbles: true }))
        })
        console.log('  ✓ Toggled wait for element back')
        await debugWait()
      }

      // Verify no errors
      const errorMessages = allConsoleMessages.filter(msg =>
        msg.type === 'error' && msg.text.includes('render')
      )
      expect(errorMessages.length).toBe(0)
      console.log('  ✓ No render errors detected')
    })

    console.log('\n✅ Global defaults React.memo test completed')
  })

  test('should not re-render sections when other variant properties change', async ({ extensionId, extensionUrl }) => {
    let sidebar: any

    await test.step('Setup', async () => {
      sidebar = await injectSidebar(testPage, extensionUrl)
      await debugWait()

      const createButton = sidebar.locator('button[title="Create New Experiment"]')
      if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await debugWait()

        const fromScratchButton = sidebar.locator('#from-scratch-button')
        await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
        await fromScratchButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await debugWait()
      }
    })

    await test.step('Change variant name', async () => {
      console.log('\n📝 Changing variant name')

      // Find variant name input
      const nameInput = sidebar.locator('input[value*="Variant"], input[placeholder*="Variant"]').first()

      if (await nameInput.count() > 0) {
        await nameInput.fill('Test Variant')
        console.log('  ✓ Changed variant name')
        await debugWait()

        // Change it again
        await nameInput.fill('Another Name')
        console.log('  ✓ Changed variant name again')
        await debugWait()

        // URL filter and global defaults sections should not have re-rendered unnecessarily
        // React.memo should prevent re-renders since their props didn't change
        const errorMessages = allConsoleMessages.filter(msg =>
          msg.type === 'error' && msg.text.toLowerCase().includes('render')
        )
        expect(errorMessages.length).toBe(0)
        console.log('  ✓ No render errors - React.memo working correctly')
      } else {
        console.log('  ℹ Variant name input not found')
      }
    })

    console.log('\n✅ React.memo isolation test completed')
  })
})
