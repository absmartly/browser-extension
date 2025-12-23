import { debugError } from '~src/utils/debug'
import { buildAuthFetchOptions } from '~src/utils/auth'
import { Storage } from '@plasmohq/storage'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { getConfig as getConfigFromManager } from '../core/config-manager'
import { getJWTCookie } from '../core/api-client'

/**
 * Avatar Proxy Module
 *
 * Handles authenticated image fetching via Service Worker fetch interceptor.
 * Intercepts requests to chrome-extension://[id]/api/avatar and fetches with authentication.
 */

const storage = new Storage()
const secureStorage = new Storage({
  area: "local",
  secretKeyring: true
} as any)

/**
 * Blocked hosts for SSRF protection
 * Prevents access to internal networks and localhost
 */
const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '0.0.0.0',
  '192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
  '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'
]

/**
 * Check if a hostname is blocked (SSRF protection)
 */
export function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOSTS.some(h =>
    hostname.includes(h) || hostname === h.replace('.', '')
  )
}

/**
 * Get config from storage with secure API key retrieval
 * Uses the canonical config manager implementation
 */
async function getConfig(): Promise<ABsmartlyConfig | null> {
  return getConfigFromManager(storage, secureStorage)
}

/**
 * Handle avatar fetch request with authentication
 * @param avatarUrl - The full URL to the avatar image
 * @param authMethod - Authentication method ('jwt' or 'apikey')
 * @returns Response with the avatar image or error
 */
export async function handleAvatarFetch(
  avatarUrl: string,
  authMethod: string
): Promise<Response> {
  try {
    const avatarHostUrl = new URL(avatarUrl)

    if (isBlockedHost(avatarHostUrl.hostname)) {
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

    // For JWT auth, read the token via chrome.cookies API (works for HTTP-only cookies)
    // and send it via Authorization header. credentials: 'include' doesn't work due to
    // invalid CORS config on server (Access-Control-Allow-Origin: * with credentials)
    let jwtToken: string | null = null
    if (avatarConfig.authMethod === 'jwt') {
      jwtToken = await getJWTCookie(config.apiEndpoint)
      if (!jwtToken) {
        return new Response('No JWT token available for avatar authentication', { status: 401 })
      }
    }

    // Always use Authorization header (credentials: 'include' doesn't work cross-origin)
    const useAuthHeader = true
    const fetchOptions = buildAuthFetchOptions(avatarConfig.authMethod, avatarConfig, jwtToken, useAuthHeader)

    // Add Accept header for images
    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Accept': 'image/*'
    }

    const response = await fetch(avatarUrl, fetchOptions)

    if (!response.ok) {
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

/**
 * Service Worker fetch event handler
 * Intercepts requests to /api/avatar and processes them with authentication
 */
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

/**
 * Initialize avatar proxy fetch interceptor
 * Should be called in Service Worker context
 */
export function initializeAvatarProxy(): void {
  if (typeof self !== 'undefined' && 'addEventListener' in self) {
    self.addEventListener('fetch', handleFetchEvent as EventListener)
  }
}
