/**
 * Message Type Definitions
 *
 * Types for messages passed between page context and extension
 */

export type MessageSource = 'absmartly-page' | 'absmartly-extension'

export type MessageType =
  | 'SDK_CONTEXT_READY'
  | 'SDK_EVENT'
  | 'PLUGIN_INITIALIZED'
  | 'REQUEST_CUSTOM_CODE'
  | 'INITIALIZE_PLUGIN'
  | 'INJECT_CUSTOM_CODE'
  | 'PREVIEW_CHANGES'
  | 'REMOVE_PREVIEW'
  | 'APPLY_OVERRIDES'

export interface ExtensionMessage<T = any> {
  source: MessageSource
  type: MessageType
  payload?: T
}

export interface SDKEventPayload {
  eventName: string
  data: any | null
  timestamp: string
}

export interface PluginInitializedPayload {
  version: string
  capabilities: string[]
}

export interface PreviewChangesPayload {
  changes: any[]
  experimentName: string
}

export interface RemovePreviewPayload {
  experimentName: string
}

export interface ApplyOverridesPayload {
  overrides: Record<string, any>
}

export interface InitializePluginPayload {
  config: {
    sdkEndpoint?: string
    apiEndpoint?: string
    queryPrefix?: string
    persistQueryToCookie?: boolean
  }
}
