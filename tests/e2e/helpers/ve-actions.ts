import { type Page, expect } from '@playwright/test'
import { log, click, debugWait } from '../utils/test-helpers'
import { clickContextMenuItem } from '../utils/visual-editor-helpers'

/**
 * Comprehensive test for all visual editor actions
 * Tests: Edit Text, Hide, Delete, Edit HTML, Insert Block, Change Image Source
 */
export async function testAllVisualEditorActions(page: Page): Promise<void> {
  // Action 1: Edit Text on paragraph
  await click(page, '#test-paragraph')
  await clickContextMenuItem(page, 'Edit Text')
  await page.keyboard.type('Modified text!')
  await page.keyboard.press('Enter')
  await debugWait()

  // Action 2: Hide element
  await click(page, '#button-1')
  await clickContextMenuItem(page, 'Hide')
  await debugWait()

  // Action 3: Delete element
  await click(page, '#button-2')
  await clickContextMenuItem(page, 'Delete')
  await debugWait()

  // Action 4: Edit HTML with CodeMirror editor on parent container
  await page.click('#test-container', { force: true })
  await page.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })
  await page.locator('.menu-item[data-action="editHtml"]').click()

  await page.locator('.cm-editor').waitFor({ state: 'visible', timeout: 5000 })
  await debugWait()

  const hasCodeMirrorSyntaxHighlight = await page.evaluate(() => {
    const editor = document.querySelector('.cm-editor')
    if (!editor) return false
    const hasContent = editor.querySelector('.cm-content')
    const hasScroller = editor.querySelector('.cm-scroller')
    return !!(hasContent && hasScroller)
  })
  log(`  ${hasCodeMirrorSyntaxHighlight ? '✓' : '✗'} CodeMirror syntax highlighting`)
  expect(hasCodeMirrorSyntaxHighlight).toBeTruthy()
  await debugWait()

  await page.evaluate(() => {
    const editor = document.querySelector('.cm-content') as HTMLElement
    if (editor) {
      editor.focus()
    }
  })

  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('<h2>HTML Edited!</h2><p>New paragraph content</p>')
  await debugWait()

  await page.locator('.editor-button-save').waitFor({ state: 'visible', timeout: 5000 })
  await debugWait()

  // Use Playwright's locator.click() rather than evaluate(btn.click()) —
  // synthetic .click() in the page context doesn't always trigger React's
  // onClick the same way in prod builds, and CI runs against the prod
  // bundle. Real Playwright click goes through CDP and dispatches the
  // full event sequence React expects.
  await page.locator('.editor-button-save').click()

  try {
    await page.locator('.cm-editor').waitFor({ state: 'hidden', timeout: 5000 })
  } catch (err) {
    // Editor did not close, continuing
  }

  // Wait for the SDK postMessage round-trip to actually rewrite
  // #test-container's innerHTML before clicking the new h2. Without
  // this, Playwright's click can resolve the old <h2 id="section-title">
  // element that's still in the DOM tree mid-transition (its parent is
  // being replaced) and the force click fails with "Element is not
  // visible" because it's in a zero-size detached state. Headless CI
  // surfaces this race; locally the postMessage lands well before the
  // next action.
  // locator.waitFor is preferred over page.waitForFunction(fn, opts)
  // here — the latter's overload treats a single trailing object as
  // `arg`, not `options`, silently using the test-budget timeout.
  await page
    .locator("#test-container h2")
    .filter({ hasText: "HTML Edited!" })
    .waitFor({ state: "attached", timeout: 5000 })

  await debugWait()

  // Action 5: Insert new block
  await page.click('h2', { force: true })
  await page.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })
  await debugWait()

  await clickContextMenuItem(page, 'Insert new block')

  await page.locator('.cm-editor').waitFor({ state: 'visible', timeout: 5000 })

  await page.screenshot({ path: 'test-insert-block-modal.png', fullPage: true })

  const hasPreviewContainer = await page.evaluate(() => {
    const previewContainer = document.querySelector('[data-testid="insert-block-preview"], .insert-block-preview, #insert-block-preview')
    return previewContainer !== null
  })
  await debugWait()

  const hasRadioButton = await page.locator('input[type="radio"][value="after"]').count()
  if (hasRadioButton > 0) {
    await page.locator('input[type="radio"][value="after"]').check()
  } else {
    const hasDropdown = await page.locator('select[name="position"], #position-select').count()
    if (hasDropdown > 0) {
      await page.locator('select[name="position"], #position-select').selectOption('after')
    }
  }
  await debugWait()

  await page.evaluate(() => {
    const editor = document.querySelector('.cm-content') as HTMLElement
    if (editor) {
      editor.focus()
    }
  })
  await debugWait()

  // Clear the cm-editor before typing the test HTML. Use ControlOrMeta
  // (Cmd on macOS, Ctrl on Linux/Windows) — bare 'Meta+A' resolves to
  // the Super/Windows key on Linux runners and does NOT trigger
  // select-all, so the block-inserter's default placeholder
  // (`<div class="new-block">...New content...</div>`) survives and
  // gets concatenated with the user-typed HTML in the resulting
  // create-change payload. CI run 25122478904 shard 3's diagnostic
  // captured exactly this — both new-block and inserted-block ended
  // up in the DOM, breaking the `h2 + .inserted-block` adjacency
  // check.
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Backspace')
  await debugWait()

  const insertHTML = '<div class=\"inserted-block\">This is an inserted block!'
  await page.keyboard.type(insertHTML)
  await debugWait()

  const insertBtn = page.locator('.inserter-button-insert')
  await insertBtn.waitFor({ state: 'visible', timeout: 5000 })

  await page.screenshot({ path: 'test-before-insert-click.png', fullPage: true })

  const clickResult = await page.evaluate(() => {
    const btn = document.querySelector('.inserter-button-insert') as HTMLButtonElement
    if (!btn) return { error: 'Button not found' }

    let testListenerFired = false
    btn.addEventListener('click', () => {
      testListenerFired = true
    }, { once: true })

    btn.click()

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    })
    btn.dispatchEvent(clickEvent)

    return {
      clicked: true,
      testListenerFired,
      buttonHTML: btn.outerHTML.substring(0, 100)
    }
  })

  await debugWait(500)

  await page.screenshot({ path: 'test-after-insert-click.png', fullPage: true })

  try {
    await page.locator('.cm-editor').waitFor({ state: 'hidden', timeout: 5000 })
  } catch (err) {
    // Modal did not close, continuing
  }
  await debugWait()

  // The 'Apply' click commits a 'create' DOMChange that lands via the
  // SDK postMessage round-trip — wait for the new .inserted-block to
  // appear as h2's adjacent sibling rather than reading once.
  // Using locator.waitFor here (not page.waitForFunction(fn, opts))
  // because the latter's overload resolution treats a single second
  // arg as `arg`, not options — passing { timeout: 10000 } silently
  // falls through to the test-budget default and the wait can run
  // for the entire 60s budget.
  // 20s ceiling: shard 3 of CI run 25121893575 saw the create change
  // round-trip stretch close to the 10s budget under contention with
  // sibling tests. 20s gives consistent headroom; locally it lands in
  // <100ms.
  const insertedBlockExists = await page
    .locator("h2 + .inserted-block")
    .waitFor({ state: "attached", timeout: 20000 })
    .then(() => true)
    .catch(() => false)
  if (!insertedBlockExists) {
    // Capture the actual DOM around #test-container so the failure
    // surfaces what the SDK applied (or didn't) instead of just a
    // boolean.
    const debugSnapshot = await page.evaluate(() => {
      const container = document.querySelector("#test-container")
      const h2 = document.querySelector("h2")
      const allInserted = document.querySelectorAll(".inserted-block")
      return {
        containerHTML: container?.innerHTML?.slice(0, 500) ?? "<missing>",
        h2Text: h2?.textContent?.trim() ?? "<no h2>",
        h2NextSibling:
          (h2?.nextElementSibling as HTMLElement | null)?.outerHTML?.slice(
            0,
            200
          ) ?? "<no next sibling>",
        insertedBlockCount: allInserted.length,
        firstInsertedParent:
          (allInserted[0]?.parentElement as HTMLElement | null)?.id ??
          "<no .inserted-block>"
      }
    })
    log(`  ✗ Inserted block missing — debug: ${JSON.stringify(debugSnapshot)}`)
    await page.screenshot({
      path: "test-results/insert-block-missing.png",
      fullPage: true
    })
  }
  log(`  ${insertedBlockExists ? '✓' : '✗'} Inserted block exists`)
  expect(insertedBlockExists).toBeTruthy()
  await debugWait()

  const insertedContent = await page.evaluate(() => {
    const insertedBlock = document.querySelector('.inserted-block')
    return insertedBlock?.textContent?.trim()
  })
  log(`  ${insertedContent === 'This is an inserted block!' ? '✓' : '✗'} Inserted content correct`)
  expect(insertedContent).toBe('This is an inserted block!')
  await debugWait()

  // Action 5b: Insert another block, this time BEFORE the heading
  await page.click('h2', { force: true })
  await page.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })
  await debugWait()

  await clickContextMenuItem(page, 'Insert new block')

  await page.locator('.cm-editor').waitFor({ state: 'visible', timeout: 5000 })
  await debugWait()

  // Toggle position to Before — block-inserter exposes
  // #block-inserter-position-before / #block-inserter-position-after with
  // a class-based selected indicator (position-btn-selected).
  const beforePositionBtn = page.locator('#block-inserter-position-before')
  await beforePositionBtn.waitFor({ state: 'visible', timeout: 2000 })
  await beforePositionBtn.click()
  await page
    .locator('#block-inserter-position-before.position-btn-selected')
    .waitFor({ state: 'attached', timeout: 2000 })

  // Replace the default editor content with our before-block markup
  await page.evaluate(() => {
    const editor = document.querySelector('.cm-content') as HTMLElement
    if (editor) editor.focus()
  })
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Backspace')
  await debugWait()

  const insertBeforeHTML = '<div class="inserted-block-before">This is a BEFORE block!'
  await page.keyboard.type(insertBeforeHTML)
  await debugWait()

  await page.locator('.inserter-button-insert').waitFor({ state: 'visible', timeout: 5000 })
  await page.evaluate(() => {
    const btn = document.querySelector('.inserter-button-insert') as HTMLButtonElement
    btn?.click()
  })

  try {
    await page.locator('.cm-editor').waitFor({ state: 'hidden', timeout: 5000 })
  } catch (err) {
    // Modal did not close, continuing
  }
  await debugWait()

  // Same SDK-apply race as the after-block: wait for the new
  // .inserted-block-before to appear as the h2's preceding sibling.
  // CSS has no "preceding sibling" combinator, so anchor by the new
  // element's class and check parent symmetry — equivalent to
  // h2.previousElementSibling.classList.contains('inserted-block-before')
  // expressed as locator-only.
  const beforeBlockExists = await page
    .locator(".inserted-block-before + h2")
    .waitFor({ state: "attached", timeout: 10000 })
    .then(() => true)
    .catch(() => false)
  log(`  ${beforeBlockExists ? '✓' : '✗'} Before-block exists as previousElementSibling of h2`)
  expect(beforeBlockExists).toBeTruthy()

  const beforeBlockContent = await page.evaluate(() => {
    return document.querySelector('.inserted-block-before')?.textContent?.trim()
  })
  log(`  ${beforeBlockContent === 'This is a BEFORE block!' ? '✓' : '✗'} Before-block content correct`)
  expect(beforeBlockContent).toBe('This is a BEFORE block!')
  await debugWait()

  // Action 6: Change image source

  await page.evaluate(() => {
    const img = document.createElement('img')
    img.id = 'test-image'
    img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC'
    img.alt = 'Test image'
    img.style.width = '150px'
    img.style.height = '150px'
    img.style.margin = '20px'
    img.style.display = 'block'
    img.style.position = 'relative'
    img.style.zIndex = '1'
    document.body.insertBefore(img, document.body.firstChild)
  })
  await page.locator('#test-image').waitFor({ state: 'visible', timeout: 2000 })

  await page.locator('#test-image').scrollIntoViewIfNeeded()
  await page.locator('#test-image').click({ force: true })
  await page.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })

  const changeImageOption = page.locator('.menu-item[data-action="change-image-source"]')
  await changeImageOption.waitFor({ state: 'visible', timeout: 2000 })

  await changeImageOption.click()

  await page.locator('#absmartly-image-dialog-host').waitFor({ state: 'visible', timeout: 5000 })

  const menuStillVisible = await page.locator('.menu-container').isVisible({ timeout: 1000 }).catch(() => false)
  expect(menuStillVisible).toBe(false)
  log('  ✓ Context menu closed after opening image dialog')

  const newImageUrl = 'https://via.placeholder.com/200'
  await page.evaluate((url) => {
    const dialogHost = document.querySelector('#absmartly-image-dialog-host')
    if (dialogHost?.shadowRoot) {
      const input = dialogHost.shadowRoot.querySelector('input.dialog-input') as HTMLInputElement
      if (input) {
        input.value = url
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
  }, newImageUrl)

  await page.evaluate(() => {
    const dialogHost = document.querySelector('#absmartly-image-dialog-host')
    if (dialogHost?.shadowRoot) {
      const applyButton = dialogHost.shadowRoot.querySelector('.dialog-button-apply') as HTMLButtonElement
      if (applyButton) {
        applyButton.click()
      }
    }
  })

  await page.locator('#absmartly-image-dialog-host').waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})

  const dialogStillVisible = await page.locator('#absmartly-image-dialog-host').isVisible({ timeout: 500 }).catch(() => false)
  expect(dialogStillVisible).toBe(false)
  log('  ✓ Image source dialog closed')

  const menuReopened = await page.locator('.menu-container').isVisible({ timeout: 1000 }).catch(() => false)
  expect(menuReopened).toBe(false)
  log('  ✓ Context menu did NOT reopen')

  const updatedSrc = await page.evaluate(() => {
    const img = document.querySelector('#test-image') as HTMLImageElement
    return img?.src
  })
  expect(updatedSrc).toBe(newImageUrl)
  log('  ✓ Image source updated')

  await debugWait()

  log('✅ Visual editor actions tested')

  // Verify the actual DOM changes were applied
  const appliedChanges = await page.evaluate(() => {
    const paragraph = document.querySelector('#test-paragraph')
    const button1 = document.querySelector('#button-1')
    const button2 = document.querySelector('#button-2')
    const testContainer = document.querySelector('#test-container')

    return {
      paragraphText: paragraph?.textContent?.trim(),
      button1Display: button1 ? window.getComputedStyle(button1).display : null,
      // 'delete' changes now actually remove the element via the SDK path
      // (case 'delete' → element.remove()). Pre-refactor the VE soft-deleted
      // by setting display:none, so this assertion was 'none'. With the
      // unified codepath the element is gone — assert the absence instead.
      button2Removed: button2 === null,
      testContainerHTML: testContainer?.innerHTML?.trim()
    }
  })

  expect(appliedChanges.paragraphText).toBe('Modified text!')
  log('  ✓ Text change applied')

  expect(appliedChanges.button1Display).toBe('none')
  log('  ✓ Hide change applied')

  expect(appliedChanges.button2Removed).toBe(true)
  log('  ✓ Delete change applied (element removed via SDK)')

  expect(appliedChanges.testContainerHTML).toMatch(/<h2[^>]*>HTML Edited!<\/h2>/)
  expect(appliedChanges.testContainerHTML).toContain('<p>New paragraph content</p>')
  log('  ✓ HTML change applied')

  log('✅ All DOM changes verified')
  await debugWait()
}
