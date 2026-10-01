import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { defaultResources, experimentNote, experimentRecord, fixtureUser, type ResourceState } from './records'
import { getOperation, validateRequest, validateResponse, type ContractIssue, type FixtureResponse } from '../contract/openapi-contract'

// Synthetic origin inside the production allow-list (*.absmartly.com).
// Playwright forwards it to this loopback server; nothing resolves publicly.
export const MANAGEMENT_API_ORIGIN = 'https://e2e-api.absmartly.com'
export const MANAGEMENT_API_KEY = 'e2e-synthetic-api-key'

export type RecordedCall = { method: string; path: string; query: Record<string, string>; body: unknown; status: number }
export type Override = (call: { method: string; url: URL; body: any }) => FixtureResponse | undefined

export interface ManagementApi {
  origin: string
  url: string
  apiKey: string
  state: { experiments: any[]; resources: ResourceState; favorites: number[]; user: any }
  calls: RecordedCall[]
  issues: ContractIssue[]
  override(handler: Override): void
  reset(): void
  callsTo(method: string, path: string | RegExp): RecordedCall[]
  assertClean(): void
  close(): Promise<void>
}

const json = (res: ServerResponse, status: number, body: unknown) => send(res, { status, body })
const send = (res: ServerResponse, response: FixtureResponse) => {
  const text = response.contentType === 'text/plain'
  res.writeHead(response.status, { 'content-type': text ? 'text/plain' : 'application/json' })
  res.end(text ? String(response.body) : JSON.stringify(response.body))
}

// passport.authenticate() without failWithError answers 401 as plain text.
export const UNAUTHORIZED: FixtureResponse = { status: 401, body: 'Unauthorized', contentType: 'text/plain' }

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return undefined
  try { return JSON.parse(text) } catch { return text }
}

const freshState = () => ({ experiments: [] as any[], resources: defaultResources(), favorites: [] as number[], user: fixtureUser(1) })

// Provider list semantics actually used by the extension (abs filters.js):
// state (OR, with on/off feature states), running_type, search, ids, paging.
function listExperiments(all: any[], q: URLSearchParams) {
  let rows = all.filter(e => (q.get('type') || 'test') === e.type)
  const states = q.get('state')?.split(',').map(s => s.trim()).filter(Boolean) || []
  if (states.length) rows = rows.filter(e => states.some(s =>
    s === 'archived' ? e.archived : s === 'on' ? e.feature_state === 'on' && e.state !== 'development'
      : s === 'off' ? e.feature_state === 'off' : !e.archived && e.state === s))
  else rows = rows.filter(e => !e.archived)
  const running = q.get('running_type')?.split(',') || []
  if (running.length) rows = rows.filter(e => (running.includes('full_on') && e.full_on_at) || (running.includes('experiment') && !e.full_on_at))
  const search = q.get('search')?.toLowerCase()
  if (search) rows = rows.filter(e => e.name.toLowerCase().includes(search) || (e.display_name || '').toLowerCase().includes(search))
  const ids = q.get('ids')?.split(',').map(Number)
  if (ids) rows = rows.filter(e => ids.includes(e.id))
  rows = [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)
  const items = Number(q.get('items') || 1500), page = Number(q.get('page') || 1)
  return { experiments: rows.slice((page - 1) * items, page * items), page, items, total: rows.length }
}

// Mirrors how the provider expands ExperimentInput references into the
// detail representation the extension renders.
function materialize(state: ManagementApi['state'], input: any, base: any) {
  const r = state.resources
  const pick = (list: any[], id: number) => list.find(x => x.id === id)
  const out = { ...base }
  for (const key of ['name', 'display_name', 'percentage_of_traffic', 'nr_variants', 'percentages', 'audience', 'audience_strict', 'type', 'analysis_type']) {
    if (input[key] !== undefined) out[key] = input[key]
  }
  if (input.unit_type !== undefined) {
    out.unit_type_id = input.unit_type?.unit_type_id ?? null
    out.unit_type = out.unit_type_id ? pick(r.unit_types, out.unit_type_id) ?? null : null
  }
  if (input.applications) out.applications = input.applications.map((a: any) => ({ experiment_id: out.id, application_id: a.application_id, application_version: a.application_version, application: pick(r.applications, a.application_id) }))
  if (input.owners) out.owners = input.owners.map((o: any) => ({ experiment_id: out.id, user_id: o.user_id, user: pick(r.users, o.user_id) }))
  if (input.teams) out.teams = input.teams.map((t: any) => ({ experiment_id: out.id, team_id: t.team_id, team: pick(r.teams, t.team_id) }))
  if (input.experiment_tags) out.experiment_tags = input.experiment_tags.map((t: any) => ({ experiment_id: out.id, experiment_tag_id: t.experiment_tag_id, experiment_tag: pick(r.experiment_tags, t.experiment_tag_id) }))
  if (input.variants) out.variants = input.variants.map((v: any) => ({ experiment_id: out.id, variant: v.variant, name: v.name, config: v.config }))
  return out
}

