/**
 * Background Script - Main Entry Point
 *
 * This module provides a single initialization function that sets up all
 * Chrome event listeners and background script functionality.
 *
 * This approach is compatible with Plasmo's bundling system while keeping
 * the code modular and testable.
 */

import { Storage } from "@plasmohq/storage"
import type { ABsmartlyConfig } from '~src/types/absmartly'
import type { DOMChangesInlineState, ElementPickerResult } from '~src/types/storage-state'
import type { ExtensionMessage } from '~src/lib/messaging'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { checkAuthentication } from '~src/utils/auth'

// Import core modules
import { routeMessage, validateSender } from './core/message-router'
import { makeAPIRequest, openLoginPage } from './core/api-client'
import { getConfig, initializeConfig } from './core/config-manager'

// Import handlers
import {
  handleStorageGet,
  handleStorageSet,
  handleStorageRemove
} from './handlers/storage-handler'

import {
  bufferSDKEvent,
  getBufferedEvents,
  clearBufferedEvents
} from './handlers/event-buffer'

import {
  initializeInjectionHandler
} from './handlers/injection-handler'

import {
  initializeAvatarProxy
} from './handlers/avatar-proxy'

// Import validation
import { safeValidateAPIRequest } from './utils/validation'

// Storage instances for message handlers
const storage = new Storage()
const secureStorage = new Storage({
  area: "local",
  secretKeyring: true
} as any)

const sessionStorage = new Storage({ area: "session" })

/**
 * Initialize the background script
 * Sets up all Chrome event listeners and initializes modules
 */
