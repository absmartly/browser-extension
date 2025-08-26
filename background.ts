import { Storage } from "@plasmohq/storage"
import axios from 'axios'
import type { ABSmartlyConfig } from '~src/types/absmartly'

// Storage instance
const storage = new Storage()

// Initialize config with environment variables on startup
async function initializeConfig() {
  console.log('[Background] Initializing config...')
  
  // Get current config from storage
  const storedConfig = await storage.get("absmartly-config") as ABSmartlyConfig | null
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
  const newConfig: ABSmartlyConfig = {
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
async function getConfig(): Promise<ABSmartlyConfig | null> {
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

// Helper function to make API requests
async function makeAPIRequest(method: string, path: string, data?: any) {
  const config = await getConfig()
  if (!config?.apiEndpoint) {
    throw new Error('No API endpoint configured')
  }

  const headers: any = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  // Only add Authorization header if API key is provided
  if (config.apiKey) {
    const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
      ? `JWT ${config.apiKey}`
      : `Api-Key ${config.apiKey}`
    headers['Authorization'] = authHeader
  }

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

  console.log('Making axios request:', { method, url, requestData, hasCredentials: !config.apiKey })

  try {
    const response = await axios({
      method,
      url,
      data: requestData,
      headers,
      withCredentials: !config.apiKey // Use cookies if no API key
    })

    return response.data
  } catch (error) {
    console.error('Axios request failed:', error)
    console.error('Request details:', { method, url, requestData, headers })
    if (error.response) {
      console.error('Response status:', error.response.status)
      console.error('Response data:', error.response.data)
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
    // Special handler for auth check
    getConfig().then(async config => {
      if (!config?.apiEndpoint) {
        sendResponse({ success: false, error: 'No endpoint configured' })
        return
      }
      
      const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
      
      try {
        // Try multiple auth endpoints to check authentication status
        // First, try the experiments endpoint which we know works if auth is valid
        const experimentsResponse = await makeAPIRequest('GET', '/experiments', { limit: 1 })
        
        if (experimentsResponse) {
          // If we can get experiments, we're authenticated
          // Try to get user info from /auth/current-user endpoint
          try {
            const headers: any = {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
            
            // Add authorization if API key exists
            if (config.apiKey) {
              const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
                ? `JWT ${config.apiKey}`
                : `Api-Key ${config.apiKey}`
              headers['Authorization'] = authHeader
            }
            
            const userResponse = await axios.get(`${baseUrl}/auth/current-user`, {
              withCredentials: !config.apiKey,
              headers
            })
            
            console.log('Auth response from /auth/current-user:', userResponse.data)
            
            // If we have a user but no avatar object, fetch full user details
            let finalUserData = userResponse.data
            if (userResponse.data.user && userResponse.data.user.avatar_file_upload_id && !userResponse.data.user.avatar) {
              try {
                console.log('Fetching full user details to get avatar...')
                const fullUserResponse = await makeAPIRequest('GET', `/users/${userResponse.data.user.id}`)
                console.log('Full user response:', fullUserResponse)
                if (fullUserResponse && fullUserResponse.user && fullUserResponse.user.avatar) {
                  finalUserData.user.avatar = fullUserResponse.user.avatar
                  console.log('Successfully fetched avatar data:', fullUserResponse.user.avatar)
                } else {
                  console.log('No avatar found in user response')
                }
              } catch (avatarError) {
                console.log('Could not fetch full user details for avatar:', avatarError)
              }
            }
            
            sendResponse({ success: true, data: finalUserData })
          } catch (userError) {
            // If current-user fails but experiments work, create a basic authenticated response
            console.log('Could not get user info, but experiments work - user is authenticated')
            sendResponse({ 
              success: true, 
              data: {
                authenticated: true,
                email: 'Authenticated User',
                id: 'authenticated'
              }
            })
          }
        } else {
          sendResponse({ success: false, error: 'Not authenticated' })
        }
      } catch (error) {
        console.error('Auth check error:', error)
        const isAuth = error.message === 'AUTH_EXPIRED' || isAuthError(error)
        sendResponse({ 
          success: false, 
          error: error.message,
          isAuthError: isAuth
        })
      }
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

export {}