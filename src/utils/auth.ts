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
function buildAuthFetchOptions(
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
  controller: AbortController
): Promise<AuthCheckResult> {
  console.log('[auth.ts] About to parse JSON...')
  const responseData = await response.json()
  console.log('[auth.ts] JSON parsed, keys:', Object.keys(responseData || {}))

  // If we have a user but no avatar object, fetch full user details
  let finalUserData = responseData
  if (responseData.user && responseData.user.avatar_file_upload_id && !responseData.user.avatar) {
    console.log('[auth.ts] Need to fetch avatar, user has avatar_file_upload_id')
    try {
      // Fetching full user details to get avatar
      const userId = responseData.user.id
      const userDetailUrl = `${baseUrl}/v1/users/${userId}`
      console.log('[auth.ts] Fetching avatar from', userDetailUrl)

      const fullUserResponse = await fetch(userDetailUrl, {
        ...fetchOptions,
        signal: controller.signal
      })
      console.log('[auth.ts] Avatar fetch returned, status:', fullUserResponse.status)

      if (fullUserResponse.ok) {
        const fullUserData = await fullUserResponse.json()
        console.log('[auth.ts] Avatar response parsed')
        if (fullUserData && fullUserData.user && fullUserData.user.avatar) {
          finalUserData.user.avatar = fullUserData.user.avatar
          console.log('[auth.ts] Avatar data added to user')
        } else {
          console.log('[auth.ts] No avatar in response')
        }
      }
    } catch (avatarError) {
      console.log('[auth.ts] Avatar fetch error:', avatarError)
    }
  } else {
    console.log('[auth.ts] No avatar fetch needed')
  }

  // Return only essential user fields to minimize data transfer
  const userData = finalUserData.user
  if (userData) {
    const minimalUser = {
      id: userData.id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      picture: userData.picture,
      avatar: userData.avatar?.base_url ? { base_url: userData.avatar.base_url } : undefined
    }
    console.log('[auth.ts] Returning success with minimal user')
    return {
      success: true,
      data: { user: minimalUser }
    }
  }

  console.log('[auth.ts] Returning success with full data')
  return { success: true, data: finalUserData }
}

/**
 * Fetches an image from the API with proper authentication and returns a blob URL
 * @param url - Full URL to the image (should already include base URL)
 * @param config - ABsmartly config containing auth method and credentials
 * @returns Blob URL that can be used in img src, or null if fetch fails
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

    const response = await fetch(url, fetchOptions)

    if (response.ok) {
      const blob = await response.blob()
      return URL.createObjectURL(blob)
    }

    console.warn('[fetchAuthenticatedImage] Image fetch failed:', response.status, url)
    return null
  } catch (error) {
    console.error('[fetchAuthenticatedImage] Image fetch error:', error)
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
  console.log('[auth.ts] checkAuthentication ENTERED!')
  if (!config?.apiEndpoint) {
    return { success: false, error: 'No endpoint configured' }
  }

  const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
  const fullAuthUrl = `${baseUrl}/auth/current-user`

  console.log('[auth.ts] About to fetch from:', fullAuthUrl)
  debugLog('checkAuthentication: Fetching user from', fullAuthUrl)

  // Use ONLY the selected auth method - NO FALLBACKS
  const authMethod = config.authMethod || 'jwt'

  // For JWT, check if token exists
  let jwtToken: string | null = null
  if (authMethod === 'jwt') {
    console.log('[auth.ts] Calling getJWTCookie with endpoint:', config.apiEndpoint)
    jwtToken = await getJWTCookie(config.apiEndpoint)
    console.log('[auth.ts] getJWTCookie returned:', jwtToken ? `JWT token (length: ${jwtToken.length})` : 'null')

    if (!jwtToken) {
      console.log('[auth.ts] ⚠️ No JWT token found, returning early with error')
      debugLog('checkAuthentication: No JWT token available')
      return { success: false, error: 'No JWT token available' }
    }

    console.log('[auth.ts] ✅ JWT token found, proceeding with authentication')
  }

  // For API Key, validate it exists
  if (authMethod === 'apikey' && !config.apiKey) {
    debugLog('checkAuthentication: No API key configured')
    return { success: false, error: 'No API key configured' }
  }

  // Build fetch options - Strategy 1 for JWT (credentials only, no header)
  const fetchOptions = buildAuthFetchOptions(authMethod, config, jwtToken, false)

  try {
    console.log('[auth.ts] Making request with headers:', Object.keys(fetchOptions.headers || {}))
    console.log('[auth.ts] About to call fetch()...')

    // Add timeout controller to prevent hanging
    const controller = new AbortController()
    let timedOut = false
    const timeoutId = setTimeout(() => {
      console.log('[auth.ts] Timeout reached after 10s, aborting request...')
      timedOut = true
      controller.abort()
    }, 10000)
    console.log('[auth.ts] Timeout set for 10 seconds')

    try {
      console.log('[auth.ts] Strategy 1: Calling fetch() with credentials: include...')
      const userResponse = await fetch(fullAuthUrl, {
        ...fetchOptions,
        signal: controller.signal
      })
      console.log('[auth.ts] fetch() returned! Status:', userResponse.status, 'TimedOut:', timedOut)
      clearTimeout(timeoutId)
      console.log('[auth.ts] Timeout cleared')

      // If 401 and using JWT, try fallback strategy with Authorization header
      if (userResponse.status === 401 && authMethod === 'jwt' && jwtToken) {
        console.log('[auth.ts] Strategy 1 failed (401), trying Strategy 2: Authorization header...')

        // Build fetch options with Authorization header (Strategy 2)
        const fallbackOptions = buildAuthFetchOptions(authMethod, config, jwtToken, true)

        console.log('[auth.ts] Strategy 2: Using Authorization header with credentials: omit')
        const fallbackResponse = await fetch(fullAuthUrl, {
          ...fallbackOptions,
          signal: controller.signal
        })

        console.log('[auth.ts] Strategy 2 returned! Status:', fallbackResponse.status)

        if (!fallbackResponse.ok) {
          console.log('[auth.ts] Strategy 2 also failed:', fallbackResponse.status)
          return { success: false, error: 'Not authenticated' }
        }

        // Strategy 2 worked, use this response
        console.log('[auth.ts] Strategy 2 succeeded!')
        return await processFetchResponse(fallbackResponse, baseUrl, fallbackOptions, controller)
      }

      if (!userResponse.ok) {
        console.log('[auth.ts] Response not OK:', userResponse.status)
        return { success: false, error: 'Not authenticated' }
      }

      // Strategy 1 worked, process the response
      return await processFetchResponse(userResponse, baseUrl, fetchOptions, controller)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      console.log('[auth.ts] Fetch error caught:', fetchError.name, fetchError.message)
      if (fetchError.name === 'AbortError') {
        console.log('[auth.ts] Request timed out')
        return { success: false, error: 'Request timed out' }
      }
      throw fetchError
    }
  } catch (error: any) {
    console.log('[auth.ts] Outer error caught:', error)
    return { success: false, error: error.message || 'Auth check failed' }
  }
}
