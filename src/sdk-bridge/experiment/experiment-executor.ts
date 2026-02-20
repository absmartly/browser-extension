import { Logger } from '../utils/logger'
import { validateExperimentCode } from '~src/utils/code-validator'
import type { ExecutionContext } from './code-executor'

export class ExperimentExecutor {
  static execute(code: string, context: ExecutionContext = {}): boolean {
    if (!code || typeof code !== 'string') {
      Logger.warn('Invalid code provided to ExperimentExecutor')
      return false
    }

    const validationResult = validateExperimentCode(code)
    if (!validationResult.valid) {
      Logger.error(
        `[ExperimentExecutor] Code validation failed: ${validationResult.reason}`
      )
      Logger.error(`[ExperimentExecutor] Rejected code for experiment: ${context.experimentName || 'unknown'}`)
      return false
    }

    if (validationResult.warnings && validationResult.warnings.length > 0) {
      Logger.warn(
        `[ExperimentExecutor] Code validation warnings for experiment ${context.experimentName}:`,
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
        `[ExperimentExecutor] JavaScript code executed successfully for experiment: ${experimentName}`
      )
      return true
    } catch (error) {
      Logger.error('[ExperimentExecutor] Error executing JavaScript code:', error)
      return false
    }
  }
}
