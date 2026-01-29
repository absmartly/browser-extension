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
import { generateDOMChanges } from '~src/lib/ai-dom-generator'

import { routeMessage, validateSender } from './core/message-router'
import { makeAPIRequest, openLoginPage } from './core/api-client'
import { getConfig, initializeConfig } from './core/config-manager'

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

import { safeValidateAPIRequest, ConfigSchema } from './utils/validation'
import { checkRateLimit } from './utils/rate-limiter'

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

  initializeConfig(storage, secureStorage).catch(err =>
    debugError('[Background] Init config error:', err)
  )

  initializeInjectionHandler()
  initializeAvatarProxy()

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!validateSender(sender)) {
      console.error('[Background] REJECTED message from unauthorized sender:', {
        senderId: sender.id,
        ourId: chrome.runtime.id,
        match: sender.id === chrome.runtime.id
      })
      debugWarn('[Background] Rejected message from unauthorized sender:', sender)
      return false
    }

    const senderId = sender.tab?.id?.toString() || sender.id || 'unknown'
    if (!checkRateLimit(senderId)) {
      debugWarn(`[Background] Rate limit exceeded for sender: ${senderId}`)
      sendResponse({
        success: false,
        error: 'Rate limit exceeded. Please slow down your requests.'
      })
      return false
    }

    if (message.from && message.to) {
      const extensionMessage = message as ExtensionMessage
      const result = routeMessage(extensionMessage, sender, sendResponse)
      return result.async
    }

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
          sendResponse({ success: false, error: message })
        })
      return true
    } else if (message.type === 'GET_CONFIG') {
      console.log('[Background] GET_CONFIG message received from:', sender.tab?.id, sender.url)
      getConfig(storage, secureStorage)
        .then(config => {
          console.log('[Background] GET_CONFIG config retrieved:', !!config)
          debugLog('[Background] GET_CONFIG returning config')
          sendResponse({ success: true, config })
          console.log('[Background] GET_CONFIG response sent')
        })
        .catch(error => {
          console.error('[Background] GET_CONFIG error:', error)
          debugError('[Background] GET_CONFIG error:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true
    } else if (message.type === 'SDK_EVENT') {
      console.log('[Background] Received SDK_EVENT:', message.payload)
      bufferSDKEvent(message.payload)
        .then(() => {
          console.log('[Background] Event buffered, broadcasting...')
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
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, message)
        }
      })
    } else if (message.type === 'ELEMENT_SELECTED') {
      sessionStorage.get<DOMChangesInlineState>('domChangesInlineState').then(async (state) => {
        if (state && state.pickingForField) {

          await sessionStorage.set('elementPickerResult', {
            variantName: state.variantName,
            fieldId: state.pickingForField,
            selector: message.selector
          })

          chrome.runtime.sendMessage({
            type: 'ELEMENT_PICKER_RESULT',
            variantName: state.variantName,
            fieldId: state.pickingForField,
            selector: message.selector
          }).catch(() => {
            debugLog("[Background] No sidebar listening for ELEMENT_PICKER_RESULT - this is expected if sidebar is closed")
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
      makeAPIRequest(message.method, message.path, message.data)
        .then(data => {
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
      openLoginPage()
        .then(result => {
          sendResponse({ success: true, ...result })
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message })
        })
      return true
    } else if (message.type === 'PREVIEW_STATE_CHANGED') {
      chrome.runtime.sendMessage(message).catch(() => {
        debugLog("[Background] No extension pages listening for PREVIEW_STATE_CHANGED - this is expected if sidebar is closed")
      })
      sendResponse({ success: true })
    } else if (message.type === 'CHECK_AUTH') {
      debugLog('[Background CHECK_AUTH] Received with requestId:', message.requestId)

      let configToUse: ABsmartlyConfig | null = null
      if (message.configJson) {
        try {
          const parsed = JSON.parse(message.configJson)
          const validationResult = ConfigSchema.safeParse(parsed)
          if (!validationResult.success) {
            debugError('[Background CHECK_AUTH] Config validation failed:', validationResult.error)
            sendResponse({
              success: false,
              error: 'Invalid configuration: ' + validationResult.error.issues.map(i => i.message).join(', ')
            })
            return true
          }
          configToUse = validationResult.data as ABsmartlyConfig
          debugLog('[Background CHECK_AUTH] Using validated config from message')
        } catch (e) {
          debugError('[Background CHECK_AUTH] Failed to parse configJson:', e)
          sendResponse({
            success: false,
            error: 'Failed to parse configuration JSON'
          })
          return true
        }
      }

      const configPromise = configToUse
        ? Promise.resolve(configToUse)
        : getConfig(storage, secureStorage)

      configPromise.then(async config => {
        if (!config) {
          const errorResult = {
            success: false,
            error: 'No configuration available'
          }
          sendResponse(errorResult)
          return
        }

        try {
          const authResult = await checkAuthentication(config)
          debugLog('[Background CHECK_AUTH] Auth result:', authResult)

          sendResponse(authResult)
        } catch (error) {
          debugError('[Background CHECK_AUTH] Error:', error)

          const errorResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
          sendResponse(errorResult)
        }
      })

      return true
    } else if (message.type === 'AI_GENERATE_DOM_CHANGES') {
      debugLog('[Background] Handling AI_GENERATE_DOM_CHANGES')

      ;(async () => {
        try {
          console.log('[Background] AI_GENERATE_DOM_CHANGES - Starting generation...')
          const config = await getConfig(storage, secureStorage)
          const { html, prompt, currentChanges, images, conversationSession, pageUrl, domStructure } = message
          console.log('[Background] Message keys:', Object.keys(message))
          console.log('[Background] HTML defined:', !!html, 'type:', typeof html)
          console.log('[Background] Prompt:', prompt, 'HTML length:', html?.length, 'Current changes:', currentChanges?.length || 0, 'Images:', images?.length || 0)
          console.log('[Background] Session:', conversationSession?.id || 'null')
          console.log('[Background] Page URL:', pageUrl)
          console.log('[Background] DOM Structure:', domStructure ? `${domStructure.substring(0, 100)}...` : 'not provided')
          console.log('[Background] AI Provider:', config?.aiProvider)
          console.log('[Background] LLM Model from config:', config?.llmModel || 'not set')

          const apiKeyToUse = (config?.aiProvider === 'anthropic-api' || config?.aiProvider === 'openai-api')
            ? config?.aiApiKey
            : config?.apiKey

          console.log('[Background] Config aiApiKey:', config?.aiApiKey ? `present (${config?.aiApiKey.substring(0, 10)}...)` : 'missing')
          console.log('[Background] Config apiKey:', config?.apiKey ? 'present' : 'missing')
          console.log('[Background] Using API key from config:', apiKeyToUse ? `present (${apiKeyToUse.substring(0, 10)}...)` : 'missing')

          const options: any = {
            aiProvider: config?.aiProvider,
            pageUrl,
            domStructure,
            llmModel: config?.llmModel
          }

          if (conversationSession) {
            options.conversationSession = conversationSession
            console.log('[Background] Passing session to generateDOMChanges:', conversationSession.id)
          }
          console.log('[Background] Passing pageUrl to generateDOMChanges:', pageUrl)

          if (!html && !conversationSession?.htmlSent) {
            throw new Error('HTML is required for the first message in a conversation')
          }

          console.error('🚀 [Background] Calling generateDOMChanges with aiProvider:', config?.aiProvider)
          console.log('[Background] Passing HTML:', html ? `${html.length} chars` : 'undefined (using session)')
          const result = await generateDOMChanges(html || '', prompt, apiKeyToUse || '', currentChanges || [], images, options)

          console.log('[Background] Generated result:', JSON.stringify(result, null, 2))
          console.log('[Background] Result keys:', Object.keys(result))
          console.log('[Background] Result.domChanges:', result.domChanges)
          console.log('[Background] Result.action:', result.action)
          console.log('[Background] Result.response:', result.response?.substring(0, 100))

          if (!result.domChanges) {
            console.error('[Background] ⚠️ Result missing domChanges property!', result)
            throw new Error('Invalid result: missing domChanges property')
          }

          if (!Array.isArray(result.domChanges)) {
            console.error('[Background] ⚠️ Result.domChanges is not an array!', typeof result.domChanges)
            throw new Error('Invalid result: domChanges must be an array')
          }

          const normalizedResult = {
            domChanges: result.domChanges || [],
            response: result.response || '',
            action: result.action || 'none',
            targetSelectors: result.targetSelectors
          }

          console.log('[Background] Normalized result:', normalizedResult)

          if (result.session) {
            console.log('[Background] Returning session:', result.session.id)
            sendResponse({ success: true, result: normalizedResult, session: result.session })
          } else {
            sendResponse({ success: true, result: normalizedResult })
          }
          console.log('[Background] Response sent successfully')
        } catch (error) {
          console.error('[Background] AI generation error:', error)
          console.error('[Background] Error stack:', error instanceof Error ? error.stack : 'No stack')
          debugError('[Background] AI generation error:', error)
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate DOM changes'
          })
        }
      })()
      return true
    } else if (message.type === 'AI_INITIALIZE_SESSION') {
      debugLog('[Background] Handling AI_INITIALIZE_SESSION')

      ;(async () => {
        try {
          console.log('[Background] AI_INITIALIZE_SESSION - Preparing session (no LLM call)...')
          const { conversationSession } = message

          const initializedSession = {
            ...conversationSession,
            htmlSent: false
          }

          console.log('[Background] Session prepared:', initializedSession.id, 'htmlSent:', initializedSession.htmlSent)
          sendResponse({ success: true, session: initializedSession })
          console.log('[Background] Initialization response sent successfully')
        } catch (error) {
          console.error('[Background] Session initialization error:', error)
          debugError('[Background] Session initialization error:', error)
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to initialize session'
          })
        }
      })()
      return true
    } else if (message.type === 'AI_REFRESH_HTML') {
      debugLog('[Background] Handling AI_REFRESH_HTML')

      ;(async () => {
        try {
          console.log('[Background] AI_REFRESH_HTML - Refreshing HTML context...')
          const config = await getConfig(storage, secureStorage)
          const { html, conversationSession } = message
          console.log('[Background] New HTML length:', html?.length, 'Session:', conversationSession?.id)

          if (!conversationSession) {
            throw new Error('No conversation session provided')
          }

          if (!html) {
            throw new Error('No HTML provided for refresh')
          }

          if (config?.aiProvider === 'anthropic-api' || config?.aiProvider === 'openai-api') {
            console.log('[Background] Resetting htmlSent flag for API provider')
            const updatedSession = {
              ...conversationSession,
              htmlSent: false
            }
            sendResponse({ success: true, session: updatedSession })
            return
          }

          if (config?.aiProvider === 'claude-subscription') {
            console.log('[Background] Refreshing HTML on Bridge server')
            const { ClaudeCodeBridgeClient } = await import('~src/lib/claude-code-client')
            const bridgeClient = new ClaudeCodeBridgeClient()

            try {
              await bridgeClient.connect()
              if (conversationSession.conversationId) {
                await bridgeClient.refreshHtml(conversationSession.conversationId, html)
                console.log('[Background] ✅ HTML refreshed on Bridge')
              }
              bridgeClient.disconnect()
            } catch (bridgeError) {
              console.error('[Background] Bridge refresh error:', bridgeError)
              bridgeClient.disconnect()
              throw bridgeError
            }

            const updatedSession = {
              ...conversationSession,
              htmlSent: false
            }
            sendResponse({ success: true, session: updatedSession })
            return
          }

          console.log('[Background] Unknown provider, resetting htmlSent flag')
          const updatedSession = {
            ...conversationSession,
            htmlSent: false
          }
          sendResponse({ success: true, session: updatedSession })

        } catch (error) {
          console.error('[Background] HTML refresh error:', error)
          debugError('[Background] HTML refresh error:', error)
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to refresh HTML'
          })
        }
      })()
      return true
    } else if (message.type === 'PING') {
      debugLog('[Background] PONG! Message system is working')
      sendResponse({ pong: true })
      return false
    }
  })

  debugLog('[Background] Background script initialized')
}

export * from './core/message-router'
export * from './core/api-client'
export * from './core/config-manager'
export * from './handlers/storage-handler'
export * from './handlers/event-buffer'
export * from './handlers/injection-handler'
export * from './handlers/avatar-proxy'
export {
  ConfigSchema,
  APIRequestSchema,
  safeValidateConfig,
  safeValidateAPIRequest
} from './utils/validation'
export type { ValidatedConfig, ValidatedAPIRequest } from './utils/validation'
export * from './utils/security'
export type {
  APIRequest,
  APIResponse,
  MessageHandler,
  StorageInstances,
  ConfigValidationResult
} from './types'
export type { ABsmartlyConfig } from '~src/types/absmartly'
export type { ExtensionMessage } from '~src/lib/messaging'
