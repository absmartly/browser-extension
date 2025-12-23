/**
 * Unit tests for CSS selector validator
 * Tests validation of CSS selectors used in DOM manipulation
 */

import { validateSelector, sanitizeSelector } from '../selector-validator'

beforeAll(() => {
  const originalQuerySelector = document.querySelector
  document.querySelector = jest.fn((selector: string) => {
    const hasUnmatchedBracket = (selector.match(/\[/g) || []).length !== (selector.match(/\]/g) || []).length
    const hasUnmatchedParen = (selector.match(/\(/g) || []).length !== (selector.match(/\)/g) || []).length

    if (hasUnmatchedBracket || hasUnmatchedParen) {
      throw new Error('Invalid selector: ' + selector)
    }
    try {
      return originalQuerySelector.call(document, selector)
    } catch (e) {
      throw e
    }
  }) as any
})

afterAll(() => {
  jest.restoreAllMocks()
})

describe('CSS Selector Validator', () => {
  describe('validateSelector', () => {
    describe('valid CSS selectors', () => {
      it('should allow simple element selector', () => {
        expect(validateSelector('div')).toBe(true)
      })

      it('should allow class selector', () => {
        expect(validateSelector('.container')).toBe(true)
      })

      it('should allow ID selector', () => {
        expect(validateSelector('#main')).toBe(true)
      })

      it('should allow descendant selector', () => {
        expect(validateSelector('div span')).toBe(true)
      })

      it('should allow child selector', () => {
        expect(validateSelector('div > span')).toBe(true)
      })

      it('should allow adjacent sibling selector', () => {
        expect(validateSelector('div + span')).toBe(true)
      })

      it('should allow general sibling selector', () => {
        expect(validateSelector('div ~ span')).toBe(true)
      })

      it('should allow attribute selector with equals', () => {
        expect(validateSelector('input[type="text"]')).toBe(true)
      })

      it('should allow attribute selector with starts-with', () => {
        expect(validateSelector('a[href^="https"]')).toBe(true)
      })

      it('should allow attribute selector with ends-with', () => {
        expect(validateSelector('img[src$=".png"]')).toBe(true)
      })

      it('should allow attribute selector with contains', () => {
        expect(validateSelector('div[class*="btn"]')).toBe(true)
      })

      it('should allow attribute selector with word match', () => {
        expect(validateSelector('div[class~="active"]')).toBe(true)
      })

      it('should allow attribute selector with dash match', () => {
        expect(validateSelector('div[lang|="en"]')).toBe(true)
      })

      it('should allow pseudo-class selector', () => {
        expect(validateSelector('a:hover')).toBe(true)
      })

      it('should allow pseudo-element selector', () => {
        expect(validateSelector('p::first-line')).toBe(true)
      })

      it('should allow multiple classes', () => {
        expect(validateSelector('.class1.class2')).toBe(true)
      })

      it('should allow complex selector', () => {
        expect(validateSelector('div.container > ul.list li:first-child')).toBe(true)
      })

      it('should allow universal selector', () => {
        expect(validateSelector('*')).toBe(true)
      })

      it('should allow selector with hyphens', () => {
        expect(validateSelector('.my-class')).toBe(true)
      })

      it('should allow selector with underscores', () => {
        expect(validateSelector('.my_class')).toBe(true)
      })

      it('should allow nth-child selector', () => {
        expect(validateSelector('li:nth-child(2)')).toBe(true)
      })

      it('should allow not pseudo-class', () => {
        expect(validateSelector('div:not(.excluded)')).toBe(true)
      })
    })

    describe('invalid CSS selectors', () => {
      it('should reject empty string', () => {
        expect(validateSelector('')).toBe(false)
      })

      it('should reject non-string input', () => {
        expect(validateSelector(null as any)).toBe(false)
        expect(validateSelector(undefined as any)).toBe(false)
        expect(validateSelector(123 as any)).toBe(false)
      })

      it('should reject selector that is too long', () => {
        const longSelector = '.class'.repeat(200)
        expect(validateSelector(longSelector)).toBe(false)
      })

      it('should reject exactly 1001 characters', () => {
        const selector = 'a'.repeat(1001)
        expect(validateSelector(selector)).toBe(false)
      })

      it('should allow exactly 1000 characters', () => {
        const selector = 'a'.repeat(1000)
        expect(validateSelector(selector)).toBe(true)
      })

      it('should reject invalid CSS selector syntax', () => {
        expect(validateSelector('div[')).toBe(false)
      })

      it('should reject selector with unclosed bracket', () => {
        expect(validateSelector('div[class')).toBe(false)
      })

      it('should reject selector with unclosed parenthesis', () => {
        expect(validateSelector('div:nth-child(2')).toBe(false)
      })
    })

    describe('XSS and injection prevention', () => {
      it('should block javascript: protocol', () => {
        expect(validateSelector('a[href="javascript:alert(1)"]')).toBe(false)
      })

      it('should block javascript: with different case', () => {
        expect(validateSelector('a[href="JAVASCRIPT:alert(1)"]')).toBe(false)
      })

      it('should block script tags', () => {
        expect(validateSelector('div<script>alert(1)</script>')).toBe(false)
      })

      it('should block script tag with uppercase', () => {
        expect(validateSelector('div<SCRIPT>alert(1)</SCRIPT>')).toBe(false)
      })

      it('should block onclick event handler', () => {
        expect(validateSelector('div[onclick="alert(1)"]')).toBe(false)
      })

      it('should block onerror event handler', () => {
        expect(validateSelector('img[onerror="alert(1)"]')).toBe(false)
      })

      it('should block onload event handler', () => {
        expect(validateSelector('body[onload="alert(1)"]')).toBe(false)
      })

      it('should block onmouseover event handler', () => {
        expect(validateSelector('div[onmouseover="alert(1)"]')).toBe(false)
      })

      it('should block data:text/html protocol', () => {
        expect(validateSelector('iframe[src="data:text/html,<script>alert(1)</script>"]')).toBe(false)
      })

      it('should block data:text/html with uppercase', () => {
        expect(validateSelector('iframe[src="DATA:TEXT/HTML,payload"]')).toBe(false)
      })

      it('should block mixed case event handlers', () => {
        expect(validateSelector('div[OnClIcK="alert(1)"]')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should allow selector with numbers', () => {
        expect(validateSelector('.class123')).toBe(true)
      })

      it('should allow selector with attribute quotes', () => {
        expect(validateSelector('input[type="text"]')).toBe(true)
      })

      it('should allow selector with single quotes', () => {
        expect(validateSelector("input[type='text']")).toBe(true)
      })

      it('should allow complex real-world selector', () => {
        expect(validateSelector('div.container > ul#menu li.active a[class="link"]')).toBe(true)
      })

      it('should allow pseudo-class with parentheses', () => {
        expect(validateSelector('li:nth-child(odd)')).toBe(true)
      })

      it('should allow attribute selector without value', () => {
        expect(validateSelector('input[required]')).toBe(true)
      })

      it('should handle selector with spaces', () => {
        expect(validateSelector('div .class')).toBe(true)
      })

      it('should allow common UI component selectors', () => {
        expect(validateSelector('.btn-primary')).toBe(true)
        expect(validateSelector('#nav-menu')).toBe(true)
        expect(validateSelector('button.submit')).toBe(true)
      })
    })
  })

  describe('sanitizeSelector', () => {
    it('should remove unsafe characters', () => {
      const result = sanitizeSelector('div<script>')
      expect(result).not.toContain('<')
      expect(result).toContain('>')
    })

    it('should preserve safe characters', () => {
      const selector = 'div.class#id'
      const result = sanitizeSelector(selector)
      expect(result).toContain('div')
      expect(result).toContain('.')
      expect(result).toContain('class')
      expect(result).toContain('#')
      expect(result).toContain('id')
    })

    it('should truncate to 1000 characters', () => {
      const longSelector = '.class'.repeat(200)
      const result = sanitizeSelector(longSelector)
      expect(result.length).toBeLessThanOrEqual(1000)
    })

    it('should remove semicolons', () => {
      const result = sanitizeSelector('div;alert(1)')
      expect(result).not.toContain(';')
    })

    it('should remove script tags opening brackets but keep child combinator', () => {
      const result = sanitizeSelector('div<script>alert(1)</script>')
      expect(result).not.toContain('<')
      expect(result).toContain('>')
      expect(result).toContain('script')
    })

    it('should preserve brackets and quotes', () => {
      const result = sanitizeSelector('input[type="text"]')
      expect(result).toContain('[')
      expect(result).toContain(']')
      expect(result).toContain('"')
    })

    it('should preserve pseudo-class syntax', () => {
      const result = sanitizeSelector('a:hover')
      expect(result).toContain(':')
    })

    it('should preserve child combinator', () => {
      const result = sanitizeSelector('div > span')
      expect(result).toContain('>')
    })

    it('should preserve adjacent sibling combinator', () => {
      const result = sanitizeSelector('div + span')
      expect(result).toContain('+')
    })

    it('should preserve general sibling combinator', () => {
      const result = sanitizeSelector('div ~ span')
      expect(result).toContain('~')
    })

    it('should handle empty string', () => {
      expect(sanitizeSelector('')).toBe('')
    })

    it('should handle string with only unsafe characters', () => {
      const result = sanitizeSelector('<!@#%&{}\\|`')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('integration scenarios', () => {
    it('should validate and sanitize consistently for valid selector', () => {
      const selector = 'div.container > ul li'
      expect(validateSelector(selector)).toBe(true)
      expect(sanitizeSelector(selector)).toBe(selector)
    })

    it('should reject what sanitization cannot fully fix', () => {
      const selector = 'div<script>alert(1)</script>'
      expect(validateSelector(selector)).toBe(false)
    })

    it('should handle real-world DOM manipulation selectors', () => {
      expect(validateSelector('.modal-overlay')).toBe(true)
      expect(validateSelector('#app > div.container')).toBe(true)
      expect(validateSelector('button[data-action="submit"]')).toBe(true)
    })

    it('should block common XSS attack patterns', () => {
      expect(validateSelector('img[src="javascript:alert(1)"]')).toBe(false)
      expect(validateSelector('div[onclick="steal()"]')).toBe(false)
      expect(validateSelector('iframe[src="data:text/html,<script>"]')).toBe(false)
    })

    it('should allow safe attribute selectors', () => {
      expect(validateSelector('a[class="nav-link"]')).toBe(true)
      expect(validateSelector('img[alt="logo"]')).toBe(true)
      expect(validateSelector('input[placeholder="Enter-email"]')).toBe(true)
    })

    it('should validate selectors that querySelector would accept', () => {
      const validSelectors = [
        'div',
        '.class',
        '#id',
        'div.class',
        'div > span',
        'div + span',
        'div ~ span',
        'div span',
        'div[attr]',
        'div[attr="value"]',
        'div:hover',
        'div::before',
        'div:nth-child(2)',
        'div:not(.excluded)'
      ]

      for (const selector of validSelectors) {
        expect(validateSelector(selector)).toBe(true)
      }
    })
  })
})
