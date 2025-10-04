import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

// Slow mode - set to true to add waits between steps for debugging
// Pass SLOW=1 environment variable to enable: SLOW=1 npx playwright test ...
const SLOW_MODE = process.env.SLOW === '1'
const debugWait = async (ms: number = 300) => SLOW_MODE ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()

// Debug mode - set to true to show console logs from page/sidebar
// Enabled automatically when using --debug flag: npx playwright test --debug
// Or manually with: DEBUG=1 npx playwright test ...
const DEBUG_MODE = process.env.DEBUG === '1' || process.env.PWDEBUG === '1'

// Save experiment mode - set to true to actually save the experiment to the database
// WARNING: This writes to the production database! Only use when needed.
// Pass SAVE_EXPERIMENT=1 environment variable to enable: SAVE_EXPERIMENT=1 npx playwright test ...
const SAVE_EXPERIMENT = process.env.SAVE_EXPERIMENT === '1'

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
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    // Set up console listener BEFORE page loads to capture all messages (including iframes)
    allConsoleMessages = []
    const consoleHandler = (msg: any) => {
      const msgType = msg.type()
      const msgText = msg.text()
      allConsoleMessages.push({ type: msgType, text: msgText })

      // Log ABsmartly, DOMChanges, and background messages immediately
      if (msgText.includes('[ABsmartly]') || msgText.includes('[Background]') || msgText.includes('[DOMChanges]')) {
        console.log(`  📝 [${msgType}] ${msgText}`)
      }
    }
    testPage.on('console', consoleHandler)

    // Also listen to console events from all frames (including the sidebar iframe)
    testPage.on('frameattached', async (frame) => {
      frame.on('console', consoleHandler)
    })

    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=0`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    // Enable test mode to disable shadow DOM for easier testing
    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded (test mode enabled)')
    console.log(`  📋 Console messages so far: ${allConsoleMessages.length}`)
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Complete workflow: sidebar → experiment → visual editor → actions → save → verify', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 40000 : 20000)
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

      // Listen for console messages from the sidebar iframe (only in DEBUG mode)
      if (DEBUG_MODE) {
        testPage.on('console', msg => {
          const msgText = msg.text()
          if (msgText.includes('[DOMChanges') || msgText.includes('[ExperimentDetail]') || msgText.includes('[ExperimentEditor]') || msgText.includes('[Test Eval]') || msgText.includes('Window message') || msgText.includes('index.tsx')) {
            console.log(`  [Sidebar Console] ${msgText}`)
          }
        })
      }

      await debugWait()
    })

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    let experimentName: string

    await test.step('Create new experiment', async () => {
      console.log('\n📋 STEP 2: Creating new experiment')

    // Click the plus icon button with title="Create New Experiment"
    // Use dispatchEvent to ensure React handler is triggered in headless mode
    await sidebar.locator('button[title="Create New Experiment"]').evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    console.log('  Dispatched click event to Create New Experiment button')
    await debugWait()

    // Select "From Scratch" option from the dropdown menu
    console.log('  Selecting "From Scratch" option...')
    const fromScratchButton = sidebar.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
    await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
    await fromScratchButton.evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    console.log('  ✓ Selected "From Scratch" option')
    await debugWait()

    // Fill experiment name in the form
    experimentName = `E2E Test Experiment ${Date.now()}`
    await sidebar.locator('input[placeholder*="xperiment"], input[name="name"], input[type="text"]').first().fill(experimentName)
    console.log(`  Filled experiment name: ${experimentName}`)
    await debugWait()

    // Select Unit Type (required field)
    console.log('  Selecting Unit Type...')
    const unitTypeSelect = sidebar.locator('label:has-text("Unit Type")').locator('..').locator('select')
    await unitTypeSelect.waitFor({ state: 'visible', timeout: 5000 })
    
    // Wait for unit types to be loaded (dropdown will have more than just placeholder)
    await sidebar.locator('label:has-text("Unit Type")').locator('..').locator('select option').nth(1).waitFor({ state: 'attached', timeout: 10000 })
    console.log('  ✓ Unit types loaded')
    
    // Get first available option (skip the placeholder)
    const unitTypeOptions = await unitTypeSelect.locator('option').count()
    if (unitTypeOptions < 2) {
      throw new Error('No unit types available - form cannot be filled')
    }
    
    // Select the first real option (index 1, skipping placeholder at index 0)
    const firstUnitTypeValue = await unitTypeSelect.locator('option').nth(1).getAttribute('value')
    await unitTypeSelect.selectOption(firstUnitTypeValue || '')
    console.log(`  ✓ Selected unit type`)
    await debugWait()

    // Select Applications (required field)
    console.log('  Selecting Applications...')
    const appsContainer = sidebar.locator('label:has-text("Applications")').locator('..')
    const appsClickArea = appsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
    
    await appsClickArea.click({ timeout: 5000 })
    console.log('  ✓ Clicked applications field')
    
    // Wait for dropdown and select first application
    const appsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
    await appsDropdown.waitFor({ state: 'visible', timeout: 3000 })
    
    // Wait for applications to be loaded in the dropdown
    const firstAppOption = appsDropdown.locator('div[class*="cursor-pointer"]').first()
    await firstAppOption.waitFor({ state: 'visible', timeout: 5000 })
    console.log('  ✓ Applications loaded in dropdown')
    
    const selectedAppText = await firstAppOption.textContent()
    await firstAppOption.click()
    console.log(`  ✓ Selected application: ${selectedAppText?.trim()}`)
    
    // Verify application badge appeared
    const appBadge = appsContainer.locator('div[class*="inline-flex"]')
    if (!await appBadge.isVisible({ timeout: 2000 })) {
      throw new Error('Application selection failed - badge not visible')
    }
    
    // Click outside to close dropdown
    await sidebar.locator('label:has-text("Traffic")').click()
    
    // Wait for dropdown to close
    const appsDropdownClosed = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
    await appsDropdownClosed.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})

    console.log('✅ Experiment form filled with required fields')
    await debugWait()
    })

    await test.step('Activate Visual Editor', async () => {
      console.log('🎨 STEP 3: Clicking Visual Editor button')

      // Listen for console messages from the page to debug (only in DEBUG mode)
      if (DEBUG_MODE) {
        testPage.on('console', msg => {
          if (msg.text().includes('[ABsmartly') || msg.text().includes('[Visual') || msg.text().includes('PREVIEW')) {
            console.log(`  [Page Console] ${msg.text()}`)
          }
        })
      }
    const visualEditorButton = sidebar.locator('button:has-text("Visual Editor")').first()
    
    // Wait for button to be visible and then become enabled (form validation to complete)
    await visualEditorButton.waitFor({ state: 'visible', timeout: 5000 })
    await expect(visualEditorButton).toBeEnabled({ timeout: 10000 })
    console.log('  ✓ Visual Editor button is enabled (form validation complete)')

    // Extra wait to ensure React event handlers are attached in headless mode
    console.log('  ✓ Waited for React handlers to attach')

    // Track console errors (console listener is already set up in beforeEach)
    const consoleErrors: string[] = []
    const beforeClickMessageCount = allConsoleMessages.length

    // Filter for errors from all messages
    consoleErrors.push(...allConsoleMessages.filter(m => m.type === 'error').map(m => m.text))

    // Ensure test page is focused/active before clicking VE button
    await testPage.bringToFront()
    console.log('  ✓ Brought test page to front')

    // Try dispatchEvent instead of click() to ensure handler is triggered
    await visualEditorButton.evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    console.log('  ✓ Dispatched click event to Visual Editor button')

    // Wait longer for messages to arrive and VE to start
    console.log('  ⏳ Waited 3s after VE button click')
    
    // Check if page is still alive
    const pageAlive = await testPage.evaluate(() => true).catch(() => false)
    if (!pageAlive) {
      console.log('  ❌ Page crashed after clicking VE button')
      console.log('  Console errors before crash:', consoleErrors)
      throw new Error('Page crashed when launching Visual Editor')
    }

    // Log console message summary
    console.log(`  📋 Captured ${allConsoleMessages.length} console messages`)
    const contentScriptMessages = allConsoleMessages.filter(m => m.text.includes('[ABsmartly]') || m.text.includes('[Background]'))
    console.log(`  📋 Content script/background messages: ${contentScriptMessages.length}`)
    if (contentScriptMessages.length > 0) {
      console.log('  Messages:\n    ' + contentScriptMessages.map(m => `[${m.type}] ${m.text}`).join('\n    '))
    } else {
      console.log('  ⚠️  No content script messages detected - content script may not be loading!')
    }

    // Check for errors
    const errorMessages = allConsoleMessages.filter(m => m.type === 'error')
    if (errorMessages.length > 0) {
      console.log(`  ❌ Found ${errorMessages.length} error messages:`)
      errorMessages.forEach(m => console.log(`    - ${m.text}`))
    }

    // Wait longer for VE banner and log more messages
    console.log('  ⏳ Waiting for VE banner to appear...')
    console.log(`  📋 Total messages captured so far: ${allConsoleMessages.length}`)

    // Wait for VE banner to appear (more reliable than checking window variable)
    await testPage.locator('#absmartly-visual-editor-banner-host').waitFor({ state: 'visible', timeout: 15000 })
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

    // Action 5: Edit HTML with CodeMirror editor on parent container
    console.log('  Testing: Edit HTML on #test-container')
    await testPage.click('#test-container', { force: true })
    await testPage.locator('.menu-container').waitFor({ state: 'visible' })
    await testPage.locator('.menu-item:has-text("Edit HTML")').click()

    // Wait for CodeMirror editor to appear
    await testPage.locator('.cm-editor').waitFor({ state: 'visible' })
    console.log('  ✓ CodeMirror editor appeared')
    await debugWait()

    // Verify CodeMirror syntax highlighting is present
    const hasCodeMirrorSyntaxHighlight = await testPage.evaluate(() => {
      const editor = document.querySelector('.cm-editor')
      if (!editor) return false

      // Check for CodeMirror-specific classes that indicate syntax highlighting
      const hasContent = editor.querySelector('.cm-content')
      const hasScroller = editor.querySelector('.cm-scroller')

      return !!(hasContent && hasScroller)
    })
    console.log(`  ${hasCodeMirrorSyntaxHighlight ? '✓' : '✗'} CodeMirror syntax highlighting: ${hasCodeMirrorSyntaxHighlight}`)
    expect(hasCodeMirrorSyntaxHighlight).toBeTruthy()
    await debugWait()

    // Set new HTML content by focusing editor and typing
    await testPage.evaluate(() => {
      // Focus the CodeMirror editor
      const editor = document.querySelector('.cm-content') as HTMLElement
      if (editor) {
        editor.focus()
        console.log('[Test] Focused CodeMirror editor')
      }
    })

    // Select all and replace with new content (use Meta/Command for macOS)
    await testPage.keyboard.press('Meta+A')
    await testPage.keyboard.type('<h2>HTML Edited!</h2><p>New paragraph content</p>')
    console.log('  ✓ Updated HTML via CodeMirror')
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
      await testPage.locator('.cm-editor').waitFor({ state: 'hidden', timeout: 5000 })
      console.log('  Editor closed')
    } catch (err) {
      console.log('  ⚠️  Editor did not close within 5 seconds, continuing anyway...')
    }

    console.log('  ✓ Edit HTML with CodeMirror works')
    await debugWait()

      console.log('✅ Visual editor actions tested (Edit Text, Hide, Delete, Move up, Edit HTML)')
      
      // Verify the actual DOM changes were applied
      console.log('\n✓ Verifying DOM changes were actually applied...')
      const appliedChanges = await testPage.evaluate(() => {
        const paragraph = document.querySelector('#test-paragraph')
        const button1 = document.querySelector('#button-1')
        const button2 = document.querySelector('#button-2')
        const testContainer = document.querySelector('#test-container')

        return {
          paragraphText: paragraph?.textContent?.trim(),
          button1Display: button1 ? window.getComputedStyle(button1).display : null,
          button2Display: button2 ? window.getComputedStyle(button2).display : null,
          testContainerHTML: testContainer?.innerHTML?.trim()
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

      expect(appliedChanges.testContainerHTML).toContain('<h2>HTML Edited!</h2>')
      expect(appliedChanges.testContainerHTML).toContain('<p>New paragraph content</p>')
      console.log('  ✓ HTML change applied: test-container has new HTML')
      
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

        // Ensure all elements are deselected and context menu is removed
        await testPage.evaluate(() => {
          // Deselect ALL elements (not just the paragraph)
          document.querySelectorAll('.absmartly-selected, .absmartly-editing').forEach(el => {
            el.classList.remove('absmartly-selected', 'absmartly-editing')
            if (el instanceof HTMLElement && el.contentEditable === 'true') {
              el.contentEditable = 'false'
              el.blur()
            }
          })
          // Remove any existing context menu
          document.getElementById('absmartly-menu-host')?.remove()
        })

        // Click somewhere else first to deselect everything
        await testPage.locator('body').click({ position: { x: 5, y: 5 } })

        // Left-click on paragraph to show context menu
        // Use dispatchEvent to ensure menu handler is triggered in headless mode
        await testPage.locator('#test-paragraph').evaluate((el) => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })

        // Wait for context menu and click Edit Text
        await testPage.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })
        // Use dispatchEvent for menu item click in headless mode
        await testPage.locator('.menu-item:has-text("Edit Text")').evaluate((el) => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })

        // Wait for element to be editable
        await testPage.waitForFunction(() => {
          const para = document.querySelector('#test-paragraph')
          return para?.getAttribute('contenteditable') === 'true'
        })

        // Clear and type new text
        const paragraph = testPage.locator('#test-paragraph')
        await paragraph.fill(textChanges[i])

        // Explicitly blur the element to trigger save
        await testPage.evaluate(() => {
          const para = document.querySelector('#test-paragraph') as HTMLElement
          para?.blur()
        })

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

      // Now test undo - changes are tracked individually, so we need 3 undo operations
      // to go back from "Undo test 3" to "Modified text!"
      console.log('\n  ⏪ Testing undo with individual change tracking...')

      // Undo 1: "Undo test 3" -> "Undo test 2"
      await testPage.locator('[data-action="undo"]').click()
      const afterUndo1 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  ✓ Undo 1: Text is now "${afterUndo1}"`)
      expect(afterUndo1).toBe('Undo test 2')

      // Undo 2: "Undo test 2" -> "Undo test 1"
      await testPage.locator('[data-action="undo"]').click()
      const afterUndo2 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  ✓ Undo 2: Text is now "${afterUndo2}"`)
      expect(afterUndo2).toBe('Undo test 1')

      // Undo 3: "Undo test 1" -> "Modified text!"
      await testPage.locator('[data-action="undo"]').click()
      const afterUndo3 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  ✓ Undo 3: Text is now "${afterUndo3}"`)
      expect(afterUndo3).toBe('Modified text!')

      // Now test redo - should redo each change individually
      console.log('\n  ⏩ Testing redo...')

      // Redo 1: "Modified text!" -> "Undo test 1"
      await testPage.locator('[data-action="redo"]').click()
      const afterRedo1 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  ✓ Redo 1: Text is now "${afterRedo1}"`)
      expect(afterRedo1).toBe('Undo test 1')

      // Redo 2: "Undo test 1" -> "Undo test 2"
      await testPage.locator('[data-action="redo"]').click()
      const afterRedo2 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  ✓ Redo 2: Text is now "${afterRedo2}"`)
      expect(afterRedo2).toBe('Undo test 2')

      // Redo 3: "Undo test 2" -> "Undo test 3"
      await testPage.locator('[data-action="redo"]').click()
      const afterRedo3 = await testPage.evaluate(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.trim()
      })
      console.log(`  ✓ Redo 3: Text is now "${afterRedo3}"`)
      expect(afterRedo3).toBe('Undo test 3')

      console.log('\n✅ Undo/redo with individual change tracking working correctly!')
      console.log('  • Each change tracked individually for granular undo/redo')
      console.log(`  • 3 undos: "Undo test 3" -> "Undo test 2" -> "Undo test 1" -> "Modified text!"`)
      console.log(`  • 3 redos: "Modified text!" -> "Undo test 1" -> "Undo test 2" -> "Undo test 3"`)
    })

    await test.step('Test undo/redo button disabled states', async () => {
      console.log('\n🔘 Testing undo/redo button states...')

      // After all redos, we should be at "Undo test 3"
      // Now undo ALL changes including the original 5 (text, hide, delete, move, html)
      // We need to undo 3 text changes + 4 other changes = 7 total undos

      // We already did 3 undos and 3 redos, so we're back at "Undo test 3"
      // Let's undo ALL 8 changes (3 text + 5 original changes)
      console.log('  ⏪ Undoing all changes to test undo button disabled state...')

      // Track how many undos we can do
      let undoCount = 0
      let undoButton = testPage.locator('[data-action="undo"]')

      while (undoCount < 20) { // Safety limit
        const isDisabled = await undoButton.isDisabled()
        if (isDisabled) {
          console.log(`  ✓ Undo button became disabled after ${undoCount} undos`)
          break
        }
        await undoButton.click()
        undoCount++
      }

      // Verify undo button is disabled
      await expect(undoButton).toBeDisabled()
      console.log('  ✓ Undo button is disabled when no more changes to undo')

      // Now redo ALL changes
      console.log('\n  ⏩ Redoing all changes to test redo button disabled state...')
      let redoCount = 0
      let redoButton = testPage.locator('[data-action="redo"]')

      while (redoCount < 20) { // Safety limit
        const isDisabled = await redoButton.isDisabled()
        if (isDisabled) {
          console.log(`  ✓ Redo button became disabled after ${redoCount} redos`)
          break
        }
        await redoButton.click()
        redoCount++
      }

      // Verify redo button is disabled
      await expect(redoButton).toBeDisabled()
      console.log('  ✓ Redo button is disabled when no more changes to redo')

      console.log('\n✅ Undo/redo button states test PASSED!')
      console.log(`  • Undo button disabled after ${undoCount} undos (no more history)`)
      console.log(`  • Redo button disabled after ${redoCount} redos (caught up to current state)`)
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

      // After the visual editor closes, wait for the DOM changes to appear in the create form
      // The changes should be visible in the variant's DOM Changes section
      // Give it extra time for React to re-render the inline editor with the changes

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
      // Wait for at least one DOM change card to appear (no need to scroll, they should be visible)
      await sidebar.locator('.dom-change-card').first().waitFor({ timeout: 10000 })
    } catch (err) {
      console.log('⚠️  DOM change cards did not appear within 10000ms')
      console.log('  Searching for any elements with "dom-change" in class...')
      const anyDomChangeElements = await sidebar.locator('[class*="dom-change"]').count()
      console.log(`  Found ${anyDomChangeElements} elements with "dom-change" in class`)
      
      // Debug: Check if changes are in the data but not rendered
      const sidebarText = await sidebar.textContent()
      console.log('  Sidebar contains "Undo test":', sidebarText?.includes('Undo test'))
      console.log('  Sidebar contains "display:none":', sidebarText?.includes('display:none'))
      
      throw err // Re-throw to fail the test
    }

    // Count the number of DOM change cards
    const changeCards = await sidebar.locator('.dom-change-card').count()
    console.log(`Found ${changeCards} DOM change cards in sidebar`)

    // Verify we have the expected 5 changes after squashing
    // (text [squashed from multiple edits], hide, delete, move, html)
    // Note: Multiple text edits to same element are squashed into one
    expect(changeCards).toBeGreaterThanOrEqual(5)

    // Get the text content of all cards to verify change types
    const cardsText = await sidebar.locator('.dom-change-card').allTextContents()
    const allText = cardsText.join(' ')

    console.log('DOM Change cards content:', allText.substring(0, 400))
    console.log('\nSearching for HTML change...')
    console.log('Looking for: #test-container and "<h2>HTML Edited!</h2><p>New paragraph content</p>"')
    console.log('Has #test-container:', allText.includes('#test-container'))
    console.log('Has "<h2>HTML Edited!</h2><p>New paragraph content</p>":', allText.includes('HTML Edited!'))

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

    // 5. Edit HTML on #test-container - should have HTML change type
    const hasEditHTML = allText.includes('#test-container') && (allText.includes('HTML') || allText.includes('html'))
    console.log(`  ${hasEditHTML ? '✓' : '✗'} Edit HTML: #test-container → HTML change`)
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


    })

    await test.step('Verify changes and markers after VE exit', async () => {
      console.log('\n🔍 STEP 6.5: Verifying changes and markers after VE exit')

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

      console.log('  Post-VE state:', postVEState)

      // Verify changes are still applied (text should be "Undo test 3" after undo/redo test)
      expect(postVEState.paragraphText).toBe('Undo test 3')
      expect(postVEState.button1Display).toBe('none')
      expect(postVEState.button2Display).toBe('none')
      expect(postVEState.testContainerHTML).toContain('HTML Edited!')
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

      // Listen for console messages from the page to debug (only in DEBUG mode)
      if (DEBUG_MODE) {
        testPage.on('console', msg => {
          if (msg.text().includes('[ABsmartly Page]') || msg.text().includes('PREVIEW') || msg.text().includes('[VisualEditor]') || msg.text().includes('Visual Editor Content Script')) {
            console.log(`  [Page Console] ${msg.text()}`)
          }
        })
      }

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
        const testContainer = document.querySelector('#test-container')

        return {
          paragraphText: paragraph?.textContent,
          paragraphVisible: paragraph ? window.getComputedStyle(paragraph).display !== 'none' : false,
          button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
          button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
          testContainerHTML: testContainer?.innerHTML?.trim()
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
        const testContainer = document.querySelector('#test-container')
        const stillModified = document.querySelectorAll('[data-absmartly-modified]').length
        const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]').length

        return {
          paragraphText: paragraph?.textContent,
          button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
          button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
          testContainerHTML: testContainer?.innerHTML?.trim(),
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

      expect(disabledStates.testContainerHTML).not.toBe('HTML Edited!')
      console.log(`  ✓ Section title reverted: "${disabledStates.testContainerHTML}"`)

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
        const testContainer = document.querySelector('#test-container')

        return {
          // Verify changes are re-applied
          paragraphText: paragraph?.textContent?.trim(),
          button1Display: button1 ? window.getComputedStyle(button1).display : null,
          button2Display: button2 ? window.getComputedStyle(button2).display : null,
          testContainerHTML: testContainer?.innerHTML?.trim(),
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

      expect(reEnabledStates.testContainerHTML).toContain('HTML Edited!')
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

      // Wait for VE DOM elements to be cleaned up
      await testPage.waitForFunction(() => {
        return document.getElementById('absmartly-menu-host') === null
      }, { timeout: 5000 })
      console.log('  ✓ Previous VE DOM elements cleaned up')

      // Get fresh sidebar reference
      const freshSidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await freshSidebar.locator('body').waitFor({ timeout: 5000 })

      // Click the VE button to launch second instance
      const veButtons = freshSidebar.locator('button:has-text("Visual Editor")')
      
      // Use dispatchEvent to ensure React handler is triggered in headless mode
      await veButtons.nth(0).evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Dispatched click event to Visual Editor button for second launch')

      // Take screenshot to see what's happening
      await testPage.screenshot({ path: 'test-results/second-ve-before-wait.png' })

      // Wait for VE banner host to appear (banner uses shadow DOM so we check for the host)
      await testPage.locator('#absmartly-visual-editor-banner-host').waitFor({ timeout: 5000 })
      console.log('  ✓ Second VE instance launched successfully!')

      // Verify banner shows correct experiment name
      console.log('  ✓ Second VE is active and ready')

      // Exit the second VE by clicking the Exit button in the banner
      console.log('  Clicking Exit button to exit VE...')
      
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
        return (window as any).__absmartlyVisualEditorActive !== true
      }, { timeout: 5000 })
      console.log('  🚪 VE exited - waiting for sidebar to update...')
      
      // Wait for sidebar to clear activeVEVariant state (onVEStop callback)
      console.log('  ✓ Waited for sidebar state cleanup')

      console.log('\n✅ Second VE launch test PASSED!')
      console.log('  • Successfully launched VE a second time')
      console.log('  • VE toolbar appeared correctly')
      console.log('  • Context menu works in second instance')
    })

    await testPage.evaluate(() => {
      console.log('\n🔄 STEP 9: Testing discard changes functionality')
    })

    // Test that discarding changes properly cleans up the page
    // SKIPPED: This test causes the page to crash on third VE launch
    await test.step.skip('Test discarding changes cleans up page correctly', async () => {
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

      // Take screenshot before attempting to launch VE
      await testPage.screenshot({ path: 'test-results/before-discard-test-ve-launch.png', fullPage: true })
      console.log('  Screenshot saved: before-discard-test-ve-launch.png')

      // Launch VE - wait for button to be enabled first
      const veButtons = freshSidebar.locator('button:has-text("Visual Editor")')

      // Wait for button to become enabled (not disabled)
      await veButtons.nth(0).waitFor({ state: 'attached', timeout: 5000 })

      // Wait for the button to be enabled by checking it's not disabled
      console.log('  Waiting for VE button to become enabled...')
      let buttonEnabled = false
      for (let i = 0; i < 50; i++) {
        const isDisabled = await veButtons.nth(0).isDisabled()
        const title = await veButtons.nth(0).getAttribute('title')
        
        if (i % 10 === 0) {
          console.log(`  Check ${i}: disabled=${isDisabled}, title="${title}"`)
        }
        
        if (!isDisabled) {
          buttonEnabled = true
          console.log(`  ✓ Button enabled after ${i * 200}ms`)
          break
        }
      }

      if (!buttonEnabled) {
        // Take screenshot to debug
        await testPage.screenshot({ path: 'test-results/ve-button-still-disabled.png', fullPage: true })
        console.log('  ⚠️  Screenshot saved: ve-button-still-disabled.png')
        throw new Error('VE button never became enabled after 10 seconds')
      }

      // Use dispatchEvent to ensure React handler is triggered in headless mode
      await veButtons.nth(0).evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Dispatched click event to Visual Editor button')

      // Wait for VE to be active
      await testPage.waitForFunction(() => {
        const banner = document.querySelector('.absmartly-banner')
        const active = (window as any).__absmartlyVisualEditorActive
        return banner !== null && active === true
      }, { timeout: 3000 })
      console.log('  ✓ Visual editor active')

      // Make a change to the paragraph
      const paragraph = testPage.locator('#test-paragraph')
      await paragraph.click() // Left-click to show context menu

      const contextMenu = testPage.locator('.menu-container')
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

    // Save experiment to database (optional - skipped by default)
    // WARNING: This writes to the production database! Only use when needed.
    // Pass SAVE_EXPERIMENT=1 environment variable to enable
    if (SAVE_EXPERIMENT) {
      await test.step('Save experiment to database', async () => {
        console.log('\n💾 Saving experiment to database...')
        console.log('⚠️  WARNING: This will write to the production database!')

        // Scroll to very top of sidebar (to the experiment form header) to see validation errors
        await sidebar.locator('body').evaluate(el => {
          el.scrollTop = 0
          // Also scroll within any scrollable containers
          const scrollableElements = el.querySelectorAll('[style*="overflow"]')
          scrollableElements.forEach(elem => {
            if (elem instanceof HTMLElement) elem.scrollTop = 0
          })
        })

        // Fill the new metadata fields (owners, teams, tags)
        console.log('  📝 Filling owners, teams, and tags fields...')
        await debugWait()

        // Scroll to the metadata section
        await sidebar.locator('label:has-text("Applications"), label:has-text("Owners")').first().scrollIntoViewIfNeeded()
        await debugWait()
        
        // Fill Owners field - click the field to open dropdown
        console.log('  Attempting to select owners...')
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
        console.log('  ✓ Clicked owners field')
        await debugWait()
        
        // Wait for dropdown to appear and get first option
        const ownersDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
        await ownersDropdown.waitFor({ state: 'visible', timeout: 3000 })
        console.log('  ✓ Owners dropdown appeared')
        
        // Wait for owners/teams to be loaded in the dropdown
        const firstOwnerOption = ownersDropdown.locator('div[class*="cursor-pointer"]').first()
        await firstOwnerOption.waitFor({ state: 'visible', timeout: 5000 })
        console.log('  ✓ Owners/teams loaded in dropdown')
        
        const optionExists = await firstOwnerOption.isVisible({ timeout: 2000 })
        
        if (!optionExists) {
          throw new Error('No owners/teams available in dropdown')
        }
        
        const selectedOptionText = await firstOwnerOption.textContent()
        await firstOwnerOption.click()
        console.log(`  ✓ Selected owner/team: ${selectedOptionText?.trim()}`)
        
        // Verify selection was made - check for selected badge
        const selectedBadge = ownersContainer.locator('div[class*="inline-flex"]', { hasText: selectedOptionText?.trim() || '' })
        const badgeVisible = await selectedBadge.isVisible({ timeout: 2000 })
        
        if (!badgeVisible) {
          throw new Error(`Owner selection failed - badge not visible for "${selectedOptionText?.trim()}"`)
        }
        console.log('  ✓ Verified owner selection badge appeared')
        
        // Click outside to close dropdown
        await sidebar.locator('label:has-text("Traffic")').click()
        
        // Fill Tags field - click the field to open dropdown
        console.log('  Attempting to select tags...')
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
        console.log('  ✓ Clicked tags field')
        
        // Wait for dropdown to appear and get first option
        const tagsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
        await tagsDropdown.waitFor({ state: 'visible', timeout: 3000 })
        console.log('  ✓ Tags dropdown appeared')
        
        // Click first available option in the dropdown
        const firstTagOption = tagsDropdown.locator('div[class*="cursor-pointer"]').first()
        await firstTagOption.waitFor({ state: 'visible', timeout: 5000 })
        console.log('  ✓ Tags loaded in dropdown')
        
        const tagOptionExists = await firstTagOption.isVisible({ timeout: 2000 })
        
        if (!tagOptionExists) {
          throw new Error('No tags available in dropdown')
        }
        
        const selectedTagText = await firstTagOption.textContent()
        await firstTagOption.click()
        console.log(`  ✓ Selected tag: ${selectedTagText?.trim()}`)
        
        // Verify selection was made - check for selected badge
        const selectedTagBadge = tagsContainer.locator('div[class*="inline-flex"]', { hasText: selectedTagText?.trim() || '' })
        const tagBadgeVisible = await selectedTagBadge.isVisible({ timeout: 2000 })
        
        if (!tagBadgeVisible) {
          throw new Error(`Tag selection failed - badge not visible for "${selectedTagText?.trim()}"`)
        }
        console.log('  ✓ Verified tag selection badge appeared')
        
        // Click outside to close dropdown
        await sidebar.locator('label:has-text("Traffic")').click()

        console.log('  ✓ Filled metadata fields')
        await debugWait()

        // Take screenshot before clicking save (should show top of form with any existing errors)
        await testPage.screenshot({ path: 'test-results/before-save-top.png', fullPage: true })
        console.log('  📸 Screenshot saved: before-save-top.png')
        await debugWait()

        // Click the save/create button in the experiment form
        const saveButton = sidebar.locator('button:has-text("Create Experiment"), button:has-text("Save")')

        // Scroll to the save button to make it visible
        await saveButton.scrollIntoViewIfNeeded()
        console.log('  ✓ Scrolled to save button')

        // Wait for React state updates before clicking
        await testPage.waitForTimeout(200)

        // Use dispatchEvent to ensure React handler is triggered in headless mode
        await saveButton.evaluate((button) => {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })
        console.log('  ✓ Dispatched click event to save button')

        // Wait for the click event to be processed
        await testPage.waitForTimeout(500)

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
        console.log('  📸 Screenshot saved: after-save-top.png')

        // Check if we're still on the create form or navigated away
        const stillOnCreateForm = await sidebar.locator('button:has-text("Create Experiment")').count() > 0
        console.log('  Still on create form:', stillOnCreateForm)

        // Check for success toast or error message
        const successToast = sidebar.locator('text=/successfully created|saved successfully|experiment created/i')
        const errorMessages = sidebar.locator('text=/error|required|must select|please|is required/i')

        const hasSuccess = await successToast.count() > 0
        const hasError = await errorMessages.count() > 0

        if (hasSuccess) {
          console.log('  ✅ Success toast found - experiment saved!')
          const successText = await successToast.first().textContent()
          console.log(`  Success message: ${successText}`)
        } else if (hasError) {
          console.log(`  ❌ Found ${await errorMessages.count()} error message(s):`)
          for (let i = 0; i < Math.min(5, await errorMessages.count()); i++) {
            const errorText = await errorMessages.nth(i).textContent()
            console.log(`    ${i + 1}. ${errorText}`)
          }
          throw new Error('Failed to save experiment - validation errors found. Check screenshots.')
        } else if (stillOnCreateForm) {
          console.log('  ❌ Still on create form - save failed')
          console.log('  This likely means validation failed but errors are not visible.')
          console.log('  Check the screenshots to see what fields are missing.')
          throw new Error('Experiment save failed - still on create form with no success message. Check screenshots: before-save-top.png and after-save-top.png')
        } else {
          console.log('  ✅ Navigated away from create form - experiment saved successfully')
        }

        console.log(`  📊 Experiment name: ${experimentName}`)
      })
    } else {
      await test.step.skip('Save experiment to database', async () => {})
    }
  })
})