export function initializeBackgroundScript() {
  debugLog('[Background] Initializing background script...')

  // Initialize configuration on startup
  initializeConfig(storage, secureStorage).catch(err =>
    debugError('[Background] Init config error:', err)
  )

  // Initialize handlers
  initializeInjectionHandler()
  initializeAvatarProxy()

  // Set up message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Validate sender - only accept messages from our own extension
    if (!validateSender(sender)) {
      debugWarn('[Background] Rejected message from unauthorized sender:', sender)
      return false
    }

    debugLog('[Background] Received message:', message.type)

    // NEW UNIFIED MESSAGE ROUTER
    // Route messages based on 'to' field if present (new message format)
    if (message.from && message.to) {
      const extensionMessage = message as ExtensionMessage
      debugLog(
        `[Background Router] Received message: ${extensionMessage.type} from ${extensionMessage.from} to ${extensionMessage.to}`
      )

      // Use the message router
      routeMessage(extensionMessage)
        .then(response => {
          sendResponse(response)
        })
        .catch(error => {
          debugError('[Background Router] Error routing message:', error)
          sendResponse({ error: error.message })
        })
      return true // Will respond asynchronously
    }

    // EXISTING MESSAGE HANDLERS (for backward compatibility)
    if (message.type === 'STORAGE_GET') {
      handleStorageGet(message.key)
        .then(value => {
          debugLog('[Background] Storage GET:', message.key, '=', value)
          sendResponse({ success: true, value })
        })
        .catch(error => {
          debugError('[Background] Storage GET error:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true
    } else if (message.type === 'STORAGE_SET') {
      handleStorageSet(message.key, message.value)
        .then(() => {
          debugLog('[Background] Storage SET:', message.key, '=', message.value)
          sendResponse({ success: true })
        })
        .catch(error => {
          debugError('[Background] Storage SET error:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true
    } else if (message.type === 'STORAGE_REMOVE') {
      handleStorageRemove(message.key)
        .then(() => {
          debugLog('[Background] Storage REMOVE:', message.key)
          sendResponse({ success: true })
        })
        .catch(error => {
          debugError('[Background] Storage REMOVE error:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true
    } else if (message.type === 'SDK_EVENT') {
      console.log('[Background] Received SDK_EVENT:', message.payload)
      bufferSDKEvent(message.payload)
        .then(() => {
          console.log('[Background] Event buffered, broadcasting...')
          // Broadcast new event to all extension pages for real-time updates
          chrome.runtime.sendMessage({
            type: 'SDK_EVENT_BROADCAST',
            payload: message.payload
          }).then(() => {
            console.log('[Background] SDK_EVENT_BROADCAST sent successfully')
          }).catch((err) => {
            console.log('[Background] No listeners for SDK_EVENT_BROADCAST (this is normal if sidebar not open):', err?.message)
          })
          sendResponse({ success: true })
        })
        .catch(error => {
          console.error('[Background] Failed to buffer event:', error)
          debugError('[Background] Failed to buffer event:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true
    } else if (message.type === 'GET_BUFFERED_EVENTS') {
      getBufferedEvents()
        .then(events => {
          debugLog('[Background] Retrieved buffered events:', events?.length || 0)
          sendResponse({ success: true, events: events || [] })
        })
        .catch(error => {
          debugError('[Background] Failed to get buffered events:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true
    } else if (message.type === 'CLEAR_BUFFERED_EVENTS') {
      clearBufferedEvents()
        .then(() => {
          debugLog('[Background] Cleared buffered events')
          sendResponse({ success: true })
        })
        .catch(error => {
          debugError('[Background] Failed to clear buffered events:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true
    } else if (message.type === 'ENSURE_SDK_PLUGIN_INJECTED') {
      console.log('[Background] ENSURE_SDK_PLUGIN_INJECTED requested, forwarding to active tab')
      // Forward to content script in active tab to inject SDK plugin
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'INJECT_SDK_PLUGIN' }, (response) => {
            console.log('[Background] Content script injection response:', response)
            sendResponse(response || { success: true })
          })
        } else {
          console.warn('[Background] No active tab found for SDK plugin injection')
          sendResponse({ success: false, error: 'No active tab' })
        }
      })
      return true
    } else if (message.type === 'TOGGLE_VISUAL_EDITOR') {
      // Forward to content script in active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, message)
        }
      })
    } else if (message.type === 'ELEMENT_SELECTED') {
      // Element picker returned a selector
      // Get the current state to find out which field we were picking for
      sessionStorage.get<DOMChangesInlineState>('domChangesInlineState').then(async (state) => {
        if (state && state.pickingForField) {

          // Store the result
          await sessionStorage.set('elementPickerResult', {
            variantName: state.variantName,
            fieldId: state.pickingForField,
            selector: message.selector
          })

          // Send message to sidebar to refresh with the selected element
          chrome.runtime.sendMessage({
            type: 'ELEMENT_PICKER_RESULT',
            variantName: state.variantName,
            fieldId: state.pickingForField,
            selector: message.selector
          }).catch(() => {
            // Ignore errors if no sidebar is open
          })
        }
      })
    } else if (message.type === 'GET_CURRENT_TAB_URL') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        sendResponse({ url: tabs[0]?.url || "" })
      })
      return true
    } else if (message.type === 'GET_DOM_CHANGES_FROM_TAB') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "GET_DOM_CHANGES" }, (response) => {
            sendResponse(response)
          })
        }
      })
      return true
    } else if (message.type === 'API_REQUEST') {
      // Handle API requests
      debugLog('[Background] Received API_REQUEST:', {
        method: message.method,
        path: message.path,
        data: message.data
      })

      makeAPIRequest(message.method, message.path, message.data)
        .then(data => {
          debugLog('[Background] API request successful')
          sendResponse({ success: true, data })
        })
        .catch(error => {
          debugError('[Background] API request failed:', error)
          debugError('[Background] Error details:', {
            message: error.message,
            response: error.response,
            status: error.response?.status,
            data: error.response?.data
          })
          const errorMessage = error.message || 'API request failed'
          sendResponse({
            success: false,
            error: errorMessage,
            isAuthError: errorMessage === 'AUTH_EXPIRED'
          })
        })
      return true
    } else if (message.type === 'OPEN_LOGIN') {
      // Open login page with auth check
      openLoginPage()
        .then(result => {
          sendResponse({ success: true, ...result })
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message })
        })
      return true
    } else if (message.type === 'PREVIEW_STATE_CHANGED') {
      // Forward preview state change to all extension pages (sidebar, inline editor, etc.)
      chrome.runtime.sendMessage(message).catch(() => {
        // Ignore errors if no extension pages are listening
      })
      sendResponse({ success: true })
    } else if (message.type === 'CHECK_AUTH') {
      console.log('[Background CHECK_AUTH] Received with requestId:', message.requestId)
      debugLog('[Background CHECK_AUTH] Received with requestId:', message.requestId)

      // Parse config from JSON if present (allows passing current form values)
      let configToUse: ABsmartlyConfig | null = null
      if (message.configJson) {
        try {
          configToUse = JSON.parse(message.configJson)
          console.log('[Background CHECK_AUTH] Using config from message:', configToUse)
          debugLog('[Background CHECK_AUTH] Using config from message:', configToUse)
        } catch (e) {
          console.error('[Background CHECK_AUTH] Failed to parse configJson:', e)
          debugError('[Background CHECK_AUTH] Failed to parse configJson:', e)
        }
      }

      // If no config in message, get from storage
      const configPromise = configToUse
        ? Promise.resolve(configToUse)
        : getConfig(storage, secureStorage)

      configPromise.then(async config => {
        console.log('[Background CHECK_AUTH] Got config, about to check auth')
        if (!config) {
          console.log('[Background CHECK_AUTH] No config, sending error')
          // Send result as new message with requestId
          chrome.runtime.sendMessage({
            type: 'CHECK_AUTH_RESULT',
            requestId: message.requestId,
            result: {
              authenticated: false,
              error: 'No configuration available'
            }
          })
          sendResponse({ success: true })
          return
        }

        try {
          console.log('[Background CHECK_AUTH] Calling checkAuthentication...')
          const authResult = await checkAuthentication(config)
          console.log('[Background CHECK_AUTH] Auth result:', authResult)
          debugLog('[Background CHECK_AUTH] Auth result:', authResult)

          // Send result as new message with requestId
          chrome.runtime.sendMessage({
            type: 'CHECK_AUTH_RESULT',
            requestId: message.requestId,
            result: authResult
          })

          sendResponse({ success: true })
        } catch (error) {
          console.error('[Background CHECK_AUTH] Error:', error)
          debugError('[Background CHECK_AUTH] Error:', error)

          // Send error result as new message with requestId
          chrome.runtime.sendMessage({
            type: 'CHECK_AUTH_RESULT',
            requestId: message.requestId,
            result: {
              authenticated: false,
              error: error instanceof Error ? error.message : String(error)
            }
          })

          sendResponse({ success: true })
        }
      })

      return true
    } else if (message.type === 'PING') {
      debugLog('[Background] PONG! Message system is working')
      sendResponse({ pong: true })
      return false
    }
  })

  debugLog('[Background] Background script initialized')
}

// Re-export all modules for external use
export * from './core/message-router'
export * from './core/api-client'
export * from './core/config-manager'
export * from './handlers/storage-handler'
export * from './handlers/event-buffer'
export * from './handlers/injection-handler'
export * from './handlers/avatar-proxy'
export * from './utils/validation'
export * from './utils/security'
export type * from './types'
export type { ABsmartlyConfig } from '~src/types/absmartly'
export type { ExtensionMessage } from '~src/lib/messaging'
