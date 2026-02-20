import {
  experimentId,
  variantName,
  cssSelector,
  xpathSelector,
  apiEndpoint,
  applicationId,
  conversationId,
  sessionId,
  unsafeExperimentId,
  unsafeVariantName,
  unsafeCSSSelector,
  unsafeXPathSelector,
  unsafeAPIEndpoint,
  unsafeApplicationId,
  unsafeConversationId,
  unsafeSessionId,
  type ExperimentId,
  type VariantName,
  type CSSSelector,
  type XPathSelector,
  type APIEndpoint,
  type ApplicationId,
  type ConversationId,
  type SessionId
} from '../branded'

describe('Branded Types', () => {
  describe('ExperimentId', () => {
    describe('experimentId constructor', () => {
      it('should accept positive integers', () => {
        expect(experimentId(1)).toBe(1)
        expect(experimentId(42)).toBe(42)
        expect(experimentId(999999)).toBe(999999)
      })

      it('should reject zero', () => {
        expect(() => experimentId(0)).toThrow('Invalid experiment ID: 0. Must be a positive integer.')
      })

      it('should reject negative numbers', () => {
        expect(() => experimentId(-1)).toThrow('Invalid experiment ID: -1. Must be a positive integer.')
        expect(() => experimentId(-42)).toThrow('Invalid experiment ID: -42. Must be a positive integer.')
      })

      it('should reject floats', () => {
        expect(() => experimentId(3.14)).toThrow('Invalid experiment ID: 3.14. Must be a positive integer.')
        expect(() => experimentId(1.5)).toThrow('Invalid experiment ID: 1.5. Must be a positive integer.')
      })

      it('should reject NaN', () => {
        expect(() => experimentId(NaN)).toThrow('Invalid experiment ID: NaN. Must be a positive integer.')
      })

      it('should reject Infinity', () => {
        expect(() => experimentId(Infinity)).toThrow('Invalid experiment ID: Infinity. Must be a positive integer.')
        expect(() => experimentId(-Infinity)).toThrow('Invalid experiment ID: -Infinity. Must be a positive integer.')
      })
    })

    describe('unsafeExperimentId constructor', () => {
      it('should accept any number without validation', () => {
        expect(unsafeExperimentId(0)).toBe(0)
        expect(unsafeExperimentId(-1)).toBe(-1)
        expect(unsafeExperimentId(3.14)).toBe(3.14)
      })
    })
  })

  describe('VariantName', () => {
    describe('variantName constructor', () => {
      it('should accept non-empty strings', () => {
        expect(variantName('control')).toBe('control')
        expect(variantName('variant-1')).toBe('variant-1')
        expect(variantName('Test Variant')).toBe('Test Variant')
      })

      it('should trim whitespace', () => {
        expect(variantName('  control  ')).toBe('control')
        expect(variantName('\tvariant\n')).toBe('variant')
      })

      it('should reject empty strings', () => {
        expect(() => variantName('')).toThrow('Invalid variant name:')
      })

      it('should reject whitespace-only strings', () => {
        expect(() => variantName('   ')).toThrow('Invalid variant name')
        expect(() => variantName('\t\n')).toThrow('Invalid variant name')
      })

      it('should reject non-strings', () => {
        expect(() => variantName(null as any)).toThrow('Invalid variant name')
        expect(() => variantName(undefined as any)).toThrow('Invalid variant name')
        expect(() => variantName(123 as any)).toThrow('Invalid variant name')
      })
    })

    describe('unsafeVariantName constructor', () => {
      it('should accept any string without validation', () => {
        expect(unsafeVariantName('')).toBe('')
        expect(unsafeVariantName('   ')).toBe('   ')
      })
    })
  })

  describe('CSSSelector', () => {
    describe('cssSelector constructor', () => {
      it('should accept valid CSS selectors', () => {
        expect(cssSelector('.class')).toBe('.class')
        expect(cssSelector('#id')).toBe('#id')
        expect(cssSelector('div')).toBe('div')
        expect(cssSelector('div > .class')).toBe('div > .class')
        expect(cssSelector('[data-test="value"]')).toBe('[data-test="value"]')
        expect(cssSelector('button:hover')).toBe('button:hover')
      })

      it('should trim whitespace', () => {
        expect(cssSelector('  .class  ')).toBe('.class')
        expect(cssSelector('\t#id\n')).toBe('#id')
      })

      it('should reject empty strings', () => {
        expect(() => cssSelector('')).toThrow('Invalid CSS selector')
      })

      it('should reject whitespace-only strings', () => {
        expect(() => cssSelector('   ')).toThrow('Invalid CSS selector')
      })

      it('should reject invalid CSS selector syntax', () => {
        expect(() => cssSelector('[')).toThrow('Invalid CSS selector syntax')
        expect(() => cssSelector('div[')).toThrow('Invalid CSS selector syntax')
        expect(() => cssSelector('::')).toThrow('Invalid CSS selector syntax')
      })

      it('should reject non-strings', () => {
        expect(() => cssSelector(null as any)).toThrow('Invalid CSS selector')
        expect(() => cssSelector(undefined as any)).toThrow('Invalid CSS selector')
      })
    })

    describe('unsafeCSSSelector constructor', () => {
      it('should accept any string without validation', () => {
        expect(unsafeCSSSelector('')).toBe('')
        expect(unsafeCSSSelector('[')).toBe('[')
      })
    })
  })

  describe('XPathSelector', () => {
    describe('xpathSelector constructor', () => {
      it('should accept non-empty strings', () => {
        expect(xpathSelector('//div')).toBe('//div')
        expect(xpathSelector('//button[@id="submit"]')).toBe('//button[@id="submit"]')
        expect(xpathSelector('/html/body/div[1]')).toBe('/html/body/div[1]')
      })

      it('should trim whitespace', () => {
        expect(xpathSelector('  //div  ')).toBe('//div')
        expect(xpathSelector('\t//button\n')).toBe('//button')
      })

      it('should reject empty strings', () => {
        expect(() => xpathSelector('')).toThrow('Invalid XPath selector')
      })

      it('should reject whitespace-only strings', () => {
        expect(() => xpathSelector('   ')).toThrow('Invalid XPath selector')
      })

      it('should reject non-strings', () => {
        expect(() => xpathSelector(null as any)).toThrow('Invalid XPath selector')
        expect(() => xpathSelector(undefined as any)).toThrow('Invalid XPath selector')
      })
    })

    describe('unsafeXPathSelector constructor', () => {
      it('should accept any string without validation', () => {
        expect(unsafeXPathSelector('')).toBe('')
        expect(unsafeXPathSelector('   ')).toBe('   ')
      })
    })
  })

  describe('APIEndpoint', () => {
    describe('apiEndpoint constructor', () => {
      it('should accept valid HTTP URLs', () => {
        expect(apiEndpoint('http://localhost:3000')).toBe('http://localhost:3000')
        expect(apiEndpoint('http://example.com')).toBe('http://example.com')
        expect(apiEndpoint('http://api.example.com/v1')).toBe('http://api.example.com/v1')
      })

      it('should accept valid HTTPS URLs', () => {
        expect(apiEndpoint('https://api.absmartly.com')).toBe('https://api.absmartly.com')
        expect(apiEndpoint('https://example.com:8080')).toBe('https://example.com:8080')
        expect(apiEndpoint('https://api.example.com/v1/experiments')).toBe('https://api.example.com/v1/experiments')
      })

      it('should trim whitespace', () => {
        expect(apiEndpoint('  https://api.example.com  ')).toBe('https://api.example.com')
        expect(apiEndpoint('\thttps://api.example.com\n')).toBe('https://api.example.com')
      })

      it('should reject empty strings', () => {
        expect(() => apiEndpoint('')).toThrow('Invalid API endpoint')
      })

      it('should reject whitespace-only strings', () => {
        expect(() => apiEndpoint('   ')).toThrow('Invalid API endpoint')
      })

      it('should reject non-HTTP(S) protocols', () => {
        expect(() => apiEndpoint('ftp://example.com')).toThrow('Protocol must be http or https')
        expect(() => apiEndpoint('file:///etc/passwd')).toThrow('Protocol must be http or https')
        expect(() => apiEndpoint('javascript:alert(1)')).toThrow('Invalid API endpoint URL')
        expect(() => apiEndpoint('data:text/html,<script>alert(1)</script>')).toThrow('Protocol must be http or https')
      })

      it('should reject invalid URLs', () => {
        expect(() => apiEndpoint('not a url')).toThrow('Invalid API endpoint URL')
        expect(() => apiEndpoint('://invalid')).toThrow('Invalid API endpoint URL')
      })

      it('should reject non-strings', () => {
        expect(() => apiEndpoint(null as any)).toThrow('Invalid API endpoint')
        expect(() => apiEndpoint(undefined as any)).toThrow('Invalid API endpoint')
      })
    })

    describe('unsafeAPIEndpoint constructor', () => {
      it('should accept any string without validation', () => {
        expect(unsafeAPIEndpoint('')).toBe('')
        expect(unsafeAPIEndpoint('invalid')).toBe('invalid')
      })
    })
  })

  describe('ApplicationId', () => {
    describe('applicationId constructor', () => {
      it('should accept positive integers', () => {
        expect(applicationId(1)).toBe(1)
        expect(applicationId(42)).toBe(42)
        expect(applicationId(999999)).toBe(999999)
      })

      it('should reject zero', () => {
        expect(() => applicationId(0)).toThrow('Invalid application ID: 0. Must be a positive integer.')
      })

      it('should reject negative numbers', () => {
        expect(() => applicationId(-1)).toThrow('Invalid application ID: -1. Must be a positive integer.')
      })

      it('should reject floats', () => {
        expect(() => applicationId(3.14)).toThrow('Invalid application ID: 3.14. Must be a positive integer.')
      })
    })

    describe('unsafeApplicationId constructor', () => {
      it('should accept any number without validation', () => {
        expect(unsafeApplicationId(0)).toBe(0)
        expect(unsafeApplicationId(-1)).toBe(-1)
      })
    })
  })

  describe('ConversationId', () => {
    describe('conversationId constructor', () => {
      it('should accept non-empty strings', () => {
        expect(conversationId('conv-123')).toBe('conv-123')
        expect(conversationId('uuid-abc-def-ghi')).toBe('uuid-abc-def-ghi')
      })

      it('should trim whitespace', () => {
        expect(conversationId('  conv-123  ')).toBe('conv-123')
      })

      it('should reject empty strings', () => {
        expect(() => conversationId('')).toThrow('Invalid conversation ID')
      })

      it('should reject whitespace-only strings', () => {
        expect(() => conversationId('   ')).toThrow('Invalid conversation ID')
      })

      it('should reject non-strings', () => {
        expect(() => conversationId(null as any)).toThrow('Invalid conversation ID')
        expect(() => conversationId(undefined as any)).toThrow('Invalid conversation ID')
      })
    })

    describe('unsafeConversationId constructor', () => {
      it('should accept any string without validation', () => {
        expect(unsafeConversationId('')).toBe('')
      })
    })
  })

  describe('SessionId', () => {
    describe('sessionId constructor', () => {
      it('should accept non-empty strings', () => {
        expect(sessionId('session-123')).toBe('session-123')
        expect(sessionId('uuid-abc-def-ghi')).toBe('uuid-abc-def-ghi')
      })

      it('should trim whitespace', () => {
        expect(sessionId('  session-123  ')).toBe('session-123')
      })

      it('should reject empty strings', () => {
        expect(() => sessionId('')).toThrow('Invalid session ID')
      })

      it('should reject whitespace-only strings', () => {
        expect(() => sessionId('   ')).toThrow('Invalid session ID')
      })

      it('should reject non-strings', () => {
        expect(() => sessionId(null as any)).toThrow('Invalid session ID')
        expect(() => sessionId(undefined as any)).toThrow('Invalid session ID')
      })
    })

    describe('unsafeSessionId constructor', () => {
      it('should accept any string without validation', () => {
        expect(unsafeSessionId('')).toBe('')
      })
    })
  })

  describe('Type Safety', () => {
    it('should prevent mixing different branded types at compile time', () => {
      const expId: ExperimentId = experimentId(1)
      const appId: ApplicationId = applicationId(2)

      const acceptsExperimentId = (id: ExperimentId): number => id
      const acceptsApplicationId = (id: ApplicationId): number => id

      expect(acceptsExperimentId(expId)).toBe(1)
      expect(acceptsApplicationId(appId)).toBe(2)
    })

    it('should allow using branded values as their base types', () => {
      const expId: ExperimentId = experimentId(42)
      const num: number = expId
      expect(num).toBe(42)

      const selector: CSSSelector = cssSelector('.class')
      const str: string = selector
      expect(str).toBe('.class')
    })

    it('should demonstrate branded types prevent primitive confusion', () => {
      const expId = experimentId(123)
      const appId = applicationId(123)

      expect(expId).toBe(appId)

      const checkExperimentId = (id: ExperimentId): boolean => {
        return typeof id === 'number' && id > 0
      }

      expect(checkExperimentId(expId)).toBe(true)
    })
  })

  describe('Integration Tests', () => {
    it('should handle real-world experiment ID scenarios', () => {
      const validIds = [1, 42, 999, 123456]
      const brandedIds = validIds.map(id => experimentId(id))

      expect(brandedIds).toHaveLength(4)
      brandedIds.forEach((id, index) => {
        expect(id).toBe(validIds[index])
      })
    })

    it('should handle real-world CSS selector scenarios', () => {
      const validSelectors = [
        '.button',
        '#submit-btn',
        'button.primary',
        'div > .content',
        '[data-test-id="hero"]',
        'a:hover',
        '.class1.class2',
        'body > main > section:first-child'
      ]

      const brandedSelectors = validSelectors.map(sel => cssSelector(sel))

      expect(brandedSelectors).toHaveLength(validSelectors.length)
      brandedSelectors.forEach((sel, index) => {
        expect(sel).toBe(validSelectors[index])
      })
    })

    it('should handle real-world API endpoint scenarios', () => {
      const validEndpoints = [
        'https://api.absmartly.com',
        'https://api.absmartly.com/v1',
        'http://localhost:3000',
        'http://localhost:3000/api',
        'https://staging.api.example.com:8080',
        'https://api.example.com/v2/experiments?key=value'
      ]

      const brandedEndpoints = validEndpoints.map(url => apiEndpoint(url))

      expect(brandedEndpoints).toHaveLength(validEndpoints.length)
      brandedEndpoints.forEach((endpoint, index) => {
        expect(endpoint).toBe(validEndpoints[index])
      })
    })

    it('should handle unsafe constructors for deserialization', () => {
      const deserializedData = {
        experimentId: 42,
        variantName: 'control',
        selector: '.button',
        endpoint: 'https://api.example.com'
      }

      const expId = unsafeExperimentId(deserializedData.experimentId)
      const vName = unsafeVariantName(deserializedData.variantName)
      const sel = unsafeCSSSelector(deserializedData.selector)
      const endpoint = unsafeAPIEndpoint(deserializedData.endpoint)

      expect(expId).toBe(42)
      expect(vName).toBe('control')
      expect(sel).toBe('.button')
      expect(endpoint).toBe('https://api.example.com')
    })
  })
})
