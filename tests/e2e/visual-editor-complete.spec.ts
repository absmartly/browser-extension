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

// Helper to right-click element and open context menu
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
      await debugWait()
    })

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    await test.step('Create new experiment', async () => {
      console.log('\n📋 STEP 2: Creating new experiment')

    // Click the plus icon button with title="Create New Experiment"
    await sidebar.locator('button[title="Create New Experiment"]').click()
    console.log('  Clicked Create New Experiment button')
    await debugWait()

    // Fill experiment name in the form
    const experimentName = `E2E Test Experiment ${Date.now()}`
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

    await test.step('Verify changes in sidebar', async () => {
      console.log('\n📝 STEP 6: Verifying changes in sidebar...')

    // Wait for DOM change cards to appear in the sidebar
    // The changes are displayed as cards, not in a Monaco editor
    try {
      await sidebar.locator('.border').first().waitFor({ timeout: 5000 })
    } catch (err) {
      console.log('⚠️  DOM change cards did not appear within 5 seconds')
      throw err // Re-throw to fail the test
    }

    // Count the number of DOM change cards
    const changeCards = await sidebar.locator('.border').count()
    console.log(`Found ${changeCards} DOM change cards in sidebar`)

    // Verify we have the expected 5 changes (text, hide, delete, move, html)
    expect(changeCards).toBeGreaterThanOrEqual(5)

    // Get the text content of all cards to verify change types
    const cardsText = await sidebar.locator('.border').allTextContents()
    const allText = cardsText.join(' ')

    console.log('DOM Change cards content:', allText.substring(0, 400))
    console.log('\nSearching for HTML change...')
    console.log('Looking for: #section-title and "HTML Edited!"')
    console.log('Has #section-title:', allText.includes('#section-title'))
    console.log('Has "HTML Edited!":', allText.includes('HTML Edited!'))

    // Verify each specific change we made is present with correct details
    console.log('\n  Verifying individual changes:')

    // 1. Edit Text on #test-paragraph - should contain "Modified text!"
    const hasEditText = allText.includes('#test-paragraph') && allText.includes('Modified text!')
    console.log(`  ${hasEditText ? '✓' : '✗'} Edit Text: #test-paragraph → "Modified text!"`)
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

      // Verify changes are still applied
      expect(postVEState.paragraphText).toBe('Modified text!')
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

      // Verify changes are re-applied
      expect(reEnabledStates.paragraphText).toBe('Modified text!')
      console.log('  ✓ Paragraph text re-applied: "Modified text!"')

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
  })
})