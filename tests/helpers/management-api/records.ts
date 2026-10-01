// Deterministic, provider-shaped records for the controlled management API.
// Shapes follow the published @absmartly/api-mocks 1.0.9 schemas; every
// response is validated against them by the server before it is sent.
const TS = '2026-09-01T10:00:00.000Z'
const creatable = { created_at: TS, created_by_user_id: 1, updated_at: null, updated_by_user_id: null }

export const fixtureUser = (id = 1, first = 'Fixture', last = 'Owner') => ({
  id, external_id: null, email: `${first.toLowerCase()}.${last.toLowerCase()}@example.invalid`,
  first_name: first, last_name: last, department: 'QA', job_title: 'Tester',
  avatar_file_upload_id: null, avatar: null, ...creatable, archived: false,
  consecutive_login_failures: 0, last_login_at: TS, last_login_failure_at: null,
  demo_user: null, date_format_locale: null
})

export type ResourceState = {
  applications: any[]; unit_types: any[]; users: any[]; teams: any[]
  experiment_tags: any[]; metrics: any[]; metric_categories: any[]
  environments: any[]; experiment_custom_section_fields: any[]
}

export function defaultResources(): ResourceState {
  return {
    applications: [
      { id: 11, name: 'www', description: 'Fixture website', ...creatable, archived: false },
      { id: 12, name: 'app', description: 'Fixture app', ...creatable, archived: false }
    ],
    unit_types: [
      { id: 21, name: 'user_id', description: 'Fixture user unit', ...creatable, archived: false },
      { id: 22, name: 'session_id', description: 'Fixture session unit', ...creatable, archived: false }
    ],
    users: [fixtureUser(1), fixtureUser(2, 'Second', 'Owner')],
    teams: [{ id: 31, name: 'Fixture Team', ...creatable, archived: false, is_global_team: false }],
    experiment_tags: [
      { id: 41, tag: 'fixture-tag', ...creatable },
      { id: 42, tag: 'second-tag', ...creatable }
    ],
    metrics: [],
    metric_categories: [],
    environments: [],
    experiment_custom_section_fields: []
  }
}

let nextId = 1000
export function experimentRecord(overrides: Record<string, any> = {}) {
  const id = overrides.id ?? nextId++
  const name = overrides.name ?? `fixture_experiment_${id}`
  return {
    id, name, display_name: overrides.display_name ?? name, iteration: 1, type: 'test',
    state: 'created', start_at: null, stop_at: null, full_on_at: null, full_on_variant: null,
    nr_variants: 2, percentages: '50/50', percentage_of_traffic: 100,
    seed: '1', traffic_seed: '2', ...creatable, unit_type_id: 21, primary_metric_id: null,
    audience: '{"filter":[{"and":[]}]}', audience_strict: false, archived: false,
    analysis_type: 'fixed_horizon',
    variants: [
      { experiment_id: id, variant: 0, name: 'control', config: '{}' },
      { experiment_id: id, variant: 1, name: 'treatment', config: '{}' }
    ],
    applications: [], owners: [], teams: [], experiment_tags: [],
    unit_type: null, custom_section_field_values: [],
    ...overrides
  }
}

let nextNoteId = 5000
// Provider routes return the note recorded for the write (create/edit/start/stop).
export function experimentNote(experimentId: number, action: string) {
  return { id: nextNoteId++, reply_to_note_id: null, experiment_id: experimentId, action, note: null, ...creatable }
}
