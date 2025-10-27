import type { ABsmartlyConfig } from '~src/types/absmartly'
import type { ExtensionMessage } from '~src/lib/messaging'

export interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'
  path: string
  data?: any
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  isAuthError?: boolean
}

export interface MessageHandler {
  (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean | void
}

export interface RouteResult {
  handled: boolean
  async: boolean
}

export interface StorageInstances {
  storage: any
  secureStorage: any
  sessionStorage: any
}

export interface ConfigValidationResult {
  valid: boolean
  config?: ABsmartlyConfig
  error?: string
}

export type { ABsmartlyConfig, ExtensionMessage }
