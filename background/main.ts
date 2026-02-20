/**
 * Background Script - Main Entry Point
 *
 * This module provides a single initialization function that sets up all
 * Chrome event listeners and background script functionality.
 *
 * This approach is compatible with Plasmo's bundling system while keeping
 * the code modular and testable.
 */

import type { ABsmartlyConfig } from '~src/types/absmartly'
import type { DOMChangesInlineState, ElementPickerResult } from '~src/types/storage-state'
import type { ExtensionMessage } from '~src/lib/messaging'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { checkAuthentication } from '~src/utils/auth'
import { generateDOMChanges } from '~src/lib/ai-dom-generator'
import { storage, secureStorage, sessionStorage } from '~src/lib/storage-instances'

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

const ALLOWED_STORAGE_KEYS = new Set([
  'absmartly-config',
  'experiment_overrides',
  'development_environment',
  'domChangesInlineState',
  'elementPickerResult',
  'claudeBridgePort',
  'recent-experiments',
  'experiments-cache',
  'experiments-cache_meta',
  'sidebar-state',
  'sdk-events',
  'visual-editor-state',
  'ai-conversation-active'
])

function isAllowedStorageKey(key: string): boolean {
  if (ALLOWED_STORAGE_KEYS.has(key)) return true
  if (key.startsWith('experiments-cache_chunk_')) return true
  if (key.startsWith('ai-conversation-')) return true
  return false
}

