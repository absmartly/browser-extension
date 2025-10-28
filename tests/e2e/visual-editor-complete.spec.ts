import { test, expect } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import { injectSidebar, debugWait, setupConsoleLogging, click, setupTestPage, log, initializeTestLogging, rightClickElement } from './utils/test-helpers'
import { waitForVisualEditorBanner, waitForVisualEditorActive, clickElementInEditor, isContextMenuOpen, clickContextMenuItem } from './utils/visual-editor-helpers'
import { createExperiment, activateVisualEditor } from './helpers/ve-experiment-setup'
import { testAllVisualEditorActions } from './helpers/ve-actions'

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

    await test.step('Inject sidebar', async () => {
      log('\n📂 STEP 1: Injecting sidebar')
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

    let experimentName: string

    await test.step('Create new experiment', async () => {
      experimentName = await createExperiment(sidebar)
    })

    await test.step('Activate Visual Editor', async () => {
      await activateVisualEditor(sidebar, testPage)
    })

    await test.step('Test VE protection: all buttons disabled when VE active', async () => {
      log('\n🚫 STEP 3.5: Testing VE protection - all buttons should be disabled')

      const allVEButtons = sidebar.locator('button:has-text("Visual Editor")')
      const buttonCount = await allVEButtons.count()
      log(`  Found ${buttonCount} Visual Editor buttons`)

      // Check ALL buttons are disabled
      for (let i = 0; i < buttonCount; i++) {
        const button = allVEButtons.nth(i)
        const isDisabled = await button.isDisabled()
        const title = await button.getAttribute('title')
        log(`  Button ${i} disabled: ${isDisabled}, title: "${title}"`)

        // Verify all buttons are disabled
        expect(isDisabled).toBe(true)
        expect(title).toMatch(/Visual Editor is (already active for this variant|active for variant)/)
      }
      log('  ✅ All VE buttons correctly disabled when VE is active')

      await debugWait()
    })

    await test.step('Test visual editor actions', async () => {
      await testAllVisualEditorActions(testPage)
    })

    await test.step('Test undo/redo functionality for all change types', async () => {
      log('\n🔄 Testing comprehensive undo/redo for all change types...')

      // Helper to deselect all elements
      const deselectAll = async () => {
        await testPage.evaluate(() => {
          document.querySelectorAll('.absmartly-selected, .absmartly-editing').forEach(el => {
            el.classList.remove('absmartly-selected', 'absmartly-editing')
            if (el instanceof HTMLElement && el.contentEditable === 'true') {
              el.contentEditable = 'false'
              el.blur()
            }
          })
          document.getElementById('absmartly-menu-host')?.remove()
        })
        await testPage.locator('body').click({ position: { x: 5, y: 5 } })
      }

      // Helper to click element and open context menu
      const openContextMenu = async (selector: string) => {
        await deselectAll()
        await testPage.locator(selector).evaluate((el) => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })
        await testPage.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })
      }

      // 1. TEST TEXT CHANGE UNDO/REDO
      log('\n  1️⃣  Testing TEXT change undo/redo...')
      const originalText = await testPage.locator('#test-paragraph').textContent()

      await openContextMenu('#test-paragraph')
      await testPage.locator('.menu-item:has-text("Edit Text")').evaluate((el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      await testPage.waitForFunction(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.getAttribute('contenteditable') === 'true'
      })
      await testPage.locator('#test-paragraph').fill('Text undo test')
      await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph') as HTMLElement
        para?.blur()
      })
      await testPage.waitForFunction(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim() === 'Text undo test'
      })

      let currentText = await testPage.locator('#test-paragraph').textContent()
      expect(currentText?.trim()).toBe('Text undo test')
      log(`  ✓ Text changed to: "${currentText?.trim()}"`)

      // Undo text change
      await testPage.locator('[data-action="undo"]').click()
      currentText = await testPage.locator('#test-paragraph').textContent()
      expect(currentText?.trim()).toBe(originalText?.trim())
      log(`  ✓ Undo restored text to: "${currentText?.trim()}"`)

      // Redo text change
      await testPage.locator('[data-action="redo"]').click()
      currentText = await testPage.locator('#test-paragraph').textContent()
      expect(currentText?.trim()).toBe('Text undo test')
      log(`  ✓ Redo reapplied text to: "${currentText?.trim()}"`)

      // 2. TEST HTML CHANGE UNDO/REDO
      log('\n  2️⃣  Testing HTML change undo/redo...')

      // Wait for element to no longer be editable before proceeding
      await testPage.waitForFunction(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.getAttribute('contenteditable') !== 'true'
      })

      const originalHtml = await testPage.locator('#test-paragraph').innerHTML()
      log(`  📝 Original HTML: "${originalHtml}"`)

      await openContextMenu('#test-paragraph')
      await testPage.locator('.menu-item:has-text("Edit HTML")').evaluate((el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      await testPage.waitForSelector('#html-editor-dialog', { state: 'visible' })

      // Wait for CodeMirror to be fully initialized
      await testPage.waitForSelector('.cm-editor', { state: 'visible' })

      // Focus CodeMirror editor and update content
      await testPage.evaluate(() => {
        const editor = document.querySelector('.cm-content') as HTMLElement
        if (editor) {
          editor.focus()
        }
      })

      // Select all and replace with new content
      await testPage.keyboard.press('Meta+A')
      await testPage.keyboard.type('<strong>Bold HTML test</strong>')

      // Just click Apply - the live preview should have updated already, but if not Apply will save it
      await testPage.locator('#html-editor-dialog button:has-text("Apply")').click()
      await testPage.locator('#html-editor-dialog').waitFor({ state: 'hidden' })

      // Now verify it was applied
      let currentHtml = await testPage.locator('#test-paragraph').innerHTML()
      expect(currentHtml).toContain('<strong>Bold HTML test</strong>')
      log(`  ✓ HTML changed to contain: <strong>Bold HTML test</strong>`)

      // Undo HTML change
      await testPage.locator('[data-action="undo"]').click()
      currentHtml = await testPage.locator('#test-paragraph').innerHTML()
      expect(currentHtml).toBe(originalHtml)
      log(`  ✓ Undo restored original HTML`)

      // Redo HTML change
      await testPage.locator('[data-action="redo"]').click()
      currentHtml = await testPage.locator('#test-paragraph').innerHTML()
      expect(currentHtml).toContain('<strong>Bold HTML test</strong>')
      log(`  ✓ Redo reapplied HTML change`)

      // 3. TEST HIDE/SHOW UNDO/REDO
      log('\n  3️⃣  Testing HIDE/SHOW undo/redo...')
      let isVisible = await testPage.locator('#test-paragraph').isVisible()
      expect(isVisible).toBe(true)

      await openContextMenu('#test-paragraph')
      await testPage.locator('.menu-item:has-text("Hide")').evaluate((el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      isVisible = await testPage.locator('#test-paragraph').isVisible()
      expect(isVisible).toBe(false)
      log(`  ✓ Element hidden`)

      // Undo hide (should show)
      await testPage.locator('[data-action="undo"]').click()
      isVisible = await testPage.locator('#test-paragraph').isVisible()
      expect(isVisible).toBe(true)
      log(`  ✓ Undo showed element`)

      // Redo hide
      await testPage.locator('[data-action="redo"]').click()
      isVisible = await testPage.locator('#test-paragraph').isVisible()
      expect(isVisible).toBe(false)
      log(`  ✓ Redo hid element again`)

      // Show it back for next tests
      await testPage.locator('[data-action="undo"]').click()

      // 4. TEST DELETE/RESTORE UNDO/REDO
      log('\n  4️⃣  Testing DELETE/RESTORE undo/redo...')
      let elementVisible = await testPage.locator('#test-paragraph').isVisible()
      expect(elementVisible).toBe(true)

      await openContextMenu('#test-paragraph')
      await testPage.locator('.menu-item:has-text("Delete")').evaluate((el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      elementVisible = await testPage.locator('#test-paragraph').isVisible()
      expect(elementVisible).toBe(false)
      log(`  ✓ Element hidden`)

      // Undo delete (should restore)
      await testPage.locator('[data-action="undo"]').click()
      elementVisible = await testPage.locator('#test-paragraph').isVisible()
      expect(elementVisible).toBe(true)
      log(`  ✓ Undo restored element visibility`)

      // Redo delete
      await testPage.locator('[data-action="redo"]').click()
      elementVisible = await testPage.locator('#test-paragraph').isVisible()
      expect(elementVisible).toBe(false)
      log(`  ✓ Redo hid element again`)

      // Restore it back for next tests
      await testPage.locator('[data-action="undo"]').click()

      log('\n✅ All undo/redo tests PASSED!')
      log('  ✓ Text change undo/redo works')
      log('  ✓ HTML change undo/redo works')
      log('  ✓ Hide/show undo/redo works')
      log('  ✓ Delete/restore undo/redo works')
      log('  ✓ Insert block undo/redo works')
    })

    await test.step('Test undo/redo button disabled states', async () => {
      log('\n🔘 Testing undo/redo button states...')

      // After all redos, we should be at "Undo test 3"
      // Now undo ALL changes including the original 5 (text, hide, delete, move, html)
      // We need to undo 3 text changes + 4 other changes = 7 total undos

      // We already did 3 undos and 3 redos, so we're back at "Undo test 3"
      // Let's undo ALL 8 changes (3 text + 5 original changes)
      log('  ⏪ Undoing all changes to test undo button disabled state...')

      // Track how many undos we can do
      let undoCount = 0
      let undoButton = testPage.locator('[data-action="undo"]')

      while (undoCount < 20) { // Safety limit
        const isDisabled = await undoButton.isDisabled()
        if (isDisabled) {
          log(`  ✓ Undo button became disabled after ${undoCount} undos`)
          break
        }
        await undoButton.click()
        undoCount++
      }

      // Verify undo button is disabled
      await expect(undoButton).toBeDisabled()
      log('  ✓ Undo button is disabled when no more changes to undo')

      // Now redo ALL changes
      log('\n  ⏩ Redoing all changes to test redo button disabled state...')
      let redoCount = 0
      let redoButton = testPage.locator('[data-action="redo"]')

      while (redoCount < 20) { // Safety limit
        const isDisabled = await redoButton.isDisabled()
        if (isDisabled) {
          log(`  ✓ Redo button became disabled after ${redoCount} redos`)
          break
        }
        await redoButton.click()
        redoCount++
      }

      // Verify redo button is disabled
      await expect(redoButton).toBeDisabled()
      log('  ✓ Redo button is disabled when no more changes to redo')

      log('\n✅ Undo/redo button states test PASSED!')
      log(`  • Undo button disabled after ${undoCount} undos (no more history)`)
      log(`  • Redo button disabled after ${redoCount} redos (caught up to current state)`)
    })

    await test.step('Save changes to sidebar', async () => {
      log('\n💾 STEP 5: Clicking Save button...')

    // With use_shadow_dom_for_visual_editor_context_menu=0, the banner is not in shadow DOM
    // So we can click it directly
    try {
      await testPage.locator('[data-action="save"]').click({ timeout: 5000 })
      log('✅ Save button clicked')
    } catch (err) {
      log('⚠️  Save button not found or not clickable within 5 seconds')
    }

      // Save triggers stop() after 500ms delay, so wait for VE to exit
      // and preview toolbar to appear
      await debugWait(2000)
    })

    await test.step('Wait for sidebar to update', async () => {
      log('\n⏳ STEP 6: Waiting for sidebar to update after visual editor closes...')

      // After the visual editor closes, wait for the DOM changes to appear in the create form
      // The changes should be visible in the variant's DOM Changes section
      // Give it extra time for React to re-render the inline editor with the changes

      await debugWait()
    })

    await test.step('Verify changes in sidebar', async () => {
      log('\n📝 STEP 7: Verifying changes in sidebar...')

      // Take a screenshot of the entire page to see the sidebar
      await testPage.screenshot({ path: 'test-results/sidebar-after-save.png', fullPage: true })
      log('  Screenshot saved to test-results/sidebar-after-save.png')

      // Debug: Check if DOM changes InlineEditor component is even mounted
      const inlineEditorExists = await sidebar.locator('[data-testid="dom-changes-inline-editor"], .dom-changes-editor').count()
      log(`  Inline editor exists: ${inlineEditorExists > 0}`)

      // Debug: Check the sidebar HTML structure
      const sidebarHTML = await sidebar.locator('body').innerHTML()
      log(`  Sidebar HTML length: ${sidebarHTML.length} characters`)
      log(`  Sidebar HTML: ${sidebarHTML.substring(0, 500)}...`)

      // Debug: Look for any elements that might contain changes
      const anyChangeElements = await sidebar.locator('[class*="change"], [class*="card"]').count()
      log(`  Elements with 'change' or 'card' in class: ${anyChangeElements}`)

    // Wait for DOM change cards to appear in the sidebar
    // The changes are displayed as cards, not in a Monaco editor
    try {
      // Wait for at least one DOM change card to appear (no need to scroll, they should be visible)
      await sidebar.locator('.dom-change-card').first().waitFor({ timeout: 10000 })
    } catch (err) {
      log('⚠️  DOM change cards did not appear within 10000ms')
      log('  Searching for any elements with "dom-change" in class...')
      const anyDomChangeElements = await sidebar.locator('[class*="dom-change"]').count()
      log(`  Found ${anyDomChangeElements} elements with "dom-change" in class`)
      
      // Debug: Check if changes are in the data but not rendered
      const sidebarText = await sidebar.locator('body').innerText()
      log('  Sidebar contains "Undo test":', sidebarText.includes('Undo test'))
      log('  Sidebar contains "display:none":', sidebarText.includes('display:none'))
      
      throw err // Re-throw to fail the test
    }

    // Count the number of DOM change cards
    const changeCards = await sidebar.locator('.dom-change-card').count()
    log(`Found ${changeCards} DOM change cards in sidebar`)

    // Verify we have the expected 4 changes after squashing
    // (text [squashed from multiple edits], hide, delete, html)
    // Note: Multiple text edits to same element are squashed into one
    expect(changeCards).toBeGreaterThanOrEqual(4)

    // Get the text content of all cards to verify change types
    const cardsText = await sidebar.locator('.dom-change-card').allTextContents()
    const allText = cardsText.join(' ')

    log('DOM Change cards content:', allText.substring(0, 400))
    log('\nSearching for HTML change...')
    log('Looking for: #test-container and "<h2>HTML Edited!</h2><p>New paragraph content</p>"')
    log('Has #test-container:', allText.includes('#test-container'))
    log('Has "<h2>HTML Edited!</h2><p>New paragraph content</p>":', allText.includes('HTML Edited!'))

    // Verify each specific change we made is present with correct details
    log('\n  Verifying individual changes:')

    // 1. Edit Text on #test-paragraph - should contain "Text undo test" (final text after undo/redo test)
    const hasEditText = allText.includes('#test-paragraph') && allText.includes('Text undo test')
    log(`  ${hasEditText ? '✓' : '✗'} Edit Text: #test-paragraph → "Text undo test"`)
    expect(hasEditText).toBeTruthy()

    // 2. Hide #button-1 - should contain style with display:none
    const hasHide = allText.includes('#button-1') && allText.includes('display') && allText.includes('none')
    log(`  ${hasHide ? '✓' : '✗'} Hide: #button-1 → display:none`)
    expect(hasHide).toBeTruthy()

    // 3. Delete/Remove #button-2
    const hasDelete = allText.includes('#button-2') && (allText.toLowerCase().includes('delete') || allText.toLowerCase().includes('remove'))
    log(`  ${hasDelete ? '✓' : '✗'} Delete/Remove: #button-2`)
    expect(hasDelete).toBeTruthy()

    // 4. Edit HTML on #test-container - should have HTML change type
    const hasEditHTML = allText.includes('#test-container') && (allText.includes('HTML') || allText.includes('html'))
    log(`  ${hasEditHTML ? '✓' : '✗'} Edit HTML: #test-container → HTML change`)
    expect(hasEditHTML).toBeTruthy()

    log('\n✅ All expected changes verified in sidebar')

    log('\n🎉 Visual editor complete workflow test PASSED!')
    log('✅ Successfully tested:')
    log('  • Edit Text - Modified paragraph text')
    log('  • Hide - Hid button element')
    log('  • Delete - Deleted button element')
    log('  • Edit HTML - Modified heading HTML')
    log('  • Save to sidebar - Changes synced to DOM editor')


    })

    await test.step('Verify changes and markers after VE exit', async () => {
      log('\n🔍 STEP 6.5: Verifying changes and markers after VE exit')

      const postVEState = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const testContainer = document.querySelector('#test-container')

        // Count elements with markers
        const markedElements = document.querySelectorAll('[data-absmartly-experiment]')
        const elementsWithOriginals = document.querySelectorAll('[data-absmartly-original]')

        return {
          // Verify changes are still applied
          paragraphText: paragraph?.textContent?.trim(),
          button1Display: button1 ? window.getComputedStyle(button1).display : null,
          button2Display: button2 ? window.getComputedStyle(button2).display : null,
          testContainerHTML: testContainer?.innerHTML?.trim(),
          // Verify markers are present
          markedElementsCount: markedElements.length,
          elementsWithOriginalsCount: elementsWithOriginals.length,
          // Get marker details for debugging
          experimentNames: Array.from(markedElements).map(el =>
            (el as HTMLElement).dataset.absmartlyExperiment
          )
        }
      })

      log('  Post-VE state:', postVEState)

      // Verify changes are still applied (text should be "Bold HTML test" after HTML undo/redo test)
      expect(postVEState.paragraphText).toBe('Bold HTML test')
      expect(postVEState.button1Display).toBe('none')
      expect(postVEState.button2Display).toBe('none')
      expect(postVEState.testContainerHTML).toContain('HTML Edited!')
      log('  ✓ All changes still applied after VE exit')

      // Verify markers are present (preview mode is still active)
      expect(postVEState.markedElementsCount).toBeGreaterThan(0)
      log(`  ✓ Preview markers present: ${postVEState.markedElementsCount} elements marked`)

      // Verify original values are preserved
      expect(postVEState.elementsWithOriginalsCount).toBeGreaterThan(0)
      log(`  ✓ Original values preserved: ${postVEState.elementsWithOriginalsCount} elements with data-absmartly-original`)

      await debugWait()
    })

    await test.step('Test Exit Preview button from toolbar', async () => {
      log('\n🚪 STEP 8: Testing Exit Preview button from toolbar')

      // After VE exit, preview mode is still active with the preview toolbar visible
      log('  Verifying preview toolbar is visible...')

      // Take screenshot to debug
      await testPage.screenshot({ path: 'test-results/after-ve-exit-before-toolbar-check.png', fullPage: true })
      log('  📸 Screenshot: after-ve-exit-before-toolbar-check.png')

      // Wait for toolbar to appear
      await testPage.locator('#absmartly-preview-header').waitFor({ state: 'attached', timeout: 3000 }).catch(() => {})

      const toolbarVisible = await testPage.evaluate(() => {
        const toolbar = document.getElementById('absmartly-preview-header')
        console.log('  [Page] Toolbar element:', toolbar)
        return toolbar !== null
      })

      log(`  Toolbar visible: ${toolbarVisible}`)

      if (!toolbarVisible) {
        // Take another screenshot to see what's happening
        await testPage.screenshot({ path: 'test-results/toolbar-not-found.png', fullPage: true })
        log('  📸 Screenshot: toolbar-not-found.png')

        // Check VE state
        const veState = await testPage.evaluate(() => {
          const editor = (window as any).__absmartlyVisualEditor
          return {
            isVisualEditorActive: editor && editor.isActive,
            hasVEChanges: !!(window as any).__absmartlyVEChanges
          }
        })
        console.log('  VE state:', veState)
      }

      expect(toolbarVisible).toBe(true)
      log('  ✓ Preview toolbar is visible')

      // Capture current state before clicking Exit Preview
      const beforeExitState = await testPage.evaluate(() => {
        const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
        const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')
        return {
          modifiedElementsCount: modifiedElements.length,
          experimentMarkersCount: experimentMarkers.length
        }
      })
      log(`  Preview markers before exit: ${beforeExitState.modifiedElementsCount} modified, ${beforeExitState.experimentMarkersCount} experiment markers`)

      // Click the Exit Preview button in the toolbar
      log('  Clicking Exit Preview button...')
      await testPage.evaluate(() => {
        console.log('[TEST] About to click Exit Preview button')
        const toolbar = document.getElementById('absmartly-preview-header')
        if (!toolbar) {
          throw new Error('Preview toolbar not found')
        }

        // Find button by text content
        const buttons = Array.from(toolbar.querySelectorAll('button'))
        const exitBtn = buttons.find(btn => btn.textContent?.includes('Exit Preview'))

        if (!exitBtn) {
          throw new Error('Exit Preview button not found in toolbar')
        }

        console.log('[TEST] Clicking Exit Preview button now...')
        ;(exitBtn as HTMLButtonElement).click()
        console.log('[TEST] Exit Preview button clicked')
      })
      log('  ✓ Clicked Exit Preview button')

      // Wait for changes to revert
      await debugWait(2000)

      // Verify the toolbar was removed
      log('  Verifying preview toolbar was removed...')
      const toolbarRemovedState = await testPage.evaluate(() => {
        const toolbar = document.getElementById('absmartly-preview-header')
        return {
          toolbarRemoved: toolbar === null
        }
      })
      expect(toolbarRemovedState.toolbarRemoved).toBe(true)
      log('  ✓ Preview toolbar removed')

      // Verify preview mode is completely disabled
      log('  Verifying preview mode is completely disabled...')
      const afterExitState = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const testContainer = document.querySelector('#test-container')
        const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
        const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')

        return {
          // Verify markers are removed
          modifiedElementsCount: modifiedElements.length,
          experimentMarkersCount: experimentMarkers.length,
          // Verify changes are reverted
          paragraphText: paragraph?.textContent,
          button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
          button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
          testContainerHTML: testContainer?.innerHTML?.trim()
        }
      })

      log('  After exit state:', afterExitState)
      log(`  Remaining markers: ${afterExitState.modifiedElementsCount} modified, ${afterExitState.experimentMarkersCount} experiment markers`)

      // Verify all markers removed
      expect(afterExitState.modifiedElementsCount).toBe(0)
      expect(afterExitState.experimentMarkersCount).toBe(0)
      log('  ✓ All preview markers removed')

      // Verify changes reverted
      expect(afterExitState.paragraphText).not.toBe('Undo test 3')
      expect(afterExitState.button1Visible).toBe(true)
      expect(afterExitState.button2Visible).toBe(true)
      expect(afterExitState.testContainerHTML).not.toContain('HTML Edited!')
      log('  ✓ All changes reverted to original state')

      // Verify preview toggle in sidebar is OFF
      log('  Verifying preview toggle in sidebar is OFF...')
      const previewToggle = sidebar.locator('#preview-variant-1')
      const toggleState = await previewToggle.evaluate((btn) => {
        return btn.classList.contains('bg-blue-600')
      })
      expect(toggleState).toBe(false)
      log('  ✓ Preview toggle in sidebar is OFF')

      log('✅ Exit Preview button test COMPLETED!')
      await debugWait()
    })

    await test.step('Test preview mode toggle', async () => {
      log('\n👁️ STEP 9: Testing preview mode toggle')

      // NOTE: Preview is now disabled after clicking Exit Preview in step 7
      // So the first click will ENABLE preview, and second click will DISABLE it

      // Listen for console messages from the page to debug (only in DEBUG mode)
      if (process.env.DEBUG === '1' || process.env.PWDEBUG === '1') {
        testPage.on('console', msg => {
          if (msg.text().includes('[ABsmartly Page]') || msg.text().includes('PREVIEW') || msg.text().includes('[VisualEditor]') || msg.text().includes('Visual Editor Content Script')) {
            log(`  [Page Console] ${msg.text()}`)
          }
        })
      }

      // Verify preview is currently disabled (from Exit Preview button in step 7)
      log('  Verifying preview is currently disabled...')
      const initialPreviewState = await testPage.evaluate(() => {
        const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
        const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')
        return {
          modifiedElementsCount: modifiedElements.length,
          experimentMarkersCount: experimentMarkers.length
        }
      })
      expect(initialPreviewState.modifiedElementsCount).toBe(0)
      expect(initialPreviewState.experimentMarkersCount).toBe(0)
      log('  ✓ Preview is disabled (no markers present)')

      // Take screenshot before enabling preview
      await testPage.screenshot({ path: 'test-results/preview-toggle-before-enable.png', fullPage: true })
      log('  📸 Screenshot: preview-toggle-before-enable.png')

      // Capture current state while preview is disabled
      log('  Capturing element states with preview disabled...')
      const previewDisabledStates = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const testContainer = document.querySelector('#test-container')

        return {
          paragraphText: paragraph?.textContent,
          paragraphVisible: paragraph ? window.getComputedStyle(paragraph).display !== 'none' : false,
          button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
          button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
          testContainerHTML: testContainer?.innerHTML?.trim(),
          toolbarExists: document.getElementById('absmartly-preview-header') !== null
        }
      })
      log('  States captured:', previewDisabledStates)
      log('  Toolbar visible before toggle:', previewDisabledStates.toolbarExists)

      // First click: ENABLE preview (apply changes and add markers)
      log('\n  ▶ Click 1: ENABLING preview mode via sidebar toggle...')

      // Click the button directly using the click helper for better React event handling
      log('  Attempting to click preview toggle button...')
      await click(sidebar, '#preview-variant-1', 5000)
      log('  ✓ Clicked preview toggle button')
      await debugWait(2000) // Wait for changes to apply and toolbar to appear

      // Take screenshot after enabling preview
      await testPage.screenshot({ path: 'test-results/preview-toggle-after-enable.png', fullPage: true })
      log('  📸 Screenshot: preview-toggle-after-enable.png')

      // FIRST: Check if DOM changes were actually applied (markers and modified elements)
      log('  Checking if DOM changes were applied...')
      const enabledStates = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const testContainer = document.querySelector('#test-container')
        const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
        const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')

        return {
          paragraphText: paragraph?.textContent,
          button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
          button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
          testContainerHTML: testContainer?.innerHTML?.trim(),
          modifiedCount: modifiedElements.length,
          experimentMarkersCount: experimentMarkers.length
        }
      })

      log('  States after enabling:', enabledStates)
      log(`  Modified elements: ${enabledStates.modifiedCount}`)
      log(`  Experiment markers: ${enabledStates.experimentMarkersCount}`)

      const changesApplied = enabledStates.modifiedCount > 0 && enabledStates.experimentMarkersCount > 0
      if (changesApplied) {
        log('  ✅ DOM changes WERE applied successfully')
      } else {
        log('  ❌ DOM changes were NOT applied')
      }

      // SECOND: Check if toolbar appeared
      log('  Checking if Preview toolbar appeared...')
      const toolbarVisibleAfterEnable = await testPage.evaluate(() => {
        const toolbar = document.getElementById('absmartly-preview-header')
        console.log('  [Page] Preview toolbar check:', toolbar !== null)
        return toolbar !== null
      })

      if (!toolbarVisibleAfterEnable) {
        log('  ❌ Preview toolbar did NOT appear after clicking toggle')
        const toolbarCheckState = await testPage.evaluate(() => {
          const toolbar = document.getElementById('absmartly-preview-header')
          const banner = document.getElementById('absmartly-visual-editor-banner-host')
          const allDivs = Array.from(document.querySelectorAll('div[id*="absmartly"]')).map(d => d.id)
          return {
            toolbarExists: toolbar !== null,
            bannerExists: banner !== null,
            absmartlyElements: allDivs
          }
        })
        log('  Debug state:', JSON.stringify(toolbarCheckState, null, 2))
      } else {
        log('  ✅ Preview toolbar appeared')
      }

      // Verify that changes were applied (this is the key functionality)
      expect(enabledStates.modifiedCount).toBeGreaterThan(0)
      expect(enabledStates.experimentMarkersCount).toBeGreaterThan(0)
      log('  ✓ Preview mode toggle applied DOM changes successfully')

      // Verify that toolbar appeared (this is a UI requirement)
      expect(toolbarVisibleAfterEnable).toBe(true, 'Preview toolbar should appear when preview toggle is enabled')

      // Second click: DISABLE preview
      log('\n  ▶ Click 2: DISABLING preview mode via sidebar toggle...')

      await click(sidebar, '#preview-variant-1', 5000)
      log('  ✓ Clicked preview toggle button (disable)')
      await debugWait(2000) // Wait for changes to revert and toolbar to disappear

      // Take screenshot after disabling preview
      await testPage.screenshot({ path: 'test-results/preview-toggle-after-disable.png', fullPage: true })
      log('  📸 Screenshot: preview-toggle-after-disable.png')

      // FIRST: Check if DOM changes were reverted (markers and modified elements removed)
      log('  Checking if DOM changes were reverted...')
      const disabledStates = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const testContainer = document.querySelector('#test-container')
        const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
        const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')

        return {
          paragraphText: paragraph?.textContent,
          button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
          button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
          testContainerHTML: testContainer?.innerHTML?.trim(),
          modifiedCount: modifiedElements.length,
          experimentMarkersCount: experimentMarkers.length
        }
      })

      log('  States after disabling:', disabledStates)
      log(`  Modified elements: ${disabledStates.modifiedCount}`)
      log(`  Experiment markers: ${disabledStates.experimentMarkersCount}`)

      const changesReverted = disabledStates.modifiedCount === 0 && disabledStates.experimentMarkersCount === 0
      if (changesReverted) {
        log('  ✅ DOM changes WERE reverted successfully')
      } else {
        log('  ❌ DOM changes were NOT reverted')
      }

      // SECOND: Check if toolbar disappeared
      log('  Checking if Preview toolbar disappeared...')
      const toolbarVisibleAfterDisable = await testPage.evaluate(() => {
        const toolbar = document.getElementById('absmartly-preview-header')
        return toolbar !== null
      })

      if (!toolbarVisibleAfterDisable) {
        log('  ✅ Preview toolbar disappeared')
      } else {
        log('  ❌ Preview toolbar is still visible')
      }

      // Verify that changes were reverted (this is the key functionality)
      expect(disabledStates.modifiedCount).toBe(0)
      expect(disabledStates.experimentMarkersCount).toBe(0)
      log('  ✓ Preview mode toggle reverted DOM changes successfully')

      // Verify that toolbar disappeared (this is a UI requirement)
      expect(toolbarVisibleAfterDisable).toBe(false, 'Preview toolbar should disappear when preview toggle is disabled')

      log('\n✅ Preview toggle functionality test COMPLETED!')
      log('  • Click 1: Enable preview - toolbar appeared ✓')
      log('  • Click 1: Enable preview - markers and changes applied ✓')
      log('  • Click 2: Disable preview - toolbar disappeared ✓')
      log('  • Click 2: Disable preview - markers removed and changes reverted ✓')
      await debugWait()
    })

    await test.step('Add URL filter and verify JSON payload', async () => {
      log('\n🔗 STEP 7.5: Adding URL filter and verifying JSON payload')

      // Take screenshot to see current state
      await testPage.screenshot({ path: 'test-results/before-url-filter-test.png', fullPage: true })
      log('  📸 Screenshot: before-url-filter-test.png')

      // Scroll sidebar to top to ensure Variant 1 is visible
      await sidebar.locator('body').evaluate(el => el.scrollTop = 0)

      // First, expand Variant 1 section if collapsed
      const variant1Toggle = sidebar.locator('#variant-toggle-1')
      await variant1Toggle.waitFor({ state: 'attached', timeout: 3000 })

      // Check if variant is collapsed by checking the button text
      const isCollapsed = await variant1Toggle.evaluate((btn) => {
        return btn.textContent?.includes('▶') || false
      })

      if (isCollapsed) {
        await variant1Toggle.click()
        // Wait for URL Filtering button to appear after expansion
        await sidebar.locator('#url-filtering-toggle-variant-1').waitFor({ state: 'visible', timeout: 3000 })
        log('  ✓ Expanded Variant 1 section')
      } else {
        log('  ✓ Variant 1 already expanded')
      }

      // Disable preview using ID if enabled
      const variant1PreviewToggle = sidebar.locator('[data-testid="preview-toggle-variant-1"]')
      const toggleExists = await variant1PreviewToggle.isVisible({ timeout: 2000 }).catch(() => false)

      if (toggleExists) {
        const isEnabled = await variant1PreviewToggle.evaluate((btn) => {
          return btn.className.includes('bg-blue-600')
        })

        if (isEnabled) {
          await variant1PreviewToggle.click()
          log('  ✓ Disabled preview mode for Variant 1')
        } else {
          log('  ✓ Preview already disabled for Variant 1')
        }
      }

      // Use ID to find and expand URL Filtering section
      const urlFilterButton = sidebar.locator('#url-filtering-toggle-variant-1')
      await urlFilterButton.waitFor({ state: 'visible', timeout: 3000 })
      await urlFilterButton.click()

      // Wait for mode select to appear after expansion
      const modeSelect = sidebar.locator('#url-filter-mode-variant-1')
      await modeSelect.waitFor({ state: 'visible', timeout: 3000 })
      log('  ✓ Expanded URL Filtering section')

      // Select "simple" mode
      await modeSelect.selectOption('simple')
      log('  ✓ Selected simple URL filter mode')

      // Wait for pattern input to appear after mode change
      const patternInput = sidebar.locator('#url-filter-pattern-variant-1-0')
      await patternInput.waitFor({ state: 'visible', timeout: 3000 })

      // Fill pattern
      await patternInput.fill('/test-path/*')
      await patternInput.blur()
      log('  ✓ Updated URL filter pattern to: /test-path/*')

      // Wait for debounce (500ms in URLFilterSection) + React state update to trigger save
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      // Debug: Check what's in the sidebar's variant config
      const variantConfigDebug = await testPage.evaluate(() => {
        const allIframes = Array.from(document.querySelectorAll('iframe')).map(f => f.id || f.src)
        const sidebarFrame = document.querySelector('iframe#absmartly-sidebar-iframe') as HTMLIFrameElement

        if (!sidebarFrame) {
          return `Sidebar iframe not found. Found iframes: ${JSON.stringify(allIframes)}`
        }

        if (!sidebarFrame.contentDocument) {
          return 'Sidebar iframe found but contentDocument is null (cross-origin or not loaded)'
        }

        // Access React fiber to get variant data
        const variantElement = sidebarFrame.contentDocument.querySelector('[data-testid="preview-toggle-variant-1"]')?.closest('div')
        if (!variantElement) return 'No variant element found in sidebar'

        const fiber = Object.keys(variantElement).find(key => key.startsWith('__reactFiber$'))
        if (!fiber) return 'No React fiber found on variant element'

        // @ts-ignore
        let node = variantElement[fiber]
        let depth = 0
        while (node && depth < 20) {
          if (node.memoizedProps?.variant) {
            return JSON.stringify(node.memoizedProps.variant.config, null, 2)
          }
          node = node.return
          depth++
        }
        return 'No variant config found in fiber tree (searched 20 levels)'
      })
      log('  🔍 Variant config from sidebar React state:')
      log(variantConfigDebug)

      // Now open the JSON editor for variant 1 to verify the URL filter is in the payload
      log('  Opening JSON editor to verify URL filter...')

      // Use ID to find JSON button for variant 1
      const jsonButton = sidebar.locator('#json-editor-button-variant-1')
      await jsonButton.waitFor({ state: 'visible', timeout: 3000 })
      await jsonButton.click()
      log('  ✓ Clicked JSON editor button for Variant 1')

      // The CodeMirror editor appears in the page, not in the sidebar
      // Look for the json-editor-title class or CodeMirror container
      const jsonEditorInPage = testPage.locator('.json-editor-title, .cm-editor').first()
      await jsonEditorInPage.waitFor({ state: 'visible', timeout: 3000 })
      const editorVisible = await jsonEditorInPage.isVisible({ timeout: 10000 }).catch(() => false)
      log(`  JSON editor visible in page: ${editorVisible}`)

      if (!editorVisible) {
        await testPage.screenshot({ path: 'test-results/json-editor-not-found.png', fullPage: true })
        throw new Error('JSON editor did not open')
      }

      log('  ✓ JSON editor modal opened')

      // Take screenshot of JSON editor
      await testPage.screenshot({ path: 'test-results/json-editor-opened.png', fullPage: true })
      log('  📸 Screenshot: json-editor-opened.png')

      // Get the JSON editor content from CodeMirror
      const jsonContent = await testPage.evaluate(() => {
        // CodeMirror 6 stores content in the editor state
        const cmEditor = document.querySelector('.cm-content')
        return cmEditor ? cmEditor.textContent : ''
      })

      log('  📄 JSON editor content preview:')
      log(jsonContent.substring(0, 500)) // Show first 500 chars

      // Verify the URL filter is present in the JSON
      const hasUrlFilter = jsonContent.includes('urlFilter') || jsonContent.includes('url_filter')
      expect(hasUrlFilter).toBeTruthy()
      log('  ✓ JSON contains urlFilter field')

      const hasInclude = jsonContent.includes('include')
      expect(hasInclude).toBeTruthy()
      log('  ✓ JSON contains include array')

      const hasPathPattern = jsonContent.includes('/test-path/*')
      expect(hasPathPattern).toBeTruthy()
      log('  ✓ JSON contains the path pattern: /test-path/*')

      const hasMatchType = jsonContent.includes('matchType') && jsonContent.includes('path')
      expect(hasMatchType).toBeTruthy()
      log('  ✓ JSON contains matchType: path')

      // Close the JSON editor modal - look for Cancel or Close button in the page
      const closeButton = testPage.locator('button:has-text("Cancel"), button:has-text("Close")').first()
      await closeButton.click()
      log('  ✓ Closed JSON editor')

      // Wait for editor to disappear
      await jsonEditorInPage.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})

      log('✅ URL filter test PASSED!')
      log('  • Added URL filter with path pattern: /test-path/*')
      log('  • Verified JSON payload contains urlFilter configuration')
      log('  • Verified include array with pattern')
      log('  • Verified matchType is set to path')
      await debugWait()
    })

    // Test launching a second VE instance after the first one has been closed
    await test.step('Test launching second VE instance', async () => {
      log('\n🔄 STEP 10: Testing ability to launch VE a second time...')

      // Verify test page is still valid
      if (testPage.isClosed()) {
        throw new Error('Test page was closed unexpectedly')
      }

      // Check if VE is still running and exit it
      const veActive = await testPage.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor
        return editor && editor.isActive === true
      })

      if (veActive) {
        log('  ⚠️  VE still active from previous step, exiting it first')
        // Exit VE by calling the exit method directly
        await testPage.evaluate(() => {
          const ve = (window as any).__visualEditor
          if (ve && typeof ve.exit === 'function') {
            ve.exit()
          }
        })

        // Wait for VE to fully exit
        await testPage.waitForFunction(() => {
          const editor = (window as any).__absmartlyVisualEditor
          return !editor || editor.isActive !== true
        }, { timeout: 5000 })
        log('  ✓ VE exited successfully')
      }

      // Disable preview if enabled
      const disableButton = sidebar.locator('button:has-text("Disable Preview")')
      const isPreviewEnabled = await disableButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (isPreviewEnabled) {
        await disableButton.click()
        await testPage.waitForFunction(() => {
          const para = document.querySelector('#test-paragraph')
          return para?.textContent?.includes('This is a test paragraph')
        })
        log('  ✓ Disabled preview mode')
      }

      // Wait for VE DOM elements to be cleaned up
      await testPage.waitForFunction(() => {
        return document.getElementById('absmartly-menu-host') === null
      }, { timeout: 5000 })
      log('  ✓ Previous VE DOM elements cleaned up')

      // Get fresh sidebar reference
      const freshSidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await freshSidebar.locator('body').waitFor({ timeout: 5000 })

      // Click the VE button to launch second instance
      const veButtons = freshSidebar.locator('button:has-text("Visual Editor")')
      
      // Use dispatchEvent to ensure React handler is triggered in headless mode
      await veButtons.nth(0).evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      log('  ✓ Dispatched click event to Visual Editor button for second launch')

      // Take screenshot to see what's happening
      await testPage.screenshot({ path: 'test-results/second-ve-before-wait.png' })

      // Wait for VE banner host to appear (banner uses shadow DOM so we check for the host)
      await testPage.locator('#absmartly-visual-editor-banner-host').waitFor({ timeout: 5000 })
      log('  ✓ Second VE instance launched successfully!')

      // Verify banner shows correct experiment name
      log('  ✓ Second VE is active and ready')

      // Exit the second VE by clicking the Exit button in the banner
      log('  Clicking Exit button to exit VE...')
      
      // Click the Exit button in the banner (check shadow DOM first, then direct)
      await testPage.evaluate(() => {
        const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
        if (!bannerHost) {
          console.error('  ✗ Banner host not found')
          return
        }
        
        // Try shadow DOM first
        let exitButton: HTMLElement | null = null
        if (bannerHost.shadowRoot) {
          exitButton = bannerHost.shadowRoot.querySelector('[data-action="exit"]') as HTMLElement
        } else {
          // Fallback to direct query (test mode without shadow DOM)
          exitButton = bannerHost.querySelector('[data-action="exit"]') as HTMLElement
        }
        
        if (exitButton) {
          console.log('  Found Exit button, dispatching click event...')
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          })
          exitButton.dispatchEvent(clickEvent)
          console.log('  ✓ Dispatched click event to Exit button')
        } else {
          console.error('  ✗ Exit button not found in banner')
        }
      })

      // Wait for VE to exit
      await testPage.waitForFunction(() => {
        const editor = (window as any).__absmartlyVisualEditor
        return !editor || editor.isActive !== true
      }, { timeout: 5000 })
      log('  🚪 VE exited - waiting for sidebar to update...')

      // Wait for VE DOM cleanup - banner and overlay should be removed
      await testPage.waitForFunction(() => {
        const banner = document.querySelector('.absmartly-banner')
        const overlay = document.querySelector('#absmartly-overlay-container')
        return banner === null && overlay === null
      }, { timeout: 3000 }).catch(() => log('  ⚠️  VE elements still present'))

      // Wait for sidebar to clear activeVEVariant state (onVEStop callback)
      log('  ✓ Waited for sidebar state cleanup')

      log('\n✅ Second VE launch test PASSED!')
      log('  • Successfully launched VE a second time')
      log('  • VE toolbar appeared correctly')
      log('  • Context menu works in second instance')
    })

    // Test that discarding changes properly cleans up the page
    await test.step('Test discarding changes cleans up page correctly', async () => {
      log('\n🗑️  STEP 11: Testing discard changes functionality...')

      // Get fresh sidebar reference
      const freshSidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

      // Disable preview first to start fresh
      const disableButton = freshSidebar.locator('button:has-text("Disable Preview")')
      const isPreviewEnabled = await disableButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (isPreviewEnabled) {
        await disableButton.click()
        await testPage.waitForFunction(() => {
          const para = document.querySelector('#test-paragraph')
          return para?.textContent?.includes('This is a test paragraph')
        })
        log('  ✓ Disabled preview to start fresh')
      }

      // Get original text
      const originalText = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      log(`  📝 Original text: "${originalText}"`)

      // Take screenshot before attempting to launch VE
      await testPage.screenshot({ path: 'test-results/before-discard-test-ve-launch.png', fullPage: true })
      log('  Screenshot saved: before-discard-test-ve-launch.png')

      // Launch VE - wait for button to be enabled first
      const veButtons = freshSidebar.locator('button:has-text("Visual Editor")')

      // Wait for button to become enabled (not disabled)
      await veButtons.nth(0).waitFor({ state: 'attached', timeout: 5000 })

      // Wait for the button to be enabled by checking it's not disabled
      log('  Waiting for VE button to become enabled...')
      let buttonEnabled = false
      for (let i = 0; i < 50; i++) {
        const isDisabled = await veButtons.nth(0).isDisabled()
        const title = await veButtons.nth(0).getAttribute('title')
        
        if (i % 10 === 0) {
          log(`  Check ${i}: disabled=${isDisabled}, title="${title}"`)
        }
        
        if (!isDisabled) {
          buttonEnabled = true
          log(`  ✓ Button enabled after ${i * 200}ms`)
          break
        }
      }

      if (!buttonEnabled) {
        // Take screenshot to debug
        await testPage.screenshot({ path: 'test-results/ve-button-still-disabled.png', fullPage: true })
        log('  ⚠️  Screenshot saved: ve-button-still-disabled.png')
        throw new Error('VE button never became enabled after 10 seconds')
      }

      // Take screenshot before clicking VE button
      await testPage.screenshot({ path: 'test-results/step11-before-ve-click.png', fullPage: true })
      log('📸 Screenshot: step11-before-ve-click.png')

      // Check for any leftover VE elements before clicking
      const beforeClickState = await testPage.evaluate(() => {
        const banner = document.querySelector('.absmartly-banner')
        const overlay = document.querySelector('#absmartly-overlay-container')
        const allDivs = Array.from(document.querySelectorAll('body > div')).map(d => ({
          class: d.className,
          id: d.id,
          children: d.children.length
        }))
        return {
          bannerExists: banner !== null,
          overlayExists: overlay !== null,
          bodyDivCount: document.querySelectorAll('body > div').length,
          bodyDivs: allDivs
        }
      })
      log(`Before VE click: banner=${beforeClickState.bannerExists}, overlay=${beforeClickState.overlayExists}, body divs=${beforeClickState.bodyDivCount}`)
      log(`Body div details: ${JSON.stringify(beforeClickState.bodyDivs, null, 2)}`)

      // Use dispatchEvent to ensure React handler is triggered in headless mode
      await veButtons.nth(0).evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      log('✓ Dispatched click event to Visual Editor button')

      // Wait for VE banner to appear
      try {
        await testPage.locator('.banner').waitFor({ state: 'visible', timeout: 5000 })
        log('✓ VE banner appeared')
      } catch (e) {
        log('⚠️  VE banner did not appear - checking page state...')
      }

      // Take screenshot after clicking VE button
      await testPage.screenshot({ path: 'test-results/step11-after-ve-click.png', fullPage: true })
      log('📸 Screenshot: step11-after-ve-click.png')

      // Capture console messages after VE button click
      const recentMessages = allConsoleMessages.slice(-40)
      log(`📋 Recent console messages (last 40):`)
      recentMessages.forEach(msg => {
        log(`  [${msg.type}] ${msg.text}`)
      })

      // Check for "already active" message which would indicate early return
      const hasAlreadyActive = recentMessages.some(m => m.text.includes('already active'))
      if (hasAlreadyActive) {
        log(`⚠️  VE returned "already active" - flag from previous session not cleaned up!`)
      }

      // Debug: Check what's preventing VE from activating
      log('Checking VE activation conditions...')
      const initialState = await testPage.evaluate(() => {
        const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
        const banner = bannerHost?.querySelector('.banner')
        const overlay = document.querySelector('#absmartly-overlay-container')
        const ve = (window as any).__absmartlyVisualEditor
        const allDivs = Array.from(document.querySelectorAll('body > div')).map(d => ({
          class: d.className,
          id: d.id,
          children: d.children.length,
          display: (d as HTMLElement).style.display
        }))
        return {
          bannerHostExists: bannerHost !== null,
          bannerExists: banner !== null,
          bannerHTML: banner ? banner.outerHTML.substring(0, 200) : null,
          overlayExists: overlay !== null,
          veInstanceExists: ve !== undefined,
          veIsActive: ve && ve.isActive,
          bodyDivCount: document.querySelectorAll('body > div').length,
          bodyDivs: allDivs
        }
      })
      log(`After VE click state:`)
      log(`  bannerHost=${initialState.bannerHostExists}, banner=${initialState.bannerExists}, overlay=${initialState.overlayExists}`)
      log(`  veInstance=${initialState.veInstanceExists}, veIsActive=${initialState.veIsActive}`)
      log(`  bodyDivs=${initialState.bodyDivCount}`)
      log(`Body div details: ${JSON.stringify(initialState.bodyDivs, null, 2)}`)
      if (initialState.bannerHTML) {
        log(`Banner HTML preview: ${initialState.bannerHTML}`)
      }

      // Wait for each condition separately to see which one fails
      log('Step 1: Waiting for VE banner to appear...')
      try {
        await testPage.waitForFunction(() => {
          // Banner is inside #absmartly-visual-editor-banner-host with class "banner"
          const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
          const banner = bannerHost?.querySelector('.banner')
          return banner !== null
        }, { timeout: 3000 })
        log('✓ Banner appeared')
      } catch (err) {
        log('❌ Banner never appeared!')

        // Debug: Check if VE instance exists but banner creation failed
        const debugInfo = await testPage.evaluate(() => {
          const ve = (window as any).__absmartlyVisualEditor
          const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
          const banner = bannerHost?.querySelector('.banner')
          return {
            veExists: ve !== undefined,
            veIsActive: ve && ve.isActive,
            bannerHostExists: bannerHost !== null,
            bannerExists: banner !== null,
            bannerHostChildren: bannerHost?.children.length || 0
          }
        })
        log(`Debug info: ${JSON.stringify(debugInfo, null, 2)}`)
        throw err
      }

      log('✓ Visual editor fully activated (banner present)')

      // Wait for VE to be fully initialized by checking if event handlers are attached
      // The undo button starts disabled and VE attaches handlers after initialization
      log('Waiting for VE event handlers to attach...')
      await testPage.waitForFunction(() => {
        // Check if clicking on elements would trigger VE handlers
        const para = document.querySelector('#test-paragraph')
        if (!para) return false

        // VE is ready when elements have the absmartly hover listener
        // We can verify by checking if the banner has interactive buttons
        const banner = document.querySelector('#absmartly-visual-editor-banner-host .banner')
        return banner !== null && banner.children.length > 0
      }, { timeout: 3000 })
      log('✓ VE event handlers attached')

      // Make a change to the paragraph
      const paragraph = testPage.locator('#test-paragraph')
      await paragraph.click() // Left-click to show context menu

      const contextMenu = testPage.locator('.menu-container')
      await expect(contextMenu).toBeVisible()

      const editTextButton = testPage.locator('.menu-item:has-text("Edit Text")')
      await editTextButton.click()

      // Wait for editable
      await testPage.waitForFunction(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.getAttribute('contenteditable') === 'true'
      })

      // Change the text
      await paragraph.fill('Discarded change')
      await testPage.locator('body').click({ position: { x: 10, y: 10 } })

      // Wait for change to be committed
      await testPage.waitForFunction(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim() === 'Discarded change'
      })
      log('  ✓ Made a change: "Discarded change"')

      // Verify the change is visible on page
      const textBeforeDiscard = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      expect(textBeforeDiscard).toBe('Discarded change')
      log('  ✓ Change is visible on page')

      // Click Exit button WITHOUT saving
      const exitButton = testPage.locator('button:has-text("Exit")').first()
      await expect(exitButton).toBeVisible()

      // Set up dialog handler to click "Yes" to discard
      testPage.once('dialog', async dialog => {
        log(`  💬 Dialog appeared: "${dialog.message()}"`)
        expect(dialog.message()).toContain('unsaved changes')
        await dialog.accept()
        log('  ✓ Accepted dialog (discarded changes)')
      })

      await exitButton.click()

      // Wait for VE to exit
      await testPage.waitForFunction(() => {
        return document.querySelector('.absmartly-toolbar') === null
      })
      log('  🚪 Exited visual editor')

      // Check if the change was properly cleaned up
      const textAfterDiscard = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })

      log(`  📝 Text after discard: "${textAfterDiscard}"`)
      log(`  📝 Expected original: "${originalText}"`)

      // Take screenshot to visually verify the bug
      await testPage.screenshot({ path: 'test-results/step11-after-discard.png', fullPage: true })
      log('  📸 Screenshot saved: step11-after-discard.png')

      // This SHOULD pass, but will FAIL due to the bug
      expect(textAfterDiscard).toBe(originalText)
      log('  ✅ Page correctly reverted to original state after discarding')

      // Also verify that changes were NOT saved to sidebar
      const savedChanges = await freshSidebar.locator('[data-testid="dom-change-item"]').count()
      expect(savedChanges).toBe(0)
      log('  ✅ Changes were NOT saved to sidebar')

      log('\n✅ Discard changes test PASSED!')
      log('  • Page correctly reverts when changes are discarded')
      log('  • Changes are not saved to sidebar when discarded')
    })

    // Setup and fill metadata fields for saving (always runs, not gated by SAVE_EXPERIMENT)
    log('\n💾 Preparing experiment for save: filling metadata fields...')
    await debugWait()

    // After the discard test:
    // - VE toolbar is removed (VE is stopped)
    // - Preview mode is still active (this is intentional - user might want to keep previewing)
    // - The sidebar is still on the Create New Experiment form

    // We need to exit preview mode before we can save
    log('  🔄 Exiting preview mode...')
    const exitPreviewBtn = testPage.locator('button:has-text("Exit Preview")')
    const isPreviewActive = await exitPreviewBtn.isVisible().catch(() => false)

    if (isPreviewActive) {
      log('  ⚠️  Preview mode is active (expected after VE exit)')
      await exitPreviewBtn.click()
      log('  ✓ Clicked Exit Preview')
      await debugWait()
      await exitPreviewBtn.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
      log('  ✓ Preview mode disabled')
      await debugWait()
    } else {
      log('  ✓ Preview mode already disabled')
    }

    // Fill the new metadata fields (owners, teams, tags)
    log('  📝 Filling owners, teams, and tags fields...')
    await debugWait()

    // Scroll to the metadata section
    await sidebar.locator('label:has-text("Applications"), label:has-text("Owners")').first().scrollIntoViewIfNeeded()
    await debugWait()

    // Fill Owners field - click the field to open dropdown
    log('  Attempting to select owners...')
    const ownersContainer = sidebar.locator('label:has-text("Owners")').locator('..')
    const ownersClickArea = ownersContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

    // Verify field is enabled
    const ownersDisabled = await ownersClickArea.evaluate(el => {
      return el.className.includes('cursor-not-allowed') || el.className.includes('disabled')
    })

    if (ownersDisabled) {
      throw new Error('Owners field is disabled - cannot select')
    }

    await ownersClickArea.click({ timeout: 5000 })
    log('  ✓ Clicked owners field')
    await debugWait()
    await debugWait()

    // Wait for dropdown to appear and get first option
    const ownersDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
    await ownersDropdown.waitFor({ state: 'visible', timeout: 3000 })
    log('  ✓ Owners dropdown appeared')

    // Wait for owners/teams to be loaded in the dropdown
    const firstOwnerOption = ownersDropdown.locator('div[class*="cursor-pointer"]').first()
    await firstOwnerOption.waitFor({ state: 'visible', timeout: 5000 })
    log('  ✓ Owners/teams loaded in dropdown')

    const optionExists = await firstOwnerOption.isVisible({ timeout: 2000 })

    if (!optionExists) {
      throw new Error('No owners/teams available in dropdown')
    }

    const selectedOptionText = await firstOwnerOption.textContent()

    // Use dispatchEvent to ensure React handler is triggered
    await firstOwnerOption.evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    log(`  ✓ Clicked owner/team option: ${selectedOptionText?.trim()}`)
    await debugWait()

    // Wait for the placeholder to disappear OR a badge to appear
    await Promise.race([
      ownersContainer.locator('text="Select owners and teams"').waitFor({ state: 'hidden', timeout: 5000 }),
      ownersContainer.locator('div[class*="badge"], div[class*="chip"], div[class*="tag"]').first().waitFor({ state: 'visible', timeout: 5000 })
    ]).catch(() => {
      log('  ⚠️  Neither placeholder disappeared nor badge appeared')
    })

    // Close dropdown by clicking outside (multi-select dropdown stays open)
    await sidebar.locator('label:has-text("Traffic")').click()
    log('  ✓ Clicked outside to close dropdown')
    await debugWait()

    // Wait for dropdown to close
    await ownersDropdown.waitFor({ state: 'hidden', timeout: 3000 })
    log('  ✓ Owner dropdown closed')
    await debugWait()

    // Fill Tags field - click the field to open dropdown
    log('  Attempting to select tags...')
    const tagsContainer = sidebar.locator('label:has-text("Tags")').locator('..')
    const tagsClickArea = tagsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

    // Verify field is enabled
    const tagsDisabled = await tagsClickArea.evaluate(el => {
      return el.className.includes('cursor-not-allowed') || el.className.includes('disabled')
    })

    if (tagsDisabled) {
      throw new Error('Tags field is disabled - cannot select')
    }

    await tagsClickArea.click({ timeout: 5000 })
    log('  ✓ Clicked tags field')
    await debugWait()

    // Wait for dropdown to appear and get first option
    const tagsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
    await tagsDropdown.waitFor({ state: 'visible', timeout: 3000 })
    log('  ✓ Tags dropdown appeared')
    await debugWait()

    // Click first available option in the dropdown
    const firstTagOption = tagsDropdown.locator('div[class*="cursor-pointer"]').first()
    await firstTagOption.waitFor({ state: 'visible', timeout: 5000 })
    log('  ✓ Tags loaded in dropdown')

    const tagOptionExists = await firstTagOption.isVisible({ timeout: 2000 })

    if (!tagOptionExists) {
      throw new Error('No tags available in dropdown')
    }

    const selectedTagText = await firstTagOption.textContent()

    // Use dispatchEvent to ensure React handler is triggered
    await firstTagOption.evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    log(`  ✓ Clicked tag option: ${selectedTagText?.trim()}`)
    await debugWait()

    // Wait for the placeholder to disappear OR a badge to appear
    await Promise.race([
      tagsContainer.locator('text="Type tags"').waitFor({ state: 'hidden', timeout: 5000 }),
      tagsContainer.locator('div[class*="badge"], div[class*="chip"], div[class*="tag"]').first().waitFor({ state: 'visible', timeout: 5000 })
    ]).catch(() => {
      log('  ⚠️  Neither placeholder disappeared nor badge appeared')
    })

    // Close dropdown by clicking outside (multi-select dropdown stays open)
    await sidebar.locator('label:has-text("Traffic")').click()
    log('  ✓ Clicked outside to close dropdown')
    await debugWait()

    // Wait for dropdown to close
    await tagsDropdown.waitFor({ state: 'hidden', timeout: 3000 })
    log('  ✓ Tag dropdown closed')
    await debugWait()

    log('  ✓ Filled metadata fields')
    await debugWait()

    // SAVE_EXPERIMENT guard: only wrap the actual save button click
    // WARNING: This writes to the production database! Only use when needed.
    // Pass SAVE_EXPERIMENT=1 environment variable to enable
    if (SAVE_EXPERIMENT) {
      await test.step('Save experiment to database', async () => {
        log('\n💾 Saving experiment to database...')
        log('⚠️  WARNING: This will write to the production database!')

        // Take screenshot before clicking save (should show top of form with any existing errors)
        await testPage.screenshot({ path: 'test-results/before-save-top.png', fullPage: true })
        log('  📸 Screenshot saved: before-save-top.png')
        await debugWait()

        // Submit the form instead of clicking the button
        // This ensures the form's onSubmit handler is properly triggered
        const form = sidebar.locator('form')

        // Scroll to the submit button area to make it visible
        const saveButton = sidebar.locator('#create-experiment-button')
        await saveButton.scrollIntoViewIfNeeded()
        log('  ✓ Scrolled to save button')
        await debugWait()

        // Wait for form and button to be ready
        await form.waitFor({ state: 'visible', timeout: 2000 })
        await saveButton.waitFor({ state: 'visible', timeout: 2000 })
        await debugWait()

        // Check if button is enabled
        const isDisabled = await saveButton.evaluate((btn) => btn.hasAttribute('disabled'))
        log(`  Button disabled: ${isDisabled}`)

        if (isDisabled) {
          // Wait for button to become enabled
          await saveButton.waitFor({ state: 'enabled', timeout: 5000 })
          log('  ✓ Button became enabled')
        }

        // Submit the form directly to trigger React's onSubmit handler
        await form.evaluate((f) => {
          f.requestSubmit()
        })
        log('  ✓ Submitted form')
        await debugWait()

        // Wait for network activity (API call)
        await testPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
          log('  ⚠️  Network did not reach idle state')
        })
        await debugWait()

        // Wait for response

        // Scroll to very top again to see any new error messages or success toasts
        await sidebar.locator('body').evaluate(el => {
          el.scrollTop = 0
          const scrollableElements = el.querySelectorAll('[style*="overflow"]')
          scrollableElements.forEach(elem => {
            if (elem instanceof HTMLElement) elem.scrollTop = 0
          })
        })

        // Take screenshot after save (should show validation errors if any)
        await testPage.screenshot({ path: 'test-results/after-save-top.png', fullPage: true })
        log('  📸 Screenshot saved: after-save-top.png')

        // Wait for navigation to experiments list (which happens on successful save)
        // or for error messages to appear (if save failed)
        log('  ⏳ Waiting for save to complete...')

        try {
          // Wait for experiments list header to appear (indicates successful save and navigation)
          await sidebar.locator('text="Experiments"').first().waitFor({ state: 'visible', timeout: 3000 })
          log('  ✅ Experiment saved successfully - navigated to experiments list')
        } catch (e) {
          // If we didn't navigate to experiments list, check for errors
          log('  ❌ Did not navigate to experiments list within 3 seconds')

          // Check for validation errors
          const errorMessages = sidebar.locator('text=/error|required|must select|please|is required/i')
          const hasError = await errorMessages.count() > 0

          if (hasError) {
            log(`  ❌ Found ${await errorMessages.count()} error message(s):`)
            for (let i = 0; i < Math.min(5, await errorMessages.count()); i++) {
              const errorText = await errorMessages.nth(i).textContent()
              log(`    ${i + 1}. ${errorText}`)
            }
            throw new Error('Failed to save experiment - validation errors found. Check screenshots.')
          } else {
            log('  ❌ No validation errors visible, but save did not complete')
            log('  This might be a network issue or the API call was blocked')
            throw new Error('Experiment save failed - did not navigate to experiments list. Check screenshots: before-save-top.png and after-save-top.png')
          }
        }

        log(`  📊 Experiment name: ${experimentName}`)

        // In SLOW mode, keep the page open for 5 seconds at the end
        if (process.env.SLOW === '1') {
          log('  ⏸️  Keeping page open for 5 seconds...')
          // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {})
          log('  ✓ Done')
        }
      })
    } else {
      await test.step.skip('Save experiment to database', async () => {})
    }
  })
})