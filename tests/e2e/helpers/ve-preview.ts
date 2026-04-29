import { type Page, type FrameLocator, expect } from '@playwright/test'
import { debugWait, log } from '../utils/test-helpers'

export async function testPreviewToggle(sidebar: FrameLocator, page: Page): Promise<void> {

  const initialPreviewState = await page.evaluate(() => {
    const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
    const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')
    return {
      modifiedElementsCount: modifiedElements.length,
      experimentMarkersCount: experimentMarkers.length
    }
  })
  expect(initialPreviewState.modifiedElementsCount).toBe(0)
  expect(initialPreviewState.experimentMarkersCount).toBe(0)
  log('  ✓ Preview is disabled')

  await page.screenshot({ path: 'test-results/preview-toggle-before-enable.png', fullPage: true })

  await page.evaluate(() => {
    (window as any).__previewMessages = []
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'absmartly-extension' || event.data?.type?.includes('PREVIEW')) {
        (window as any).__previewMessages.push({
          type: event.data.type,
          source: event.data.source,
          time: Date.now()
        })
      }
    })
  })

  const previewToggle = sidebar.locator('#preview-variant-1')
  await previewToggle.waitFor({ state: 'visible', timeout: 5000 })

  const toggleState = await previewToggle.evaluate((btn) => ({
    className: btn.className,
    disabled: (btn as HTMLButtonElement).disabled,
    textContent: btn.textContent?.trim()
  }))
  log(`  Toggle state before click: disabled=${toggleState.disabled}, text="${toggleState.textContent}", class="${toggleState.className.substring(0, 80)}"`)

  await previewToggle.click()
  log('  Clicked preview toggle (enable)')

  const pageAliveAfterEnable = await page.evaluate(() => true).catch(() => false)
  log(`  Page alive after enable click: ${pageAliveAfterEnable}`)
  if (!pageAliveAfterEnable) throw new Error('Page crashed after preview enable click')

  await page.screenshot({ path: 'test-results/preview-toggle-after-click.png', fullPage: true })

  const toggleStateAfter = await previewToggle.evaluate((btn) => ({
    className: btn.className,
    textContent: btn.textContent?.trim()
  }))
  log(`  Toggle state after click: text="${toggleStateAfter.textContent}", class="${toggleStateAfter.className.substring(0, 80)}"`)

  const consoleMsgs: Array<{type: string, text: string}> = []
  const consoleHandler = (msg: any) => {
    consoleMsgs.push({ type: msg.type(), text: msg.text() })
  }
  page.on('console', consoleHandler)

  let changesAppeared = false
  for (let i = 0; i < 20; i++) {
    const alive = await page.evaluate(() => true).catch(() => false)
    if (!alive) {
      log(`  Page died during poll iteration ${i}`)
      throw new Error(`Page died during preview poll iteration ${i}`)
    }

    const count = await page.evaluate(() =>
      document.querySelectorAll('[data-absmartly-modified]').length
    )

    if (count > 0) {
      changesAppeared = true
      log(`  DOM changes appeared after ${i * 250}ms (count=${count})`)
      break
    }

    if (i === 0 || i === 4 || i === 8) {
      const previewMsgs = await page.evaluate(() => (window as any).__previewMessages || [])
      const newMsgs = consoleMsgs.filter(m => m.text.includes('ABSmartly Content Script') || m.text.includes('Messaging') || m.text.includes('preview'))
      log(`  Poll ${i}: no changes, postMessage received: ${previewMsgs.length}, new console msgs: ${newMsgs.length}`)
      for (const msg of previewMsgs) {
        log(`    postMessage: type=${msg.type}, source=${msg.source}`)
      }
      for (const msg of newMsgs) {
        log(`    console: [${msg.type}] ${msg.text.substring(0, 200)}`)
      }
    }

    await new Promise(r => setTimeout(r, 250))
  }

  page.off('console', consoleHandler)

  if (!changesAppeared) {
    await page.screenshot({ path: 'test-results/preview-toggle-no-changes.png', fullPage: true })
    const errors = consoleMsgs.filter(m => m.type === 'error')
    const absmartlyMsgs = consoleMsgs.filter(m => m.text.includes('ABSmartly') || m.text.includes('absmartly') || m.text.includes('Preview') || m.text.includes('preview') || m.text.includes('SDK') || m.text.includes('bridge'))
    log(`  Total console messages: ${consoleMsgs.length}, errors: ${errors.length}`)
    log(`  ABsmartly/preview related messages:`)
    for (const msg of absmartlyMsgs) {
      log(`    [${msg.type}] ${msg.text.substring(0, 300)}`)
    }
    if (errors.length > 0) {
      log(`  All errors:`)
      for (const err of errors) {
        log(`    ${err.text.substring(0, 300)}`)
      }
    }

    const domState = await page.evaluate(() => {
      const modified = document.querySelectorAll('[data-absmartly-modified]')
      const experiment = document.querySelectorAll('[data-absmartly-experiment]')
      const previewHeader = document.getElementById('absmartly-preview-header')
      return {
        modifiedCount: modified.length,
        experimentCount: experiment.length,
        previewHeaderExists: previewHeader !== null,
        bodyChildCount: document.body.children.length
      }
    })
    log(`  DOM state: modified=${domState.modifiedCount}, experiment=${domState.experimentCount}, previewHeader=${domState.previewHeaderExists}, bodyChildren=${domState.bodyChildCount}`)

    throw new Error('DOM changes did not appear after enabling preview. Check screenshots and console errors above.')
  }

  await page.screenshot({ path: 'test-results/preview-toggle-after-enable.png', fullPage: true })

  const enabledStates = await page.evaluate(() => {
    const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
    const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')
    const insertedAfter = document.querySelector('.inserted-block')
    const insertedBefore = document.querySelector('.inserted-block-before')
    return {
      modifiedCount: modifiedElements.length,
      experimentMarkersCount: experimentMarkers.length,
      insertedAfterPresent: insertedAfter !== null,
      insertedBeforePresent: insertedBefore !== null
    }
  })

  log(`  ✓ DOM changes applied (modified=${enabledStates.modifiedCount}, markers=${enabledStates.experimentMarkersCount})`)
  log(`  Inserted blocks after preview re-enable: after=${enabledStates.insertedAfterPresent}, before=${enabledStates.insertedBeforePresent}`)

  expect(enabledStates.modifiedCount).toBeGreaterThan(0)
  // Round-trip guard: inserted blocks must survive a preview-off / preview-on
  // cycle. With direct-DOM in the VE this trivially passed (the elements were
  // already in the DOM). With the new SDK path it actually exercises the
  // create→remove→re-create flow through PreviewManager — the regression that
  // hid the original 'insert' vs 'create' bug.
  expect(enabledStates.insertedAfterPresent).toBe(true)
  expect(enabledStates.insertedBeforePresent).toBe(true)
  expect(enabledStates.experimentMarkersCount).toBeGreaterThan(0)

  await previewToggle.click()
  log('  Clicked preview toggle (disable)')

  const pageAliveAfterDisable = await page.evaluate(() => true).catch(() => false)
  if (!pageAliveAfterDisable) throw new Error('Page crashed after preview disable click')

  await page.waitForFunction(() => {
    const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
    return modifiedElements.length === 0
  }, { timeout: 5000 })

  await page.screenshot({ path: 'test-results/preview-toggle-after-disable.png', fullPage: true })

  const disabledStates = await page.evaluate(() => {
    const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
    const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')
    const insertedAfter = document.querySelector('.inserted-block')
    const insertedBefore = document.querySelector('.inserted-block-before')
    return {
      modifiedCount: modifiedElements.length,
      experimentMarkersCount: experimentMarkers.length,
      insertedAfterPresent: insertedAfter !== null,
      insertedBeforePresent: insertedBefore !== null
    }
  })

  const changesReverted = disabledStates.modifiedCount === 0 && disabledStates.experimentMarkersCount === 0
  log(`  ${changesReverted ? '✓' : '✗'} DOM changes reverted`)
  log(`  Inserted blocks after preview disable: after=${disabledStates.insertedAfterPresent}, before=${disabledStates.insertedBeforePresent}`)

  expect(disabledStates.modifiedCount).toBe(0)
  expect(disabledStates.experimentMarkersCount).toBe(0)
  // Round-trip guard: created elements must be torn down when preview is
  // disabled. Without PreviewManager.createdElementsMap they would linger.
  expect(disabledStates.insertedAfterPresent).toBe(false)
  expect(disabledStates.insertedBeforePresent).toBe(false)

  log('\n✅ Preview toggle test completed')
  await debugWait()
}
