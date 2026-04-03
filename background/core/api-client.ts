import { z } from 'zod'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { getConfig as getConfigWithStorages } from './config-manager'
import { storage, secureStorage } from '~src/lib/storage-instances'
import { createExtensionClient, createExtensionHttpClient, AuthExpiredError } from './absmartly-client'

import { debugWarn, debugError } from '~src/utils/debug'
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
    if (error instanceof TypeError) {
      debugError('[Auth] Invalid domain format:', domain)
    } else {
      debugError('[Auth] Failed to get JWT cookie:', error)
    }
    throw error
  }
}

export async function openLoginPage(config?: ABsmartlyConfig | null): Promise<{ authenticated: boolean }> {
  const actualConfig = config || await getConfig()

  if (!actualConfig?.apiEndpoint) {
    return { authenticated: false }
  }

  const baseUrl = actualConfig.apiEndpoint.replace(/\/v1$/, '')

  try {
    const client = createExtensionClient(actualConfig)
    const user = await client.getCurrentUser()
    if (user) {
      return { authenticated: true }
    }
  } catch (error) {
    const isAuth = error instanceof AuthExpiredError ||
      (error instanceof Error && error.message === 'AUTH_EXPIRED') ||
      isAuthError(error)
    if (!isAuth) {
      debugWarn('[Auth] Network error checking auth status:', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  chrome.tabs.create({ url: baseUrl })
  return { authenticated: false }
}

export async function makeAPIRequest(
  method: string,
  path: string,
  data?: any,
  _retryWithJWT?: boolean,
  configOverride?: ABsmartlyConfig
): Promise<any> {
  const config = configOverride || await getConfig()

  if (!config?.apiEndpoint) {
    throw new Error('No API endpoint configured')
  }

  const baseURL = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const finalPath = cleanPath.startsWith('/auth') ? cleanPath : `/v1${cleanPath}`

  const url = `${baseURL}${finalPath}`
  let requestData = undefined
  let params: Record<string, string> | undefined = undefined

  if (method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD') {
    if (data && Object.keys(data).length > 0) {
      params = {}
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) {
          params[key] = String(value)
        }
      }
    }
  } else {
    requestData = data
  }

  const sanitizedKeys =
    requestData && typeof requestData === 'object'
      ? Object.keys(requestData as Record<string, unknown>)
      : []

  try {
    const httpClient = createExtensionHttpClient(config)
    const response = await httpClient.request({
      method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE',
      url,
      data: requestData,
      params,
    })

    const responseData = response.data

    if (responseData && typeof responseData === 'object' && (responseData as any).ok === false) {
      const rd = responseData as Record<string, any>
      const errorMessage = Array.isArray(rd.errors) && rd.errors.length > 0
        ? rd.errors.join(', ')
        : rd.error || 'API request failed'

      const error = new Error(errorMessage)
      ;(error as any).response = response
      ;(error as any).responseData = responseData
      throw error
    }

    return responseData
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      throw new Error('AUTH_EXPIRED')
    }
    const statusCode = (error as any).response?.status
    if (statusCode === 500) {
      debugWarn('[API] 500 from server', {
        method,
        url,
        path,
        hasData: Boolean(requestData),
        dataKeys: sanitizedKeys
      })
    }
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
