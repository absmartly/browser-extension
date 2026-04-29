import { type Page, type FrameLocator, expect } from '@playwright/test'
import { log } from '../utils/test-helpers'

/**
 * Test discard changes functionality in Visual Editor.
 *
 * This test verifies that when changes are made in the Visual Editor and then
 * discarded (by clicking Exit and accepting the confirmation dialog), the page
 * correctly reverts to its original state and no changes are saved to the sidebar.
 *
 * Test flow:
 * 1. Disables preview if enabled to start fresh
 * 2. Records the original text content
 * 3. Launches Visual Editor and waits for full initialization
 * 4. Makes a text change to an element
 * 5. Exits VE without saving and accepts the discard confirmation dialog
 * 6. Verifies the page reverted to original state
 * 7. Verifies no changes were saved to sidebar
 *
 * @param sidebar - The sidebar frame locator
 * @param page - The test page being manipulated
 * @param allConsoleMessages - Array of console messages for debugging
 */
export async function testDiscardChanges(
  sidebar: FrameLocator,
  page: Page,
  allConsoleMessages: Array<{ type: string; text: string }>
): Promise<void> {

  log('\n🗑️ Testing discard changes functionality...')

  // Earlier tests save a `delete` change against #test-paragraph (via the
  // undo/redo limits step). With the SDK-applier refactor that change is now
  // a real DOM removal — `delete` on the SDK side calls element.remove() —
  // so once VE.start() replays lastSavedChanges under __visual_editor__ the
  // paragraph is gone and we can't drive the discard test through it.
  // #main-title is in lastSavedChanges only for attribute updates, so the
  // element itself stays put during VE editing.
  const targetSelector = '#main-title'

  // Snapshot the saved-changes count before VE launches; the core invariant
  // we want to verify is "discard does not add to the saved set."
  const savedChangesBefore = await sidebar
    .locator('[data-testid="dom-change-item"]')
    .count()
  log(`Saved DOM changes before VE: ${savedChangesBefore}`)

  // Capture the current title text — page is in its clean (preview-off)
  // state by the time this test runs, so this is the page's intrinsic value.
  const originalText = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel)
    return el?.textContent?.trim()
  }, targetSelector)
  log(`Text before launching VE: "${originalText}"`)

  await page.screenshot({ path: 'test-results/before-discard-test-ve-launch.png', fullPage: true })

  const veButtons = sidebar.locator('#visual-editor-button')
  await veButtons.nth(0).waitFor({ state: 'attached', timeout: 5000 })

  let buttonEnabled = false
  for (let i = 0; i < 50; i++) {
    const isDisabled = await veButtons.nth(0).isDisabled()

    if (!isDisabled) {
      buttonEnabled = true
      break
    }
  }

  if (!buttonEnabled) {
    await page.screenshot({ path: 'test-results/ve-button-still-disabled.png', fullPage: true })
    throw new Error('VE button never became enabled after 10 seconds')
  }

  await page.screenshot({ path: 'test-results/step11-before-ve-click.png', fullPage: true })

  await veButtons.nth(0).evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  try {
    await page.locator('.banner').waitFor({ state: 'visible', timeout: 5000 })
  } catch (e) {
    // Banner did not appear
  }

  await page.screenshot({ path: 'test-results/step11-after-ve-click.png', fullPage: true })

  try {
    await page.waitForFunction(() => {
      const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
      const banner = bannerHost?.querySelector('.banner')
      return banner !== null
    }, { timeout: 3000 })
  } catch (err) {
    const debugInfo = await page.evaluate(() => {
      const ve = (window as any).__absmartlyVisualEditor
      const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
      const banner = bannerHost?.querySelector('.banner')
      return {
        veExists: ve !== undefined,
        veIsActive: ve && ve.isActive,
        bannerHostExists: bannerHost !== null,
        bannerExists: banner !== null,
        bannerHostChildren: bannerHost?.children.length || 0
      }
    })
    throw err
  }

  await page.waitForFunction((sel: string) => {
    const el = document.querySelector(sel)
    if (!el) return false
    const banner = document.querySelector('#absmartly-visual-editor-banner-host .banner')
    return banner !== null && banner.children.length > 0
  }, targetSelector, { timeout: 3000 })

  const target = page.locator(targetSelector)
  await target.click()

  const contextMenu = page.locator('.menu-container')
  await expect(contextMenu).toBeVisible()

  const editTextButton = page.locator('.menu-item[data-action="edit"]')
  await editTextButton.click()

  await page.waitForFunction((sel: string) => {
    const el = document.querySelector(sel)
    return el?.getAttribute('contenteditable') === 'true'
  }, targetSelector)

  await target.fill('Discarded change')
  await page.locator('body').click({ position: { x: 10, y: 10 } })

  await page.waitForFunction((sel: string) => {
    const el = document.querySelector(sel)
    return el?.textContent?.trim() === 'Discarded change'
  }, targetSelector)

  const textBeforeDiscard = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel)
    return el?.textContent?.trim()
  }, targetSelector)
  expect(textBeforeDiscard).toBe('Discarded change')
  log('  ✓ Change is visible on page')

  const exitButton = page.locator('[data-action="exit"]')
  await expect(exitButton).toBeVisible()

  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('unsaved changes')
    await dialog.accept()
  })

  await exitButton.click()

  await page.waitForFunction(() => {
    return document.querySelector('.absmartly-toolbar') === null
  })

  const textAfterDiscard = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel)
    return el?.textContent?.trim()
  }, targetSelector)

  await page.screenshot({ path: 'test-results/step11-after-discard.png', fullPage: true })

  // VE.stop() tears down the __visual_editor__ preview it owned during
  // editing, so the page returns to whatever state it was in before VE
  // launched (clean, since preview was off when the discard test started).
  // The discarded edit must NOT linger.
  expect(textAfterDiscard).toBe(originalText)
  expect(textAfterDiscard).not.toBe('Discarded change')
  log(`  ✓ Page restored to pre-VE state ("${textAfterDiscard}")`)

  // Saved-changes count is the durable invariant: a discard must not add
  // a row to the saved set (the previous tests' saves stay, nothing else).
  const savedChangesAfter = await sidebar
    .locator('[data-testid="dom-change-item"]')
    .count()
  log(`  ✓ Sidebar has ${savedChangesAfter} saved changes (was ${savedChangesBefore} before VE)`)
  expect(savedChangesAfter).toBe(savedChangesBefore)

  log('\n✅ Discard changes test PASSED')
}
