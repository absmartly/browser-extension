import { Storage } from "@plasmohq/storage"
import axios from 'axios'
import type { ABsmartlyConfig } from '~src/types/absmartly'

// Storage instance
const storage = new Storage()

// Handle storage operations from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'STORAGE_GET') {
    const sessionStorage = new Storage({ area: "session" })
    sessionStorage.get(message.key).then(value => {
      console.log('[Background] Storage GET:', message.key, '=', value)
      sendResponse({ success: true, value })
    }).catch(error => {
      console.error('[Background] Storage GET error:', error)
      sendResponse({ success: false, error: error.message })
    })
    return true // Keep the message channel open for async response
  } else if (message.type === 'STORAGE_SET') {
    const sessionStorage = new Storage({ area: "session" })
    sessionStorage.set(message.key, message.value).then(() => {
      console.log('[Background] Storage SET:', message.key, '=', message.value)
      sendResponse({ success: true })
    }).catch(error => {
      console.error('[Background] Storage SET error:', error)
      sendResponse({ success: false, error: error.message })
    })
    return true // Keep the message channel open for async response
  }
})

// Initialize config with environment variables on startup
async function initializeConfig() {
  console.log('[Background] Initializing config...')
  
  // Get current config from storage
  const storedConfig = await storage.get("absmartly-config") as ABsmartlyConfig | null
  console.log('[Background] Stored config:', storedConfig)
  
  // Check if we have environment variables
  const envApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
  const envApiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT
  const envApplicationId = process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_ID
  
  console.log('[Background] Environment variables:', {
    hasApiKey: !!envApiKey,
    apiEndpoint: envApiEndpoint,
    applicationId: envApplicationId
  })
  
  // Only update if we have env vars and stored values are empty
  let updated = false
  const newConfig: ABsmartlyConfig = {
    apiKey: storedConfig?.apiKey || '',
    apiEndpoint: storedConfig?.apiEndpoint || '',
    applicationId: storedConfig?.applicationId
  }
  
  if (!newConfig.apiKey && envApiKey) {
    newConfig.apiKey = envApiKey
    updated = true
    console.log('[Background] Using API key from environment')
  }
  
  if (!newConfig.apiEndpoint && envApiEndpoint) {
    newConfig.apiEndpoint = envApiEndpoint
    updated = true
    console.log('[Background] Using API endpoint from environment')
  }
  
  if (!newConfig.applicationId && envApplicationId) {
    newConfig.applicationId = parseInt(envApplicationId)
    updated = true
    console.log('[Background] Using application ID from environment')
  }
  
  // Save updated config if we made changes
  if (updated) {
    await storage.set("absmartly-config", newConfig)
    console.log('[Background] Updated config with environment variables:', newConfig)
  } else {
    console.log('[Background] No updates needed from environment variables')
  }
}

