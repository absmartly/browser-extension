import { test, expect } from './fixture'
import type { Page, FrameLocator } from '@playwright/test'

const endpoint = 'https://fixture.absmartly.com'
const user = { id: 1, user_id: 1, first_name: 'Synthetic', last_name: 'Fixture', email: 'fixture@example.invalid' }
const experiment = {
  id: 501, name: 'ft_2251_draft', display_name: 'FT-2251 draft', state: 'created', status: 'created', type: 'test',
  percentage_of_traffic: 100, unit_type: { unit_type_id: 1, name: 'fixture_unit' }, unit_type_id: 1,
  applications: [], owners: [], teams: [], experiment_tags: [], feature_state: null, full_on_at: null,
  created_at: '2026-09-01T00:00:00Z', audience: '{"filter":[{"and":[]}]}', audience_strict: false,
  variants: [{ variant: 0, name: 'Control', config: '{}' }, { variant: 1, name: 'Variant 1', config: '{}' }]
}

test('packaged experiment detail tracks and validates traffic and keeps a Simple URL filter without DOM changes', async ({ page, sidebar }, testInfo) => {
  const puts: any[] = []
  await page.context().route(`${endpoint}/**`, route => {
    const url = new URL(route.request().url())
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/v1/experiments/501') {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON()
        const data = body.data || body
        puts.push(data)
        Object.assign(experiment, data)
      }
      return json({ experiment })
    }
    return json({ experiments: [experiment], total: 1, applications: [{ id: 1, application_id: 1, name: 'Fixture web' }], unit_types: [{ id: 1, unit_type_id: 1, name: 'fixture_unit' }], users: [user], teams: [], experiment_tags: [], favorites: [], user })
  })
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
  await sidebar.locator('#save-settings-button').click()
  await sidebar.locator('[data-experiment-name="ft_2251_draft"]').click()

  // Located via the pre-existing label ID so the spec runs unchanged against the unfixed build.
  const traffic = sidebar.locator('#traffic-label + div input')
  const save = sidebar.getByRole('button', { name: /Save Changes/ })
  await expect(save).toBeDisabled()
  await traffic.fill('42')
  await expect(save).toBeEnabled()
  await sidebar.locator('#header-back-button').click()
  await expect(sidebar.locator('#unsaved-changes-modal')).toBeVisible()
  await sidebar.locator('#unsaved-changes-cancel').click()
  await expect(traffic).toHaveValue('42')

  await traffic.fill('150')
  await expect(sidebar.locator('#traffic-percentage-input-error')).toHaveText('Traffic percentage must be between 0 and 100')
  await save.click()
  await expect(traffic).toBeFocused()
  expect(puts).toHaveLength(0)

  await traffic.fill('55')
  await expect(sidebar.locator('#traffic-percentage-input-error')).toHaveCount(0)
  await sidebar.locator('#url-filtering-toggle-variant-1').click()
  await sidebar.locator('#url-filter-mode-variant-1').selectOption('simple')
  await sidebar.locator('#url-filter-pattern-variant-1-0').fill('/products/*')
  await save.click()
  await expect.poll(() => puts.length).toBe(1)
  await expect(save).toBeDisabled()
  expect(JSON.parse(puts[0].variants[1].config)).toEqual({ __dom_changes: { changes: [], urlFilter: { include: ['/products/*'], mode: 'simple', matchType: 'path' } } })
  expect(puts.at(-1).percentage_of_traffic).toBe(55)

  await sidebar.locator('#header-back-button').click()
  await sidebar.locator('[data-experiment-name="ft_2251_draft"]').click()
  await sidebar.locator('#url-filtering-toggle-variant-1').click()
  await expect(sidebar.locator('#url-filter-mode-variant-1')).toHaveValue('simple')
  await expect(sidebar.locator('#url-filter-pattern-variant-1-0')).toHaveValue('/products/*')
  await page.screenshot({ path: testInfo.outputPath('detail-reopened.png') })
})

