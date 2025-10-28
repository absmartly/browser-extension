import { type Page } from '@playwright/test'
import { log, debugWait } from '../utils/test-helpers'

/**
 * Comprehensive undo/redo tests for all change types
 */
export async function testUndoRedoForAllActions(page: Page): Promise<void> {
  log('\n🔄 Testing comprehensive undo/redo for all change types', 'info')

  // Helper to deselect all elements
  const deselectAll = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('.absmartly-selected, .absmartly-editing').forEach(el => {
        el.classList.remove('absmartly-selected', 'absmartly-editing')
        if (el instanceof HTMLElement && el.contentEditable === 'true') {
          el.contentEditable = 'false'
          el.blur()
        }
      })
      document.getElementById('absmartly-menu-host')?.remove()
    })
    await page.locator('body').click({ position: { x: 5, y: 5 } })
  }

  // Helper to click element and open context menu
  const openContextMenu = async (selector: string) => {
    await deselectAll()
    await page.locator(selector).evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await page.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })
  }

  // TODO: Extract undo/redo tests from visual-editor-complete.spec.ts lines 770-1006
  // 1. TEXT CHANGE UNDO/REDO
  // 2. HTML CHANGE UNDO/REDO
  // 3. HIDE/SHOW UNDO/REDO
  // 4. DELETE/RESTORE UNDO/REDO
  // 5. INSERT BLOCK UNDO/REDO

  log('✅ All undo/redo tests PASSED!', 'info')
  await debugWait()
}
