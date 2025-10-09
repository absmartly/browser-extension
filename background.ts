import { Storage } from "@plasmohq/storage"
import axios from 'axios'
import type { ABsmartlyConfig, CustomCode } from '~src/types/absmartly'
import type { DOMChangesInlineState, ElementPickerResult } from '~src/types/storage-state'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { getJWTCookie } from '~src/utils/cookies'
import { checkAuthentication } from '~src/utils/auth'

// Storage instance
const storage = new Storage()

// Note: All message handling is done in the main listener below
// This separate listener was causing issues by closing the message channel

// Initialize config with environment variables on startup
async function initializeConfig() {
  debugLog('[Background] Initializing config...')
  
  // Get current config from storage
  const storedConfig = await storage.get("absmartly-config") as ABsmartlyConfig | null
  debugLog('[Background] Stored config:', storedConfig)
  
  // Check if we have environment variables
  const envApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
  const envApiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT
  const envApplicationId = process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_ID
  const envAuthMethod = process.env.PLASMO_PUBLIC_ABSMARTLY_AUTH_METHOD

  debugLog('[Background] Environment variables:', {
    hasApiKey: !!envApiKey,
    apiEndpoint: envApiEndpoint,
    applicationId: envApplicationId,
    authMethod: envAuthMethod
  })

  // Only update if we have env vars and stored values are empty
  let updated = false
  // Determine default auth method
  // Priority: 1. Stored config, 2. Environment variable, 3. Default to 'jwt'
  let defaultAuthMethod: 'jwt' | 'apikey' = 'jwt'

  // Check for environment variable override (for testing)
  if (envAuthMethod) {
    defaultAuthMethod = envAuthMethod as 'jwt' | 'apikey'
    debugLog('[Background] Using auth method from environment:', envAuthMethod)
  }

  const newConfig: ABsmartlyConfig = {
    apiKey: storedConfig?.apiKey || '',
    apiEndpoint: storedConfig?.apiEndpoint || '',
    applicationId: storedConfig?.applicationId,
    authMethod: storedConfig?.authMethod || defaultAuthMethod,
    domChangesStorageType: storedConfig?.domChangesStorageType,
    domChangesFieldName: storedConfig?.domChangesFieldName
  }
  
  if (!newConfig.apiKey && envApiKey) {
    newConfig.apiKey = envApiKey
    updated = true
    debugLog('[Background] Using API key from environment')
  }
  
  if (!newConfig.apiEndpoint && envApiEndpoint) {
    newConfig.apiEndpoint = envApiEndpoint
    updated = true
    debugLog('[Background] Using API endpoint from environment')
  }
  
  if (!newConfig.applicationId && envApplicationId) {
    newConfig.applicationId = parseInt(envApplicationId)
    updated = true
    debugLog('[Background] Using application ID from environment')
  }

  // Auth method is already handled in the config initialization above

  // Save updated config if we made changes
  if (updated) {
    await storage.set("absmartly-config", newConfig)
    debugLog('[Background] Updated config with environment variables:', newConfig)
  } else {
    debugLog('[Background] No updates needed from environment variables')
  }
}

// Initialize on startup
initializeConfig().catch(err => debugError('Init config error:', err))

// Helper function to get config
async function getConfig(): Promise<ABsmartlyConfig | null> {
  const config = await storage.get("absmartly-config") as ABsmartlyConfig | null
  return config
}

// Helper function to check if error is authentication related
function isAuthError(error: any): boolean {
  return error.response?.status === 401 || error.response?.status === 403
}

