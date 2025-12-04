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
    debugLog('[getJWTCookie] Starting cookie check for domain:', domain)

    let parsedUrl: URL
    try {
      parsedUrl = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
      debugLog('[getJWTCookie] Parsed URL:', {
        hostname: parsedUrl.hostname,
        protocol: parsedUrl.protocol,
        href: parsedUrl.href
      })
    } catch (e) {
      debugError('[getJWTCookie] Failed to parse URL:', domain, e)
      return null
    }

    const hostname = parsedUrl.hostname
    const protocol = parsedUrl.protocol
    const baseUrl = `${protocol}//${hostname}`

    debugLog('[getJWTCookie] Fetching cookies for baseUrl:', baseUrl)
    const urlCookies = await chrome.cookies.getAll({ url: baseUrl })
    debugLog('[getJWTCookie] URL cookies found:', urlCookies.length, urlCookies.map(c => ({ name: c.name, domain: c.domain, secure: c.secure, httpOnly: c.httpOnly })))

    const domainParts = hostname.split('.')
    const baseDomain = domainParts.length > 2
      ? domainParts.slice(-2).join('.')
      : hostname

    debugLog('[getJWTCookie] Base domain:', baseDomain)
    debugLog('[getJWTCookie] Fetching cookies for domain:', baseDomain)
    const domainCookies = await chrome.cookies.getAll({ domain: baseDomain })
    debugLog('[getJWTCookie] Domain cookies found:', domainCookies.length, domainCookies.map(c => ({ name: c.name, domain: c.domain, secure: c.secure, httpOnly: c.httpOnly })))

    debugLog('[getJWTCookie] Fetching cookies for .domain:', `.${baseDomain}`)
    const dotDomainCookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })
    debugLog('[getJWTCookie] Dot domain cookies found:', dotDomainCookies.length, dotDomainCookies.map(c => ({ name: c.name, domain: c.domain, secure: c.secure, httpOnly: c.httpOnly })))

    const allCookies = [...urlCookies, ...domainCookies, ...dotDomainCookies]
    const uniqueCookies = Array.from(new Map(allCookies.map(c => [`${c.name}-${c.value}`, c])).values())

    debugLog('[getJWTCookie] Total unique cookies:', uniqueCookies.length)
    debugLog('[getJWTCookie] All cookie names:', uniqueCookies.map(c => c.name))

    let jwtCookie = uniqueCookies.find(cookie =>
      cookie.name === 'jwt' ||
      cookie.name === 'JWT' ||
      cookie.name === 'access_token' ||
      cookie.name === 'auth_token' ||
      cookie.name === 'authorization'
    )

    if (jwtCookie) {
      debugLog('[getJWTCookie] Found JWT cookie by name:', jwtCookie.name)
      return jwtCookie.value
    }

    debugLog('[getJWTCookie] No named JWT cookie found, checking for JWT-like values...')

    // Known tracking/analytics cookies that are NOT auth tokens
    const excludedCookieNames = [
      'cc_cookie',           // Cookie consent
      'cfz_',                // CloudFlare Zaraz (prefix)
      'cfzs_',               // CloudFlare Zaraz session (prefix)
      '_reb2b',              // Reb2B tracking (prefix)
      '_ga',                 // Google Analytics (prefix)
      '_gid',                // Google Analytics (prefix)
      'ajs_',                // Segment.io (prefix)
      '__stripe_',           // Stripe (prefix)
      '_fbp',                // Facebook Pixel
      '_gcl_',               // Google Click ID (prefix)
      'amplitude_',          // Amplitude (prefix)
      'mp_',                 // Mixpanel (prefix)
    ]

    jwtCookie = uniqueCookies.find(cookie => {
      const value = cookie.value
      const isJWT = value && value.includes('.') && value.split('.').length === 3

      // Exclude known tracking cookies
      const isExcluded = excludedCookieNames.some(excluded =>
        cookie.name === excluded || cookie.name.startsWith(excluded)
      )

      if (isJWT && !isExcluded) {
        debugLog('[getJWTCookie] Found JWT-like cookie:', cookie.name)
        return true
      } else if (isJWT && isExcluded) {
        debugLog('[getJWTCookie] Skipping excluded JWT-like cookie:', cookie.name)
      }
      return false
    })

    if (jwtCookie) {
      debugLog('[getJWTCookie] Found JWT cookie by value pattern:', jwtCookie.name)
      return jwtCookie.value
    }

    debugLog('[getJWTCookie] No JWT cookie found')
    return null
  } catch (error) {
    debugError('[getJWTCookie] Error getting JWT cookie:', error)
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
  debugLog('[buildHeaders] Building headers with config:', {
    authMethod: config.authMethod,
    hasApiKey: !!config.apiKey,
    apiEndpoint: config.apiEndpoint,
    useApiKey
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  const authMethod = config.authMethod || 'jwt'
  const shouldTryJwtFirst = authMethod === 'jwt'

  debugLog('[buildHeaders] Auth method:', authMethod, 'shouldTryJwtFirst:', shouldTryJwtFirst)

  if (shouldTryJwtFirst) {
    debugLog('[buildHeaders] Trying JWT first (auth method is jwt)')
    const jwtToken = await getJWTCookie(config.apiEndpoint)

    if (jwtToken) {
      debugLog('[buildHeaders] JWT token found, length:', jwtToken.length)
      if (jwtToken.includes('.') && jwtToken.split('.').length === 3) {
        headers['Authorization'] = `JWT ${jwtToken}`
        debugLog('[buildHeaders] Set Authorization header to JWT format')
      } else {
        headers['Authorization'] = `Bearer ${jwtToken}`
        debugLog('[buildHeaders] Set Authorization header to Bearer format')
      }
    } else {
      debugLog('[buildHeaders] No JWT token found from cookies')

      // Fall back to API key if no JWT cookie found
      if (config.apiKey && useApiKey) {
        debugLog('[buildHeaders] Falling back to API key from config')
        const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
          ? `JWT ${config.apiKey}`
          : `Api-Key ${config.apiKey}`
        headers['Authorization'] = authHeader
        debugLog('[buildHeaders] Set Authorization header from API key (fallback)')
      }
    }
    return headers
  } else {
    debugLog('[buildHeaders] Not trying JWT first (auth method is apikey)')
    if (config.apiKey && useApiKey) {
      debugLog('[buildHeaders] Using API key from config')
      const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
        ? `JWT ${config.apiKey}`
        : `Api-Key ${config.apiKey}`
      headers['Authorization'] = authHeader
      debugLog('[buildHeaders] Set Authorization header from API key')
    } else if (!config.apiKey) {
      debugLog('[buildHeaders] No API key in config, falling back to JWT cookie')
      const jwtToken = await getJWTCookie(config.apiEndpoint)
      if (jwtToken) {
        debugLog('[buildHeaders] JWT token found from fallback, length:', jwtToken.length)
        if (jwtToken.includes('.') && jwtToken.split('.').length === 3) {
          headers['Authorization'] = `JWT ${jwtToken}`
          debugLog('[buildHeaders] Set Authorization header to JWT format (fallback)')
        } else {
          headers['Authorization'] = `Bearer ${jwtToken}`
          debugLog('[buildHeaders] Set Authorization header to Bearer format (fallback)')
        }
      } else {
        debugLog('[buildHeaders] No JWT token found from fallback')
      }
    }
  }

  debugLog('[buildHeaders] Final headers have Authorization?', !!headers['Authorization'])
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
  debugLog('[makeAPIRequest] Starting request:', { method, path, hasData: !!data })

  const config = configOverride || await getConfig()

  if (!config?.apiEndpoint) {
    debugError('[makeAPIRequest] No API endpoint configured')
    throw new Error('No API endpoint configured')
  }

  debugLog('[makeAPIRequest] Config loaded:', {
    apiEndpoint: config.apiEndpoint,
    authMethod: config.authMethod,
    hasApiKey: !!config.apiKey
  })

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

  debugLog('[makeAPIRequest] Making request to:', url)
  debugLog('[makeAPIRequest] Request headers:', { ...headers, Authorization: headers.Authorization ? '[REDACTED]' : undefined })
  debugLog('[makeAPIRequest] Using withCredentials: true (browser will include HttpOnly cookies)')

  try {
    const response = await axios({
      method,
      url,
      data: requestData,
      headers,
      withCredentials: true
    })

    debugLog('[makeAPIRequest] Request successful, status:', response.status)

    const responseData = response.data

    // Check if response indicates an error even with 200 status
    if (responseData && typeof responseData === 'object') {
      if (responseData.ok === false) {
        const errorMessage = Array.isArray(responseData.errors) && responseData.errors.length > 0
          ? responseData.errors.join(', ')
          : responseData.error || 'API request failed'
        
        const error = new Error(errorMessage)
        ;(error as any).response = response
        ;(error as any).responseData = responseData
        throw error
      }
    }

    return responseData
  } catch (error) {
    const axiosError = error as AxiosError
    debugError('[makeAPIRequest] Request failed:', {
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data,
      message: axiosError.message,
      code: axiosError.code
    })

    // NO FALLBACKS - if auth fails, throw AUTH_EXPIRED immediately
    if (isAuthError(error)) {
      debugError('[makeAPIRequest] Auth error detected (401/403), throwing AUTH_EXPIRED')
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
