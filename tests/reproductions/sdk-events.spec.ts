import { test, expect } from './fixture'
import type { FrameLocator, Page } from '@playwright/test'

// FT-2253: SDK Events delivery and Event Details keyboard handling, driven by
// the real SDK in the page. The page below is served by this spec only; its
// publisher is local and can be told to fail so the SDK emits a real error.
const pageHtml = `<!doctype html><html><head><meta charset="utf-8"><title>SDK events fixture</title></head><body>
<p id="sdk-status">Initializing</p>
<button id="goal" type="button">Track one goal</button>
<script src="/sdk.js"></script>
<script>
  const sdk = new absmartly.SDK({
    client: { getContext: () => { throw new Error('offline') }, publish: () => { throw new Error('offline') }, request: () => { throw new Error('offline') } },
    provider: { getContextData: () => Promise.resolve({ experiments: [] }) },
    publisher: { publish: () => window.failPublish ? Promise.reject(new Error('fixture publish failure')) : Promise.resolve() },
  })
  const data = { experiments: [{ id: 1, name: 'ft2253_exp', unitType: 'fixture_user', iteration: 1, seedHi: 1, seedLo: 2, split: [0.5, 0.5], trafficSeedHi: 3, trafficSeedLo: 4, trafficSplit: [0, 1], fullOnVariant: 0, audience: '', audienceStrict: false, applications: [], variants: [{ name: 'A', config: '{}' }, { name: 'B', config: '{}' }] }] }
  const context = sdk.createContextWith({ units: { fixture_user: 'ft2253' } }, data, { publishDelay: -1, refreshPeriod: 0 })
  window.ABsmartlyContext = context
  context.ready().then(() => { document.getElementById('sdk-status').textContent = 'SDK ready' })
  document.getElementById('goal').addEventListener('click', () => context.track('clicked_goal', { source: 'button' }))
</script></body></html>`

const rows = (sidebar: FrameLocator) => sidebar.locator('#events-debug-event-list [data-testid="event-item"]')
const viewerHost = (page: Page) => page.locator('#absmartly-event-viewer-host')

async function openSdkEvents(page: Page, origin: string, mount: () => Promise<void>) {
  await page.route(`${origin}/ft2253-sdk-events.html`, route => route.fulfill({ contentType: 'text/html', body: pageHtml }))
  await page.goto(`${origin}/ft2253-sdk-events.html`)
  await expect(page.locator('#sdk-status')).toHaveText('SDK ready')
  await mount()
  const sidebar = page.frameLocator('#absmartly-sidebar-iframe')
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(origin)
  await sidebar.locator('#save-settings-button').click()
  return sidebar
}

async function reopenSdkEvents(sidebar: FrameLocator) {
  await sidebar.locator('#header-back-button').click()
  await sidebar.locator('#nav-events').click()
  await expect(sidebar.locator('#events-debug-event-count')).toBeVisible()
}

test('Escape closes Event Details opened from an event card in the sidebar', async ({ page, origin, mount }, testInfo) => {
  const sidebar = await openSdkEvents(page, origin, mount)
  await sidebar.locator('#nav-events').click()
  await page.locator('#goal').click()
  const goal = rows(sidebar).and(sidebar.locator('[data-event-name="goal"]'))
  await expect(goal).toHaveCount(1)
  await goal.click()
  await expect(viewerHost(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(viewerHost(page)).toHaveCount(0)
  // Reopening and closing again still works, and the sidebar stays usable.
  await goal.click()
  await expect(viewerHost(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(viewerHost(page)).toHaveCount(0)
  await expect(sidebar.locator('#events-debug-pause-button')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('escape-closed.png') })
})

test('events emitted together are all kept when SDK Events is opened later', async ({ page, origin, mount }) => {
  const sidebar = await openSdkEvents(page, origin, mount)
  await page.evaluate(() => {
    const context = (window as any).ABsmartlyContext
    context.treatment('ft2253_exp')
    for (let i = 0; i < 5; i++) context.track('same_tick_goal', { i })
  })
  await sidebar.locator('#nav-events').click()
  // exposure + 5 goals (ready is not emitted by createContextWith)
  await expect(rows(sidebar)).toHaveCount(6)
  await expect(rows(sidebar).and(sidebar.locator('[data-event-name="exposure"]'))).toHaveCount(1)
  await reopenSdkEvents(sidebar)
  await expect(rows(sidebar)).toHaveCount(6)
})

test('a burst of SDK events does not lock the sidebar out of its own requests', async ({ page, origin, mount }) => {
  const sidebar = await openSdkEvents(page, origin, mount)
  await sidebar.locator('#nav-events').click()
  await page.evaluate(() => {
    const context = (window as any).ABsmartlyContext
    for (let i = 0; i < 150; i++) context.track('burst_goal', { i })
  })
  await expect(rows(sidebar)).toHaveCount(150)
  // Reopening reads the buffer through the background (GET_BUFFERED_EVENTS).
  await reopenSdkEvents(sidebar)
  await expect(rows(sidebar)).toHaveCount(150)
  await expect(sidebar.locator('#events-debug-event-count')).toHaveText('150 events captured')
})

test('SDK error events keep the error message', async ({ page, origin, mount }) => {
  const sidebar = await openSdkEvents(page, origin, mount)
  await sidebar.locator('#nav-events').click()
  await page.evaluate(() => {
    ;(window as any).failPublish = true
    const context = (window as any).ABsmartlyContext
    context.track('before_failed_publish')
    return context.publish().catch(() => undefined)
  })
  const error = rows(sidebar).and(sidebar.locator('[data-event-name="error"]'))
  await expect(error).toHaveCount(1)
  await expect(error).toContainText('fixture publish failure')
  await error.click()
  await expect(viewerHost(page).locator('.cm-content')).toContainText('fixture publish failure')
})
