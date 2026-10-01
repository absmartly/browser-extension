/** @jest-environment node */
import { getOperation, validateRequest, validateResponse, loadContract } from '../helpers/contract/openapi-contract'
import { CONTRACT_CORRIGENDA, PROVIDER_EXPERIMENT_STATES } from '../helpers/contract/deviations'

// Uses the pinned published bundle (scripts/fetch-api-contract.js). These
// checks are offline once the integrity-verified bundle is cached.
const u = (path: string) => new URL(`https://e2e-api.absmartly.com/v1${path}`)

describe('contract: published bundle as compiled', () => {
  test('create and update experiment bodies compile after the Template corrigendum', () => {
    expect(CONTRACT_CORRIGENDA.map(c => c.id)).toEqual(['template-required-null'])
    expect(loadContract().doc.components.schemas.Template.required).toBeNull()
    expect(getOperation('POST', '/experiments')?.body).toBeDefined()
    expect(getOperation('PUT', '/experiments/1')?.body).toBeDefined()
  })

  test('create body keeps its published required fields', () => {
    const issues = validateRequest('POST', u('/experiments'), { name: 'only_a_name' })
    expect(issues.some(i => i.kind === 'request' && /must have required property 'unit_type'/.test(i.message))).toBe(true)
  })

  test('update body rejects a wrong-typed field instead of passing', () => {
    expect(validateRequest('PUT', u('/experiments/1'), { id: 1, data: { percentage_of_traffic: 'seventy-five' } })
      .some(i => i.kind === 'request')).toBe(true)
  })
})

describe('contract: provider-pinned query deviations', () => {
  test('state enum follows the provider allow-list', () => {
    for (const state of PROVIDER_EXPERIMENT_STATES) expect(validateRequest('GET', u(`/experiments?state=${state}`), undefined)).toEqual([])
    expect(validateRequest('GET', u('/experiments?state=full_on'), undefined)[0].kind).toBe('request')
    expect(validateRequest('GET', u('/experiments?state=running_not_full_on'), undefined)[0].kind).toBe('request')
  })

  test('running_type is described and constrained', () => {
    expect(validateRequest('GET', u('/experiments?state=running&running_type=full_on'), undefined)).toEqual([])
    expect(validateRequest('GET', u('/experiments?running_type=bogus'), undefined)[0].kind).toBe('request')
  })

  test('an unlisted query parameter is a coverage gap, not a request rejection', () => {
    expect(validateRequest('GET', u('/experiments?made_up=1'), undefined)).toEqual([
      { kind: 'coverage', message: 'GET /experiments: query parameter "made_up" missing from contract' }
    ])
  })

  test('an operation missing from the contract is a coverage failure', () => {
    expect(validateRequest('GET', u('/not_a_route'), undefined)[0].kind).toBe('coverage')
  })
})

describe('contract: responses are strict per status', () => {
  const list = { experiments: [], page: 1, items: 25, total: 0 }

  test('documented success schema is enforced', () => {
    expect(validateResponse('GET', u('/experiments'), { status: 200, body: list })).toEqual([])
    expect(validateResponse('GET', u('/experiments'), { status: 200, body: { experiments: [] } })[0].kind).toBe('response')
  })

  test('schema-less 401 validates only as the passport plain-text body', () => {
    expect(validateResponse('GET', u('/experiments'), { status: 401, body: 'Unauthorized', contentType: 'text/plain' })).toEqual([])
    expect(validateResponse('GET', u('/experiments'), { status: 401, body: { ok: false, errors: ['x'] } })[0].kind).toBe('response')
    expect(validateResponse('GET', u('/experiments'), { status: 401, body: 'Nope', contentType: 'text/plain' })[0].kind).toBe('response')
  })

  test('schema-less 403/400 validate only as { ok: false, errors: [..] }', () => {
    expect(validateResponse('GET', u('/experiments'), { status: 403, body: { ok: false, errors: ['forbidden'] } })).toEqual([])
    expect(validateResponse('GET', u('/experiments'), { status: 400, body: { ok: false, errors: ['Invalid state passed'] } })).toEqual([])
    expect(validateResponse('GET', u('/experiments'), { status: 403, body: { message: 'forbidden' } })[0].kind).toBe('response')
    expect(validateResponse('GET', u('/experiments'), { status: 403, body: { ok: false, errors: [] } })[0].kind).toBe('response')
  })

  test('an undocumented status is a coverage failure, even 5xx', () => {
    expect(validateResponse('GET', u('/experiments'), { status: 500, body: { ok: false, errors: ['boom'] } })).toEqual([
      { kind: 'coverage', message: 'GET /experiments: status 500 not documented' }
    ])
  })

  test('a documented JSON response sent as text fails', () => {
    expect(validateResponse('GET', u('/experiments'), { status: 200, body: 'ok', contentType: 'text/plain' })[0].kind).toBe('response')
  })
})