// Initialize on startup
initializeConfig().catch(console.error)

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
    // Remove protocol and path from domain
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    console.log('Looking for JWT cookie for domain:', cleanDomain)
    
    // Try to get ALL cookies for the URL to see what's available
    const url = domain.startsWith('http') ? domain : `https://${domain}`
    const allCookiesForUrl = await chrome.cookies.getAll({ 
      url: url 
    })
    
    console.log(`Found ${allCookiesForUrl.length} cookies for URL ${url}`)
    // Only log JWT cookie if found
    const jwtPreview = allCookiesForUrl.find(c => c.name.toLowerCase() === 'jwt')
    if (jwtPreview) {
      console.log(`  - jwt cookie found (length: ${jwtPreview.value.length})`)
    }
    
    // Look for JWT cookie - check common ABsmartly cookie names first
    const jwtCookie = allCookiesForUrl.find(cookie => 
      cookie.name === 'jwt' || // ABsmartly uses 'jwt' cookie name
      cookie.name === 'JWT' ||
      cookie.name.toLowerCase().includes('jwt') ||
      cookie.name.toLowerCase().includes('token') ||
      cookie.name.toLowerCase() === 'auth' ||
      cookie.name === 'absmartly_jwt' ||
      cookie.name === 'session' // Sometimes session cookies contain JWT
    )
    
    if (jwtCookie) {
      console.log('Found JWT cookie:', jwtCookie.name, 'value length:', jwtCookie.value.length)
      return jwtCookie.value
    }
    
    // Try domain-based search as fallback
    const cookies = await chrome.cookies.getAll({ 
      domain: cleanDomain 
    })
    
    console.log(`Found ${cookies.length} cookies for domain ${cleanDomain}`)
    
    const domainJwtCookie = cookies.find(cookie => 
      cookie.name === 'jwt' ||
      cookie.name === 'JWT' ||
      cookie.name.toLowerCase().includes('jwt') ||
      cookie.name.toLowerCase().includes('token') ||
      cookie.name.toLowerCase() === 'auth'
    )
    
    if (domainJwtCookie) {
      console.log('Found JWT cookie from domain search:', domainJwtCookie.name)
      return domainJwtCookie.value
    }
    
    // Also try with base domain (remove subdomains)
    const baseDomain = cleanDomain.split('.').slice(-2).join('.')
    if (baseDomain !== cleanDomain) {
      const baseCookies = await chrome.cookies.getAll({ 
        domain: `.${baseDomain}` // Leading dot for domain cookies
      })
      
      console.log(`Found ${baseCookies.length} cookies for base domain .${baseDomain}`)
      
      const baseJwtCookie = baseCookies.find(cookie => 
        cookie.name === 'jwt' ||
        cookie.name === 'JWT' ||
        cookie.name.toLowerCase().includes('jwt') ||
        cookie.name.toLowerCase().includes('token') ||
        cookie.name.toLowerCase() === 'auth'
      )
      
      if (baseJwtCookie) {
        console.log('Found JWT cookie from base domain:', baseJwtCookie.name)
        return baseJwtCookie.value
      }
    }
    
    console.log('No JWT cookie found for domain:', cleanDomain)
    return null
  } catch (error) {
    console.error('Error getting JWT cookie:', error)
    return null
  }
}

