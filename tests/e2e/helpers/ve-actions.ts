import { type Page, expect } from '@playwright/test'
import { log, click, debugWait } from '../utils/test-helpers'
import { clickContextMenuItem } from '../utils/visual-editor-helpers'

/**
 * Comprehensive test for all visual editor actions
 * Tests: Edit Text, Hide, Delete, Edit HTML, Insert Block, Change Image Source
 */
export async function testAllVisualEditorActions(page: Page): Promise<void> {
  log('\n🧪 STEP 4: Testing visual editor context menu actions')

  // Action 1: Edit Text on paragraph
  log('  Testing: Edit Text on #test-paragraph')
  await click(page, '#test-paragraph')
  await clickContextMenuItem(page, 'Edit Text')
  await page.keyboard.type('Modified text!')
  await page.keyboard.press('Enter')
  await debugWait()

  // Action 2: Hide element
  log('  Testing: Hide on #button-1')
  await click(page, '#button-1')
  await clickContextMenuItem(page, 'Hide')
  await debugWait()

  // Action 3: Delete element
  log('  Testing: Delete on #button-2')
  await click(page, '#button-2')
  await clickContextMenuItem(page, 'Delete')
  await debugWait()

  // Action 4: Edit HTML with CodeMirror editor on parent container
  log('  Testing: Edit HTML on #test-container')
  await page.click('#test-container', { force: true })
  await page.locator('.menu-container').waitFor({ state: 'visible' })
  await page.locator('.menu-item:has-text("Edit HTML")').click()

  await page.locator('.cm-editor').waitFor({ state: 'visible' })
  log('  ✓ CodeMirror editor appeared')
  await debugWait()

  const hasCodeMirrorSyntaxHighlight = await page.evaluate(() => {
    const editor = document.querySelector('.cm-editor')
    if (!editor) return false
    const hasContent = editor.querySelector('.cm-content')
    const hasScroller = editor.querySelector('.cm-scroller')
    return !!(hasContent && hasScroller)
  })
  log(`  ${hasCodeMirrorSyntaxHighlight ? '✓' : '✗'} CodeMirror syntax highlighting: ${hasCodeMirrorSyntaxHighlight}`)
  expect(hasCodeMirrorSyntaxHighlight).toBeTruthy()
  await debugWait()

  await page.evaluate(() => {
    const editor = document.querySelector('.cm-content') as HTMLElement
    if (editor) {
      editor.focus()
      console.log('[Test] Focused CodeMirror editor')
    }
  })

  await page.keyboard.press('Meta+A')
  await page.keyboard.type('<h2>HTML Edited!</h2><p>New paragraph content</p>')
  log('  ✓ Updated HTML via CodeMirror')
  await debugWait()

  log('  Looking for Save button...')
  await page.locator('.editor-button-save').waitFor({ state: 'visible' })
  await debugWait()

  log('  Clicking Save button with JavaScript click...')
  await page.evaluate(() => {
    const saveBtn = document.querySelector('.editor-button-save') as HTMLButtonElement
    if (saveBtn) {
      console.log('[Test] Found save button, clicking...')
      saveBtn.click()
    } else {
      console.log('[Test] Save button not found!')
    }
  })
  log('  Clicked Save button')

  try {
    await page.locator('.cm-editor').waitFor({ state: 'hidden', timeout: 5000 })
    log('  Editor closed')
  } catch (err) {
    log('  ⚠️  Editor did not close within 5 seconds, continuing anyway...')
  }

  log('  ✓ Edit HTML with CodeMirror works')
  await debugWait()

  // Action 5: Insert new block
  log('  Testing: Insert new block after h2')
  await page.click('h2', { force: true })
  await page.locator('.menu-container').waitFor({ state: 'visible' })
  log('  ✓ Clicked h2 element and menu opened')
  await debugWait()

  await clickContextMenuItem(page, 'Insert new block')
  log('  ✓ Clicked "Insert new block" menu item')

  await page.locator('.cm-editor').waitFor({ state: 'visible', timeout: 5000 })
  log('  ✓ Insert block modal appeared with CodeMirror editor')

  await page.screenshot({ path: 'test-insert-block-modal.png', fullPage: true })
  log('  📸 Screenshot: test-insert-block-modal.png')

  const modalInfo = await page.evaluate(() => {
    const dialog = document.querySelector('#absmartly-block-inserter-host')
    const cmEditor = document.querySelector('.cm-editor')
    const insertBtn = document.querySelector('.inserter-button-insert')
    const previewContainer = document.querySelector('.inserter-preview-container')
    const positionRadios = document.querySelectorAll('input[type="radio"][name="position"]')
    return {
      dialogExists: !!dialog,
      dialogHTML: dialog ? dialog.outerHTML.substring(0, 500) : 'not found',
      cmEditorExists: !!cmEditor,
      insertBtnExists: !!insertBtn,
      insertBtnHTML: insertBtn ? insertBtn.outerHTML : 'not found',
      previewExists: !!previewContainer,
      positionRadiosCount: positionRadios.length
    }
  })
  log('  🔍 Modal structure:', JSON.stringify(modalInfo, null, 2))
  await debugWait()

  const hasPreviewContainer = await page.evaluate(() => {
    const previewContainer = document.querySelector('[data-testid="insert-block-preview"], .insert-block-preview, #insert-block-preview')
    return previewContainer !== null
  })
  log(`  ${hasPreviewContainer ? '✓' : '⚠️'} Preview container exists: ${hasPreviewContainer}`)
  await debugWait()

  const hasRadioButton = await page.locator('input[type="radio"][value="after"]').count()
  if (hasRadioButton > 0) {
    await page.locator('input[type="radio"][value="after"]').check()
    log('  ✓ Selected "After" position via radio button')
  } else {
    const hasDropdown = await page.locator('select[name="position"], #position-select').count()
    if (hasDropdown > 0) {
      await page.locator('select[name="position"], #position-select').selectOption('after')
      log('  ✓ Selected "After" position via dropdown')
    } else {
      log('  ⚠️  Position selector not found, will use default')
    }
  }
  await debugWait()

  await page.evaluate(() => {
    const editor = document.querySelector('.cm-content') as HTMLElement
    if (editor) {
      editor.focus()
      console.log('[Test] Focused CodeMirror editor for insert block')
    }
  })
  await debugWait()

  await page.keyboard.press('Meta+A')
  await page.keyboard.press('Backspace')
  await debugWait()

  const insertHTML = '<div class=\"inserted-block\">This is an inserted block!'
  await page.keyboard.type(insertHTML)
  log(`  ✓ Typed HTML into CodeMirror: ${insertHTML}`)
  await debugWait()

  if (hasPreviewContainer) {
    const previewContent = await page.evaluate(() => {
      const preview = document.querySelector('[data-testid="insert-block-preview"], .insert-block-preview, #insert-block-preview')
      return preview?.innerHTML || preview?.textContent
    })
    log(`  ${previewContent?.includes('inserted-block') ? '✓' : '⚠️'} Preview updated with content: ${previewContent?.substring(0, 50)}...`)
  }
  await debugWait()

  log('  Looking for Insert button...')
  const insertBtn = page.locator('.inserter-button-insert')
  await insertBtn.waitFor({ state: 'visible', timeout: 5000 })
  log('  ✓ Insert button found')

  const buttonInfo = await page.evaluate(() => {
    const btn = document.querySelector('.inserter-button-insert') as HTMLButtonElement
    return {
      exists: !!btn,
      disabled: btn?.disabled,
      className: btn?.className,
      listeners: btn ? Object.keys(btn).filter(k => k.startsWith('on') || k.includes('event')) : []
    }
  })
  log('  🔍 Button info:', JSON.stringify(buttonInfo))
  await debugWait()

  log('  Clicking Insert button...')
  await page.screenshot({ path: 'test-before-insert-click.png', fullPage: true })
  log('  📸 Screenshot before click: test-before-insert-click.png')

  const clickResult = await page.evaluate(() => {
    const btn = document.querySelector('.inserter-button-insert') as HTMLButtonElement
    if (!btn) return { error: 'Button not found' }

    let testListenerFired = false
    btn.addEventListener('click', () => {
      testListenerFired = true
      console.log('[Test] TEST LISTENER FIRED!')
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
  log('  ✓ Click result:', JSON.stringify(clickResult))

  await debugWait(500)

  const postClickInfo = await page.evaluate(() => {
    const dialog = document.querySelector('#absmartly-block-inserter-host')
    const h2 = document.querySelector('h2')
    const insertedBlock = document.querySelector('.inserted-block')

    return {
      dialogStillExists: !!dialog,
      h2Exists: !!h2,
      h2NextSibling: h2?.nextElementSibling?.className || 'none',
      insertedBlockExists: !!insertedBlock,
      insertedBlockHTML: insertedBlock ? insertedBlock.outerHTML : 'not found'
    }
  })
  log('  🔍 Post-click state:', JSON.stringify(postClickInfo, null, 2))

  await page.screenshot({ path: 'test-after-insert-click.png', fullPage: true })
  log('  📸 Screenshot after click: test-after-insert-click.png')

  try {
    await page.locator('.cm-editor').waitFor({ state: 'hidden', timeout: 5000 })
    log('  ✓ Insert block modal closed')
  } catch (err) {
    log('  ⚠️  Modal did not close within 5 seconds, continuing anyway...')
  }
  await debugWait()

  const insertedBlockExists = await page.evaluate(() => {
    const h2 = document.querySelector('h2')
    if (!h2) return false
    const nextElement = h2.nextElementSibling
    return nextElement?.classList.contains('inserted-block') || false
  })
  log(`  ${insertedBlockExists ? '✓' : '✗'} Inserted block exists after h2: ${insertedBlockExists}`)
  expect(insertedBlockExists).toBeTruthy()
  await debugWait()

  const insertedContent = await page.evaluate(() => {
    const insertedBlock = document.querySelector('.inserted-block')
    return insertedBlock?.textContent?.trim()
  })
  log(`  ${insertedContent === 'This is an inserted block!' ? '✓' : '✗'} Inserted content correct: "${insertedContent}"`)
  expect(insertedContent).toBe('This is an inserted block!')
  await debugWait()

  const changeCountAfterInsert = await page.evaluate(() => {
    const banner = document.querySelector('#absmartly-visual-editor-banner-host')
    if (banner?.shadowRoot) {
      const counter = banner.shadowRoot.querySelector('.changes-counter')
      return counter?.textContent?.trim() || '0'
    }
    const counter = document.querySelector('.changes-counter')
    return counter?.textContent?.trim() || '0'
  })
  log(`  ✓ Changes counter after insert: ${changeCountAfterInsert}`)
  await debugWait()

  log('  ✅ Insert new block test completed successfully')
  await debugWait()

  // Action 6: Change image source
  log('  Testing: Change image source on img element')

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
  log('  ✓ Added test image to page')

  await page.locator('#test-image').scrollIntoViewIfNeeded()
  await page.locator('#test-image').click({ force: true })
  await page.locator('.menu-container').waitFor({ state: 'visible', timeout: 5000 })
  log('  ✓ Context menu opened for image')

  const changeImageOption = page.locator('.menu-item:has-text("Change image source")')
  await changeImageOption.waitFor({ state: 'visible', timeout: 2000 })
  log('  ✓ "Change image source" option is visible')

  await changeImageOption.click()
  log('  ✓ Clicked "Change image source"')

  await page.locator('#absmartly-image-dialog-host').waitFor({ state: 'visible', timeout: 5000 })
  log('  ✓ Image source dialog opened')

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
  log(`  ✓ Entered new image URL: ${newImageUrl}`)

  await page.evaluate(() => {
    const dialogHost = document.querySelector('#absmartly-image-dialog-host')
    if (dialogHost?.shadowRoot) {
      const applyButton = dialogHost.shadowRoot.querySelector('.dialog-button-apply') as HTMLButtonElement
      if (applyButton) {
        applyButton.click()
      }
    }
  })
  log('  ✓ Clicked Apply button')

  await page.locator('#absmartly-image-dialog-host').waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})

  const dialogStillVisible = await page.locator('#absmartly-image-dialog-host').isVisible({ timeout: 500 }).catch(() => false)
  expect(dialogStillVisible).toBe(false)
  log('  ✓ Image source dialog closed after clicking Apply')

  const menuReopened = await page.locator('.menu-container').isVisible({ timeout: 1000 }).catch(() => false)
  expect(menuReopened).toBe(false)
  log('  ✅ Context menu did NOT reopen (bug is fixed!)')

  const updatedSrc = await page.evaluate(() => {
    const img = document.querySelector('#test-image') as HTMLImageElement
    return img?.src
  })
  expect(updatedSrc).toBe(newImageUrl)
  log(`  ✓ Image source updated to: ${updatedSrc}`)

  await debugWait()

  log('✅ Visual editor actions tested (Edit Text, Hide, Delete, Edit HTML, Insert Block, Change Image Source)')

  // Verify the actual DOM changes were applied
  log('\n✓ Verifying DOM changes were actually applied...')
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

  log('  Applied changes:', appliedChanges)

  expect(appliedChanges.paragraphText).toBe('Modified text!')
  log('  ✓ Text change applied: paragraph text is "Modified text!"')

  expect(appliedChanges.button1Display).toBe('none')
  log('  ✓ Hide change applied: button-1 is display:none')

  expect(appliedChanges.button2Display).toBe('none')
  log('  ✓ Delete change applied: button-2 is hidden (display:none)')

  expect(appliedChanges.testContainerHTML).toMatch(/<h2[^>]*>HTML Edited!<\/h2>/)
  expect(appliedChanges.testContainerHTML).toContain('<p>New paragraph content</p>')
  log('  ✓ HTML change applied: test-container has new HTML')

  log('✅ All DOM changes verified and applied correctly')
  await debugWait()
}
