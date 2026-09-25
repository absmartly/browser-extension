import { test, expect } from './fixture'
import type { FrameLocator, Page } from '@playwright/test'

const endpoint = 'https://fixture.absmartly.com'
const user = { id: 1, user_id: 1, first_name: 'Synthetic', last_name: 'Fixture', email: 'fixture@example.invalid' }
const base = { applications: [], unit_types: [], users: [], teams: [], tags: [], favorites: [], user }

// Default list filters request Draft/Ready, so every synthetic row is a draft.
const makeRows = (count: number) => Array.from({ length: count }, (_, i) => ({
  id: 5000 + i,
  name: `ft_2250_exp_${String(i + 1).padStart(3, '0')}`,
  display_name: `FT-2250 experiment ${i + 1}`,
  state: 'created',
  full_on_at: null,
  created_at: new Date(Date.UTC(2026, 8, 1) - i * 60000).toISOString(),
  variants: [{ variant: 0, name: 'Control', config: '{}' }, { variant: 1, name: 'Variant 1', config: '{}' }],
  applications: [], owners: [], teams: [], experiment_tags: [], feature_state: null
}))

async function serveExperiments(page: Page, rows: ReturnType<typeof makeRows>) {
  const requests: Array<{ page: number; items: number; search: string | null }> = []
  await page.context().route(`${endpoint}/**`, route => {
    const url = new URL(route.request().url())
    const detail = url.pathname.match(/^\/v1\/experiments\/(\d+)$/)
    if (detail) {
      const experiment = rows.find(row => row.id === Number(detail[1]))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ experiment }) })
    }
    if (url.pathname !== '/v1/experiments') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(base) })
    const search = url.searchParams.get('search')
    const pageNumber = Number(url.searchParams.get('page') || 1)
    const items = Number(url.searchParams.get('items') || 50)
    requests.push({ page: pageNumber, items, search })
    const matching = search ? rows.filter(row => row.name.includes(search)) : rows
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...base, experiments: matching.slice((pageNumber - 1) * items, pageNumber * items), total: matching.length }) })
  })
  return requests
}

async function configure(sidebar: FrameLocator) {
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
  await sidebar.locator('#save-settings-button').click()
  await expect(sidebar.locator('#experiments-heading')).toBeVisible()
}

const item = (sidebar: FrameLocator, n: number) => sidebar.locator(`[data-experiment-name="ft_2250_exp_${String(n).padStart(3, '0')}"]`)

async function expectPage(sidebar: FrameLocator, pageNumber: number, first: number, last: number, total: number) {
  await expect(sidebar.locator('#pagination-current-page')).toHaveText(String(pageNumber))
  await expect(sidebar.locator('#pagination-range')).toHaveText(`${first}-${last} of ${total}`)
  await expect(item(sidebar, first)).toBeVisible()
  await expect(sidebar.locator('[data-testid="experiment-list-item"]')).toHaveCount(last - first + 1)
}

test('packaged list pager follows numbered, Next and Previous navigation', async ({ page, sidebar }, testInfo) => {
  const requests = await serveExperiments(page, makeRows(125))
  await configure(sidebar)
  try {
    await expectPage(sidebar, 1, 1, 50, 125)
    await sidebar.locator('#pagination-next').click()
    await expectPage(sidebar, 2, 51, 100, 125)
    await sidebar.locator('#pagination-next').click()
    await expectPage(sidebar, 3, 101, 125, 125)
    await expect(sidebar.locator('#pagination-next')).toBeDisabled()
    await sidebar.locator('#pagination-previous').click()
    await expectPage(sidebar, 2, 51, 100, 125)
    await sidebar.locator('#pagination-last-page').click()
    await expectPage(sidebar, 3, 101, 125, 125)
    await sidebar.locator('#pagination-first-page').click()
    await expectPage(sidebar, 1, 1, 50, 125)
    await expect(sidebar.locator('#pagination-previous')).toBeDisabled()
    expect(requests.map(request => request.page)).toEqual([1, 2, 3, 2, 3, 1])
  } finally {
    await page.screenshot({ path: testInfo.outputPath('pager-final.png') })
    await testInfo.attach('list-requests', { body: JSON.stringify(requests), contentType: 'application/json' })
  }
})

