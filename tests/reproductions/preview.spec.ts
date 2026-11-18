import type { Page } from '@playwright/test'
import { test, expect } from './fixture'

type PreviewAction = 'apply' | 'update' | 'remove'

const nextFrames = (page: Page) => page.evaluate(() => new Promise<void>(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
}))

async function previewSender(page: Page, experimentName: string) {
  const worker = page.context().serviceWorkers()[0] || await page.context().waitForEvent('serviceworker')
  return (action: PreviewAction, changes: unknown[] = []) => worker.evaluate(async ({ action, changes, experimentName }) => {
    const tabs = await chrome.tabs.query({})
    const tab = tabs.find(tab => tab.url?.includes('/visual-editor-test.html'))!
    return chrome.tabs.sendMessage(tab.id!, {
      type: 'ABSMARTLY_PREVIEW', action, experimentName, variantName: 'Variant 1', changes
    })
  }, { action, changes, experimentName })
}

async function openPreviewPage(page: Page, origin: string) {
  await page.goto(`${origin}/visual-editor-test.html`)
  await expect(page.locator('.test-button')).toHaveCount(3)
  await page.evaluate(() => {
    const fixture = document.createElement('section')
    fixture.id = 'preview-regression-fixture'
    fixture.innerHTML = `
      <div id="preview-sentinel">Sentinel</div>
      <div id="style-host"><button id="host-button">Click</button><input id="host-input"><span id="host-span">Original</span></div>
      <div id="structural-parent"><p id="structural-child">Original child</p></div>
      <div id="create-anchor"><span id="create-anchor-child">Anchor child</span></div>
      <div id="late-root"></div>`
    document.body.append(fixture)
    const win = window as typeof window & { previewNodes?: Record<string, Element>; previewClicks?: number }
    win.previewClicks = 0
    win.previewNodes = Object.fromEntries(['host-button', 'host-input', 'host-span', 'structural-child', 'create-anchor-child']
      .map(id => [id, document.getElementById(id)!]))
    document.getElementById('host-button')!.addEventListener('click', () => { win.previewClicks!++ })
    ;(document.getElementById('host-input') as HTMLInputElement).value = 'typed by page'
  })
}

const sameNode = (page: Page, id: string) => page.evaluate(id => {
  const win = window as typeof window & { previewNodes: Record<string, Element> }
  return document.getElementById(id) === win.previewNodes[id]
}, id)

test('packaged HTTP preview applies camelCase styles and restores them', async ({ page, origin }, testInfo) => {
  await page.goto(`${origin}/visual-editor-test.html`)
  await expect(page.locator('.test-button')).toHaveCount(3)
  const worker = page.context().serviceWorkers()[0] || await page.context().waitForEvent('serviceworker')
  const capturedTargets = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({})
    const tab = tabs.find(tab => tab.url?.includes('/visual-editor-test.html'))!
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => document.querySelectorAll('.test-button').length
    })
    return result[0].result
  })
  expect(capturedTargets).toBe(3)
  const send = (action: string) => worker.evaluate(async ({ action }) => {
    const tabs = await chrome.tabs.query({})
    const tab = tabs.find(tab => tab.url?.includes('/visual-editor-test.html'))!
    return chrome.tabs.sendMessage(tab.id!, {
      type: 'ABSMARTLY_PREVIEW', action, experimentName: 'FT-2244-file-preview', variantName: 'Variant 1',
      changes: [{ selector: '.test-button', type: 'style', value: { backgroundColor: 'orange' } }]
    })
  }, { action })
  const original = await page.locator('.test-button').first().evaluate(el => getComputedStyle(el).backgroundColor)
  await send('apply')
  try {
    await expect(page.locator('.test-button').first()).toHaveCSS('background-color', 'rgb(255, 165, 0)')
  } finally {
    await page.screenshot({ path: testInfo.outputPath('http-preview-applied.png') })
  }
  await send('remove')
  await expect(page.locator('.test-button').first()).toHaveCSS('background-color', original)
})

test('style preview removal keeps page-owned descendants, listeners and form state', async ({ page, origin }) => {
  await openPreviewPage(page, origin)
  const send = await previewSender(page, 'preview-style-identity')
  await send('apply', [{ selector: '#style-host', type: 'style', value: { backgroundColor: 'orange' } }])
  await expect(page.locator('#style-host')).toHaveCSS('background-color', 'rgb(255, 165, 0)')

  await send('remove')
  await expect(page.locator('#style-host')).not.toHaveAttribute('data-absmartly-modified', 'true')
  await expect(page.locator('#style-host')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  for (const id of ['host-button', 'host-input', 'host-span']) expect(await sameNode(page, id)).toBe(true)
  await expect(page.locator('#host-input')).toHaveValue('typed by page')
  await page.locator('#host-button').click()
  expect(await page.evaluate(() => (window as typeof window & { previewClicks: number }).previewClicks)).toBe(1)
})

test('overlapping ancestor and descendant previews restore one original descendant', async ({ page, origin }) => {
  await openPreviewPage(page, origin)
  const send = await previewSender(page, 'preview-overlap')
  await send('apply', [
    { selector: '#structural-parent', type: 'html', value: '<p id="structural-child">Preview child</p>' },
    { selector: '#structural-child', type: 'text', value: 'Preview descendant text' },
  ])
  await expect(page.locator('#structural-child')).toHaveText('Preview descendant text')

  await send('remove')
  await expect(page.locator('#structural-child')).toHaveText('Original child')
  await expect(page.locator('#structural-parent > p')).toHaveCount(1)
  expect(await sameNode(page, 'structural-child')).toBe(true)
})
