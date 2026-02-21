let debugError = (...args: any[]) => {
  console.error('[Security]', ...args)
}

try {
  const debug = require('../../src/utils/debug')
  debugError = debug.debugError
} catch (error) {
  debugError('Failed to load debug module, using console.error fallback:', error)
}

export const ALLOWED_API_DOMAINS = ['absmartly.com', 'absmartly.io']

export const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  '169.254.',
  '192.168.',
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  'fc',
  'fd',
  'fe80:'
]

const EXACT_BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])
const PREFIX_BLOCKED_HOSTS = ['169.254.', '192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', 'fc', 'fd', 'fe80:']

export function validateAPIEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    const hostname = url.hostname

    const isAllowed = ALLOWED_API_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    )

    if (!isAllowed) {
      debugError(`[Security] Invalid API endpoint domain: ${hostname}. Only ${ALLOWED_API_DOMAINS.join(', ')} domains are allowed.`)
      return false
    }

    return true
  } catch (e) {
    debugError('[Security] Failed to parse API endpoint URL:', e)
    return false
  }
}

export function isSSRFSafe(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    let hostname = parsedUrl.hostname

    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1)
    }

    if (EXACT_BLOCKED_HOSTS.has(hostname)) {
      debugError(`[Security] SSRF attempt blocked: ${url}`)
      return false
    }

    for (const prefix of PREFIX_BLOCKED_HOSTS) {
      if (hostname.startsWith(prefix)) {
        if (prefix.length <= 2 && !hostname.includes(':')) continue
        debugError(`[Security] SSRF attempt blocked: ${url}`)
        return false
      }
    }

    return true
  } catch (e) {
    debugError('[Security] Failed to parse URL for SSRF check:', e)
    return false
  }
}

export function validateAvatarUrl(avatarUrl: string): {
  valid: boolean
  error?: string
} {
  try {
    new URL(avatarUrl)
  } catch (e) {
    debugError('[Security] Invalid avatar URL format:', e)
    return {
      valid: false,
      error: 'Invalid URL format'
    }
  }

  if (!isSSRFSafe(avatarUrl)) {
    return {
      valid: false,
      error: 'Access to internal network addresses is blocked'
    }
  }

  return { valid: true }
}

export function validateExtensionSender(
  senderId: string | undefined,
  expectedId: string
): boolean {
  if (!senderId) {
    debugError('[Security] Message received without sender ID')
    return false
  }

  if (senderId !== expectedId) {
    debugError(`[Security] Invalid sender ID: ${senderId} (expected: ${expectedId})`)
    return false
  }

  return true
}

export function sanitizeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch (error) {
    debugError('[Security] Failed to sanitize hostname:', error)
    return url
  }
}
