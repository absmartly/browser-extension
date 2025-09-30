import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'

/**
 * Unified Visual Editor E2E Test
 *
 * Tests the complete visual editor workflow using the actual extension:
 * 1. Load extension and inject sidebar into test page
 * 2. Start visual editor from sidebar
 * 3. Test all visual editor actions
 * 4. Verify changes sync to sidebar DOM changes editor
 */

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

// Helper to wait for visual editor to be active
async function waitForVisualEditorActive(page: Page, timeout = 10000) {
  await page.waitForFunction(
    () => (window as any).__absmartlyVisualEditorActive === true,
    { timeout }
  )
}

// Helper to get DOM changes from visual editor
async function getDOMChanges(page: Page): Promise<any[]> {
  return await page.evaluate(() => {
    const editor = (window as any).__absmartlyVisualEditor
    return editor?.getChanges() || []
  })
}

// Helper to click element in visual editor (simulates user click)
async function clickElementInEditor(page: Page, selector: string) {
  await page.click(selector)
  await page.waitForTimeout(200) // Wait for selection
}

// Helper to right-click element and open context menu
async function rightClickElement(page: Page, selector: string) {
  await page.click(selector, { button: 'right' })
  await page.waitForTimeout(300) // Wait for context menu
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

test.describe('Visual Editor Unified Tests', () => {
  let testPage: Page
  let sidebarPage: Page

  test.beforeEach(async ({ context }) => {
    // Load the actual test HTML file so content script gets injected
    testPage = await context.newPage()
    await testPage.goto(`file://${TEST_PAGE_PATH}`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    // Wait a bit for content script to inject
    await testPage.waitForTimeout(1000)

    console.log('✅ Test page loaded')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
    if (sidebarPage) await sidebarPage.close()
  })

  test('Complete visual editor workflow with sidebar integration', async ({ context, extensionUrl }) => {
    // Step 1: Inject the sidebar into the test page
    console.log('📂 Step 1: Injecting sidebar...')

    await testPage.evaluate((sidebarUrl) => {
      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-frame'
      iframe.src = sidebarUrl
      iframe.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 400px;
        height: 100vh;
        border: none;
        z-index: 2147483647;
        box-shadow: -2px 0 8px rgba(0,0,0,0.15);
      `
      document.body.appendChild(iframe)
    }, extensionUrl('tabs/sidebar.html'))

    await testPage.waitForTimeout(3000) // Wait for sidebar to fully load
    console.log('✅ Sidebar visible')

    const sidebarFrame = testPage.frameLocator('#absmartly-sidebar-frame')

    // Step 2: Click on first experiment in the list
    console.log('📋 Step 2: Clicking first experiment in list...')

    // Wait for experiments to load
    await sidebarFrame.locator('[data-testid="experiment-item"], .experiment-item').first().waitFor({ timeout: 10000 })
    await sidebarFrame.locator('[data-testid="experiment-item"], .experiment-item').first().click()
    await testPage.waitForTimeout(1000)
    console.log('✅ Experiment selected')

    // Step 3: Click visual editor button to start visual editor
    console.log('🎨 Step 3: Clicking visual editor button...')

    await sidebarFrame.locator('button:has-text("Visual Editor"), [data-testid="visual-editor-btn"]').click()
    await testPage.waitForTimeout(2000)

    // Wait for visual editor to be active
    await waitForVisualEditorActive(testPage, 15000)
    console.log('✅ Visual editor active')

    // Verify toolbar/banner is visible
    const hasBanner = await testPage.evaluate(() => {
      return document.querySelector('[data-absmartly-banner]') !== null
    })
    expect(hasBanner).toBeTruthy()
    console.log('✅ Visual editor banner visible')

    // Step 4: Test all context menu actions
    console.log('\n🧪 Step 4: Testing all visual editor actions...')

    // Action 1: Edit Text
    console.log('  Testing: Edit Text')
    await clickElementInEditor(testPage, '#test-paragraph')
    await rightClickElement(testPage, '#test-paragraph')
    expect(await isContextMenuOpen(testPage)).toBeTruthy()
    await clickContextMenuItem(testPage, 'Edit Text')
    await testPage.keyboard.type('Modified text!')
    await testPage.keyboard.press('Enter')
    await testPage.waitForTimeout(500)
    console.log('  ✓ Edit Text works')

    // Action 2: Hide element
    console.log('  Testing: Hide')
    await clickElementInEditor(testPage, '#button-1')
    await rightClickElement(testPage, '#button-1')
    await clickContextMenuItem(testPage, 'Hide')
    await testPage.waitForTimeout(300)
    console.log('  ✓ Hide works')

    // Action 3: Delete element
    console.log('  Testing: Delete')
    await clickElementInEditor(testPage, '#button-2')
    await rightClickElement(testPage, '#button-2')
    await clickContextMenuItem(testPage, 'Delete')
    await testPage.waitForTimeout(300)
    console.log('  ✓ Delete works')

    // Action 4: Move up
    console.log('  Testing: Move up')
    await clickElementInEditor(testPage, '#item-2')
    await rightClickElement(testPage, '#item-2')
    await clickContextMenuItem(testPage, 'Move up')
    await testPage.waitForTimeout(300)
    console.log('  ✓ Move up works')

    // Action 5: Edit HTML
    console.log('  Testing: Edit HTML')
    await clickElementInEditor(testPage, '#section-title')
    await rightClickElement(testPage, '#section-title')
    await clickContextMenuItem(testPage, 'Edit HTML')
    await testPage.waitForTimeout(500)
    // Monaco editor should be open - type some HTML
    await testPage.keyboard.type('<strong>Bold Title</strong>')
    // Look for save button and click it
    await testPage.locator('button:has-text("Save"), .save-button').click()
    await testPage.waitForTimeout(300)
    console.log('  ✓ Edit HTML works')

    console.log('✅ All visual editor actions tested')

    // Step 5: Save changes by clicking save button in visual editor header
    console.log('\n💾 Step 5: Saving changes...')

    const saveButton = testPage.locator('[data-absmartly-banner] button:has-text("Save"), .absmartly-save-btn')
    await saveButton.click()
    await testPage.waitForTimeout(1000)
    console.log('✅ Changes saved')

    // Step 6: Verify all changes appear in the sidebar DOM changes editor
    console.log('\n📝 Step 6: Verifying changes in sidebar...')

    // Switch to sidebar and check DOM changes editor
    const domChangesEditor = sidebarFrame.locator('.monaco-editor, [data-testid="dom-changes-editor"]')
    await domChangesEditor.waitFor({ timeout: 5000 })

    // Get the content from Monaco editor
    const changesText = await sidebarFrame.evaluate(() => {
      const monaco = document.querySelector('.monaco-editor')
      if (monaco) {
        // Try to get text content from Monaco
        const lines = monaco.querySelectorAll('.view-line')
        return Array.from(lines).map(line => line.textContent).join('\n')
      }
      return ''
    })

    console.log('DOM Changes in sidebar:', changesText)

    // Verify we have changes
    expect(changesText.length).toBeGreaterThan(0)

    // Verify specific change types are present
    expect(changesText).toContain('text') // Edit text action
    expect(changesText).toContain('style') // Hide action
    expect(changesText).toContain('delete') // Delete action
    expect(changesText).toContain('move') // Move action
    expect(changesText).toContain('html') // Edit HTML action

    console.log('✅ All changes verified in sidebar DOM editor')

    console.log('\n🎉 Complete visual editor workflow test PASSED!')
  })

  test('Step 3: Test Edit Text action', async () => {
    // This test is replaced by the complete workflow test above
    test.skip()
  })

  test.skip('Step 4: Test Delete action', async () => {
    // This test is replaced by the complete workflow test above
    test.skip()
  })

  test('Visual editor changes sync to sidebar', async ({ context, extensionUrl }) => {
    // TODO: This test will verify that changes made in the visual editor
    // appear in the sidebar's DOM changes editor
    // This requires:
    // 1. Opening sidebar in a separate page
    // 2. Starting visual editor
    // 3. Making changes in the visual editor
    // 4. Checking if those changes appear in the sidebar's Monaco editor

    console.log('⚠️  Sidebar sync test not yet implemented')
    test.skip()
  })
})