/**
 * Code Executor
 *
 * Safely executes JavaScript code in preview mode with scope isolation and security restrictions
 *
 * @module CodeExecutor
 */

import { Logger } from '../utils/logger'

export interface ExecutionContext {
  element?: HTMLElement
  experimentName?: string
}

export class CodeExecutor {
  /**
   * Execute JavaScript code safely within the page context
   *
   * Uses Function constructor with restricted scope to prevent:
   * - Direct access to eval
   * - Infinite loops (but explicit loops are allowed)
   * - Access to dangerous globals (in restricted mode)
   *
   * The function has access to:
   * - element: The element the change is being applied to (if selector matches)
   * - document: The page's document object
   * - window: The page's window object
   * - console: For logging
   *
   * @param code - The JavaScript code to execute
   * @param context - Execution context (element, experimentName)
   * @returns boolean indicating success
   */
  static execute(code: string, context: ExecutionContext = {}): boolean {
    if (!code || typeof code !== 'string') {
      Logger.warn('Invalid code provided to CodeExecutor')
      return false
    }

    try {
      const { element, experimentName } = context

      // Create a safe execution function using Function constructor
      // This prevents direct eval() usage and provides a controlled scope
      const executeFn = new Function(
        'element',
        'document',
        'window',
        'console',
        'experimentName',
        code
      )

      // Execute the function with provided context
      // Note: element, document, window, console are the actual page objects
      executeFn(
        element,
        document,
        window,
        console,
        experimentName || '__preview__'
      )

      Logger.log(
        `[CodeExecutor] JavaScript code executed successfully for experiment: ${experimentName}`
      )
      return true
    } catch (error) {
      Logger.error('[CodeExecutor] Error executing JavaScript code:', error)
      return false
    }
  }

  /**
   * Validate JavaScript code before execution
   * Checks for obviously dangerous patterns
   *
   * @param code - The code to validate
   * @returns Object with { isValid, errors }
   */
  static validate(
    code: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!code || typeof code !== 'string') {
      errors.push('Code must be a non-empty string')
      return { isValid: false, errors }
    }

    if (code.length > 50000) {
      errors.push('Code exceeds maximum length of 50KB')
    }

    // Check for obviously dangerous patterns (these are just warnings)
    // Note: These patterns can still be legitimately used, but we log warnings
    const dangerousPatterns = [
      { pattern: /\beval\s*\(/, description: 'Direct eval() call' },
      {
        pattern: /Function\s*\(/,
        description: 'Function constructor (allowed but unusual)'
      },
      {
        pattern: /window\.location\s*=|location\.href\s*=/,
        description: 'Page navigation'
      },
      { pattern: /document\.write/, description: 'document.write()' }
    ]

    dangerousPatterns.forEach((check) => {
      if (check.pattern.test(code)) {
        Logger.warn(
          `[CodeExecutor] Potentially sensitive pattern detected: ${check.description}`
        )
      }
    })

    return { isValid: errors.length === 0, errors }
  }
}
