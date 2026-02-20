import { ExperimentExecutor } from '../experiment-executor'
import { Logger } from '../../utils/logger'
import { validateExperimentCode } from '~src/utils/code-validator'
import type { ExecutionContext } from '../code-executor'

jest.mock('../../utils/logger')
jest.mock('~src/utils/code-validator')

const mockValidateExperimentCode = validateExperimentCode as jest.MockedFunction<typeof validateExperimentCode>

describe('ExperimentExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validation → execution integration', () => {
    it('should execute code that passes validation', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const context: ExecutionContext = {
        experimentName: 'test-experiment',
        element: document.createElement('div')
      }

      const result = ExperimentExecutor.execute('console.log("test")', context)

      expect(result).toBe(true)
      expect(mockValidateExperimentCode).toHaveBeenCalledWith('console.log("test")')
      expect(Logger.log).toHaveBeenCalledWith(
        expect.stringContaining('executed successfully for experiment: test-experiment')
      )
    })

    it('should block code that fails validation', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Security violation: Function constructor detected'
      })

      const context: ExecutionContext = {
        experimentName: 'malicious-experiment'
      }

      const result = ExperimentExecutor.execute('Function("alert(1)")', context)

      expect(result).toBe(false)
      expect(mockValidateExperimentCode).toHaveBeenCalledWith('Function("alert(1)")')
      expect(Logger.error).toHaveBeenCalledWith(
        '[ExperimentExecutor] Code validation failed: Security violation: Function constructor detected'
      )
      expect(Logger.error).toHaveBeenCalledWith(
        '[ExperimentExecutor] Rejected code for experiment: malicious-experiment'
      )
    })

    it('should never execute code before validation', () => {
      let codeExecuted = false
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Security violation'
      })

      const maliciousCode = 'window.__testFlag = true;'
      ExperimentExecutor.execute(maliciousCode)

      expect(codeExecuted).toBe(false)
      expect((window as any).__testFlag).toBeUndefined()
    })

    it('should log validation failures with experiment name', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Function constructor detected'
      })

      const context: ExecutionContext = {
        experimentName: 'suspicious-test'
      }

      ExperimentExecutor.execute('Function("return 1")()', context)

      expect(Logger.error).toHaveBeenCalledWith(
        '[ExperimentExecutor] Code validation failed: Function constructor detected'
      )
      expect(Logger.error).toHaveBeenCalledWith(
        '[ExperimentExecutor] Rejected code for experiment: suspicious-test'
      )
    })

    it('should log warnings for code with validation warnings', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: true,
        warnings: ['Constructor access detected', 'Infinite while loop detected']
      })

      const context: ExecutionContext = {
        experimentName: 'warning-test'
      }

      const result = ExperimentExecutor.execute('console.log("test")', context)

      expect(result).toBe(true)
      expect(Logger.warn).toHaveBeenCalledWith(
        '[ExperimentExecutor] Code validation warnings for experiment warning-test:',
        ['Constructor access detected', 'Infinite while loop detected']
      )
    })

    it('should not log warnings when none exist', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: true
      })

      ExperimentExecutor.execute('console.log("safe")')

      expect(Logger.warn).not.toHaveBeenCalled()
    })
  })

  describe('function constructor bypass attempts', () => {
    it('should block: const f = "Function"; window[f]("alert(1)")()', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Security violation: Function constructor detected'
      })

      const result = ExperimentExecutor.execute('const f = "Function"; window[f]("alert(1)")()')

      expect(result).toBe(false)
      expect(Logger.error).toHaveBeenCalledWith(
        '[ExperimentExecutor] Code validation failed: Security violation: Function constructor detected'
      )
    })

    it('should block: this.constructor.constructor("return this")()', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Security violation: Constructor access detected'
      })

      const result = ExperimentExecutor.execute('this.constructor.constructor("return this")()')

      expect(result).toBe(false)
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Code validation failed')
      )
    })

    it('should block: []["constructor"]["constructor"]("alert(1)")()', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Security violation: Constructor access detected'
      })

      const result = ExperimentExecutor.execute('[]["constructor"]["constructor"]("alert(1)")()')

      expect(result).toBe(false)
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Code validation failed')
      )
    })

    it('should block template literal bypasses', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Security violation: Function constructor detected'
      })

      const result = ExperimentExecutor.execute('Function`return 1`()')

      expect(result).toBe(false)
    })

    it('should block indirect function constructor creation', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Security violation: Function constructor detected'
      })

      const result = ExperimentExecutor.execute('(function(){}).constructor("alert(1)")()')

      expect(result).toBe(false)
    })

    it('should block constructor chaining', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Security violation: Constructor access detected'
      })

      const result = ExperimentExecutor.execute('Object.constructor.constructor("return this")()')

      expect(result).toBe(false)
    })
  })

  describe('runtime error isolation', () => {
    it('should catch runtime errors without crashing extension', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const context: ExecutionContext = {
        experimentName: 'error-test',
        element: document.createElement('div')
      }

      const result = ExperimentExecutor.execute('throw new Error("Runtime error")', context)

      expect(result).toBe(false)
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error executing JavaScript code'),
        expect.any(Error)
      )
    })

    it('should return false on execution errors', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('nonexistentFunction()')

      expect(result).toBe(false)
    })

    it('should log errors with context', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const context: ExecutionContext = {
        experimentName: 'error-context-test'
      }

      ExperimentExecutor.execute('throw new Error("Test error")', context)

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[ExperimentExecutor] Error executing JavaScript code'),
        expect.any(Error)
      )
    })

    it('should handle element.nonexistentMethod() without throwing', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const context: ExecutionContext = {
        element: document.createElement('div'),
        experimentName: 'method-error-test'
      }

      const result = ExperimentExecutor.execute('element.nonexistentMethod()', context)

      expect(result).toBe(false)
      expect(Logger.error).toHaveBeenCalled()
    })

    it('should handle null reference errors gracefully', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('var x = null; x.property;')

      expect(result).toBe(false)
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error executing JavaScript code'),
        expect.any(Error)
      )
    })

    it('should handle undefined property access errors', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('var obj = {}; obj.foo.bar;')

      expect(result).toBe(false)
    })

    it('should handle syntax errors in code', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('var x = {invalid syntax')

      expect(result).toBe(false)
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error executing JavaScript code'),
        expect.any(Error)
      )
    })
  })

  describe('context injection safety', () => {
    it('should provide element to code', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const testElement = document.createElement('button')
      testElement.id = 'test-button'
      const context: ExecutionContext = {
        element: testElement,
        experimentName: 'element-test'
      }

      const result = ExperimentExecutor.execute('element.textContent = "Updated"', context)

      expect(result).toBe(true)
      expect(testElement.textContent).toBe('Updated')
    })

    it('should provide document to code', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const testDiv = document.createElement('div')
      testDiv.id = 'target'
      document.body.appendChild(testDiv)

      const result = ExperimentExecutor.execute(
        'document.getElementById("target").textContent = "Found"'
      )

      expect(result).toBe(true)
      expect(document.getElementById('target')?.textContent).toBe('Found')

      document.body.removeChild(testDiv)
    })

    it('should provide window to code', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('window.__testMarker = "executed"')

      expect(result).toBe(true)
      expect((window as any).__testMarker).toBe('executed')

      delete (window as any).__testMarker
    })

    it('should provide console to code', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const result = ExperimentExecutor.execute('console.log("Test message")')

      expect(result).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith('Test message')

      consoleSpy.mockRestore()
    })

    it('should provide experimentName to code', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const context: ExecutionContext = {
        experimentName: 'tracking-test'
      }

      const result = ExperimentExecutor.execute(
        'window.__lastExperiment = experimentName',
        context
      )

      expect(result).toBe(true)
      expect((window as any).__lastExperiment).toBe('tracking-test')

      delete (window as any).__lastExperiment
    })

    it('should use "__preview__" as default experiment name', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('window.__expName = experimentName')

      expect(result).toBe(true)
      expect((window as any).__expName).toBe('__preview__')

      delete (window as any).__expName
    })

    it('should execute in proper scope with all context variables', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const testElement = document.createElement('span')
      const context: ExecutionContext = {
        element: testElement,
        experimentName: 'scope-test'
      }

      const result = ExperimentExecutor.execute(
        `
        element.setAttribute('data-experiment', experimentName);
        element.textContent = 'Scope test';
        `,
        context
      )

      expect(result).toBe(true)
      expect(testElement.getAttribute('data-experiment')).toBe('scope-test')
      expect(testElement.textContent).toBe('Scope test')
    })

    it('should track experiment name correctly', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const context: ExecutionContext = {
        experimentName: 'name-tracking-test'
      }

      ExperimentExecutor.execute('console.log(experimentName)', context)

      expect(Logger.log).toHaveBeenCalledWith(
        expect.stringContaining('executed successfully for experiment: name-tracking-test')
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty string code', () => {
      const result = ExperimentExecutor.execute('')

      expect(result).toBe(false)
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid code provided')
      )
      expect(mockValidateExperimentCode).not.toHaveBeenCalled()
    })

    it('should handle null code', () => {
      const result = ExperimentExecutor.execute(null as any)

      expect(result).toBe(false)
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid code provided')
      )
    })

    it('should handle undefined code', () => {
      const result = ExperimentExecutor.execute(undefined as any)

      expect(result).toBe(false)
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid code provided')
      )
    })

    it('should handle non-string code', () => {
      const result = ExperimentExecutor.execute(123 as any)

      expect(result).toBe(false)
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid code provided')
      )
    })

    it('should handle code with validation warnings', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: true,
        warnings: ['Constructor access detected']
      })

      const context: ExecutionContext = {
        experimentName: 'warning-edge-test'
      }

      const result = ExperimentExecutor.execute('console.log("test")', context)

      expect(result).toBe(true)
      expect(Logger.warn).toHaveBeenCalledWith(
        '[ExperimentExecutor] Code validation warnings for experiment warning-edge-test:',
        ['Constructor access detected']
      )
    })

    it('should handle very long code near MAX_CODE_LENGTH', () => {
      const longCode = 'var x = 1;'.repeat(4999)
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute(longCode)

      expect(result).toBe(true)
      expect(mockValidateExperimentCode).toHaveBeenCalledWith(longCode)
    })

    it('should handle whitespace-only code', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('   \n\t  ')

      expect(result).toBe(true)
      expect(mockValidateExperimentCode).toHaveBeenCalledWith('   \n\t  ')
    })

    it('should handle code with only comments', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('// Just a comment')

      expect(result).toBe(true)
    })

    it('should handle context without experimentName', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const context: ExecutionContext = {
        element: document.createElement('div')
      }

      const result = ExperimentExecutor.execute('console.log("test")', context)

      expect(result).toBe(true)
      expect(Logger.log).toHaveBeenCalledWith(
        expect.stringContaining('executed successfully for experiment: undefined')
      )
    })

    it('should handle empty context object', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('console.log("no context")', {})

      expect(result).toBe(true)
    })

    it('should handle undefined context', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('console.log("undefined context")')

      expect(result).toBe(true)
    })

    it('should handle multiple consecutive executions', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result1 = ExperimentExecutor.execute('var x = 1;')
      const result2 = ExperimentExecutor.execute('var y = 2;')
      const result3 = ExperimentExecutor.execute('var z = 3;')

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(true)
    })

    it('should handle code with unicode characters', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('var emoji = "🚀"; console.log(emoji);')

      expect(result).toBe(true)
    })

    it('should handle code with special characters', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('var special = "\\n\\t\\r"; console.log(special);')

      expect(result).toBe(true)
    })

    it('should handle code that returns a value', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const result = ExperimentExecutor.execute('return 42;')

      expect(result).toBe(true)
    })
  })

  describe('security validation enforcement', () => {
    it('should never execute prohibited code even if validation is bypassed', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Security violation: Function constructor detected'
      })

      const result = ExperimentExecutor.execute('Function("malicious")')

      expect(result).toBe(false)
      expect(mockValidateExperimentCode).toHaveBeenCalledWith('Function("malicious")')
    })

    it('should never execute fetch even if validation is bypassed', () => {
      mockValidateExperimentCode.mockReturnValue({
        valid: false,
        reason: 'Security violation: fetch() call detected'
      })

      const result = ExperimentExecutor.execute('fetch("https://evil.com")')

      expect(result).toBe(false)
    })

    it('should validate every execution call', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      ExperimentExecutor.execute('var a = 1;')
      ExperimentExecutor.execute('var b = 2;')
      ExperimentExecutor.execute('var c = 3;')

      expect(mockValidateExperimentCode).toHaveBeenCalledTimes(3)
    })

    it('should not cache validation results', () => {
      const code = 'console.log("test");'

      mockValidateExperimentCode.mockReturnValueOnce({ valid: true })
      ExperimentExecutor.execute(code)

      mockValidateExperimentCode.mockReturnValueOnce({
        valid: false,
        reason: 'Validation changed'
      })
      ExperimentExecutor.execute(code)

      expect(mockValidateExperimentCode).toHaveBeenCalledTimes(2)
    })
  })

  describe('integration with real DOM operations', () => {
    it('should successfully modify element styles', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const element = document.createElement('div')
      const context: ExecutionContext = {
        element,
        experimentName: 'style-test'
      }

      const result = ExperimentExecutor.execute(
        'element.style.color = "red"; element.style.fontSize = "20px";',
        context
      )

      expect(result).toBe(true)
      expect(element.style.color).toBe('red')
      expect(element.style.fontSize).toBe('20px')
    })

    it('should successfully modify element attributes', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const element = document.createElement('input')
      const context: ExecutionContext = {
        element,
        experimentName: 'attr-test'
      }

      const result = ExperimentExecutor.execute(
        'element.setAttribute("placeholder", "Enter text"); element.disabled = true;',
        context
      )

      expect(result).toBe(true)
      expect(element.getAttribute('placeholder')).toBe('Enter text')
      expect(element.disabled).toBe(true)
    })

    it('should successfully add event listeners', () => {
      mockValidateExperimentCode.mockReturnValue({ valid: true })

      const element = document.createElement('button')
      const context: ExecutionContext = {
        element,
        experimentName: 'event-test'
      }

      const result = ExperimentExecutor.execute(
        'element.addEventListener("click", function() { element.textContent = "Clicked"; });',
        context
      )

      expect(result).toBe(true)

      element.click()
      expect(element.textContent).toBe('Clicked')
    })
  })
})
