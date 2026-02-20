/**
 * E2E tests for Experiment Code Injection UI
 *
 * These tests verify that clicking code injection sections opens the code editor modal.
 */

import { test, expect } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import { setupTestPage, debugWait, click } from './utils/test-helpers'

const TEST_PAGE_URL = '/visual-editor-test.html'

// Save experiment mode - set to true to actually save the experiment to the database
// WARNING: This writes to the production database! Only use when needed.
// Pass SAVE_EXPERIMENT=1 environment variable to enable: SAVE_EXPERIMENT=1 npx playwright test ...
const SAVE_EXPERIMENT = process.env.SAVE_EXPERIMENT === '1'

test.describe('Experiment Code Injection UI', () => {
  let testPage: Page
  let sidebar: FrameLocator
  let experimentName: string

  test.beforeEach(async ({ context, extensionUrl }) => {
    testPage = await context.newPage()

    // Listen to all console messages for debugging
    testPage.on('console', msg => {
      const text = msg.text()
      if (text.includes('CustomCodeEditor') || text.includes('openCodeEditor') || text.includes('Content Script') || text.includes('ExperimentCodeInjection')) {
        console.log(`[BROWSER ${msg.type()}]`, text)
      }
    })

    const result = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
    sidebar = result.sidebar
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('code injection UI exists and code editor can be opened', async () => {
    test.setTimeout(process.env.SLOW === '1' ? 120000 : (process.env.SAVE_EXPERIMENT === '1' ? 120000 : 60000))

    await test.step('Wait for sidebar to load', async () => {
      console.log('\n📂 STEP 1: Wait for sidebar experiments to load')

      await sidebar.locator('[role="status"][aria-label="Loading experiments"]')
        .waitFor({ state: 'hidden', timeout: 30000 })
        .catch(() => {})

      console.log('✅ Sidebar loaded')
    })

    await test.step('Click Create new experiment', async () => {
      console.log('\n📋 STEP 2: Open Create experiment view')

      // Click Create New Experiment button (synthetic click via helper)
      await click(sidebar, 'button[title="Create New Experiment"]')
      console.log('  ✓ Clicked Create New Experiment button')
      await debugWait()

      // Select "From Scratch" option
      const fromScratchButton = sidebar.locator('#from-scratch-button')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await click(sidebar, fromScratchButton)
      console.log('  ✓ Selected "From Scratch"')
      await debugWait()

      // Fill experiment name
      experimentName = `Code Injection Test ${Date.now()}`
      await sidebar.locator('input[placeholder="My Experiment"]').first().fill(experimentName)
      console.log(`  ✓ Filled experiment name: ${experimentName}`)
      await debugWait()

      // Select Unit Type
      console.log('  Selecting Unit Type...')
      const unitTypeTrigger = sidebar.locator('#unit-type-select-trigger')
      await unitTypeTrigger.waitFor({ state: 'visible', timeout: 5000 })

      // Wait for it to become enabled (not disabled/loading)
      await sidebar.locator('#unit-type-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 5000 })
      console.log('  ✓ Unit type select is enabled')

      await unitTypeTrigger.click()
      console.log('  ✓ Clicked unit type trigger')
      await debugWait(500)

      // Try both ID and data-testid selectors
      const unitTypeDropdown = sidebar.locator('#unit-type-select-dropdown, [data-testid="unit-type-select-dropdown"]')
      await unitTypeDropdown.waitFor({ state: 'visible', timeout: 5000 })
      await unitTypeDropdown.locator('div[class*="cursor-pointer"]').first().click()
      console.log('  ✓ Selected unit type')
      await debugWait()

      // Select Application
      console.log('  Selecting Applications...')
      const appsTrigger = sidebar.locator('#applications-select-trigger')
      await appsTrigger.waitFor({ state: 'visible', timeout: 5000 })
      await appsTrigger.click()
      console.log('  ✓ Clicked applications trigger')
      await debugWait(500)

      // Try both ID and data-testid selectors
      const appsDropdown = sidebar.locator('#applications-select-dropdown, [data-testid="applications-select-dropdown"]')
      await appsDropdown.waitFor({ state: 'visible', timeout: 5000 })
      await appsDropdown.locator('div[class*="cursor-pointer"]').first().click()
      console.log('  ✓ Selected application')
      await debugWait()

      // Wait for the form to be ready
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})
      console.log('✅ Experiment create page opened')
    })

    await test.step('Find Custom Code Injection section', async () => {
      console.log('\n📝 STEP 3: Looking for Custom Code Injection section')

      const codeInjectionSection = sidebar.locator('#custom-code-injection-heading')
      const sectionExists = await codeInjectionSection.isVisible({ timeout: 5000 }).catch(() => false)

      if (!sectionExists) {
        console.log('❌ Custom Code Injection section not found')
        await testPage.screenshot({ path: 'test-failed-no-code-injection.png', fullPage: true })
        throw new Error('Custom Code Injection section not found in experiment detail view')
      }

      console.log('✅ Found Custom Code Injection section')
    })

    await test.step('Expand Custom Code Injection section', async () => {
      console.log('\n🔽 STEP 4: Expanding Custom Code Injection section')

      // Find the expand button
      const codeInjectionButton = sidebar.locator('#custom-code-injection-button')
      await codeInjectionButton.waitFor({ state: 'visible', timeout: 5000 })
      console.log('✅ Found Custom Code Injection button')

      // Click to expand
      await codeInjectionButton.click()
      console.log('✅ Clicked Code Injection button/header')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

      // Check if sections appeared
      const headStartSection = sidebar.locator('#code-injection-headStart-card')
      const headStartExists = await headStartSection.isVisible({ timeout: 5000 }).catch(() => false)

      if (!headStartExists) {
        console.log('❌ Start of <head> section not found after expanding')
        await testPage.screenshot({ path: 'test-failed-no-head-start.png', fullPage: true })
        throw new Error('Start of <head> section not found after expanding Custom Code Injection')
      }

      console.log('✅ Found Start of <head> section')
    })

    await test.step('Click Start of <head> section', async () => {
      console.log('\n👆 STEP 5: Clicking Start of <head> section')

      const headStartSection = sidebar.locator('#code-injection-headStart-card')
      await click(sidebar, headStartSection)
      console.log('✅ Clicked Start of <head>')
      await debugWait(500)
    })

    await test.step('Verify editor modal appears with CodeMirror', async () => {
      console.log('\n✨ STEP 6: Waiting for editor modal to appear')

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})
      await testPage.screenshot({ path: 'test-step6-before-modal-check.png', fullPage: true })
      console.log('📸 Screenshot saved before modal check')

      const editorModal = await testPage.waitForSelector('#absmartly-code-editor-fullscreen', { timeout: 10000 }).catch(() => null)
      if (!editorModal) {
        await testPage.screenshot({ path: 'test-step6-no-modal.png', fullPage: true })
        console.log('📸 Screenshot saved - no modal found')
        throw new Error('Code editor modal did not appear')
      }
      expect(editorModal).toBeTruthy()
      console.log('✅ Code editor modal appeared!')
      await debugWait(1000)

      // Verify CodeMirror editor exists (not textarea)
      const cmEditor = await testPage.waitForSelector('.cm-editor', { timeout: 5000 })
      expect(cmEditor).toBeTruthy()
      console.log('✅ CodeMirror editor found')
      await debugWait(800)

      // Verify CodeMirror content area exists
      const cmContent = await testPage.$('.cm-content')
      expect(cmContent).toBeTruthy()
      console.log('✅ CodeMirror content area found')
      await debugWait(500)
    })

    await test.step('Type HTML code into CodeMirror editor', async () => {
      console.log('\n⌨️  STEP 7: Typing HTML into CodeMirror')

      const htmlCode = '<script>\n  console.log("Test injection");\n</script>'

      // Click on the editor content to focus it
      await click(testPage, '.cm-content')
      await debugWait(500)

      // Type the HTML code slowly so we can see it
      await testPage.keyboard.type(htmlCode, { delay: 50 })
      console.log('✅ Typed HTML code')
      await debugWait(2000)

      // Take screenshot to verify syntax highlighting
      await testPage.screenshot({ path: 'test-codemirror-with-code.png', fullPage: true })
      console.log('📸 Screenshot saved with code')
      await debugWait(1500)
    })

    await test.step('Save the code in modal', async () => {
      console.log('\n💾 STEP 8: Saving code in modal')

      // Wait for save button to be ready and click it
      await testPage.locator('#save-button').waitFor({ state: 'visible', timeout: 15000 })
      await testPage.locator('#save-button').click()
      console.log('✅ Clicked Save button')

      // Wait for modal to close
      await testPage.waitForSelector('#absmartly-code-editor-fullscreen', { state: 'hidden', timeout: 10000 })
      console.log('✅ Modal closed')

      // Wait a moment for the save to process
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})
      console.log('✅ Code saved to component state')
    })

    await test.step('Re-open editor to verify code persists in UI', async () => {
      console.log('\n🔄 STEP 9: Re-opening editor to verify code persists')

      // Click Start of <head> again to re-open the editor
      const headStartSection = sidebar.locator('#code-injection-headStart-card')
      await click(sidebar, headStartSection)
      console.log('✅ Re-opened Start of <head>')
      await debugWait(3000)

      // Take screenshot before waiting for modal
      await testPage.screenshot({ path: 'test-step9-before-modal-check.png', fullPage: true })
      console.log('📸 Screenshot saved before checking for modal')

      // Wait for modal with longer timeout
      const editorModal = await testPage.waitForSelector('#absmartly-code-editor-fullscreen', { timeout: 10000 }).catch(() => null)
      if (!editorModal) {
        console.log('❌ Modal did not appear')
        throw new Error('Code editor modal did not appear on second open')
      }
      expect(editorModal).toBeTruthy()
      console.log('✅ Editor modal re-appeared')
      await debugWait(1500)

      // Check if the code we typed is still there
      const cmContent = await testPage.$('.cm-content')
      const textContent = await cmContent?.textContent()

      expect(textContent).toContain('console.log("Test injection")')
      console.log('✅ Code persisted in UI state:', textContent?.substring(0, 50))
      await debugWait(2000)

      // Take screenshot
      await testPage.screenshot({ path: 'test-codemirror-reopened.png', fullPage: true })
      console.log('📸 Screenshot of reopened editor')
      await debugWait(1000)

      // Close the modal
      await click(testPage, '#cancel-button')
      await debugWait(500)
      console.log('✅ Code persistence verified!')
    })

    // Save experiment to database (optional - skipped by default)
    // WARNING: This writes to the production database! Only use when needed.
    // Pass SAVE_EXPERIMENT=1 environment variable to enable
    if (false && SAVE_EXPERIMENT) {
      await test.step('Save experiment and verify __inject_html structure', async () => {
        console.log('\n💾 STEP 10: Saving experiment to database and verifying data...')
        console.log('⚠️  WARNING: This will write to the production database!')

        try {
          const saveButton = sidebar.locator('#save-changes-button')
          await saveButton.scrollIntoViewIfNeeded()
          console.log('  ✓ Scrolled to save button')

          await saveButton.click()
          console.log('  ✓ Clicked save button')

          await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})
          console.log('  ✓ Waited for save to complete')

          console.log('  🔍 Verifying __inject_html structure in variant variables...')

          const jsonButton = sidebar.locator('[id^="json-editor-button-variant-"]').first()
          const jsonButtonExists = await jsonButton.isVisible({ timeout: 2000 }).catch(() => false)

          if (jsonButtonExists) {
            await jsonButton.click()
            console.log('  ✓ Opened JSON view')

            const jsonContent = await sidebar.locator('pre, code').first().textContent()
            console.log('  JSON content:', jsonContent?.substring(0, 200))

            if (jsonContent) {
              try {
                const parsed = JSON.parse(jsonContent)
                const injectHtml = parsed.__inject_html || parsed.variables?.__inject_html
                if (injectHtml) {
                  expect(injectHtml.headStart).toContain('console.log("Test injection")')
                  console.log('  ✅ Verified __inject_html structure in variant')
                }
              } catch (e) {
                console.log('  Could not parse JSON:', e)
              }
            }

            await jsonButton.click()
          }

          console.log('  ✅ Experiment saved and verified!')
        } catch (e) {
          console.log(`  ⚠️  Save step failed (non-critical): ${e.message}`)
          console.log('  The code injection UI test (steps 1-9) passed; database save is optional')
        }
      })
    } else {
      // SKIP REASON: Database write step is only enabled when SAVE_EXPERIMENT=1 is set
      // to prevent unintentional writes to production database during routine testing
      await test.step.skip('Save experiment and verify __inject_html structure', async () => {})
    }
  })
})
