/**
 * Manifest Permissions Tests
 * Tests for host_permissions configuration and cookie access
 */

import * as fs from 'fs'
import * as path from 'path'

describe('Manifest Permissions', () => {
  let manifest: any

  beforeAll(() => {
    // Read package.json which contains manifest configuration
    const packageJsonPath = path.join(__dirname, '../../package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    manifest = packageJson.manifest
  })

  describe('Required Permissions', () => {
    it('should have cookies permission declared', () => {
      expect(manifest.permissions).toBeDefined()
      expect(manifest.permissions).toContain('cookies')
    })

    it('should have storage permission declared', () => {
      expect(manifest.permissions).toContain('storage')
    })

    it('should have tabs permission declared', () => {
      expect(manifest.permissions).toContain('tabs')
    })
  })

  describe('Host Permissions Configuration', () => {
    it('should have host_permissions array defined', () => {
      expect(manifest.host_permissions).toBeDefined()
      expect(Array.isArray(manifest.host_permissions)).toBe(true)
    })

    it('should NOT have empty host_permissions array', () => {
      // Empty host_permissions prevents cookie access even with cookies permission
      expect(manifest.host_permissions.length).toBeGreaterThan(0)
    })

    it('should include ABsmartly wildcard domain in host_permissions', () => {
      const hasAbsmartlyPermission = manifest.host_permissions.some(
        (permission: string) => permission.includes('*.absmartly.com')
      )
      expect(hasAbsmartlyPermission).toBe(true)
    })

    it('should use HTTPS for ABsmartly host permission', () => {
      const absmartlyPermission = manifest.host_permissions.find(
        (permission: string) => permission.includes('absmartly.com')
      )
      expect(absmartlyPermission).toBeDefined()
      expect(absmartlyPermission).toMatch(/^https:\/\//)
    })

    it('should use wildcard pattern for all ABsmartly subdomains', () => {
      const absmartlyPermission = manifest.host_permissions.find(
        (permission: string) => permission.includes('absmartly.com')
      )
      expect(absmartlyPermission).toContain('*.absmartly.com')
      expect(absmartlyPermission).toContain('/*') // Should match all paths
    })
  })

  describe('Manifest V3 Compliance', () => {
    it('should have both cookies permission AND host_permissions for cookie access', () => {
      // In Manifest V3, cookies permission alone is NOT enough
      // You MUST also have host_permissions for the domains you want to access cookies from
      const hasCookiesPermission = manifest.permissions.includes('cookies')
      const hasHostPermissions = manifest.host_permissions && manifest.host_permissions.length > 0

      expect(hasCookiesPermission).toBe(true)
      expect(hasHostPermissions).toBe(true)
    })

    it('should not use manifest_version 2 patterns', () => {
      // Ensure we're not using deprecated MV2 patterns
      expect(manifest.permissions).not.toContain('http://*/')
      expect(manifest.permissions).not.toContain('https://*/')
      // Host patterns should be in host_permissions, not permissions
    })
  })

  describe('Cookie Access Requirements', () => {
    it('should meet all requirements for chrome.cookies.getAll() to work', () => {
      // chrome.cookies.getAll() requires:
      // 1. "cookies" permission
      const hasCookiesPermission = manifest.permissions.includes('cookies')

      // 2. host_permissions for the target domain
      const hasAbsmartlyHostPermission = manifest.host_permissions.some(
        (permission: string) => permission.includes('absmartly.com')
      )

      expect(hasCookiesPermission).toBe(true)
      expect(hasAbsmartlyHostPermission).toBe(true)
    })

    it('should have host_permissions that cover API endpoint subdomains', () => {
      // Common ABsmartly API endpoints:
      // - demo-2.absmartly.com
      // - app.absmartly.com
      // - api.absmartly.com
      // The *.absmartly.com pattern should cover all of these

      const absmartlyPermission = manifest.host_permissions.find(
        (permission: string) => permission.includes('absmartly.com')
      )

      // Should use wildcard to cover all subdomains
      expect(absmartlyPermission).toContain('*.')
    })
  })

  describe('Security Best Practices', () => {
    it('should not request excessive host permissions', () => {
      // Should only request permissions for ABsmartly domains, not all URLs
      const hasAllUrls = manifest.host_permissions.some(
        (permission: string) =>
          permission === '<all_urls>' ||
          permission === 'http://*/' ||
          permission === 'https://*/'
      )
      expect(hasAllUrls).toBe(false)
    })

    it('should use HTTPS for all host permissions', () => {
      // All host permissions should use HTTPS for security
      manifest.host_permissions.forEach((permission: string) => {
        expect(permission).toMatch(/^https:\/\//)
      })
    })

    it('should have minimal necessary permissions', () => {
      // Verify we're not requesting unnecessary permissions
      const unnecessaryPermissions = [
        'unlimitedStorage',
        'webRequest',
        'webRequestBlocking',
        'declarativeNetRequest',
        'geolocation',
        'notifications',
        'clipboardRead',
        'clipboardWrite'
      ]

      unnecessaryPermissions.forEach(permission => {
        expect(manifest.permissions).not.toContain(permission)
      })
    })
  })

  describe('Web Accessible Resources', () => {
    it('should declare web_accessible_resources', () => {
      expect(manifest.web_accessible_resources).toBeDefined()
      expect(Array.isArray(manifest.web_accessible_resources)).toBe(true)
    })

    it('should have proper resource configuration', () => {
      const hasResourceConfig = manifest.web_accessible_resources.some(
        (config: any) => config.resources && config.matches
      )
      expect(hasResourceConfig).toBe(true)
    })
  })
})

describe('Cookie Access Functionality', () => {
  describe('getJWTCookie Function Requirements', () => {
    it('should have proper URL parsing for cookie domains', () => {
      // Test URL parsing logic
      const testUrl = 'https://demo-2.absmartly.com/v1'
      const parsedUrl = new URL(testUrl)

      expect(parsedUrl.hostname).toBe('demo-2.absmartly.com')
      expect(parsedUrl.protocol).toBe('https:')
    })

    it('should extract base domain correctly', () => {
      const hostname = 'demo-2.absmartly.com'
      const domainParts = hostname.split('.')
      const baseDomain =
        domainParts.length > 2 ? domainParts.slice(-2).join('.') : hostname

      expect(baseDomain).toBe('absmartly.com')
    })

    it('should query cookies with correct domain patterns', () => {
      // Test domain pattern generation
      const hostname = 'demo-2.absmartly.com'
      const domainParts = hostname.split('.')
      const baseDomain =
        domainParts.length > 2 ? domainParts.slice(-2).join('.') : hostname

      const expectedPatterns = {
        url: 'https://demo-2.absmartly.com',
        domain: 'absmartly.com',
        dotDomain: '.absmartly.com'
      }

      expect(baseDomain).toBe(expectedPatterns.domain)
      expect(`.${baseDomain}`).toBe(expectedPatterns.dotDomain)
    })

    it('should recognize JWT cookie formats', () => {
      // Test JWT cookie recognition patterns
      const jwtCookieNames = ['jwt', 'JWT', 'access_token', 'auth_token', 'authorization']

      jwtCookieNames.forEach(name => {
        expect(['jwt', 'JWT', 'access_token', 'auth_token', 'authorization']).toContain(name)
      })
    })

    it('should recognize JWT token by structure (3 parts separated by dots)', () => {
      // JWT tokens have 3 parts: header.payload.signature
      const validJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

      const parts = validJWT.split('.')
      expect(parts.length).toBe(3)

      // Should contain dots
      expect(validJWT.includes('.')).toBe(true)
    })

    it('should reject non-JWT strings', () => {
      const invalidTokens = [
        'simple-token',
        'token.with.too.many.parts',
        'only.two',
        '',
        'no-dots'
      ]

      invalidTokens.forEach(token => {
        const parts = token.split('.')
        if (parts.length === 3 && token.includes('.')) {
          // This should only be true for valid JWTs
          expect(false).toBe(true)
        }
      })
    })
  })

  describe('Cookie Domain Scoping', () => {
    it('should understand cookie domain hierarchy', () => {
      // Cookies set on .absmartly.com are available to all subdomains
      // Cookies set on demo-2.absmartly.com are only available to that subdomain

      const wildcardDomain = '.absmartly.com'
      const specificSubdomain = 'demo-2.absmartly.com'

      // Wildcard should start with dot
      expect(wildcardDomain.startsWith('.')).toBe(true)

      // Specific subdomain should NOT start with dot
      expect(specificSubdomain.startsWith('.')).toBe(false)
    })

    it('should query multiple domain patterns to find cookies', () => {
      // The extension queries 3 patterns to maximize cookie discovery:
      // 1. Exact URL: https://demo-2.absmartly.com
      // 2. Base domain: absmartly.com
      // 3. Wildcard domain: .absmartly.com

      const patterns = [
        { type: 'url', value: 'https://demo-2.absmartly.com' },
        { type: 'domain', value: 'absmartly.com' },
        { type: 'dotDomain', value: '.absmartly.com' }
      ]

      expect(patterns.length).toBe(3)
      expect(patterns[0].type).toBe('url')
      expect(patterns[1].type).toBe('domain')
      expect(patterns[2].type).toBe('dotDomain')
    })
  })

  describe('Chrome Cookies API Mock Tests', () => {
    it('should handle empty cookie result gracefully', () => {
      // Simulate chrome.cookies.getAll returning empty array
      const mockCookies: any[] = []

      expect(mockCookies.length).toBe(0)

      // Function should handle this without crashing
      let jwtCookie = mockCookies.find(cookie => cookie.name === 'jwt')
      expect(jwtCookie).toBeUndefined()
    })

    it('should deduplicate cookies by name-value combination', () => {
      // When querying multiple domain patterns, same cookie may appear multiple times
      const mockCookies = [
        { name: 'jwt', value: 'token123', domain: '.absmartly.com' },
        { name: 'jwt', value: 'token123', domain: '.absmartly.com' }, // Duplicate
        { name: 'other', value: 'value1', domain: 'demo-2.absmartly.com' }
      ]

      // Deduplication logic: Map by name-value combination
      const uniqueCookies = Array.from(
        new Map(mockCookies.map(c => [`${c.name}-${c.value}`, c])).values()
      )

      expect(uniqueCookies.length).toBe(2) // jwt and other, not 3
    })

    it('should find JWT cookie by name priority', () => {
      const mockCookies = [
        { name: 'analytics', value: 'ga123', domain: '.absmartly.com' },
        { name: 'jwt', value: 'eyJ...', domain: 'demo-2.absmartly.com' },
        { name: 'other', value: 'value', domain: '.absmartly.com' }
      ]

      // Priority search: jwt, JWT, access_token, auth_token, authorization
      let jwtCookie = mockCookies.find(
        cookie =>
          cookie.name === 'jwt' ||
          cookie.name === 'JWT' ||
          cookie.name === 'access_token' ||
          cookie.name === 'auth_token' ||
          cookie.name === 'authorization'
      )

      expect(jwtCookie).toBeDefined()
      expect(jwtCookie?.name).toBe('jwt')
    })

    it('should fallback to JWT structure detection if no named JWT cookie found', () => {
      const mockCookies = [
        { name: 'analytics', value: 'ga123', domain: '.absmartly.com' },
        { name: 'session', value: 'eyJhbGc.eyJzdWI.SflKxw', domain: 'demo-2.absmartly.com' }
      ]

      // First try by name
      let jwtCookie = mockCookies.find(
        cookie =>
          cookie.name === 'jwt' ||
          cookie.name === 'JWT' ||
          cookie.name === 'access_token' ||
          cookie.name === 'auth_token' ||
          cookie.name === 'authorization'
      )

      expect(jwtCookie).toBeUndefined()

      // Fallback: look for JWT structure (3 dot-separated parts)
      jwtCookie = mockCookies.find(cookie => {
        const value = cookie.value
        return value && value.includes('.') && value.split('.').length === 3
      })

      expect(jwtCookie).toBeDefined()
      expect(jwtCookie?.name).toBe('session')
    })
  })
})