// Helper function to open login page
async function openLoginPage() {
  const config = await getConfig()
  if (!config?.apiEndpoint) {
    return
  }

  // Extract base URL from API endpoint - just remove /v1 suffix
  const baseUrl = config.apiEndpoint.replace(/\/v1$/, '').replace(/\/api.*$/, '')

  // Check if user is already authenticated first
  try {
    const authResponse = await makeAPIRequest('GET', '/auth/current-user', undefined, false)

    if (authResponse.ok) {
      // User is already authenticated, no need to redirect
      debugLog('User is already authenticated')
      return { authenticated: true }
    }
  } catch (error) {
    debugLog('Auth check failed, user needs to login:', error)
  }

  // User not authenticated, open login page (without /login suffix)
  chrome.tabs.create({ url: baseUrl })
  return { authenticated: false }
}

// Helper function to make API requests with automatic JWT fallback
async function makeAPIRequest(method: string, path: string, data?: any, retryWithJWT: boolean = true) {
  debugLog('=== makeAPIRequest called ===', { method, path, data })
  
  const config = await getConfig()
  debugLog('Config loaded:', { 
    hasApiKey: !!config?.apiKey, 
    apiEndpoint: config?.apiEndpoint,
    apiKeyLength: config?.apiKey?.length || 0,
    authMethod: config?.authMethod || 'jwt'
  })
  
  if (!config?.apiEndpoint) {
    throw new Error('No API endpoint configured')
  }

  // Use auth method from config, defaulting to JWT
  const authMethod = config.authMethod || 'jwt'
  const shouldTryJwtFirst = authMethod === 'jwt'
  
  // Helper to build headers
  const buildHeaders = async (useApiKey: boolean = true) => {
    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    // If auth method is JWT, use JWT only (no API key fallback)
    if (shouldTryJwtFirst) {
      debugLog('Using JWT authentication method...')
      const jwtToken = await getJWTCookie(config.apiEndpoint)
      debugLog('JWT cookie result:', jwtToken ? `Found (length: ${jwtToken.length}, preview: ${jwtToken.substring(0, 20)}...)` : 'Not found')

      if (jwtToken) {
        if (jwtToken.includes('.') && jwtToken.split('.').length === 3) {
          headers['Authorization'] = `JWT ${jwtToken}`
        } else {
          headers['Authorization'] = `Bearer ${jwtToken}`
        }
        debugLog('Using JWT from browser cookie, Authorization header:', headers['Authorization'].substring(0, 30) + '...')
      } else {
        debugLog('No JWT cookie available - user may need to log in to ABsmartly')
      }
      return headers
    } else {
      // Auth method is API key
      if (config.apiKey && useApiKey) {
        debugLog('Using API key authentication method')
        const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
          ? `JWT ${config.apiKey}`
          : `Api-Key ${config.apiKey}`
        headers['Authorization'] = authHeader
      } else if (!config.apiKey) {
        // No API key provided, try JWT as fallback
        debugLog('No API key provided, attempting JWT fallback...')
        const jwtToken = await getJWTCookie(config.apiEndpoint)
        if (jwtToken) {
          if (jwtToken.includes('.') && jwtToken.split('.').length === 3) {
            headers['Authorization'] = `JWT ${jwtToken}`
          } else {
            headers['Authorization'] = `Bearer ${jwtToken}`
          }
          debugLog('Using JWT from cookie as fallback')
        } else {
          debugLog('No authentication method available')
        }
      }
    }
    
    return headers
  }

  // Build initial headers
  const headers = await buildHeaders()

  // Clean up the API endpoint - remove trailing slashes
  const cleanEndpoint = config.apiEndpoint.replace(/\/+$/, '')
  
  const baseURL = cleanEndpoint.endsWith('/v1') 
    ? cleanEndpoint 
    : `${cleanEndpoint}/v1`

  // Clean up the path - ensure it starts with / but remove double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  let url = `${baseURL}${cleanPath}`
  let requestData = undefined

  // For GET/HEAD requests, convert data to query parameters
  if (method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD') {
    if (data && Object.keys(data).length > 0) {
      const params = new URLSearchParams()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
      url += '?' + params.toString()
    }
  } else {
    // For POST/PUT/DELETE, use data as request body
    requestData = data
  }

  debugLog('Making axios request:', { 
    method, 
    url, 
    requestData, 
    authorization: headers.Authorization || 'None'
  })

  try {
    const response = await axios({
      method,
      url,
      data: requestData,
      headers,
      withCredentials: false // Don't use cookies, we extract JWT manually
    })

    return response.data
  } catch (error) {
    debugError('Request failed:', error.response?.status, error.response?.data)
    
    // If we got a 401, try the opposite auth method as fallback
    if (isAuthError(error) && retryWithJWT) {
      // If we were using API key, try JWT
      if (authMethod === 'apikey' && headers.Authorization?.startsWith('Api-Key')) {
        debugLog('API key auth failed (401), retrying with JWT cookie...')
        
        // Try to get JWT from cookies
        const jwtToken = await getJWTCookie(config.apiEndpoint)
        
        if (jwtToken) {
          // Build new headers with JWT instead of API key
          const newHeaders: any = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
          
          if (jwtToken.includes('.') && jwtToken.split('.').length === 3) {
            newHeaders['Authorization'] = `JWT ${jwtToken}`
          } else {
            newHeaders['Authorization'] = `Bearer ${jwtToken}`
          }
          
          debugLog('Retrying with JWT authorization:', newHeaders.Authorization)
          
          // Make the request directly with new headers, don't recurse
          try {
            const response = await axios({
              method,
              url,
              data: requestData,
              headers: newHeaders,
              withCredentials: false
            })
            
            debugLog('JWT fallback successful!')
            return response.data
          } catch (jwtError) {
            debugError('JWT fallback also failed:', jwtError.response?.status)
            throw new Error('AUTH_EXPIRED')
          }
        } else {
          debugLog('No JWT cookie available for retry')
        }
      }
      // If we were using JWT, try API key as fallback
      else if (authMethod === 'jwt' && config.apiKey && !headers.Authorization?.startsWith('Api-Key')) {
        debugLog('JWT auth failed (401), retrying with API key...')
        
        const newHeaders: any = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
        
        const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
          ? `JWT ${config.apiKey}`
          : `Api-Key ${config.apiKey}`
        newHeaders['Authorization'] = authHeader
        
        debugLog('Retrying with API key authorization')
        
        try {
          const response = await axios({
            method,
            url,
            data: requestData,
            headers: newHeaders,
            withCredentials: false
          })
          
          debugLog('API key fallback successful!')
          return response.data
        } catch (apiKeyError) {
          debugError('API key fallback also failed:', apiKeyError.response?.status)
          throw new Error('AUTH_EXPIRED')
        }
      }
    }
    
    // Check if this is an authentication error
    if (isAuthError(error)) {
      throw new Error('AUTH_EXPIRED')
    }
    throw error
  }
}

