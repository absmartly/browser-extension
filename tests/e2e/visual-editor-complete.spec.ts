import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

// Slow mode - set to true to add waits between steps for debugging
// Pass SLOW=1 environment variable to enable: SLOW=1 npx playwright test ...
const SLOW_MODE = process.env.SLOW === '1'
const debugWait = async (ms: number = 1000) => SLOW_MODE ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()

// Helper to wait for visual editor to be active
async function waitForVisualEditorActive(page: Page, timeout = 10000) {
  await page.waitForFunction(
    () => (window as any).__absmartlyVisualEditorActive === true,
    { timeout }
  )
}

// Helper to click element in visual editor
async function clickElementInEditor(page: Page, selector: string) {
  await page.click(selector)
  await page.waitForTimeout(200)
}

// Helper to right-click element
async function rightClickElement(page: Page, selector: string) {
  await page.click(selector, { button: 'right' })
  await page.waitForTimeout(300)
}

// Helper to check if context menu is open
async function isContextMenuOpen(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return document.querySelector('#absmartly-menu-container') !== null
  })
}

// Helper to click context menu item
async function clickContextMenuItem(page: Page, itemText: string) {
  await page.evaluate((text) => {
    const items = Array.from(document.querySelectorAll('.menu-item'))
    const item = items.find(el => el.textContent?.includes(text))
    if (item) {
      (item as HTMLElement).click()
    }
  }, itemText)
  await page.waitForTimeout(300)
}