function route(api: ManagementApi, method: string, url: URL, body: any): FixtureResponse {
  const { state } = api
  const path = url.pathname.replace(/^\/v1(?=\/)/, '')
  const list = (key: keyof ResourceState) => {
    const rows = state.resources[key]
    return { status: 200, body: { [key]: rows, items: Number(url.searchParams.get('items') || 100), page: Number(url.searchParams.get('page') || 1), total: rows.length } }
  }
  const byId = path.match(/^\/experiments\/(\d+)(?:\/(start|stop))?$/)
  const find = (id: number) => state.experiments.find(e => e.id === id)
  if (method === 'GET' && path === '/auth/current-user') return { status: 200, body: { user: state.user } }
  if (method === 'GET' && path === '/experiments') return { status: 200, body: listExperiments(state.experiments, url.searchParams) }
  if (method === 'POST' && path === '/experiments') {
    const created = materialize(state, body, experimentRecord({ created_at: new Date().toISOString() }))
    state.experiments.push(created)
    return { status: 200, body: { ok: true, experiment: created, experiment_note: experimentNote(created.id, 'create') } }
  }
  if (byId) {
    const experiment = find(Number(byId[1]))
    if (!experiment) return { status: 404, body: { ok: false, errors: ['Experiment not found'] } }
    if (method === 'GET' && !byId[2]) return { status: 200, body: { experiment } }
    if (method === 'PUT' && !byId[2]) {
      const updated = materialize(state, body?.data || {}, experiment)
      state.experiments[state.experiments.indexOf(experiment)] = updated
      return { status: 200, body: { ok: true, experiment: updated, experiment_note: experimentNote(updated.id, 'edit'), errors: [] } }
    }
    if (method === 'PUT' && byId[2] === 'start') { experiment.state = 'running'; experiment.start_at = new Date().toISOString(); return { status: 200, body: { ok: true, experiment, experiment_note: experimentNote(experiment.id, 'start') } } }
    if (method === 'PUT' && byId[2] === 'stop') { experiment.state = 'stopped'; experiment.stop_at = new Date().toISOString(); return { status: 200, body: { ok: true, experiment, experiment_note: experimentNote(experiment.id, 'stop') } } }
  }
  if (method === 'GET' && path === '/favorites') return { status: 200, body: { user_favorite_experiments: state.favorites.map(id => ({ user_id: state.user.id, experiment_id: id, created_at: '2026-09-01T10:00:00.000Z' })) } }
  if (method === 'PUT' && path === '/favorites/experiment') {
    const id = Number(url.searchParams.get('id'))
    state.favorites = url.searchParams.get('favorite') === 'true' ? [...new Set([...state.favorites, id])] : state.favorites.filter(x => x !== id)
    return route(api, 'GET', new URL('/v1/favorites', url), undefined)
  }
  if (method === 'GET' && path === '/metrics/usages') return { status: 200, body: { metricUsages: [] } }
  const resource = ({ '/applications': 'applications', '/unit_types': 'unit_types', '/users': 'users', '/teams': 'teams', '/experiment_tags': 'experiment_tags', '/metrics': 'metrics', '/metric_categories': 'metric_categories', '/environments': 'environments', '/experiment_custom_section_fields': 'experiment_custom_section_fields' } as Record<string, keyof ResourceState>)[path]
  if (method === 'GET' && resource) return list(resource)
  return { status: 404, body: { ok: false, errors: [`No fixture route for ${method} ${path}`] } }
}

