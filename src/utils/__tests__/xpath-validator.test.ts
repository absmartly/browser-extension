/**
 * Unit tests for XPath validator
 * Tests validation of XPath expressions from AI providers
 */

import { validateXPath, sanitizeXPath } from '../xpath-validator'

describe('XPath Validator', () => {
  describe('validateXPath', () => {
    describe('valid XPath expressions', () => {
      it('should allow simple element selection', () => {
        expect(validateXPath('//div')).toBe(true)
      })

      it('should allow XPath with class attribute', () => {
        expect(validateXPath("//div[@class='container']")).toBe(true)
      })

      it('should allow XPath with id attribute', () => {
        expect(validateXPath("//div[@id='main']")).toBe(true)
      })

      it('should allow XPath with multiple attributes', () => {
        expect(validateXPath("//div[@class='container'][@data-test='value']")).toBe(true)
      })

      it('should reject XPath with contains function due to comma', () => {
        expect(validateXPath("//div[contains(@class, 'test')]")).toBe(false)
      })

      it('should allow XPath with nested elements', () => {
        expect(validateXPath('//div/span/a')).toBe(true)
      })

      it('should allow XPath with wildcard', () => {
        expect(validateXPath('//*[@class="test"]')).toBe(true)
      })

      it('should allow XPath with position', () => {
        expect(validateXPath('//div[1]')).toBe(true)
      })

      it('should allow XPath with text content check', () => {
        expect(validateXPath("//div[text()='Submit']")).toBe(true)
      })

      it('should reject XPath with starts-with function due to comma', () => {
        expect(validateXPath("//div[starts-with(@class, 'btn')]")).toBe(false)
      })

      it('should allow XPath with double quotes', () => {
        expect(validateXPath('//div[@class="test"]')).toBe(true)
      })

      it('should allow XPath with single quotes', () => {
        expect(validateXPath("//div[@class='test']")).toBe(true)
      })

      it('should reject complex XPath with function due to comma', () => {
        expect(validateXPath("//div[@class='container']//span[contains(@class, 'text')]")).toBe(false)
      })
    })

    describe('invalid XPath expressions', () => {
      it('should reject empty string', () => {
        expect(validateXPath('')).toBe(false)
      })

      it('should reject non-string input', () => {
        expect(validateXPath(null as any)).toBe(false)
        expect(validateXPath(undefined as any)).toBe(false)
        expect(validateXPath(123 as any)).toBe(false)
      })

      it('should reject XPath without leading //', () => {
        expect(validateXPath('div[@class="test"]')).toBe(false)
      })

      it('should reject XPath with special characters', () => {
        expect(validateXPath('//div<script>')).toBe(false)
      })

      it('should reject XPath with semicolon', () => {
        expect(validateXPath('//div;alert(1)')).toBe(false)
      })

      it('should reject XPath with pipe for command injection', () => {
        expect(validateXPath('//div|cat /etc/passwd')).toBe(false)
      })

      it('should reject XPath with backticks', () => {
        expect(validateXPath('//div`whoami`')).toBe(false)
      })

      it('should reject XPath with curly braces', () => {
        expect(validateXPath('//div{}')).toBe(false)
      })

      it('should reject XPath that is too long', () => {
        const longXPath = '//' + 'div'.repeat(200)
        expect(validateXPath(longXPath)).toBe(false)
      })

      it('should reject exactly 501 characters', () => {
        const xpath = '//' + 'a'.repeat(499)
        expect(validateXPath(xpath)).toBe(false)
      })

      it('should allow exactly 500 characters', () => {
        const xpath = '//' + 'a'.repeat(498)
        expect(validateXPath(xpath)).toBe(true)
      })
    })

    describe('dangerous pattern detection', () => {
      it('should block XPath targeting password fields', () => {
        expect(validateXPath("//input[@type='password']")).toBe(false)
      })

      it('should block XPath targeting password with different case', () => {
        expect(validateXPath("//input[@name='PASSWORD']")).toBe(false)
      })

      it('should block XPath targeting secret fields', () => {
        expect(validateXPath("//input[@name='secret']")).toBe(false)
      })

      it('should block XPath targeting token fields', () => {
        expect(validateXPath("//input[@id='auth-token']")).toBe(false)
      })

      it('should block XPath targeting auth fields', () => {
        expect(validateXPath("//div[@class='auth-form']")).toBe(false)
      })

      it('should block XPath targeting credit card fields', () => {
        expect(validateXPath("//input[@name='credit-card']")).toBe(false)
      })

      it('should block XPath targeting credit card with different spacing', () => {
        expect(validateXPath("//input[@name='creditcard']")).toBe(false)
      })

      it('should block XPath targeting SSN fields', () => {
        expect(validateXPath("//input[@name='ssn']")).toBe(false)
      })

      it('should block XPath targeting sensitive data', () => {
        expect(validateXPath("//div[@class='sensitive-data']")).toBe(false)
      })

      it('should block case-insensitive password match', () => {
        expect(validateXPath("//input[@name='PaSsWoRd']")).toBe(false)
      })

      it('should block password in middle of XPath', () => {
        expect(validateXPath("//div//input[@type='password']//span")).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle XPath with numbers', () => {
        expect(validateXPath('//div123')).toBe(true)
      })

      it('should handle XPath with hyphens', () => {
        expect(validateXPath('//div-container')).toBe(true)
      })

      it('should handle XPath with underscores', () => {
        expect(validateXPath('//div_container')).toBe(true)
      })

      it('should handle XPath with dots', () => {
        expect(validateXPath("//div[@class='test.class']")).toBe(true)
      })

      it('should handle XPath with spaces in attribute values', () => {
        expect(validateXPath("//div[@class='btn btn-primary']")).toBe(true)
      })

      it('should handle XPath with colons (for namespaces)', () => {
        expect(validateXPath('//svg:path')).toBe(true)
      })

      it('should reject XPath with parentheses and commas in functions', () => {
        expect(validateXPath("//div[contains(text(), 'test')]")).toBe(false)
      })

      it('should allow safe common UI elements', () => {
        expect(validateXPath("//button[@class='submit-btn']")).toBe(true)
        expect(validateXPath("//a[@href='/home']")).toBe(true)
        expect(validateXPath("//img[@alt='logo']")).toBe(true)
      })
    })
  })

  describe('sanitizeXPath', () => {
    it('should remove unsafe characters', () => {
      const result = sanitizeXPath('//div<script>')
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
    })

    it('should preserve safe characters', () => {
      const xpath = "//div[@class='test']"
      const result = sanitizeXPath(xpath)
      expect(result).toContain('//')
      expect(result).toContain('div')
      expect(result).toContain('@class')
    })

    it('should truncate to 500 characters', () => {
      const longXPath = '//' + 'a'.repeat(600)
      const result = sanitizeXPath(longXPath)
      expect(result.length).toBeLessThanOrEqual(500)
    })

    it('should remove semicolons', () => {
      const result = sanitizeXPath('//div;alert(1)')
      expect(result).not.toContain(';')
    })

    it('should remove backticks', () => {
      const result = sanitizeXPath('//div`whoami`')
      expect(result).not.toContain('`')
    })

    it('should remove pipe characters', () => {
      const result = sanitizeXPath('//div|cat')
      expect(result).not.toContain('|')
    })

    it('should preserve brackets and quotes', () => {
      const result = sanitizeXPath("//div[@class='test']")
      expect(result).toContain('[')
      expect(result).toContain(']')
      expect(result).toContain("'")
    })

    it('should handle empty string', () => {
      expect(sanitizeXPath('')).toBe('')
    })

    it('should handle string with only unsafe characters', () => {
      const result = sanitizeXPath('<>{}|`')
      expect(result).toBe('')
    })
  })

  describe('integration scenarios', () => {
    it('should validate and sanitize consistently for valid XPath', () => {
      const xpath = "//div[@class='container']"
      expect(validateXPath(xpath)).toBe(true)
      expect(sanitizeXPath(xpath)).toBe(xpath)
    })

    it('should reject what sanitization cannot fully fix', () => {
      const xpath = '//password-field'
      expect(validateXPath(xpath)).toBe(false)
    })

    it('should handle real-world AI-generated XPath examples', () => {
      expect(validateXPath("//div[@id='main']//header")).toBe(true)
      expect(validateXPath("//*[@class='submit']")).toBe(true)
      expect(validateXPath("//button[@type='submit']")).toBe(true)
    })

    it('should block common attack patterns', () => {
      expect(validateXPath("//input[@type='password']")).toBe(false)
      expect(validateXPath('//div;console.log(1)')).toBe(false)
      expect(validateXPath('//div<img src=x onerror=alert(1)>')).toBe(false)
    })
  })
})