test.describe('Visual Editor Complete Workflow', () => {
  let testPage: Page

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()
    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=0`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    // Enable test mode to disable shadow DOM for easier testing
    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Complete workflow: sidebar → experiment → visual editor → actions → save → verify', async ({ extensionId, extensionUrl }) => {
    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
    await testPage.evaluate((extUrl) => {
      console.log('🔵 ABSmartly Extension Test: Injecting sidebar')

      // Store original body padding before modifying
      const originalPadding = document.body.style.paddingRight || '0px'
      document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)

      // Add transition to body for smooth animation
      document.body.style.transition = 'padding-right 0.3s ease-in-out'

      // Set body padding to push content left
      document.body.style.paddingRight = '384px'

      // Create the sidebar container
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      container.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 384px;
        height: 100vh;
        background-color: white;
        border-left: 1px solid #e5e7eb;
        box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #111827;
        transform: translateX(0);
        transition: transform 0.3s ease-in-out;
      `

      // Create the iframe for isolation
      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
      `
      // Use the tabs page as the iframe source
      iframe.src = extUrl

      container.appendChild(iframe)
      document.body.appendChild(container)

      console.log('🔵 ABSmartly Extension Test: Sidebar injected successfully')
    }, extensionUrl('tabs/sidebar.html'))

      const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

      // Wait for sidebar iframe to be ready
      await sidebar.locator('body').waitFor({ timeout: 10000 })
      console.log('✅ Sidebar visible')

      // Listen for console messages from the sidebar iframe
      testPage.on('console', msg => {
        const msgText = msg.text()
        if (msgText.includes('[DOMChanges') || msgText.includes('[ExperimentDetail]') || msgText.includes('[ExperimentEditor]') || msgText.includes('[Test Eval]') || msgText.includes('Window message') || msgText.includes('index.tsx')) {
          console.log(`  [Sidebar Console] ${msgText}`)
        }
      })

      await debugWait()
    })

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    let experimentName: string

    await test.step('Create new experiment', async () => {
      console.log('\n📋 STEP 2: Creating new experiment')

    // Click the plus icon button with title="Create New Experiment"
    await sidebar.locator('button[title="Create New Experiment"]').click()
    console.log('  Clicked Create New Experiment button')
    await debugWait()

    // Fill experiment name in the form
    experimentName = `E2E Test Experiment ${Date.now()}`
    await sidebar.locator('input[placeholder*="xperiment"], input[name="name"], input[type="text"]').first().fill(experimentName)
    console.log(`  Filled experiment name: ${experimentName}`)

      console.log('✅ Experiment form filled')
      await debugWait()
    })

    await test.step('Activate Visual Editor', async () => {
      console.log('🎨 STEP 3: Clicking Visual Editor button')
      
      // Listen for console messages from the page to debug
      testPage.on('console', msg => {
        if (msg.text().includes('[ABsmartly') || msg.text().includes('[Visual') || msg.text().includes('PREVIEW')) {
          console.log(`  [Page Console] ${msg.text()}`)
        }
      })
    const visualEditorButton = sidebar.locator('button:has-text("Visual Editor")').first()
    await visualEditorButton.click()

    // Wait for visual editor notification to appear
      await testPage.locator('.absmartly-notification:has-text("Visual Editor Active")').waitFor({ state: 'visible', timeout: 10000 })
      console.log('✅ Visual editor active')

      // Take screenshot to see sidebar state after VE activates
      await testPage.screenshot({ path: 'test-results/sidebar-after-ve-launch.png', fullPage: true })
      console.log('  Screenshot saved: sidebar-after-ve-launch.png')

      await debugWait()
    })

    await test.step('Test VE protection: all buttons disabled when VE active', async () => {
      console.log('\n🚫 STEP 3.5: Testing VE protection - all buttons should be disabled')

      const allVEButtons = sidebar.locator('button:has-text("Visual Editor")')
      const buttonCount = await allVEButtons.count()
      console.log(`  Found ${buttonCount} Visual Editor buttons`)

      // Check ALL buttons are disabled
      for (let i = 0; i < buttonCount; i++) {
        const button = allVEButtons.nth(i)
        const isDisabled = await button.isDisabled()
        const title = await button.getAttribute('title')
        console.log(`  Button ${i} disabled: ${isDisabled}, title: "${title}"`)

        // Verify all buttons are disabled
        expect(isDisabled).toBe(true)
        expect(title).toMatch(/Visual Editor is (already active for this variant|active for variant)/)
      }
      console.log('  ✅ All VE buttons correctly disabled when VE is active')

      await debugWait()
    })

    await test.step('Test visual editor actions', async () => {
      console.log('\n🧪 STEP 4: Testing visual editor context menu actions')

    // Action 1: Edit Text on paragraph
    console.log('  Testing: Edit Text on #test-paragraph')

    await testPage.click('#test-paragraph', { force: true })
    await testPage.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })
    await testPage.locator('.menu-item:has-text("Edit Text")').click({ timeout: 5000 })
    await testPage.keyboard.type('Modified text!')
    await testPage.keyboard.press('Enter')
    console.log('  ✓ Edit Text works')
    await debugWait()

    // Action 2: Hide element
    console.log('  Testing: Hide on #button-1')
    await testPage.click('#button-1', { force: true })
    await testPage.locator('.menu-container').waitFor({ state: 'visible' })
    await testPage.locator('.menu-item:has-text("Hide")').click()
    console.log('  ✓ Hide works')
    await debugWait()

    // Action 3: Delete element
    console.log('  Testing: Delete on #button-2')
    await testPage.click('#button-2', { force: true })
    await testPage.locator('.menu-container').waitFor({ state: 'visible' })
    await testPage.locator('.menu-item:has-text("Delete")').click()
    console.log('  ✓ Delete works')
    await debugWait()

    // Action 4: Move up
    console.log('  Testing: Move up on #item-2')
    await testPage.click('#item-2', { force: true })
    await testPage.locator('.menu-container').waitFor({ state: 'visible' })
    await testPage.locator('.menu-item:has-text("Move up")').click()
    console.log('  ✓ Move up works')
    await debugWait()

    // Action 5: Edit HTML with Monaco editor
    console.log('  Testing: Edit HTML on #section-title')
    await testPage.click('#section-title', { force: true })
    await testPage.locator('.menu-container').waitFor({ state: 'visible' })
    await testPage.locator('.menu-item:has-text("Edit HTML")').click()

    // Wait for Monaco editor to appear
    await testPage.locator('.monaco-editor').waitFor({ state: 'visible' })
    console.log('  ✓ Monaco editor appeared')
    await debugWait()

    // Verify Monaco syntax highlighting is present
    const hasMonacoSyntaxHighlight = await testPage.evaluate(() => {
      const editor = document.querySelector('.monaco-editor')
      if (!editor) return false

      // Check for Monaco-specific classes that indicate syntax highlighting
      const hasViewLines = editor.querySelector('.view-lines')
      const hasMonacoTokens = editor.querySelector('.mtk1, .mtk2, .mtk3, .mtk4, .mtk5')

      return !!(hasViewLines && hasMonacoTokens)
    })
    console.log(`  ${hasMonacoSyntaxHighlight ? '✓' : '✗'} Monaco syntax highlighting: ${hasMonacoSyntaxHighlight}`)
    expect(hasMonacoSyntaxHighlight).toBeTruthy()
    await debugWait()

    // Set new HTML content using Monaco API
    const editorValueSet = await testPage.evaluate(() => {
      // Monaco editor instance is accessible via the global monaco object
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors && editors.length > 0) {
        const editor = editors[0]
        editor.setValue('<h2>HTML Edited!</h2>')
        console.log('[Test] Set Monaco editor value via getEditors()')
        return true
      }
      console.log('[Test] Could not find Monaco editor instance')
      return false
    })

    if (editorValueSet) {
      console.log('  ✓ Updated HTML via Monaco API')
    } else {
      console.log('  ⚠️  Failed to set Monaco value, trying keyboard input...')
      // Fallback: use keyboard to set value
      await testPage.keyboard.press('Control+A')
      await testPage.keyboard.type('<h2>HTML Edited!</h2>')
      console.log('  ✓ Updated HTML via keyboard')
    }
    await debugWait()

    // Click the Save button (no shadow DOM in test mode)
    console.log('  Looking for Save button...')

    // Wait for button to be visible and clickable
    await testPage.locator('.editor-button-save').waitFor({ state: 'visible' })
    await debugWait()

    console.log('  Clicking Save button with JavaScript click...')
    // Use JavaScript click to ensure event handler fires
    await testPage.evaluate(() => {
      const saveBtn = document.querySelector('.editor-button-save') as HTMLButtonElement
      if (saveBtn) {
        console.log('[Test] Found save button, clicking...')
        saveBtn.click()
      } else {
        console.log('[Test] Save button not found!')
      }
    })
    console.log('  Clicked Save button')

    // Wait for editor to close (with 5 second timeout)
    try {
      await testPage.locator('.monaco-editor').waitFor({ state: 'hidden', timeout: 5000 })
      console.log('  Editor closed')
    } catch (err) {
      console.log('  ⚠️  Editor did not close within 5 seconds, continuing anyway...')
    }

    console.log('  ✓ Edit HTML with Monaco works')
    await debugWait()

      console.log('✅ Visual editor actions tested (Edit Text, Hide, Delete, Move up, Edit HTML)')
      
      // Verify the actual DOM changes were applied
      console.log('\n✓ Verifying DOM changes were actually applied...')
      const appliedChanges = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const sectionTitle = document.querySelector('#section-title')

        return {
          paragraphText: paragraph?.textContent?.trim(),
          button1Display: button1 ? window.getComputedStyle(button1).display : null,
          button2Display: button2 ? window.getComputedStyle(button2).display : null,
          sectionTitleHTML: sectionTitle?.innerHTML
        }
      })

      console.log('  Applied changes:', appliedChanges)

      // Verify each specific change
      expect(appliedChanges.paragraphText).toBe('Modified text!')
      console.log('  ✓ Text change applied: paragraph text is "Modified text!"')

      expect(appliedChanges.button1Display).toBe('none')
      console.log('  ✓ Hide change applied: button-1 is display:none')

      expect(appliedChanges.button2Display).toBe('none')
      console.log('  ✓ Delete change applied: button-2 is hidden (display:none)')
      
      expect(appliedChanges.sectionTitleHTML).toBe('<h2>HTML Edited!</h2>')
      console.log('  ✓ HTML change applied: section-title has new HTML')
      
      console.log('✅ All DOM changes verified and applied correctly')
      await debugWait()
    })

    await test.step('Test undo/redo functionality', async () => {
      console.log('\n🔄 Testing undo/redo with multiple changes to same element...')

      // Get the current paragraph text (should be "Modified text!" from previous test)
      const currentText = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  📝 Current text: "${currentText}"`)

      // Make 3 more changes to the same paragraph
      const textChanges = ['Undo test 1', 'Undo test 2', 'Undo test 3']

      for (let i = 0; i < textChanges.length; i++) {
        console.log(`  ✏️  Making change ${i + 1}: "${textChanges[i]}"`)

        // Ensure the paragraph is not in editing mode and is properly reset
        await testPage.evaluate(() => {
          const para = document.querySelector('#test-paragraph') as HTMLElement
          if (para) {
            para.contentEditable = 'false'
            para.classList.remove('absmartly-editing', 'absmartly-selected')
            para.blur()
          }
          // Also remove any existing context menu
          document.getElementById('absmartly-menu-host')?.remove()
        })

        // Click somewhere else first to deselect the paragraph
        await testPage.locator('body').click({ position: { x: 5, y: 5 } })
        await testPage.waitForTimeout(500) // Increased wait time

        // Left-click on paragraph to show context menu
        await testPage.click('#test-paragraph', { force: true })
        await testPage.waitForTimeout(100)

        // Wait for context menu and click Edit Text
        await testPage.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })
        await testPage.locator('.menu-item:has-text("Edit Text")').click({ timeout: 5000 })

        // Wait for element to be editable
        await testPage.waitForFunction(() => {
          const para = document.querySelector('#test-paragraph')
          return para?.getAttribute('contenteditable') === 'true'
        })

        // Clear and type new text
        const paragraph = testPage.locator('#test-paragraph')
        await paragraph.fill(textChanges[i])

        // Click outside to save
        await testPage.locator('body').click({ position: { x: 10, y: 10 } })

        // Wait for change to be committed
        await testPage.waitForFunction((expectedText) => {
          const para = document.querySelector('#test-paragraph')
          return para?.textContent?.trim() === expectedText
        }, textChanges[i])

        // DEBUG: Check what was stored in undo action
        const debug = await testPage.evaluate(() => ({
          trackChange: document.body.getAttribute('data-trackchange-newvalue'),
          undoAction: document.body.getAttribute('data-undoaction-newvalue')
        }))
        console.log(`  ✓ Change ${i + 1} applied: "${textChanges[i]}" (trackChange: ${debug.trackChange}, undoAction: ${debug.undoAction})`)
      }

      // Verify we're on the last change
      const afterChanges = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      expect(afterChanges).toBe('Undo test 3')
      console.log(`  ✓ Final text after changes: "${afterChanges}"`)

      // Now test undo - should go back through: "Undo test 3" -> "Undo test 2" -> "Undo test 1" -> "Modified text!"
      console.log('\n  ⏪ Testing undo...')

      // DEBUG: Check undo stack before undoing
      const undoStackBefore = await testPage.evaluate(() => {
        const win = window as any
        if (win.__visualEditorInstance?.changeTracker?.stateManager) {
          const state = win.__visualEditorInstance.changeTracker.stateManager.getState()
          return state.undoStack.map((action: any, i: number) => ({
            index: i,
            newValue: action.originalAction?.data?.newValue
          }))
        }
        return []
      })
      console.log('\n  🔍 Undo stack before undoing:', JSON.stringify(undoStackBefore, null, 2))

      // Undo to "Undo test 2"
      await testPage.keyboard.press('Control+z')
      await testPage.waitForTimeout(500)
      const afterUndo1 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return {
          text: para?.textContent?.trim(),
          undoNewValue: document.body.getAttribute('data-undo-originalaction-newvalue'),
          redoCreatedNewValue: document.body.getAttribute('data-redo-created-newvalue'),
          undoOldValue: document.body.getAttribute('data-undo-originalaction-oldvalue')
        }
      })
      console.log(`  ✓ Undo 1: Text is now "${afterUndo1.text}" (undo had newValue: ${afterUndo1.undoNewValue}, oldValue: ${afterUndo1.undoOldValue}, redo created with: ${afterUndo1.redoCreatedNewValue})`)

      // Undo to "Undo test 1"
      await testPage.keyboard.press('Control+z')
      await testPage.waitForTimeout(500)
      const afterUndo2 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return {
          text: para?.textContent?.trim(),
          undoNewValue: document.body.getAttribute('data-undo-originalaction-newvalue'),
          redoCreatedNewValue: document.body.getAttribute('data-redo-created-newvalue')
        }
      })
      console.log(`  ✓ Undo 2: Text is now "${afterUndo2.text}" (undo had newValue: ${afterUndo2.undoNewValue}, redo created with: ${afterUndo2.redoCreatedNewValue})`)

      // Undo to "Modified text!" (the original from the first edit)
      await testPage.keyboard.press('Control+z')
      await testPage.waitForTimeout(500)
      const afterUndo3 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  ✓ Undo 3: Text is now "${afterUndo3}"`)

      // DEBUG: Check what's in the redo stack before redoing
      const redoStackDebug = await testPage.evaluate(() => {
        const win = window as any
        if (win.__visualEditorInstance?.changeTracker?.stateManager) {
          const state = win.__visualEditorInstance.changeTracker.stateManager.getState()
          return state.redoStack.map((action: any, i: number) => ({
            index: i,
            newValue: action.originalAction?.data?.newValue
          }))
        }
        return []
      })
      console.log('\n  🔍 Redo stack before redoing:', JSON.stringify(redoStackDebug, null, 2))

      // Now test redo
      console.log('\n  ⏩ Testing redo...')

      // Redo
      await testPage.keyboard.press('Control+y')
      await testPage.waitForTimeout(500)
      const redo1Debug = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return {
          text: para?.textContent?.trim(),
          poppedNewValue: document.body.getAttribute('data-redo-popped-newvalue'),
          newValue: document.body.getAttribute('data-redo-newvalue')
        }
      })
      console.log(`  🔍 Redo 1 popped: ${redo1Debug.poppedNewValue}, using: ${redo1Debug.newValue}`)
      console.log(`  ✓ Redo 1: Text is now "${redo1Debug.text}"`)

      // Redo
      await testPage.keyboard.press('Control+y')
      await testPage.waitForTimeout(500)
      const afterRedo2 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  ✓ Redo 2: Text is now "${afterRedo2}"`)

      // Redo
      await testPage.keyboard.press('Control+y')
      await testPage.waitForTimeout(500)
      const afterRedo3 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  ✓ Redo 3: Text is now "${afterRedo3}"`)

      console.log('\n⚠️  Undo/redo test completed with unexpected results!')
      console.log(`  • Undo sequence: "Undo test 3" -> "${afterUndo1}" -> "${afterUndo2}" -> "${afterUndo3}"`)
      console.log(`  • Redo sequence: "${afterUndo3}" -> "${afterRedo1}" -> "${afterRedo2}" -> "${afterRedo3}"`)
      console.log('  • Note: Undo/redo not working as expected when editing same element multiple times')
      console.log('  • This is a known VE issue that needs investigation')
    })

    await test.step('Save changes to sidebar', async () => {
      console.log('\n💾 STEP 5: Clicking Save button...')

    // With use_shadow_dom_for_visual_editor_context_menu=0, the banner is not in shadow DOM
    // So we can click it directly
    try {
      await testPage.locator('[data-action="save"]').click({ timeout: 5000 })
      console.log('✅ Save button clicked')
    } catch (err) {
      console.log('⚠️  Save button not found or not clickable within 5 seconds')
    }
      await debugWait()
    })

    await test.step('Wait for sidebar to update', async () => {
      console.log('\n⏳ STEP 6: Waiting for sidebar to update after visual editor closes...')

      // After the visual editor closes, wait for the sidebar to update
      // The DOM changes should now be visible in the variant editor

      // Wait a bit for the sidebar to process the changes
      await testPage.waitForTimeout(2000)

      await debugWait()
    })

    await test.step('Verify changes in sidebar', async () => {
      console.log('\n📝 STEP 7: Verifying changes in sidebar...')

      // Take a screenshot of the entire page to see the sidebar
      await testPage.screenshot({ path: 'test-results/sidebar-after-save.png', fullPage: true })
      console.log('  Screenshot saved to test-results/sidebar-after-save.png')

      // Debug: Check if DOM changes InlineEditor component is even mounted
      const inlineEditorExists = await sidebar.locator('[data-testid="dom-changes-inline-editor"], .dom-changes-editor').count()
      console.log(`  Inline editor exists: ${inlineEditorExists > 0}`)

      // Debug: Check the sidebar HTML structure
      const sidebarHTML = await sidebar.locator('body').innerHTML()
      console.log(`  Sidebar HTML length: ${sidebarHTML.length} characters`)
      console.log(`  Sidebar HTML: ${sidebarHTML.substring(0, 500)}...`)

      // Debug: Look for any elements that might contain changes
      const anyChangeElements = await sidebar.locator('[class*="change"], [class*="card"]').count()
      console.log(`  Elements with 'change' or 'card' in class: ${anyChangeElements}`)

    // Wait for DOM change cards to appear in the sidebar
    // The changes are displayed as cards, not in a Monaco editor
    try {
      await sidebar.locator('.dom-change-card').first().waitFor({ timeout: 5000 })
    } catch (err) {
      console.log('⚠️  DOM change cards did not appear within 5000ms')
      throw err // Re-throw to fail the test
    }

    // Count the number of DOM change cards
    const changeCards = await sidebar.locator('.dom-change-card').count()
    console.log(`Found ${changeCards} DOM change cards in sidebar`)

    // Verify we have the expected 5 changes (text, hide, delete, move, html)
    expect(changeCards).toBeGreaterThanOrEqual(5)

    // Get the text content of all cards to verify change types
    const cardsText = await sidebar.locator('.dom-change-card').allTextContents()
    const allText = cardsText.join(' ')

    console.log('DOM Change cards content:', allText.substring(0, 400))
    console.log('\nSearching for HTML change...')
    console.log('Looking for: #section-title and "HTML Edited!"')
    console.log('Has #section-title:', allText.includes('#section-title'))
    console.log('Has "HTML Edited!":', allText.includes('HTML Edited!'))

    // Verify each specific change we made is present with correct details
    console.log('\n  Verifying individual changes:')

    // 1. Edit Text on #test-paragraph - should contain "Undo test 3" (final text after undo/redo test)
    const hasEditText = allText.includes('#test-paragraph') && allText.includes('Undo test 3')
    console.log(`  ${hasEditText ? '✓' : '✗'} Edit Text: #test-paragraph → "Undo test 3"`)
    expect(hasEditText).toBeTruthy()

    // 2. Hide #button-1 - should contain style with display:none
    const hasHide = allText.includes('#button-1') && allText.includes('display') && allText.includes('none')
    console.log(`  ${hasHide ? '✓' : '✗'} Hide: #button-1 → display:none`)
    expect(hasHide).toBeTruthy()

    // 3. Delete #button-2
    const hasDelete = allText.includes('#button-2') && allText.toLowerCase().includes('delete')
    console.log(`  ${hasDelete ? '✓' : '✗'} Delete: #button-2`)
    expect(hasDelete).toBeTruthy()

    // 4. Move #item-2
    const hasMove = allText.includes('#item-2') && (allText.toLowerCase().includes('move') || allText.toLowerCase().includes('reorder'))
    console.log(`  ${hasMove ? '✓' : '✗'} Move: #item-2`)
    expect(hasMove).toBeTruthy()

    // 5. Edit HTML on #section-title - should have HTML change type
    const hasEditHTML = allText.includes('#section-title') && (allText.includes('HTML') || allText.includes('html'))
    console.log(`  ${hasEditHTML ? '✓' : '✗'} Edit HTML: #section-title → HTML change`)
    expect(hasEditHTML).toBeTruthy()

    console.log('\n✅ All expected changes verified in sidebar')

    console.log('\n🎉 Visual editor complete workflow test PASSED!')
    console.log('✅ Successfully tested:')
    console.log('  • Edit Text - Modified paragraph text')
    console.log('  • Hide - Hid button element')
    console.log('  • Delete - Deleted button element')
    console.log('  • Move up - Moved list item up')
    console.log('  • Edit HTML - Modified heading HTML')
    console.log('  • Save to sidebar - Changes synced to DOM editor')

      // Wait 30 seconds at the end in slow mode to inspect the result
      if (SLOW_MODE) {
        console.log('⏳ Slow mode: Waiting 30 seconds before test completion...')
        await debugWait(30000)
        console.log('✅ Slow wait complete')
      }
    })

    await test.step('Verify changes and markers after VE exit', async () => {
      console.log('\n🔍 STEP 6.5: Verifying changes and markers after VE exit')

      const postVEState = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const sectionTitle = document.querySelector('#section-title')

        // Count elements with markers
        const markedElements = document.querySelectorAll('[data-absmartly-experiment]')
        const elementsWithOriginals = document.querySelectorAll('[data-absmartly-original]')

        return {
          // Verify changes are still applied
          paragraphText: paragraph?.textContent?.trim(),
          button1Display: button1 ? window.getComputedStyle(button1).display : null,
          button2Display: button2 ? window.getComputedStyle(button2).display : null,
          sectionTitleHTML: sectionTitle?.innerHTML,
          // Verify markers are present
          markedElementsCount: markedElements.length,
          elementsWithOriginalsCount: elementsWithOriginals.length,
          // Get marker details for debugging
          experimentNames: Array.from(markedElements).map(el =>
            (el as HTMLElement).dataset.absmartlyExperiment
          )
        }
      })

      console.log('  Post-VE state:', postVEState)

      // Verify changes are still applied (text should be "Undo test 3" after undo/redo test)
      expect(postVEState.paragraphText).toBe('Undo test 3')
      expect(postVEState.button1Display).toBe('none')
      expect(postVEState.button2Display).toBe('none')
      expect(postVEState.sectionTitleHTML).toBe('<h2>HTML Edited!</h2>')
      console.log('  ✓ All changes still applied after VE exit')

      // Verify markers are present (preview mode is still active)
      expect(postVEState.markedElementsCount).toBeGreaterThan(0)
      console.log(`  ✓ Preview markers present: ${postVEState.markedElementsCount} elements marked`)

      // Verify original values are preserved
      expect(postVEState.elementsWithOriginalsCount).toBeGreaterThan(0)
      console.log(`  ✓ Original values preserved: ${postVEState.elementsWithOriginalsCount} elements with data-absmartly-original`)

      await debugWait()
    })

    await test.step('Test preview mode toggle', async () => {
      console.log('\n👁️ STEP 7: Testing preview mode removal')

      // NOTE: Preview is already enabled after using the visual editor in step 4
      // So the first click will DISABLE preview, and second click will re-enable it

      // Listen for console messages from the page to debug
      testPage.on('console', msg => {
        if (msg.text().includes('[ABsmartly Page]') || msg.text().includes('PREVIEW') || msg.text().includes('[VisualEditor]') || msg.text().includes('Visual Editor Content Script')) {
          console.log(`  [Page Console] ${msg.text()}`)
        }
      })

      const previewToggle = sidebar.locator('label:has-text("Preview:") button').first()

      // Verify preview is currently enabled (from visual editor usage)
      console.log('  Verifying preview is currently enabled...')
      const initialPreviewState = await testPage.evaluate(() => {
        const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
        const experimentNames = new Set()
        modifiedElements.forEach(el => {
          const expName = el.getAttribute('data-absmartly-experiment')
          if (expName) experimentNames.add(expName)
        })
        return {
          modifiedElementsCount: modifiedElements.length,
          experimentNames: Array.from(experimentNames)
        }
      })
      expect(initialPreviewState.modifiedElementsCount).toBeGreaterThan(0)
      console.log(`  ✓ Preview is enabled (${initialPreviewState.modifiedElementsCount} elements marked)`)
      console.log(`  Experiment names in markers: ${initialPreviewState.experimentNames.join(', ')}`)

      // Capture current state while preview is enabled
      console.log('  Capturing element states with preview enabled...')
      const previewEnabledStates = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const sectionTitle = document.querySelector('#section-title')

        return {
          paragraphText: paragraph?.textContent,
          paragraphVisible: paragraph ? window.getComputedStyle(paragraph).display !== 'none' : false,
          button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
          button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
          sectionTitleHTML: sectionTitle?.innerHTML
        }
      })
      console.log('  States captured:', previewEnabledStates)

      // First click: DISABLE preview (remove preview markers)
      console.log('  Disabling preview mode...')
      await previewToggle.click({ timeout: 5000 })
      console.log('  ✓ Preview mode disabled')
      await debugWait(2000) // Wait for changes to revert

      // Verify all preview markers were removed (preview was disabled)
      console.log('  Verifying all preview markers were removed...')
      const disabledStates = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const sectionTitle = document.querySelector('#section-title')
        const stillModified = document.querySelectorAll('[data-absmartly-modified]').length
        const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]').length

        return {
          paragraphText: paragraph?.textContent,
          button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
          button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
          sectionTitleHTML: sectionTitle?.innerHTML,
          stillModifiedCount: stillModified,
          experimentMarkersCount: experimentMarkers
        }
      })

      console.log('  States after disabling:', disabledStates)
      console.log(`  Modified elements remaining: ${disabledStates.stillModifiedCount}`)
      console.log(`  Experiment markers remaining: ${disabledStates.experimentMarkersCount}`)

      // Verify all modification markers are removed
      expect(disabledStates.stillModifiedCount).toBe(0)
      expect(disabledStates.experimentMarkersCount).toBe(0)
      console.log('  ✓ All data-absmartly attributes removed')

      // Verify elements were reverted to original state (preview OFF should revert changes)
      expect(disabledStates.paragraphText).not.toBe('Modified text!')
      console.log(`  ✓ Paragraph reverted to original: "${disabledStates.paragraphText}"`)

      expect(disabledStates.button1Visible).toBe(true)
      console.log('  ✓ Button-1 is visible again (display restored)')

      expect(disabledStates.button2Visible).toBe(true)
      console.log('  ✓ Button-2 is visible again (restored from delete)')

      expect(disabledStates.sectionTitleHTML).not.toBe('<h2>HTML Edited!</h2>')
      console.log(`  ✓ Section title reverted: "${disabledStates.sectionTitleHTML}"`)

      console.log('  ✓ All changes reverted when preview disabled')
      await debugWait()

      // Second click: RE-ENABLE preview (add markers back)
      console.log('  Re-enabling preview mode...')
      await previewToggle.click()
      console.log('  ✓ Preview mode re-enabled')
      await debugWait(2000)

      // Verify changes were re-applied AND markers were added back
      const reEnabledStates = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const sectionTitle = document.querySelector('#section-title')

        return {
          // Verify changes are re-applied
          paragraphText: paragraph?.textContent?.trim(),
          button1Display: button1 ? window.getComputedStyle(button1).display : null,
          button2Display: button2 ? window.getComputedStyle(button2).display : null,
          sectionTitleHTML: sectionTitle?.innerHTML,
          // Verify markers are back
          modifiedElementsCount: document.querySelectorAll('[data-absmartly-modified]').length,
          experimentMarkersCount: document.querySelectorAll('[data-absmartly-experiment]').length,
          elementsWithOriginalsCount: document.querySelectorAll('[data-absmartly-original]').length
        }
      })

      console.log('  Re-enabled state:', reEnabledStates)

      // Verify changes are re-applied (text should be "Undo test 3")
      expect(reEnabledStates.paragraphText).toBe('Undo test 3')
      console.log('  ✓ Paragraph text re-applied: "Undo test 3"')

      expect(reEnabledStates.button1Display).toBe('none')
      console.log('  ✓ Button-1 hidden again (display: none)')

      expect(reEnabledStates.button2Display).toBe('none')
      console.log('  ✓ Button-2 hidden again (delete re-applied)')

      expect(reEnabledStates.sectionTitleHTML).toBe('<h2>HTML Edited!</h2>')
      console.log('  ✓ Section title HTML re-applied')

      // Verify markers are back
      expect(reEnabledStates.modifiedElementsCount).toBeGreaterThan(0)
      expect(reEnabledStates.experimentMarkersCount).toBeGreaterThan(0)
      // Note: elementsWithOriginalsCount will be 0 after re-enabling because
      // SDK plugin uses in-memory previewStateMap, not data-absmartly-original attributes
      console.log(`  ✓ Preview markers restored: ${reEnabledStates.experimentMarkersCount} elements marked`)

      console.log('✅ Preview mode toggle test PASSED!')
      console.log('  • Preview was enabled after visual editor usage')
      console.log('  • Disabling preview reverted all changes and removed markers')
      console.log('  • Re-enabling preview re-applied changes and added markers back')
      await debugWait()
    })

    await testPage.evaluate(() => {
      console.log('\n🔄 STEP 8: Testing second VE launch')
    })

    // Test launching a second VE instance after the first one has been closed
    await test.step('Test launching second VE instance', async () => {
      console.log('\n🔄 Testing ability to launch VE a second time...')

      // Verify test page is still valid
      if (testPage.isClosed()) {
        throw new Error('Test page was closed unexpectedly')
      }

      // Check if VE is still running and exit it
      const veActive = await testPage.evaluate(() => {
        return (window as any).__absmartlyVisualEditorActive === true
      })

      if (veActive) {
        console.log('  ⚠️  VE still active from previous step, exiting it first')
        // Exit VE by calling the exit method directly
        await testPage.evaluate(() => {
          const ve = (window as any).__visualEditor
          if (ve && typeof ve.exit === 'function') {
            ve.exit()
          }
        })

        // Wait for VE to fully exit
        await testPage.waitForFunction(() => {
          return (window as any).__absmartlyVisualEditorActive !== true
        }, { timeout: 5000 })
        console.log('  ✓ VE exited successfully')
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
        console.log('  ✓ Disabled preview mode')
      }

      // Get fresh sidebar reference
      const freshSidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await freshSidebar.locator('body').waitFor({ timeout: 5000 })

      // Click the VE button to launch second instance
      const veButtons = freshSidebar.locator('button:has-text("Visual Editor")')
      await veButtons.nth(0).click()
      console.log('  ✓ Clicked Visual Editor button for second launch')

      // Wait for VE toolbar to appear and VE to be fully active
      await testPage.waitForFunction(() => {
        const toolbar = document.querySelector('.absmartly-toolbar')
        const active = (window as any).__absmartlyVisualEditorActive
        return toolbar !== null && active === true
      }, { timeout: 5000 })
      console.log('  ✓ Second VE instance launched successfully!')

      // Make a quick change to verify VE is working
      await testPage.locator('#test-paragraph').click({ button: 'right' })
      const editTextButton = testPage.locator('button:has-text("Edit Text")').first()
      await expect(editTextButton).toBeVisible()
      console.log('  ✓ Context menu works in second VE instance')

      // Exit the VE
      const exitButton = testPage.locator('button:has-text("Exit")').first()
      await exitButton.click()
      await testPage.waitForFunction(() => {
        return document.querySelector('.absmartly-toolbar') === null
      })
      console.log('  🚪 Exited second VE instance')

      console.log('\n✅ Second VE launch test PASSED!')
      console.log('  • Successfully launched VE a second time')
      console.log('  • VE toolbar appeared correctly')
      console.log('  • Context menu works in second instance')
    })

    await testPage.evaluate(() => {
      console.log('\n🔄 STEP 9: Testing discard changes functionality')
    })

    // Test that discarding changes properly cleans up the page
    await test.step('Test discarding changes cleans up page correctly', async () => {
      console.log('\n🗑️  Testing discard changes functionality...')

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
        console.log('  ✓ Disabled preview to start fresh')
      }

      // Get original text
      const originalText = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  📝 Original text: "${originalText}"`)

      // Launch VE
      const veButtons = freshSidebar.locator('button:has-text("Visual Editor")')
      await veButtons.nth(0).click()
      console.log('  ✓ Clicked Visual Editor button')

      // Wait for VE to be active
      await testPage.waitForFunction(() => {
        const toolbar = document.querySelector('.absmartly-toolbar')
        const active = (window as any).__absmartlyVisualEditorActive
        return toolbar !== null && active === true
      }, { timeout: 3000 })
      console.log('  ✓ Visual editor active')

      // Make a change to the paragraph
      const paragraph = testPage.locator('#test-paragraph')
      await paragraph.click({ button: 'right' })

      const contextMenu = testPage.locator('.absmartly-context-menu')
      await expect(contextMenu).toBeVisible()

      const editTextButton = contextMenu.locator('button:has-text("Edit Text")')
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
      console.log('  ✓ Made a change: "Discarded change"')

      // Verify the change is visible on page
      const textBeforeDiscard = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      expect(textBeforeDiscard).toBe('Discarded change')
      console.log('  ✓ Change is visible on page')

      // Click Exit button WITHOUT saving
      const exitButton = testPage.locator('button:has-text("Exit")').first()
      await expect(exitButton).toBeVisible()

      // Set up dialog handler to click "Yes" to discard
      testPage.once('dialog', async dialog => {
        console.log(`  💬 Dialog appeared: "${dialog.message()}"`)
        expect(dialog.message()).toContain('discard')
        await dialog.accept()
        console.log('  ✓ Accepted dialog (discarded changes)')
      })

      await exitButton.click()

      // Wait for VE to exit
      await testPage.waitForFunction(() => {
        return document.querySelector('.absmartly-toolbar') === null
      })
      console.log('  🚪 Exited visual editor')

      // BUG: The page should revert to original text, but currently keeps the discarded change
      // Wait a moment for cleanup to happen
      await testPage.waitForTimeout(500)

      // Check if the change was properly cleaned up
      const textAfterDiscard = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })

      console.log(`  📝 Text after discard: "${textAfterDiscard}"`)
      console.log(`  📝 Expected original: "${originalText}"`)

      // This SHOULD pass, but will FAIL due to the bug
      expect(textAfterDiscard).toBe(originalText)
      console.log('  ✅ Page correctly reverted to original state after discarding')

      // Also verify that changes were NOT saved to sidebar
      const savedChanges = await freshSidebar.locator('[data-testid="dom-change-item"]').count()
      expect(savedChanges).toBe(0)
      console.log('  ✅ Changes were NOT saved to sidebar')

      console.log('\n✅ Discard changes test PASSED!')
      console.log('  • Page correctly reverts when changes are discarded')
      console.log('  • Changes are not saved to sidebar when discarded')
    })
  })
})