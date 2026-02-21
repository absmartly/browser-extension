export async function getJWTCookie(domain: string): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome.cookies) {
    return null
  }

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
}
