import { test, expect } from './fixture'

test('packaged Full On and Running Not Full On use accepted API filters and matching rows', async ({ page, sidebar }, testInfo) => {
  const endpoint = 'https://fixture.absmartly.com'
  const rows = [
    { id: 201, name: 'ft_2244_full_on', display_name: 'FT-2244 owned full-on result', state: 'running', full_on_at: '2026-09-23T00:00:00Z', full_on_variant: 1 },
    { id: 202, name: 'ft_2244_running', display_name: 'FT-2244 owned running result', state: 'running', full_on_at: null },
    { id: 203, name: 'ft_2244_draft', display_name: 'FT-2244 owned draft result', state: 'created', full_on_at: null },
    { id: 204, name: 'ft_2244_ready', display_name: 'FT-2244 owned ready result', state: 'ready', full_on_at: null }
  ].map(row => ({ ...row, created_at: new Date(row.id * 1000).toISOString(), variants: [], applications: [], owners: [], teams: [], feature_state: null }))
  const allowed = ['scheduled', 'not_completed', 'aborted', 'completed', 'created', 'ready', 'development', 'running', 'stopped', 'archived', 'on', 'off']
  const requests: Array<{ state: string | null; runningType: string | null; status: number }> = []
  await page.context().route(`${endpoint}/**`, route => {
    const url = new URL(route.request().url())
    let experiments = rows
    if (url.pathname === '/v1/experiments') {
      const state = url.searchParams.get('state')
      const runningType = url.searchParams.get('running_type')
      const states = state?.split(',') || []
      const invalid = states.some(value => !allowed.includes(value))
      requests.push({ state, runningType, status: invalid ? 400 : 200 })
      if (invalid) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, errors: [`Invalid state passed. Valid states are: ${allowed.join(', ')}.`] }) })
      if (states.length) experiments = experiments.filter(row => states.some(value => value === 'on' ? row.feature_state === 'on' && row.state !== 'development' : row.state === value))
      if (runningType === 'full_on') experiments = experiments.filter(row => row.full_on_at !== null)
      if (runningType === 'experiment') experiments = experiments.filter(row => row.full_on_at === null)
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ experiments, total: experiments.length, applications: [], unit_types: [], users: [], teams: [], tags: [], favorites: [], user: { id: 1, user_id: 1, first_name: 'Synthetic', last_name: 'Fixture', email: 'fixture@example.invalid' } }) })
  })
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
  await sidebar.locator('#save-settings-button').click()
  await expect(sidebar.locator('[data-experiment-name="ft_2244_draft"]')).toBeVisible()
  await sidebar.getByLabel('Toggle filters').click()
  await sidebar.locator('#filter-state-created').click()
  await sidebar.locator('#filter-state-ready').click()
  await sidebar.locator('#filter-state-full_on').click()
  try {
    await expect.poll(() => requests.at(-1)).toEqual({ state: 'running', runningType: 'full_on', status: 200 })
    await expect(sidebar.locator('[data-testid="experiment-list-item"]')).toHaveCount(1)
    await expect(sidebar.locator('[data-experiment-name="ft_2244_full_on"]')).toBeVisible()
  } finally {
    await page.screenshot({ path: testInfo.outputPath('full-on-api-result.png') })
    await testInfo.attach('state-contract-requests', { body: JSON.stringify(requests), contentType: 'application/json' })
  }
  await sidebar.locator('#filter-state-full_on').click()
  await sidebar.locator('#filter-state-running_not_full_on').click()
  await expect.poll(() => requests.at(-1)).toEqual({ state: 'running', runningType: 'experiment', status: 200 })
  await expect(sidebar.locator('[data-testid="experiment-list-item"]')).toHaveCount(1)
  await expect(sidebar.locator('[data-experiment-name="ft_2244_running"]')).toBeVisible()

  // OR semantics: a narrow running category must never globally filter out
  // an ordinary Draft selection. Broader Running includes both categories.
  await sidebar.locator('#filter-state-created').click()
  await sidebar.locator('#filter-state-ready').click()
  await expect(sidebar.locator('[data-testid="experiment-list-item"]')).toHaveCount(3)
  await expect(sidebar.locator('[data-experiment-name="ft_2244_draft"]')).toBeVisible()
  await expect(sidebar.locator('[data-experiment-name="ft_2244_ready"]')).toBeVisible()
  await expect(sidebar.locator('[data-experiment-name="ft_2244_running"]')).toBeVisible()
  await sidebar.locator('#filter-state-full_on').click()
  await sidebar.locator('#filter-state-running_not_full_on').click()
  await expect(sidebar.locator('[data-testid="experiment-list-item"]')).toHaveCount(3)
  await expect(sidebar.locator('[data-experiment-name="ft_2244_draft"]')).toBeVisible()
  await expect(sidebar.locator('[data-experiment-name="ft_2244_ready"]')).toBeVisible()
  await expect(sidebar.locator('[data-experiment-name="ft_2244_full_on"]')).toBeVisible()
  await expect(sidebar.locator('[data-experiment-name="ft_2244_running"]')).toHaveCount(0)
  await sidebar.locator('#filter-state-running').click()
  await expect(sidebar.locator('[data-testid="experiment-list-item"]')).toHaveCount(4)
  for (const row of rows) await expect(sidebar.locator(`[data-experiment-name="${row.name}"]`)).toBeVisible()
})

