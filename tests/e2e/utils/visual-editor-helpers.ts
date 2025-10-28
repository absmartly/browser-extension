import { type Page, expect } from '@playwright/test'
import { log } from './test-helpers'

/**
 * Wait for visual editor banner and assert it's visible
 */
export async function waitForVisualEditorBanner(page: Page, timeoutMs: number = 15000): Promise<void> {
  const bannerLocator = page.locator('#absmartly-visual-editor-banner-host')
  await expect(bannerLocator).toBeVisible({ timeout: timeoutMs })
}

/**
 * Wait for visual editor to be active
 */
export async function waitForVisualEditorActive(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    () => {
      const editor = (window as any).__absmartlyVisualEditor
      return editor && editor.isActive === true
    },
    { timeout }
  )
}

/**
 * Click element in visual editor with overlay wait
 */
export async function clickElementInEditor(page: Page, selector: string): Promise<void> {
  await page.click(selector)
  // Wait for overlay to appear after click
  await page.locator('#absmartly-overlay-container').waitFor({ state: 'attached', timeout: 2000 }).catch(() => {})
}

/**
 * Check if context menu is open
 */
export async function isContextMenuOpen(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return document.querySelector('#absmartly-menu-container') !== null
  })
}

/**
 * Click context menu item by text
 */
export async function clickContextMenuItem(page: Page, itemText: string): Promise<void> {
  const result = await page.evaluate((text) => {
    const items = Array.from(document.querySelectorAll('.menu-item'))
    const item = items.find(el => el.textContent?.includes(text))
    if (item) {
      const action = (item as HTMLElement).dataset.action
      ;(item as HTMLElement).click()
      return { found: true, action }
    }
    return { found: false, action: null }
  }, itemText)

  log(`clickContextMenuItem("${itemText}") result: found=${result.found}, action=${result.action}`, 'debug')

  // Wait for menu to disappear after click
  await page.locator('#absmartly-menu-container').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {})
}