test('packaged experiment detail keeps a traffic edit unsaved when the update request fails', async ({ page, sidebar }) => {
  const draft = { ...experiment, id: 502, name: 'ft_2251_put_fail', display_name: 'FT-2251 put failure', percentage_of_traffic: 100 }
  let failPut = true
  const puts: any[] = []
  let failedPuts = 0
  await page.context().route(`${endpoint}/**`, route => {
    const url = new URL(route.request().url())
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/v1/experiments/502') {
      if (route.request().method() === 'PUT') {
        if (failPut) { failedPuts++; return json({ errors: ['synthetic update failure'] }, 500) }
        const body = route.request().postDataJSON()
        const data = body.data || body
        puts.push(data)
        Object.assign(draft, data)
      }
      return json({ experiment: draft })
    }
    return json({ experiments: [draft], total: 1, applications: [{ id: 1, application_id: 1, name: 'Fixture web' }], unit_types: [{ id: 1, unit_type_id: 1, name: 'fixture_unit' }], users: [user], teams: [], experiment_tags: [], favorites: [], user })
  })
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
  await sidebar.locator('#save-settings-button').click()
  await sidebar.locator('[data-experiment-name="ft_2251_put_fail"]').click()

  const traffic = sidebar.locator('#traffic-label + div input')
  const save = sidebar.getByRole('button', { name: /Save Changes/ })
  await traffic.fill('42')
  await expect(save).toBeEnabled()
  await save.click()
  // The API client retries 5xx responses with backoff before reporting the failure.
  await expect(sidebar.locator('#toast-container')).toContainText('API request failed with status 500', { timeout: 20000 })
  await expect(sidebar.locator('#toast-container [id^="toast-close-"]')).toHaveCount(1)
  await expect(save).toBeEnabled()
  expect(failedPuts).toBeGreaterThan(0)
  expect(puts).toHaveLength(0)

  await sidebar.locator('[id^="toast-close-"]').first().click()
  await sidebar.locator('#header-back-button').click()
  await expect(sidebar.locator('#unsaved-changes-modal')).toBeVisible()
  await sidebar.locator('#unsaved-changes-cancel').click()
  await expect(traffic).toHaveValue('42')

  failPut = false
  await save.click()
  await expect.poll(() => puts.length).toBe(1)
  expect(puts[0].percentage_of_traffic).toBe(42)
  await expect(save).toBeDisabled()
})

async function openNavigationDraft(page: Page, sidebar: FrameLocator, width: number, overrides: Partial<typeof experiment> = {}, enableAI = false, domFieldName?: string) {
  const draft = { ...experiment, ...overrides, id: 503, name: 'ft_2251_navigation', display_name: 'FT-2251 navigation', percentage_of_traffic: 100 }
  const state = { fail: '' as '' | 'GET' | 'PUT', puts: [] as any[], holdRefresh: false, refreshStarted: false, releaseRefresh: undefined as undefined | (() => void) }
  await page.locator('#absmartly-sidebar-iframe').evaluate((iframe, width) => {
    iframe.style.width = `${width}px`
  }, width)
  await page.context().route(`${endpoint}/**`, async route => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/v1/experiments/503') {
      if (state.fail === method) return json({ errors: ['synthetic navigation save failure'] }, 400)
      if (method === 'GET' && state.holdRefresh && state.puts.length > 0) {
        state.refreshStarted = true
        await new Promise<void>(resolve => { state.releaseRefresh = resolve })
      }
      if (method === 'PUT') {
        const body = route.request().postDataJSON()
        const data = body.data || body
        state.puts.push(data)
        Object.assign(draft, data)
      }
      return json({ experiment: draft })
    }
    return json({ experiments: [draft], total: 1, applications: [{ id: 1, application_id: 1, name: 'Fixture web' }], unit_types: [{ id: 1, unit_type_id: 1, name: 'fixture_unit' }], users: [user], teams: [], experiment_tags: [], favorites: [], user })
  })
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
  if (enableAI) await sidebar.locator('#vibe-studio-toggle').check()
  if (domFieldName) await sidebar.locator('#dom-changes-field-name').fill(domFieldName)
  await sidebar.locator('#save-settings-button').click()
  await sidebar.locator('[data-experiment-name="ft_2251_navigation"]').click()
  return state
}

