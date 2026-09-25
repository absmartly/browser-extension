import { test, expect } from './fixture'

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
  page.on('dialog', dialog => dialog.dismiss())
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
  await sidebar.locator('#save-settings-button').click()
  await sidebar.locator('[data-experiment-name="ft_2251_draft"]').click()

  // Located via the pre-existing label ID so the spec runs unchanged against the unfixed build.
  const traffic = sidebar.locator('#traffic-label + div input')
  const save = sidebar.getByRole('button', { name: /Save Changes/ })
  await traffic.fill('42')
  await expect(save).toHaveText('• Save Changes')
  const dialogShown = page.waitForEvent('dialog')
  await sidebar.locator('#header-back-button').click()
  expect((await dialogShown).message()).toContain('unsaved changes')
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
    if ((await save.innerText()).startsWith('•')) {
      cleanChecks = 0
      const before = puts.length
      await save.click()
      await expect.poll(() => puts.length).toBeGreaterThan(before)
    } else cleanChecks++
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
