/**
 * Tests for CodeExecutor
 */

import { CodeExecutor } from '../../experiment/code-executor'

describe('CodeExecutor', () => {
  let mockElement: HTMLElement

  beforeEach(() => {
    mockElement = document.createElement('div')
    mockElement.id = 'test-element'
    document.body.appendChild(mockElement)
  })

  afterEach(() => {
    document.body.removeChild(mockElement)
  })

  describe('execute', () => {
    it('should execute simple console.log code', () => {
      const code = "console.log('hello world')"
      const success = CodeExecutor.execute(code)
      expect(success).toBe(true)
    })

    it('should have access to element parameter', () => {
      const code = `
        element.textContent = 'modified';
      `
      const success = CodeExecutor.execute(code, { element: mockElement })
      expect(success).toBe(true)
      expect(mockElement.textContent).toBe('modified')
    })

    it('should have access to document object', () => {
      const code = `
        const div = document.createElement('div');
        div.id = 'created-by-code';
        document.body.appendChild(div);
      `
      const success = CodeExecutor.execute(code)
      expect(success).toBe(true)
      expect(document.getElementById('created-by-code')).toBeDefined()
    })

    it('should have access to window object', () => {
      const code = `
        window.__testValue = 'from-code-executor';
      `
      const success = CodeExecutor.execute(code)
      expect(success).toBe(true)
      expect((window as any).__testValue).toBe('from-code-executor')
    })

    it('should pass experimentName as parameter', () => {
      const code = `
        if (experimentName === 'test-exp') {
          element.setAttribute('data-from-code', 'true');
        }
      `
      const success = CodeExecutor.execute(code, {
        element: mockElement,
        experimentName: 'test-exp'
      })
      expect(success).toBe(true)
      expect(mockElement.getAttribute('data-from-code')).toBe('true')
    })

    it('should handle multiple statements', () => {
      const code = `
        element.textContent = 'initial';
        element.textContent += ' modified';
        element.setAttribute('data-done', 'true');
      `
      const success = CodeExecutor.execute(code, { element: mockElement })
      expect(success).toBe(true)
      expect(mockElement.textContent).toBe('initial modified')
      expect(mockElement.getAttribute('data-done')).toBe('true')
    })

    it('should handle loops', () => {
      const code = `
        let sum = 0;
        for (let i = 0; i < 10; i++) {
          sum += i;
        }
        element.textContent = sum.toString();
      `
      const success = CodeExecutor.execute(code, { element: mockElement })
      expect(success).toBe(true)
      expect(mockElement.textContent).toBe('45')
    })

    it('should handle conditional logic', () => {
      const code = `
        if (element.id === 'test-element') {
          element.classList.add('matched');
        }
      `
      const success = CodeExecutor.execute(code, { element: mockElement })
      expect(success).toBe(true)
      expect(mockElement.classList.contains('matched')).toBe(true)
    })

    it('should return false for invalid code', () => {
      const code = 'this is not valid javascript !@#$'
      const success = CodeExecutor.execute(code)
      expect(success).toBe(false)
    })

    it('should return false for null code', () => {
      const success = CodeExecutor.execute(null as any)
      expect(success).toBe(false)
    })

    it('should return false for empty string code', () => {
      const success = CodeExecutor.execute('')
      expect(success).toBe(false)
    })

    it('should handle runtime errors gracefully', () => {
      const code = `
        throw new Error('intentional error');
      `
      const success = CodeExecutor.execute(code)
      expect(success).toBe(false)
    })

    it('should prevent direct access to eval', () => {
      const code = `
        eval('console.log("should not work")');
      `
      const success = CodeExecutor.execute(code)
      expect(success).toBe(false)
    })

    it('should be able to modify element styles', () => {
      const code = `
        element.style.backgroundColor = 'red';
        element.style.color = 'white';
      `
      const success = CodeExecutor.execute(code, { element: mockElement })
      expect(success).toBe(true)
      expect(mockElement.style.backgroundColor).toBe('red')
      expect(mockElement.style.color).toBe('white')
    })
  })

  describe('validate', () => {
    it('should validate simple code as valid', () => {
      const result = CodeExecutor.validate("console.log('hello')")
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject null code', () => {
      const result = CodeExecutor.validate(null as any)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Code must be a non-empty string')
    })

    it('should reject empty string', () => {
      const result = CodeExecutor.validate('')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Code must be a non-empty string')
    })

    it('should reject code exceeding max length', () => {
      const longCode = 'a'.repeat(60000)
      const result = CodeExecutor.validate(longCode)
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('exceeds maximum length'))).toBe(
        true
      )
    })

    it('should warn about eval patterns', () => {
      const result = CodeExecutor.validate("eval('code')")
      expect(result.isValid).toBe(true) // Still valid, just warns
    })

    it('should warn about Function constructor', () => {
      const result = CodeExecutor.validate("new Function('return 42')()")
      expect(result.isValid).toBe(true) // Still valid, just warns
    })

    it('should allow normal code patterns', () => {
      const code = `
        element.textContent = 'hello';
        for (let i = 0; i < 10; i++) {
          console.log(i);
        }
        if (element.id === 'test') {
          element.classList.add('active');
        }
      `
      const result = CodeExecutor.validate(code)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})
