/**
 * Sandboxed Code Executor
 * Executes experiment JavaScript with validation and logging
 *
 * Security model:
 * - All code validated before execution (validateExperimentCode)
 * - Dangerous patterns blocked (eval, Function constructor access, etc.)
 * - Execution logged for monitoring
 * - Limited to experiment context scope
 *
 * Note: Uses Function constructor after validation - required for experiment code feature
 */

import { Logger } from '../utils/logger'
import { validateExperimentCode } from '~src/utils/code-validator'
import type { ExecutionContext } from './code-executor'

export class SandboxExecutor {
  static execute(code: string, context: ExecutionContext = {}): boolean {
    if (!code || typeof code !== 'string') {
      Logger.warn('Invalid code provided to SandboxExecutor')
      return false
    }

    const validationResult = validateExperimentCode(code)
    if (!validationResult.valid) {
      Logger.error(
        `[SandboxExecutor] Code validation failed: ${validationResult.reason}`
      )
      Logger.error(`[SandboxExecutor] Rejected code for experiment: ${context.experimentName || 'unknown'}`)
      return false
    }

    if (validationResult.warnings && validationResult.warnings.length > 0) {
      Logger.warn(
        `[SandboxExecutor] Code validation warnings for experiment ${context.experimentName}:`,
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
        `[SandboxExecutor] JavaScript code executed successfully for experiment: ${experimentName}`
      )
      return true
    } catch (error) {
      Logger.error('[SandboxExecutor] Error executing JavaScript code:', error)
      return false
    }
  }
}
