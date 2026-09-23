import { test, expect } from './fixture'

test('packaged HTTP preview applies camelCase styles and restores them', async ({ page, origin }, testInfo) => {
  await page.goto(`${origin}/visual-editor-test.html`)
  await expect(page.locator('.test-button')).toHaveCount(3)
  const worker = page.context().serviceWorkers()[0] || await page.context().waitForEvent('serviceworker')
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
