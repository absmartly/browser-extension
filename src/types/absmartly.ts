import type { DOMChange } from './dom-changes'

export interface Experiment {
  id: number
  name: string
  display_name?: string
  state: 'created' | 'ready' | 'running' | 'development' | 'full_on' | 'stopped' | 'archived' | 'scheduled'
  status?: 'draft' | 'running' | 'stopped' | 'archived'
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
  unit_type_id?: number
  primary_metric?: { metric_id: number; name?: string; id?: number }
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
  type?: 'group_sequential' | 'fixed_horizon' | 'test'
  favorite?: boolean
  custom_section_field_values?: ExperimentCustomSectionFieldValue[] | Record<string, unknown>
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
  icon_url?: string
}

export interface UnitType {
  unit_type_id: number
  name: string
}

export interface Metric {
  metric_id: number
  name: string
  description?: string
}

export interface ExperimentTag {
  experiment_tag_id: number
  name: string
}

export interface ExperimentOwner {
  user_id: number
  email: string
  first_name?: string
  last_name?: string
  avatar?: {
    base_url?: string
  }
}

export interface ExperimentUser {
  user_id: number
  email: string
  first_name?: string
  last_name?: string
  avatar?: {
    base_url?: string
  }
}

export interface ExperimentTeam {
  team_id: number
  name: string
}

export interface ExperimentCustomSectionFieldValue {
  id?: number
  experiment_id?: number
  custom_section_field_id?: number
  experiment_custom_section_field_id?: number
  type?: string
  value: unknown
  updated_at?: string
}

export interface ExperimentCustomSectionField {
  id: number
  custom_section_field_id: number
  name: string
  title?: string
  type: 'text' | 'select' | 'multiselect' | 'string' | 'json' | 'boolean' | 'number'
  required: boolean
  options?: string[]
  default_value?: string
  section_id?: number
  help_text?: string
  placeholder?: string
  archived?: boolean
  order_index?: number
}

export interface Environment {
  environment_id: number
  name: string
}

export interface ABsmartlyConfig {
  apiEndpoint: string
  apiKey?: string
  environment?: number
  authMethod?: 'jwt' | 'apikey'
  applicationId?: number
  applicationName?: string
  aiProvider?: 'claude-subscription' | 'anthropic-api' | 'openai-api' | 'anthropic' | 'openai'
  aiModel?: string
  aiApiKey?: string
  llmModel?: string
  sdkApiKey?: string
  sdkApplicationName?: string
  sdkWindowProperty?: string
  domChangesFieldName?: string
  queryPrefix?: string
  persistQueryToCookie?: boolean
}

export interface ABsmartlyUser {
  authenticated: boolean
  name?: string
  email?: string
  avatar?: {
    base_url?: string
  }
}

export interface Template {
  id: number
  name: string
  created_at: string
  updated_at: string
  created_by?: {
    first_name?: string
    last_name?: string
    email?: string
    avatar?: {
      base_url?: string
    }
  }
}

export interface ConversationSession {
  id?: string
  conversationId?: string
  htmlSent?: boolean
  anthropicSystemParameter?: string[]
  nextPrompt?: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  model?: string
}

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  images?: string[]
  aiResponse?: string
  domChangesSnapshot?: DOMChange[]
}

export interface AIDOMGenerationConversation {
  id: string
  experimentId: number
  variantName: string
  messages: ChatMessage[]
  conversationSession: ConversationSession
  createdAt: number
  updatedAt: number
  messageCount: number
  firstUserMessage: string
  isActive: boolean
}

export interface StoredConversation {
  id: string
  experimentId?: number
  variantName: string
  messages: ChatMessage[]
  conversationSession: ConversationSession
  createdAt: number
  updatedAt: number
  messageCount: number
  firstUserMessage: string
  isActive: boolean
}

export interface ConversationListItem {
  id: string
  createdAt: number
  updatedAt: number
  messageCount: number
  firstUserMessage: string
  isActive: boolean
  firstScreenshot?: string
}

export interface StoredConversationsData {
  conversations: StoredConversation[]
  version: number
}

export type { URLFilter, DOMChangesData, DOMChange } from './dom-changes'
