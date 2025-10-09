import axios from 'axios'
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
  if (!config?.apiEndpoint) {
    return { success: false, error: 'No endpoint configured' }
  }

  const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')

  try {
    // Try to get user info directly from /auth/current-user
    const fullAuthUrl = `${baseUrl}/auth/current-user`
    debugLog('checkAuthentication: Fetching user from', fullAuthUrl)

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
        debugLog('checkAuthentication: Using JWT authentication')
      } else if (config.apiKey) {
        // Fallback to API key if JWT not available
        authHeaders['Authorization'] = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
          ? `JWT ${config.apiKey}`
          : `Api-Key ${config.apiKey}`
        debugLog('checkAuthentication: Using API key as fallback')
      }
    } else if (config.apiKey) {
      // Try API key first
      authHeaders['Authorization'] = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
        ? `JWT ${config.apiKey}`
        : `Api-Key ${config.apiKey}`
      debugLog('checkAuthentication: Using API key authentication')
      debugLog('checkAuthentication: API key length:', config.apiKey?.length)
      debugLog('checkAuthentication: Authorization header:', authHeaders['Authorization']?.substring(0, 20) + '...')
    } else {
      // No API key, try JWT as fallback
      const jwtToken = await getJWTCookie(config.apiEndpoint)
      if (jwtToken) {
        authHeaders['Authorization'] = jwtToken.includes('.') && jwtToken.split('.').length === 3
          ? `JWT ${jwtToken}`
          : `Bearer ${jwtToken}`
        debugLog('checkAuthentication: Using JWT as fallback (no API key available)')
      }
    }

    try {
      debugLog('checkAuthentication: Making request to', fullAuthUrl)
      debugLog('checkAuthentication: With headers:', Object.keys(authHeaders))

      const userResponse = await axios.get(fullAuthUrl, {
        withCredentials: false,
        headers: authHeaders
      })

      debugLog('checkAuthentication: Response received, status:', userResponse.status)
      debugLog('checkAuthentication: Response data keys:', Object.keys(userResponse.data || {}))

      // Auth response received from /auth/current-user

      // If we have a user but no avatar object, fetch full user details
      let finalUserData = userResponse.data
      if (userResponse.data.user && userResponse.data.user.avatar_file_upload_id && !userResponse.data.user.avatar) {
        try {
          // Fetching full user details to get avatar
          const userId = userResponse.data.user.id
          const userDetailUrl = `${baseUrl}/v1/users/${userId}`
          debugLog('checkAuthentication: Fetching avatar from', userDetailUrl)

          const fullUserResponse = await axios.get(userDetailUrl, {
            withCredentials: false,
            headers: authHeaders
          })

          if (fullUserResponse.data && fullUserResponse.data.user && fullUserResponse.data.user.avatar) {
            finalUserData.user.avatar = fullUserResponse.data.user.avatar
            debugLog('checkAuthentication: Successfully fetched avatar data')
          } else {
            debugLog('checkAuthentication: No avatar found in user response')
          }
        } catch (avatarError) {
          debugLog('checkAuthentication: Could not fetch full user details for avatar:', avatarError)
        }
      }

      return { success: true, data: finalUserData }
    } catch (authError: any) {
      debugError('checkAuthentication: Auth request failed:', authError.response?.status, authError.message)

      // If first attempt failed with API key, try with JWT
      if (authError.response?.status === 401 && config.apiKey && !shouldTryJwtFirst) {
        debugLog('checkAuthentication: API key failed (401), trying JWT fallback')
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

            debugLog('checkAuthentication: JWT fallback successful')

            return { success: true, data: retryResponse.data }
          } catch (retryError) {
            debugLog('checkAuthentication: JWT also failed')
            return { success: false, error: 'Not authenticated' }
          }
        } else {
          return { success: false, error: 'Not authenticated' }
        }
      } else {
        debugLog('checkAuthentication: Authentication failed:', authError.response?.status)
        return { success: false, error: 'Not authenticated' }
      }
    }
  } catch (error: any) {
    debugError('checkAuthentication: Unexpected error:', error)
    return { success: false, error: error.message || 'Auth check failed' }
  }
}
