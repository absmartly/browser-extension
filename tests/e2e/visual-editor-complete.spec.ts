import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { injectSidebar, debugWait, log, initializeTestLogging, setupTestPage } from './utils/test-helpers'
import { createExperiment, activateVisualEditor, testSecondVEInstance, fillMetadataForSave, saveExperiment } from './helpers/ve-experiment-setup'
import { testAllVisualEditorActions } from './helpers/ve-actions'
import { testUndoRedoForAllActions, testUndoRedoButtonStates } from './helpers/ve-undo-redo'
import { verifyVEProtection, verifySidebarHasChanges, verifyChangesAfterVEExit, clickSaveButton } from './helpers/ve-verification'
import { testPreviewToggle } from './helpers/ve-preview'
import { testIndividualPreviewToggle, testAttributeChanges } from './helpers/ve-preview-toggle'
import { testURLFilterAndPayload } from './helpers/ve-url-filter'
import { testDiscardChanges } from './helpers/ve-discard'

const TEST_PAGE_URL = '/visual-editor-test.html'

// Save experiment mode - set to true to actually save the experiment to the database
// WARNING: This writes to the production database! Only use when needed.
// Pass SAVE_EXPERIMENT=1 environment variable to enable: SAVE_EXPERIMENT=1 npx playwright test ...
const SAVE_EXPERIMENT = process.env.SAVE_EXPERIMENT === '1'

