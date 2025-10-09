import { debugLog, debugError } from './debug'
import { getJWTCookie } from './cookies'
import type { ABsmartlyConfig } from '~src/types/absmartly'

export interface AuthCheckResult {
  success: boolean
  data?: any
  error?: string
}

/**
 * Build fetch options with authentication headers
 * @param authMethod - 'jwt' or 'apikey'
 * @param config - ABsmartly configuration
 * @param jwtToken - JWT token value (required for JWT auth with header strategy)
 * @param useAuthHeader - For JWT: true = use Authorization header, false = use credentials only
 * @returns Fetch options with appropriate auth configuration
 */
export function buildAuthFetchOptions(
  authMethod: string,
  config: ABsmartlyConfig,
  jwtToken: string | null,
  useAuthHeader: boolean = false
): RequestInit {
  const fetchOptions: RequestInit = {
    method: 'GET',
    headers: {}
  }

  if (authMethod === 'jwt') {
    if (useAuthHeader && jwtToken) {
      // Strategy 2: Use Authorization header with JWT token
      fetchOptions.credentials = 'omit'
      fetchOptions.headers = {
        'Authorization': `JWT ${jwtToken}`
      }
      debugLog('buildAuthFetchOptions: JWT with Authorization header')
    } else {
      // Strategy 1: Use credentials to send cookies automatically
      fetchOptions.credentials = 'include'
      debugLog('buildAuthFetchOptions: JWT with credentials include')
    }
  } else if (authMethod === 'apikey') {
    // API Key authentication
    fetchOptions.credentials = 'omit'

    if (config.apiKey) {
      const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
        ? `JWT ${config.apiKey}`
        : `Api-Key ${config.apiKey}`

      fetchOptions.headers = {
        'Authorization': authHeader
      }
    }
    debugLog('buildAuthFetchOptions: API Key authentication')
  }

  return fetchOptions
}

/**
 * Process the fetch response and extract user data with avatar if needed
 */
async function processFetchResponse(
  response: Response,
  baseUrl: string,
  fetchOptions: RequestInit,
  controller: AbortController,
  config: ABsmartlyConfig
): Promise<AuthCheckResult> {
  const responseData = await response.json()

  // If we have a user but no avatar object, fetch full user details
  let finalUserData = responseData
  if (responseData.user && responseData.user.avatar_file_upload_id && !responseData.user.avatar) {
    try {
      // Fetching full user details to get avatar
      const userId = responseData.user.id
      const userDetailUrl = `${baseUrl}/v1/users/${userId}`

      const fullUserResponse = await fetch(userDetailUrl, {
        ...fetchOptions,
        signal: controller.signal
      })

      if (fullUserResponse.ok) {
        const fullUserData = await fullUserResponse.json()
        if (fullUserData && fullUserData.user && fullUserData.user.avatar) {
          finalUserData.user.avatar = fullUserData.user.avatar
        }
      }
    } catch (avatarError) {
      console.error('[Avatar] Error fetching avatar metadata:', avatarError)
    }
  }

  // Return only essential user fields to minimize data transfer
  const userData = finalUserData.user
  if (userData) {
    const minimalUser: any = {
      id: userData.id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      picture: userData.picture,
      avatar: userData.avatar?.base_url ? {
        base_url: userData.avatar.base_url,
        file_name: userData.avatar.file_name
      } : undefined
    }

    // If we have an avatar base_url, fetch the actual image as a data URL
    if (userData.avatar?.base_url && userData.avatar?.file_name) {
      const avatarUrl = `${baseUrl}${userData.avatar.base_url}/${userData.avatar.file_name}`

      // Create a proper config object with the auth method for fetchAuthenticatedImage
      const imageConfig = {
        apiEndpoint: baseUrl,
        authMethod: config.authMethod || 'jwt',
        apiKey: config.apiKey
      }

      const avatarDataUrl = await fetchAuthenticatedImage(avatarUrl, imageConfig as any)
      if (avatarDataUrl) {
        minimalUser.avatarDataUrl = avatarDataUrl
        console.log('[Avatar] Successfully fetched and converted avatar to data URL')
      } else {
        console.error('[Avatar] Failed to fetch avatar image')
      }
    }

    return {
      success: true,
      data: { user: minimalUser }
    }
  }

  return { success: true, data: finalUserData }
}