for (const width of [384, 320]) {
  test(`detail keeps variant-name focus and persists character typing at ${width}px`, async ({ page, sidebar }) => {
    test.setTimeout(10000)
    const state = await openNavigationDraft(page, sidebar, width)
    const input = sidebar.locator('#variant-name-input-1')
    await input.click()
    await input.press('ControlOrMeta+A')
    await input.pressSequentially('Variant B', { delay: 40 })
    await expect(input).toHaveValue('Variant B')
    await expect(input).toBeFocused()
    await sidebar.locator('#experiment-detail-save').click()
    await expect.poll(() => state.puts.length).toBe(1)
    expect(state.puts[0].variants[1].name).toBe('Variant B')
    await expect(sidebar.locator('#experiment-detail-save')).toBeDisabled()
    await sidebar.locator('[id^="toast-close-"]').first().click()
    await sidebar.locator('#header-back-button').click()
    await sidebar.locator('[data-experiment-name="ft_2251_navigation"]').click()
    await expect(input).toHaveValue('Variant B')
  })

  test(`detail locks variant editing through the response refresh at ${width}px`, async ({ page, sidebar }) => {
    test.setTimeout(10000)
    const state = await openNavigationDraft(page, sidebar, width)
    state.holdRefresh = true
    try {
      await sidebar.locator('#traffic-percentage-input').fill('42')
      await sidebar.locator('#experiment-detail-save').click()
      await expect.poll(() => state.refreshStarted).toBe(true)
      await expect(sidebar.locator('#variant-name-input-1')).toBeDisabled()
      await expect(sidebar.locator('#json-editor-button-variant-1')).toBeDisabled()
      await expect(sidebar.locator('#add-variant-button')).toBeDisabled()
      await expect(sidebar.locator('#experiment-variant-fields')).toHaveAttribute('inert', '')
      await sidebar.locator('#traffic-percentage-input').fill('55')
      state.holdRefresh = false
      state.releaseRefresh?.()
      await expect(sidebar.locator('#variant-name-input-1')).toBeEnabled()
      await expect(sidebar.locator('#traffic-percentage-input')).toHaveValue('55')
      await sidebar.locator('#variant-name-input-1').fill('After refresh')
      await sidebar.locator('#experiment-detail-save').click()
      await expect.poll(() => state.puts.length).toBe(2)
      expect(state.puts[1]).toMatchObject({ percentage_of_traffic: 55 })
      expect(state.puts[1].variants[1].name).toBe('After refresh')
    } finally { state.releaseRefresh?.() }
  })

  test(`detail guards immediate Back after a URL match-type edit at ${width}px`, async ({ page, sidebar }) => {
    test.setTimeout(10000)
    const state = await openNavigationDraft(page, sidebar, width, {
      variants: [
        { variant: 0, name: 'Control', config: '{}' },
        { variant: 1, name: 'Variant 1', config: JSON.stringify({ __dom_changes: { changes: [], urlFilter: { include: ['/products/*'], mode: 'simple', matchType: 'path' } } }) }
      ]
    })
    await sidebar.locator('#url-filtering-toggle-variant-1').click()
    await sidebar.locator('#url-filter-match-type-variant-1').selectOption('full-url')
    await sidebar.locator('#header-back-button').click()
    await expect(sidebar.locator('#unsaved-changes-modal')).toBeVisible()
    await sidebar.locator('#unsaved-changes-save').click()
    await expect(sidebar.locator('[data-experiment-name="ft_2251_navigation"]')).toBeVisible()
    expect(state.puts).toHaveLength(1)
    expect(JSON.parse(state.puts[0].variants[1].config).__dom_changes.urlFilter.matchType).toBe('full-url')
  })

  test(`detail keeps malformed nested JSON open until corrected at ${width}px`, async ({ page, sidebar }) => {
    test.setTimeout(10000)
    const state = await openNavigationDraft(page, sidebar, width)
    await sidebar.locator('#json-editor-button-variant-1').click()
    const editor = page.locator('#absmartly-json-editor-host .cm-content')
    const replace = async (value: string) => {
      await editor.click()
      await editor.press('ControlOrMeta+A')
      await editor.press('Delete')
      await page.keyboard.insertText(value)
    }
    await replace(JSON.stringify({ color: 'green', __dom_changes: { urlFilter: '/products/*' } }))
    await page.locator('#json-editor-save-button').click()
    await expect(page.locator('#absmartly-json-editor-host')).toBeVisible()
    await expect(page.locator('#json-editor-status')).toHaveText('✕ Cannot save: variant DOM changes must be an array or an object with a changes array')
    await replace(JSON.stringify({ color: 'green', __dom_changes: { changes: [], urlFilter: '/products/*' } }))
    await page.locator('#json-editor-save-button').click()
    await expect(page.locator('#absmartly-json-editor-host')).toHaveCount(0)
    await sidebar.locator('#experiment-detail-save').click()
    await expect.poll(() => state.puts.length).toBe(1)
    expect(JSON.parse(state.puts[0].variants[1].config)).toMatchObject({ color: 'green', __dom_changes: { changes: [], urlFilter: '/products/*' } })
    await expect(sidebar.locator('#experiment-detail-save')).toBeDisabled()
    await sidebar.locator('[id^="toast-close-"]').first().click()
    await sidebar.locator('#header-back-button').click()
    await expect(sidebar.locator('[data-experiment-name="ft_2251_navigation"]')).toBeVisible()
    await sidebar.locator('[data-experiment-name="ft_2251_navigation"]').click()
    await sidebar.locator('#json-editor-button-variant-1').click()
    await expect(editor).toContainText('green')
    await expect(page.locator('#json-editor-status')).toHaveText('✓ Valid JSON')
  })

  test(`detail guards immediate Back after a code-injection URL edit at ${width}px`, async ({ page, sidebar }) => {
    test.setTimeout(10000)
    const state = await openNavigationDraft(page, sidebar, width, {
      variants: [
        { variant: 0, name: 'Control', config: JSON.stringify({ __inject_html: { headStart: '<meta name="fixture" content="test">', urlFilter: { include: ['/products/*'], mode: 'simple', matchType: 'path' } } }) },
        { variant: 1, name: 'Variant 1', config: '{}' }
      ]
    })
    await sidebar.locator('#custom-code-injection-button').click()
    await sidebar.locator('#code-injection-url-filter-toggle').click()
    await expect(sidebar.locator('#code-injection-url-filter-mode')).toHaveValue('simple')
    await sidebar.locator('#code-injection-url-match-type').selectOption('full-url')
    await sidebar.locator('#header-back-button').click()
    await expect(sidebar.locator('#unsaved-changes-modal')).toBeVisible()
    await sidebar.locator('#unsaved-changes-save').click()
    await expect(sidebar.locator('[data-experiment-name="ft_2251_navigation"]')).toBeVisible()
    expect(state.puts).toHaveLength(1)
    expect(JSON.parse(state.puts[0].variants[0].config).__inject_html.urlFilter.matchType).toBe('full-url')
  })

  test(`detail modal stays busy until storage cleanup finishes at ${width}px`, async ({ page, sidebar }) => {
    test.setTimeout(10000)
    const state = await openNavigationDraft(page, sidebar, width)
    const body = sidebar.locator('body')
    const dialog = sidebar.locator('#unsaved-changes-modal')
    await body.evaluate(() => {
      const originalRemove = chrome.storage.local.remove.bind(chrome.storage.local)
      let release!: () => void
      const pending = new Promise<void>(resolve => { release = resolve })
      const gate = { started: false, release: () => { chrome.storage.local.remove = originalRemove; release() } }
      ;(window as any).__ft2251Cleanup = gate
      chrome.storage.local.remove = ((keys: string | string[]) => {
        if ((Array.isArray(keys) ? keys : [keys]).includes('experiment-503-variants')) {
          gate.started = true
          return pending.then(() => originalRemove(keys))
        }
        return originalRemove(keys)
      }) as typeof chrome.storage.local.remove
    })
    try {
      await sidebar.locator('#traffic-percentage-input').fill('42')
      await sidebar.locator('#experiment-detail-cancel').click()
      await sidebar.locator('#unsaved-changes-save').click()
      await expect.poll(() => body.evaluate(() => (window as any).__ft2251Cleanup.started)).toBe(true)
      expect(state.puts).toHaveLength(1)
      expect(state.puts[0].percentage_of_traffic).toBe(42)
      await body.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      await expect(sidebar.locator('#unsaved-changes-cancel')).toBeDisabled()
      await expect(sidebar.locator('#unsaved-changes-discard')).toBeDisabled()
      await expect(sidebar.locator('#unsaved-changes-save')).toBeDisabled()
      await expect(sidebar.locator('#unsaved-changes-save')).toHaveText('Saving...')
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true)

      await body.evaluate(() => (window as any).__ft2251Cleanup.release())
      await expect(sidebar.locator('[data-experiment-name="ft_2251_navigation"]')).toBeVisible()
      expect(state.puts).toHaveLength(1)
      await sidebar.locator('[data-experiment-name="ft_2251_navigation"]').click()
      await expect(sidebar.locator('#traffic-percentage-input')).toHaveValue('42')
      await expect(sidebar.locator('#experiment-detail-save')).toBeDisabled()
    } finally {
      await body.evaluate(() => (window as any).__ft2251Cleanup?.release()).catch(() => {})
    }
  })

  test(`detail Save, Cancel, visible modal and keyboard navigation at ${width}px`, async ({ page, sidebar }) => {
    const state = await openNavigationDraft(page, sidebar, width)
    const traffic = sidebar.locator('#traffic-percentage-input')
    const save = sidebar.locator('#experiment-detail-save')
    const cancel = sidebar.locator('#experiment-detail-cancel')
    const back = sidebar.locator('#header-back-button')
    const dialog = sidebar.locator('#unsaved-changes-modal')

    await expect(save).toBeDisabled()
    await expect(save).toHaveClass(/bg-gray-200/)
    await expect(cancel).toBeEnabled()
    await cancel.click()
    await expect(sidebar.locator('[data-experiment-name="ft_2251_navigation"]')).toBeVisible()
    await sidebar.locator('[data-experiment-name="ft_2251_navigation"]').click()

    await traffic.fill('42')
    await expect(save).toBeEnabled()
    await expect(save).toHaveText('Save Changes')
    await expect(save).toHaveClass(/bg-blue-600/)
    await expect(save).not.toHaveClass(/ring-yellow/)
    await traffic.fill('100')
    await expect(save).toBeDisabled()
    await traffic.fill('42')

    await back.click()
    await expect(dialog).toBeVisible()
    await expect(sidebar.locator('#unsaved-changes-cancel')).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(sidebar.locator('#unsaved-changes-save')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(sidebar.locator('#unsaved-changes-cancel')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(back).toBeFocused()
    await expect(traffic).toHaveValue('42')

    await cancel.click()
    await expect(dialog).toBeVisible()
    await sidebar.locator('#unsaved-changes-cancel').click()
    await expect(traffic).toHaveValue('42')
    await expect(save).toBeEnabled()
    await cancel.click()
    await sidebar.locator('#unsaved-changes-discard').click()
    await expect(sidebar.locator('[data-experiment-name="ft_2251_navigation"]')).toBeVisible()
    expect(state.puts).toHaveLength(0)
    await sidebar.locator('[data-experiment-name="ft_2251_navigation"]').click()
    await expect(traffic).toHaveValue('100')
    await expect(save).toBeDisabled()

    await traffic.fill('55')
    await back.click()
    await sidebar.locator('#unsaved-changes-save').click()
    await expect(sidebar.locator('[data-experiment-name="ft_2251_navigation"]')).toBeVisible()
    expect(state.puts).toHaveLength(1)
    expect(state.puts[0].percentage_of_traffic).toBe(55)
    await sidebar.locator('[data-experiment-name="ft_2251_navigation"]').click()
    await expect(traffic).toHaveValue('55')
    await expect(save).toBeDisabled()
  })

  for (const method of ['GET', 'PUT'] as const) {
    test(`detail modal keeps edits after failed ${method}, then saves and leaves at ${width}px`, async ({ page, sidebar }) => {
      test.setTimeout(10000)
      const state = await openNavigationDraft(page, sidebar, width)
      const traffic = sidebar.locator('#traffic-percentage-input')
      const dialog = sidebar.locator('#unsaved-changes-modal')
      await traffic.fill('42')
      await sidebar.locator('#experiment-detail-cancel').click()
      state.fail = method
      await sidebar.locator('#unsaved-changes-save').click()
      await expect(sidebar.locator('#toast-container')).toContainText('400')
      await expect(dialog).toBeVisible()
      await expect(sidebar.locator('#unsaved-changes-save')).toBeEnabled()
      expect(state.puts).toHaveLength(0)
      await expect(traffic).toHaveValue('42')
      await page.keyboard.press('Tab')
      expect(await sidebar.locator('#unsaved-changes-modal').evaluate(dialog => dialog.contains(document.activeElement))).toBe(true)

      await sidebar.locator('#unsaved-changes-cancel').click()
      await expect(dialog).toHaveCount(0)
      await expect(sidebar.locator('#experiment-detail-save')).toBeEnabled()
      await expect(traffic).toHaveValue('42')
      await sidebar.locator('#toast-container [id^="toast-close-"]').first().click()
      state.fail = ''
      await sidebar.locator('#header-back-button').click()
      await sidebar.locator('#unsaved-changes-save').click()
      await expect(sidebar.locator('[data-experiment-name="ft_2251_navigation"]')).toBeVisible()
      expect(state.puts).toHaveLength(1)
      expect(state.puts[0].percentage_of_traffic).toBe(42)
      await sidebar.locator('[data-experiment-name="ft_2251_navigation"]').click()
      await expect(traffic).toHaveValue('42')
      await expect(sidebar.locator('#experiment-detail-save')).toBeDisabled()
    })
  }
}

for (const width of [384, 320]) {
  test(`detail restores renamed draft URL controls before another edit at ${width}px`, async ({ page, sidebar }) => {
    test.setTimeout(10000)
    const config = (pattern: string) => ({ __dom_changes: { changes: [], urlFilter: { include: [pattern], mode: 'simple', matchType: 'path' } } })
    const state = await openNavigationDraft(page, sidebar, width, {
      variants: [{ variant: 0, name: 'Control', config: '{}' }, { variant: 1, name: 'Variant 1', config: JSON.stringify(config('/old/*')) }]
    }, true)
    await sidebar.locator('#variant-name-input-1').fill('Draft B')
    await sidebar.locator('#url-filtering-toggle-variant-1').click()
    await sidebar.locator('#url-filter-pattern-variant-1-0').fill('/new/*')
    await expect.poll(() => sidebar.locator('body').evaluate(async () => {
      const stored = (await chrome.storage.local.get('experiment-503-variants'))['experiment-503-variants']
      return typeof stored === 'string' ? JSON.parse(stored)?.[1]?.config?.__dom_changes?.urlFilter?.include?.[0] : undefined
    })).toBe('/new/*')
    // Returning from AI remounts detail while preserving its real unsaved draft.
    await sidebar.locator('#generate-with-ai-button').click()
    await expect(sidebar.locator('#ai-dom-generator-heading')).toBeVisible()
    await sidebar.locator('#header-back-button').click()
    await expect(sidebar.locator('#variant-name-input-1')).toHaveValue('Draft B')
    await sidebar.locator('#url-filtering-toggle-variant-1').click()
    await expect(sidebar.locator('#url-filter-pattern-variant-1-0')).toHaveValue('/new/*')
    await sidebar.locator('#url-filter-match-type-variant-1').selectOption('full-url')
    await sidebar.locator('#experiment-detail-save').click()
    await expect.poll(() => state.puts.length).toBe(1)
    expect(JSON.parse(state.puts[0].variants[1].config).__dom_changes.urlFilter).toEqual({ include: ['/new/*'], mode: 'simple', matchType: 'full-url' })
  })

  test(`detail keeps a deleted variant removed after a surviving VE update at ${width}px`, async ({ page, sidebar }) => {
    test.setTimeout(10000)
    const state = await openNavigationDraft(page, sidebar, width, {
      variants: [{ variant: 0, name: 'Control', config: '{}' }, { variant: 1, name: 'A', config: '{}' }, { variant: 2, name: 'B', config: '{}' }]
    })
    await sidebar.locator('#variant-delete-1').click()
    await expect(sidebar.locator('#variant-name-input-1')).toHaveValue('B')
    await expect(sidebar.locator('#variant-name-input-2')).toHaveCount(0)
    await sidebar.locator('body').evaluate(() => window.postMessage({ source: 'absmartly-visual-editor', type: 'VISUAL_EDITOR_CHANGES', variantName: 'B', changes: [{ selector: '#main-title', type: 'text', value: 'Updated B' }] }, window.location.origin))
    await expect(sidebar.locator('#dom-change-checkbox-0')).toBeVisible()
    await expect(sidebar.locator('#variant-name-input-1')).toHaveValue('B')
    await expect(sidebar.locator('#variant-name-input-2')).toHaveCount(0)
    await sidebar.locator('#experiment-detail-save').click()
    await expect.poll(() => state.puts.length).toBe(1)
    expect(state.puts[0].variants.map((v: any) => v.name)).toEqual(['Control', 'B'])
    expect(JSON.parse(state.puts[0].variants[1].config).__dom_changes.changes).toEqual([{ selector: '#main-title', type: 'text', value: 'Updated B' }])
  })
}

for (const width of [384, 320]) {
  for (const field of ['__dom_changes', 'custom_dom']) {
    test(`detail rejects malformed DOM entries in ${field} and recovers at ${width}px`, async ({ page, sidebar }) => {
      test.setTimeout(10000)
      const state = await openNavigationDraft(page, sidebar, width, {}, false, field)
      await sidebar.locator('#json-editor-button-variant-1').click()
      const host = page.locator('#absmartly-json-editor-host')
      const editor = host.locator('.cm-content')
      const replace = async (value: any, includeOrdinaryValue = false) => {
        await editor.click()
        await editor.press('ControlOrMeta+A')
        await editor.press('Delete')
        await page.keyboard.insertText(JSON.stringify({ color: 'green', ...(includeOrdinaryValue && field === 'custom_dom' ? { __dom_changes: 'ordinary variable' } : {}), [field]: value }))
      }
      const invalid = field === 'custom_dom'
        ? [{ changes: 'invalid' }, [null], { changes: [null] }]
        : [[null], { changes: [null] }, { changes: 'invalid' }]
      for (const value of invalid) {
        await replace(value)
        await host.locator('#json-editor-save-button').click()
        await expect(host).toBeVisible()
        await expect(host.locator('#json-editor-status')).toContainText('Cannot save:')
        expect(state.puts).toHaveLength(0)
      }
      const valid = { changes: [{ selector: '#main-title', type: 'text', value: 'Updated heading' }], urlFilter: { include: ['/products/*'], mode: 'simple', matchType: 'path' } }
      await replace(valid, true)
      await host.locator('#json-editor-save-button').click()
      await expect(host).toHaveCount(0)
      await expect(sidebar.locator('#dom-change-checkbox-0')).toBeVisible()
      await sidebar.locator('#experiment-detail-save').click()
      await expect.poll(() => state.puts.length).toBe(1)
      expect(JSON.parse(state.puts[0].variants[1].config)).toEqual({ color: 'green', ...(field === 'custom_dom' ? { __dom_changes: 'ordinary variable' } : {}), [field]: valid })
      await expect(sidebar.locator('#experiment-detail-save')).toBeDisabled()
      await sidebar.locator('#json-editor-button-variant-1').click()
      await expect(host.locator('#json-editor-status')).toHaveText('✓ Valid JSON')
      await expect(editor).toContainText('Updated heading')
    })
  }
}
