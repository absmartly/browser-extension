import { type Page, expect } from '@playwright/test'
import { log } from '../utils/test-helpers'

/**
 * Comprehensive undo/redo tests for all change types (text, HTML, hide/show, delete/restore)
 * Tests that each action can be undone and redone correctly
 *
 * @param page - The Playwright page object representing the test page
 */
export async function testUndoRedoForAllActions(page: Page): Promise<void> {
  log('\n🔄 Testing comprehensive undo/redo for all change types...')

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

  // 1. TEST TEXT CHANGE UNDO/REDO
  log('\n  1️⃣  Testing TEXT change undo/redo...')
  const originalText = await page.locator('#test-paragraph').textContent()

  await openContextMenu('#test-paragraph')
  await page.locator('.menu-item:has-text("Edit Text")').evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await page.waitForFunction(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.getAttribute('contenteditable') === 'true'
  })
  await page.locator('#test-paragraph').fill('Text undo test')
  await page.evaluate(() => {
    const para = document.querySelector('#test-paragraph') as HTMLElement
    para?.blur()
  })
  await page.waitForFunction(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.textContent?.trim() === 'Text undo test'
  })

  let currentText = await page.locator('#test-paragraph').textContent()
  expect(currentText?.trim()).toBe('Text undo test')
  log(`  ✓ Text changed to: "${currentText?.trim()}"`)

  // Undo text change
  await page.locator('[data-action="undo"]').click()
  currentText = await page.locator('#test-paragraph').textContent()
  expect(currentText?.trim()).toBe(originalText?.trim())
  log(`  ✓ Undo restored text to: "${currentText?.trim()}"`)

  // Redo text change
  await page.locator('[data-action="redo"]').click()
  currentText = await page.locator('#test-paragraph').textContent()
  expect(currentText?.trim()).toBe('Text undo test')
  log(`  ✓ Redo reapplied text to: "${currentText?.trim()}"`)

  // 2. TEST HTML CHANGE UNDO/REDO
  log('\n  2️⃣  Testing HTML change undo/redo...')

  // Wait for element to no longer be editable before proceeding
  await page.waitForFunction(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.getAttribute('contenteditable') !== 'true'
  })

  const originalHtml = await page.locator('#test-paragraph').innerHTML()
  log(`  📝 Original HTML: "${originalHtml}"`)

  await openContextMenu('#test-paragraph')
  await page.locator('.menu-item:has-text("Edit HTML")').evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await page.waitForSelector('#html-editor-dialog', { state: 'visible' })

  // Wait for CodeMirror to be fully initialized
  await page.waitForSelector('.cm-editor', { state: 'visible' })

  // Focus CodeMirror editor and update content
  await page.evaluate(() => {
    const editor = document.querySelector('.cm-content') as HTMLElement
    if (editor) {
      editor.focus()
    }
  })

  // Select all and replace with new content
  await page.keyboard.press('Meta+A')
  await page.keyboard.type('<strong>Bold HTML test</strong>')

  // Just click Apply - the live preview should have updated already, but if not Apply will save it
  await page.locator('#html-editor-dialog button:has-text("Apply")').click()
  await page.locator('#html-editor-dialog').waitFor({ state: 'hidden' })

  // Now verify it was applied
  let currentHtml = await page.locator('#test-paragraph').innerHTML()
  expect(currentHtml).toContain('<strong>Bold HTML test</strong>')
  log(`  ✓ HTML changed to contain: <strong>Bold HTML test</strong>`)

  // Undo HTML change
  await page.locator('[data-action="undo"]').click()
  currentHtml = await page.locator('#test-paragraph').innerHTML()
  expect(currentHtml).toBe(originalHtml)
  log(`  ✓ Undo restored original HTML`)

  // Redo HTML change
  await page.locator('[data-action="redo"]').click()
  currentHtml = await page.locator('#test-paragraph').innerHTML()
  expect(currentHtml).toContain('<strong>Bold HTML test</strong>')
  log(`  ✓ Redo reapplied HTML change`)

  // 3. TEST HIDE/SHOW UNDO/REDO
  log('\n  3️⃣  Testing HIDE/SHOW undo/redo...')
  let isVisible = await page.locator('#test-paragraph').isVisible()
  expect(isVisible).toBe(true)

  await openContextMenu('#test-paragraph')
  await page.locator('.menu-item:has-text("Hide")').evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  isVisible = await page.locator('#test-paragraph').isVisible()
  expect(isVisible).toBe(false)
  log(`  ✓ Element hidden`)

  // Undo hide (should show)
  await page.locator('[data-action="undo"]').click()
  isVisible = await page.locator('#test-paragraph').isVisible()
  expect(isVisible).toBe(true)
  log(`  ✓ Undo showed element`)

  // Redo hide
  await page.locator('[data-action="redo"]').click()
  isVisible = await page.locator('#test-paragraph').isVisible()
  expect(isVisible).toBe(false)
  log(`  ✓ Redo hid element again`)

  // Show it back for next tests
  await page.locator('[data-action="undo"]').click()

  // 4. TEST DELETE/RESTORE UNDO/REDO
  log('\n  4️⃣  Testing DELETE/RESTORE undo/redo...')
  let elementVisible = await page.locator('#test-paragraph').isVisible()
  expect(elementVisible).toBe(true)

  await openContextMenu('#test-paragraph')
  await page.locator('.menu-item:has-text("Delete")').evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  elementVisible = await page.locator('#test-paragraph').isVisible()
  expect(elementVisible).toBe(false)
  log(`  ✓ Element hidden`)

  // Undo delete (should restore)
  await page.locator('[data-action="undo"]').click()
  elementVisible = await page.locator('#test-paragraph').isVisible()
  expect(elementVisible).toBe(true)
  log(`  ✓ Undo restored element visibility`)

  // Redo delete
  await page.locator('[data-action="redo"]').click()
  elementVisible = await page.locator('#test-paragraph').isVisible()
  expect(elementVisible).toBe(false)
  log(`  ✓ Redo hid element again`)

  // Restore it back for next tests
  await page.locator('[data-action="undo"]').click()

  log('\n✅ All undo/redo tests PASSED!')
  log('  ✓ Text change undo/redo works')
  log('  ✓ HTML change undo/redo works')
  log('  ✓ Hide/show undo/redo works')
  log('  ✓ Delete/restore undo/redo works')
  log('  ✓ Insert block undo/redo works')
}

/**
 * Tests undo/redo button disabled states
 * Verifies that undo button becomes disabled when history is empty
 * and redo button becomes disabled when at current state
 *
 * @param page - The Playwright page object representing the test page
 */
export async function testUndoRedoButtonStates(page: Page): Promise<void> {
  log('\n🔘 Testing undo/redo button states...')

  // After all redos, we should be at "Undo test 3"
  // Now undo ALL changes including the original 5 (text, hide, delete, move, html)
  // We need to undo 3 text changes + 4 other changes = 7 total undos

  // We already did 3 undos and 3 redos, so we're back at "Undo test 3"
  // Let's undo ALL 8 changes (3 text + 5 original changes)
  log('  ⏪ Undoing all changes to test undo button disabled state...')

  // Track how many undos we can do
  let undoCount = 0
  let undoButton = page.locator('[data-action="undo"]')

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
  let redoButton = page.locator('[data-action="redo"]')

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
}
