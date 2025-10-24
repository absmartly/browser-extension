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
    if (typeof chrome === 'undefined' || !chrome.cookies) {
      console.error('❌ chrome.cookies API not available!')
      return null
    }

    // Check if we have the cookies permission
    if (chrome.permissions) {
      try {
        console.log('[getJWTCookie] 🔍 Checking permissions...')
        const hasPermission = await chrome.permissions.contains({
          permissions: ['cookies'],
          origins: ['https://*.absmartly.com/*']
        })
        console.log('[getJWTCookie] ✅ Permission check result:', hasPermission)
        if (!hasPermission) {
          console.error('❌ Cookies permission not granted! Need both cookies permission AND https://*.absmartly.com/* origin')
          console.error('Please go to Settings and grant permissions when prompted')
          return null
        }
      } catch (err) {
        console.error('Error checking permissions:', err)
        return null
      }
    }

    // Parse the URL to get the base domain
    let parsedUrl: URL
    try {
      parsedUrl = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
    } catch (e) {
      console.error('Failed to parse URL:', domain, e)
      return null
    }

    const hostname = parsedUrl.hostname
    const protocol = parsedUrl.protocol
    const baseUrl = `${protocol}//${hostname}`

    debugLog(`Searching for JWT cookies for: ${hostname}`)

    // Try multiple strategies to find the JWT cookie
    const urlCookies = await chrome.cookies.getAll({ url: baseUrl })
    debugLog(`Strategy 1 - URL ${baseUrl}: Found ${urlCookies.length} cookies`)

    // Get cookies for the domain (without subdomain)
    const domainParts = hostname.split('.')
    const baseDomain = domainParts.length > 2
      ? domainParts.slice(-2).join('.')
      : hostname

    const domainCookies = await chrome.cookies.getAll({ domain: baseDomain })
    debugLog(`Strategy 2 - Domain ${baseDomain}: Found ${domainCookies.length} cookies`)

    const dotDomainCookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })
    debugLog(`Strategy 3 - .Domain .${baseDomain}: Found ${dotDomainCookies.length} cookies`)

    const hostnameCookies = await chrome.cookies.getAll({ domain: hostname })
    debugLog(`Strategy 4 - Hostname ${hostname}: Found ${hostnameCookies.length} cookies`)

    // Combine all cookies and look for JWT
    const allCookies = [...urlCookies, ...domainCookies, ...dotDomainCookies, ...hostnameCookies]
    const uniqueCookies = Array.from(new Map(allCookies.map(c => [`${c.name}-${c.value}`, c])).values())

    debugLog(`Total unique cookies: ${uniqueCookies.length}`)
    if (uniqueCookies.length > 0) {
      debugLog('Cookie names:', uniqueCookies.map(c => c.name).join(', '))
    }

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
      return jwtCookie.value
    }

    console.log('❌ No JWT cookie found')
    return null
  } catch (error) {
    console.error('Error getting JWT cookie:', error)
    return null
  }
}
