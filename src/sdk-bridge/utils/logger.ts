/**
 * Debug Logger Utility
 *
 * Centralized logging for SDK Bridge with debug mode control
 *
 * @module Logger
 */

import { debugLog, debugWarn } from '~src/utils/debug'

export class Logger {
  private static DEBUG = false

  /**
   * Log an info message
   */
  static log(...args: any[]): void {
    if (this.DEBUG) {
      debugLog('[ABsmartly Extension]', ...args)
    }
  }

  /**
   * Log an error message
   */
  static error(...args: any[]): void {
    if (this.DEBUG) {
      console.error('[ABsmartly Extension]', ...args)
    }
  }

  /**
   * Log a warning message
   */
  static warn(...args: any[]): void {
    if (this.DEBUG) {
      debugWarn('[ABsmartly Extension]', ...args)
    }
  }

  /**
   * Enable or disable debug logging
   */
  static setDebug(enabled: boolean): void {
    this.DEBUG = enabled
  }

  /**
   * Check if debug mode is enabled
   */
  static isDebugEnabled(): boolean {
    return this.DEBUG
  }
}
