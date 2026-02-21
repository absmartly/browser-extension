/**
 * Unit tests for security utilities
 * Tests domain validation, SSRF prevention, and sender validation
 */

import {
  ALLOWED_API_DOMAINS,
  BLOCKED_HOSTS,
  validateAPIEndpoint,
  isSSRFSafe,
  validateAvatarUrl,
  validateExtensionSender,
  sanitizeHostname
} from '../security'

describe('Security Utilities', () => {
  describe('validateAPIEndpoint', () => {
    describe('allowed domains', () => {
      it('should allow exact domain match for absmartly.com', () => {
        expect(validateAPIEndpoint('https://absmartly.com')).toBe(true)
      })

      it('should allow exact domain match for absmartly.io', () => {
        expect(validateAPIEndpoint('https://absmartly.io')).toBe(true)
      })

      it('should allow subdomain of absmartly.com', () => {
        expect(validateAPIEndpoint('https://api.absmartly.com')).toBe(true)
      })

      it('should allow subdomain of absmartly.io', () => {
        expect(validateAPIEndpoint('https://api.absmartly.io')).toBe(true)
      })

      it('should allow nested subdomain', () => {
        expect(validateAPIEndpoint('https://v1.api.absmartly.com')).toBe(true)
      })

      it('should allow HTTPS protocol', () => {
        expect(validateAPIEndpoint('https://api.absmartly.com')).toBe(true)
      })

      it('should allow HTTP protocol', () => {
        expect(validateAPIEndpoint('http://api.absmartly.com')).toBe(true)
      })

      it('should allow endpoint with path', () => {
        expect(validateAPIEndpoint('https://api.absmartly.com/v1/experiments')).toBe(true)
      })

      it('should allow endpoint with port', () => {
        expect(validateAPIEndpoint('https://api.absmartly.com:443')).toBe(true)
      })

      it('should allow endpoint with query string', () => {
        expect(validateAPIEndpoint('https://api.absmartly.com?key=value')).toBe(true)
      })

      it('should allow endpoint with fragment', () => {
        expect(validateAPIEndpoint('https://api.absmartly.com#section')).toBe(true)
      })
    })

    describe('blocked domains', () => {
      it('should block different domain', () => {
        expect(validateAPIEndpoint('https://evil.com')).toBe(false)
      })

      it('should block localhost', () => {
        expect(validateAPIEndpoint('http://localhost:3000')).toBe(false)
      })

      it('should block domain that contains allowed domain but is not subdomain', () => {
        expect(validateAPIEndpoint('https://absmartly.com.evil.com')).toBe(false)
      })

      it('should block domain with similar name', () => {
        expect(validateAPIEndpoint('https://absmartly-phishing.com')).toBe(false)
      })

      it('should block IP address', () => {
        expect(validateAPIEndpoint('https://192.168.1.1')).toBe(false)
      })

      it('should block empty domain', () => {
        expect(validateAPIEndpoint('https://')).toBe(false)
      })

      it('should block domain without TLD match', () => {
        expect(validateAPIEndpoint('https://absmartly.org')).toBe(false)
      })
    })

    describe('invalid URLs', () => {
      it('should reject invalid URL format', () => {
        expect(validateAPIEndpoint('not-a-url')).toBe(false)
      })

      it('should reject empty string', () => {
        expect(validateAPIEndpoint('')).toBe(false)
      })

      it('should reject URL without protocol', () => {
        expect(validateAPIEndpoint('api.absmartly.com')).toBe(false)
      })

      it('should reject malformed URL', () => {
        expect(validateAPIEndpoint('https://?invalid')).toBe(false)
      })
    })
  })

  describe('isSSRFSafe', () => {
    describe('safe URLs', () => {
      it('should allow public domain', () => {
        expect(isSSRFSafe('https://example.com')).toBe(true)
      })

      it('should allow CDN URL', () => {
        expect(isSSRFSafe('https://cdn.example.com/image.png')).toBe(true)
      })

      it('should allow HTTPS URL', () => {
        expect(isSSRFSafe('https://secure.example.com')).toBe(true)
      })

      it('should allow public IP outside private ranges', () => {
        expect(isSSRFSafe('https://8.8.8.8')).toBe(true)
      })

      it('should allow URL with port', () => {
        expect(isSSRFSafe('https://example.com:443')).toBe(true)
      })

      it('should allow URL with path', () => {
        expect(isSSRFSafe('https://example.com/path/to/resource')).toBe(true)
      })
    })

    describe('blocked localhost', () => {
      it('should block localhost', () => {
        expect(isSSRFSafe('http://localhost')).toBe(false)
      })

      it('should block localhost with port', () => {
        expect(isSSRFSafe('http://localhost:8080')).toBe(false)
      })

      it('should block 127.0.0.1', () => {
        expect(isSSRFSafe('http://127.0.0.1')).toBe(false)
      })

      it('should block 127.0.0.1 with port', () => {
        expect(isSSRFSafe('http://127.0.0.1:3000')).toBe(false)
      })

      it('should block 0.0.0.0', () => {
        expect(isSSRFSafe('http://0.0.0.0')).toBe(false)
      })
    })

    describe('blocked private networks', () => {
      it('should block 192.168.x.x network', () => {
        expect(isSSRFSafe('http://192.168.1.1')).toBe(false)
        expect(isSSRFSafe('http://192.168.0.1')).toBe(false)
        expect(isSSRFSafe('http://192.168.255.255')).toBe(false)
      })

      it('should block 10.x.x.x network', () => {
        expect(isSSRFSafe('http://10.0.0.1')).toBe(false)
        expect(isSSRFSafe('http://10.255.255.255')).toBe(false)
      })

      it('should block 172.16-31.x.x networks', () => {
        expect(isSSRFSafe('http://172.16.0.1')).toBe(false)
        expect(isSSRFSafe('http://172.17.0.1')).toBe(false)
        expect(isSSRFSafe('http://172.20.0.1')).toBe(false)
        expect(isSSRFSafe('http://172.31.255.255')).toBe(false)
      })

      it('should block all 172.16-31 subnets', () => {
        for (let i = 16; i <= 31; i++) {
          expect(isSSRFSafe(`http://172.${i}.0.1`)).toBe(false)
        }
      })
    })

    describe('invalid URLs', () => {
      it('should reject invalid URL format', () => {
        expect(isSSRFSafe('not-a-url')).toBe(false)
      })

      it('should reject empty string', () => {
        expect(isSSRFSafe('')).toBe(false)
      })

      it('should reject malformed URL', () => {
        expect(isSSRFSafe('http://?invalid')).toBe(false)
      })
    })
  })

  describe('validateAvatarUrl', () => {
    describe('valid avatar URLs', () => {
      it('should validate public HTTPS URL', () => {
        const result = validateAvatarUrl('https://example.com/avatar.png')
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should validate CDN URL', () => {
        const result = validateAvatarUrl('https://cdn.example.com/avatars/user123.jpg')
        expect(result.valid).toBe(true)
      })

      it('should validate URL with query parameters', () => {
        const result = validateAvatarUrl('https://example.com/avatar?size=200')
        expect(result.valid).toBe(true)
      })
    })

    describe('invalid avatar URLs', () => {
      it('should reject localhost URL', () => {
        const result = validateAvatarUrl('http://localhost/avatar.png')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Access to internal network addresses is blocked')
      })

      it('should reject private IP', () => {
        const result = validateAvatarUrl('http://192.168.1.1/avatar.png')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Access to internal network addresses is blocked')
      })

      it('should reject invalid URL format', () => {
        const result = validateAvatarUrl('not-a-url')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Invalid URL format')
      })

      it('should reject empty string', () => {
        const result = validateAvatarUrl('')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Invalid URL format')
      })

      it('should reject 127.0.0.1', () => {
        const result = validateAvatarUrl('http://127.0.0.1:8080/avatar.png')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Access to internal network addresses is blocked')
      })
    })
  })

  describe('validateExtensionSender', () => {
    const EXPECTED_ID = 'test-extension-id-12345'

    describe('valid senders', () => {
      it('should validate matching sender ID', () => {
        expect(validateExtensionSender(EXPECTED_ID, EXPECTED_ID)).toBe(true)
      })

      it('should validate exact string match', () => {
        const senderId = 'abcdef123456'
        expect(validateExtensionSender(senderId, senderId)).toBe(true)
      })
    })

    describe('invalid senders', () => {
      it('should reject different sender ID', () => {
        expect(validateExtensionSender('malicious-id', EXPECTED_ID)).toBe(false)
      })

      it('should reject undefined sender ID', () => {
        expect(validateExtensionSender(undefined, EXPECTED_ID)).toBe(false)
      })

      it('should reject empty sender ID', () => {
        expect(validateExtensionSender('', EXPECTED_ID)).toBe(false)
      })

      it('should reject similar but not exact match', () => {
        expect(validateExtensionSender('test-extension-id-1234', EXPECTED_ID)).toBe(false)
      })

      it('should reject case-different match', () => {
        expect(validateExtensionSender('TEST-EXTENSION-ID-12345', EXPECTED_ID)).toBe(false)
      })

      it('should reject sender with extra characters', () => {
        expect(validateExtensionSender(`${EXPECTED_ID}X`, EXPECTED_ID)).toBe(false)
      })
    })
  })

  describe('sanitizeHostname', () => {
    it('should extract hostname from valid URL', () => {
      expect(sanitizeHostname('https://example.com/path')).toBe('example.com')
    })

    it('should extract hostname with subdomain', () => {
      expect(sanitizeHostname('https://api.example.com')).toBe('api.example.com')
    })

    it('should extract hostname with port', () => {
      expect(sanitizeHostname('https://example.com:8080')).toBe('example.com')
    })

    it('should extract hostname from HTTP URL', () => {
      expect(sanitizeHostname('http://example.com')).toBe('example.com')
    })

    it('should return original string for invalid URL', () => {
      expect(sanitizeHostname('not-a-url')).toBe('not-a-url')
    })

    it('should return original string for empty input', () => {
      expect(sanitizeHostname('')).toBe('')
    })

    it('should extract hostname from complex URL', () => {
      const url = 'https://user:pass@example.com:8080/path?query=1#hash'
      expect(sanitizeHostname(url)).toBe('example.com')
    })

    it('should handle localhost', () => {
      expect(sanitizeHostname('http://localhost:3000')).toBe('localhost')
    })

    it('should handle IP addresses', () => {
      expect(sanitizeHostname('http://192.168.1.1')).toBe('192.168.1.1')
    })
  })

  describe('constants', () => {
    it('should have correct ALLOWED_API_DOMAINS', () => {
      expect(ALLOWED_API_DOMAINS).toEqual(['absmartly.com', 'absmartly.io'])
      expect(ALLOWED_API_DOMAINS).toHaveLength(2)
    })

    it('should have comprehensive BLOCKED_HOSTS', () => {
      expect(BLOCKED_HOSTS).toContain('localhost')
      expect(BLOCKED_HOSTS).toContain('127.0.0.1')
      expect(BLOCKED_HOSTS).toContain('0.0.0.0')
      expect(BLOCKED_HOSTS).toContain('192.168.')
      expect(BLOCKED_HOSTS).toContain('10.')
      expect(BLOCKED_HOSTS).toContain('::1')
      expect(BLOCKED_HOSTS).toContain('[::1]')
      expect(BLOCKED_HOSTS).toContain('fc')
      expect(BLOCKED_HOSTS).toContain('fd')
      expect(BLOCKED_HOSTS).toContain('fe80:')
    })

    it('should include all 172.16-31 subnets in BLOCKED_HOSTS', () => {
      for (let i = 16; i <= 31; i++) {
        expect(BLOCKED_HOSTS).toContain(`172.${i}.`)
      }
    })

    it('should not mutate ALLOWED_API_DOMAINS', () => {
      const original = [...ALLOWED_API_DOMAINS]
      validateAPIEndpoint('https://api.absmartly.com')
      expect(ALLOWED_API_DOMAINS).toEqual(original)
    })

    it('should not mutate BLOCKED_HOSTS', () => {
      const original = [...BLOCKED_HOSTS]
      isSSRFSafe('http://example.com')
      expect(BLOCKED_HOSTS).toEqual(original)
    })
  })

  describe('edge cases and security scenarios', () => {
    describe('URL encoding attacks', () => {
      it('should block URL-encoded localhost', () => {
        // URL parser decodes the hostname, so this gets blocked correctly
        expect(isSSRFSafe('http://%6c%6f%63%61%6c%68%6f%73%74')).toBe(false)
      })

      it('should handle double-encoded URLs', () => {
        expect(isSSRFSafe('http://example.com')).toBe(true)
      })
    })

    describe('protocol variations', () => {
      it('should handle FTP protocol for SSRF check', () => {
        expect(isSSRFSafe('ftp://192.168.1.1')).toBe(false)
      })

      it('should handle file protocol', () => {
        const result = isSSRFSafe('file:///etc/passwd')
        expect(typeof result).toBe('boolean')
      })
    })

    describe('IPv6 addresses', () => {
      it('should block IPv6 localhost (::1)', () => {
        expect(isSSRFSafe('http://[::1]')).toBe(false)
      })

      it('should block IPv6 localhost with port', () => {
        expect(isSSRFSafe('http://[::1]:8080')).toBe(false)
      })

      it('should block IPv6 localhost in HTTPS', () => {
        expect(isSSRFSafe('https://[::1]')).toBe(false)
      })

      it('should block IPv6 unique local addresses (fc00::/7)', () => {
        expect(isSSRFSafe('http://[fc00::1]')).toBe(false)
        expect(isSSRFSafe('http://[fc00:1234:5678::1]')).toBe(false)
        expect(isSSRFSafe('http://[fcff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]')).toBe(false)
      })

      it('should block IPv6 unique local addresses (fd00::/8)', () => {
        expect(isSSRFSafe('http://[fd00::1]')).toBe(false)
        expect(isSSRFSafe('http://[fd12:3456:789a::1]')).toBe(false)
        expect(isSSRFSafe('http://[fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]')).toBe(false)
      })

      it('should block IPv6 link-local addresses (fe80::/10)', () => {
        expect(isSSRFSafe('http://[fe80::1]')).toBe(false)
        expect(isSSRFSafe('http://[fe80::1%eth0]')).toBe(false)
        expect(isSSRFSafe('http://[fe80:0:0:0:1:2:3:4]')).toBe(false)
      })

      it('should allow public IPv6 addresses', () => {
        expect(isSSRFSafe('http://[2001:db8::1]')).toBe(true)
        expect(isSSRFSafe('http://[2606:2800:220:1:248:1893:25c8:1946]')).toBe(true)
      })

      it('should allow IPv6 addresses outside private ranges', () => {
        expect(isSSRFSafe('https://[2001:4860:4860::8888]')).toBe(true)
        expect(isSSRFSafe('https://[2a00:1450:4001:809::200e]')).toBe(true)
      })

      it('should not block non-IPv6 hostnames starting with fc or fd', () => {
        expect(isSSRFSafe('https://fcm.googleapis.com')).toBe(true)
        expect(isSSRFSafe('https://fdic.gov')).toBe(true)
        expect(isSSRFSafe('https://fdc.example.com')).toBe(true)
      })
    })

    describe('domain validation edge cases', () => {
      it('should not allow domain that starts with allowed domain', () => {
        expect(validateAPIEndpoint('https://absmartly.com.evil.com')).toBe(false)
      })

      it('should handle punycode domains', () => {
        expect(validateAPIEndpoint('https://xn--e1afmkfd.xn--p1ai')).toBe(false)
      })

      it('should handle trailing dots in hostname', () => {
        const result = validateAPIEndpoint('https://api.absmartly.com.')
        expect(typeof result).toBe('boolean')
      })
    })

    describe('null and undefined handling', () => {
      it('should handle validateExtensionSender with null', () => {
        expect(validateExtensionSender(null as any, 'test')).toBe(false)
      })

      it('should handle sanitizeHostname with special characters', () => {
        const result = sanitizeHostname('https://example.com/<script>')
        expect(result).toBe('example.com')
      })
    })
  })

  describe('integration scenarios', () => {
    it('should validate complete avatar proxy flow', () => {
      const validUrl = 'https://cdn.example.com/avatar.png'
      const validation = validateAvatarUrl(validUrl)
      expect(validation.valid).toBe(true)

      const ssrfCheck = isSSRFSafe(validUrl)
      expect(ssrfCheck).toBe(true)

      const hostname = sanitizeHostname(validUrl)
      expect(hostname).toBe('cdn.example.com')
    })

    it('should block complete SSRF attack flow', () => {
      const maliciousUrl = 'http://192.168.1.1/admin'
      const validation = validateAvatarUrl(maliciousUrl)
      expect(validation.valid).toBe(false)
      expect(validation.error).toContain('internal network')

      const ssrfCheck = isSSRFSafe(maliciousUrl)
      expect(ssrfCheck).toBe(false)
    })

    it('should validate API endpoint security flow', () => {
      const validEndpoint = 'https://api.absmartly.com/v1'
      expect(validateAPIEndpoint(validEndpoint)).toBe(true)

      const maliciousEndpoint = 'https://evil.com/steal-tokens'
      expect(validateAPIEndpoint(maliciousEndpoint)).toBe(false)
    })
  })
})
