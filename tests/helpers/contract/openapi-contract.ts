import fs from 'fs'
import yaml from 'js-yaml'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import type { ValidateFunction } from 'ajv'
import { CONTRACT_CORRIGENDA, CONTRACT_DEVIATIONS, ERROR_EXPECTATIONS, PROVIDER_EXPERIMENT_STATES, type ErrorExpectation } from './deviations'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { bundle: BUNDLE_PATH } = require('../../../scripts/fetch-api-contract')

type Json = Record<string, any>
export type ContractIssue = { kind: 'coverage' | 'request' | 'response'; message: string }

const OPENAPI_ONLY = new Set(['example', 'examples', 'xml', 'externalDocs', 'discriminator', 'deprecated', 'readOnly', 'writeOnly'])

// OpenAPI 3.1 schema objects are JSON Schema 2020-12 plus OpenAPI-only
// annotations. The bundle also carries 3.0-style `nullable`; translate it
// instead of ignoring it so nullable fields neither fail nor widen silently.
function normalize(node: any): any {
  if (Array.isArray(node)) return node.map(normalize)
  if (!node || typeof node !== 'object') return node
  const out: Json = {}
  for (const [key, value] of Object.entries(node)) {
    if (OPENAPI_ONLY.has(key) || key === 'nullable') continue
    out[key] = key === 'properties' || key === '$defs'
      ? Object.fromEntries(Object.entries(value as Json).map(([k, v]) => [k, normalize(v)]))
      : normalize(value)
  }
  if (node.nullable === true) {
    if (typeof out.type === 'string') out.type = [out.type, 'null']
    else if (Array.isArray(out.type) && !out.type.includes('null')) out.type = [...out.type, 'null']
    else if (!out.type) return { anyOf: [out, { type: 'null' }] }
    if (Array.isArray(out.enum) && !out.enum.includes(null)) out.enum = [...out.enum, null]
  }
  return out
}

// Each corrigendum must still match the published value; if a new bundle
// fixes or changes it, fail loudly so the entry is removed, not carried.
export function applyCorrigenda(schemas: Json) {
  for (const c of CONTRACT_CORRIGENDA) {
    const path = c.pointer.replace('#/components/schemas/', '').split('/')
    const key = path.pop()!
    const parent = path.reduce((o: Json, k) => o?.[k], schemas)
    if (!parent || !(key in parent) || parent[key] !== c.published) throw new Error(`Contract corrigendum ${c.id} no longer matches ${c.pointer}; update tests/helpers/contract/deviations.ts`)
    delete parent[key]
  }
}

let cached: { doc: Json; ajv: Ajv2020 } | null = null
export function loadContract() {
  if (cached) return cached
  if (!fs.existsSync(BUNDLE_PATH)) throw new Error(`API contract not found at ${BUNDLE_PATH}; run node scripts/fetch-api-contract.js`)
  const doc = yaml.load(fs.readFileSync(BUNDLE_PATH, 'utf8')) as Json
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true })
  addFormats(ajv)
  const schemas = normalize(doc.components.schemas)
  applyCorrigenda(schemas)
  // Deviation draft-primary-metric-null-id: allow only metric_id null, nothing else.
  const primary = schemas.ExperimentInput?.properties?.primary_metric
  if (!primary?.properties?.metric_id) throw new Error('Contract layout changed: ExperimentInput.primary_metric.metric_id not found; revisit deviations.ts')
  primary.properties.metric_id = { type: ['integer', 'null'] }
  ajv.addSchema({ $id: 'contract', components: { schemas } })
  cached = { doc, ajv }
  return cached
}