// Listen for messages from sidebar and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[BACKGROUND] Message listener ENTERED! Type:', message?.type)
  debugLog('🔵 Background received message:', message.type, 'Full message:', message)
  
  // Test message
  if (message.type === 'PING') {
    debugLog('🏓 PONG! Message system is working')
    sendResponse({ pong: true })
    return false
  }
  
  if (message.type === "TOGGLE_VISUAL_EDITOR") {
    // Forward to content script in active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, message)
      }
    })
    return false // No response needed
  } else if (message.type === "ELEMENT_SELECTED") {
    // Element picker returned a selector
    debugLog('Background received ELEMENT_SELECTED:', message)

    // Store the result using Plasmo Storage for cross-browser compatibility
    const sessionStorage = new Storage({ area: "session" })

    // Get the current state to find out which field we were picking for
    sessionStorage.get<DOMChangesInlineState>('domChangesInlineState').then(async (state) => {
      if (state && state.pickingForField) {
        debugLog('Storing element picker result for field:', state.pickingForField)

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
    return false // No response needed
  } else if (message.type === "GET_CURRENT_TAB_URL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ url: tabs[0]?.url || "" })
    })
    return true // Will respond asynchronously
  } else if (message.type === "GET_DOM_CHANGES_FROM_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_DOM_CHANGES" }, (response) => {
          sendResponse(response)
        })
      }
    })
    return true // Will respond asynchronously
  } else if (message.type === "API_REQUEST") {
    // Handle API requests
    debugLog('Background received API_REQUEST:', { method: message.method, path: message.path, data: message.data })

    makeAPIRequest(message.method, message.path, message.data)
      .then(data => {
        debugLog('Background API request successful')
        sendResponse({ success: true, data })
      })
      .catch(error => {
        debugError('Background API request failed:', error)
        debugError('Error details:', {
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
    return true // Will respond asynchronously
  } else if (message.type === "OPEN_LOGIN") {
    // Open login page with auth check
    openLoginPage().then(result => {
      sendResponse({ success: true, ...result })
    }).catch(error => {
      sendResponse({ success: false, error: error.message })
    })
    return true // Will respond asynchronously
  } else if (message.type === "DISABLE_PREVIEW") {
    // Forward disable preview message to active tab to remove preview
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'ABSMARTLY_PREVIEW',
          action: 'remove',
          experimentName: message.experimentName
        }, () => {
          // Ignore connection errors - tab might have navigated
          if (chrome.runtime.lastError) {
            console.log('Preview remove message failed (tab may have navigated):', chrome.runtime.lastError)
          }
        })
      }
    })

    // Also notify any open extension sidebars to update their preview toggle state
    chrome.runtime.sendMessage({
      type: 'PREVIEW_STATE_CHANGED',
      enabled: false
    }).catch(() => {
      // Ignore errors if no sidebar is open
    })

    sendResponse({ success: true })
  } else if (message.type === "CHECK_AUTH") {
    // Handle auth check with proper async handling
    const requestId = message.requestId

    // Helper to send debug messages that will appear in page console
    const sendDebug = (msg: string) => {
      chrome.runtime.sendMessage({
        type: 'DEBUG',
        message: `[BG CHECK_AUTH ${requestId}] ${msg}`
      }).catch(() => {})
    }

    sendDebug(`Received request, sender: ${JSON.stringify({
      id: sender.id,
      tabId: sender.tab?.id,
      url: sender.url,
      frameId: sender.frameId
    })}`)

    // Parse config from message
    let config: ABsmartlyConfig | null = null
    if (message.configJson) {
      try {
        config = JSON.parse(message.configJson) as ABsmartlyConfig
        sendDebug(`Config parsed from JSON: authMethod=${config.authMethod}, hasApiKey=${!!config.apiKey}, apiKeyLength=${config.apiKey?.length}`)
      } catch (error) {
        sendDebug('Failed to parse config JSON')
        sendResponse({ success: false, error: 'Invalid config' })
        return false
      }
    } else {
      sendDebug('Will load config from storage')
    }

    // Start async operation - use Promise.resolve().then() instead of setTimeout
    // setTimeout can hang in service workers that are terminating
    sendDebug('Starting async auth check...')
    Promise.resolve().then(async () => {
      try {
        sendDebug('Inside async handler')

        if (!config) {
          sendDebug('Loading config from storage...')
          config = await getConfig()
          sendDebug(`Config loaded: ${!!config}`)
        }

        sendDebug(`Calling checkAuthentication with config: endpoint=${config.apiEndpoint}, authMethod=${config.authMethod}`)
        console.log('[BACKGROUND] About to call checkAuthentication, config:', config)
        const result = await checkAuthentication(config)
        console.log('[BACKGROUND] checkAuthentication call completed, result:', result)
        sendDebug(`checkAuthentication returned! success=${result.success}, hasUser=${!!result.data?.user}`)

        // Always broadcast via runtime.sendMessage since sidebar is an extension page
        const resultMessage = {
          type: 'CHECK_AUTH_RESULT',
          requestId: requestId,
          result: result
        }

        sendDebug('Broadcasting result via runtime.sendMessage...')
        chrome.runtime.sendMessage(resultMessage)
          .then(() => sendDebug('Result broadcast successful'))
          .catch(err => sendDebug(`Failed to broadcast result: ${err}`))
      } catch (error) {
        sendDebug(`Error in async handler: ${error}`)
        const errorMessage = {
          type: 'CHECK_AUTH_RESULT',
          requestId: requestId,
          result: { success: false, error: error.message || 'Auth check failed' }
        }

        sendDebug('Broadcasting error via runtime.sendMessage...')
        chrome.runtime.sendMessage(errorMessage)
          .then(() => sendDebug('Error broadcast successful'))
          .catch(err => sendDebug(`Failed to broadcast error: ${err}`))
      }
    }).catch(err => {
      sendDebug(`Unhandled error in async handler: ${err}`)
    })

    // Send immediate acknowledgment
    sendDebug('Sending immediate acknowledgment')
    sendResponse({ success: true, pending: true, requestId: requestId })
    return false // Synchronous initial response
  // START_VISUAL_EDITOR relay removed - sidebar now sends directly to content script
  } else if (message.type === "VISUAL_EDITOR_CHANGE") {
    debugLog('[Background] Visual editor change received:', message.change)
    
    // Store the change
    chrome.storage.local.get(['visualEditorChanges'], (result) => {
      const changes = result.visualEditorChanges || []
      changes.push(message.change)
      
      chrome.storage.local.set({ 
        visualEditorChanges: changes 
      }, () => {
        debugLog('[Background] Visual editor change saved')
        sendResponse({ success: true })
      })
    })
    
    return true // Will respond asynchronously
  } else if (message.type === "CLEAR_STORED_DOM_CHANGES") {
    // Clear stored DOM changes when switching experiments to prevent leakage
    debugLog('[Background] Clearing stored DOM changes for experiment switch')
    
    // Get all storage keys to find and remove experiment-specific keys
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = ['lastVisualEditorChanges', 'lastVisualEditorVariant', 'visualEditorChanges']
      
      // Also remove any experiment-specific visual editor keys
      Object.keys(items).forEach(key => {
        if (key.startsWith('visualEditor_')) {
          keysToRemove.push(key)
        }
      })
      
      chrome.storage.local.remove(keysToRemove, () => {
        debugLog('[Background] Cleared stored DOM changes, removed keys:', keysToRemove)
        sendResponse({ success: true, removedKeys: keysToRemove })
      })
    })
    
    return true // Will respond asynchronously
  } else if (message.type === "VISUAL_EDITOR_COMPLETE") {
    debugLog('[Background] Visual editor complete with changes:', message)
    
    // Forward all changes to the sidebar
    chrome.runtime.sendMessage({
      type: 'VISUAL_EDITOR_CHANGES_COMPLETE',
      variantName: message.variantName,
      changes: message.changes,
      totalChanges: message.totalChanges
    })
    
    // Also send directly to the current tab's content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'VISUAL_EDITOR_CHANGES_COMPLETE',
          variantName: message.variantName,
          changes: message.changes,
          totalChanges: message.totalChanges
        })
      }
    })
    
    // Also store in local storage for persistence
    // Include the experiment ID if available to scope the changes
    const storageKey = message.experimentId 
      ? `visualEditor_${message.experimentId}` 
      : 'lastVisualEditorChanges'
    
    const storageData: any = {}
    storageData[storageKey] = message.changes
    
    // Always store the last variant name globally for reference
    storageData['lastVisualEditorVariant'] = message.variantName
    
    chrome.storage.local.set(storageData, () => {
      debugLog('[Background] Visual editor complete changes saved with key:', storageKey)
      sendResponse({ success: true, changesSaved: message.totalChanges })
    })
    
    return true // Will respond asynchronously
  } else if (message.type === "REQUEST_INJECTION_CODE") {
    // Handle request from SDK plugin for custom code injection and config
    debugLog('Background received REQUEST_INJECTION_CODE from SDK plugin')

    // Get both custom code and config
    Promise.all([
      storage.get("absmartly-custom-code") as Promise<CustomCode | null>,
      getConfig()
    ]).then(([customCode, config]) => {
      // Prepare injection data for SDK plugin
      const injectionData = {
        headStart: customCode?.headStart || '',
        headEnd: customCode?.headEnd || '',
        bodyStart: customCode?.bodyStart || '',
        bodyEnd: customCode?.bodyEnd || '',
        styleTag: customCode?.styleTag || ''
      }

      // Derive SDK endpoint if not set
      let sdkEndpoint = config?.sdkEndpoint
      if (!sdkEndpoint && config?.apiEndpoint) {
        // Default: convert .com to .io for SDK endpoint
        sdkEndpoint = config.apiEndpoint.replace('.com', '.io')
      }

      // Prepare config data for plugins
      const configData = {
        apiEndpoint: config?.apiEndpoint,
        sdkEndpoint: sdkEndpoint,
        queryPrefix: config?.queryPrefix || '_exp_',
        persistQueryToCookie: config?.persistQueryToCookie ?? true,
        injectSDK: config?.injectSDK ?? false,
        sdkUrl: config?.sdkUrl || ''
      }

      debugLog('Sending custom code and config to SDK plugin:', { injectionData, configData })
      sendResponse({
        success: true,
        data: injectionData,
        config: configData
      })
    }).catch(error => {
      debugError('Error retrieving custom code or config:', error)
      sendResponse({
        success: false,
        error: error.message
      })
    })

    return true // Will respond asynchronously
  } else if (message.type === "CODE_EDITOR_SAVE" || message.type === "CODE_EDITOR_CLOSE") {
    // Forward these messages from content script to sidebar
    debugLog('Background forwarding message to sidebar:', message.type)

    // Send to all extension views (including sidebar)
    chrome.runtime.sendMessage(message)
    sendResponse({ success: true })

    return false
  }
})

