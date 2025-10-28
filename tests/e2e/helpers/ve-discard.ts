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
  log('\n🗑️  STEP 11: Testing discard changes functionality...')

  // Get fresh sidebar reference
  const freshSidebar = page.frameLocator('#absmartly-sidebar-iframe')

  // Disable preview first to start fresh
  const disableButton = freshSidebar.locator('button:has-text("Disable Preview")')
  const isPreviewEnabled = await disableButton.isVisible({ timeout: 2000 }).catch(() => false)

  if (isPreviewEnabled) {
    await disableButton.click()
    await page.waitForFunction(() => {
      const para = document.querySelector('#test-paragraph')
      return para?.textContent?.includes('This is a test paragraph')
    })
    log('  ✓ Disabled preview to start fresh')
  }

  // Get original text
  const originalText = await page.evaluate(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.textContent?.trim()
  })
  log(`  📝 Original text: "${originalText}"`)

  // Take screenshot before attempting to launch VE
  await page.screenshot({ path: 'test-results/before-discard-test-ve-launch.png', fullPage: true })
  log('  Screenshot saved: before-discard-test-ve-launch.png')

  // Launch VE - wait for button to be enabled first
  const veButtons = freshSidebar.locator('button:has-text("Visual Editor")')

  // Wait for button to become enabled (not disabled)
  await veButtons.nth(0).waitFor({ state: 'attached', timeout: 5000 })

  // Wait for the button to be enabled by checking it's not disabled
  log('  Waiting for VE button to become enabled...')
  let buttonEnabled = false
  for (let i = 0; i < 50; i++) {
    const isDisabled = await veButtons.nth(0).isDisabled()
    const title = await veButtons.nth(0).getAttribute('title')

    if (i % 10 === 0) {
      log(`  Check ${i}: disabled=${isDisabled}, title="${title}"`)
    }

    if (!isDisabled) {
      buttonEnabled = true
      log(`  ✓ Button enabled after ${i * 200}ms`)
      break
    }
  }

  if (!buttonEnabled) {
    // Take screenshot to debug
    await page.screenshot({ path: 'test-results/ve-button-still-disabled.png', fullPage: true })
    log('  ⚠️  Screenshot saved: ve-button-still-disabled.png')
    throw new Error('VE button never became enabled after 10 seconds')
  }

  // Take screenshot before clicking VE button
  await page.screenshot({ path: 'test-results/step11-before-ve-click.png', fullPage: true })
  log('📸 Screenshot: step11-before-ve-click.png')

  // Check for any leftover VE elements before clicking
  const beforeClickState = await page.evaluate(() => {
    const banner = document.querySelector('.absmartly-banner')
    const overlay = document.querySelector('#absmartly-overlay-container')
    const allDivs = Array.from(document.querySelectorAll('body > div')).map(d => ({
      class: d.className,
      id: d.id,
      children: d.children.length
    }))
    return {
      bannerExists: banner !== null,
      overlayExists: overlay !== null,
      bodyDivCount: document.querySelectorAll('body > div').length,
      bodyDivs: allDivs
    }
  })
  log(`Before VE click: banner=${beforeClickState.bannerExists}, overlay=${beforeClickState.overlayExists}, body divs=${beforeClickState.bodyDivCount}`)
  log(`Body div details: ${JSON.stringify(beforeClickState.bodyDivs, null, 2)}`)

  // Use dispatchEvent to ensure React handler is triggered in headless mode
  await veButtons.nth(0).evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  log('✓ Dispatched click event to Visual Editor button')

  // Wait for VE banner to appear
  try {
    await page.locator('.banner').waitFor({ state: 'visible', timeout: 5000 })
    log('✓ VE banner appeared')
  } catch (e) {
    log('⚠️  VE banner did not appear - checking page state...')
  }

  // Take screenshot after clicking VE button
  await page.screenshot({ path: 'test-results/step11-after-ve-click.png', fullPage: true })
  log('📸 Screenshot: step11-after-ve-click.png')

  // Capture console messages after VE button click
  const recentMessages = allConsoleMessages.slice(-40)
  log(`📋 Recent console messages (last 40):`)
  recentMessages.forEach(msg => {
    log(`  [${msg.type}] ${msg.text}`)
  })

  // Check for "already active" message which would indicate early return
  const hasAlreadyActive = recentMessages.some(m => m.text.includes('already active'))
  if (hasAlreadyActive) {
    log(`⚠️  VE returned "already active" - flag from previous session not cleaned up!`)
  }

  // Debug: Check what's preventing VE from activating
  log('Checking VE activation conditions...')
  const initialState = await page.evaluate(() => {
    const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
    const banner = bannerHost?.querySelector('.banner')
    const overlay = document.querySelector('#absmartly-overlay-container')
    const ve = (window as any).__absmartlyVisualEditor
    const allDivs = Array.from(document.querySelectorAll('body > div')).map(d => ({
      class: d.className,
      id: d.id,
      children: d.children.length,
      display: (d as HTMLElement).style.display
    }))
    return {
      bannerHostExists: bannerHost !== null,
      bannerExists: banner !== null,
      bannerHTML: banner ? banner.outerHTML.substring(0, 200) : null,
      overlayExists: overlay !== null,
      veInstanceExists: ve !== undefined,
      veIsActive: ve && ve.isActive,
      bodyDivCount: document.querySelectorAll('body > div').length,
      bodyDivs: allDivs
    }
  })
  log(`After VE click state:`)
  log(`  bannerHost=${initialState.bannerHostExists}, banner=${initialState.bannerExists}, overlay=${initialState.overlayExists}`)
  log(`  veInstance=${initialState.veInstanceExists}, veIsActive=${initialState.veIsActive}`)
  log(`  bodyDivs=${initialState.bodyDivCount}`)
  log(`Body div details: ${JSON.stringify(initialState.bodyDivs, null, 2)}`)
  if (initialState.bannerHTML) {
    log(`Banner HTML preview: ${initialState.bannerHTML}`)
  }

  // Wait for each condition separately to see which one fails
  log('Step 1: Waiting for VE banner to appear...')
  try {
    await page.waitForFunction(() => {
      // Banner is inside #absmartly-visual-editor-banner-host with class "banner"
      const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
      const banner = bannerHost?.querySelector('.banner')
      return banner !== null
    }, { timeout: 3000 })
    log('✓ Banner appeared')
  } catch (err) {
    log('❌ Banner never appeared!')

    // Debug: Check if VE instance exists but banner creation failed
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
    log(`Debug info: ${JSON.stringify(debugInfo, null, 2)}`)
    throw err
  }

  log('✓ Visual editor fully activated (banner present)')

  // Wait for VE to be fully initialized by checking if event handlers are attached
  // The undo button starts disabled and VE attaches handlers after initialization
  log('Waiting for VE event handlers to attach...')
  await page.waitForFunction(() => {
    // Check if clicking on elements would trigger VE handlers
    const para = document.querySelector('#test-paragraph')
    if (!para) return false

    // VE is ready when elements have the absmartly hover listener
    // We can verify by checking if the banner has interactive buttons
    const banner = document.querySelector('#absmartly-visual-editor-banner-host .banner')
    return banner !== null && banner.children.length > 0
  }, { timeout: 3000 })
  log('✓ VE event handlers attached')

  // Make a change to the paragraph
  const paragraph = page.locator('#test-paragraph')
  await paragraph.click() // Left-click to show context menu

  const contextMenu = page.locator('.menu-container')
  await expect(contextMenu).toBeVisible()

  const editTextButton = page.locator('.menu-item:has-text("Edit Text")')
  await editTextButton.click()

  // Wait for editable
  await page.waitForFunction(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.getAttribute('contenteditable') === 'true'
  })

  // Change the text
  await paragraph.fill('Discarded change')
  await page.locator('body').click({ position: { x: 10, y: 10 } })

  // Wait for change to be committed
  await page.waitForFunction(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.textContent?.trim() === 'Discarded change'
  })
  log('  ✓ Made a change: "Discarded change"')

  // Verify the change is visible on page
  const textBeforeDiscard = await page.evaluate(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.textContent?.trim()
  })
  expect(textBeforeDiscard).toBe('Discarded change')
  log('  ✓ Change is visible on page')

  // Click Exit button WITHOUT saving
  const exitButton = page.locator('button:has-text("Exit")').first()
  await expect(exitButton).toBeVisible()

  // Set up dialog handler to click "Yes" to discard
  page.once('dialog', async dialog => {
    log(`  💬 Dialog appeared: "${dialog.message()}"`)
    expect(dialog.message()).toContain('unsaved changes')
    await dialog.accept()
    log('  ✓ Accepted dialog (discarded changes)')
  })

  await exitButton.click()

  // Wait for VE to exit
  await page.waitForFunction(() => {
    return document.querySelector('.absmartly-toolbar') === null
  })
  log('  🚪 Exited visual editor')

  // Check if the change was properly cleaned up
  const textAfterDiscard = await page.evaluate(() => {
    const para = document.querySelector('#test-paragraph')
    return para?.textContent?.trim()
  })

  log(`  📝 Text after discard: "${textAfterDiscard}"`)
  log(`  📝 Expected original: "${originalText}"`)

  // Take screenshot to visually verify the bug
  await page.screenshot({ path: 'test-results/step11-after-discard.png', fullPage: true })
  log('  📸 Screenshot saved: step11-after-discard.png')

  // This SHOULD pass, but will FAIL due to the bug
  expect(textAfterDiscard).toBe(originalText)
  log('  ✅ Page correctly reverted to original state after discarding')

  // Also verify that changes were NOT saved to sidebar
  const savedChanges = await freshSidebar.locator('[data-testid="dom-change-item"]').count()
  expect(savedChanges).toBe(0)
  log('  ✅ Changes were NOT saved to sidebar')

  log('\n✅ Discard changes test PASSED!')
  log('  • Page correctly reverts when changes are discarded')
  log('  • Changes are not saved to sidebar when discarded')
}