// Helper function to make API requests with automatic JWT fallback
async function makeAPIRequest(method: string, path: string, data?: any, retryWithJWT: boolean = true) {
  console.log('=== makeAPIRequest called ===', { method, path, data })
  
  const config = await getConfig()
  console.log('Config loaded:', { 
    hasApiKey: !!config?.apiKey, 
    apiEndpoint: config?.apiEndpoint,
    apiKeyLength: config?.apiKey?.length || 0
  })
  
  if (!config?.apiEndpoint) {
    throw new Error('No API endpoint configured')
  }

  // Check if we have a cached preference for auth method
  const authPreference = await storage.get('auth-method-preference')
  const shouldTryJwtFirst = authPreference === 'jwt' && !config.apiKey?.startsWith('new-') // Don't use JWT first if user just entered a new key
  
  // Helper to build headers
  const buildHeaders = async (useApiKey: boolean = true) => {
    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    // If we know JWT works better, try it first
    if (shouldTryJwtFirst && useApiKey) {
      console.log('Preferring JWT based on previous success...')
      const jwtToken = await getJWTCookie(config.apiEndpoint)
      if (jwtToken) {
        if (jwtToken.includes('.') && jwtToken.split('.').length === 3) {
          headers['Authorization'] = `JWT ${jwtToken}`
        } else {
          headers['Authorization'] = `Bearer ${jwtToken}`
        }
        console.log('Using cached JWT preference')
        return headers
      }
      console.log('JWT not available, falling back to API key')
    }

    // Try API key if available and we haven't disabled it
    if (config.apiKey && useApiKey && !shouldTryJwtFirst) {
      console.log('Using API key for auth')
      const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
        ? `JWT ${config.apiKey}`
        : `Api-Key ${config.apiKey}`
      headers['Authorization'] = authHeader
    } else if (!config.apiKey || !useApiKey) {
      // Try to get JWT from cookies
      console.log('Attempting to get JWT from cookies...')
      const jwtToken = await getJWTCookie(config.apiEndpoint)
      console.log('JWT cookie result:', jwtToken ? `Found (length: ${jwtToken.length})` : 'Not found')
      
      if (jwtToken) {
        // Determine if it's already a full JWT or just the token
        if (jwtToken.includes('.') && jwtToken.split('.').length === 3) {
          headers['Authorization'] = `JWT ${jwtToken}`
        } else {
          headers['Authorization'] = `Bearer ${jwtToken}`
        }
        console.log('Using JWT from cookie for authentication')
      } else {
        console.log('No JWT cookie available')
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

  console.log('Making axios request:', { 
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
    console.error('Request failed:', error.response?.status, error.response?.data)
    
    // If we got a 401 and we were using an API key, retry with JWT from cookies
    if (isAuthError(error) && config.apiKey && retryWithJWT && headers.Authorization?.startsWith('Api-Key')) {
      console.log('API key auth failed (401), retrying with JWT cookie...')
      
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
        
        console.log('Retrying with JWT authorization:', newHeaders.Authorization)
        
        // Make the request directly with new headers, don't recurse
        try {
          const response = await axios({
            method,
            url,
            data: requestData,
            headers: newHeaders,
            withCredentials: false
          })
          
          console.log('JWT fallback successful!')
          // Cache that JWT works better than API key
          await storage.set('auth-method-preference', 'jwt')
          
          return response.data
        } catch (jwtError) {
          console.error('JWT fallback also failed:', jwtError.response?.status)
          throw new Error('AUTH_EXPIRED')
        }
      } else {
        console.log('No JWT cookie available for retry')
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
  if (message.type === "TOGGLE_VISUAL_EDITOR") {
    // Forward to content script in active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, message)
      }
    })
  } else if (message.type === "ELEMENT_SELECTED") {
    // Element picker returned a selector
    console.log('Background received ELEMENT_SELECTED:', message)
    
    if (message.reopenPopup) {
      // Store the result using Plasmo Storage for cross-browser compatibility
      const sessionStorage = new Storage({ area: "session" })
      
      // Get the current state to find out which field we were picking for
      sessionStorage.get('domChangesInlineState').then(async (state) => {
        if (state && state.pickingForField) {
          console.log('Storing element picker result for field:', state.pickingForField)
          
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
    console.log('Background received API_REQUEST:', { method: message.method, path: message.path, data: message.data })
    
    makeAPIRequest(message.method, message.path, message.data)
      .then(data => {
        console.log('Background API request successful')
        sendResponse({ success: true, data })
      })
      .catch(error => {
        console.error('Background API request failed:', error)
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
        console.log('CHECK_AUTH: Fetching user from', fullAuthUrl)
        
        // Build auth headers
        const authHeaders: any = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
        
        // Check cached auth preference
        const authPreference = await storage.get('auth-method-preference')
        const shouldTryJwtFirst = authPreference === 'jwt'
        
        if (shouldTryJwtFirst) {
          // Try JWT first if we know it works
          const jwtToken = await getJWTCookie(config.apiEndpoint)
          if (jwtToken) {
            authHeaders['Authorization'] = jwtToken.includes('.') && jwtToken.split('.').length === 3
              ? `JWT ${jwtToken}`
              : `Bearer ${jwtToken}`
            console.log('CHECK_AUTH: Using JWT from preference')
          }
        } else if (config.apiKey) {
          // Try API key first
          authHeaders['Authorization'] = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
            ? `JWT ${config.apiKey}`
            : `Api-Key ${config.apiKey}`
          console.log('CHECK_AUTH: Using API key')
        } else {
          // No API key, try JWT
          const jwtToken = await getJWTCookie(config.apiEndpoint)
          if (jwtToken) {
            authHeaders['Authorization'] = jwtToken.includes('.') && jwtToken.split('.').length === 3
              ? `JWT ${jwtToken}`
              : `Bearer ${jwtToken}`
            console.log('CHECK_AUTH: Using JWT (no API key available)')
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
                console.log('Could not fetch full user details for avatar:', avatarError)
              }
            }
            
            sendResponse({ success: true, data: finalUserData })
        } catch (authError) {
          // If first attempt failed with API key, try with JWT
          if (authError.response?.status === 401 && config.apiKey && !shouldTryJwtFirst) {
            console.log('CHECK_AUTH: API key failed, trying JWT fallback')
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
                
                // Cache that JWT works better
                await storage.set('auth-method-preference', 'jwt')
                console.log('CHECK_AUTH: JWT fallback successful')
                
                sendResponse({ success: true, data: retryResponse.data })
              } catch (retryError) {
                console.log('CHECK_AUTH: JWT also failed')
                sendResponse({ success: false, error: 'Not authenticated' })
              }
            } else {
              sendResponse({ success: false, error: 'Not authenticated' })
            }
          } else {
            console.log('CHECK_AUTH: Authentication failed:', authError.response?.status)
            sendResponse({ success: false, error: 'Not authenticated' })
          }
        }
      } catch (error) {
        console.error('Auth check error:', error)
        sendResponse({ success: false, error: error.message || 'Auth check failed' })
      }
    }).catch(error => {
      console.error('Config error:', error)
      sendResponse({ success: false, error: 'Failed to get config' })
    })
    return true // Will respond asynchronously
  } else if (message.type === "START_VISUAL_EDITOR") {
    // Forward visual editor command to content script in active tab
    console.log('===============================================')
    console.log('Background received START_VISUAL_EDITOR:', message)
    console.log('===============================================')
    
    // Handle async properly
    ;(async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tabs[0]?.id) {
          const tabId = tabs[0].id
          const tabUrl = tabs[0].url
          
          console.log('Attempting to start visual editor on tab:', tabId, 'URL:', tabUrl)
          
          // Check if this is a restricted URL
          if (tabUrl?.startsWith('chrome://') || 
              tabUrl?.startsWith('chrome-extension://') || 
              tabUrl?.startsWith('edge://') ||
              tabUrl?.startsWith('about:')) {
            console.error('Cannot inject content script on restricted URL:', tabUrl)
            sendResponse({ success: false, error: 'Cannot use visual editor on browser pages' })
            return
          }
          
          // First, try to send message to see if content script is loaded
          let contentScriptReady = false
          try {
            await chrome.tabs.sendMessage(tabId, { type: 'GET_VISUAL_EDITOR_STATUS' })
            contentScriptReady = true
            console.log('Content script is already loaded')
          } catch (error) {
            console.log('Content script not loaded, will inject it')
            console.log('Error was:', error)
          }
          
          if (!contentScriptReady) {
            // Content script not loaded, inject it
            console.log('Injecting visual-editor script...')
            
            try {
              // First, try injecting a simple inline script to set up the visual editor
              console.log('Injecting inline visual editor script...')
              
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
                  
                  // Create visual editor banner
                  const existingBanner = document.getElementById('absmartly-visual-editor-banner')
                  if (existingBanner) existingBanner.remove()
                  
                  const banner = document.createElement('div')
                  banner.id = 'absmartly-visual-editor-banner'
                  banner.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(90deg, #3b82f6, #10b981);
                    color: white;
                    padding: 10px;
                    z-index: 2147483647;
                    text-align: center;
                    font-family: system-ui, -apple-system, sans-serif;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                  `
                  banner.innerHTML = `
                    <div>🎨 ABSmartly Visual Editor Active - Variant: ${variantName}</div>
                    <div style="font-size: 12px; margin-top: 5px;">Click any element to edit • Press ESC to exit</div>
                  `
                  document.body.appendChild(banner)
                  
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
                  `
                  document.head.appendChild(style)
                  
                  // Track selected element
                  let selectedElement = null
                  let isEditing = false
                  
                  // Add hover effect
                  const handleMouseOver = (e) => {
                    if (isEditing) return
                    const target = e.target
                    if (target.id !== 'absmartly-visual-editor-banner' && !target.closest('#absmartly-visual-editor-banner')) {
                      target.classList.add('absmartly-hover')
                    }
                  }
                  
                  const handleMouseOut = (e) => {
                    if (isEditing) return
                    e.target.classList.remove('absmartly-hover')
                  }
                  
                  // Handle element click
                  const handleClick = (e) => {
                    const target = e.target
                    
                    // Ignore clicks on our UI
                    if (target.id === 'absmartly-visual-editor-banner' || target.closest('#absmartly-visual-editor-banner')) {
                      return
                    }
                    
                    e.preventDefault()
                    e.stopPropagation()
                    
                    // Remove previous selection
                    if (selectedElement) {
                      selectedElement.classList.remove('absmartly-selected')
                    }
                    
                    // Select new element
                    selectedElement = target
                    target.classList.remove('absmartly-hover')
                    target.classList.add('absmartly-selected')
                    
                    // Make it editable
                    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                      target.contentEditable = 'true'
                      target.focus()
                      isEditing = true
                      
                      // Listen for when editing ends
                      const handleBlur = () => {
                        target.contentEditable = 'false'
                        isEditing = false
                        target.removeEventListener('blur', handleBlur)
                        
                        // Log the change
                        console.log('[ABSmartly] Element edited:', {
                          selector: getSelector(target),
                          newText: target.textContent
                        })
                      }
                      
                      target.addEventListener('blur', handleBlur)
                    }
                  }
                  
                  // Handle ESC key
                  const handleKeyDown = (e) => {
                    if (e.key === 'Escape') {
                      // Clean up
                      document.removeEventListener('mouseover', handleMouseOver)
                      document.removeEventListener('mouseout', handleMouseOut)
                      document.removeEventListener('click', handleClick, true)
                      document.removeEventListener('keydown', handleKeyDown)
                      
                      // Remove styles and banner
                      document.getElementById('absmartly-visual-editor-banner')?.remove()
                      document.getElementById('absmartly-visual-editor-styles')?.remove()
                      
                      // Remove classes
                      document.querySelectorAll('.absmartly-hover').forEach(el => {
                        el.classList.remove('absmartly-hover')
                      })
                      document.querySelectorAll('.absmartly-selected').forEach(el => {
                        el.classList.remove('absmartly-selected')
                      })
                      
                      (window as any).__absmartlyVisualEditorActive = false
                      console.log('[ABSmartly] Visual editor stopped')
                    }
                  }
                  
                  // Helper function to get selector
                  function getSelector(element) {
                    if (element.id) return '#' + element.id
                    if (element.className && typeof element.className === 'string') {
                      const classes = element.className.split(' ').filter(c => !c.includes('absmartly'))
                      if (classes.length) return '.' + classes.join('.')
                    }
                    return element.tagName.toLowerCase()
                  }
                  
                  // Add event listeners
                  document.addEventListener('mouseover', handleMouseOver)
                  document.addEventListener('mouseout', handleMouseOut)
                  document.addEventListener('click', handleClick, true)
                  document.addEventListener('keydown', handleKeyDown)
                  
                  console.log('[ABSmartly] Visual editor is now active!')
                  return { success: true }
                },
                args: [message.variantName, message.changes],
                world: 'MAIN' // Run in main world to modify the page directly
              })
              
              console.log('Inline injection result:', injectionResult)
              
              // The visual editor is now running inline, no need to send messages
              sendResponse({ success: true, message: 'Visual editor started successfully' })
            } catch (error) {
              console.error('Failed to inject visual editor script:', error)
              sendResponse({ success: false, error: 'Failed to inject visual editor script' })
            }
          } else {
            // Content script already loaded, send the message directly
            console.log('Content script already loaded, starting visual editor...')
            
            try {
              const response = await chrome.tabs.sendMessage(tabId, {
                type: 'START_VISUAL_EDITOR',
                variantName: message.variantName,
                changes: message.changes
              })
              
              console.log('Visual editor started successfully')
              sendResponse({ success: true })
            } catch (error) {
              console.error('Error starting visual editor:', error)
              sendResponse({ success: false, error: error.message || 'Failed to start visual editor' })
            }
          }
        } else {
          console.error('No active tab found')
          sendResponse({ success: false, error: 'No active tab found' })
        }
      } catch (error) {
        console.error('Unexpected error in START_VISUAL_EDITOR handler:', error)
        sendResponse({ success: false, error: error.message || 'Unexpected error' })
      }
    })()
    
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
        console.error('Avatar fetch error:', error)
        sendResponse({ success: false, error: error.message })
      })
    })
    return true // Will respond asynchronously
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
  console.log('[Background] Extension icon clicked for tab:', tab.id)
  
  if (tab.id && tab.url) {
    // Don't inject on chrome:// or other restricted URLs
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('edge://') || 
        tab.url.startsWith('about:') ||
        tab.url.startsWith('chrome-extension://')) {
      console.log('[Background] Cannot inject sidebar on restricted URL:', tab.url)
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
                existingSidebar.style.transform = 'translateX(100%)'
              } else {
                console.log('Showing sidebar')
                existingSidebar.style.transform = 'translateX(0)'
              }
              return
            }

            console.log('🔵 ABSmartly Extension: Injecting sidebar')

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
      console.error('[Background] Failed to inject sidebar:', error)
    }
  }
})

export {}