// Every operation the extension's API client can reach through this fixture.
// Compiled before the server listens, so an uncompilable contract schema fails
// fixture setup immediately instead of hanging the first matching request.
export const COVERED_OPERATIONS: Array<[string, string]> = [
  ['GET', '/experiments'], ['POST', '/experiments'], ['GET', '/experiments/1'], ['PUT', '/experiments/1'],
  ['PUT', '/experiments/1/start'], ['PUT', '/experiments/1/stop'], ['GET', '/applications'], ['GET', '/unit_types'],
  ['GET', '/metrics'], ['GET', '/metrics/usages'], ['GET', '/metric_categories'], ['GET', '/experiment_tags'],
  ['GET', '/users'], ['GET', '/teams'], ['GET', '/environments'], ['GET', '/experiment_custom_section_fields'],
  ['GET', '/auth/current-user'], ['GET', '/favorites'], ['PUT', '/favorites/experiment']
]

export function compileCoveredOperations() {
  for (const [method, path] of COVERED_OPERATIONS) {
    if (!getOperation(method, path)) throw new Error(`Contract has no operation for covered fixture route ${method} ${path}`)
  }
}

export async function createManagementApi(): Promise<ManagementApi> {
  compileCoveredOperations()
  const overrides: Override[] = []
  const api: ManagementApi = {
    origin: MANAGEMENT_API_ORIGIN,
    url: '',
    apiKey: MANAGEMENT_API_KEY,
    state: freshState(),
    calls: [],
    issues: [],
    override: handler => { overrides.push(handler) },
    reset: () => { api.state = freshState(); api.calls.length = 0; api.issues.length = 0; overrides.length = 0 },
    callsTo: (method, path) => api.calls.filter(c => c.method === method && (typeof path === 'string' ? c.path === path : path.test(c.path))),
    assertClean: () => {
      if (api.issues.length) throw new Error(`Management API contract issues:\n${api.issues.map(i => `- [${i.kind}] ${i.message}`).join('\n')}`)
    },
    close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
  }
  const server: Server = createServer((req, res) => {
    handle(req, res).catch(error => {
      // Fail closed and visibly: answer, and record an issue that fails the test.
      api.issues.push({ kind: 'coverage', message: `fixture handler error for ${req.method} ${req.url}: ${error instanceof Error ? error.message : String(error)}` })
      if (!res.headersSent) json(res, 500, { ok: false, errors: ['fixture handler error'] })
      else res.end()
    })
  })
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('access-control-allow-origin', req.headers.origin || '*')
    res.setHeader('access-control-allow-credentials', 'true')
    res.setHeader('access-control-allow-headers', 'authorization, content-type, accept')
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    const url = new URL(req.url || '/', MANAGEMENT_API_ORIGIN)
    const method = req.method || 'GET'
    const body = await readBody(req)
    let result: FixtureResponse
    if (req.headers.authorization !== `Api-Key ${MANAGEMENT_API_KEY}`) {
      result = UNAUTHORIZED
    } else {
      api.issues.push(...validateRequest(method, url, body))
      result = overrides.reduce<FixtureResponse | undefined>((found, o) => found ?? o({ method, url, body }), undefined)
        ?? route(api, method, url, body)
    }
    // A missing route is a coverage failure, never a silent 404 success path.
    if (result.status === 404 && String((result.body as any)?.errors?.[0] || '').startsWith('No fixture route')) {
      api.issues.push({ kind: 'coverage', message: `${method} ${url.pathname}: no fixture route` })
    } else {
      api.issues.push(...validateResponse(method, url, result))
    }
    api.calls.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, status: result.status })
    send(res, result)
  }
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  api.url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  return api
}

// Storage entries that point the extension at the controlled API. Specs that
// reseed configuration must use this instead of environment credentials.
export function controlledConfigSeed(api: Pick<ManagementApi, 'origin' | 'apiKey'>, extra: Record<string, unknown> = {}) {
  const config = { apiKey: api.apiKey, apiEndpoint: api.origin, authMethod: 'apikey', domChangesFieldName: '__dom_changes', vibeStudioEnabled: true, ...extra }
  return {
    'absmartly-config': config,
    'plasmo:absmartly-config': config,
    'absmartly-apikey': api.apiKey,
    'plasmo:absmartly-apikey': api.apiKey
  }
}
