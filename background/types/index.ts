import type { Storage } from '@plasmohq/storage'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import type { ExtensionMessage } from '~src/lib/messaging'

export interface APIRequest<T = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'
  path: string
  data?: T
}

export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  isAuthError?: boolean
}

export interface MessageHandler {
  (message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void): boolean | void
}

export interface RouteResult {
  handled: boolean
  async: boolean
}

export interface StorageInstances {
  storage: Storage
  secureStorage: Storage
  sessionStorage: Storage
}

export interface ConfigValidationResult {
  valid: boolean
  config?: ABsmartlyConfig
  error?: string
}

export type { ABsmartlyConfig, ExtensionMessage }