// Register content script for file:// URLs dynamically
// This is needed because content scripts in manifest don't auto-inject on file:// URLs
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const manifest = chrome.runtime.getManifest()
    const contentScripts = manifest.content_scripts
    if (contentScripts && contentScripts.length > 0) {
      const contentScriptFile = contentScripts[0].js[0]

      // Register a dynamic content script for file:// URLs
      await chrome.scripting.registerContentScripts([{
        id: 'file-url-content-script',
        matches: ['file://*/*'],
        js: [contentScriptFile],
        runAt: 'document_idle',
        allFrames: false
      }])

      console.log('[Background] Registered dynamic content script for file:// URLs')
    }
  } catch (error) {
    // Script might already be registered, unregister and try again
    try {
      await chrome.scripting.unregisterContentScripts({ ids: ['file-url-content-script'] })
      const manifest = chrome.runtime.getManifest()
      const contentScripts = manifest.content_scripts
      if (contentScripts && contentScripts.length > 0) {
        const contentScriptFile = contentScripts[0].js[0]
        await chrome.scripting.registerContentScripts([{
          id: 'file-url-content-script',
          matches: ['file://*/*'],
          js: [contentScriptFile],
          runAt: 'document_idle',
          allFrames: false
        }])
        console.log('[Background] Re-registered dynamic content script for file:// URLs')
      }
    } catch (retryError) {
      console.error('[Background] Failed to register dynamic content script:', retryError)
    }
  }
})

