import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

// Debug mode - set to true to add waits between steps for debugging
// Pass DEBUG=1 environment variable to enable: DEBUG=1 npx playwright test ...
const DEBUG_MODE = process.env.DEBUG === '1'
const debugWait = async (ms: number = 1000) => DEBUG_MODE ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()

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
    // STEP 1: Inject sidebar using the extension's own injection mechanism
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

    // STEP 2: Create new experiment
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

    // STEP 3: Click "Visual Editor" button (will send useShadowDOM: false in test mode)
    console.log('\n🎨 STEP 3: Clicking Visual Editor button')
    const visualEditorButton = sidebar.locator('button:has-text("Visual Editor")').first()
    await visualEditorButton.click()

    // Wait for visual editor notification to appear
    await testPage.locator('.absmartly-notification:has-text("Visual Editor Active")').waitFor({ state: 'visible', timeout: 10000 })
    console.log('✅ Visual editor active')
    await debugWait()

    // STEP 4: Test context menu actions on actual page elements
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

    // Action 5: Edit HTML (skip for now - editor needs fixes)
    console.log('  Skipping: Edit HTML (editor needs fixes)')

    console.log('✅ Visual editor actions tested (Edit Text, Hide, Delete, Move up)')
    await debugWait()

    // STEP 5: Click Save button in visual editor header
    console.log('\n💾 STEP 5: Clicking Save button...')

    // With use_shadow_dom_for_visual_editor_context_menu=0, the banner is not in shadow DOM
    // So we can click it directly
    await testPage.locator('[data-action="save"]').click()
    console.log('✅ Save button clicked')
    await debugWait()

    // STEP 6: Verify changes appear in sidebar
    console.log('\n📝 STEP 6: Verifying changes in sidebar...')

    // Wait for DOM change cards to appear in the sidebar
    // The changes are displayed as cards, not in a Monaco editor
    await sidebar.locator('.border').first().waitFor({ timeout: 10000 })

    // Count the number of DOM change cards
    const changeCards = await sidebar.locator('.border').count()
    console.log(`Found ${changeCards} DOM change cards in sidebar`)

    // Verify we have the expected 4 changes (text, hide, delete, move)
    expect(changeCards).toBeGreaterThanOrEqual(4)

    // Get the text content of all cards to verify change types
    const cardsText = await sidebar.locator('.border').allTextContents()
    const allText = cardsText.join(' ')

    console.log('DOM Change cards content:', allText.substring(0, 400))

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

    console.log('\n✅ All expected changes verified in sidebar')

    console.log('\n🎉 Visual editor complete workflow test PASSED!')
    console.log('✅ Successfully tested:')
    console.log('  • Edit Text - Modified paragraph text')
    console.log('  • Hide - Hid button element')
    console.log('  • Delete - Deleted button element')
    console.log('  • Move up - Moved list item up')
    console.log('  • Save to sidebar - Changes synced to DOM editor')
    console.log('\n⏭️  Skipped:')
    console.log('  • Edit HTML (Monaco editor needs button fix)')

    // Wait 30 seconds at the end in debug mode to inspect the result
    if (DEBUG_MODE) {
      console.log('\n⏳ Debug mode: Waiting 30 seconds before test completion...')
      await debugWait(30000)
      console.log('✅ Debug wait complete')
    }
  })
})