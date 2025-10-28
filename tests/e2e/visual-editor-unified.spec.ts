import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
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
  await page.waitForSelector(selector, { state: 'visible', timeout: 1000 }).catch(() => {})
}

// Helper to right-click element and open context menu
async function rightClickElement(page: Page, selector: string) {
  await page.click(selector, { button: 'right' })
  await page.waitForFunction(
    () => document.querySelector('#absmartly-menu-container') !== null,
    { timeout: 2000 }
  ).catch(() => {})
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
}

test.describe('Visual Editor Unified Tests', () => {
  let testPage: Page
  let sidebarPage: Page

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()
    await testPage.goto(`file://${TEST_PAGE_PATH}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForSelector('body', { timeout: 5000 })

    // Wait for content script to be ready
    await testPage.waitForFunction(
      () => (window as any).__absmartlyContentScriptReady === true || document.readyState === 'complete',
      { timeout: 2000 }
    ).catch(() => {})
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
    if (sidebarPage) await sidebarPage.close()
  })

  test('Complete visual editor workflow with sidebar integration', async ({ context, extensionUrl }) => {
    // Step 1: Inject the sidebar into the test page
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

    // Wait for sidebar to load
    await testPage.waitForSelector('#absmartly-sidebar-frame', { timeout: 5000 })

    const sidebarFrameElement = await testPage.$('#absmartly-sidebar-frame')
    const sidebarFrame = await sidebarFrameElement?.contentFrame()

    if (!sidebarFrame) {
      throw new Error('Could not access sidebar frame')
    }

    // Step 2: Click on first experiment in the list
    const experimentSelector = '[data-testid="experiment-item"], .experiment-item'
    await sidebarFrame.waitForSelector(experimentSelector, { timeout: 10000 })
    const firstExperiment = await sidebarFrame.$(experimentSelector)
    await firstExperiment?.click()

    // Step 3: Click visual editor button to start visual editor
    const visualEditorBtn = await sidebarFrame.$('button:has-text("Visual Editor"), [data-testid="visual-editor-btn"]')
    await visualEditorBtn?.click()

    // Wait for visual editor to be active
    await waitForVisualEditorActive(testPage, 15000)

    // Verify toolbar/banner is visible
    const hasBanner = await testPage.evaluate(() => {
      return document.querySelector('[data-absmartly-banner]') !== null
    })
    expect(hasBanner).toBeTruthy()

    // Step 4: Test all context menu actions

    // Action 1: Edit Text
    await clickElementInEditor(testPage, '#test-paragraph')
    await rightClickElement(testPage, '#test-paragraph')
    expect(await isContextMenuOpen(testPage)).toBeTruthy()
    await clickContextMenuItem(testPage, 'Edit Text')
    await testPage.keyboard.type('Modified text!')
    await testPage.keyboard.press('Enter')

    // Action 2: Hide element
    await clickElementInEditor(testPage, '#button-1')
    await rightClickElement(testPage, '#button-1')
    await clickContextMenuItem(testPage, 'Hide')

    // Action 3: Delete element
    await clickElementInEditor(testPage, '#button-2')
    await rightClickElement(testPage, '#button-2')
    await clickContextMenuItem(testPage, 'Delete')

    // Action 4: Move up
    await clickElementInEditor(testPage, '#item-2')
    await rightClickElement(testPage, '#item-2')
    await clickContextMenuItem(testPage, 'Move up')

    // Action 5: Edit HTML
    await clickElementInEditor(testPage, '#section-title')
    await rightClickElement(testPage, '#section-title')
    await clickContextMenuItem(testPage, 'Edit HTML')
    // Monaco editor should be open - type some HTML
    await testPage.keyboard.type('<strong>Bold Title</strong>')
    // Look for save button and click it
    await testPage.locator('button:has-text("Save"), .save-button').click()

    // Step 5: Save changes by clicking save button in visual editor header
    const saveButton = testPage.locator('[data-absmartly-banner] button:has-text("Save"), .absmartly-save-btn')
    await saveButton.click()
    // Wait for UI update
    await testPage.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})

    // Step 6: Verify all changes appear in the sidebar DOM changes editor
    // Switch to sidebar and check DOM changes editor
    await sidebarFrame.waitForSelector('.monaco-editor, [data-testid="dom-changes-editor"]', { timeout: 5000 })

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

    // Verify we have changes
    expect(changesText.length).toBeGreaterThan(0)

    // Verify specific change types are present
    expect(changesText).toContain('text') // Edit text action
    expect(changesText).toContain('style') // Hide action
    expect(changesText).toContain('delete') // Delete action
    expect(changesText).toContain('move') // Move action
    expect(changesText).toContain('html') // Edit HTML action
  })
})
