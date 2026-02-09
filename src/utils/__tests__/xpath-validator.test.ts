/**
 * Unit tests for XPath validator
 * Tests validation of XPath expressions from AI providers
 */

import { validateXPath, sanitizeXPath } from '../xpath-validator'

describe('XPath Validator', () => {
  describe('validateXPath', () => {
    describe('valid XPath expressions', () => {
      it('should allow simple element selection', () => {
        expect(validateXPath('//div').valid).toBe(true)
      })

      it('should allow XPath with class attribute', () => {
        expect(validateXPath("//div[@class='container']").valid).toBe(true)
      })

      it('should allow XPath with id attribute', () => {
        expect(validateXPath("//div[@id='main']").valid).toBe(true)
      })

      it('should allow XPath with multiple attributes', () => {
        expect(validateXPath("//div[@class='container'][@data-test='value']").valid).toBe(true)
      })

      it('should reject XPath with contains function due to comma', () => {
        expect(validateXPath("//div[contains(@class, 'test')]").valid).toBe(false)
      })

      it('should allow XPath with nested elements', () => {
        expect(validateXPath('//div/span/a').valid).toBe(true)
      })

      it('should allow XPath with wildcard', () => {
        expect(validateXPath('//*[@class="test"]').valid).toBe(true)
      })

      it('should allow XPath with position', () => {
        expect(validateXPath('//div[1]').valid).toBe(true)
      })

      it('should allow XPath with text content check', () => {
        expect(validateXPath("//div[text()='Submit']").valid).toBe(true)
      })

      it('should reject XPath with starts-with function due to comma', () => {
        expect(validateXPath("//div[starts-with(@class, 'btn')]").valid).toBe(false)
      })

      it('should allow XPath with double quotes', () => {
        expect(validateXPath('//div[@class="test"]').valid).toBe(true)
      })

      it('should allow XPath with single quotes', () => {
        expect(validateXPath("//div[@class='test']").valid).toBe(true)
      })

      it('should reject complex XPath with function due to comma', () => {
        expect(validateXPath("//div[@class='container']//span[contains(@class, 'text')]").valid).toBe(false)
      })
    })

    describe('invalid XPath expressions', () => {
      it('should reject empty string', () => {
        const result = validateXPath('')
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      })

      it('should reject non-string input', () => {
        expect(validateXPath(null as any).valid).toBe(false)
        expect(validateXPath(undefined as any).valid).toBe(false)
        expect(validateXPath(123 as any).valid).toBe(false)
      })

      it('should reject XPath without leading //', () => {
        const result = validateXPath('div[@class="test"]')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('unsafe characters')
      })

      it('should reject XPath with special characters', () => {
        expect(validateXPath('//div<script>').valid).toBe(false)
      })

      it('should reject XPath with semicolon', () => {
        expect(validateXPath('//div;alert(1)').valid).toBe(false)
      })

      it('should reject XPath with pipe for command injection', () => {
        expect(validateXPath('//div|cat /etc/passwd').valid).toBe(false)
      })

      it('should reject XPath with backticks', () => {
        expect(validateXPath('//div`whoami`').valid).toBe(false)
      })

      it('should reject XPath with curly braces', () => {
        expect(validateXPath('//div{}').valid).toBe(false)
      })

      it('should reject XPath with parent traversal', () => {
        expect(validateXPath('//div/../script').valid).toBe(false)
      })

      it('should reject XPath with axis selectors', () => {
        expect(validateXPath('//div/following::script').valid).toBe(false)
      })

      it('should reject XPath that is too long', () => {
        const longXPath = '//' + 'div'.repeat(200)
        const result = validateXPath(longXPath)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('too long')
      })

      it('should reject exactly 501 characters', () => {
        const xpath = '//' + 'a'.repeat(499)
        expect(validateXPath(xpath).valid).toBe(false)
      })

      it('should allow exactly 500 characters', () => {
        const xpath = '//' + 'a'.repeat(498)
        expect(validateXPath(xpath).valid).toBe(true)
      })
    })

    describe('dangerous pattern detection', () => {
      it('should block XPath targeting password fields', () => {
        const result = validateXPath("//input[@type='password']")
        expect(result.valid).toBe(false)
        expect(result.error).toContain('sensitive')
      })

      it('should block XPath targeting password with different case', () => {
        expect(validateXPath("//input[@name='PASSWORD']").valid).toBe(false)
      })

      it('should block XPath targeting secret fields', () => {
        expect(validateXPath("//input[@name='secret']").valid).toBe(false)
      })

      it('should block XPath targeting token fields', () => {
        expect(validateXPath("//input[@id='auth-token']").valid).toBe(false)
      })

      it('should block XPath targeting auth fields', () => {
        expect(validateXPath("//div[@class='auth-form']").valid).toBe(false)
      })

      it('should block XPath targeting credit card fields', () => {
        expect(validateXPath("//input[@name='credit-card']").valid).toBe(false)
      })

      it('should block XPath targeting credit card with different spacing', () => {
        expect(validateXPath("//input[@name='creditcard']").valid).toBe(false)
      })

      it('should block XPath targeting SSN fields', () => {
        expect(validateXPath("//input[@name='ssn']").valid).toBe(false)
      })

      it('should block XPath targeting sensitive data', () => {
        expect(validateXPath("//div[@class='sensitive-data']").valid).toBe(false)
      })

      it('should block case-insensitive password match', () => {
        expect(validateXPath("//input[@name='PaSsWoRd']").valid).toBe(false)
      })

      it('should block password in middle of XPath', () => {
        expect(validateXPath("//div//input[@type='password']//span").valid).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle XPath with numbers', () => {
        expect(validateXPath('//div123').valid).toBe(true)
      })

      it('should handle XPath with hyphens', () => {
        expect(validateXPath('//div-container').valid).toBe(true)
      })

      it('should handle XPath with underscores', () => {
        expect(validateXPath('//div_container').valid).toBe(true)
      })

      it('should handle XPath with dots', () => {
        expect(validateXPath("//div[@class='test.class']").valid).toBe(true)
      })

      it('should handle XPath with spaces in attribute values', () => {
        expect(validateXPath("//div[@class='btn btn-primary']").valid).toBe(true)
      })

      it('should handle XPath with colons (for namespaces)', () => {
        expect(validateXPath('//svg:path').valid).toBe(true)
      })

      it('should reject XPath with parentheses and commas in functions', () => {
        expect(validateXPath("//div[contains(text(), 'test')]").valid).toBe(false)
      })

      it('should allow safe common UI elements', () => {
        expect(validateXPath("//button[@class='submit-btn']").valid).toBe(true)
        expect(validateXPath("//a[@href='/home']").valid).toBe(true)
        expect(validateXPath("//img[@alt='logo']").valid).toBe(true)
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
      expect(validateXPath(xpath).valid).toBe(true)
      expect(sanitizeXPath(xpath)).toBe(xpath)
    })

    it('should reject what sanitization cannot fully fix', () => {
      const xpath = '//password-field'
      expect(validateXPath(xpath).valid).toBe(false)
    })

    it('should handle real-world AI-generated XPath examples', () => {
      expect(validateXPath("//div[@id='main']//header").valid).toBe(true)
      expect(validateXPath("//*[@class='submit']").valid).toBe(true)
      expect(validateXPath("//button[@type='submit']").valid).toBe(true)
    })

    it('should block common attack patterns', () => {
      expect(validateXPath("//input[@type='password']").valid).toBe(false)
      expect(validateXPath('//div;console.log(1)').valid).toBe(false)
      expect(validateXPath('//div<img src=x onerror=alert(1)>').valid).toBe(false)
    })
  })

  describe('XPath injection prevention', () => {
    describe('SQL-style injection attempts', () => {
      it('should block classic OR 1=1 injection', () => {
        const result = validateXPath("//user[name='admin' or '1'='1']")
        expect(result.valid).toBe(false)
        expect(result.error).toContain('suspicious pattern')
      })

      it('should block OR true() injection', () => {
        expect(validateXPath("//user[name='admin' or true()]").valid).toBe(false)
      })

      it('should block AND 1=1 injection with double quotes', () => {
        expect(validateXPath('//user[name="admin" and "1"="1"]').valid).toBe(false)
      })

      it('should block boolean logic injection variations', () => {
        expect(validateXPath("//user[id='1' or '1'='1']").valid).toBe(false)
        expect(validateXPath("//user[id='1' and '1'='1']").valid).toBe(false)
      })

      it('should block injection with whitespace variations', () => {
        expect(validateXPath("//user[name='admin'or'1'='1']").valid).toBe(false)
        expect(validateXPath("//user[name='admin' OR '1'='1']").valid).toBe(false)
      })
    })

    describe('dangerous XPath functions', () => {
      it('should block document() function', () => {
        const result = validateXPath("//div[document('file.xml')]")
        expect(result.valid).toBe(false)
        expect(result.error).toContain('dangerous function')
      })

      it('should block string() function', () => {
        expect(validateXPath("//div[string(@id)]").valid).toBe(false)
      })

      it('should block normalize-space() function', () => {
        expect(validateXPath("//div[normalize-space(text())]").valid).toBe(false)
      })

      it('should block substring() function', () => {
        expect(validateXPath("//div[substring(@id, 1, 3)]").valid).toBe(false)
      })

      it('should block concat() function', () => {
        expect(validateXPath("//div[concat(@class, 'test')]").valid).toBe(false)
      })

      it('should block translate() function', () => {
        expect(validateXPath("//div[translate(@id, 'abc', 'xyz')]").valid).toBe(false)
      })

      it('should block sum() function', () => {
        expect(validateXPath("//div[sum(//price)]").valid).toBe(false)
      })

      it('should block count() function', () => {
        expect(validateXPath("//div[count(//item)]").valid).toBe(false)
      })

      it('should block boolean() function', () => {
        expect(validateXPath("//div[boolean(@disabled)]").valid).toBe(false)
      })

      it('should block number() function', () => {
        expect(validateXPath("//div[number(@value)]").valid).toBe(false)
      })

      it('should block id() function', () => {
        expect(validateXPath("//div[id('element-id')]").valid).toBe(false)
      })

      it('should block local-name() function', () => {
        expect(validateXPath("//div[local-name()='div']").valid).toBe(false)
      })

      it('should block namespace-uri() function', () => {
        expect(validateXPath("//div[namespace-uri()]").valid).toBe(false)
      })

      it('should block name() function', () => {
        expect(validateXPath("//div[name()='div']").valid).toBe(false)
      })

      it('should allow safe text() function', () => {
        expect(validateXPath("//div[text()='Submit']").valid).toBe(true)
      })

      it('should block document() with file path attack', () => {
        const result = validateXPath("//div[document('file:///etc/passwd')]")
        expect(result.valid).toBe(false)
        expect(result.error).toContain('dangerous function')
      })

      it('should block string() for data extraction', () => {
        const result = validateXPath("//node[contains(string(), 'secret')]")
        expect(result.valid).toBe(false)
      })
    })

    describe('malicious selector patterns', () => {
      it('should block XPath attempting to access script elements', () => {
        expect(validateXPath("//div[@id='test']/script").valid).toBe(false)
      })

      it('should block XPath with script in selector', () => {
        expect(validateXPath('//div<script>').valid).toBe(false)
      })

      it('should block XPath targeting sensitive authentication elements', () => {
        expect(validateXPath("//input[@type='password']").valid).toBe(false)
        expect(validateXPath("//input[@name='auth-token']").valid).toBe(false)
      })

      it('should block XPath with SQL-like comments', () => {
        expect(validateXPath('//div[--comment]').valid).toBe(false)
      })
    })

    describe('complex injection scenarios', () => {
      it('should block nested injection attempts', () => {
        expect(validateXPath("//user[name='admin']//password[text()='secret' or '1'='1']").valid).toBe(false)
      })

      it('should block case-insensitive injection', () => {
        expect(validateXPath("//user[name='admin' OR '1'='1']").valid).toBe(false)
        expect(validateXPath("//user[name='admin' Or '1'='1']").valid).toBe(false)
      })

      it('should block multiple boolean logic chains', () => {
        expect(validateXPath("//user[id='1' and '1'='1' or '2'='2']").valid).toBe(false)
      })
    })

    describe('edge cases that should still work', () => {
      it('should allow valid predicates with numbers', () => {
        expect(validateXPath('//div[1]').valid).toBe(true)
        expect(validateXPath('//div[2]').valid).toBe(true)
      })

      it('should allow valid attribute comparisons', () => {
        expect(validateXPath("//div[@class='btn']").valid).toBe(true)
        expect(validateXPath("//div[@id='main']").valid).toBe(true)
      })

      it('should allow text() with simple values', () => {
        expect(validateXPath("//button[text()='Submit']").valid).toBe(true)
        expect(validateXPath("//span[text()='Hello World']").valid).toBe(true)
      })

      it('should allow nested element selectors', () => {
        expect(validateXPath('//div//span//a').valid).toBe(true)
        expect(validateXPath("//div[@id='main']//button[@class='submit']").valid).toBe(true)
      })
    })
  })
})
