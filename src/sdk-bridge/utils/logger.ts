/**
 * Debug Logger Utility
 *
 * Centralized logging for SDK Bridge with debug mode control
 *
 * @module Logger
 */

export class Logger {
  private static DEBUG = false

  /**
   * Log an info message
   */
  static log(...args: any[]): void {
    if (this.DEBUG) {
      console.log('[ABsmartly Extension]', ...args)
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
      console.warn('[ABsmartly Extension]', ...args)
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
