/**
 * Background Script - Unified Entry Point
 *
 * This is the main entry point for the refactored background script.
 * It imports and re-exports all modules for use in background.ts.
 *
 * Architecture:
 * - core/: Core functionality (message routing, API client, config)
 * - handlers/: Event handlers (auth, storage, events, injection, avatars)
 * - utils/: Utilities (validation, security)
 * - types/: TypeScript type definitions
 */

// Core modules
export {
  routeMessage,
  validateSender,
  isUnifiedMessage,
  forwardToActiveTab,
  broadcastToExtension
} from './core/message-router'

export {
  makeAPIRequest,
  getJWTCookie,
  openLoginPage,
  isAuthError
} from './core/api-client'

export {
  getConfig,
  initializeConfig
} from './core/config-manager'

// Handler modules
export {
  handleStorageGet,
  handleStorageSet,
  handleStorageRemove,
  getLocalStorage,
  setLocalStorage,
  getSecureStorage,
  setSecureStorage
} from './handlers/storage-handler'

export {
  bufferSDKEvent,
  getBufferedEvents,
  clearBufferedEvents
} from './handlers/event-buffer'

export {
  registerFileUrlContentScript,
  isRestrictedUrl,
  injectOrToggleSidebar,
  initializeInjectionHandler
} from './handlers/injection-handler'

export {
  handleAvatarFetch,
  handleFetchEvent,
  initializeAvatarProxy
} from './handlers/avatar-proxy'

// Utility modules
export {
  validateConfig,
  validateAPIRequest,
  safeValidateConfig,
  safeValidateAPIRequest
} from './utils/validation'

export {
  validateAPIEndpoint,
  isSSRFSafe,
  validateAvatarUrl,
  validateExtensionSender,
  sanitizeHostname,
  ALLOWED_API_DOMAINS,
  BLOCKED_HOSTS
} from './utils/security'

// Type exports
export type {
  APIRequest,
  APIResponse,
  MessageHandler,
  RouteResult,
  StorageInstances,
  ConfigValidationResult
} from './types'

export type { ABsmartlyConfig } from '~src/types/absmartly'
export type { ExtensionMessage } from '~src/lib/messaging'
