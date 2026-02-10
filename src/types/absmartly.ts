import type { DOMChange, URLFilter } from './dom-changes'
import type { ExperimentId, ApplicationId, VariantName, APIEndpoint, ConversationId, SessionId } from './branded'

export interface Experiment {
  readonly id: ExperimentId
  readonly name: string
  readonly display_name?: string
  readonly state: 'created' | 'ready' | 'running' | 'development' | 'full_on' | 'stopped' | 'archived' | 'scheduled'
  readonly status?: 'draft' | 'running' | 'stopped' | 'archived'
  readonly created_at: string
  readonly updated_at?: string
  readonly full_on_variant?: number
  readonly percentage_of_traffic?: number
  readonly traffic_split?: number
  readonly nr_variants?: number
  readonly percentages?: string
  readonly audience?: string
  readonly audience_strict?: boolean
  readonly variants: readonly Variant[]
  readonly applications?: readonly Application[]
  readonly unit_type?: { readonly unit_type_id: number; readonly name?: string }
  readonly unit_type_id?: number
  readonly primary_metric?: { readonly metric_id: number; readonly name?: string; readonly id?: number }
  readonly experiment_tags?: readonly ExperimentTag[]
  readonly context_ids?: readonly string[]
  readonly owner?: ExperimentOwner
  readonly owners?: readonly ExperimentUser[]
  readonly teams?: readonly ExperimentTeam[]
  readonly created_by?: ExperimentUser
  readonly updated_by?: ExperimentUser
  readonly exposures?: number
  readonly started_at?: string
  readonly stopped_at?: string
  readonly type?: 'group_sequential' | 'fixed_horizon' | 'test'
  readonly favorite?: boolean
  readonly custom_section_field_values?: readonly ExperimentCustomSectionFieldValue[] | Readonly<Record<string, unknown>>
}

export interface Variant {
  readonly id?: number
  readonly variant?: number
  readonly name: VariantName
  readonly is_control?: boolean
  readonly config: string
}

export interface Application {
  readonly id?: number
  readonly application_id?: ApplicationId
  readonly name: string
  readonly application_version?: string
  readonly icon_url?: string
}

export interface UnitType {
  readonly unit_type_id: number
  readonly name: string
}

export interface Metric {
  readonly metric_id: number
  readonly name: string
  readonly description?: string
}

export interface ExperimentTag {
  readonly experiment_tag_id: number
  readonly name: string
}

export interface ExperimentOwner {
  readonly user_id: number
  readonly email: string
  readonly first_name?: string
  readonly last_name?: string
  readonly avatar?: {
    readonly base_url?: string
  }
}

export interface ExperimentUser {
  readonly user_id: number
  readonly email: string
  readonly first_name?: string
  readonly last_name?: string
  readonly avatar?: {
    readonly base_url?: string
  }
}

export interface ExperimentTeam {
  readonly team_id: number
  readonly name: string
}

export interface ExperimentCustomSectionFieldValue {
  readonly id?: number
  readonly experiment_id?: number
  readonly custom_section_field_id?: number
  readonly experiment_custom_section_field_id?: number
  readonly type?: string
  readonly value: unknown
  readonly updated_at?: string
}

export interface ExperimentCustomSectionField {
  readonly id: number
  readonly custom_section_field_id: number
  readonly name: string
  readonly title?: string
  readonly type: 'text' | 'select' | 'multiselect' | 'string' | 'json' | 'boolean' | 'number'
  readonly required: boolean
  readonly options?: readonly string[]
  readonly default_value?: string
  readonly section_id?: number
  readonly help_text?: string
  readonly placeholder?: string
  readonly archived?: boolean
  readonly order_index?: number
}

export interface Environment {
  readonly environment_id: number
  readonly name: string
}

export interface ExperimentInjectionCode {
  urlFilter?: URLFilter | string | string[]
  headStart?: string
  headEnd?: string
  bodyStart?: string
  bodyEnd?: string
}

export type CustomCodeSection = 'headStart' | 'headEnd' | 'bodyStart' | 'bodyEnd' | 'styleTag'

import type { AIProviderType } from '~src/lib/ai-providers'

type ABsmartlyConfigBase = {
  apiEndpoint: APIEndpoint
  environment?: number
  applicationId?: ApplicationId
  applicationName?: string
  aiProvider?: AIProviderType
  aiModel?: string
  aiApiKey?: string
  llmModel?: string
  providerModels?: {
    [key: string]: string
  }
  providerEndpoints?: {
    [key: string]: string
  }
  sdkApiKey?: string
  sdkApplicationName?: string
  sdkWindowProperty?: string
  domChangesFieldName?: string
  queryPrefix?: string
  persistQueryToCookie?: boolean
}

export type ABsmartlyConfig = ABsmartlyConfigBase &
  (
    | { authMethod: 'jwt'; apiKey?: never }
    | { authMethod: 'apikey'; apiKey: string }
    | { authMethod?: never; apiKey?: string }
  )

export interface ABsmartlyUser {
  readonly id: number
  readonly email?: string
  readonly first_name?: string
  readonly last_name?: string
  readonly name?: string
  readonly picture?: string
  readonly avatar?: {
    readonly base_url?: string
    readonly file_name?: string
  }
  readonly avatarUrl?: string
}

export interface Template {
  readonly id: number
  readonly name: string
  readonly created_at: string
  readonly updated_at: string
  readonly created_by?: {
    readonly first_name?: string
    readonly last_name?: string
    readonly email?: string
    readonly avatar?: {
      readonly base_url?: string
    }
  }
}

export interface ConversationSession {
  id?: SessionId
  conversationId?: ConversationId
  htmlSent?: boolean
  pageUrl?: string
  anthropicSystemParameter?: string[]
  nextPrompt?: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  model?: string
  provider?: string
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
  id: ConversationId
  experimentId: ExperimentId
  variantName: VariantName
  messages: ChatMessage[]
  conversationSession: ConversationSession
  createdAt: number
  updatedAt: number
  messageCount: number
  firstUserMessage: string
  isActive: boolean
}

export interface StoredConversation {
  id: ConversationId
  experimentId?: ExperimentId
  variantName: VariantName
  messages: ChatMessage[]
  conversationSession: ConversationSession
  createdAt: number
  updatedAt: number
  messageCount: number
  firstUserMessage: string
  isActive: boolean
}

export interface ConversationListItem {
  id: ConversationId
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