const deref = (doc: Json, node: any): any => {
  while (node && node.$ref) node = node.$ref.slice(2).split('/').reduce((o: Json, k: string) => o[k], doc)
  return node
}
const refs = (schema: any): any => JSON.parse(JSON.stringify(schema).replace(/"#\/components\/schemas\//g, '"contract#/components/schemas/'))

export type Operation = {
  method: string
  template: string
  params: Record<string, Json>
  body?: ValidateFunction
  responses: Record<string, ValidateFunction | null>
  deviations: string[]
}

const stateDeviation = CONTRACT_DEVIATIONS.find(d => d.id === 'experiments-state-enum')!
const runningTypeDeviation = CONTRACT_DEVIATIONS.find(d => d.id === 'experiments-running-type')!
const currentUserDeviation = CONTRACT_DEVIATIONS.find(d => d.id === 'auth-current-user')!

// Applied only to the named operations; every other schema is used as published.
function applyDeviations(method: string, template: string, params: Record<string, Json>): string[] {
  if (method !== 'GET' || template !== '/experiments') return []
  params.state = { ...params.state, schema: { type: 'array', items: { type: 'string', enum: [...PROVIDER_EXPERIMENT_STATES] }, uniqueItems: true } }
  params.running_type = { name: 'running_type', in: 'query', style: 'form', explode: false, schema: { type: 'array', items: { type: 'string', enum: ['full_on', 'experiment'] }, minItems: 1 } }
  return [stateDeviation.id, runningTypeDeviation.id]
}

const operations = new Map<string, Operation | null>()
export function getOperation(method: string, path: string): Operation | null {
  const { doc, ajv } = loadContract()
  // Literal paths win over templates (/metrics/usages vs /metrics/{metricId}).
  const template = (doc.paths[path] ? path : undefined)
    ?? Object.keys(doc.paths).find(t => new RegExp('^' + t.replace(/\{[^}]+\}/g, '[^/]+') + '$').test(path))
    ?? (path === '/auth/current-user' ? '/auth/current-user' : undefined)
  if (!template) return null
  const key = `${method} ${template}`
  if (operations.has(key)) return operations.get(key)!
  let operation: Operation | null = null
  if (template === '/auth/current-user' && method === 'GET' && !doc.paths[template]) {
    const user = ajv.compile({ type: 'object', required: ['user'], properties: { user: { $ref: 'contract#/components/schemas/User' } } })
    operation = { method, template, params: {}, responses: { '200': user, '401': null }, deviations: [currentUserDeviation.id] }
  } else {
    const raw = doc.paths[template]?.[method.toLowerCase()]
    if (raw) {
      const params: Record<string, Json> = {}
      for (const p of [...(doc.paths[template].parameters || []), ...(raw.parameters || [])].map(p => deref(doc, p))) {
        if (p.in === 'query') params[p.name] = p
      }
      const deviations = applyDeviations(method, template, params)
      const bodySchema = deref(doc, raw.requestBody)?.content?.['application/json']?.schema
      const responses: Record<string, ValidateFunction | null> = {}
      for (const [status, response] of Object.entries(raw.responses || {})) {
        const schema = deref(doc, response)?.content?.['application/json']?.schema
        responses[status] = schema ? ajv.compile(refs(normalize(schema))) : null
      }
      operation = { method, template, params, deviations, responses, body: bodySchema && method !== 'GET' ? ajv.compile(refs(normalize(bodySchema))) : undefined }
    }
  }
  operations.set(key, operation)
  return operation
}

// Coverage guard, stricter than OpenAPI (which does not forbid unlisted query
// parameters): every parameter the extension sends must be described, or be
// listed here as a known, owned coverage gap. These are NOT contract rejections.
export const KNOWN_UNLISTED_QUERY: Record<string, { params: string[]; note: string }> = {
  'GET /teams': { params: ['include_archived'], note: '@absmartly/cli listTeams always sends include_archived; not described by the bundle' },
  'GET /users': { params: ['include_archived'], note: '@absmartly/cli listUsers sends include_archived when requested; not described by the bundle' }
}

const coerce = (schema: Json, raw: string): unknown => {
  const type = Array.isArray(schema.type) ? schema.type.find((t: string) => t !== 'null') : schema.type
  if (type === 'integer' || type === 'number') return raw.trim() !== '' && !isNaN(Number(raw)) ? Number(raw) : raw
  if (type === 'boolean') return raw === 'true' ? true : raw === 'false' ? false : raw
  return raw
}

export function validateRequest(method: string, url: URL, body: unknown): ContractIssue[] {
  const path = url.pathname.replace(/^\/v1(?=\/)/, '')
  const operation = getOperation(method, path)
  if (!operation) return [{ kind: 'coverage', message: `${method} ${path}: operation missing from contract` }]
  const { ajv } = loadContract()
  const issues: ContractIssue[] = []
  const known = KNOWN_UNLISTED_QUERY[`${method} ${operation.template}`]?.params || []
  for (const name of new Set(url.searchParams.keys())) {
    const param = operation.params[name]
    if (!param) {
      if (!known.includes(name)) issues.push({ kind: 'coverage', message: `${method} ${operation.template}: query parameter "${name}" missing from contract` })
      continue
    }
    const schema = normalize(param.schema || {})
    const raw = url.searchParams.getAll(name)
    const value = schema.type === 'array'
      ? (param.explode === false || raw.length === 1 ? raw.join(',').split(',') : raw).map(v => coerce(schema.items || {}, v))
      : coerce(schema, raw[raw.length - 1])
    const validate = ajv.compile(refs(schema))
    if (!validate(value)) issues.push({ kind: 'request', message: `${method} ${operation.template} query ${name}=${raw.join(',')}: ${ajv.errorsText(validate.errors)}` })
  }
  for (const [name, param] of Object.entries(operation.params)) {
    if (param.required && !url.searchParams.has(name)) issues.push({ kind: 'request', message: `${method} ${operation.template}: required query parameter "${name}" missing` })
  }
  if (operation.body) {
    if (!operation.body(body)) issues.push({ kind: 'request', message: `${method} ${operation.template} body: ${ajv.errorsText(operation.body.errors)}` })
  }
  return issues
}

export type FixtureResponse = { status: number; body: unknown; contentType?: 'application/json' | 'text/plain' }

// Response validation is strict per status: a documented schema is enforced;
// a documented status without a schema is accepted only under an explicit,
// provider-pinned ErrorExpectation; anything else is a coverage failure.
export function validateResponse(method: string, url: URL, response: FixtureResponse): ContractIssue[] {
  const path = url.pathname.replace(/^\/v1(?=\/)/, '')
  const operation = getOperation(method, path)
  if (!operation) return [{ kind: 'coverage', message: `${method} ${path}: operation missing from contract` }]
  const { status, body } = response
  const contentType = response.contentType ?? 'application/json'
  const key = String(status)
  const where = `${method} ${operation.template} ${status}`
  if (!(key in operation.responses)) return [{ kind: 'coverage', message: `${method} ${operation.template}: status ${status} not documented` }]
  const validate = operation.responses[key]
  if (validate) {
    if (contentType !== 'application/json') return [{ kind: 'response', message: `${where}: documented JSON response sent as ${contentType}` }]
    return validate(body) ? [] : [{ kind: 'response', message: `${where}: ${loadContract().ajv.errorsText(validate.errors)}` }]
  }
  const expectation = ERROR_EXPECTATIONS.find(e => e.statuses.includes(status))
  if (!expectation) return [{ kind: 'coverage', message: `${where}: documented without a schema and no provider-pinned expectation` }]
  if (contentType !== expectation.contentType) return [{ kind: 'response', message: `${where}: expected ${expectation.contentType} per ${expectation.id}, got ${contentType}` }]
  if (expectation.text !== undefined) return body === expectation.text ? [] : [{ kind: 'response', message: `${where}: body must be ${JSON.stringify(expectation.text)} per ${expectation.id}` }]
  const check = errorValidator(expectation)
  return check(body) ? [] : [{ kind: 'response', message: `${where} (${expectation.id}): ${loadContract().ajv.errorsText(check.errors)}` }]
}

const errorValidators = new Map<string, ValidateFunction>()
const errorValidator = (e: ErrorExpectation) => {
  if (!errorValidators.has(e.id)) errorValidators.set(e.id, loadContract().ajv.compile(e.schema!))
  return errorValidators.get(e.id)!
}
