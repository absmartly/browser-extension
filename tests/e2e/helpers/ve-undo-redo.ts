import { type Page, expect } from '@playwright/test'
import { log } from '../utils/test-helpers'

/**
 * Comprehensive undo/redo tests for all change types (text, HTML, hide/show, delete/restore)
 * Tests that each action can be undone and redone correctly
 *
 * @param page - The Playwright page object representing the test page
 */
export async function testUndoRedoForAllActions(page: Page): Promise<void> {

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
  const originalText = await page.locator('#test-paragraph').textContent()

  await openContextMenu('#test-paragraph')
  await page.locator('.menu-item[data-action="edit"]').evaluate((el) => {
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

  // Undo text change
  await page.locator('[data-action="undo"]').click()
  currentText = await page.locator('#test-paragraph').textContent()
  expect(currentText?.trim()).toBe(originalText?.trim())

  // Redo text change
  await page.locator('[data-action="redo"]').click()
  currentText = await page.locator('#test-paragraph').textContent()
  expect(currentText?.trim()).toBe('Text undo test')
  log('  ✓ Text undo/redo')

  // 2. TEST HTML CHANGE UNDO/REDO
  await page.waitForFunction(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.getAttribute('contenteditable') !== 'true'
  })

  const originalHtml = await page.locator('#test-paragraph').innerHTML()

  await openContextMenu('#test-paragraph')
  await page.locator('.menu-item[data-action="editHtml"]').evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await page.waitForSelector('#html-editor-dialog', { state: 'visible' })
  await page.waitForSelector('.cm-editor', { state: 'visible' })

  await page.evaluate(() => {
    const editor = document.querySelector('.cm-content') as HTMLElement
    if (editor) {
      editor.focus()
    }
  })

  await page.keyboard.press('Meta+A')
  await page.keyboard.type('<strong>Bold HTML test</strong>')
  await page.locator('#html-editor-apply-button').click()
  await page.locator('#html-editor-dialog').waitFor({ state: 'hidden' })

  let currentHtml = await page.locator('#test-paragraph').innerHTML()
  expect(currentHtml).toContain('<strong>Bold HTML test</strong>')

  // Undo HTML change
  await page.locator('[data-action="undo"]').click()
  currentHtml = await page.locator('#test-paragraph').innerHTML()
  expect(currentHtml).toBe(originalHtml)

  // Redo HTML change
  await page.locator('[data-action="redo"]').click()
  currentHtml = await page.locator('#test-paragraph').innerHTML()
  expect(currentHtml).toContain('<strong>Bold HTML test</strong>')
  log('  ✓ HTML undo/redo')

  // 3. TEST HIDE/SHOW UNDO/REDO
  let isVisible = await page.locator('#test-paragraph').isVisible()
  expect(isVisible).toBe(true)

  await openContextMenu('#test-paragraph')
  await page.locator('.menu-item[data-action="hide"]').evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  isVisible = await page.locator('#test-paragraph').isVisible()
  expect(isVisible).toBe(false)

  await page.locator('[data-action="undo"]').click()
  isVisible = await page.locator('#test-paragraph').isVisible()
  expect(isVisible).toBe(true)

  await page.locator('[data-action="redo"]').click()
  isVisible = await page.locator('#test-paragraph').isVisible()
  expect(isVisible).toBe(false)
  log('  ✓ Hide/show undo/redo')

  await page.locator('[data-action="undo"]').click()

  // 4. TEST DELETE/RESTORE UNDO/REDO
  let elementVisible = await page.locator('#test-paragraph').isVisible()
  expect(elementVisible).toBe(true)

  await openContextMenu('#test-paragraph')
  await page.locator('.menu-item[data-action="delete"]').evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  elementVisible = await page.locator('#test-paragraph').isVisible()
  expect(elementVisible).toBe(false)

  await page.locator('[data-action="undo"]').click()
  elementVisible = await page.locator('#test-paragraph').isVisible()
  expect(elementVisible).toBe(true)

  await page.locator('[data-action="redo"]').click()
  elementVisible = await page.locator('#test-paragraph').isVisible()
  expect(elementVisible).toBe(false)
  log('  ✓ Delete/restore undo/redo')

  await page.locator('[data-action="undo"]').click()

  log('  ✓ All undo/redo tests passed')
}

/**
 * Tests undo/redo button disabled states
 * Verifies that undo button becomes disabled when history is empty
 * and redo button becomes disabled when at current state
 *
 * @param page - The Playwright page object representing the test page
 */
export async function testUndoRedoButtonStates(page: Page): Promise<void> {
  let undoCount = 0
  let undoButton = page.locator('[data-action="undo"]')

  while (undoCount < 20) {
    const isDisabled = await undoButton.isDisabled()
    if (isDisabled) {
      break
    }
    await undoButton.click()
    undoCount++
  }

  await expect(undoButton).toBeDisabled()
  log(`  ✓ Undo button disabled after ${undoCount} undos`)

  let redoCount = 0
  let redoButton = page.locator('[data-action="redo"]')

  while (redoCount < 20) {
    const isDisabled = await redoButton.isDisabled()
    if (isDisabled) {
      break
    }
    await redoButton.click()
    redoCount++
  }

  await expect(redoButton).toBeDisabled()
  log(`  ✓ Redo button disabled after ${redoCount} redos`)
}
