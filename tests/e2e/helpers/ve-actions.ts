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
  await page.locator('.menu-container').waitFor({ state: 'visible' })
  await page.locator('.menu-item[data-action="editHtml"]').click()

  await page.locator('.cm-editor').waitFor({ state: 'visible' })
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

  await page.keyboard.press('Meta+A')
  await page.keyboard.type('<h2>HTML Edited!</h2><p>New paragraph content</p>')
  await debugWait()

  await page.locator('.editor-button-save').waitFor({ state: 'visible' })
  await debugWait()

  await page.evaluate(() => {
    const saveBtn = document.querySelector('.editor-button-save') as HTMLButtonElement
    if (saveBtn) {
      saveBtn.click()
    }
  })

  try {
    await page.locator('.cm-editor').waitFor({ state: 'hidden', timeout: 5000 })
  } catch (err) {
    // Editor did not close, continuing
  }

  await debugWait()

  // Action 5: Insert new block
  await page.click('h2', { force: true })
  await page.locator('.menu-container').waitFor({ state: 'visible' })
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

  await page.keyboard.press('Meta+A')
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

  const insertedBlockExists = await page.evaluate(() => {
    const h2 = document.querySelector('h2')
    if (!h2) return false
    const nextElement = h2.nextElementSibling
    return nextElement?.classList.contains('inserted-block') || false
  })
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
      button2Display: button2 ? window.getComputedStyle(button2).display : null,
      testContainerHTML: testContainer?.innerHTML?.trim()
    }
  })

  expect(appliedChanges.paragraphText).toBe('Modified text!')
  log('  ✓ Text change applied')

  expect(appliedChanges.button1Display).toBe('none')
  log('  ✓ Hide change applied')

  expect(appliedChanges.button2Display).toBe('none')
  log('  ✓ Delete change applied')

  expect(appliedChanges.testContainerHTML).toMatch(/<h2[^>]*>HTML Edited!<\/h2>/)
  expect(appliedChanges.testContainerHTML).toContain('<p>New paragraph content</p>')
  log('  ✓ HTML change applied')

  log('✅ All DOM changes verified')
  await debugWait()
}