export function detectPluginStatusInPage() {
  const registry = (window as any).__ABSMARTLY_PLUGINS__ || null
  const domInitialized = !!registry?.dom?.initialized
  const overridesInitialized = !!registry?.overrides?.initialized
  const hasWindowPlugin = !!(window as any).__absmartlyPlugin
  const hasWindowDomPlugin = !!(window as any).__absmartlyDOMChangesPlugin

  const possibleLocations = [
    (window as any).ABsmartlyContext,
    (window as any).absmartly,
    (window as any).ABsmartly,
    (window as any).__absmartly,
    (window as any).sdk,
    (window as any).abSmartly,
    (window as any).context,
    (window as any).absmartlyContext,
    (window as any).__context
  ]

  let context: any = null
  let contextPath: string | null = null

  for (const location of possibleLocations) {
    if (location && typeof location.treatment === 'function') {
      context = location
      break
    }
  }

  if (!context) {
    for (const location of possibleLocations) {
      if (location && location.context && typeof location.context.treatment === 'function') {
        context = location.context
        break
      }
    }
  }

  if (!context) {
    for (const location of possibleLocations) {
      if (location && Array.isArray(location.contexts) && location.contexts.length > 0) {
        for (const ctx of location.contexts) {
          if (ctx && typeof ctx.treatment === 'function') {
            context = ctx
            break
          }
        }
        if (context) break
      }
    }
  }

  if (context) {
    if ((window as any).ABsmartlyContext === context) {
      contextPath = 'ABsmartlyContext'
    } else if ((window as any).absmartly === context) {
      contextPath = 'absmartly'
    } else if ((window as any).sdk && (window as any).sdk.context === context) {
      contextPath = 'sdk.context'
    } else {
      contextPath = 'unknown'
    }
  }

  const contextDomPlugin = context?.__domPlugin || null
  const hasContextDomPlugin = !!(
    contextDomPlugin &&
    (contextDomPlugin.initialized || contextDomPlugin.instance || contextDomPlugin.version)
  )

  const hasDomArtifacts = !!document.querySelector(
    '[data-absmartly-modified], [data-absmartly-created], [data-absmartly-injected]'
  )

  const pluginDetected =
    hasContextDomPlugin ||
    domInitialized ||
    overridesInitialized ||
    hasWindowPlugin ||
    hasWindowDomPlugin ||
    hasDomArtifacts

  return {
    pluginDetected,
    registry,
    domInitialized,
    overridesInitialized,
    hasWindowPlugin,
    hasWindowDomPlugin,
    hasDomArtifacts,
    hasContextDomPlugin,
    contextPath
  }
}

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
    const messageType = message.type || (message as any).action || 'unknown'
    if (!checkRateLimit(senderId, {}, messageType)) {
      debugWarn(`[Background] Rate limit exceeded for sender: ${senderId}, message type: ${messageType}`)
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

    if (message.type === 'STORAGE_GET' || message.type === 'STORAGE_SET' || message.type === 'STORAGE_REMOVE') {
      if (!isAllowedStorageKey(message.key)) {
        debugWarn('[Background] Rejected storage access for disallowed key:', message.key)
        sendResponse({ success: false, error: `Storage key not allowed: ${message.key}` })
        return false
      }
    }

    if (message.type === 'STORAGE_GET') {
      handleStorageGet(message.key)
        .then(value => {
          debugLog('[Background] Storage GET:', message.key)
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
          debugLog('[Background] Storage SET:', message.key)
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
          sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
        })
      return true
    } else if (message.type === 'GET_CONFIG') {
      debugLog('[Background] GET_CONFIG message received from:', sender.tab?.id, sender.url)
      getConfig(storage, secureStorage)
        .then(config => {
          debugLog('[Background] GET_CONFIG config retrieved:', !!config)
          debugLog('[Background] GET_CONFIG returning config')
          sendResponse({ success: true, config })
          debugLog('[Background] GET_CONFIG response sent')
        })
        .catch(error => {
          console.error('[Background] GET_CONFIG error:', error)
          debugError('[Background] GET_CONFIG error:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true
    } else if (message.type === 'SDK_EVENT') {
      bufferSDKEvent(message.payload)
        .then(() => {
          chrome.runtime.sendMessage({
            type: 'SDK_EVENT_BROADCAST',
            payload: message.payload
          }).catch((error) => {
            if (!error?.message?.includes('Receiving end does not exist') &&
                !error?.message?.includes('message port closed')) {
              debugError('[Background] Unexpected error broadcasting SDK event:', error)
            }
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
    } else if (message.type === 'CHECK_PLUGIN_STATUS_MAIN') {
      if (!sender.tab?.id) {
        sendResponse({ pluginDetected: false, error: 'No tab context for status check' })
        return false
      }

      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        world: 'MAIN',
        func: detectPluginStatusInPage
      }).then((results) => {
        const result = results?.[0]?.result
        sendResponse(result || { pluginDetected: false })
      }).catch((error) => {
        debugError('[Background] CHECK_PLUGIN_STATUS_MAIN error:', error)
        sendResponse({ pluginDetected: false, error: error.message })
      })
      return true
    } else if (message.type === 'ENSURE_SDK_PLUGIN_INJECTED') {
      debugLog('[Background] ENSURE_SDK_PLUGIN_INJECTED requested, forwarding to active tab')
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'INJECT_SDK_PLUGIN' }, (response) => {
            debugLog('[Background] Content script injection response:', response)
            sendResponse(response || { success: true })
          })
        } else {
          debugWarn('[Background] No active tab found for SDK plugin injection')
          sendResponse({ success: false, error: 'No active tab' })
        }
      })
      return true
    } else if (message.type === 'TOGGLE_VISUAL_EDITOR') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, message)
            .then(() => {
              sendResponse({ success: true })
            })
            .catch((error) => {
              debugError('[Background] Failed to toggle visual editor:', error?.message)
              sendResponse({ success: false, error: error?.message || 'Failed to toggle visual editor' })
            })
        } else {
          debugWarn('[Background] No active tab found for TOGGLE_VISUAL_EDITOR')
          sendResponse({ success: false, error: 'No active tab' })
        }
      })
      return true
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
          }).catch((error) => {
            if (error?.message?.includes('Receiving end does not exist') ||
                error?.message?.includes('message port closed')) {
              debugLog("[Background] No sidebar listening for ELEMENT_PICKER_RESULT - this is expected if sidebar is closed")
            } else {
              debugError("[Background] Unexpected error sending ELEMENT_PICKER_RESULT:", error)
            }
          })
        }
      }).catch((error) => {
        debugError("[Background] Failed to handle ELEMENT_SELECTED:", error)
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
        } else {
          sendResponse({ success: false, error: 'No active tab' })
        }
      })
      return true
    } else if (message.type === 'CAPTURE_HTML') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "CAPTURE_HTML" }, (response) => {
            sendResponse(response)
          })
        } else {
          sendResponse({ success: false, error: 'No active tab' })
        }
      })
      return true
    } else if (message.type === 'CHECK_VISUAL_EDITOR_ACTIVE') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "CHECK_VISUAL_EDITOR_ACTIVE" }, (response) => {
            sendResponse(response)
          })
        } else {
          sendResponse(false)
        }
      })
      return true
    } else if (message.type === 'API_REQUEST') {
      const validation = safeValidateAPIRequest({ method: message.method, path: message.path, data: message.data })
      if (!validation.success) {
        debugWarn('[Background] Invalid API request:', validation.error.issues)
        sendResponse({ success: false, error: 'Invalid API request parameters' })
        return false
      }
      makeAPIRequest(validation.data.method, validation.data.path, validation.data.data)
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
      chrome.runtime.sendMessage(message).catch((error) => {
        if (error?.message?.includes('Receiving end does not exist') ||
            error?.message?.includes('message port closed')) {
          debugLog("[Background] No extension pages listening for PREVIEW_STATE_CHANGED - this is expected if sidebar is closed")
        } else {
          debugError("[Background] Unexpected error broadcasting PREVIEW_STATE_CHANGED:", error)
        }
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
      }).catch((error) => {
        debugError('[Background CHECK_AUTH] Failed to resolve config:', error)
        sendResponse({
          success: false,
          error: 'Failed to load configuration'
        })
      })

      return true
    } else if (message.type === 'AI_GENERATE_DOM_CHANGES') {
      debugLog('[Background] Handling AI_GENERATE_DOM_CHANGES')

      ;(async () => {
        try {
          debugLog('[Background] AI_GENERATE_DOM_CHANGES - Starting generation...')
          const config = await getConfig(storage, secureStorage)
          const { html, prompt, currentChanges, images, conversationSession, pageUrl, domStructure } = message
          debugLog('[Background] Message keys:', Object.keys(message))
          debugLog('[Background] HTML defined:', !!html, 'type:', typeof html)
          debugLog('[Background] Prompt:', prompt, 'HTML length:', html?.length, 'Current changes:', currentChanges?.length || 0, 'Images:', images?.length || 0)
          debugLog('[Background] Session:', conversationSession?.id || 'null')
          debugLog('[Background] Page URL:', pageUrl)
          debugLog('[Background] DOM Structure:', domStructure ? `${domStructure.substring(0, 100)}...` : 'not provided')
          debugLog('[Background] AI Provider:', config?.aiProvider)
          debugLog('[Background] LLM Model from config:', config?.llmModel || 'not set')

          const apiKeyToUse = config?.aiApiKey || ''

          // SECURITY: Never log API keys, even partially
          debugLog('[Background] Config aiApiKey:', config?.aiApiKey ? 'present' : 'missing')
          debugLog('[Background] Using API key for AI:', apiKeyToUse ? 'present' : 'missing (OK for Claude subscription)')

          const currentProvider = config?.aiProvider || ''
          const currentModel = config?.providerModels?.[currentProvider] || config?.llmModel
          const customEndpoint = config?.providerEndpoints?.[currentProvider]

          const options: any = {
            aiProvider: config?.aiProvider,
            pageUrl,
            domStructure,
            llmModel: currentModel,
            customEndpoint
          }

          if (conversationSession) {
            options.conversationSession = conversationSession
            debugLog('[Background] Passing session to generateDOMChanges:', conversationSession.id)
          }
          debugLog('[Background] Passing pageUrl to generateDOMChanges:', pageUrl)

          if (!html && !conversationSession?.htmlSent) {
            throw new Error('HTML is required for the first message in a conversation')
          }

          const isTestPage = process.env.NODE_ENV !== 'production' &&
            typeof pageUrl === 'string' && (
              /visual-editor-test\.html/.test(pageUrl) ||
              pageUrl.includes('chrome-extension://')
            )
          if (isTestPage) {
            debugLog('[Background] Using mock AI response for visual-editor-test page')

            const normalizedPrompt = String(prompt || '').toLowerCase()
            const mockChanges: any[] = []
            let action: 'append' | 'replace_all' | 'replace_specific' | 'remove_specific' | 'none' = 'append'
            let targetSelectors: string[] | undefined
            let responseText = 'Mock AI response generated for test page.'

            const addButtonOrange = () => {
              mockChanges.push({
                selector: 'button',
                type: 'style',
                value: { 'background-color': 'orange' }
              })
            }

            const addButtonRed = () => {
              mockChanges.push({
                selector: 'button',
                type: 'style',
                value: { 'background-color': 'red' }
              })
            }

            const addHeadingBlueBold = () => {
              mockChanges.push({
                selector: 'h1, h2, h3',
                type: 'style',
                value: { color: 'blue', 'font-weight': 'bold' }
              })
            }

            const addHeadingGreenItalic = () => {
              mockChanges.push({
                selector: 'h1, h2, h3',
                type: 'style',
                value: { color: 'green', 'font-style': 'italic' }
              })
            }

            const addParagraphItalic = () => {
              mockChanges.push({
                selector: 'p',
                type: 'style',
                value: { 'font-style': 'italic' }
              })
            }

            if (normalizedPrompt.includes('test-paragraph')) {
              mockChanges.push({
                selector: '#test-paragraph',
                type: 'text',
                value: 'Modified text!'
              })
            } else if (normalizedPrompt.includes('button-1') && normalizedPrompt.includes('display')) {
              mockChanges.push({
                selector: '#button-1',
                type: 'style',
                value: { display: 'none' }
              })
            } else if (normalizedPrompt.includes('button-2') && normalizedPrompt.includes('remove')) {
              mockChanges.push({
                selector: '#button-2',
                type: 'remove'
              })
            } else if (normalizedPrompt.includes('item-2') && normalizedPrompt.includes('item-1')) {
              mockChanges.push({
                selector: '#item-2',
                type: 'move',
                targetSelector: '#item-1',
                position: 'before'
              })
            } else if (normalizedPrompt.includes('test-container') && normalizedPrompt.includes('html')) {
              mockChanges.push({
                selector: '#test-container',
                type: 'html',
                value: '<h2>HTML Edited!</h2><p>New paragraph content</p>'
              })
            } else if (normalizedPrompt.includes('updated by ai') && normalizedPrompt.includes('test-container')) {
              console.log('[Anthropic] Fetching HTML chunk for selector #test-container')
              mockChanges.push({
                selector: '#test-container h2',
                type: 'text',
                value: 'Updated by AI'
              })
              responseText = 'Updated the section title inside #test-container.'
            } else if (normalizedPrompt.includes('remove the button styling')) {
              action = 'remove_specific'
              targetSelectors = ['button']
            } else if (normalizedPrompt.includes('buttons to red') || normalizedPrompt.includes('red instead of orange')) {
              action = 'replace_specific'
              targetSelectors = ['button']
              addButtonRed()
            } else if (normalizedPrompt.includes('forget the buttons') && normalizedPrompt.includes('headings green') && normalizedPrompt.includes('italic')) {
              action = 'replace_all'
              addHeadingGreenItalic()
            } else if (normalizedPrompt.includes('buttons orange') && normalizedPrompt.includes('headings blue') && normalizedPrompt.includes('paragraphs italic')) {
              addButtonOrange()
              addHeadingBlueBold()
              addParagraphItalic()
            } else if (normalizedPrompt.includes('buttons orange') && normalizedPrompt.includes('headings blue')) {
              addButtonOrange()
              addHeadingBlueBold()
            } else if ((normalizedPrompt.includes('headings blue') || normalizedPrompt.includes('heading blue')) && normalizedPrompt.includes('bold')) {
              addHeadingBlueBold()
            } else if (normalizedPrompt.includes('button') && normalizedPrompt.includes('orange')) {
              addButtonOrange()
            } else if (normalizedPrompt.includes('what colors work well')) {
              action = 'none'
              responseText = 'Mock response: Consider high-contrast colors like orange or green for CTAs.'
            }

            const mockResult = {
              domChanges: mockChanges,
              response: responseText,
              action,
              targetSelectors
            }

            const mockSession = {
              id: `mock-session-${Date.now()}`,
              conversationId: `mock-conversation-${Date.now()}`,
              htmlSent: true,
              pageUrl,
              messages: [
                { role: 'user', content: String(prompt || '') },
                { role: 'assistant', content: responseText }
              ]
            }

            sendResponse({
              success: true,
              result: mockResult,
              session: mockSession
            })
            return
          }

          debugLog('[Background] Calling generateDOMChanges with aiProvider:', config?.aiProvider)
          debugLog('[Background] Passing HTML:', html ? `${html.length} chars` : 'undefined (using session)')
          const result = await generateDOMChanges(html || '', prompt, apiKeyToUse || '', currentChanges || [], images, options)

          debugLog('[Background] Generated result:', JSON.stringify(result, null, 2))
          debugLog('[Background] Result keys:', Object.keys(result))
          debugLog('[Background] Result.domChanges:', result.domChanges)
          debugLog('[Background] Result.action:', result.action)
          debugLog('[Background] Result.response:', result.response?.substring(0, 100))

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

          debugLog('[Background] Normalized result:', normalizedResult)

          if (result.session) {
            debugLog('[Background] Returning session:', result.session.id)
            sendResponse({ success: true, result: normalizedResult, session: result.session })
          } else {
            sendResponse({ success: true, result: normalizedResult })
          }
          debugLog('[Background] Response sent successfully')
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorStack = error instanceof Error ? error.stack : 'No stack trace'

          console.error('[Background] ❌ AI generation error:', errorMessage)
          console.error('[Background] Error stack:', errorStack)
          console.error('[Background] Full error object:', error)
          debugError('[Background] AI generation error:', error)

          sendResponse({
            success: false,
            error: errorMessage
          })
        }
      })()
      return true
    } else if (message.type === 'AI_INITIALIZE_SESSION') {
      debugLog('[Background] Handling AI_INITIALIZE_SESSION')

      ;(async () => {
        try {
          debugLog('[Background] AI_INITIALIZE_SESSION - Preparing session (no LLM call)...')
          const { conversationSession } = message

          const initializedSession = {
            ...conversationSession,
            htmlSent: false
          }

          debugLog('[Background] Session prepared:', initializedSession.id, 'htmlSent:', initializedSession.htmlSent)
          sendResponse({ success: true, session: initializedSession })
          debugLog('[Background] Initialization response sent successfully')
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
          debugLog('[Background] AI_REFRESH_HTML - Refreshing HTML context...')
          const config = await getConfig(storage, secureStorage)
          const { html, conversationSession } = message
          debugLog('[Background] New HTML length:', html?.length, 'Session:', conversationSession?.id)

          if (!conversationSession) {
            throw new Error('No conversation session provided')
          }

          if (!html) {
            throw new Error('No HTML provided for refresh')
          }

          if (config?.aiProvider === 'anthropic-api' || config?.aiProvider === 'openai-api') {
            debugLog('[Background] Resetting htmlSent flag for API provider')
            const updatedSession = {
              ...conversationSession,
              htmlSent: false
            }
            sendResponse({ success: true, session: updatedSession })
            return
          }

          if (config?.aiProvider === 'claude-subscription' || config?.aiProvider === 'codex') {
            debugLog('[Background] Refreshing HTML on Bridge server')
            const { ClaudeCodeBridgeClient } = await import('~src/lib/claude-code-client')
            const bridgeClient = new ClaudeCodeBridgeClient()

            try {
              await bridgeClient.connect()
              if (conversationSession.conversationId) {
                await bridgeClient.refreshHtml(conversationSession.conversationId, html)
                debugLog('[Background] HTML refreshed on Bridge')
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

          debugLog('[Background] Unknown provider, resetting htmlSent flag')
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
