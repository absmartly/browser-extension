import { Storage } from "@plasmohq/storage"
import axios from 'axios'
import { z } from 'zod'
import type { ABsmartlyConfig, CustomCode } from '~src/types/absmartly'
import type { DOMChangesInlineState, ElementPickerResult } from '~src/types/storage-state'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { checkAuthentication, buildAuthFetchOptions } from '~src/utils/auth'

// SECURITY: Zod schemas for input validation
const ConfigSchema = z.object({
  apiKey: z.string().optional(),
  apiEndpoint: z.string().url(),
  applicationId: z.number().int().positive().optional(),
  authMethod: z.enum(['jwt', 'apikey']).optional(),
  domChangesFieldName: z.string().optional(),
  sdkEndpoint: z.string().url().optional(),
  queryPrefix: z.string().optional(),
  persistQueryToCookie: z.boolean().optional(),
  injectSDK: z.boolean().optional(),
  sdkUrl: z.string().url().optional()
})

const APIRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']),
  path: z.string().min(1),
  data: z.any().optional()
})

// Storage instances
const storage = new Storage()
// SECURITY: Use encrypted storage for sensitive data (API keys)
const secureStorage = new Storage({
  area: "local",
  secretKeyring: true
})

// Event buffering constants
const EVENT_BUFFER_KEY = 'sdk_events_buffer'
const MAX_BUFFER_SIZE = 1000

// Handle storage operations from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STORAGE_GET') {
    const sessionStorage = new Storage({ area: "session" })
    sessionStorage.get(message.key).then(value => {
      debugLog('[Background] Storage GET:', message.key, '=', value)
      sendResponse({ success: true, value })
    }).catch(error => {
      debugError('[Background] Storage GET error:', error)
      sendResponse({ success: false, error: error.message })
    })
    return true
  } else if (message.type === 'STORAGE_SET') {
    const sessionStorage = new Storage({ area: "session" })
    sessionStorage.set(message.key, message.value).then(() => {
      debugLog('[Background] Storage SET:', message.key, '=', message.value)
      sendResponse({ success: true })
    }).catch(error => {
      debugError('[Background] Storage SET error:', error)
      sendResponse({ success: false, error: error.message })
    })
    return true
  } else if (message.type === 'SDK_EVENT') {
    // Buffer SDK events
    const sessionStorage = new Storage({ area: "session" })

    sessionStorage.get(EVENT_BUFFER_KEY).then(buffer => {
      const events = buffer || []

      // Add new event to beginning of array
      events.unshift({
        id: `${Date.now()}-${Math.random()}`,
        eventName: message.payload.eventName,
        data: message.payload.data,
        timestamp: message.payload.timestamp
      })

      // Keep only last MAX_BUFFER_SIZE events
      const trimmedEvents = events.slice(0, MAX_BUFFER_SIZE)

      return sessionStorage.set(EVENT_BUFFER_KEY, trimmedEvents)
    }).then(() => {
      debugLog('[Background] SDK event buffered:', message.payload.eventName)
      sendResponse({ success: true })
    }).catch(error => {
      debugError('[Background] Failed to buffer event:', error)
      sendResponse({ success: false, error: error.message })
    })

    return true
  } else if (message.type === 'GET_BUFFERED_EVENTS') {
    const sessionStorage = new Storage({ area: "session" })

    sessionStorage.get(EVENT_BUFFER_KEY).then(events => {
      debugLog('[Background] Retrieved buffered events:', events?.length || 0)
      sendResponse({ success: true, events: events || [] })
    }).catch(error => {
      debugError('[Background] Failed to get buffered events:', error)
      sendResponse({ success: false, error: error.message })
    })

    return true
  } else if (message.type === 'CLEAR_BUFFERED_EVENTS') {
    const sessionStorage = new Storage({ area: "session" })

    sessionStorage.remove(EVENT_BUFFER_KEY).then(() => {
      debugLog('[Background] Cleared buffered events')
      sendResponse({ success: true })
    }).catch(error => {
      debugError('[Background] Failed to clear buffered events:', error)
      sendResponse({ success: false, error: error.message })
    })

    return true
  }
})

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

  // SECURITY: Get API key from secure storage
  const secureApiKey = await secureStorage.get("absmartly-apikey") as string | null

  const newConfig: ABsmartlyConfig = {
    apiKey: storedConfig?.apiKey || secureApiKey || '',
    apiEndpoint: storedConfig?.apiEndpoint || '',
    applicationId: storedConfig?.applicationId,
    authMethod: storedConfig?.authMethod || defaultAuthMethod,
    domChangesFieldName: storedConfig?.domChangesFieldName
  }

  if (!newConfig.apiKey && envApiKey) {
    newConfig.apiKey = envApiKey
    // Store in secure storage instead of regular storage
    await secureStorage.set("absmartly-apikey", envApiKey)
    updated = true
    debugLog('[Background] Using API key from environment and storing securely')
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
  // SECURITY: Don't save API key in regular storage, it's in secure storage
  if (updated) {
    const configToStore = { ...newConfig, apiKey: '' }
    await storage.set("absmartly-config", configToStore)
    debugLog('[Background] Updated config with environment variables (API key stored securely)')
  } else {
    debugLog('[Background] No updates needed from environment variables')
  }
}

