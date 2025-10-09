import { debugLog, debugError } from './debug'

/**
 * Get JWT cookie from the browser for the given domain/endpoint
 * Tries multiple strategies to find JWT cookies across different domain formats
 *
 * @param domain - The domain or endpoint URL to get JWT cookie for
 * @returns The JWT token string or null if not found
 */
export async function getJWTCookie(domain: string): Promise<string | null> {
  try {
    debugLog('=== getJWTCookie START ===')
    debugLog('Input domain:', domain)

    // Parse the URL to get the base domain
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

    // Try multiple strategies to find the JWT cookie

    // Strategy 1: Get cookies for the exact URL
    debugLog('Strategy 1: Fetching cookies for exact URL:', baseUrl)
    const urlCookies = await chrome.cookies.getAll({ url: baseUrl })
    debugLog(`Found ${urlCookies.length} cookies for URL ${baseUrl}`)

    if (urlCookies.length > 0) {
      debugLog('URL cookies:', urlCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

    // Strategy 2: Get cookies for the domain (without subdomain)
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

    // Strategy 3: Get cookies with dot prefix (for subdomain access)
    debugLog('Strategy 3: Fetching cookies for .domain:', `.${baseDomain}`)
    const dotDomainCookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })
    debugLog(`Found ${dotDomainCookies.length} cookies for .${baseDomain}`)

    if (dotDomainCookies.length > 0) {
      debugLog('.Domain cookies:', dotDomainCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

    // Combine all cookies and look for JWT
    const allCookies = [...urlCookies, ...domainCookies, ...dotDomainCookies]
    const uniqueCookies = Array.from(new Map(allCookies.map(c => [`${c.name}-${c.value}`, c])).values())

    debugLog(`Total unique cookies found: ${uniqueCookies.length}`)

    // Look for JWT cookie - check common ABsmartly cookie names
    // Try exact matches first
    let jwtCookie = uniqueCookies.find(cookie =>
      cookie.name === 'jwt' || // ABsmartly typically uses lowercase 'jwt'
      cookie.name === 'JWT' ||
      cookie.name === 'access_token' ||
      cookie.name === 'auth_token' ||
      cookie.name === 'authorization'
    )

    // If not found, look for cookies that might contain JWT token (3 parts separated by dots)
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
