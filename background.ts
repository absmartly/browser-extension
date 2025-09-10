import { Storage } from "@plasmohq/storage"
import axios from 'axios'
import type { ABsmartlyConfig, CustomCode } from '~src/types/absmartly'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

// Storage instance
const storage = new Storage()

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
    return true // Keep the message channel open for async response
  } else if (message.type === 'STORAGE_SET') {
    const sessionStorage = new Storage({ area: "session" })
    sessionStorage.set(message.key, message.value).then(() => {
      debugLog('[Background] Storage SET:', message.key, '=', message.value)
      sendResponse({ success: true })
    }).catch(error => {
      debugError('[Background] Storage SET error:', error)
      sendResponse({ success: false, error: error.message })
    })
    return true // Keep the message channel open for async response
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
  
  debugLog('[Background] Environment variables:', {
    hasApiKey: !!envApiKey,
    apiEndpoint: envApiEndpoint,
    applicationId: envApplicationId
  })
  
  // Only update if we have env vars and stored values are empty
  let updated = false
  const newConfig: ABsmartlyConfig = {
    apiKey: storedConfig?.apiKey || '',
    apiEndpoint: storedConfig?.apiEndpoint || '',
    applicationId: storedConfig?.applicationId,
    authMethod: storedConfig?.authMethod || 'jwt', // Default to JWT
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
  const config = await storage.get("absmartly-config")
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
  
  // Extract base URL from API endpoint
  const baseUrl = config.apiEndpoint.replace(/\/v1$/, '').replace(/\/api.*$/, '')
  const loginUrl = `${baseUrl}/login`
  
  // Open login page in new tab
  chrome.tabs.create({ url: loginUrl })
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
    const jwtCookie = uniqueCookies.find(cookie => 
      cookie.name === 'jwt' || // ABsmartly typically uses lowercase 'jwt'
      cookie.name === 'JWT' ||
      cookie.name.toLowerCase() === 'jwt'
    )
    
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

    // If auth method is JWT, try JWT first
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
        return headers
      }
      // If JWT not available but we have API key as fallback
      if (config.apiKey && useApiKey) {
        debugLog('JWT not available, falling back to API key')
        const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
          ? `JWT ${config.apiKey}`
          : `Api-Key ${config.apiKey}`
        headers['Authorization'] = authHeader
        debugLog('Using API key fallback, Authorization header:', headers['Authorization'].substring(0, 30) + '...')
      } else {
        debugLog('No JWT cookie available and no API key fallback')
      }
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

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    
    if (message.reopenPopup) {
      // Store the result using Plasmo Storage for cross-browser compatibility
      const sessionStorage = new Storage({ area: "session" })
      
      // Get the current state to find out which field we were picking for
      sessionStorage.get('domChangesInlineState').then(async (state) => {
        if (state && state.pickingForField) {
          debugLog('Storing element picker result for field:', state.pickingForField)
          
          // Store the result
          await sessionStorage.set('elementPickerResult', {
            variantName: state.variantName,
            fieldId: state.pickingForField,
            selector: message.selector
          })
          
          // Reopen the popup
          chrome.action.openPopup()
        }
      })
    }
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
    // Open login page
    openLoginPage()
    sendResponse({ success: true })
  } else if (message.type === "DISABLE_PREVIEW") {
    // Forward disable preview message to all tabs to remove preview
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'remove'
          })
        }
      })
    })
    sendResponse({ success: true })
  } else if (message.type === "CHECK_AUTH") {
    // Special handler for auth check - directly check user authentication
    getConfig().then(async config => {
      if (!config?.apiEndpoint) {
        sendResponse({ success: false, error: 'No endpoint configured' })
        return
      }
      
      const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
      
      try {
        // Try to get user info directly from /auth/current-user
        const fullAuthUrl = `${baseUrl}/auth/current-user`
        debugLog('CHECK_AUTH: Fetching user from', fullAuthUrl)
        
        // Build auth headers
        const authHeaders: any = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
        
        // Use auth method from config
        const authMethod = config.authMethod || 'jwt'
        const shouldTryJwtFirst = authMethod === 'jwt'
        
        if (shouldTryJwtFirst) {
          // Try JWT first
          const jwtToken = await getJWTCookie(config.apiEndpoint)
          if (jwtToken) {
            authHeaders['Authorization'] = jwtToken.includes('.') && jwtToken.split('.').length === 3
              ? `JWT ${jwtToken}`
              : `Bearer ${jwtToken}`
            debugLog('CHECK_AUTH: Using JWT authentication')
          } else if (config.apiKey) {
            // Fallback to API key if JWT not available
            authHeaders['Authorization'] = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
              ? `JWT ${config.apiKey}`
              : `Api-Key ${config.apiKey}`
            debugLog('CHECK_AUTH: Using API key as fallback')
          }
        } else if (config.apiKey) {
          // Try API key first
          authHeaders['Authorization'] = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
            ? `JWT ${config.apiKey}`
            : `Api-Key ${config.apiKey}`
          debugLog('CHECK_AUTH: Using API key authentication')
        } else {
          // No API key, try JWT as fallback
          const jwtToken = await getJWTCookie(config.apiEndpoint)
          if (jwtToken) {
            authHeaders['Authorization'] = jwtToken.includes('.') && jwtToken.split('.').length === 3
              ? `JWT ${jwtToken}`
              : `Bearer ${jwtToken}`
            debugLog('CHECK_AUTH: Using JWT as fallback (no API key available)')
          }
        }
        
        try {
          const userResponse = await axios.get(fullAuthUrl, {
            withCredentials: false,
            headers: authHeaders
          })
            
            // Auth response received from /auth/current-user
            
            // If we have a user but no avatar object, fetch full user details
            let finalUserData = userResponse.data
            if (userResponse.data.user && userResponse.data.user.avatar_file_upload_id && !userResponse.data.user.avatar) {
              try {
                // Fetching full user details to get avatar
                const fullUserResponse = await makeAPIRequest('GET', `/users/${userResponse.data.user.id}`)
                if (fullUserResponse && fullUserResponse.user && fullUserResponse.user.avatar) {
                  finalUserData.user.avatar = fullUserResponse.user.avatar
                  // Successfully fetched avatar data
                } else {
                  // No avatar found in user response
                }
              } catch (avatarError) {
                debugLog('Could not fetch full user details for avatar:', avatarError)
              }
            }
            
            sendResponse({ success: true, data: finalUserData })
        } catch (authError) {
          // If first attempt failed with API key, try with JWT
          if (authError.response?.status === 401 && config.apiKey && !shouldTryJwtFirst) {
            debugLog('CHECK_AUTH: API key failed, trying JWT fallback')
            const jwtToken = await getJWTCookie(config.apiEndpoint)
            
            if (jwtToken) {
              authHeaders['Authorization'] = jwtToken.includes('.') && jwtToken.split('.').length === 3
                ? `JWT ${jwtToken}`
                : `Bearer ${jwtToken}`
              
              try {
                const retryResponse = await axios.get(fullAuthUrl, {
                  withCredentials: false,
                  headers: authHeaders
                })
                
                debugLog('CHECK_AUTH: JWT fallback successful')
                
                sendResponse({ success: true, data: retryResponse.data })
              } catch (retryError) {
                debugLog('CHECK_AUTH: JWT also failed')
                sendResponse({ success: false, error: 'Not authenticated' })
              }
            } else {
              sendResponse({ success: false, error: 'Not authenticated' })
            }
          } else {
            debugLog('CHECK_AUTH: Authentication failed:', authError.response?.status)
            sendResponse({ success: false, error: 'Not authenticated' })
          }
        }
      } catch (error) {
        debugError('Auth check error:', error)
        sendResponse({ success: false, error: error.message || 'Auth check failed' })
      }
    }).catch(error => {
      debugError('Config error:', error)
      sendResponse({ success: false, error: 'Failed to get config' })
    })
    return true // Will respond asynchronously
  } else if (message.type === "START_VISUAL_EDITOR") {
    // Forward visual editor command to content script in active tab
    debugLog('===============================================')
    debugLog('Background received START_VISUAL_EDITOR:', message)
    debugLog('===============================================')
    
    // Handle async properly
    ;(async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tabs[0]?.id) {
          const tabId = tabs[0].id
          const tabUrl = tabs[0].url
          
          debugLog('Attempting to start visual editor on tab:', tabId, 'URL:', tabUrl)
          
          // Check if this is a restricted URL
          if (tabUrl?.startsWith('chrome://') || 
              tabUrl?.startsWith('chrome-extension://') || 
              tabUrl?.startsWith('edge://') ||
              tabUrl?.startsWith('about:')) {
            debugError('Cannot inject content script on restricted URL:', tabUrl)
            sendResponse({ success: false, error: 'Cannot use visual editor on browser pages' })
            return
          }
          
          // Always inject the visual editor directly
          debugLog('Injecting visual editor directly into page...')
          debugLog('Tab ID:', tabId, 'Tab URL:', tabUrl)
          
          try {
            // First, test with a simple alert to confirm injection works
            debugLog('Testing simple injection first...')
            const testResult = await chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: () => {
                console.log('[ABSmartly Test] Script injected successfully!')
                return { test: 'success' }
              }
            })
            debugLog('Test injection result:', testResult)
            
            // Now inject the actual visual editor
            const injectionResult = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: function(variantName, initialChanges) {
                  // This runs in the page context
                  console.log('[ABSmartly] Starting inline visual editor immediately')
                  
                  // Check if we already have the editor
                  if ((window as any).__absmartlyVisualEditorActive) {
                    console.log('[ABSmartly] Visual editor already active')
                    return { already: true }
                  }
                  
                  (window as any).__absmartlyVisualEditorActive = true
                  
                  // Create visual editor banner with Shadow DOM
                  const existingBanner = document.getElementById('absmartly-visual-editor-banner-host')
                  if (existingBanner) existingBanner.remove()
                  
                  const bannerHost = document.createElement('div')
                  bannerHost.id = 'absmartly-visual-editor-banner-host'
                  bannerHost.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: auto;
                    z-index: 2147483647;
                    pointer-events: none;
                  `
                  
                  const bannerShadow = bannerHost.attachShadow({ mode: 'closed' })
                  
                  const bannerStyle = document.createElement('style')
                  bannerStyle.textContent = `
                    .banner {
                      background: linear-gradient(90deg, #3b82f6, #10b981);
                      color: white;
                      padding: 10px;
                      font-family: system-ui, -apple-system, sans-serif;
                      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                      pointer-events: auto;
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      gap: 20px;
                    }
                    .banner-content {
                      flex: 1;
                      text-align: center;
                    }
                    .banner-title {
                      font-size: 14px;
                      font-weight: 500;
                    }
                    .banner-subtitle {
                      font-size: 12px;
                      margin-top: 5px;
                      opacity: 0.9;
                    }
                    .banner-actions {
                      display: flex;
                      gap: 10px;
                      align-items: center;
                    }
                    .banner-button {
                      background: rgba(255, 255, 255, 0.2);
                      border: 1px solid rgba(255, 255, 255, 0.3);
                      color: white;
                      padding: 6px 12px;
                      border-radius: 4px;
                      font-size: 12px;
                      font-weight: 500;
                      cursor: pointer;
                      transition: all 0.2s;
                      display: flex;
                      align-items: center;
                      gap: 5px;
                    }
                    .banner-button:hover:not(:disabled) {
                      background: rgba(255, 255, 255, 0.3);
                      transform: translateY(-1px);
                    }
                    .banner-button:disabled {
                      opacity: 0.5;
                      cursor: not-allowed;
                    }
                    .banner-button-icon {
                      font-size: 14px;
                    }
                    .changes-counter {
                      background: rgba(255, 255, 255, 0.2);
                      padding: 4px 8px;
                      border-radius: 12px;
                      font-size: 11px;
                      font-weight: 600;
                    }
                  `
                  
                  const bannerContent = document.createElement('div')
                  bannerContent.className = 'banner'
                  bannerContent.innerHTML = `
                    <div class="banner-actions">
                      <button class="banner-button" id="absmartly-undo-btn" title="Undo (Ctrl+Z)">
                        <span class="banner-button-icon">↶</span>
                        <span>Undo</span>
                      </button>
                      <button class="banner-button" id="absmartly-redo-btn" title="Redo (Ctrl+Y)">
                        <span class="banner-button-icon">↷</span>
                        <span>Redo</span>
                      </button>
                      <div class="changes-counter" id="absmartly-changes-counter">0 changes</div>
                    </div>
                    <div class="banner-content">
                      <div class="banner-title">🎨 ABSmartly Visual Editor Active - Variant: ${variantName}</div>
                      <div class="banner-subtitle">Click any element to edit • Press ESC to exit</div>
                    </div>
                    <div class="banner-actions">
                      <button class="banner-button" id="absmartly-clear-btn" title="Clear all changes">
                        <span class="banner-button-icon">✕</span>
                        <span>Clear All</span>
                      </button>
                      <button class="banner-button" id="absmartly-save-btn" title="Save changes">
                        <span class="banner-button-icon">✓</span>
                        <span>Save</span>
                      </button>
                      <button class="banner-button" id="absmartly-exit-btn" title="Exit visual editor" style="background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.3);">
                        <span class="banner-button-icon">✕</span>
                        <span>Exit</span>
                      </button>
                    </div>
                  `
                  
                  bannerShadow.appendChild(bannerStyle)
                  bannerShadow.appendChild(bannerContent)
                  document.body.appendChild(bannerHost)
                  
                  // Set up banner button event listeners
                  const undoBtn = bannerShadow.getElementById('absmartly-undo-btn')
                  const redoBtn = bannerShadow.getElementById('absmartly-redo-btn')
                  const clearBtn = bannerShadow.getElementById('absmartly-clear-btn')
                  const saveBtn = bannerShadow.getElementById('absmartly-save-btn')
                  const exitBtn = bannerShadow.getElementById('absmartly-exit-btn')
                  const changesCounter = bannerShadow.getElementById('absmartly-changes-counter')
                  
                  // Store references globally for updates
                  window.__absmartlyUndoBtn = undoBtn
                  window.__absmartlyRedoBtn = redoBtn
                  window.__absmartlyChangesCounter = changesCounter
                  
                  undoBtn?.addEventListener('click', () => performUndo())
                  redoBtn?.addEventListener('click', () => performRedo())
                  
                  clearBtn?.addEventListener('click', () => {
                    if (confirm('Clear all changes? This cannot be undone.')) {
                      allChanges.length = 0
                      changeHistory.length = 0
                      historyIndex = -1
                      updateUndoRedoButtons()
                      updateChangesCounter()
                      showNotification('All changes cleared')
                      // Exit visual editor after clearing
                      setTimeout(() => cleanupVisualEditor(), 1000)
                    }
                  })
                  
                  saveBtn?.addEventListener('click', () => {
                    if (allChanges.length > 0 && !changesSent) {
                      // Optimize changes: squash multiple moves of the same element
                      const optimizedChanges = []
                      const elementTracking = new Map() // Track elements by selector or ID
                      
                      for (const change of allChanges) {
                        if (change.type === 'move') {
                          // Track moved elements
                          const key = change.elementId || change.selector
                          if (!elementTracking.has(key)) {
                            elementTracking.set(key, {
                              firstChange: change,
                              moveCount: 1,
                              finalPosition: change
                            })
                          } else {
                            const tracked = elementTracking.get(key)
                            tracked.moveCount++
                            tracked.finalPosition = change
                          }
                        } else {
                          optimizedChanges.push(change)
                        }
                      }
                      
                      // Add optimized move changes
                      for (const [key, tracked] of elementTracking) {
                        if (tracked.moveCount > 1) {
                          // Create a single move change representing the final position
                          // Make sure to preserve the correct type
                          const optimizedChange = {
                            type: 'move',
                            selector: tracked.finalPosition.selector,
                            elementId: tracked.finalPosition.elementId,
                            timestamp: tracked.finalPosition.timestamp,
                            direction: tracked.finalPosition.direction,
                            moveType: tracked.finalPosition.type, // Rename to avoid confusion
                            optimized: true,
                            moveCount: tracked.moveCount
                          }
                          optimizedChanges.push(optimizedChange)
                        } else {
                          // Ensure the type field is correct for single moves too
                          const change = { ...tracked.firstChange }
                          if (change.type === 'move' || change.moveType) {
                            change.type = 'move'
                          }
                          optimizedChanges.push(change)
                        }
                      }
                      
                      // Convert to DOM changes format
                      const domChanges = optimizedChanges.map(change => {
                        let domChange = {
                          selector: change.elementId ? `#${change.elementId}` : change.selector,
                          timestamp: change.timestamp
                        }
                        
                        switch(change.type) {
                          case 'edit':
                            domChange.type = 'text'
                            domChange.value = change.newText
                            break
                          case 'editHtml':
                            domChange.type = 'html'
                            domChange.value = change.newHtml
                            break
                          case 'hide':
                            domChange.type = 'style'
                            domChange.property = 'display'
                            domChange.value = 'none'
                            break
                          case 'delete':
                            domChange.type = 'remove'
                            break
                          case 'insert':
                            domChange.type = 'insert'
                            domChange.html = change.html
                            domChange.position = change.position || 'after'
                            break
                          case 'move':
                            domChange.type = 'move'
                            // Get the current element position to determine target
                            const elem = document.querySelector(domChange.selector)
                            if (elem && elem.parentElement) {
                              const parent = elem.parentElement
                              const nextSibling = elem.nextElementSibling
                              const prevSibling = elem.previousElementSibling
                              
                              // Determine target and position based on current location
                              if (nextSibling) {
                                domChange.targetSelector = getSelector(nextSibling)
                                domChange.position = 'before'
                              } else if (prevSibling) {
                                domChange.targetSelector = getSelector(prevSibling)
                                domChange.position = 'after'
                              } else {
                                domChange.targetSelector = getSelector(parent)
                                domChange.position = 'firstChild'
                              }
                            }
                            // Clean up internal tracking fields
                            delete domChange.direction
                            delete domChange.optimized
                            delete domChange.moveCount
                            break
                          default:
                            domChange.type = change.type
                            domChange.data = change
                        }
                        
                        return domChange
                      })
                      
                      // Send via postMessage to content script
                      window.postMessage({
                        source: 'absmartly-visual-editor',
                        type: 'VISUAL_EDITOR_COMPLETE',
                        variantName: variantName,
                        changes: domChanges,
                        totalChanges: optimizedChanges.length
                      }, '*')
                      
                      console.log('[ABSmartly] Sent changes via postMessage:', domChanges)
                      changesSent = true  // Mark changes as sent
                      showNotification(`Saved ${optimizedChanges.length} changes (optimized from ${allChanges.length})`)
                      // Exit visual editor after successful save
                      setTimeout(() => cleanupVisualEditor(), 1500)
                    } else {
                      showNotification('No changes to save')
                    }
                  })
                  
                  // Add exit button handler and cleanup function
                  function cleanupVisualEditor() {
                    // Remove all event listeners
                    document.removeEventListener('mouseover', handleMouseOver)
                    document.removeEventListener('mouseout', handleMouseOut)
                    document.removeEventListener('click', handleClick)
                    document.removeEventListener('keydown', handleKeyPress)
                    
                    // Remove visual editor elements
                    document.getElementById('absmartly-visual-editor-banner-host')?.remove()
                    document.getElementById('absmartly-visual-editor-styles')?.remove()
                    document.getElementById('absmartly-menu-host')?.remove()
                    document.getElementById('absmartly-html-editor-host')?.remove()
                    document.getElementById('absmartly-hover-tooltip')?.remove()
                    
                    // Remove any selected/hover classes
                    document.querySelectorAll('.absmartly-hover').forEach(el => {
                      el.classList.remove('absmartly-hover')
                    })
                    document.querySelectorAll('.absmartly-selected').forEach(el => {
                      el.classList.remove('absmartly-selected')
                    })
                    
                    // Clear visual editor state
                    window.__absmartlyVisualEditorActive = false
                    window.postMessage({
                      source: 'absmartly-visual-editor',
                      type: 'VISUAL_EDITOR_CLOSED'
                    }, '*')
                    
                    console.log('[ABSmartly] Visual editor cleaned up and closed')
                  }
                  
                  exitBtn?.addEventListener('click', () => {
                    if (allChanges.length > 0 && !confirm('You have unsaved changes. Are you sure you want to exit?')) {
                      return
                    }
                    cleanupVisualEditor()
                  })
                  
                  // Add visual editor styles
                  const style = document.createElement('style')
                  style.id = 'absmartly-visual-editor-styles'
                  style.textContent = `
                    .absmartly-hover {
                      outline: 2px dashed #3b82f6 !important;
                      cursor: pointer !important;
                    }
                    .absmartly-selected {
                      outline: 3px solid #10b981 !important;
                      position: relative !important;
                    }
                    @keyframes slideIn {
                      from {
                        transform: translateX(100%);
                        opacity: 0;
                      }
                      to {
                        transform: translateX(0);
                        opacity: 1;
                      }
                    }
                  `
                  document.head.appendChild(style)
                  
                  // Track selected element and changes
                  let selectedElement = null
                  let isEditing = false
                  const allChanges = []
                  const changeHistory = []
                  let historyIndex = -1
                  const MAX_HISTORY = 50
                  let changesSent = false  // Track if changes were already sent
                  
                  // Hover tooltip element
                  let hoverTooltip = null
                  
                  // Add hover effect with tooltip
                  const handleMouseOver = (e) => {
                    if (isEditing) return
                    const target = e.target
                    // Don't hover on our Shadow DOM hosts
                    if (target.id === 'absmartly-visual-editor-banner-host' || 
                        target.closest('#absmartly-visual-editor-banner-host') ||
                        target.id === 'absmartly-menu-host' || 
                        target.closest('#absmartly-menu-host') ||
                        target.id === 'absmartly-html-editor-host' ||
                        target.closest('#absmartly-html-editor-host') ||
                        target.id === 'absmartly-hover-tooltip') {
                      return
                    }
                    target.classList.add('absmartly-hover')
                    
                    // Show tooltip with element selector
                    if (hoverTooltip) {
                      hoverTooltip.remove()
                    }
                    
                    const selector = getSelector(target)
                    hoverTooltip = document.createElement('div')
                    hoverTooltip.id = 'absmartly-hover-tooltip'
                    hoverTooltip.style.cssText = `
                      position: fixed;
                      background: #1f2937;
                      color: white;
                      padding: 6px 10px;
                      border-radius: 4px;
                      font-size: 12px;
                      font-family: monospace;
                      z-index: 2147483647;
                      pointer-events: none;
                      white-space: nowrap;
                      max-width: 400px;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    `
                    hoverTooltip.textContent = selector
                    
                    // Position tooltip near cursor
                    const rect = target.getBoundingClientRect()
                    const tooltipX = Math.min(rect.left, window.innerWidth - 420)
                    const tooltipY = rect.top - 30
                    
                    hoverTooltip.style.left = tooltipX + 'px'
                    hoverTooltip.style.top = (tooltipY < 10 ? rect.bottom + 5 : tooltipY) + 'px'
                    
                    document.body.appendChild(hoverTooltip)
                  }
                  
                  const handleMouseOut = (e) => {
                    if (isEditing) return
                    e.target.classList.remove('absmartly-hover')
                    
                    // Remove tooltip
                    if (hoverTooltip) {
                      hoverTooltip.remove()
                      hoverTooltip = null
                    }
                  }
                  
                  // Handle element click
                  const handleClick = (e) => {
                    const target = e.target
                    
                    // CRITICAL: Check for menu host first (shadow DOM container)
                    const menuHost = document.getElementById('absmartly-menu-host')
                    if (menuHost && (menuHost === target || menuHost.contains(target))) {
                      // Don't interfere with shadow DOM menu at all
                      return
                    }
                    
                    // Ignore clicks on our UI (banner and editor hosts)
                    if (target.id === 'absmartly-visual-editor-banner-host' || 
                        target.closest('#absmartly-visual-editor-banner-host') ||
                        target.id === 'absmartly-html-editor-host' ||
                        target.closest('#absmartly-html-editor-host')) {
                      return
                    }
                    
                    // Now prevent default for page elements
                    e.preventDefault()
                    e.stopPropagation()
                    
                    // Remove previous selection and menu
                    if (selectedElement) {
                      selectedElement.classList.remove('absmartly-selected')
                    }
                    const existingHost = document.getElementById('absmartly-menu-host')
                    if (existingHost) existingHost.remove()
                    
                    // Select new element
                    selectedElement = target
                    target.classList.remove('absmartly-hover')
                    target.classList.add('absmartly-selected')
                    
                    // Show context menu
                    showContextMenu(e.pageX, e.pageY, target)
                  }
                  
                  // Show context menu function with Shadow DOM isolation
                  function showContextMenu(x, y, element) {
                    // Remove any existing menu first
                    const existingHost = document.getElementById('absmartly-menu-host')
                    if (existingHost) existingHost.remove()
                    
                    // Calculate menu dimensions (approximate based on number of items)
                    const menuItemCount = 20 // Approximate number of menu items
                    const itemHeight = 32 // Approximate height per item
                    const dividerHeight = 9 // Height of dividers
                    const dividerCount = 6 // Number of dividers
                    const menuPadding = 8
                    const estimatedMenuHeight = (menuItemCount * itemHeight) + (dividerCount * dividerHeight) + menuPadding
                    const estimatedMenuWidth = 220
                    
                    // Determine if menu fits in viewport
                    const viewportHeight = window.innerHeight
                    const viewportWidth = window.innerWidth
                    const scrollY = window.scrollY
                    const scrollX = window.scrollX
                    
                    // Calculate optimal position
                    let menuLeft = x + 5
                    let menuTop = y + 5
                    let useAbsolutePositioning = false
                    
                    // Check if menu fits in viewport
                    if (estimatedMenuHeight > viewportHeight - 40) {
                      // Menu is too tall for viewport, use absolute positioning
                      useAbsolutePositioning = true
                      menuLeft = x + scrollX + 5
                      menuTop = y + scrollY + 5
                    } else {
                      // Menu fits in viewport, adjust position to keep it visible
                      if (menuLeft + estimatedMenuWidth > viewportWidth) {
                        menuLeft = Math.max(10, x - estimatedMenuWidth - 5)
                      }
                      if (menuTop + estimatedMenuHeight > viewportHeight) {
                        menuTop = Math.max(10, y - estimatedMenuHeight - 5)
                      }
                    }
                    
                    // Create host element for shadow DOM
                    const menuHost = document.createElement('div')
                    menuHost.id = 'absmartly-menu-host'
                    menuHost.style.cssText = `
                      position: ${useAbsolutePositioning ? 'absolute' : 'fixed'};
                      top: 0;
                      left: 0;
                      width: 0;
                      height: 0;
                      z-index: 2147483647;
                      pointer-events: none;
                    `
                    
                    // Attach shadow root with closed mode for complete isolation
                    const shadow = menuHost.attachShadow({ mode: 'closed' })
                    
                    // Create styles for shadow DOM
                    const style = document.createElement('style')
                    style.textContent = `
                      * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                      }
                      
                      .menu-backdrop {
                        position: fixed;
                        top: ${useAbsolutePositioning ? -scrollY : 0}px;
                        left: ${useAbsolutePositioning ? -scrollX : 0}px;
                        width: 100vw;
                        height: 100vh;
                        background: transparent;
                        pointer-events: auto;
                        z-index: 1;
                      }
                      
                      .menu-container {
                        position: ${useAbsolutePositioning ? 'absolute' : 'fixed'};
                        left: ${menuLeft}px;
                        top: ${menuTop}px;
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.1);
                        padding: 4px 0;
                        min-width: 200px;
                        max-width: 280px;
                        ${useAbsolutePositioning ? '' : 'max-height: calc(100vh - 20px);'}
                        ${useAbsolutePositioning ? '' : 'overflow-y: auto;'}
                        z-index: 2;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        font-size: 13px;
                        color: #333;
                        pointer-events: auto;
                      }
                      
                      /* Custom scrollbar for menu when needed */
                      .menu-container::-webkit-scrollbar {
                        width: 6px;
                      }
                      
                      .menu-container::-webkit-scrollbar-track {
                        background: #f1f1f1;
                        border-radius: 3px;
                      }
                      
                      .menu-container::-webkit-scrollbar-thumb {
                        background: #888;
                        border-radius: 3px;
                      }
                      
                      .menu-container::-webkit-scrollbar-thumb:hover {
                        background: #555;
                      }
                      
                      .menu-item {
                        padding: 8px 12px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: background-color 0.15s;
                        user-select: none;
                      }
                      
                      .menu-item:hover {
                        background-color: #f0f0f0;
                      }
                      
                      .menu-divider {
                        height: 1px;
                        background: #e5e5e5;
                        margin: 4px 0;
                      }
                      
                      .menu-icon {
                        width: 16px;
                        text-align: center;
                        opacity: 0.7;
                        font-size: 12px;
                      }
                      
                      .menu-label {
                        flex: 1;
                      }
                    `
                    shadow.appendChild(style)
                    
                    // Create backdrop
                    const backdrop = document.createElement('div')
                    backdrop.className = 'menu-backdrop'
                    
                    // Create menu container
                    const menuContainer = document.createElement('div')
                    menuContainer.className = 'menu-container'
                    
                    // Menu items data - matching VWO and Mida features
                    const menuItems = [
                      { icon: '✏️', label: 'Edit Element', action: 'edit' },
                      { icon: '</>', label: 'Edit HTML', action: 'editHtml' },
                      { icon: '🔄', label: 'Rearrange', action: 'rearrange' },
                      { icon: '✂️', label: 'Inline Edit', action: 'inlineEdit' },
                      { divider: true },
                      { icon: '⬆', label: 'Move up', action: 'moveUp' },
                      { icon: '⬇', label: 'Move down', action: 'moveDown' },
                      { icon: '↔️', label: 'Move / Resize', action: 'moveResize' },
                      { divider: true },
                      { icon: '📋', label: 'Copy', action: 'copy' },
                      { icon: '🔗', label: 'Copy Selector Path', action: 'copySelector', shortcut: '⌘+Shift+C' },
                      { divider: true },
                      { icon: '🎯', label: 'Select Relative Element', action: 'selectRelative' },
                      { icon: '➕', label: 'Insert new block', action: 'insertBlock' },
                      { divider: true },
                      { icon: '💡', label: 'Suggest Variations', action: 'suggestVariations' },
                      { icon: '💾', label: 'Save to library', action: 'saveToLibrary' },
                      { icon: '✅', label: 'Apply saved modification', action: 'applySaved' },
                      { divider: true },
                      { icon: '🎯', label: 'Track Clicks', action: 'trackClicks' },
                      { divider: true },
                      { icon: '👁', label: 'Hide', action: 'hide' },
                      { icon: '🗑', label: 'Remove', action: 'delete', shortcut: 'Delete' }
                    ]
                    
                    // Create menu items in shadow DOM
                    menuItems.forEach(item => {
                      if (item.divider) {
                        const divider = document.createElement('div')
                        divider.className = 'menu-divider'
                        menuContainer.appendChild(divider)
                      } else {
                        const menuItem = document.createElement('div')
                        menuItem.className = 'menu-item'
                        menuItem.dataset.action = item.action
                        
                        const icon = document.createElement('span')
                        icon.className = 'menu-icon'
                        icon.textContent = item.icon
                        
                        const label = document.createElement('span')
                        label.className = 'menu-label'
                        label.textContent = item.label
                        
                        // Add shortcut if it exists
                        let shortcut = null
                        if (item.shortcut) {
                          shortcut = document.createElement('span')
                          shortcut.style.cssText = 'color: #9ca3af; font-size: 11px; margin-left: auto;'
                          shortcut.textContent = item.shortcut
                        }
                        
                        menuItem.appendChild(icon)
                        menuItem.appendChild(label)
                        if (shortcut) {
                          menuItem.appendChild(shortcut)
                        }
                        menuContainer.appendChild(menuItem)
                      }
                    })
                    
                    // Add elements to shadow DOM
                    shadow.appendChild(backdrop)
                    shadow.appendChild(menuContainer)
                    
                    // Add menu host to document
                    document.body.appendChild(menuHost)
                    
                    // Handle clicks in shadow DOM
                    backdrop.addEventListener('click', (e) => {
                      e.stopPropagation()
                      menuHost.remove()
                    })
                    
                    menuContainer.addEventListener('click', (e) => {
                      e.stopPropagation()
                      const menuItem = e.target.closest('.menu-item')
                      if (menuItem) {
                        const action = menuItem.dataset.action
                        if (action) {
                          handleMenuAction(action, element)
                          menuHost.remove()
                        }
                      }
                    })
                  }
                  
                  // Handle menu actions
                  function handleMenuAction(action, element) {
                    const originalState = {
                      html: element.outerHTML,
                      parent: element.parentNode,
                      nextSibling: element.nextSibling
                    }
                    
                    switch(action) {
                      case 'edit':
                        // Remove selection styling while editing
                        element.classList.remove('absmartly-selected')
                        element.contentEditable = 'true'
                        element.focus()
                        
                        // Select all text for easy replacement
                        const range = document.createRange()
                        range.selectNodeContents(element)
                        const selection = window.getSelection()
                        selection.removeAllRanges()
                        selection.addRange(range)
                        
                        isEditing = true
                        
                        const handleBlur = () => {
                          element.contentEditable = 'false'
                          element.classList.add('absmartly-selected')
                          isEditing = false
                          element.removeEventListener('blur', handleBlur)
                          element.removeEventListener('keydown', handleKeyPress)
                          
                          // Track change
                          trackChange('edit', element, { 
                            oldText: originalState.html,
                            newText: element.textContent 
                          })
                        }
                        
                        const handleKeyPress = (e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            element.blur()
                          }
                          if (e.key === 'Escape') {
                            element.innerHTML = originalState.html
                            element.blur()
                          }
                        }
                        
                        element.addEventListener('blur', handleBlur)
                        element.addEventListener('keydown', handleKeyPress)
                        break
                        
                      case 'editHtml':
                        const currentHtml = element.outerHTML
                        
                        // Create editor host with Shadow DOM
                        const editorHost = document.createElement('div')
                        editorHost.id = 'absmartly-html-editor-host'
                        editorHost.style.cssText = `
                          position: fixed;
                          top: 0;
                          left: 0;
                          width: 0;
                          height: 0;
                          z-index: 2147483648;
                          pointer-events: none;
                        `
                        
                        const editorShadow = editorHost.attachShadow({ mode: 'closed' })
                        
                        const editorStyle = document.createElement('style')
                        editorStyle.textContent = `
                          * {
                            box-sizing: border-box;
                          }
                          
                          .editor-backdrop {
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100vw;
                            height: 100vh;
                            background: rgba(0, 0, 0, 0.5);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            pointer-events: auto;
                          }
                          
                          .editor-container {
                            background: white;
                            border-radius: 8px;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                            padding: 20px;
                            width: 80%;
                            max-width: 600px;
                            pointer-events: auto;
                          }
                          
                          .editor-title {
                            margin: 0 0 15px 0;
                            font-family: system-ui, -apple-system, sans-serif;
                            font-size: 18px;
                            font-weight: 600;
                            color: #111827;
                          }
                          
                          .editor-textarea {
                            width: 100%;
                            height: 300px;
                            padding: 10px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                            font-size: 12px;
                            resize: vertical;
                            outline: none;
                          }
                          
                          .editor-textarea:focus {
                            border-color: #3b82f6;
                            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                          }
                          
                          .editor-buttons {
                            margin-top: 15px;
                            display: flex;
                            justify-content: flex-end;
                            gap: 10px;
                          }
                          
                          .editor-button {
                            padding: 8px 16px;
                            border-radius: 4px;
                            font-family: system-ui, -apple-system, sans-serif;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.15s;
                          }
                          
                          .editor-button-cancel {
                            border: 1px solid #ddd;
                            background: white;
                            color: #374151;
                          }
                          
                          .editor-button-cancel:hover {
                            background: #f9fafb;
                          }
                          
                          .editor-button-save {
                            border: none;
                            background: #3b82f6;
                            color: white;
                          }
                          
                          .editor-button-save:hover {
                            background: #2563eb;
                          }
                        `
                        
                        // Create editor elements
                        const backdrop = document.createElement('div')
                        backdrop.className = 'editor-backdrop'
                        
                        const container = document.createElement('div')
                        container.className = 'editor-container'
                        
                        const title = document.createElement('h3')
                        title.className = 'editor-title'
                        title.textContent = 'Edit HTML'
                        
                        const textarea = document.createElement('textarea')
                        textarea.className = 'editor-textarea'
                        textarea.value = currentHtml
                        
                        const buttons = document.createElement('div')
                        buttons.className = 'editor-buttons'
                        
                        const cancelBtn = document.createElement('button')
                        cancelBtn.className = 'editor-button editor-button-cancel'
                        cancelBtn.textContent = 'Cancel'
                        
                        const saveBtn = document.createElement('button')
                        saveBtn.className = 'editor-button editor-button-save'
                        saveBtn.textContent = 'Save'
                        
                        buttons.appendChild(cancelBtn)
                        buttons.appendChild(saveBtn)
                        container.appendChild(title)
                        container.appendChild(textarea)
                        container.appendChild(buttons)
                        backdrop.appendChild(container)
                        
                        editorShadow.appendChild(editorStyle)
                        editorShadow.appendChild(backdrop)
                        
                        document.body.appendChild(editorHost)
                        
                        // Handle button clicks
                        cancelBtn.addEventListener('click', () => {
                          editorHost.remove()
                        })
                        
                        saveBtn.addEventListener('click', () => {
                          const tempDiv = document.createElement('div')
                          tempDiv.innerHTML = textarea.value
                          const newElement = tempDiv.firstElementChild
                          if (newElement) {
                            element.replaceWith(newElement)
                            trackChange('editHtml', newElement, { 
                              oldHtml: currentHtml,
                              newHtml: textarea.value 
                            })
                          }
                          editorHost.remove()
                        })
                        
                        // Prevent backdrop clicks from closing (only click outside container)
                        backdrop.addEventListener('click', (e) => {
                          if (e.target === backdrop) {
                            editorHost.remove()
                          }
                        })
                        
                        // Focus and select textarea content
                        setTimeout(() => {
                          textarea.focus()
                          textarea.select()
                        }, 10)
                        break
                        
                      case 'hide':
                        element.style.display = 'none'
                        trackChange('hide', element, { display: 'none' })
                        break
                        
                      case 'delete':
                        element.remove()
                        trackChange('delete', null, { 
                          deletedHtml: originalState.html,
                          parent: originalState.parent 
                        })
                        break
                        
                      case 'copy':
                        // Copy element HTML to clipboard
                        navigator.clipboard.writeText(element.outerHTML).then(() => {
                          showNotification('Element HTML copied to clipboard!')
                        })
                        break
                        
                      case 'copySelector':
                        // Generate and copy CSS selector
                        const selector = getSelector(element)
                        navigator.clipboard.writeText(selector).then(() => {
                          showNotification(`Selector copied: ${selector}`)
                        })
                        break
                        
                      case 'selectRelative':
                        // Show relative element selector dialog
                        showRelativeElementSelector(element)
                        break
                        
                      case 'insertBlock':
                        // Show insert block dialog
                        showInsertBlockDialog(element)
                        break
                        
                      case 'rearrange':
                        // Enable drag and drop rearranging
                        enableRearrangeMode(element)
                        break
                        
                      case 'inlineEdit':
                        // Quick inline text editing
                        element.contentEditable = 'true'
                        element.focus()
                        const inlineRange = document.createRange()
                        inlineRange.selectNodeContents(element)
                        const inlineSelection = window.getSelection()
                        inlineSelection.removeAllRanges()
                        inlineSelection.addRange(inlineRange)
                        isEditing = true
                        
                        const finishInlineEdit = () => {
                          element.contentEditable = 'false'
                          isEditing = false
                          trackChange('edit', element, { 
                            oldText: originalState.html,
                            newText: element.textContent 
                          })
                        }
                        
                        element.addEventListener('blur', finishInlineEdit, { once: true })
                        element.addEventListener('keydown', (e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            e.preventDefault()
                            element.blur()
                          }
                        })
                        break
                        
                      case 'moveResize':
                        // Enable move/resize mode
                        enableMoveResizeMode(element)
                        break
                        
                      case 'suggestVariations':
                        // Show AI-powered variations
                        showNotification('AI Variations: Coming soon!')
                        break
                        
                      case 'saveToLibrary':
                        // Save element modification to library
                        const elementData = {
                          selector: getSelector(element),
                          html: element.outerHTML,
                          styles: window.getComputedStyle(element).cssText
                        }
                        localStorage.setItem('absmartly-saved-element', JSON.stringify(elementData))
                        showNotification('Element saved to library!')
                        break
                        
                      case 'applySaved':
                        // Apply saved modification
                        const saved = localStorage.getItem('absmartly-saved-element')
                        if (saved) {
                          const data = JSON.parse(saved)
                          element.outerHTML = data.html
                          showNotification('Saved modification applied!')
                        } else {
                          showNotification('No saved modifications found')
                        }
                        break
                        
                      case 'trackClicks':
                        // Enable click tracking
                        element.dataset.trackClicks = 'true'
                        element.style.cursor = 'pointer'
                        element.addEventListener('click', (e) => {
                          e.preventDefault()
                          console.log('[Click Tracked]', getSelector(element))
                          showNotification(`Click tracked on: ${getSelector(element)}`)
                        })
                        showNotification('Click tracking enabled for this element')
                        break
                        
                      case 'duplicate':
                        const clone = element.cloneNode(true)
                        clone.classList.remove('absmartly-selected', 'absmartly-hover')
                        // Remove any IDs to avoid conflicts
                        clone.removeAttribute('id')
                        clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'))
                        
                        element.parentNode.insertBefore(clone, element.nextSibling)
                        
                        // Track as an insert operation instead of duplicate
                        trackChange('insert', element, { 
                          html: clone.outerHTML,
                          position: 'after',
                          insertedElement: clone  // For undo functionality
                        })
                        break
                      
                      case 'copyStyle':
                        const computedStyle = window.getComputedStyle(element)
                        const styles = Array.from(computedStyle).reduce((str, prop) => {
                          return str + `${prop}:${computedStyle.getPropertyValue(prop)};`
                        }, '')
                        navigator.clipboard.writeText(styles)
                        showNotification('Style copied to clipboard!')
                        break
                        
                      case 'moveUp':
                        const originalParentUp = element.parentElement
                        const originalNextSiblingUp = element.nextSibling
                        
                        if (element.previousElementSibling) {
                          // Move before previous sibling
                          element.parentNode.insertBefore(element, element.previousElementSibling)
                          trackChange('move', element, { 
                            direction: 'up',
                            moveType: 'sibling',
                            originalParent: originalParentUp,
                            originalNextSibling: originalNextSiblingUp
                          })
                          showNotification('Element moved up')
                        } else if (element.parentElement && element.parentElement !== document.body) {
                          // Move before parent element
                          const parent = element.parentElement
                          const grandParent = parent.parentElement
                          if (grandParent) {
                            grandParent.insertBefore(element, parent)
                            trackChange('move', element, { 
                              direction: 'up',
                              moveType: 'parent',
                              originalParent: originalParentUp,
                              originalNextSibling: originalNextSiblingUp
                            })
                            showNotification('Element moved before parent')
                          } else {
                            showNotification('Cannot move further up')
                          }
                        } else {
                          showNotification('Cannot move up - at document root')
                        }
                        // Keep the element selected after moving
                        element.classList.add('absmartly-selected')
                        selectedElement = element
                        break
                        
                      case 'moveDown':
                        const originalParentDown = element.parentElement
                        const originalNextSiblingDown = element.nextSibling
                        
                        if (element.nextElementSibling) {
                          // Move after next sibling
                          element.parentNode.insertBefore(element.nextElementSibling, element)
                          trackChange('move', element, { 
                            direction: 'down',
                            moveType: 'sibling',
                            originalParent: originalParentDown,
                            originalNextSibling: originalNextSiblingDown
                          })
                          showNotification('Element moved down')
                        } else if (element.parentElement && element.parentElement !== document.body) {
                          // Move after parent element
                          const parent = element.parentElement
                          const grandParent = parent.parentElement
                          if (grandParent) {
                            grandParent.insertBefore(element, parent.nextSibling)
                            trackChange('move', element, { 
                              direction: 'down',
                              moveType: 'parent',
                              originalParent: originalParentDown,
                              originalNextSibling: originalNextSiblingDown
                            })
                            showNotification('Element moved after parent')
                          } else {
                            showNotification('Cannot move further down')
                          }
                        } else {
                          showNotification('Cannot move down - at document root')
                        }
                        // Keep the element selected after moving
                        element.classList.add('absmartly-selected')
                        selectedElement = element
                        break
                    }
                  }
                  
                  // Enable rearrange mode with drag and drop
                  function enableRearrangeMode(element) {
                    element.draggable = true
                    element.style.cursor = 'move'
                    element.style.opacity = '0.8'
                    
                    let draggedElement = null
                    
                    const handleDragStart = (e) => {
                      draggedElement = e.target
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/html', e.target.innerHTML)
                    }
                    
                    const handleDragOver = (e) => {
                      if (e.preventDefault) {
                        e.preventDefault()
                      }
                      e.dataTransfer.dropEffect = 'move'
                      
                      const targetElement = e.target
                      if (targetElement !== draggedElement) {
                        targetElement.style.outline = '2px dashed #3b82f6'
                      }
                      return false
                    }
                    
                    const handleDragLeave = (e) => {
                      e.target.style.outline = ''
                    }
                    
                    const handleDrop = (e) => {
                      if (e.stopPropagation) {
                        e.stopPropagation()
                      }
                      
                      const targetElement = e.target
                      targetElement.style.outline = ''
                      
                      if (draggedElement !== targetElement) {
                        // Swap elements
                        const draggedParent = draggedElement.parentNode
                        const targetParent = targetElement.parentNode
                        const draggedNext = draggedElement.nextSibling
                        const targetNext = targetElement.nextSibling
                        
                        if (draggedNext === targetElement) {
                          draggedParent.insertBefore(targetElement, draggedElement)
                        } else if (targetNext === draggedElement) {
                          targetParent.insertBefore(draggedElement, targetElement)
                        } else {
                          draggedParent.insertBefore(targetElement, draggedNext)
                          targetParent.insertBefore(draggedElement, targetNext)
                        }
                        
                        trackChange('move', draggedElement, { 
                          direction: 'rearrange',
                          target: getSelector(targetElement)
                        })
                      }
                      
                      return false
                    }
                    
                    const handleDragEnd = (e) => {
                      element.draggable = false
                      element.style.cursor = ''
                      element.style.opacity = ''
                      
                      // Clean up all event listeners
                      document.removeEventListener('dragstart', handleDragStart)
                      document.removeEventListener('dragover', handleDragOver)
                      document.removeEventListener('dragleave', handleDragLeave)
                      document.removeEventListener('drop', handleDrop)
                      document.removeEventListener('dragend', handleDragEnd)
                      
                      showNotification('Rearrange mode disabled')
                    }
                    
                    // Add event listeners
                    element.addEventListener('dragstart', handleDragStart)
                    document.addEventListener('dragover', handleDragOver)
                    document.addEventListener('dragleave', handleDragLeave)
                    document.addEventListener('drop', handleDrop)
                    document.addEventListener('dragend', handleDragEnd)
                    
                    showNotification('Drag element to rearrange. Click elsewhere to exit.')
                  }
                  
                  // Enable move/resize mode
                  function enableMoveResizeMode(element) {
                    const originalPosition = window.getComputedStyle(element).position
                    const originalStyles = {
                      position: element.style.position,
                      top: element.style.top,
                      left: element.style.left,
                      width: element.style.width,
                      height: element.style.height,
                      cursor: element.style.cursor
                    }
                    
                    // Make element movable
                    if (originalPosition === 'static') {
                      element.style.position = 'relative'
                    }
                    
                    // Create resize handles
                    const resizeHandles = document.createElement('div')
                    resizeHandles.id = 'absmartly-resize-handles'
                    resizeHandles.style.cssText = `
                      position: absolute;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      pointer-events: none;
                      z-index: 2147483646;
                    `
                    
                    // Add corner and edge handles
                    const handlePositions = [
                      { name: 'nw', cursor: 'nw-resize', top: '-4px', left: '-4px' },
                      { name: 'ne', cursor: 'ne-resize', top: '-4px', right: '-4px' },
                      { name: 'sw', cursor: 'sw-resize', bottom: '-4px', left: '-4px' },
                      { name: 'se', cursor: 'se-resize', bottom: '-4px', right: '-4px' },
                      { name: 'n', cursor: 'n-resize', top: '-4px', left: '50%', transform: 'translateX(-50%)' },
                      { name: 's', cursor: 's-resize', bottom: '-4px', left: '50%', transform: 'translateX(-50%)' },
                      { name: 'w', cursor: 'w-resize', top: '50%', left: '-4px', transform: 'translateY(-50%)' },
                      { name: 'e', cursor: 'e-resize', top: '50%', right: '-4px', transform: 'translateY(-50%)' }
                    ]
                    
                    handlePositions.forEach(pos => {
                      const handle = document.createElement('div')
                      handle.className = `resize-handle resize-${pos.name}`
                      handle.style.cssText = `
                        position: absolute;
                        width: 8px;
                        height: 8px;
                        background: #3b82f6;
                        border: 1px solid white;
                        border-radius: 2px;
                        cursor: ${pos.cursor};
                        pointer-events: auto;
                        ${pos.top ? `top: ${pos.top};` : ''}
                        ${pos.bottom ? `bottom: ${pos.bottom};` : ''}
                        ${pos.left ? `left: ${pos.left};` : ''}
                        ${pos.right ? `right: ${pos.right};` : ''}
                        ${pos.transform ? `transform: ${pos.transform};` : ''}
                      `
                      resizeHandles.appendChild(handle)
                    })
                    
                    element.style.position = 'relative'
                    element.appendChild(resizeHandles)
                    
                    // Make element draggable
                    element.style.cursor = 'move'
                    
                    let isDragging = false
                    let isResizing = false
                    let startX, startY, startWidth, startHeight, startLeft, startTop
                    
                    const handleMouseDown = (e) => {
                      if (e.target.classList.contains('resize-handle')) {
                        isResizing = true
                        startX = e.clientX
                        startY = e.clientY
                        startWidth = element.offsetWidth
                        startHeight = element.offsetHeight
                        e.preventDefault()
                      } else if (e.target === element) {
                        isDragging = true
                        startX = e.clientX
                        startY = e.clientY
                        startLeft = element.offsetLeft
                        startTop = element.offsetTop
                        e.preventDefault()
                      }
                    }
                    
                    const handleMouseMove = (e) => {
                      if (isDragging) {
                        const deltaX = e.clientX - startX
                        const deltaY = e.clientY - startY
                        element.style.left = (startLeft + deltaX) + 'px'
                        element.style.top = (startTop + deltaY) + 'px'
                      } else if (isResizing) {
                        const deltaX = e.clientX - startX
                        const deltaY = e.clientY - startY
                        element.style.width = (startWidth + deltaX) + 'px'
                        element.style.height = (startHeight + deltaY) + 'px'
                      }
                    }
                    
                    const handleMouseUp = () => {
                      if (isDragging || isResizing) {
                        trackChange('style', element, {
                          property: isDragging ? 'position' : 'size',
                          value: isDragging ? 
                            `left: ${element.style.left}, top: ${element.style.top}` :
                            `width: ${element.style.width}, height: ${element.style.height}`
                        })
                      }
                      isDragging = false
                      isResizing = false
                    }
                    
                    // Add event listeners
                    element.addEventListener('mousedown', handleMouseDown)
                    document.addEventListener('mousemove', handleMouseMove)
                    document.addEventListener('mouseup', handleMouseUp)
                    
                    // Exit button
                    const exitBtn = document.createElement('button')
                    exitBtn.textContent = '✓ Done'
                    exitBtn.style.cssText = `
                      position: absolute;
                      top: -35px;
                      right: 0;
                      padding: 4px 8px;
                      background: #10b981;
                      color: white;
                      border: none;
                      border-radius: 4px;
                      font-size: 12px;
                      cursor: pointer;
                      z-index: 2147483647;
                    `
                    exitBtn.onclick = () => {
                      resizeHandles.remove()
                      exitBtn.remove()
                      element.removeEventListener('mousedown', handleMouseDown)
                      document.removeEventListener('mousemove', handleMouseMove)
                      document.removeEventListener('mouseup', handleMouseUp)
                      
                      // Restore original styles if needed
                      element.style.cursor = originalStyles.cursor
                      
                      showNotification('Move/Resize mode disabled')
                    }
                    element.appendChild(exitBtn)
                    
                    showNotification('Drag to move, drag handles to resize')
                  }
                  
                  // Show relative element selector dialog
                  function showRelativeElementSelector(element) {
                    // Remove existing selector UI
                    const existingHost = document.getElementById('absmartly-relative-selector-host')
                    if (existingHost) existingHost.remove()
                    
                    // Create host for shadow DOM
                    const selectorHost = document.createElement('div')
                    selectorHost.id = 'absmartly-relative-selector-host'
                    selectorHost.style.cssText = `
                      position: fixed;
                      top: 0;
                      left: 0;
                      width: 0;
                      height: 0;
                      z-index: 2147483647;
                      pointer-events: none;
                    `
                    
                    const shadow = selectorHost.attachShadow({ mode: 'closed' })
                    
                    // Create UI for relative element selection
                    const container = document.createElement('div')
                    container.style.cssText = `
                      position: fixed;
                      bottom: 20px;
                      right: 20px;
                      background: white;
                      border: 1px solid #ddd;
                      border-radius: 8px;
                      padding: 15px;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                      font-size: 13px;
                      pointer-events: auto;
                      min-width: 200px;
                    `
                    
                    container.innerHTML = `
                      <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Select Relative Element</h4>
                      <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button data-action="parent" style="padding: 8px 12px; background: #f0f9ff; border: 1px solid #3b82f6; border-radius: 4px; cursor: pointer; text-align: left;">
                          ⬆️ Parent Element
                        </button>
                        <button data-action="children" style="padding: 8px 12px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; cursor: pointer; text-align: left;">
                          ⬇️ All Children
                        </button>
                        <button data-action="siblings" style="padding: 8px 12px; background: #ecfdf5; border: 1px solid #10b981; border-radius: 4px; cursor: pointer; text-align: left;">
                          ↔️ All Siblings
                        </button>
                        <button data-action="close" style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; text-align: center; margin-top: 8px;">
                          Close
                        </button>
                      </div>
                    `
                    
                    // Handle button clicks
                    container.addEventListener('click', (e) => {
                      const btn = e.target.closest('button')
                      if (!btn) return
                      
                      const action = btn.dataset.action
                      switch(action) {
                        case 'parent':
                          if (element.parentElement) {
                            selectedElement = element.parentElement
                            element.classList.remove('absmartly-selected')
                            selectedElement.classList.add('absmartly-selected')
                            showNotification('Parent element selected')
                          }
                          break
                        case 'children':
                          element.classList.remove('absmartly-selected')
                          Array.from(element.children).forEach(child => {
                            child.classList.add('absmartly-selected')
                          })
                          showNotification(`${element.children.length} children selected`)
                          break
                        case 'siblings':
                          if (element.parentElement) {
                            element.classList.remove('absmartly-selected')
                            Array.from(element.parentElement.children).forEach(sibling => {
                              if (sibling !== element) {
                                sibling.classList.add('absmartly-selected')
                              }
                            })
                            showNotification('Siblings selected')
                          }
                          break
                        case 'close':
                          selectorHost.remove()
                          break
                      }
                    })
                    
                    shadow.appendChild(container)
                    document.body.appendChild(selectorHost)
                  }
                  
                  // Show insert block dialog
                  function showInsertBlockDialog(element) {
                    console.log('[ABSmartly] showInsertBlockDialog called')
                    
                    // Remove existing dialog
                    const existingHost = document.getElementById('absmartly-insert-block-host')
                    if (existingHost) {
                      console.log('[ABSmartly] Removing existing dialog')
                      existingHost.remove()
                    }
                    
                    // Create host for shadow DOM - but NOT using shadow DOM for dialog
                    const dialogHost = document.createElement('div')
                    dialogHost.id = 'absmartly-insert-block-host'
                    dialogHost.style.cssText = `
                      position: fixed !important;
                      top: 0 !important;
                      left: 0 !important;
                      width: 100vw !important;
                      height: 100vh !important;
                      z-index: 2147483647 !important;
                      background: rgba(0,0,0,0.5) !important;
                      display: flex !important;
                      align-items: center !important;
                      justify-content: center !important;
                      pointer-events: auto !important;
                    `
                    
                    // Create dialog
                    const dialog = document.createElement('div')
                    dialog.style.cssText = `
                      background: white;
                      border-radius: 8px;
                      padding: 20px;
                      width: 400px;
                      max-width: 90%;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                      font-size: 14px;
                    `
                    
                    dialog.innerHTML = `
                      <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Insert New Block</h3>
                      
                      <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #6b7280;">Position:</label>
                        <select id="position" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
                          <option value="before">Before selected element</option>
                          <option value="after">After selected element</option>
                          <option value="prepend">As first child</option>
                          <option value="append">As last child</option>
                        </select>
                      </div>
                      
                      <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #6b7280;">Element Type:</label>
                        <select id="elementType" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
                          <option value="div">Div</option>
                          <option value="section">Section</option>
                          <option value="button">Button</option>
                          <option value="a">Link</option>
                          <option value="p">Paragraph</option>
                          <option value="h2">Heading 2</option>
                          <option value="h3">Heading 3</option>
                          <option value="img">Image</option>
                          <option value="custom">Custom HTML</option>
                        </select>
                      </div>
                      
                      <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #6b7280;">Content/HTML:</label>
                        <textarea id="content" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; min-height: 80px; font-family: monospace; font-size: 12px;" placeholder="Enter content or HTML">New Block</textarea>
                      </div>
                      
                      <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button id="cancelBtn" style="padding: 8px 16px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer;">Cancel</button>
                        <button id="insertBtn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Insert</button>
                      </div>
                    `
                    
                    // Handle element type change
                    const elementTypeSelect = dialog.querySelector('#elementType')
                    const contentTextarea = dialog.querySelector('#content')
                    
                    elementTypeSelect.addEventListener('change', () => {
                      if (elementTypeSelect.value === 'custom') {
                        contentTextarea.placeholder = 'Enter complete HTML'
                        contentTextarea.value = '<div>Custom HTML</div>'
                      } else {
                        contentTextarea.placeholder = 'Enter content'
                        const defaults = {
                          button: 'Click Me',
                          a: 'Link Text',
                          p: 'Lorem ipsum dolor sit amet.',
                          h2: 'Section Heading',
                          h3: 'Subsection Heading',
                          img: '',
                          div: '',
                          section: ''
                        }
                        contentTextarea.value = defaults[elementTypeSelect.value] || 'New Block'
                      }
                    })
                    
                    // Handle cancel
                    dialog.querySelector('#cancelBtn').addEventListener('click', () => {
                      dialogHost.remove()
                    })
                    
                    // Handle insert
                    dialog.querySelector('#insertBtn').addEventListener('click', () => {
                      console.log('[ABSmartly] Insert button clicked')
                      const position = dialog.querySelector('#position').value
                      const type = elementTypeSelect.value
                      const content = contentTextarea.value
                      
                      console.log('[ABSmartly] Creating new element:', { position, type, content })
                      
                      let newElement
                      if (type === 'custom') {
                        const temp = document.createElement('div')
                        temp.innerHTML = content
                        newElement = temp.firstElementChild || document.createElement('div')
                      } else if (type === 'img') {
                        newElement = document.createElement('img')
                        newElement.src = content || 'https://via.placeholder.com/300x200'
                        newElement.alt = 'New Image'
                      } else {
                        newElement = document.createElement(type)
                        if (type === 'a') {
                          newElement.href = '#'
                        }
                        if (content) {
                          newElement.textContent = content
                        }
                      }
                      
                      console.log('[ABSmartly] Inserting element at position:', position)
                      
                      // Insert the element
                      try {
                        switch(position) {
                          case 'before':
                            element.parentNode?.insertBefore(newElement, element)
                            break
                          case 'after':
                            element.parentNode?.insertBefore(newElement, element.nextSibling)
                            break
                          case 'prepend':
                            element.insertBefore(newElement, element.firstChild)
                            break
                          case 'append':
                            element.appendChild(newElement)
                            break
                        }
                        
                        console.log('[ABSmartly] Element inserted successfully')
                        
                        // Track the change
                        trackChange('insert', element, {
                          html: newElement.outerHTML,
                          position: position
                        })
                        
                        // Select the new element
                        selectedElement = newElement
                        element.classList.remove('absmartly-selected')
                        newElement.classList.add('absmartly-selected')
                        
                        showNotification('New block inserted!')
                        
                        // Remove the dialog
                        console.log('[ABSmartly] Removing dialog')
                        dialogHost.remove()
                      } catch (error) {
                        console.error('[ABSmartly] Error inserting element:', error)
                        showNotification('Error inserting block: ' + error.message)
                      }
                    })
                    
                    // Close on backdrop click
                    dialogHost.addEventListener('click', (e) => {
                      if (e.target === dialogHost) {
                        dialogHost.remove()
                      }
                    })
                    
                    shadow.appendChild(dialog)
                    document.body.appendChild(dialogHost)
                  }
                  
                  // Track changes for saving with undo/redo support
                  function trackChange(type, element, data) {
                    // For move operations, ensure element has an ID for consistent tracking
                    let elementId = null
                    if (type === 'move' && element) {
                      if (!element.id) {
                        // Generate a unique ID for tracking
                        elementId = 'absmartly-' + Math.random().toString(36).substr(2, 9)
                        element.id = elementId
                        element.setAttribute('data-absmartly-tracked', 'true')
                      } else {
                        elementId = element.id
                      }
                    }
                    
                    // Filter out DOM elements from data to ensure serializability
                    const serializableData = {}
                    for (const key in data) {
                      const value = data[key]
                      // Skip DOM elements and functions
                      if (value && typeof value === 'object' && value.nodeType) {
                        // It's a DOM element, store its selector instead
                        serializableData[key + 'Selector'] = getSelector(value)
                      } else if (typeof value !== 'function') {
                        serializableData[key] = value
                      }
                    }
                    
                    const change = {
                      type,
                      selector: element ? getSelector(element) : null,
                      elementId: elementId,
                      timestamp: Date.now(),
                      ...serializableData
                    }
                    
                    console.log('[ABSmartly] Change tracked:', change)
                    
                    // Store change locally
                    allChanges.push(change)
                    
                    // Add to history for undo/redo
                    // Remove any changes after current index (for new branch after undo)
                    changeHistory.splice(historyIndex + 1)
                    
                    // Store the change with enough info to undo it
                    // Note: data contains DOM references for undo/redo, change contains serializable version
                    const historyEntry = {
                      change: change,
                      undo: createUndoAction(type, element, data),  // Uses original data with DOM refs
                      redo: createRedoAction(type, element, data)   // Uses original data with DOM refs
                    }
                    
                    changeHistory.push(historyEntry)
                    historyIndex++
                    
                    // Limit history size
                    if (changeHistory.length > MAX_HISTORY) {
                      changeHistory.shift()
                      historyIndex--
                    }
                    
                    // Update undo/redo button states
                    updateUndoRedoButtons()
                    
                    // Also send individual change to extension for real-time updates
                    if (window.chrome && chrome.runtime) {
                      chrome.runtime.sendMessage({
                        type: 'VISUAL_EDITOR_CHANGE',
                        change
                      })
                    }
                  }
                  
                  // Create undo action for a change
                  function createUndoAction(type, element, data) {
                    switch(type) {
                      case 'edit':
                        return () => {
                          if (element) {
                            element.textContent = data.oldText
                          }
                        }
                      case 'editHtml':
                        return () => {
                          const tempDiv = document.createElement('div')
                          tempDiv.innerHTML = data.oldHtml
                          const oldElement = tempDiv.firstElementChild
                          if (element && oldElement) {
                            element.replaceWith(oldElement)
                          }
                        }
                      case 'hide':
                        return () => {
                          if (element) {
                            element.style.display = ''
                          }
                        }
                      case 'delete':
                        return () => {
                          const tempDiv = document.createElement('div')
                          tempDiv.innerHTML = data.deletedHtml
                          const restoredElement = tempDiv.firstElementChild
                          if (restoredElement && data.parent) {
                            if (data.nextSibling) {
                              data.parent.insertBefore(restoredElement, data.nextSibling)
                            } else {
                              data.parent.appendChild(restoredElement)
                            }
                          }
                        }
                      case 'insert':
                        return () => {
                          if (data.insertedElement) {
                            data.insertedElement.remove()
                          }
                        }
                      case 'move':
                        return () => {
                          // Reverse the move
                          if (data.direction === 'up') {
                            if (data.type === 'sibling' && element.nextElementSibling) {
                              element.parentNode.insertBefore(element.nextElementSibling, element)
                            } else if (data.type === 'parent' && data.originalParent) {
                              data.originalParent.appendChild(element)
                            }
                          } else if (data.direction === 'down') {
                            if (data.type === 'sibling' && element.previousElementSibling) {
                              element.parentNode.insertBefore(element, element.previousElementSibling)
                            } else if (data.type === 'parent' && data.originalParent) {
                              data.originalParent.insertBefore(element, data.originalParent.firstChild)
                            }
                          }
                        }
                      default:
                        return () => {}
                    }
                  }
                  
                  // Create redo action for a change
                  function createRedoAction(type, element, data) {
                    switch(type) {
                      case 'edit':
                        return () => {
                          if (element) {
                            element.textContent = data.newText
                          }
                        }
                      case 'editHtml':
                        return () => {
                          const tempDiv = document.createElement('div')
                          tempDiv.innerHTML = data.newHtml
                          const newElement = tempDiv.firstElementChild
                          if (element && newElement) {
                            element.replaceWith(newElement)
                          }
                        }
                      case 'hide':
                        return () => {
                          if (element) {
                            element.style.display = 'none'
                          }
                        }
                      case 'delete':
                        return () => {
                          if (element) {
                            element.remove()
                          }
                        }
                      case 'insert':
                        return () => {
                          if (data.html && element) {
                            const tempDiv = document.createElement('div')
                            tempDiv.innerHTML = data.html
                            const newElement = tempDiv.firstElementChild
                            if (newElement) {
                              if (data.position === 'after') {
                                element.parentNode.insertBefore(newElement, element.nextSibling)
                              } else if (data.position === 'before') {
                                element.parentNode.insertBefore(newElement, element)
                              }
                            }
                          }
                        }
                      case 'move':
                        return () => {
                          // Redo the move
                          if (data.direction === 'up') {
                            if (data.type === 'sibling' && element.previousElementSibling) {
                              element.parentNode.insertBefore(element, element.previousElementSibling)
                            } else if (data.type === 'parent' && element.parentElement) {
                              const parent = element.parentElement
                              parent.parentElement?.insertBefore(element, parent)
                            }
                          } else if (data.direction === 'down') {
                            if (data.type === 'sibling' && element.nextElementSibling) {
                              element.parentNode.insertBefore(element.nextElementSibling, element)
                            } else if (data.type === 'parent' && element.parentElement) {
                              const parent = element.parentElement
                              parent.parentElement?.insertBefore(element, parent.nextSibling)
                            }
                          }
                        }
                      default:
                        return () => {}
                    }
                  }
                  
                  // Perform undo
                  function performUndo() {
                    if (historyIndex >= 0 && changeHistory[historyIndex]) {
                      const entry = changeHistory[historyIndex]
                      entry.undo()
                      historyIndex--
                      updateUndoRedoButtons()
                      showNotification('Action undone')
                    }
                  }
                  
                  // Perform redo
                  function performRedo() {
                    if (historyIndex < changeHistory.length - 1) {
                      historyIndex++
                      const entry = changeHistory[historyIndex]
                      entry.redo()
                      updateUndoRedoButtons()
                      showNotification('Action redone')
                    }
                  }
                  
                  // Update undo/redo button states
                  function updateUndoRedoButtons() {
                    const undoBtn = window.__absmartlyUndoBtn
                    const redoBtn = window.__absmartlyRedoBtn
                    
                    if (undoBtn) {
                      undoBtn.disabled = historyIndex < 0
                    }
                    
                    if (redoBtn) {
                      redoBtn.disabled = historyIndex >= changeHistory.length - 1
                    }
                    
                    updateChangesCounter()
                  }
                  
                  // Update changes counter
                  function updateChangesCounter() {
                    const counter = window.__absmartlyChangesCounter
                    if (counter) {
                      const count = allChanges.length
                      counter.textContent = `${count} change${count !== 1 ? 's' : ''}`
                    }
                  }
                  
                  // Show notification
                  function showNotification(message) {
                    const notification = document.createElement('div')
                    notification.textContent = message
                    notification.style.cssText = `
                      position: fixed;
                      bottom: 20px;
                      right: 20px;
                      background: #10b981;
                      color: white;
                      padding: 12px 20px;
                      border-radius: 6px;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                      z-index: 2147483647;
                      font-family: system-ui;
                      font-size: 14px;
                      animation: slideIn 0.3s ease;
                    `
                    document.body.appendChild(notification)
                    setTimeout(() => notification.remove(), 3000)
                  }
                  
                  // Handle keyboard shortcuts
                  const handleKeyDown = (e) => {
                    // Undo shortcut (Ctrl/Cmd + Z)
                    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                      e.preventDefault()
                      performUndo()
                      return
                    }
                    
                    // Redo shortcut (Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z)
                    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                      e.preventDefault()
                      performRedo()
                      return
                    }
                    
                    // ESC to exit
                    if (e.key === 'Escape') {
                      // Send all changes to the sidebar before exiting
                      if (allChanges.length > 0 && !changesSent) {
                        console.log('[ABSmartly] Sending all changes to sidebar:', allChanges)
                        
                        // Convert changes to DOM change format for the sidebar
                        const domChanges = allChanges.map(change => {
                          let domChange = {
                            selector: change.selector,
                            timestamp: change.timestamp
                          }
                          
                          switch(change.type) {
                            case 'edit':
                              domChange.type = 'text'
                              domChange.value = change.newText
                              break
                            case 'editHtml':
                              domChange.type = 'html'
                              domChange.value = change.newHtml
                              break
                            case 'hide':
                              domChange.type = 'style'
                              domChange.property = 'display'
                              domChange.value = 'none'
                              break
                            case 'delete':
                              domChange.type = 'remove'
                              break
                            case 'duplicate':
                              domChange.type = 'duplicate'
                              break
                            case 'move':
                              domChange.type = 'move'
                              // Get the current element position to determine target
                              const elem = document.querySelector(domChange.selector)
                              if (elem && elem.parentElement) {
                                const parent = elem.parentElement
                                const nextSibling = elem.nextElementSibling
                                const prevSibling = elem.previousElementSibling
                                
                                // Determine target and position based on current location
                                if (nextSibling) {
                                  domChange.targetSelector = getSelector(nextSibling)
                                  domChange.position = 'before'
                                } else if (prevSibling) {
                                  domChange.targetSelector = getSelector(prevSibling)
                                  domChange.position = 'after'
                                } else {
                                  domChange.targetSelector = getSelector(parent)
                                  domChange.position = 'firstChild'
                                }
                              }
                              // Clean up internal tracking fields
                              delete domChange.direction
                              break
                            default:
                              domChange.type = change.type
                              domChange.data = change
                          }
                          
                          return domChange
                        })
                        
                        // Send all changes to extension
                        if (window.chrome && chrome.runtime) {
                          chrome.runtime.sendMessage({
                            type: 'VISUAL_EDITOR_COMPLETE',
                            variantName: variantName,
                            changes: domChanges,
                            totalChanges: allChanges.length
                          }, (response) => {
                            console.log('[ABSmartly] Changes sent to extension:', response)
                          })
                        }
                      }
                      
                      // Clean up
                      document.removeEventListener('mouseover', handleMouseOver)
                      document.removeEventListener('mouseout', handleMouseOut)
                      document.removeEventListener('click', handleClick, true)
                      document.removeEventListener('keydown', handleKeyDown)
                      
                      // Remove styles and banner
                      const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
                      if (bannerHost) bannerHost.remove()
                      
                      const styles = document.getElementById('absmartly-visual-editor-styles')
                      if (styles) styles.remove()
                      
                      // Remove menu host if open
                      const menuHost = document.getElementById('absmartly-menu-host')
                      if (menuHost) menuHost.remove()
                      
                      // Remove classes - use Array.from to ensure forEach is available
                      const hoverElements = document.querySelectorAll('.absmartly-hover')
                      Array.from(hoverElements).forEach(el => {
                        el.classList.remove('absmartly-hover')
                      })
                      
                      const selectedElements = document.querySelectorAll('.absmartly-selected')
                      Array.from(selectedElements).forEach(el => {
                        el.classList.remove('absmartly-selected')
                      })
                      
                      window.__absmartlyVisualEditorActive = false
                      console.log('[ABSmartly] Visual editor stopped with ' + allChanges.length + ' changes')
                    }
                  }
                  
                  // Helper function to get selector
                  function getSelector(element) {
                    // Check if ID exists and is not auto-generated
                    if (element.id && !isAutoGenerated(element.id)) {
                      return '#' + element.id
                    }
                    
                    // Check for semantic classes
                    if (element.className && typeof element.className === 'string') {
                      const classes = element.className.split(' ')
                        .filter(c => !c.includes('absmartly') && !isAutoGenerated(c))
                      
                      if (classes.length > 0) {
                        // Prefer shorter, likely human-readable classes
                        const semanticClasses = classes.filter(c => c.length < 20 && !c.match(/^[a-z]{1,3}-[a-f0-9]{6,}$/i))
                        if (semanticClasses.length > 0) {
                          return element.tagName.toLowerCase() + '.' + semanticClasses[0]
                        }
                      }
                    }
                    
                    // Build selector using parent chain if no good ID or class
                    let path = []
                    let current = element
                    
                    while (current && current !== document.body && path.length < 3) {
                      let selector = current.tagName.toLowerCase()
                      
                      // Check if this element has a good ID
                      if (current.id && !isAutoGenerated(current.id)) {
                        path.unshift('#' + current.id)
                        break
                      }
                      
                      // Add index if there are multiple siblings of same type
                      if (current.parentElement) {
                        const siblings = Array.from(current.parentElement.children)
                          .filter(child => child.tagName === current.tagName)
                        if (siblings.length > 1) {
                          const index = siblings.indexOf(current) + 1
                          selector += ':nth-of-type(' + index + ')'
                        }
                      }
                      
                      path.unshift(selector)
                      current = current.parentElement
                    }
                    
                    return path.join(' > ')
                  }
                  
                  // Helper function to check if string is auto-generated
                  function isAutoGenerated(str) {
                    if (!str) return false
                    
                    // Check for common auto-generated patterns
                    const patterns = [
                      /^framer-[a-zA-Z0-9]+$/,  // Framer classes
                      /^[a-z]{1,3}-[a-f0-9]{6,}$/i,  // Hash-based classes
                      /^css-[a-z0-9]+$/i,  // CSS modules
                      /^sc-[a-zA-Z0-9]+$/,  // Styled-components
                      /^[a-zA-Z0-9]{8,}$/,  // Long random strings
                      /^v-[a-f0-9]{8}$/,  // Vue scoped classes
                      /^svelte-[a-z0-9]+$/,  // Svelte classes
                      /^emotion-[0-9]+$/,  // Emotion CSS
                      /^chakra-/,  // Chakra UI
                      /^MuiBox-root/,  // Material-UI
                      /^[0-9]/  // Starts with number
                    ]
                    
                    return patterns.some(pattern => pattern.test(str))
                  }
                  
                  // Add event listeners
                  document.addEventListener('mouseover', handleMouseOver)
                  document.addEventListener('mouseout', handleMouseOut)
                  document.addEventListener('click', handleClick, true)
                  document.addEventListener('keydown', handleKeyDown)
                  
                  // Listen for postMessage from save button and immediately relay
                  window.addEventListener('message', (event) => {
                    if (event.data && event.data.source === 'absmartly-visual-editor' && event.data.type === 'VISUAL_EDITOR_COMPLETE') {
                      console.log('[ABSmartly] Received visual editor complete via postMessage:', event.data)
                      
                      // Clean up visual editor on save
                      const stopVisualEditor = () => {
                        document.removeEventListener('mouseover', handleMouseOver)
                        document.removeEventListener('mouseout', handleMouseOut)
                        document.removeEventListener('click', handleClick, true)
                        document.removeEventListener('keydown', handleKeyDown)
                        
                        // Remove visual elements
                        const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
                        if (bannerHost) bannerHost.remove()
                        
                        const menuHost = document.getElementById('absmartly-menu-host')
                        if (menuHost) menuHost.remove()
                        
                        const htmlEditorHost = document.getElementById('absmartly-html-editor-host')
                        if (htmlEditorHost) htmlEditorHost.remove()
                        
                        const styles = document.getElementById('absmartly-visual-editor-styles')
                        if (styles) styles.remove()
                        
                        // Clear selection
                        document.querySelectorAll('.absmartly-selected, .absmartly-hover').forEach(el => {
                          el.classList.remove('absmartly-selected', 'absmartly-hover')
                        })
                        
                        console.log('[ABSmartly] Visual editor stopped after save')
                      }
                      
                      // Stop the visual editor
                      stopVisualEditor()
                    }
                  })
                  
                  console.log('[ABSmartly] Visual editor is now active!')
                  return { success: true }
                },
                args: [message.variantName, message.changes],
                world: 'MAIN' // Run in main world to modify the page directly
              })
              
              debugLog('Inline injection result:', injectionResult)
              
              // Also inject a content script to relay messages from MAIN world to extension
              await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
                  console.log('[ABSmartly] Installing message relay listener')
                  
                  // Listen for postMessage from visual editor in MAIN world
                  window.addEventListener('message', (event) => {
                    if (event.data && event.data.source === 'absmartly-visual-editor' && event.data.type === 'VISUAL_EDITOR_COMPLETE') {
                      console.log('[ABSmartly Content] Relaying visual editor complete message:', event.data)
                      
                      // Send to background script
                      chrome.runtime.sendMessage({
                        type: 'VISUAL_EDITOR_COMPLETE',
                        variantName: event.data.variantName,
                        changes: event.data.changes,
                        totalChanges: event.data.totalChanges
                      }, (response) => {
                        console.log('[ABSmartly Content] Background response:', response)
                      })
                    }
                  })
                },
                world: 'ISOLATED' // Run in content script world to access chrome.runtime
              })
              
              debugLog('Message relay installed')
              sendResponse({ success: true, message: 'Visual editor started successfully' })
          } catch (error) {
            debugError('Failed to inject visual editor script:', error)
            sendResponse({ success: false, error: error.message || 'Failed to inject visual editor script' })
          }
        } else {
          debugError('No active tab found')
          sendResponse({ success: false, error: 'No active tab found' })
        }
      } catch (error) {
        debugError('Unexpected error in START_VISUAL_EDITOR handler:', error)
        sendResponse({ success: false, error: error.message || 'Unexpected error' })
      }
    })()
    
    return true // Will respond asynchronously
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
    // Handle request from SDK plugin for custom code injection
    debugLog('Background received REQUEST_INJECTION_CODE from SDK plugin')
    
    storage.get("absmartly-custom-code").then((customCode: CustomCode | null) => {
      if (customCode) {
        // Prepare injection data for SDK plugin
        const injectionData = {
          headStart: customCode.headStart || '',
          headEnd: customCode.headEnd || '',
          bodyStart: customCode.bodyStart || '',
          bodyEnd: customCode.bodyEnd || '',
          styleTag: customCode.styleTag || ''
        }
        
        debugLog('Sending custom code to SDK plugin:', injectionData)
        sendResponse({ 
          success: true, 
          data: injectionData 
        })
      } else {
        debugLog('No custom code configured')
        sendResponse({ 
          success: true, 
          data: {
            headStart: '',
            headEnd: '',
            bodyStart: '',
            bodyEnd: '',
            styleTag: ''
          }
        })
      }
    }).catch(error => {
      debugError('Error retrieving custom code:', error)
      sendResponse({ 
        success: false, 
        error: error.message 
      })
    })
    
    return true // Will respond asynchronously
  } else if (message.type === "CODE_EDITOR_SAVE" || message.type === "CODE_EDITOR_CLOSE") {
    // Forward these messages from content script to popup
    debugLog('Background forwarding message to popup:', message.type)
    
    // Send to all extension views (including popup)
    chrome.runtime.sendMessage(message)
    sendResponse({ success: true })
    
    return false
  }
})

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Check if visual editor should be active for this tab
    storage.get("visualEditorActive").then((active) => {
      if (active) {
        // Content script will be injected automatically by Plasmo
      }
    })
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
              const isCurrentlyVisible = !currentTransform || currentTransform === 'translateX(0px)' || currentTransform === 'translateX(0%)'
              
              // Toggle based on actual current state
              if (isCurrentlyVisible) {
                console.log('Hiding sidebar')
                // Hide sidebar
                existingSidebar.style.transform = 'translateX(100%)'
                
                // Restore original body margin
                const originalMargin = document.body.getAttribute('data-absmartly-original-margin-right')
                if (originalMargin !== null) {
                  document.body.style.marginRight = originalMargin
                  document.body.removeAttribute('data-absmartly-original-margin-right')
                }
                
                // Restore fixed elements
                const fixedElements = document.querySelectorAll('[data-absmartly-original-right]')
                fixedElements.forEach(el => {
                  const originalRight = el.getAttribute('data-absmartly-original-right')
                  if (originalRight !== null) {
                    ;(el as HTMLElement).style.right = originalRight
                    el.removeAttribute('data-absmartly-original-right')
                  }
                })
              } else {
                console.log('Showing sidebar')
                // Show sidebar
                existingSidebar.style.transform = 'translateX(0)'
                
                // Store and modify body margin
                const currentMargin = document.body.style.marginRight || '0px'
                document.body.setAttribute('data-absmartly-original-margin-right', currentMargin)
                document.body.style.marginRight = '384px'
                
                // Adjust fixed elements positioned with right: 0
                const fixedElements = document.querySelectorAll('*')
                fixedElements.forEach(el => {
                  const computedStyle = window.getComputedStyle(el)
                  if (computedStyle.position === 'fixed' && computedStyle.right === '0px') {
                    const htmlEl = el as HTMLElement
                    htmlEl.setAttribute('data-absmartly-original-right', htmlEl.style.right || '0px')
                    htmlEl.style.right = '384px'
                  }
                })
              }
              return
            }

            console.log('🔵 ABSmartly Extension: Injecting sidebar')

            // Store original body margin before modifying
            const originalMargin = document.body.style.marginRight || '0px'
            document.body.setAttribute('data-absmartly-original-margin-right', originalMargin)
            
            // Add transition to body for smooth animation
            const originalTransition = document.body.style.transition
            document.body.style.transition = 'margin-right 0.3s ease-in-out'
            
            // Set body margin to push content left
            document.body.style.marginRight = '384px'
            
            // Adjust fixed elements positioned with right: 0
            const fixedElements = document.querySelectorAll('*')
            fixedElements.forEach(el => {
              const computedStyle = window.getComputedStyle(el)
              if (computedStyle.position === 'fixed' && computedStyle.right === '0px') {
                const htmlEl = el as HTMLElement
                htmlEl.setAttribute('data-absmartly-original-right', htmlEl.style.right || '0px')
                htmlEl.style.right = '384px'
              }
            })

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

export {}