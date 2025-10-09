import { debugLog, debugError } from './debug'
import { getJWTCookie } from './cookies'
import type { ABsmartlyConfig } from '~src/types/absmartly'

export interface AuthCheckResult {
  success: boolean
  data?: any
  error?: string
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

  // Build fetch options with auth headers
  // NOTE: Don't set 'mode' or unnecessary headers to avoid CORS preflight
  // With host_permissions, Chrome will handle CORS automatically
  const fetchOptions: RequestInit = {
    method: 'GET',
    headers: {}
  }

  // Use ONLY the selected auth method - NO FALLBACKS
  const authMethod = config.authMethod || 'jwt'

  if (authMethod === 'jwt') {
    // JWT authentication - use cookies
    fetchOptions.credentials = 'include'  // Send cookies for JWT

    const jwtToken = await getJWTCookie(config.apiEndpoint)
    if (!jwtToken) {
      debugLog('checkAuthentication: No JWT token available')
      return { success: false, error: 'No JWT token available' }
    }

    const authHeader = jwtToken.includes('.') && jwtToken.split('.').length === 3
      ? `JWT ${jwtToken}`
      : `Bearer ${jwtToken}`

    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Authorization': authHeader
    }
    debugLog('checkAuthentication: Using JWT authentication')
  } else if (authMethod === 'apikey') {
    // API Key authentication
    fetchOptions.credentials = 'omit'  // Don't send cookies for API Key

    if (!config.apiKey) {
      debugLog('checkAuthentication: No API key configured')
      return { success: false, error: 'No API key configured' }
    }

    const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
      ? `JWT ${config.apiKey}`
      : `Api-Key ${config.apiKey}`

    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Authorization': authHeader
    }
    debugLog('checkAuthentication: Using API key authentication')
  } else {
    return { success: false, error: `Unknown auth method: ${authMethod}` }
  }

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
      console.log('[auth.ts] Calling fetch() now...')
      const userResponse = await fetch(fullAuthUrl, {
        ...fetchOptions,
        signal: controller.signal
      })
      console.log('[auth.ts] fetch() returned! Status:', userResponse.status, 'TimedOut:', timedOut)
      clearTimeout(timeoutId)
      console.log('[auth.ts] Timeout cleared')

      if (!userResponse.ok) {
        console.log('[auth.ts] Response not OK:', userResponse.status)
        return { success: false, error: 'Not authenticated' }
      }

      console.log('[auth.ts] About to parse JSON...')
      const responseData = await userResponse.json()
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
