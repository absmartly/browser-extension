import { debugError } from '~src/utils/debug'
import { buildAuthFetchOptions } from '~src/utils/auth'
import { Storage } from '@plasmohq/storage'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { getConfig as getConfigFromManager } from '../core/config-manager'
import { getJWTCookie } from '../core/api-client'
import { isSSRFSafe } from '../utils/security'

const storage = new Storage()
const secureStorage = new Storage({
  area: "local",
  secretKeyring: true
} as any)

async function getConfig(): Promise<ABsmartlyConfig | null> {
  return getConfigFromManager(storage, secureStorage)
}

export async function handleAvatarFetch(
  avatarUrl: string,
  authMethod: string
): Promise<Response> {
  try {
    if (!isSSRFSafe(avatarUrl)) {
      console.error('[AvatarProxy] SSRF attempt blocked:', avatarUrl)
      return new Response('Access to internal network addresses is blocked', { status: 403 })
    }

    const cache = await caches.open('absmartly-avatars-v1')
    const cacheRequest = new Request(avatarUrl, { method: 'GET' })
    const cached = await cache.match(cacheRequest)

    if (cached) {
      return cached
    }

    const config = await getConfig()
    if (!config?.apiEndpoint) {
      return new Response('No endpoint configured', { status: 500 })
    }

    const avatarConfig: ABsmartlyConfig = {
      ...config,
      authMethod: authMethod as 'jwt' | 'apikey'
    }

    let jwtToken: string | null = null
    if (avatarConfig.authMethod === 'jwt') {
      jwtToken = await getJWTCookie(config.apiEndpoint)
      console.log('[AvatarProxy] JWT token for avatar:', jwtToken ? 'found' : 'NOT FOUND', 'endpoint:', config.apiEndpoint)
    }

    const useAuthHeader = avatarConfig.authMethod === 'apikey'
    const fetchOptions = buildAuthFetchOptions(avatarConfig.authMethod, avatarConfig, jwtToken, useAuthHeader)

    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Accept': 'image/*'
    }

    console.log('[AvatarProxy] Fetching avatar with options:', {
      url: avatarUrl,
      authMethod: avatarConfig.authMethod,
      authHeader: fetchOptions.headers?.['Authorization'] ?
        `${fetchOptions.headers['Authorization'].substring(0, 20)}...` : 'MISSING',
      credentials: fetchOptions.credentials
    })

    const response = await fetch(avatarUrl, fetchOptions)

    console.log('[AvatarProxy] Avatar fetch response:', response.status, response.statusText)

    if (!response.ok) {
      console.error('[AvatarProxy] Avatar fetch failed with status:', response.status)
      return new Response('Avatar fetch failed', { status: response.status })
    }

    const blob = await response.blob()
    const cachedResponse = new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': `chrome-extension://${chrome.runtime.id}`
      }
    })

    await cache.put(cacheRequest, cachedResponse.clone())

    return cachedResponse
  } catch (error) {
    debugError('[AvatarProxy] Error:', error)
    return new Response(`Avatar proxy error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 })
  }
}

export function handleFetchEvent(event: any): void {
  const url = new URL(event.request.url)

  if (url.pathname === '/api/avatar' && url.searchParams.has('url')) {
    event.respondWith(
      (async () => {
        const avatarUrl = url.searchParams.get('url')!
        const authMethod = url.searchParams.get('authMethod') || 'jwt'

        return await handleAvatarFetch(avatarUrl, authMethod)
      })()
    )
  }
}

export function initializeAvatarProxy(): void {
  if (typeof self !== 'undefined' && 'addEventListener' in self) {
    self.addEventListener('fetch', handleFetchEvent as EventListener)
  }
}
