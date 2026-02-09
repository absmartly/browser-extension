import axios, { AxiosError } from 'axios'
import { z } from 'zod'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { getConfig as getConfigWithStorages } from './config-manager'
import { withRetry, withNetworkRetry } from '~src/lib/api-retry'
import { safeParseExperiments, parseExperiment } from '~src/lib/validation-schemas'
import { storage, secureStorage } from '~src/lib/storage-instances'

import { debugWarn } from '~src/utils/debug'
async function getConfig(): Promise<ABsmartlyConfig | null> {
  return getConfigWithStorages(storage, secureStorage)
}

const APIRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']),
  path: z.string().min(1),
  data: z.any().optional()
})

export function isAuthError(error: any): boolean {
  return error.response?.status === 401 || error.response?.status === 403
}

export async function getJWTCookie(domain: string): Promise<string | null> {
  try {
    if (chrome.permissions) {
      const hasPermission = await chrome.permissions.contains({
        permissions: ['cookies'],
        origins: ['https://*.absmartly.com/*']
      })
      if (!hasPermission) {
        debugWarn('[Auth] Cookie permission not granted for ABsmartly domain')
        return null
      }
    }

    const parsedUrl = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
    const hostname = parsedUrl.hostname
    const domainParts = hostname.split('.')
    const baseDomain = domainParts.length > 2 ? domainParts.slice(-2).join('.') : hostname

    const cookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })
    const jwtCookie = cookies.find(c => c.name === 'jwt')

    if (!jwtCookie) {
      debugWarn(`[Auth] No JWT cookie found for domain ${domain}`)
    }

    return jwtCookie?.value || null
  } catch (error) {
    console.error('[Auth] Failed to get JWT cookie:', error)
    if (error instanceof TypeError) {
      console.error('[Auth] Invalid domain format:', domain)
    }
    return null
  }
}

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
  }

  chrome.tabs.create({ url: baseUrl })
  return { authenticated: false }
}

async function buildHeaders(config: ABsmartlyConfig): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  const authMethod = config.authMethod || 'jwt'

  if (authMethod === 'apikey' && config.apiKey) {
    const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
      ? `JWT ${config.apiKey}`
      : `Api-Key ${config.apiKey}`
    headers['Authorization'] = authHeader
  }

  return headers
}

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
    const response = await withNetworkRetry(
      async () => {
        return await axios({
          method,
          url,
          data: requestData,
          headers,
          withCredentials: true
        })
      },
      3
    )

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

    if (path.includes('/experiments') || path.includes('/experiment/')) {
      const isValid = validateExperimentsResponse(responseData)
      if (!isValid) {
        debugWarn('[API] Response validation failed for experiments endpoint')
      }
    }

    return responseData
  } catch (error) {
    if (isAuthError(error)) {
      throw new Error('AUTH_EXPIRED')
    }
    throw error
  }
}

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

export function validateExperimentsResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return true
  }

  if ('experiments' in data && Array.isArray((data as any).experiments)) {
    const result = safeParseExperiments((data as any).experiments)
    if (result.success) {
      return true
    }
    debugWarn('[API] Experiments validation failed:', (result as { success: false; error: string }).error)
    return false
  }

  if (Array.isArray(data)) {
    const result = safeParseExperiments(data)
    if (result.success) {
      return true
    }
    debugWarn('[API] Experiments array validation failed:', (result as { success: false; error: string }).error)
    return false
  }

  if ('id' in data && 'name' in data && 'variants' in data) {
    try {
      parseExperiment(data)
      return true
    } catch (error) {
      debugWarn('[API] Experiment validation failed:', error)
      return false
    }
  }

  return true
}