test('packaged list pager resets on page-size and filter changes and survives Back from detail', async ({ page, sidebar }, testInfo) => {
  const requests = await serveExperiments(page, makeRows(125))
  await configure(sidebar)
  try {
    await sidebar.locator('#pagination-next').click()
    await expectPage(sidebar, 2, 51, 100, 125)

    await item(sidebar, 51).click()
    await expect(sidebar.locator('#header-back-button')).toBeVisible()
    await sidebar.locator('#header-back-button').click()
    await expectPage(sidebar, 2, 51, 100, 125)
    await sidebar.locator('#pagination-next').click()
    await expectPage(sidebar, 3, 101, 125, 125)

    await sidebar.locator('#pagination-page-size').selectOption('20')
    await expectPage(sidebar, 1, 1, 20, 125)
    await sidebar.locator('#pagination-next').click()
    await expectPage(sidebar, 2, 21, 40, 125)

    await sidebar.locator('#filter-search-input').fill('ft_2250_exp_0')
    await expectPage(sidebar, 1, 1, 20, 99)
    expect(requests.at(-1)).toEqual({ page: 1, items: 20, search: 'ft_2250_exp_0' })
  } finally {
    await page.screenshot({ path: testInfo.outputPath('pager-resets-final.png') })
    await testInfo.attach('list-requests', { body: JSON.stringify(requests), contentType: 'application/json' })
  }
})

for (const width of [240, 280, 320, 384]) {
  test(`packaged list header actions stay inside a ${width}px sidebar and remain usable`, async ({ page, sidebar }, testInfo) => {
    await serveExperiments(page, makeRows(3))
    await configure(sidebar)
    await page.locator('#absmartly-sidebar-iframe').evaluate((frame, w) => { (frame as HTMLElement).style.width = `${w}px` }, width)
    await expect.poll(() => sidebar.locator('body').evaluate(() => innerWidth)).toBe(width)
    const ids = ['experiments-heading', 'refresh-experiments-button', 'nav-events', 'nav-settings']
    const layout = await sidebar.locator('body').evaluate((body, ids) => {
      const rect = (id: string) => body.querySelector(`#${id}`)!.getBoundingClientRect().toJSON()
      const heading = body.querySelector('#experiments-heading') as HTMLElement
      const create = body.querySelector('#create-experiment-menu-button')!.getBoundingClientRect().toJSON()
      return {
        innerWidth, rects: Object.fromEntries(ids.map(id => [id, rect(id)])), create,
        headingTruncated: heading.scrollWidth > heading.clientWidth,
        hit: Object.fromEntries(ids.slice(1).map(id => {
          const r = body.querySelector(`#${id}`)!.getBoundingClientRect()
          return [id, (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button')?.id) || null]
        }))
      }
    }, ids)
    await testInfo.attach(`header-layout-${width}`, { body: JSON.stringify(layout, null, 2), contentType: 'application/json' })
    await page.screenshot({ path: testInfo.outputPath(`header-${width}.png`) })
    const actions = [layout.rects['refresh-experiments-button'], layout.create, layout.rects['nav-events'], layout.rects['nav-settings']]
    for (const r of actions) {
      expect(r.left).toBeGreaterThanOrEqual(0)
      expect(r.right).toBeLessThanOrEqual(width)
    }
    const heading = layout.rects['experiments-heading']
    for (const r of actions) {
      const overlaps = r.left < heading.right && r.right > heading.left && r.top < heading.bottom && r.bottom > heading.top
      expect(overlaps).toBe(false)
    }
    expect(layout.headingTruncated).toBe(false)
    for (const [id, hit] of Object.entries(layout.hit)) expect(hit).toBe(id)
    if (width === 384) {
      // Default width keeps the original single-row header.
      expect(Math.abs(heading.top + heading.bottom - layout.rects['nav-settings'].top - layout.rects['nav-settings'].bottom)).toBeLessThanOrEqual(2)
    }
    // The template panel opens below the (possibly wrapped) actions and must
    // not cover its own toggle; at the default width it keeps its old offset.
    await sidebar.locator('#create-experiment-menu-button').click()
    const panel = sidebar.locator('[data-create-experiment-panel]')
    await expect(panel).toBeVisible()
    const panelBox = await panel.evaluate(e => e.getBoundingClientRect().toJSON())
    await page.screenshot({ path: testInfo.outputPath(`create-panel-${width}.png`) })
    expect(panelBox.top).toBeGreaterThanOrEqual(Math.max(...actions.map(r => r.bottom)))
    expect(panelBox.left).toBe(0)
    expect(panelBox.right).toBe(width)
    if (width === 384) expect(panelBox.top).toBe(60)
    await sidebar.locator('#create-experiment-menu-button').click()
    await expect(panel).toBeHidden()

    await sidebar.locator('#nav-settings').focus()
    await page.keyboard.press('Enter')
    await expect(sidebar.locator('#save-settings-button')).toBeVisible()
  })
}