// Listen for tab updates (keeping for other purposes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Dynamic content script should now auto-inject on file:// URLs
    // No manual injection needed
  }
})

// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  debugLog('[Background] Extension icon clicked for tab:', tab.id)
  
  if (tab.id && tab.url) {
    // Don't inject on chrome:// or other restricted URLs
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('edge://') || 
        tab.url.startsWith('about:') ||
        tab.url.startsWith('chrome-extension://')) {
      debugLog('[Background] Cannot inject sidebar on restricted URL:', tab.url)
      return
    }
    
    try {
      // Always execute the script - it will handle toggling if already exists
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            // Check if sidebar is already injected
            const existingSidebar = document.getElementById('absmartly-sidebar-root') as HTMLElement
            if (existingSidebar) {
              console.log('🔵 ABSmartly Extension: Sidebar already exists, toggling visibility')
              // Get current transform to determine actual visibility
              const currentTransform = existingSidebar.style.transform
              console.log('Current transform:', currentTransform)
              
              // Check if sidebar is currently visible (showing)
              const isCurrentlyVisible = !currentTransform 
                || currentTransform === 'translateX(0px)'
                || currentTransform === 'translateX(0%)'
                || currentTransform === 'translateX(0)'
              
              // Toggle based on actual current state
              if (isCurrentlyVisible) {
                console.log('Hiding sidebar')
                // Hide sidebar
                existingSidebar.style.transform = 'translateX(100%)'
                
                // Restore original body padding with smooth animation
                const originalPadding = document.body.getAttribute('data-absmartly-original-padding-right')
                if (originalPadding !== null) {
                  // Ensure transition is set so the close animates smoothly
                  document.body.style.transition = 'padding-right 0.3s ease-in-out'
                  document.body.style.paddingRight = originalPadding
                  document.body.removeAttribute('data-absmartly-original-padding-right')
                  // Optionally clear transition after animation completes
                  setTimeout(() => {
                    document.body.style.transition = ''
                  }, 350)
                }
              } else {
                console.log('Showing sidebar')
                // Show sidebar
                existingSidebar.style.transform = 'translateX(0)'
                
                // Store and modify body padding (guard to avoid double-apply)
                if (!document.body.hasAttribute('data-absmartly-original-padding-right')) {
                  const currentPadding = document.body.style.paddingRight || '0px'
                  document.body.setAttribute('data-absmartly-original-padding-right', currentPadding)
                  document.body.style.transition = 'padding-right 0.3s ease-in-out'
                  document.body.style.paddingRight = '384px'
                }
              }
              return
            }

            console.log('🔵 ABSmartly Extension: Injecting sidebar')

            // Store original body padding before modifying
            const originalPadding = document.body.style.paddingRight || '0px'
            document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)
            
            // Add transition to body for smooth animation
            const originalTransition = document.body.style.transition
            document.body.style.transition = 'padding-right 0.3s ease-in-out'
            
            // Set body padding to push content left without affecting fixed right-anchored elements
            document.body.style.paddingRight = '384px'

            // Create the sidebar container
            const container = document.createElement('div')
            container.id = 'absmartly-sidebar-root'
            container.style.cssText = `
              position: fixed;
              top: 0;
              right: 0;
              width: 384px;
              height: 100vh;
              background-color: white;
              border-left: 1px solid #e5e7eb;
              box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
              z-index: 2147483647;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
              font-size: 14px;
              line-height: 1.5;
              color: #111827;
              transform: translateX(0);
              transition: transform 0.3s ease-in-out;
            `
            
            // Create the iframe for isolation
            const iframe = document.createElement('iframe')
            iframe.id = 'absmartly-sidebar-iframe'
            iframe.style.cssText = `
              width: 100%;
              height: 100%;
              border: none;
            `
            // Use the tabs page as the iframe source
            iframe.src = chrome.runtime.getURL('tabs/sidebar.html')
            
            container.appendChild(iframe)
            document.body.appendChild(container)
            
            console.log('🔵 ABSmartly Extension: Sidebar injected successfully')
          }
        })
    } catch (error) {
      debugError('[Background] Failed to inject sidebar:', error)
    }
  }
})

