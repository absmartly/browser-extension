/**
 * Security utilities for background script
 * Provides domain validation and SSRF attack prevention
 */

let debugError = (...args: any[]) => {
  console.error('[Security]', ...args)
}

try {
  const debug = require('../../src/utils/debug')
  debugError = debug.debugError
} catch {
  // Use console.error fallback if debug module not available
}

/**
 * Allowed API endpoint domains to prevent token leakage
 * Only requests to these domains are permitted
 */
export const ALLOWED_API_DOMAINS = ['absmartly.com', 'absmartly.io']

/**
 * Blocked hosts for SSRF prevention
 * Prevents requests to internal networks and localhost
 */
export const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
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
  '172.31.'
]

/**
 * Validates that an API endpoint uses an allowed domain
 * Prevents token leakage to unauthorized domains
 *
 * @param endpoint - API endpoint URL to validate
 * @returns true if endpoint is allowed, false otherwise
 *
 * @example
 * validateAPIEndpoint('https://api.absmartly.com/v1') // true
 * validateAPIEndpoint('https://evil.com/steal-tokens') // false
 */
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

/**
 * Validates that a URL does not point to internal network addresses
 * Prevents SSRF (Server-Side Request Forgery) attacks
 *
 * @param url - URL string to validate
 * @returns true if URL is safe, false if it points to blocked host
 *
 * @example
 * isSSRFSafe('https://example.com/avatar.png') // true
 * isSSRFSafe('http://localhost:8080/admin') // false
 * isSSRFSafe('http://192.168.1.1/config') // false
 */
export function isSSRFSafe(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname

    const isBlocked = BLOCKED_HOSTS.some(blockedHost => {
      if (blockedHost.endsWith('.')) {
        return hostname.startsWith(blockedHost)
      }
      return hostname === blockedHost || hostname.includes(blockedHost)
    })

    if (isBlocked) {
      debugError(`[Security] SSRF attempt blocked: ${url}`)
      return false
    }

    return true
  } catch (e) {
    debugError('[Security] Failed to parse URL for SSRF check:', e)
    return false
  }
}

/**
 * Validates an avatar URL for use in avatar proxy
 * Combines URL parsing and SSRF protection
 *
 * @param avatarUrl - Avatar URL to validate
 * @returns Validation result with status and optional error message
 *
 * @example
 * validateAvatarUrl('https://example.com/avatar.png')
 * // { valid: true }
 *
 * validateAvatarUrl('http://localhost/admin')
 * // { valid: false, error: 'Access to internal network addresses is blocked' }
 */
export function validateAvatarUrl(avatarUrl: string): {
  valid: boolean
  error?: string
} {
  try {
    new URL(avatarUrl)
  } catch (e) {
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

/**
 * Validates Chrome extension sender ID
 * Prevents malicious extensions from sending messages
 *
 * @param senderId - Sender ID from Chrome message
 * @param expectedId - Expected extension ID
 * @returns true if sender is valid
 */
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

/**
 * Sanitizes a hostname by removing protocol and path
 * Useful for logging and display purposes
 *
 * @param url - URL to extract hostname from
 * @returns Hostname or original string if parsing fails
 */
export function sanitizeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
