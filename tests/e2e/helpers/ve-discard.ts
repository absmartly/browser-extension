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
  log('\n🗑️  STEP 11: Testing discard changes functionality')

  const freshSidebar = page.frameLocator('#absmartly-sidebar-iframe')

  const disableButton = freshSidebar.locator('button:has-text("Disable Preview")')
  const isPreviewEnabled = await disableButton.isVisible({ timeout: 2000 }).catch(() => false)

  if (isPreviewEnabled) {
    await disableButton.click()
    await page.waitForFunction(() => {
      const para = document.querySelector('#test-paragraph')
      return para?.textContent?.includes('This is a test paragraph')
    })
  }

  const originalText = await page.evaluate(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.textContent?.trim()
  })

  await page.screenshot({ path: 'test-results/before-discard-test-ve-launch.png', fullPage: true })

  const veButtons = freshSidebar.locator('button:has-text("Visual Editor")')
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

  await page.waitForFunction(() => {
    const para = document.querySelector('#test-paragraph')
    if (!para) return false
    const banner = document.querySelector('#absmartly-visual-editor-banner-host .banner')
    return banner !== null && banner.children.length > 0
  }, { timeout: 3000 })

  const paragraph = page.locator('#test-paragraph')
  await paragraph.click()

  const contextMenu = page.locator('.menu-container')
  await expect(contextMenu).toBeVisible()

  const editTextButton = page.locator('.menu-item:has-text("Edit Text")')
  await editTextButton.click()

  await page.waitForFunction(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.getAttribute('contenteditable') === 'true'
  })

  await paragraph.fill('Discarded change')
  await page.locator('body').click({ position: { x: 10, y: 10 } })

  await page.waitForFunction(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.textContent?.trim() === 'Discarded change'
  })

  const textBeforeDiscard = await page.evaluate(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.textContent?.trim()
  })
  expect(textBeforeDiscard).toBe('Discarded change')
  log('  ✓ Change is visible on page')

  const exitButton = page.locator('button:has-text("Exit")').first()
  await expect(exitButton).toBeVisible()

  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('unsaved changes')
    await dialog.accept()
  })

  await exitButton.click()

  await page.waitForFunction(() => {
    return document.querySelector('.absmartly-toolbar') === null
  })

  const textAfterDiscard = await page.evaluate(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.textContent?.trim()
  })

  await page.screenshot({ path: 'test-results/step11-after-discard.png', fullPage: true })

  expect(textAfterDiscard).toBe(originalText)
  log('  ✓ Page reverted to original state')

  const savedChanges = await freshSidebar.locator('[data-testid="dom-change-item"]').count()
  expect(savedChanges).toBe(0)
  log('  ✓ Changes NOT saved to sidebar')

  log('\n✅ Discard changes test PASSED')
}
