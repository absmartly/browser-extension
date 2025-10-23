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
    debugLog('=== getJWTCookie START ===')
    debugLog('Input domain:', domain)

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

    debugLog('Strategy 1: Fetching cookies for exact URL:', baseUrl)
    const urlCookies = await chrome.cookies.getAll({ url: baseUrl })
    debugLog(`Found ${urlCookies.length} cookies for URL ${baseUrl}`)

    if (urlCookies.length > 0) {
      debugLog('URL cookies:', urlCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

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

    debugLog('Strategy 3: Fetching cookies for .domain:', `.${baseDomain}`)
    const dotDomainCookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })
    debugLog(`Found ${dotDomainCookies.length} cookies for .${baseDomain}`)

    if (dotDomainCookies.length > 0) {
      debugLog('.Domain cookies:', dotDomainCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

    const allCookies = [...urlCookies, ...domainCookies, ...dotDomainCookies]
    const uniqueCookies = Array.from(new Map(allCookies.map(c => [`${c.name}-${c.value}`, c])).values())

    debugLog(`Total unique cookies found: ${uniqueCookies.length}`)

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
    if (config.apiKey && useApiKey) {
      debugLog('Using API key authentication method')
      const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
        ? `JWT ${config.apiKey}`
        : `Api-Key ${config.apiKey}`
      headers['Authorization'] = authHeader
    } else if (!config.apiKey) {
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
  debugLog('=== makeAPIRequest called ===', { method, path, data })

  const config = configOverride || await getConfig()

  if (!config?.apiEndpoint) {
    throw new Error('No API endpoint configured')
  }

  debugLog('Config loaded:', {
    hasApiKey: !!config?.apiKey,
    apiEndpoint: config?.apiEndpoint,
    apiKeyLength: config?.apiKey?.length || 0,
    authMethod: config?.authMethod || 'jwt'
  })

  const authMethod = config.authMethod || 'jwt'
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

  console.log('\n=== AXIOS REQUEST ===')
  console.log('URL:', url)
  console.log('Method:', method)
  console.log('Headers:', JSON.stringify(headers, null, 2))
  console.log('Request Data:', requestData)
  console.log('====================\n')

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
      withCredentials: false
    })

    return response.data
  } catch (error) {
    const axiosError = error as AxiosError
    debugError('Request failed:', axiosError.response?.status, axiosError.response?.data)

    if (isAuthError(error) && retryWithJWT) {
      if (authMethod === 'apikey' && headers.Authorization?.startsWith('Api-Key')) {
        debugLog('API key auth failed (401), retrying with JWT cookie...')

        const jwtToken = await getJWTCookie(config.apiEndpoint)

        if (jwtToken) {
          const newHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }

          if (jwtToken.includes('.') && jwtToken.split('.').length === 3) {
            newHeaders['Authorization'] = `JWT ${jwtToken}`
          } else {
            newHeaders['Authorization'] = `Bearer ${jwtToken}`
          }

          debugLog('Retrying with JWT authorization:', newHeaders.Authorization)

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
            debugError('JWT fallback also failed:', (jwtError as AxiosError).response?.status)
            throw new Error('AUTH_EXPIRED')
          }
        } else {
          debugLog('No JWT cookie available for retry')
        }
      } else if (authMethod === 'jwt' && config.apiKey && !headers.Authorization?.startsWith('Api-Key')) {
        debugLog('JWT auth failed (401), retrying with API key...')

        const newHeaders: Record<string, string> = {
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
          debugError('API key fallback also failed:', (apiKeyError as AxiosError).response?.status)
          throw new Error('AUTH_EXPIRED')
        }
      }
    }

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
