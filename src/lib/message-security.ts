import { debugWarn, debugError } from '../utils/debug'

const ALLOWED_MESSAGE_TYPES = new Set([
  'PING',
  'INJECT_SDK_PLUGIN',
  'CAPTURE_HTML',
  'GET_HTML_CHUNK',
  'START_ELEMENT_PICKER',
  'CANCEL_ELEMENT_PICKER',
  'CHECK_PLUGIN_STATUS',
  'CHECK_VISUAL_EDITOR_ACTIVE',
  'SET_VISUAL_EDITOR_STARTING',
  'START_VISUAL_EDITOR',
  'STOP_VISUAL_EDITOR',
  'GET_VISUAL_EDITOR_STATUS',
  'ABSMARTLY_PREVIEW',
  'OPEN_CODE_EDITOR',
  'CLOSE_CODE_EDITOR',
  'OPEN_JSON_EDITOR',
  'CLOSE_JSON_EDITOR',
  'OPEN_MARKDOWN_EDITOR',
  'CLOSE_MARKDOWN_EDITOR',
  'OPEN_JAVASCRIPT_EDITOR',
  'CLOSE_JAVASCRIPT_EDITOR',
  'OPEN_EVENT_VIEWER',
  'CLOSE_EVENT_VIEWER',
  'ELEMENT_SELECTED',
  'VISUAL_EDITOR_CHANGES',
  'VISUAL_EDITOR_STOPPED',
  'PREVIEW_STATE_CHANGED',
  'CODE_EDITOR_SAVE',
  'CODE_EDITOR_CLOSE',
  'JSON_EDITOR_SAVE',
  'JSON_EDITOR_CLOSE',
  'MARKDOWN_EDITOR_SAVE',
  'MARKDOWN_EDITOR_CLOSE',
  'JAVASCRIPT_EDITOR_SAVE',
  'JAVASCRIPT_EDITOR_CLOSE',
  'SDK_EVENT',
  'STORAGE_GET',
  'STORAGE_SET',
  'STORAGE_REMOVE',
  'GET_CONFIG',
  'BUFFER_EVENT',
  'GET_BUFFERED_EVENTS',
  'CLEAR_BUFFERED_EVENTS'
])

export interface MessageValidationResult {
  valid: boolean
  error?: string
  securityViolation?: boolean
}

export function validateMessageType(type: string): MessageValidationResult {
  if (!type || typeof type !== 'string') {
    return {
      valid: false,
      error: 'Message type must be a non-empty string',
      securityViolation: true
    }
  }

  if (!ALLOWED_MESSAGE_TYPES.has(type)) {
    debugWarn('[Security] Unknown message type received:', type)
    return {
      valid: false,
      error: `Unknown message type: ${type}`,
      securityViolation: true
    }
  }

  return { valid: true }
}

export function validateSender(
  sender: chrome.runtime.MessageSender,
  requireExtensionOrigin: boolean = true
): MessageValidationResult {
  if (!sender) {
    return {
      valid: false,
      error: 'No sender information provided',
      securityViolation: true
    }
  }

  if (requireExtensionOrigin) {
    const extensionId = chrome.runtime.id
    if (sender.id !== extensionId) {
      debugError('[Security] Message from unauthorized extension:', sender.id)
      return {
        valid: false,
        error: 'Message from unauthorized extension',
        securityViolation: true
      }
    }
  }

  return { valid: true }
}

export function validateFrameId(sender: chrome.runtime.MessageSender): MessageValidationResult {
  if (sender.frameId === undefined || sender.frameId === null) {
    debugWarn('[Security] Message missing frameId')
    return {
      valid: false,
      error: 'Message must include frameId',
      securityViolation: false
    }
  }

  if (sender.frameId !== 0) {
    debugWarn('[Security] Message from non-main frame:', sender.frameId)
    return {
      valid: false,
      error: 'Messages only accepted from main frame',
      securityViolation: true
    }
  }

  return { valid: true }
}

export function validateMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  options: {
    requireExtensionOrigin?: boolean
    requireMainFrame?: boolean
  } = {}
): MessageValidationResult {
  const typeValidation = validateMessageType(message?.type)
  if (!typeValidation.valid) {
    return typeValidation
  }

  const senderValidation = validateSender(sender, options.requireExtensionOrigin ?? true)
  if (!senderValidation.valid) {
    return senderValidation
  }

  if (options.requireMainFrame ?? true) {
    const frameValidation = validateFrameId(sender)
    if (!frameValidation.valid) {
      return frameValidation
    }
  }

  return { valid: true }
}

export function createSecureMessageHandler<T = any>(
  handler: (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: T) => void) => boolean | void,
  options?: {
    requireExtensionOrigin?: boolean
    requireMainFrame?: boolean
  }
): (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: T) => void) => boolean | void {
  return (message, sender, sendResponse) => {
    const validation = validateMessage(message, sender, options)

    if (!validation.valid) {
      if (validation.securityViolation) {
        debugError('[Security] Message validation failed:', validation.error)
      }
      sendResponse({
        success: false,
        error: validation.error
      } as T)
      return true
    }

    return handler(message, sender, sendResponse)
  }
}
