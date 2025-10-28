import { type Page } from '@playwright/test'
import { log } from '../utils/test-helpers'
import { clickContextMenuItem } from '../utils/visual-editor-helpers'

/**
 * VE action test implementations
 * These functions test individual Visual Editor actions
 */

export async function testEditTextAction(page: Page, selector: string, newText: string): Promise<void> {
  log(`Testing: Edit Text on ${selector}`, 'info')
  await page.click(selector)
  await clickContextMenuItem(page, 'Edit Text')
  await page.keyboard.type(newText)
  await page.keyboard.press('Enter')
}

export async function testHideElementAction(page: Page, selector: string): Promise<void> {
  log(`Testing: Hide on ${selector}`, 'info')
  await page.click(selector)
  await clickContextMenuItem(page, 'Hide')
}

export async function testDeleteElementAction(page: Page, selector: string): Promise<void> {
  log(`Testing: Delete on ${selector}`, 'info')
  await page.click(selector)
  await clickContextMenuItem(page, 'Delete')
}

export async function testEditHTMLAction(page: Page, selector: string, newHTML: string): Promise<void> {
  log(`Testing: Edit HTML on ${selector}`, 'info')
  await page.click(selector, { force: true })
  await page.locator('.menu-container').waitFor({ state: 'visible' })
  await page.locator('.menu-item:has-text("Edit HTML")').click()

  // Wait for CodeMirror editor to appear
  await page.locator('.cm-editor').waitFor({ state: 'visible' })
  log('CodeMirror editor appeared', 'debug')

  // Focus CodeMirror editor and update content
  await page.evaluate(() => {
    const editor = document.querySelector('.cm-content') as HTMLElement
    if (editor) {
      editor.focus()
    }
  })

  // Select all and replace with new content
  await page.keyboard.press('Meta+A')
  await page.keyboard.type(newHTML)

  // Click Apply
  await page.locator('#html-editor-dialog button:has-text("Apply")').click()
  await page.locator('#html-editor-dialog').waitFor({ state: 'hidden' })
}

export async function testInsertBlockAction(page: Page): Promise<void> {
  log('Testing: Insert new block', 'info')
  // TODO: Implement insert block action
}

export async function testResizeAction(page: Page, selector: string): Promise<void> {
  log(`Testing: Resize on ${selector}`, 'info')
  // TODO: Implement resize action
}

export async function testDragDropAction(page: Page, fromSelector: string, toSelector: string): Promise<void> {
  log(`Testing: Drag drop from ${fromSelector} to ${toSelector}`, 'info')
  // TODO: Implement drag-drop action
}

export async function testChangeImageSourceAction(page: Page, selector: string, newSrc: string): Promise<void> {
  log(`Testing: Change image source on ${selector}`, 'info')
  // TODO: Implement change image source action
}
