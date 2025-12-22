import { Storage } from "@plasmohq/storage"
import axios, { AxiosError } from 'axios'
import { z } from 'zod'
import type { ABsmartlyConfig } from '~src/types/absmartly'
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
    if (chrome.permissions) {
      const hasPermission = await chrome.permissions.contains({
        permissions: ['cookies'],
        origins: ['https://*.absmartly.com/*']
      })
      if (!hasPermission) {
        return null
      }
    }

    const parsedUrl = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
    const hostname = parsedUrl.hostname
    const domainParts = hostname.split('.')
    const baseDomain = domainParts.length > 2 ? domainParts.slice(-2).join('.') : hostname

    const cookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })
    const jwtCookie = cookies.find(c => c.name === 'jwt')

    return jwtCookie?.value || null
  } catch (error) {
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
      return { authenticated: true }
    }
  } catch (error) {
    // Auth check failed, user needs to login
  }

  chrome.tabs.create({ url: baseUrl })
  return { authenticated: false }
}

/**
 * Builds request headers with authentication
 * No fallbacks - uses exactly the auth method specified in config
 */
async function buildHeaders(config: ABsmartlyConfig): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  const authMethod = config.authMethod || 'jwt'

  if (authMethod === 'jwt') {
    const jwtToken = await getJWTCookie(config.apiEndpoint)
    if (jwtToken) {
      headers['Authorization'] = `JWT ${jwtToken}`
    }
  } else if (authMethod === 'apikey' && config.apiKey) {
    const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
      ? `JWT ${config.apiKey}`
      : `Api-Key ${config.apiKey}`
    headers['Authorization'] = authHeader
  }

  return headers
}

/**
 * Makes an API request using the auth method specified in config
 * No fallbacks - if auth fails, throws AUTH_EXPIRED
 */
export async function makeAPIRequest(
  method: string,
  path: string,
  data?: any,
  _retryWithJWT: boolean = true,
  configOverride?: ABsmartlyConfig
): Promise<any> {
  const config = configOverride || await getConfig()

  if (!config?.apiEndpoint) {
    throw new Error('No API endpoint configured')
  }

  const headers = await buildHeaders(config)
  const baseURL = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
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
      withCredentials: true
    })

    const responseData = response.data

    if (responseData && typeof responseData === 'object' && responseData.ok === false) {
      const errorMessage = Array.isArray(responseData.errors) && responseData.errors.length > 0
        ? responseData.errors.join(', ')
        : responseData.error || 'API request failed'

      const error = new Error(errorMessage)
      ;(error as any).response = response
      ;(error as any).responseData = responseData
      throw error
    }

    return responseData
  } catch (error) {
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
