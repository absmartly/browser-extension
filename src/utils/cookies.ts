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
    console.log('🔍 ===== getJWTCookie START =====')
    console.log('🔍 Input domain:', domain)
    console.log('🔍 chrome.cookies available?', typeof chrome !== 'undefined' && !!chrome.cookies)
    debugLog('=== getJWTCookie START ===')
    debugLog('Input domain:', domain)

    if (typeof chrome === 'undefined' || !chrome.cookies) {
      console.error('🔍 ❌ chrome.cookies API not available!')
      return null
    }

    // Check if we have the cookies permission (silently)
    if (chrome.permissions) {
      try {
        const hasPermission = await chrome.permissions.contains({
          permissions: ['cookies'],
          origins: ['https://*.absmartly.com/*']
        })
        console.log('🔍 DEBUG: Cookies permission granted?', hasPermission)

        if (!hasPermission) {
          console.error('🔍 ❌ Cookies permission not granted!')
          console.error('🔍 💡 Please grant cookie access permission from the Settings page.')
          return null
        }

        console.log('🔍 ✅ Cookies permission is granted, proceeding...')
      } catch (err) {
        console.error('🔍 DEBUG: Error checking permissions:', err)
        return null
      }
    }

    // DEBUG: Try to get ALL cookies to see if permissions work at all
    try {
      const allBrowserCookies = await chrome.cookies.getAll({})
      console.log(`🔍 DEBUG: Total cookies accessible with getAll({}): ${allBrowserCookies.length}`)
      const absmartlyCookies = allBrowserCookies.filter(c => c.domain.includes('absmartly'))
      console.log(`🔍 DEBUG: ABsmartly cookies found in getAll(): ${absmartlyCookies.length}`)
      if (absmartlyCookies.length > 0) {
        console.log('🔍 DEBUG: ABsmartly cookie details:', absmartlyCookies.map(c => ({
          name: c.name,
          domain: c.domain,
          secure: c.secure,
          httpOnly: c.httpOnly,
          valueLength: c.value.length
        })))
      }
    } catch (err) {
      console.error('🔍 DEBUG: Error getting all cookies:', err)
    }

    // DEBUG: Try querying specifically for absmartly.com domain
    try {
      console.log('🔍 DEBUG: Trying direct query for domain "absmartly.com"')
      const directDomainCookies = await chrome.cookies.getAll({ domain: 'absmartly.com' })
      console.log(`🔍 DEBUG: Direct domain query found ${directDomainCookies.length} cookies`)
      if (directDomainCookies.length > 0) {
        console.log('🔍 DEBUG: Direct domain cookies:', directDomainCookies.map(c => ({
          name: c.name,
          domain: c.domain,
          valueLength: c.value.length
        })))
      }
    } catch (err) {
      console.error('🔍 DEBUG: Error with direct domain query:', err)
    }

    // Parse the URL to get the base domain
    let parsedUrl: URL
    try {
      parsedUrl = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
    } catch (e) {
      console.error('🔍 Failed to parse URL:', domain, e)
      debugError('Failed to parse URL:', domain, e)
      return null
    }

    const hostname = parsedUrl.hostname
    const protocol = parsedUrl.protocol
    const baseUrl = `${protocol}//${hostname}`

    console.log('🔍 Parsed URL:', { hostname, protocol, baseUrl })
    debugLog('Parsed URL:', { hostname, protocol, baseUrl })

    // Try multiple strategies to find the JWT cookie

    // Strategy 1: Get cookies for the exact URL
    console.log('🔍 Strategy 1: Fetching cookies for exact URL:', baseUrl)
    debugLog('Strategy 1: Fetching cookies for exact URL:', baseUrl)
    const urlCookies = await chrome.cookies.getAll({ url: baseUrl })
    console.log(`🔍 Found ${urlCookies.length} cookies for URL ${baseUrl}`)
    debugLog(`Found ${urlCookies.length} cookies for URL ${baseUrl}`)

    if (urlCookies.length > 0) {
      console.log('🔍 URL cookies:', urlCookies.map(c => `${c.name} (domain: ${c.domain})`))
      debugLog('URL cookies:', urlCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

    // Strategy 2: Get cookies for the domain (without subdomain)
    const domainParts = hostname.split('.')
    const baseDomain = domainParts.length > 2
      ? domainParts.slice(-2).join('.')
      : hostname

    console.log('🔍 Strategy 2: Fetching cookies for base domain:', baseDomain)
    debugLog('Strategy 2: Fetching cookies for base domain:', baseDomain)
    const domainCookies = await chrome.cookies.getAll({ domain: baseDomain })
    console.log(`🔍 Found ${domainCookies.length} cookies for domain ${baseDomain}`)
    debugLog(`Found ${domainCookies.length} cookies for domain ${baseDomain}`)

    if (domainCookies.length > 0) {
      console.log('🔍 Domain cookies:', domainCookies.map(c => `${c.name} (domain: ${c.domain})`))
      debugLog('Domain cookies:', domainCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

    // Strategy 3: Get cookies with dot prefix (for subdomain access)
    console.log('🔍 Strategy 3: Fetching cookies for .domain:', `.${baseDomain}`)
    debugLog('Strategy 3: Fetching cookies for .domain:', `.${baseDomain}`)
    const dotDomainCookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })
    console.log(`🔍 Found ${dotDomainCookies.length} cookies for .${baseDomain}`)
    debugLog(`Found ${dotDomainCookies.length} cookies for .${baseDomain}`)

    if (dotDomainCookies.length > 0) {
      console.log('🔍 .Domain cookies:', dotDomainCookies.map(c => `${c.name} (domain: ${c.domain})`))
      debugLog('.Domain cookies:', dotDomainCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

    // Strategy 4: Get cookies for the full hostname (e.g., demo-2.absmartly.com)
    console.log('🔍 Strategy 4: Fetching cookies for full hostname domain:', hostname)
    debugLog('Strategy 4: Fetching cookies for full hostname domain:', hostname)
    const hostnameCookies = await chrome.cookies.getAll({ domain: hostname })
    console.log(`🔍 Found ${hostnameCookies.length} cookies for hostname domain ${hostname}`)
    debugLog(`Found ${hostnameCookies.length} cookies for hostname domain ${hostname}`)

    if (hostnameCookies.length > 0) {
      console.log('🔍 Hostname cookies:', hostnameCookies.map(c => `${c.name} (domain: ${c.domain})`))
      debugLog('Hostname cookies:', hostnameCookies.map(c => `${c.name} (domain: ${c.domain})`))
    }

    // Combine all cookies and look for JWT
    const allCookies = [...urlCookies, ...domainCookies, ...dotDomainCookies, ...hostnameCookies]
    const uniqueCookies = Array.from(new Map(allCookies.map(c => [`${c.name}-${c.value}`, c])).values())

    debugLog(`Total unique cookies found: ${uniqueCookies.length}`)

    // LOG ALL COOKIES WITH FULL DETAILS
    console.log('🍪 ===== ALL COOKIES FOR ABSMARTLY DOMAINS =====')
    uniqueCookies.forEach(cookie => {
      const hasJwtInName = cookie.name.toLowerCase().includes('jwt')
      const prefix = hasJwtInName ? '🔑 JWT IN NAME:' : '  '
      console.log(`${prefix} Name: "${cookie.name}", Domain: "${cookie.domain}", Value length: ${cookie.value.length}, Secure: ${cookie.secure}, HttpOnly: ${cookie.httpOnly}`)
      if (hasJwtInName) {
        console.log(`     Full value: ${cookie.value}`)
      }
    })
    console.log('🍪 ===== END ALL COOKIES =====')

    // Also log cookies that look like JWT tokens (3 parts)
    const jwtLikeCookies = uniqueCookies.filter(c => c.value && c.value.includes('.') && c.value.split('.').length === 3)
    if (jwtLikeCookies.length > 0) {
      console.log('🔐 ===== COOKIES THAT LOOK LIKE JWT TOKENS (3 parts) =====')
      jwtLikeCookies.forEach(cookie => {
        console.log(`  Name: "${cookie.name}", Domain: "${cookie.domain}", Value: ${cookie.value.substring(0, 50)}...`)
      })
      console.log('🔐 ===== END JWT-LIKE COOKIES =====')
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
      console.log(`🔍 ✅ JWT cookie found: ${jwtCookie.name} (length: ${jwtCookie.value.length}, domain: ${jwtCookie.domain})`)
      console.log(`🔍 ===== getJWTCookie END (SUCCESS) - Returning token =====`)
      debugLog(`✅ JWT cookie found: ${jwtCookie.name} (length: ${jwtCookie.value.length}, domain: ${jwtCookie.domain})`)
      debugLog('=== getJWTCookie END (SUCCESS) ===')
      return jwtCookie.value
    }

    console.log('🔍 ❌ No JWT cookie found after trying all strategies')
    console.log('🔍 ===== getJWTCookie END (NOT FOUND) - Returning null =====')
    debugLog('❌ No JWT cookie found')
    debugLog('=== getJWTCookie END (NOT FOUND) ===')
    return null
  } catch (error) {
    debugError('Error getting JWT cookie:', error)
    return null
  }
}