test('packaged pending search preserves newer filters and Clear All cancels pending search', async ({ page, sidebar }, testInfo) => {
  const endpoint = 'https://fixture.absmartly.com'
  await page.context().route(`${endpoint}/**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      experiments: [], applications: [], unit_types: [], users: [], teams: [], tags: [], favorites: [],
      user: { id: 1, user_id: 1, first_name: 'Synthetic', last_name: 'Fixture', email: 'fixture@example.invalid' }
    })
  }))
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
  await sidebar.locator('#save-settings-button').click()
  await expect(sidebar.locator('#experiments-heading')).toBeVisible()
  await sidebar.getByLabel('Toggle filters').click()

  // Freeze only this isolated browser's clock so the real packaged 300 ms
  // search timer fires after the intervening interactions, deterministically.
  const start = new Date('2026-09-23T12:00:00Z')
  await page.clock.install({ time: start })
  await page.clock.pauseAt(new Date(start.getTime() + 1000))
  await sidebar.locator('#filter-search-input').fill('old')
  await page.clock.runFor(300)
  await sidebar.locator('#filter-search-input').fill('')
  await page.clock.runFor(200)
  await sidebar.locator('#filter-state-running').click()
  await sidebar.locator('#filter-significance-positive').click()
  await sidebar.locator('#filter-alert-sample_ratio_mismatch').check()
  await page.screenshot({ path: testInfo.outputPath('filter-selections-before-timer.png') })
  await page.clock.runFor(100)
  try {
    await expect(sidebar.locator('#filter-state-running')).toHaveClass(/bg-blue-100/)
    await expect(sidebar.locator('#filter-significance-positive')).toHaveClass(/bg-blue-100/)
    await expect(sidebar.locator('#filter-alert-sample_ratio_mismatch')).toBeChecked()
    await expect(sidebar.locator('#filter-clear-all')).toBeVisible()
  } finally {
    await page.screenshot({ path: testInfo.outputPath('filter-selections-after-timer.png') })
  }

  await sidebar.locator('#filter-search-input').fill('must-not-return')
  await page.clock.runFor(200)
  await sidebar.locator('#filter-clear-all').click()
  await page.clock.runFor(300)
  await expect(sidebar.locator('#filter-search-input')).toHaveValue('')
  await expect(sidebar.locator('#filter-state-created')).toHaveClass(/bg-blue-100/)
  await expect(sidebar.locator('#filter-state-ready')).toHaveClass(/bg-blue-100/)
  await expect(sidebar.locator('#filter-state-running')).not.toHaveClass(/bg-blue-100/)
  await expect(sidebar.locator('#filter-significance-positive')).not.toHaveClass(/bg-blue-100/)
  await expect(sidebar.locator('#filter-alert-sample_ratio_mismatch')).not.toBeChecked()
  await expect(sidebar.locator('#filter-clear-all')).toHaveCount(0)
  // Wait for the existing color transitions, so the static image does not
  // mistake fading selection paint for a selected control.
  await expect(sidebar.locator('#filter-state-running')).toHaveCSS('background-color', 'rgb(243, 244, 246)')
  await expect(sidebar.locator('#filter-significance-positive')).toHaveCSS('background-color', 'rgb(243, 244, 246)')
  await page.screenshot({ path: testInfo.outputPath('filter-clear-all-no-resurrection.png') })
})

test('packaged older filter response arriving after Clear All cannot replace the restored default rows', async ({ page, sidebar }, testInfo) => {
  const endpoint = 'https://fixture.absmartly.com'
  const owned = { id: 301, name: 'ft_2244_owned_draft', display_name: 'FT-2244 owned draft', state: 'created', full_on_at: null, created_at: '2026-09-23T00:00:00Z', variants: [], applications: [], owners: [], teams: [], feature_state: null }
  const base = { applications: [], unit_types: [], users: [], teams: [], tags: [], favorites: [], user: { id: 1, user_id: 1, first_name: 'Synthetic', last_name: 'Fixture', email: 'fixture@example.invalid' } }
  const requests: Array<{ state: string | null; significance: string | null }> = []
  let releaseOld!: () => Promise<void>
  await page.context().route(`${endpoint}/**`, route => {
    const url = new URL(route.request().url())
    if (url.pathname !== '/v1/experiments') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(base) })
    const state = url.searchParams.get('state')
    const significance = url.searchParams.get('significance')
    requests.push({ state, significance })
    const reply = (experiments: unknown[]) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...base, experiments, total: experiments.length }) })
    // The narrowed Running + Positive query is slow; hold it until released.
    if (state === 'running' && significance === 'positive') {
      releaseOld = () => reply([])
      return
    }
    return reply(state?.split(',').includes('created') ? [owned] : [])
  })
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
  await sidebar.locator('#save-settings-button').click()
  const ownedRow = sidebar.locator('[data-testid="experiment-list-item"]:has([data-experiment-name="ft_2244_owned_draft"])')
  await expect(ownedRow).toHaveCount(1)
  await sidebar.getByLabel('Toggle filters').click()
  // Select only Running, then Positive: the last query is Running + Positive.
  await sidebar.locator('#filter-state-created').click()
  await sidebar.locator('#filter-state-ready').click()
  await sidebar.locator('#filter-state-running').click()
  await sidebar.locator('#filter-significance-positive').click()
  await expect.poll(() => !!releaseOld).toBe(true)
  await expect(sidebar.locator('#filter-clear-all')).toBeVisible()
  // Clear All while the older query is still in flight; the defaults query
  // completes first and restores the owned Draft row.
  await sidebar.locator('#filter-clear-all').click()
  await expect.poll(() => requests.at(-1)?.state).toBe('created,ready')
  await expect(ownedRow).toHaveCount(1)
  await expect(sidebar.locator('#filter-clear-all')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('clear-all-restored-before-stale-response.png') })
  // Now the older Running + Positive response (empty) arrives last.
  await releaseOld()
  // Let the background reply round-trip and any resulting render commit.
  await sidebar.locator('body').evaluate(async () => {
    await chrome.runtime.sendMessage({ type: 'GET_CONFIG' })
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  try {
    await expect(ownedRow).toHaveCount(1)
    await expect(sidebar.locator('#no-experiments-message')).toHaveCount(0)
    await expect(sidebar.locator('#filter-state-created')).toHaveClass(/bg-blue-100/)
  } finally {
    await page.screenshot({ path: testInfo.outputPath('clear-all-after-stale-response.png') })
    await testInfo.attach('experiment-requests', { body: JSON.stringify(requests), contentType: 'application/json' })
  }
})