// Initialize on startup
initializeConfig().catch(err => debugError('Init config error:', err))

// Helper function to get config
async function getConfig(): Promise<ABsmartlyConfig | null> {
  const config = await storage.get("absmartly-config") as ABsmartlyConfig | null
  // SECURITY: Get API key from secure storage
  if (config) {
    const secureApiKey = await secureStorage.get("absmartly-apikey") as string | null
    config.apiKey = secureApiKey || config.apiKey || ''
  }
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

// Helper function to get JWT cookie for a domain
async function getJWTCookie(domain: string): Promise<string | null> {
  try {
    debugLog('=== getJWTCookie START ===')
    debugLog('Input domain:', domain)
    
    // Parse the URL to get the base domain
    let parsedUrl: URL
    try {
      parsedUrl = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
    } catch (e) {
      debugError('Failed to parse URL:', domain, e)
      return null
    }
    
    const hostname = parsedUrl.hostname
    const protocol = parsedUrl.protocol
    const baseUrl = `${protocol}//${hostname}`
    
    debugLog('Parsed URL:', { hostname, protocol, baseUrl })
    
    // Try multiple strategies to find the JWT cookie
    
    // Strategy 1: Get cookies for the exact URL
    debugLog('Strategy 1: Fetching cookies for exact URL:', baseUrl)
    const urlCookies = await chrome.cookies.getAll({ url: baseUrl })
    debugLog(`Found ${urlCookies.length} cookies for URL ${baseUrl}`)
    
    if (urlCookies.length > 0) {
      debugLog('URL cookies:', urlCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }
    
    // Strategy 2: Get cookies for the domain (without subdomain)
    const domainParts = hostname.split('.')
    const baseDomain = domainParts.length > 2 
      ? domainParts.slice(-2).join('.') 
      : hostname
    
    debugLog('Strategy 2: Fetching cookies for base domain:', baseDomain)
    const domainCookies = await chrome.cookies.getAll({ domain: baseDomain })
    debugLog(`Found ${domainCookies.length} cookies for domain ${baseDomain}`)
    
    if (domainCookies.length > 0) {
      debugLog('Domain cookies:', domainCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }
    
    // Strategy 3: Get cookies with dot prefix (for subdomain access)
    debugLog('Strategy 3: Fetching cookies for .domain:', `.${baseDomain}`)
    const dotDomainCookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })
    debugLog(`Found ${dotDomainCookies.length} cookies for .${baseDomain}`)
    
    if (dotDomainCookies.length > 0) {
      debugLog('.Domain cookies:', dotDomainCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }
    
    // Combine all cookies and look for JWT
    const allCookies = [...urlCookies, ...domainCookies, ...dotDomainCookies]
    const uniqueCookies = Array.from(new Map(allCookies.map(c => [`${c.name}-${c.value}`, c])).values())
    
    debugLog(`Total unique cookies found: ${uniqueCookies.length}`)

    // Look for JWT cookie - check common ABsmartly cookie names
    // Try exact matches first
    let jwtCookie = uniqueCookies.find(cookie =>
      cookie.name === 'jwt' || // ABsmartly typically uses lowercase 'jwt'
      cookie.name === 'JWT' ||
      cookie.name === 'access_token' ||
      cookie.name === 'auth_token' ||
      cookie.name === 'authorization'
    )

    // If not found, look for cookies that might contain JWT token (3 parts separated by dots)
    if (!jwtCookie) {
      jwtCookie = uniqueCookies.find(cookie => {
        const value = cookie.value
        return value && value.includes('.') && value.split('.').length === 3
      })
    }
    
    if (jwtCookie) {
      debugLog(`✅ JWT cookie found: ${jwtCookie.name} (length: ${jwtCookie.value.length}, domain: ${jwtCookie.domain})`)
      debugLog('=== getJWTCookie END (SUCCESS) ===')
      return jwtCookie.value
    }
    
    debugLog('❌ No JWT cookie found')
    debugLog('=== getJWTCookie END (NOT FOUND) ===')
    return null
  } catch (error) {
    debugError('Error getting JWT cookie:', error)
    return null
  }
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
  // Validate sender - only accept messages from our own extension
  if (!sender.id || sender.id !== chrome.runtime.id) {
    debugWarn('[Background] Rejected message from unauthorized sender:', sender)
    return false
  }
  
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

    // SECURITY: Validate API request parameters
    try {
      APIRequestSchema.parse({
        method: message.method,
        path: message.path,
        data: message.data
      })
    } catch (validationError) {
      debugError('[Background] API request validation failed:', validationError)
      sendResponse({
        success: false,
        error: 'Invalid API request parameters',
        validationError: validationError instanceof z.ZodError ? validationError.errors : String(validationError)
      })
      return false
    }

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
    // Use checkAuthentication from auth.ts for consistent auth logic
    console.log('[Background CHECK_AUTH] >>>>>> START - Received with requestId:', message.requestId)
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
    const configPromise = configToUse ? Promise.resolve(configToUse) : getConfig()

    configPromise.then(async config => {
      console.log('[Background CHECK_AUTH] Got config, about to check auth')
      if (!config) {
        console.log('[Background CHECK_AUTH] No config, sending error')
        // Send result as new message with requestId
        chrome.runtime.sendMessage({
          type: 'CHECK_AUTH_RESULT',
          requestId: message.requestId,
          result: { success: false, error: 'No configuration available' }
        })
        return
      }

      console.log('[Background CHECK_AUTH] Calling checkAuthentication with config')
      debugLog('[Background CHECK_AUTH] Calling checkAuthentication with config')
      const result = await checkAuthentication(config)
      console.log('[Background CHECK_AUTH] checkAuthentication returned:', { success: result.success, hasData: !!result.data })
      debugLog('[Background CHECK_AUTH] checkAuthentication returned:', { success: result.success, hasData: !!result.data })

      // Send result as new message with requestId so SettingsView listener can pick it up
      console.log('[Background CHECK_AUTH] Sending CHECK_AUTH_RESULT')
      chrome.runtime.sendMessage({
        type: 'CHECK_AUTH_RESULT',
        requestId: message.requestId,
        result: result
      })
      console.log('[Background CHECK_AUTH] <<<<<< END - Sent result for requestId:', message.requestId)
    }).catch(error => {
      console.error('[Background CHECK_AUTH] Error in promise chain:', error)
      debugError('[Background CHECK_AUTH] Error:', error)
      // Send error result as new message with requestId
      chrome.runtime.sendMessage({
        type: 'CHECK_AUTH_RESULT',
        requestId: message.requestId,
        result: { success: false, error: error.message || 'Auth check failed' }
      })
    })

    // Don't use sendResponse, we're using chrome.runtime.sendMessage instead
    return false
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
  } else if (message.type === "FETCH_AVATAR") {
    // Fetch avatar image with authentication
    getConfig().then(config => {
      if (!config?.apiEndpoint) {
        sendResponse({ success: false, error: 'No endpoint configured' })
        return
      }
      
      const headers: any = {
        'Accept': 'image/*'
      }
      
      // Add authorization if API key exists
      if (config.apiKey) {
        const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
          ? `JWT ${config.apiKey}`
          : `Api-Key ${config.apiKey}`
        headers['Authorization'] = authHeader
      }
      
      axios.get(message.url, {
        headers,
        withCredentials: !config.apiKey, // Use cookies if no API key
        responseType: 'arraybuffer'
      })
      .then(response => {
        // Convert image to base64 data URL
        const contentType = response.headers['content-type'] || 'image/png'
        const base64 = Buffer.from(response.data).toString('base64')
        const dataUrl = `data:${contentType};base64,${base64}`
        sendResponse({ success: true, dataUrl })
      })
      .catch(error => {
        debugError('Avatar fetch error:', error)
        sendResponse({ success: false, error: error.message })
      })
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

// Service Worker fetch interceptor for avatar proxy
// Intercepts requests to chrome-extension://[id]/api/avatar?url=... and fetches with authentication
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)

  // Log all fetch requests to debug
  console.log('[Avatar Proxy] Fetch event:', url.href)

  // Only intercept requests to our avatar proxy endpoint
  if (url.pathname === '/api/avatar' && url.searchParams.has('url')) {
    console.log('[Avatar Proxy] Intercepting avatar request:', url.href)
    event.respondWith(
      (async () => {
        try {
          const avatarUrl = url.searchParams.get('url')!
          const authMethod = url.searchParams.get('authMethod') || 'jwt'
          const apiKey = url.searchParams.get('apiKey')

          // SECURITY: Block SSRF attacks - prevent access to internal networks
          const avatarHostUrl = new URL(avatarUrl)
          const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.']

          if (blockedHosts.some(h => avatarHostUrl.hostname.includes(h) || avatarHostUrl.hostname === h.replace('.', ''))) {
            console.error('[Avatar Proxy] SSRF attempt blocked:', avatarUrl)
            return new Response('Access to internal network addresses is blocked', { status: 403 })
          }

          // Check cache first using the actual avatar URL (https://)
          // Cache API doesn't support chrome-extension:// scheme, so we use the actual URL
          const cache = await caches.open('absmartly-avatars-v1')
          const cacheRequest = new Request(avatarUrl, { method: 'GET' })
          const cached = await cache.match(cacheRequest)

          if (cached) {
            console.log('[Avatar Proxy] Returning cached avatar:', avatarUrl)
            return cached
          }

          console.log('[Avatar Proxy] Fetching avatar with auth:', avatarUrl, 'authMethod:', authMethod)

          // Get config for endpoint (needed for JWT cookie lookup)
          const config = await getConfig()
          if (!config?.apiEndpoint) {
            return new Response('No endpoint configured', { status: 500 })
          }

          // Create a temporary config with auth params from URL
          const avatarConfig: ABsmartlyConfig = {
            ...config,
            authMethod: authMethod as 'jwt' | 'apikey',
            apiKey: apiKey || config.apiKey
          }

          // Build authentication using utility function
          let jwtToken: string | null = null
          if (authMethod === 'jwt') {
            jwtToken = await getJWTCookie(config.apiEndpoint)
            if (!jwtToken) {
              console.log('[Avatar Proxy] No JWT token available, will try credentials')
            }
          }

          // For service worker context, prefer Authorization header when token is available
          // Service workers can't reliably send cookies, so we use the header when possible
          const useAuthHeader = authMethod === 'jwt' && !!jwtToken
          const fetchOptions = buildAuthFetchOptions(authMethod, avatarConfig, jwtToken, useAuthHeader)

          // Add Accept header for images
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Accept': 'image/*'
          }

          // Fetch the image with authentication
          const response = await fetch(avatarUrl, fetchOptions)

          if (!response.ok) {
            console.error('[Avatar Proxy] Fetch failed:', response.status)
            return new Response('Avatar fetch failed', { status: response.status })
          }

          // Create response with caching headers
          const blob = await response.blob()
          const cachedResponse = new Response(blob, {
            status: 200,
            headers: {
              'Content-Type': response.headers.get('content-type') || 'image/png',
              'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
              'Access-Control-Allow-Origin': '*'
            }
          })

          // Store in cache using the actual avatar URL (Cache API doesn't support chrome-extension:// scheme)
          await cache.put(cacheRequest, cachedResponse.clone())
          console.log('[Avatar Proxy] Cached avatar:', avatarUrl)

          return cachedResponse
        } catch (error) {
          // Use console.error for service worker context to ensure logging works
          console.error('[Avatar Proxy] Error:', error)
          console.error('[Avatar Proxy] Error stack:', error instanceof Error ? error.stack : 'No stack')
          console.error('[Avatar Proxy] Error message:', error instanceof Error ? error.message : String(error))
          return new Response(`Avatar proxy error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 })
        }
      })()
    )
  }
})

