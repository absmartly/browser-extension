import type { Route } from '@playwright/test'
import { test, expect } from './fixture'

const endpoint = 'https://fixture.absmartly.com'
const rows = [
  { id: 301, name: 'ft_filter_draft', display_name: 'Fixture draft', state: 'created' },
  { id: 302, name: 'ft_filter_ready', display_name: 'Fixture ready', state: 'ready' },
  { id: 303, name: 'ft_filter_stopped', display_name: 'Fixture stopped', state: 'stopped' },
  { id: 304, name: 'ft_filter_running', display_name: 'Fixture running', state: 'running' }
].map(row => ({ ...row, type: 'test', created_at: new Date(row.id * 1000).toISOString(), variants: [], applications: [], owners: [], teams: [] }))
const resources = {
  applications: [{ id: 1, application_id: 1, name: 'Fixture application' }],
  unit_types: [{ unit_type_id: 1, name: 'fixture_unit' }],
  metrics: [], metric_categories: [], experiment_tags: [], users: [], teams: [],
  favorites: [], environments: [], experiment_custom_section_fields: [],
  user: { id: 1, user_id: 1, first_name: 'Synthetic', last_name: 'Fixture', email: 'fixture@example.invalid' }
}
const respond = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })

// CI sequence (experiment-filtering.spec.ts): the editor is opened before the
// one-time list initialization runs (it only runs on the list view once
// authenticated), so saving is the first list load. The save reload must use
// the Draft/Ready defaults shown in the filter panel. Initialization's own
// /v1/applications read is held after the save so only the save reload is
// observed.
test('post-save reload before list initialization keeps the default state filters', async ({ page, sidebar }, testInfo) => {
  const listStates: Array<string | null> = []
  let holdApplications = false
  let releaseAuth: (() => void) | undefined
  const authHeld = new Promise<void>(resolve => { releaseAuth = resolve })
  let releaseApplications: (() => void) | undefined
  const applicationsHeld = new Promise<void>(resolve => { releaseApplications = resolve })
  await page.context().route(`${endpoint}/**`, async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/auth/current-user') {
      await authHeld
      return respond(route, resources)
    }
    if (url.pathname === '/v1/applications' && holdApplications) {
      await applicationsHeld
      return respond(route, resources)
    }
    if (url.pathname === '/v1/experiments' && route.request().method() === 'POST') {
      return respond(route, { experiment: { ...route.request().postDataJSON(), id: 399 } })
    }
    if (url.pathname === '/v1/experiments' && url.searchParams.get('type') === 'test') {
      const state = url.searchParams.get('state')
      listStates.push(state)
      const states = state?.split(',') || []
      const experiments = states.length ? rows.filter(row => states.includes(row.state)) : rows
      return respond(route, { experiments, total: experiments.length })
    }
    return respond(route, resources)
  })

  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
  await sidebar.locator('#save-settings-button').click()
  await sidebar.locator('button[title="Create New Experiment"]').click()
  await sidebar.locator('#from-scratch-button').click()
  await expect(sidebar.locator('#experiment-name-input')).toBeVisible()
  releaseAuth?.()
  await sidebar.locator('#experiment-name-input').fill('ft_filter_owned_draft')
  await sidebar.locator('#unit-type-select-trigger').click()
  await sidebar.locator('[data-testid="searchable-select-option-1"]').click()
  holdApplications = true
  await sidebar.locator('#create-experiment-button').click()
  await expect(sidebar.locator('#experiments-heading')).toBeVisible()
  await expect.poll(() => listStates.length).toBeGreaterThan(0)
  await expect(sidebar.locator('[data-testid="experiment-list-item"]').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('post-save-list.png') })
  try {
    expect(listStates[0], 'post-save reload must request the Draft/Ready defaults').toBe('created,ready')
    await expect(sidebar.locator('[data-experiment-state="stopped"], [data-experiment-state="running"]')).toHaveCount(0)
  } finally {
    await testInfo.attach('list-requests', { body: JSON.stringify(listStates), contentType: 'application/json' })
    releaseApplications?.()
    releaseAuth?.()
  }
  await sidebar.getByLabel('Toggle filters').click()
  await expect(sidebar.locator('#filter-state-created')).toHaveClass(/bg-blue-100/)
  await expect(sidebar.locator('#filter-state-stopped')).not.toHaveClass(/bg-blue-100/)
  await page.screenshot({ path: testInfo.outputPath('post-save-list-filters-open.png') })
})
