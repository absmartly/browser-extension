/**
 * Get JWT cookie from the browser for the given domain/endpoint
 *
 * @param domain - The domain or endpoint URL to get JWT cookie for
 * @returns The JWT token string or null if not found
 */
export async function getJWTCookie(domain: string): Promise<string | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome.cookies) {
      return null
    }

    // Check if we have the cookies permission
    if (chrome.permissions) {
      const hasPermission = await chrome.permissions.contains({
        permissions: ['cookies'],
        origins: ['https://*.absmartly.com/*']
      })
      if (!hasPermission) {
        return null
      }
    }

    const parsedUrl = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
    const hostname = parsedUrl.hostname
    const domainParts = hostname.split('.')
    const baseDomain = domainParts.length > 2 ? domainParts.slice(-2).join('.') : hostname

    const cookies = await chrome.cookies.getAll({ domain: `.${baseDomain}` })
    const jwtCookie = cookies.find(c => c.name === 'jwt')

    return jwtCookie?.value || null
  } catch (error) {
    return null
  }
}
