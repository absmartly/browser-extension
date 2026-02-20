import type { DOMChange } from '../../types/dom-changes'

export type MessageSource = 'absmartly-page' | 'absmartly-extension'

export interface SDKEventPayload {
  eventName: string
  data: unknown
  timestamp: string
}


export interface PreviewChangesPayload {
  changes: DOMChange[]
  experimentName: string
}

export interface RemovePreviewPayload {
  experimentName: string
}

export interface ApplyOverridesPayload {
  overrides: Record<string, unknown>
}

export type ExtensionMessage =
  | {
      source: MessageSource
      type: 'SDK_CONTEXT_READY'
    }
  | {
      source: MessageSource
      type: 'SDK_EVENT'
      payload: SDKEventPayload
    }
  | {
      source: MessageSource
      type: 'PREVIEW_CHANGES'
      payload: PreviewChangesPayload
    }
  | {
      source: MessageSource
      type: 'REMOVE_PREVIEW'
      payload: RemovePreviewPayload
    }
  | {
      source: MessageSource
      type: 'APPLY_OVERRIDES'
      payload: ApplyOverridesPayload
    }

export function isExtensionMessage(msg: unknown): msg is ExtensionMessage {
  if (typeof msg !== 'object' || msg === null) return false
  const m = msg as Record<string, unknown>
  if (!('source' in m) || !('type' in m)) return false
  const validSources: MessageSource[] = ['absmartly-page', 'absmartly-extension']
  const validTypes = [
    'SDK_CONTEXT_READY',
    'SDK_EVENT',
    'PREVIEW_CHANGES',
    'REMOVE_PREVIEW',
    'APPLY_OVERRIDES'
  ]
  return validSources.includes(m.source as MessageSource) && validTypes.includes(m.type as string)
}

export function isSDKEventMessage(msg: ExtensionMessage): msg is Extract<ExtensionMessage, { type: 'SDK_EVENT' }> {
  return msg.type === 'SDK_EVENT'
}

export function isPreviewChangesMessage(
  msg: ExtensionMessage
): msg is Extract<ExtensionMessage, { type: 'PREVIEW_CHANGES' }> {
  return msg.type === 'PREVIEW_CHANGES'
}

export function isRemovePreviewMessage(
  msg: ExtensionMessage
): msg is Extract<ExtensionMessage, { type: 'REMOVE_PREVIEW' }> {
  return msg.type === 'REMOVE_PREVIEW'
}

export function isApplyOverridesMessage(
  msg: ExtensionMessage
): msg is Extract<ExtensionMessage, { type: 'APPLY_OVERRIDES' }> {
  return msg.type === 'APPLY_OVERRIDES'
}