test.describe('Visual Editor Complete Workflow', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context, extensionUrl }) => {
    initializeTestLogging()
    testPage = await context.newPage()

    const { sidebar: _, allMessages } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
    allConsoleMessages = allMessages
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('Complete workflow: sidebar → experiment → visual editor → actions → save → verify', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(process.env.SLOW === '1' ? 90000 : 15000)

    let sidebar: any
    let experimentName: string
    let stepNumber = 1

    const step = (title: string, emoji = '📋') => {
      if (process.env.DEBUG === '1' || process.env.PWDEBUG === '1') {
        log(`\n${emoji} STEP ${stepNumber++}: ${title}`)
      } else {
        stepNumber++
      }
    }

    // ========================================
    // SETUP PHASE
    // ========================================

    await test.step('Inject sidebar', async () => {
      step('Injecting sidebar', '📂')
      sidebar = await injectSidebar(testPage, extensionUrl)

      // Listen for console messages from the sidebar iframe (only in DEBUG mode)
      if (process.env.DEBUG === '1' || process.env.PWDEBUG === '1') {
        testPage.on('console', msg => {
          const msgText = msg.text()
          if (msgText.includes('[DOMChanges') || msgText.includes('[ExperimentDetail]') || msgText.includes('[ExperimentEditor]') || msgText.includes('[Test Eval]') || msgText.includes('Window message') || msgText.includes('index.tsx')) {
            log(`  [Sidebar Console] ${msgText}`)
          }
        })
      }

      await debugWait()
    })

    await test.step('Create new experiment', async () => {
      step('Creating new experiment', '📝')
      experimentName = await createExperiment(sidebar)
    })

    await test.step('Activate Visual Editor', async () => {
      step('Activating Visual Editor', '🎨')
      await activateVisualEditor(sidebar, testPage)
    })

    // ========================================
    // VISUAL EDITOR PROTECTION & ACTIONS
    // ========================================

    await test.step('Test VE protection: all buttons disabled when VE active', async () => {
      step('Testing VE protection (all buttons disabled)', '🚫')
      await verifyVEProtection(sidebar)
    })

    await test.step('Test visual editor actions', async () => {
      step('Testing all VE actions', '🎯')
      await testAllVisualEditorActions(testPage)
    })

    // ========================================
    // UNDO/REDO TESTING
    // ========================================

    await test.step('Test undo/redo functionality for all change types', async () => {
      step('Testing undo/redo for all change types', '🔄')
      await testUndoRedoForAllActions(testPage)
    })

    await test.step('Test undo/redo button disabled states', async () => {
      step('Testing undo/redo button states', '🔘')
      await testUndoRedoButtonStates(testPage)
    })

    // ========================================
    // SAVE & VERIFICATION
    // ========================================

    await test.step('Save changes to sidebar', async () => {
      step('Saving changes', '💾')
      await clickSaveButton(testPage)
      await debugWait(2000)
    })

    await test.step('Verify changes in sidebar', async () => {
      step('Verifying changes in sidebar', '📝')
      await verifySidebarHasChanges(sidebar, 4)
    })

    await test.step('Verify changes and markers after VE exit', async () => {
      step('Verifying changes and markers', '✓')
      await verifyChangesAfterVEExit(testPage)
    })

    // ========================================
    // PREVIEW MODE TESTING
    // ========================================

    await test.step('Exit preview mode via toolbar button', async () => {
      step('Exiting preview mode', '🚪')

      // Check if page is alive before attempting to exit preview
      const pageAliveBefore = await testPage.evaluate(() => true).catch(() => false)
      log(`Page alive before Exit Preview: ${pageAliveBefore}`)

      if (!pageAliveBefore) {
        await testPage.screenshot({ path: 'test-results/page-dead-before-exit-preview.png', fullPage: true })
        log('Screenshot saved: page-dead-before-exit-preview.png')
        throw new Error('Page crashed before Exit Preview button click')
      }

      // Take screenshot before clicking Exit Preview
      await testPage.screenshot({ path: 'test-results/before-exit-preview.png', fullPage: true })
      log('Screenshot saved: before-exit-preview.png')

      // Check if preview header exists in DOM
      const previewHeaderExists = await testPage.evaluate(() => {
        const header = document.getElementById('absmartly-preview-header')
        return {
          exists: header !== null,
          visible: header ? window.getComputedStyle(header).display !== 'none' : false,
          innerHTML: header ? header.innerHTML.substring(0, 200) : 'N/A'
        }
      })
      log(`Preview header status: exists=${previewHeaderExists.exists}, visible=${previewHeaderExists.visible}`)
      log(`Preview header content: ${previewHeaderExists.innerHTML}`)

      if (!previewHeaderExists.exists) {
        log('Preview header does NOT exist - VE auto-exited preview mode')

        // Check if markers are still present (they should be cleaned up)
        const markersStatus = await testPage.evaluate(() => {
          const modified = document.querySelectorAll('[data-absmartly-modified]')
          const experiment = document.querySelectorAll('[data-absmartly-experiment]')
          return {
            modifiedCount: modified.length,
            experimentCount: experiment.length,
            total: modified.length + experiment.length
          }
        })

        log(`Markers remaining: modified=${markersStatus.modifiedCount}, experiment=${markersStatus.experimentCount}`)

        if (markersStatus.total > 0) {
          log('WARNING: Preview markers still present after VE exit - this is expected if preview was active during VE')
          log('The markers will be cleaned up when we manually disable preview in the next step')
        } else {
          log('✓ All preview markers properly cleaned up')
        }

        // Take screenshot after checking
        await testPage.screenshot({ path: 'test-results/after-ve-exit-no-preview-header.png', fullPage: true })
        log('Screenshot saved: after-ve-exit-no-preview-header.png')

        // VE already exited preview, so skip manual exit
        return
      }

      // Wait for preview header to be visible before clicking
      const previewHeader = testPage.locator('#absmartly-preview-header')
      await previewHeader.waitFor({ state: 'visible', timeout: 10000 })
      log('Preview header is visible')

      // Wait for Exit Preview button to be visible and enabled
      const exitButton = previewHeader.locator('#exit-preview-button')
      await exitButton.waitFor({ state: 'visible', timeout: 10000 })
      log('Exit Preview button is visible')

      // After VE exit, preview mode is still active - exit it via the toolbar button
      await exitButton.click()
      log('Clicked Exit Preview button')

      // Check if page is alive immediately after clicking
      const pageAliveAfter = await testPage.evaluate(() => true).catch(() => false)
      log(`Page alive after Exit Preview click: ${pageAliveAfter}`)

      if (!pageAliveAfter) {
        await testPage.screenshot({ path: 'test-results/page-dead-after-exit-preview.png', fullPage: true })
        log('Screenshot saved: page-dead-after-exit-preview.png')
        throw new Error('Page crashed immediately after Exit Preview button click')
      }

      // Wait for toolbar to be removed (with timeout)
      await previewHeader.waitFor({ state: 'hidden', timeout: 5000 })
      log('Preview header removed from DOM')

      // Take screenshot after exit
      await testPage.screenshot({ path: 'test-results/after-exit-preview.png', fullPage: true })
      log('Screenshot saved: after-exit-preview.png')

      // Verify preview toolbar was removed
      const toolbarRemoved = await testPage.evaluate(() => document.getElementById('absmartly-preview-header') === null)
      expect(toolbarRemoved).toBe(true)

      // Verify all markers and changes were reverted
      const markersRemoved = await testPage.evaluate(() => document.querySelectorAll('[data-absmartly-modified], [data-absmartly-experiment]').length === 0)
      expect(markersRemoved).toBe(true)
    })

    await test.step('Test preview mode toggle', async () => {
      step('Testing preview toggle (enable/disable)', '👁️')

      // First, ensure preview is disabled by clicking the preview toggle if it's active
      const previewActive = await testPage.evaluate(() => {
        return document.querySelectorAll('[data-absmartly-modified]').length > 0
      })

      if (previewActive) {
        log('Preview is currently active, disabling it first...')
        const previewToggle = sidebar.locator('#preview-variant-1')
        await previewToggle.click()

        // Wait for markers to be removed
        await testPage.waitForFunction(() => {
          return document.querySelectorAll('[data-absmartly-modified]').length === 0
        }, { timeout: 5000 })

        log('✓ Preview disabled, ready for toggle test')
      }

      await testPreviewToggle(sidebar, testPage)
    })

    // ========================================
    // URL FILTER & SECOND VE INSTANCE
    // ========================================

    await test.step('Add URL filter and verify JSON payload', async () => {
      step('Testing URL filter and payload', '🔗')
      await testURLFilterAndPayload(sidebar, testPage)
    })

    await test.step('Test launching second VE instance', async () => {
      step('Testing second VE instance launch', '🔄')
      await testSecondVEInstance(sidebar, testPage)
    })

    // ========================================
    // INDIVIDUAL PREVIEW TOGGLE TESTING
    // ========================================

    await test.step('Test individual DOM change checkbox toggles', async () => {
      step('Testing individual preview toggle', '🔘')
      await testIndividualPreviewToggle(sidebar, testPage)
    })

    await test.step('Test attribute changes in preview mode', async () => {
      step('Testing attribute changes', '🏷️')
      await testAttributeChanges(sidebar, testPage)
    })

    // ========================================
    // DISCARD CHANGES TESTING
    // ========================================

    await test.step('Test discarding changes cleans up page correctly', async () => {
      step('Testing discard changes', '🗑️')
      await testDiscardChanges(sidebar, testPage, allConsoleMessages)
    })

    // ========================================
    // EXPERIMENT FINALIZATION (if enabled)
    // ========================================

    await test.step('Fill metadata and prepare for save', async () => {
      step('Filling metadata (owners, teams, tags)', '📋')
      await fillMetadataForSave(sidebar, testPage)
    })

    // Only save if SAVE_EXPERIMENT flag is set
    if (SAVE_EXPERIMENT) {
      await test.step('Save experiment to database', async () => {
        step('Saving experiment to database', '💾')
        await saveExperiment(sidebar, testPage, experimentName)
      })
    }

  })
})