/**
 * Convert blob to base64 data URL
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Fetches an image from the API with proper authentication and returns a base64 data URL
 * @param url - Full URL to the image (should already include base URL)
 * @param config - ABsmartly config containing auth method and credentials
 * @returns Base64 data URL that can be used in img src, or null if fetch fails
 */
export async function fetchAuthenticatedImage(
  url: string,
  config: ABsmartlyConfig
): Promise<string | null> {
  try {
    const authMethod = config.authMethod || 'jwt'
    let jwtToken: string | null = null

    // For JWT, get the token
    if (authMethod === 'jwt') {
      jwtToken = await getJWTCookie(config.apiEndpoint)
    }

    // Build fetch options using our helper (use Strategy 1 for images too)
    const fetchOptions = buildAuthFetchOptions(authMethod, config, jwtToken, false)

    console.log('[Avatar] Fetching avatar from:', url)
    const response = await fetch(url, fetchOptions)

    if (response.ok) {
      const blob = await response.blob()
      const dataUrl = await blobToBase64(blob)
      console.log('[Avatar] Successfully converted to base64 data URL')
      return dataUrl
    }

    console.error('[Avatar] Image fetch failed:', response.status, url)
    return null
  } catch (error) {
    console.error('[Avatar] Image fetch error:', error)
    return null
  }
}

/**
 * Check authentication with ABsmartly API
 * Extracted from background.ts CHECK_AUTH handler for unit testing
 *
 * @param config - ABsmartly configuration with apiEndpoint, apiKey, and authMethod
 * @returns Promise with authentication result
 */
export async function checkAuthentication(config: ABsmartlyConfig): Promise<AuthCheckResult> {
  if (!config?.apiEndpoint) {
    return { success: false, error: 'No endpoint configured' }
  }

  const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
  const fullAuthUrl = `${baseUrl}/auth/current-user`

  // Use ONLY the selected auth method - NO FALLBACKS
  const authMethod = config.authMethod || 'jwt'

  // For JWT, check if token exists
  let jwtToken: string | null = null
  if (authMethod === 'jwt') {
    jwtToken = await getJWTCookie(config.apiEndpoint)

    if (!jwtToken) {
      return { success: false, error: 'No JWT token available' }
    }
  }

  // For API Key, validate it exists
  if (authMethod === 'apikey' && !config.apiKey) {
    return { success: false, error: 'No API key configured' }
  }

  // Build fetch options - Strategy 1 for JWT (credentials only, no header)
  const fetchOptions = buildAuthFetchOptions(authMethod, config, jwtToken, false)

  try {
    // Add timeout controller to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 10000)

    try {
      const userResponse = await fetch(fullAuthUrl, {
        ...fetchOptions,
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      // If 401 and using JWT, try fallback strategy with Authorization header
      if (userResponse.status === 401 && authMethod === 'jwt' && jwtToken) {
        // Build fetch options with Authorization header (Strategy 2)
        const fallbackOptions = buildAuthFetchOptions(authMethod, config, jwtToken, true)

        const fallbackResponse = await fetch(fullAuthUrl, {
          ...fallbackOptions,
          signal: controller.signal
        })

        if (!fallbackResponse.ok) {
          return { success: false, error: 'Not authenticated' }
        }

        // Strategy 2 worked, use this response
        return await processFetchResponse(fallbackResponse, baseUrl, fallbackOptions, controller, config)
      }

      if (!userResponse.ok) {
        return { success: false, error: 'Not authenticated' }
      }

      // Strategy 1 worked, process the response
      return await processFetchResponse(userResponse, baseUrl, fetchOptions, controller, config)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        return { success: false, error: 'Request timed out' }
      }
      throw fetchError
    }
  } catch (error: any) {
    console.error('Auth check error:', error)
    return { success: false, error: error.message || 'Auth check failed' }
  }
}
