// Contract-owned deviations from the published Web Console contract
// (@absmartly/api-mocks 1.0.9, gitHead 9fad02a96bf032ef04f56b86b1c877982652a14b).
// Each entry is pinned to the abs provider rule that disagrees with the
// published bundle. Remove an entry once a corrected api-mocks release lands.
export const ABS_PROVIDER_REF = 'absmartly/abs@e0d2e13f6f9d88c7a928859991ef6e5fc5c2abd7'

// office/backend/src/routes/experiments/pagination/filters.js L51-63:
// allowedStates = excludedStates + created, ready, development, running,
// stopped, archived, on, off. The bundle instead allows full_on and
// running_not_full_on, which the provider rejects with 400.
export const PROVIDER_EXPERIMENT_STATES = [
  'scheduled', 'not_completed', 'aborted', 'completed',
  'created', 'ready', 'development', 'running', 'stopped', 'archived', 'on', 'off'
] as const

export type ContractDeviation = {
  id: string
  operation: string
  kind: 'replace-query-schema' | 'add-query-parameter' | 'add-operation' | 'widen-body-field'
  source: string
  reason: string
}

export const CONTRACT_DEVIATIONS: ContractDeviation[] = [
  {
    id: 'experiments-state-enum',
    operation: 'GET /experiments',
    kind: 'replace-query-schema',
    source: `${ABS_PROVIDER_REF} office/backend/src/routes/experiments/pagination/filters.js#L51-L63,L196-L200`,
    reason: 'Published enum accepts full_on/running_not_full_on (provider 400) and omits on/off/completed/aborted/not_completed (provider accepts)'
  },
  {
    id: 'experiments-running-type',
    operation: 'GET /experiments',
    kind: 'add-query-parameter',
    source: `${ABS_PROVIDER_REF} office/backend/src/routes/experiments/pagination/filters.js#L168-L188`,
    reason: 'Provider filters running_type=full_on|experiment (full_on_at not null / null); parameter missing from the bundle'
  },
  {
    id: 'auth-current-user',
    operation: 'GET /auth/current-user',
    kind: 'add-operation',
    source: `${ABS_PROVIDER_REF} office/backend/src/routes/auth/index.js#L206-L213`,
    reason: 'Provider returns { user: req.user }; path exists in api-mocks sources but is not wired into openapi.bundle.yaml'
  },
  {
    id: 'draft-primary-metric-null-id',
    // Schema-level: applied to components.schemas.ExperimentInput, which the
    // bundle reuses for POST /experiments, PUT /experiments/{experimentId}
    // (UpdateExperimentBody.data) and PUT .../restart (RestartExperimentBody).
    // It only admits metric_id null; whether null is acceptable depends on the
    // state (drafts yes, ready/running require a primary metric). That semantic
    // rule is NOT asserted by schema validation: provider-conformance follow-up.
    operation: 'POST /experiments, PUT /experiments/{experimentId}, PUT /experiments/{experimentId}/restart',
    kind: 'widen-body-field',
    source: `${ABS_PROVIDER_REF} office/backend/src/controllers/experiments/ExperimentCreateController.ts#L113,L219-L224; office/backend/src/lib/validation/experiment.js#L952-L954`,
    reason: 'Provider types primary_metric as { metric_id: number | null } and skips the metric lookup for null; drafts (state created) short-circuit before "Primary metric is required". Bundle types metric_id as integer only.'
  }
]

// Corrigenda: the published bundle contains schemas that are not valid JSON
// Schema at all. These are repaired (not relaxed) so the surrounding schemas
// can compile with every other constraint intact.
export type ContractCorrigendum = { id: string; pointer: string; published: unknown; corrected: string; source: string }

export const CONTRACT_CORRIGENDA: ContractCorrigendum[] = [
  {
    id: 'template-required-null',
    pointer: '#/components/schemas/Template/required',
    published: null,
    corrected: 'keyword removed (null asserts nothing; JSON Schema requires an array of property names)',
    source: '@absmartly/api-mocks@1.0.9 openapi/openapi.bundle.yaml (sha256 f123f237…a413) components.schemas.Template; referenced by ExperimentInput and UpdateExperimentBody, so POST/PUT /experiments bodies could not compile'
  }
]

// Error responses the bundle documents without any schema. These expectations
// are pinned to the provider source and apply only to the listed statuses;
// any other schema-less status remains a coverage gap and fails the test.
export type ErrorExpectation = {
  id: string
  statuses: number[]
  contentType: 'application/json' | 'text/plain'
  source: string
  // JSON Schema for JSON bodies, or the exact text body.
  schema?: Record<string, unknown>
  text?: string
}

const OK_FALSE_ERRORS = { type: 'object', required: ['ok', 'errors'], additionalProperties: false, properties: { ok: { const: false }, errors: { type: 'array', minItems: 1, items: { type: 'string' } } } }

export const ERROR_EXPECTATIONS: ErrorExpectation[] = [
  {
    id: 'passport-unauthorized',
    statuses: [401],
    contentType: 'text/plain',
    text: 'Unauthorized',
    source: `${ABS_PROVIDER_REF} office/backend/src/lib/http.ts#L26-L28 (passport.authenticate without failWithError) + passport@0.7.0 lib/middleware/authenticate.js#L170-L177 (res.end(STATUS_CODES[401]))`
  },
  {
    id: 'http-json-status-error',
    statuses: [400, 403, 404, 409, 503],
    contentType: 'application/json',
    schema: OK_FALSE_ERRORS,
    source: `${ABS_PROVIDER_REF} office/shared/lib/src/http.js#L44-L78 (HTTPValidationError/Forbidden/NotFound/Conflict/ServiceUnavailable -> { ok: false, errors: [message] }) and #L128-L137`
  },
  {
    id: 'unhandled-server-error',
    statuses: [500],
    contentType: 'application/json',
    schema: OK_FALSE_ERRORS,
    source: `${ABS_PROVIDER_REF} office/shared/lib/src/http.js#L156-L160 (res.status(500).json({ ok: false, errors: [message] }))`
  }
]
