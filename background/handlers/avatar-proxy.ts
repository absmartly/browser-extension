import { debugError, debugLog, debugWarn } from '~src/utils/debug'
import { buildAuthFetchOptions } from '~src/utils/auth'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { getConfig as getConfigFromManager } from '../core/config-manager'
import { getJWTCookie } from '../core/api-client'
import { isSSRFSafe } from '../utils/security'
import { storage, secureStorage } from '~src/lib/storage-instances'

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

    const normalizedAuthMethod = authMethod as 'jwt' | 'apikey'
    // The avatar URL already carries the endpoint domain, so derive the
    // origin from it instead of relying on stored config. This way the
    // avatar still loads when the user clicks Refresh in Settings before
    // saving — stored config can be empty (fresh install with only an
    // env-provided endpoint) or still pointed at a different endpoint.
    const avatarOrigin = new URL(avatarUrl).origin

    let avatarConfig: ABsmartlyConfig
    let jwtToken: string | null = null

    if (normalizedAuthMethod === 'jwt') {
      // JWT auth uses credentials:include — cookies are scoped to the
      // request URL's domain, so we don't need stored config at all. We
      // still fetch the JWT here for the Strategy-2 fallback below.
      jwtToken = await getJWTCookie(avatarOrigin)
      debugLog('[AvatarProxy] JWT token for avatar:', jwtToken ? 'found' : 'NOT FOUND', 'origin:', avatarOrigin)
      avatarConfig = {
        apiEndpoint: avatarOrigin,
        authMethod: 'jwt'
      } as ABsmartlyConfig
    } else {
      // apikey auth needs the secret. The form's value isn't reachable
      // from the SW, so we read it from storage; the user must save before
      // an unsaved key change takes effect for the avatar.
      const config = await getConfig()
      if (!config) {
        return new Response('No API key configured', { status: 500 })
      }
      avatarConfig = {
        apiEndpoint: avatarOrigin,
        authMethod: 'apikey',
        apiKey: config.apiKey || ''
      } as ABsmartlyConfig
    }

    const useAuthHeader = normalizedAuthMethod === 'apikey'
    const fetchOptions = buildAuthFetchOptions(normalizedAuthMethod, avatarConfig, jwtToken, useAuthHeader)

    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Accept': 'image/*'
    }

    // SECURITY: Never log API keys, tokens, or auth headers, even partially
    debugLog('[AvatarProxy] Fetching avatar with options:', {
      url: avatarUrl,
      authMethod: normalizedAuthMethod,
      authHeader: fetchOptions.headers?.['Authorization'] ? 'present' : 'MISSING',
      credentials: fetchOptions.credentials
    })

    let response = await fetch(avatarUrl, fetchOptions)

    debugLog('[AvatarProxy] Avatar fetch response:', response.status, response.statusText)

    // Mirror checkAuthentication's Strategy-2 fallback: if credentials:include
    // came back 401 but we have a JWT, retry with an explicit Authorization
    // header. SW fetch contexts occasionally drop cookies even when the user
    // is logged in, so the explicit header is the reliable path.
    if (response.status === 401 && normalizedAuthMethod === 'jwt' && jwtToken) {
      debugLog('[AvatarProxy] credentials:include returned 401, retrying with Authorization header')
      const fallbackOptions = buildAuthFetchOptions('jwt', avatarConfig, jwtToken, true)
      fallbackOptions.headers = {
        ...fallbackOptions.headers,
        'Accept': 'image/*'
      }
      response = await fetch(avatarUrl, fallbackOptions)
      debugLog('[AvatarProxy] Fallback fetch response:', response.status, response.statusText)
    }

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
