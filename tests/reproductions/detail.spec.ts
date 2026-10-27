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
  await expect(sidebar.getByRole('dialog', { name: 'Save changes?' })).toBeVisible()
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
  // URL filter edits are debounced (500 ms) and can land after an early Save, so save again
  // until the page stays clean across consecutive checks and the last request carries the filter.
  const savedConfig = () => puts.length ? JSON.parse(puts.at(-1).variants[1].config) : null
  let cleanChecks = 0
  await expect.poll(async () => {
    if (await save.isEnabled()) {
      cleanChecks = 0
      const before = puts.length
      await save.click()
      await expect.poll(() => puts.length).toBeGreaterThan(before)
    } else if ((await save.innerText()) === 'Save Changes') cleanChecks++
    return { stable: cleanChecks >= 2, config: savedConfig() }
  }, { intervals: [700], timeout: 10000 }).toEqual({ stable: true, config: { __dom_changes: { changes: [], urlFilter: { include: ['/products/*'], mode: 'simple', matchType: 'path' } } } })
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
  await expect(sidebar.getByRole('dialog', { name: 'Save changes?' })).toBeVisible()
  await sidebar.locator('#unsaved-changes-cancel').click()
  await expect(traffic).toHaveValue('42')

  failPut = false
  await save.click()
  await expect.poll(() => puts.length).toBe(1)
  expect(puts[0].percentage_of_traffic).toBe(42)
  await expect(save).toBeDisabled()
})

async function openNavigationDraft(page: Page, sidebar: FrameLocator, width: number) {
  const draft = { ...experiment, id: 503, name: 'ft_2251_navigation', display_name: 'FT-2251 navigation', percentage_of_traffic: 100 }
  const state = { fail: '' as '' | 'GET' | 'PUT', puts: [] as any[] }
  await page.locator('#absmartly-sidebar-iframe').evaluate((iframe, width) => {
    iframe.style.width = `${width}px`
  }, width)
  await page.context().route(`${endpoint}/**`, route => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/v1/experiments/503') {
      if (state.fail === method) return json({ errors: ['synthetic navigation save failure'] }, 500)
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
  await sidebar.locator('#save-settings-button').click()
  await sidebar.locator('[data-experiment-name="ft_2251_navigation"]').click()
  return state
}

for (const width of [384, 320]) {
  test(`detail Save, Cancel, visible modal and keyboard navigation at ${width}px`, async ({ page, sidebar }) => {
    const state = await openNavigationDraft(page, sidebar, width)
    const traffic = sidebar.locator('#traffic-percentage-input')
    const save = sidebar.locator('#experiment-detail-save')
    const cancel = sidebar.locator('#experiment-detail-cancel')
    const back = sidebar.locator('#header-back-button')
    const dialog = sidebar.getByRole('dialog', { name: 'Save changes?' })

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
      const state = await openNavigationDraft(page, sidebar, width)
      const traffic = sidebar.locator('#traffic-percentage-input')
      const dialog = sidebar.getByRole('dialog', { name: 'Save changes?' })
      await traffic.fill('42')
      await sidebar.locator('#experiment-detail-cancel').click()
      state.fail = method
      await sidebar.locator('#unsaved-changes-save').click()
      await expect(sidebar.locator('#toast-container')).toContainText('500', { timeout: 20000 })
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
