import type { DOMChange } from './dom-changes'

export interface Experiment {
  id: number
  name: string
  display_name?: string
  state: 'created' | 'ready' | 'running' | 'development' | 'full_on' | 'stopped' | 'archived' | 'scheduled'
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
  unit_type_id?: number  // API might return unit_type_id directly
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
  custom_section_field_values?: ExperimentCustomSectionFieldValue[] | Record<string, any>
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

export interface ABsmartlyConfig {
  apiKey?: string
  apiEndpoint: string
  sdkEndpoint?: string  // Optional SDK endpoint (defaults to apiEndpoint with .io)
  applicationId?: number  // Application ID (numeric)
  applicationName?: string  // Application name (string)
  domChangesFieldName?: string
  authMethod?: 'jwt' | 'apikey'  // New field for auth method preference
  sdkWindowProperty?: string  // Window property where SDK context is stored (e.g., 'ABsmartlyContext', 'window.sdk.context')
  queryPrefix?: string  // Query parameter prefix for overrides (e.g., '_')
  persistQueryToCookie?: boolean  // Whether to persist query overrides to cookie
  injectSDK?: boolean  // Whether to inject the ABsmartly SDK if not detected
  sdkUrl?: string  // Custom SDK URL (defaults to https://sdk.absmartly.com/sdk.js)
  aiProvider?: 'claude-subscription' | 'anthropic-api' | 'openai-api'  // AI provider for DOM generation
  aiApiKey?: string  // API key for AI provider (Anthropic or OpenAI)
  llmModel?: string  // Model for LLM provider (e.g., 'sonnet', 'opus', 'haiku' for Claude)
}

export type CustomCodeSection = 'headStart' | 'headEnd' | 'bodyStart' | 'bodyEnd' | 'styleTag'

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

export interface ExperimentInjectionCode {
  headStart?: string  // Injected at top of <head>
  headEnd?: string    // Injected at bottom of <head>
  bodyStart?: string  // Injected at top of <body>
  bodyEnd?: string    // Injected at bottom of <body>
  urlFilter?: import('~src/types/dom-changes').URLFilter  // URL filtering (same type as DOM changes)
}

export type CustomSectionFieldType = 'text' | 'string' | 'json' | 'boolean' | 'number'

export interface ExperimentCustomSectionField {
  id: number
  section_id: number
  title: string
  help_text: string
  placeholder: string
  default_value: string
  type: CustomSectionFieldType
  required: boolean
  archived: boolean
  order_index: number
  available_in_sdk?: boolean
  sdk_field_name?: string | null
  created_at?: string
  updated_at?: string | null
}

export interface ExperimentCustomSectionFieldValue {
  id?: number
  experiment_id?: number
  experiment_custom_section_field_id?: number
  type: CustomSectionFieldType
  value: string
  updated_at?: string
  updated_by_user_id?: number
  default_value?: string
}

export interface ConversationSession {
  id: string
  htmlSent: boolean
  messages: Array<{role: 'user' | 'assistant', content: string}>
  conversationId?: string
  tabId?: number  // Store the tab ID for chunk retrieval
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  domChangesSnapshot?: DOMChange[]
  timestamp: number
  id: string
  aiResponse?: string
}

export interface StoredConversation {
  id: string
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
