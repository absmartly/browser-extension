export interface Experiment {
  id: number
  name: string
  display_name?: string
  state: 'created' | 'ready' | 'running' | 'development' | 'full_on' | 'running_not_full_on' | 'stopped' | 'archived' | 'scheduled'
  status?: 'draft' | 'running' | 'stopped' | 'archived' // For backward compatibility
  created_at: string
  updated_at?: string
  full_on_variant?: number
  percentage_of_traffic?: number
  traffic_split?: number
  nr_variants?: number
  percentages?: string
  audience?: string
  audience_strict?: boolean
  variants: Variant[]
  applications?: Application[]
  unit_type?: { unit_type_id: number; name?: string }
  primary_metric?: { metric_id: number; name?: string }
  experiment_tags?: ExperimentTag[]
  context_ids?: string[]
  owner?: ExperimentOwner
  owners?: ExperimentUser[]
  teams?: ExperimentTeam[]
  created_by?: ExperimentUser
  updated_by?: ExperimentUser
  exposures?: number
  started_at?: string
  stopped_at?: string
  type?: 'group_sequential' | 'fixed_horizon'
  favorite?: boolean
}

export interface Variant {
  id?: number
  variant?: number
  name: string
  is_control?: boolean
  config: string
}

export interface Application {
  id?: number
  application_id?: number
  name: string
  application_version?: string
}

export interface DOMChange {
  selector: string
  action: 'text' | 'html' | 'style' | 'attribute' | 'class' | 'javascript'
  value?: string
  attribute?: string
  css?: Record<string, string>
  className?: string
  script?: string
}

export interface ABsmartlyConfig {
  apiKey?: string
  apiEndpoint: string
  sdkEndpoint?: string  // Optional SDK endpoint (defaults to apiEndpoint with .io)
  applicationName?: string  // Changed from applicationId to applicationName
  domChangesStorageType?: 'variable' | 'custom_field'
  domChangesFieldName?: string
  authMethod?: 'jwt' | 'apikey'  // New field for auth method preference
  sdkWindowProperty?: string  // Window property where SDK context is stored (e.g., 'ABsmartlyContext', 'window.sdk.context')
  queryPrefix?: string  // Query parameter prefix for overrides (e.g., '_exp_')
  persistQueryToCookie?: boolean  // Whether to persist query overrides to cookie
  injectSDK?: boolean  // Whether to inject the ABsmartly SDK if not detected
  sdkUrl?: string  // Custom SDK URL (defaults to https://sdk.absmartly.com/sdk.js)
}

export type CustomCodeSection = 'headStart' | 'headEnd' | 'bodyStart' | 'bodyEnd' | 'styleTag'

export interface CustomCode {
  headStart?: string
  headEnd?: string
  bodyStart?: string
  bodyEnd?: string
  styleTag?: string
}

export interface ABsmartlyUser {
  id: number
  email: string
  name: string
  picture?: string
  authenticated: boolean
}

export interface ExperimentOwner {
  user_id: number
  email?: string
  first_name?: string
  last_name?: string
  avatar?: {
    base_url: string
  }
}

export interface ExperimentUser {
  user_id?: number
  id?: number
  email?: string
  first_name?: string
  last_name?: string
  avatar?: {
    id: number
    base_url: string
    width?: number
    height?: number
    file_name?: string
    content_type?: string
  }
}

export interface ExperimentTag {
  experiment_tag_id?: number
  id?: number
  tag?: string
  name?: string
  experiment_tag?: {
    id: number
    tag: string
    name?: string
  }
}

export interface ExperimentTeam {
  team_id?: number
  id?: number
  name?: string
  display_name?: string
  team?: {
    id: number
    name: string
    display_name?: string
  }
}
