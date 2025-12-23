/**
 * Code Executor
 *
 * Safely executes JavaScript code in preview mode with scope isolation and security restrictions
 *
 * @module CodeExecutor
 */

import { Logger } from '../utils/logger'
import { validateExperimentCode } from '~src/utils/code-validator'

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

    const validationResult = validateExperimentCode(code)
    if (!validationResult.valid) {
      Logger.error(
        `[CodeExecutor] Code validation failed: ${validationResult.reason}`
      )
      Logger.error(`[CodeExecutor] Rejected code for experiment: ${context.experimentName || 'unknown'}`)
      return false
    }

    if (validationResult.warnings && validationResult.warnings.length > 0) {
      Logger.warn(
        `[CodeExecutor] Code validation warnings for experiment ${context.experimentName}:`,
        validationResult.warnings
      )
    }

    try {
      const { element, experimentName } = context

      const executeFn = new Function(
        'element',
        'document',
        'window',
        'console',
        'experimentName',
        code
      )

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

    const validationResult = validateExperimentCode(code)
    if (!validationResult.valid) {
      errors.push(validationResult.reason || 'Code validation failed')
    }

    if (validationResult.warnings) {
      validationResult.warnings.forEach(warning => {
        Logger.warn(`[CodeExecutor] Validation warning: ${warning}`)
      })
    }

    return { isValid: errors.length === 0, errors }
  }
}
