import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { injectSidebar, debugWait, log, initializeTestLogging, setupTestPage } from './utils/test-helpers'
import { createExperiment, activateVisualEditor, testSecondVEInstance, fillMetadataForSave, saveExperiment } from './helpers/ve-experiment-setup'
import { testAllVisualEditorActions } from './helpers/ve-actions'
import { testUndoRedoForAllActions, testUndoRedoButtonStates } from './helpers/ve-undo-redo'
import { verifyVEProtection, verifySidebarHasChanges, verifyChangesAfterVEExit, clickSaveButton } from './helpers/ve-verification'
import { testPreviewToggle } from './helpers/ve-preview'
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

    log('✅ Test page loaded (test mode enabled)', 'info')
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
      log(`\n${emoji} STEP ${stepNumber++}: ${title}`)
    }

    // ========================================
    // SETUP PHASE
    // ========================================

    await test.step('Inject sidebar', async () => {
      step('Injecting sidebar', '📂')
      sidebar = await injectSidebar(testPage, extensionUrl)
      log('✅ Sidebar visible')

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
      log(`✅ Experiment created: ${experimentName}`)
    })

    await test.step('Activate Visual Editor', async () => {
      step('Activating Visual Editor', '🎨')
      await activateVisualEditor(sidebar, testPage)
      log('✅ Visual Editor active')
    })

    // ========================================
    // VISUAL EDITOR PROTECTION & ACTIONS
    // ========================================

    await test.step('Test VE protection: all buttons disabled when VE active', async () => {
      step('Testing VE protection (all buttons disabled)', '🚫')
      await verifyVEProtection(sidebar)
      log('✅ VE protection verified')
    })

    await test.step('Test visual editor actions', async () => {
      step('Testing all VE actions', '🎯')
      await testAllVisualEditorActions(testPage)
      log('✅ All VE actions verified')
    })

    // ========================================
    // UNDO/REDO TESTING
    // ========================================

    await test.step('Test undo/redo functionality for all change types', async () => {
      step('Testing undo/redo for all change types', '🔄')
      await testUndoRedoForAllActions(testPage)
      log('✅ Undo/redo for all types verified')
    })

    await test.step('Test undo/redo button disabled states', async () => {
      step('Testing undo/redo button states', '🔘')
      await testUndoRedoButtonStates(testPage)
      log('✅ Button states verified')
    })

    // ========================================
    // SAVE & VERIFICATION
    // ========================================

    await test.step('Save changes to sidebar', async () => {
      step('Saving changes', '💾')
      await clickSaveButton(testPage)
      await debugWait(2000)
      log('✅ Changes saved')
    })

    await test.step('Verify changes in sidebar', async () => {
      step('Verifying changes in sidebar', '📝')
      await verifySidebarHasChanges(sidebar, 4)
      log('✅ Sidebar changes verified')
    })

    await test.step('Verify changes and markers after VE exit', async () => {
      step('Verifying changes and markers', '✓')
      await verifyChangesAfterVEExit(testPage)
      log('✅ Changes and markers verified')
    })

    // ========================================
    // PREVIEW MODE TESTING
    // ========================================

    await test.step('Exit preview mode via toolbar button', async () => {
      step('Exiting preview mode', '🚪')

      // After VE exit, preview mode is still active - exit it via the toolbar button
      await testPage.locator('#absmartly-preview-header button:has-text("Exit Preview")').click()
      await debugWait(1000)

      // Verify preview toolbar was removed
      const toolbarRemoved = await testPage.evaluate(() => document.getElementById('absmartly-preview-header') === null)
      expect(toolbarRemoved).toBe(true)
      log('  ✓ Preview toolbar removed')

      // Verify all markers and changes were reverted
      const markersRemoved = await testPage.evaluate(() => document.querySelectorAll('[data-absmartly-modified], [data-absmartly-experiment]').length === 0)
      expect(markersRemoved).toBe(true)
      log('✅ All preview markers and changes reverted')
    })

    await test.step('Test preview mode toggle', async () => {
      step('Testing preview toggle (enable/disable)', '👁️')
      await testPreviewToggle(sidebar, testPage)
      log('✅ Preview toggle verified')
    })

    // ========================================
    // URL FILTER & SECOND VE INSTANCE
    // ========================================

    await test.step('Add URL filter and verify JSON payload', async () => {
      step('Testing URL filter and payload', '🔗')
      await testURLFilterAndPayload(sidebar, testPage)
      log('✅ URL filter and payload verified')
    })

    await test.step('Test launching second VE instance', async () => {
      step('Testing second VE instance launch', '🔄')
      await testSecondVEInstance(sidebar, testPage)
      log('✅ Second VE instance verified')
    })

    // ========================================
    // DISCARD CHANGES TESTING
    // ========================================

    await test.step('Test discarding changes cleans up page correctly', async () => {
      step('Testing discard changes', '🗑️')
      await testDiscardChanges(sidebar, testPage, allConsoleMessages)
      log('✅ Discard changes verified')
    })

    // ========================================
    // EXPERIMENT FINALIZATION (if enabled)
    // ========================================

    await test.step('Fill metadata and prepare for save', async () => {
      step('Filling metadata (owners, teams, tags)', '📋')
      await fillMetadataForSave(sidebar, testPage)
      log('✅ Metadata filled')
    })

    // Only save if SAVE_EXPERIMENT flag is set
    if (SAVE_EXPERIMENT) {
      await test.step('Save experiment to database', async () => {
        step('Saving experiment to database', '💾')
        await saveExperiment(sidebar, testPage, experimentName)
        log('✅ Experiment saved to database')
      })
    } else {
      log('\n⏭️  Skipping database save (SAVE_EXPERIMENT flag not set)')
      log('   To enable saving, run: SAVE_EXPERIMENT=1 npx playwright test ...')
      log('   ⚠️  WARNING: This writes to the production database!')
    }

    // ========================================
    // TEST COMPLETE
    // ========================================

    log('\n🎉 Visual Editor Complete Workflow Test PASSED!')
    log(`✅ All ${stepNumber - 1} test phases completed successfully:`)
    log('  • Sidebar injection and setup')
    log('  • Experiment creation and VE activation')
    log('  • VE protection and all action tests')
    log('  • Comprehensive undo/redo functionality')
    log('  • Save and verification flow')
    log('  • Preview mode toggle and exit')
    log('  • URL filtering and payload verification')
    log('  • Second VE instance launch')
    log('  • Discard changes cleanup')
    if (SAVE_EXPERIMENT) {
      log('  • Experiment saved to database')
    }
  })
})
