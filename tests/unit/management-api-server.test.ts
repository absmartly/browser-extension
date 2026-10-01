/** @jest-environment node */
import { createManagementApi, compileCoveredOperations, MANAGEMENT_API_KEY, UNAUTHORIZED, type ManagementApi } from '../helpers/management-api/server'

// Exercises the real loopback server over HTTP (Node fetch), as the browser
// forwarder does. Every request is bounded so a hang fails the test.
let api: ManagementApi
beforeEach(async () => { api = await createManagementApi() })
afterEach(async () => { await api.close() })

const call = (path: string, init: RequestInit = {}, auth = true) => fetch(api.url + path, {
  ...init,
  signal: AbortSignal.timeout(3000),
  headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Api-Key ${MANAGEMENT_API_KEY}` } : {}), ...(init.headers || {}) }
})

const draft = {
  name: 'fixture_draft', display_name: 'Fixture Draft', state: 'created', iteration: 1, percentage_of_traffic: 75,
  nr_variants: 2, percentages: '50/50', audience: '{"filter":[{"and":[]}]}', audience_strict: false, type: 'test',
  unit_type: { unit_type_id: 21 }, primary_metric: { metric_id: null }, secondary_metrics: [],
  owners: [{ user_id: 1 }], teams: [], experiment_tags: [{ experiment_tag_id: 41 }],
  applications: [{ application_id: 11, application_version: '0' }],
  variants: [{ variant: 0, name: 'control', config: '{}' }, { variant: 1, name: 'treatment', config: '{}' }],
  variant_screenshots: [], custom_section_field_values: {}
}

test('every covered operation compiles before the server listens', () => {
  expect(() => compileCoveredOperations()).not.toThrow()
})

test('create and save answer with contract-valid bodies and persist exact values', async () => {
  const created = await call('/v1/experiments', { method: 'POST', body: JSON.stringify(draft) })
  expect(created.status).toBe(200)
  const { experiment } = await created.json()
  expect(experiment).toMatchObject({ percentage_of_traffic: 75, unit_type_id: 21 })
  expect(experiment.applications.map((a: any) => a.application_id)).toEqual([11])
  expect(experiment.experiment_tags.map((t: any) => t.experiment_tag_id)).toEqual([41])

  const saved = await call(`/v1/experiments/${experiment.id}`, { method: 'PUT', body: JSON.stringify({ id: experiment.id, data: { ...draft, percentage_of_traffic: 60 } }) })
  expect(saved.status).toBe(200)
  const detail = await (await call(`/v1/experiments/${experiment.id}`)).json()
  expect(detail.experiment.percentage_of_traffic).toBe(60)
  expect(api.issues).toEqual([])
})

test('a contract-invalid create body is recorded as a request issue', async () => {
  await call('/v1/experiments', { method: 'POST', body: JSON.stringify({ name: 'incomplete' }) })
  expect(api.issues.some(i => i.kind === 'request' && i.message.startsWith('POST /experiments body'))).toBe(true)
  expect(() => api.assertClean()).toThrow(/contract issues/)
})

test('a handler failure answers 500 and fails the test instead of hanging', async () => {
  api.override(() => { throw new Error('scenario bug') })
  const response = await call('/v1/applications')
  expect(response.status).toBe(500)
  expect(api.issues.map(i => i.message)).toEqual([expect.stringContaining('fixture handler error for GET /v1/applications: scenario bug')])
})

test('401 without credentials is the documented passport response', async () => {
  const response = await call('/v1/experiments', {}, false)
  expect(response.status).toBe(401)
  expect(await response.text()).toBe(UNAUTHORIZED.body)
  expect(api.issues).toEqual([])
})

test('a malformed injected error body and an undocumented status fail visibly', async () => {
  api.override(({ url }) => url.pathname === '/v1/applications' ? { status: 403, body: { message: 'nope' } } : undefined)
  api.override(({ url }) => url.pathname === '/v1/unit_types' ? { status: 500, body: { ok: false, errors: ['boom'] } } : undefined)
  await call('/v1/applications')
  await call('/v1/unit_types')
  expect(api.issues.map(i => i.kind)).toEqual(['response', 'coverage'])
})

test('a request with no fixture route is a coverage failure', async () => {
  await call('/v1/goals')
  expect(api.issues.some(i => i.kind === 'coverage')).toBe(true)
})

test('delay() holds only the matching request, then answers normally', async () => {
  api.delay('GET', '/v1/applications', 300)
  const started = Date.now()
  const [held, other] = await Promise.all([
    call('/v1/applications').then(r => ({ status: r.status, ms: Date.now() - started })),
    call('/v1/unit_types').then(r => ({ status: r.status, ms: Date.now() - started }))
  ])
  expect(held.status).toBe(200)
  expect(held.ms).toBeGreaterThanOrEqual(280)
  expect(other.status).toBe(200)
  expect(other.ms).toBeLessThan(280)
  expect(api.issues).toEqual([])
})
