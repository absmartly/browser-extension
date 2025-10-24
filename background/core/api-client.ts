import { Storage } from "@plasmohq/storage"
import axios, { AxiosError } from 'axios'
import { z } from 'zod'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { debugLog, debugError } from '~src/utils/debug'
import { getConfig as getConfigWithStorages } from './config-manager'

// Create storage instances for API client
const storage = new Storage()
const secureStorage = new Storage({
  area: "local",
  secretKeyring: true
} as any)

/**
 * Gets configuration from storage
 * @returns The configuration or null if not found
 */
async function getConfig(): Promise<ABsmartlyConfig | null> {
  return getConfigWithStorages(storage, secureStorage)
}

const APIRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']),
  path: z.string().min(1),
  data: z.any().optional()
})

/**
 * Checks if an error is authentication related (401 or 403)
 * @param error - The error to check
 * @returns True if the error is an authentication error
 */
export function isAuthError(error: any): boolean {
  return error.response?.status === 401 || error.response?.status === 403
}

/**
 * Gets JWT cookie for a domain
 * @param domain - The domain to get the JWT cookie from
 * @returns The JWT token or null if not found
 */
export async function getJWTCookie(domain: string): Promise<string | null> {
  try {
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

    const urlCookies = await chrome.cookies.getAll({ url: baseUrl })

    const domainParts = hostname.split('.')
    const baseDomain = domainParts.length > 2
      ? domainParts.slice(-2).join('.')
      : hostname

    const domainCookies = await chrome.cookies.getAll({ domain: baseDomain })
    const dotDomainCookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })

    const allCookies = [...urlCookies, ...domainCookies, ...dotDomainCookies]
    const uniqueCookies = Array.from(new Map(allCookies.map(c => [`${c.name}-${c.value}`, c])).values())

    let jwtCookie = uniqueCookies.find(cookie =>
      cookie.name === 'jwt' ||
      cookie.name === 'JWT' ||
      cookie.name === 'access_token' ||
      cookie.name === 'auth_token' ||
      cookie.name === 'authorization'
    )

    if (!jwtCookie) {
      jwtCookie = uniqueCookies.find(cookie => {
        const value = cookie.value
        return value && value.includes('.') && value.split('.').length === 3
      })
    }

    if (jwtCookie) {
      return jwtCookie.value
    }

    return null
  } catch (error) {
    debugError('Error getting JWT cookie:', error)
    return null
  }
}

/**
 * Opens the ABsmartly login page if user is not authenticated
 * @param config - ABsmartly configuration (optional, will load from storage if not provided)
 * @returns Result indicating if user is authenticated
 */
export async function openLoginPage(config?: ABsmartlyConfig | null): Promise<{ authenticated: boolean }> {
  const actualConfig = config || await getConfig()

  if (!actualConfig?.apiEndpoint) {
    return { authenticated: false }
  }

  const baseUrl = actualConfig.apiEndpoint.replace(/\/v1$/, '')

  try {
    const response = await makeAPIRequest('GET', '/auth/current-user', undefined, false, actualConfig)

    if (response) {
      debugLog('User is already authenticated')
      return { authenticated: true }
    }
  } catch (error) {
    debugLog('Auth check failed, user needs to login:', error)
  }

  chrome.tabs.create({ url: baseUrl })
  return { authenticated: false }
}

/**
 * Builds request headers with authentication
 * @param config - ABsmartly configuration
 * @param useApiKey - Whether to use API key (for fallback)
 * @returns Headers object
 */
async function buildHeaders(config: ABsmartlyConfig, useApiKey: boolean = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  const authMethod = config.authMethod || 'jwt'
  const shouldTryJwtFirst = authMethod === 'jwt'

  if (shouldTryJwtFirst) {
    const jwtToken = await getJWTCookie(config.apiEndpoint)

    if (jwtToken) {
      if (jwtToken.includes('.') && jwtToken.split('.').length === 3) {
        headers['Authorization'] = `JWT ${jwtToken}`
      } else {
        headers['Authorization'] = `Bearer ${jwtToken}`
      }
    }
    return headers
  } else {
    if (config.apiKey && useApiKey) {
      const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
        ? `JWT ${config.apiKey}`
        : `Api-Key ${config.apiKey}`
      headers['Authorization'] = authHeader
    } else if (!config.apiKey) {
      const jwtToken = await getJWTCookie(config.apiEndpoint)
      if (jwtToken) {
        if (jwtToken.includes('.') && jwtToken.split('.').length === 3) {
          headers['Authorization'] = `JWT ${jwtToken}`
        } else {
          headers['Authorization'] = `Bearer ${jwtToken}`
        }
      }
    }
  }

  return headers
}

/**
 * Makes an API request with automatic JWT/API key fallback
 * @param method - HTTP method
 * @param path - API path
 * @param data - Request data (query params for GET, body for POST/PUT)
 * @param retryWithJWT - Whether to retry with opposite auth method on 401
 * @param configOverride - Optional config override (for testing or custom configs)
 * @returns Response data
 */
export async function makeAPIRequest(
  method: string,
  path: string,
  data?: any,
  retryWithJWT: boolean = true,
  configOverride?: ABsmartlyConfig
): Promise<any> {
  const config = configOverride || await getConfig()

  if (!config?.apiEndpoint) {
    throw new Error('No API endpoint configured')
  }

  const headers = await buildHeaders(config)

  // Always strip /v1 from endpoint, we'll add it back in the path if needed
  const baseURL = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')

  const cleanPath = path.startsWith('/') ? path : `/${path}`

  // Auth endpoints don't use /v1, other endpoints do
  const finalPath = cleanPath.startsWith('/auth') ? cleanPath : `/v1${cleanPath}`

  let url = `${baseURL}${finalPath}`
  let requestData = undefined

  if (method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD') {
    if (data && Object.keys(data).length > 0) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      }
      url += '?' + params.toString()
    }
  } else {
    requestData = data
  }

  try {
    const response = await axios({
      method,
      url,
      data: requestData,
      headers,
      withCredentials: false
    })

    return response.data
  } catch (error) {
    const axiosError = error as AxiosError
    debugError('Request failed:', axiosError.response?.status, axiosError.response?.data)

    // NO FALLBACKS - if auth fails, throw AUTH_EXPIRED immediately
    if (isAuthError(error)) {
      throw new Error('AUTH_EXPIRED')
    }
    throw error
  }
}

/**
 * Validates API request parameters
 * @param method - HTTP method
 * @param path - API path
 * @param data - Request data
 * @returns Validation result
 */
export function validateAPIRequest(method: string, path: string, data?: any): { valid: boolean; error?: string } {
  try {
    APIRequestSchema.parse({ method, path, data })
    return { valid: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.issues.map(e => e.message).join(', ') }
    }
    return { valid: false, error: String(error) }
  }
}
