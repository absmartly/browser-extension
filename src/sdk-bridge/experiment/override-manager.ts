/**
 * Override Manager
 *
 * Handles experiment override cookies for testing and development
 *
 * @module OverrideManager
 */

import { Logger } from '../utils/logger'

export interface OverrideValue {
  variant: number
  env?: number
  id?: number
}

export interface ParsedOverrides {
  overrides: Record<string, number | OverrideValue>
  devEnv: string | null
}

export class OverrideManager {
  private cookieName: string

  constructor(cookieName: string = 'absmartly_overrides') {
    this.cookieName = cookieName
  }

  /**
   * Parse cookie overrides from cookie value string
   *
   * Format examples:
   * - Simple: "exp1:0,exp2:1" - just variant numbers
   * - With env: "exp1:0.1,exp2:1.2" - variant.env
   * - Full: "exp1:0.1.123,exp2:1.2.456" - variant.env.id
   * - With devEnv: "devEnv=https://example.com|exp1:0,exp2:1"
   */
  parseCookieOverrides(cookieValue: string): ParsedOverrides {
    if (!cookieValue) {
      return { overrides: {}, devEnv: null }
    }

    try {
      let devEnv: string | null = null
      let experimentsStr = cookieValue

      // Check if dev environment is included
      if (cookieValue.startsWith('devEnv=')) {
        const parts = cookieValue.split('|')
        devEnv = decodeURIComponent(parts[0].substring(7)) // Remove 'devEnv=' prefix
        experimentsStr = parts[1] || ''
      }

      const overrides: Record<string, number | OverrideValue> = {}

      if (experimentsStr) {
        // NEW FORMAT: comma separates experiments, dot separates values within each experiment
        const experiments = experimentsStr.split(',')

        for (const exp of experiments) {
          const [name, values] = exp.split(':')
          if (!name || !values) continue

          const decodedName = decodeURIComponent(name)
          const parts = values.split('.')

          if (parts.length === 1) {
            // Simple format: just variant (running experiment)
            overrides[decodedName] = parseInt(parts[0], 10)
          } else if (parts.length === 2) {
            // Format: variant.env
            overrides[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10)
            }
          } else {
            // Full format: variant.env.id
            overrides[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10),
              id: parseInt(parts[2], 10)
            }
          }
        }
      }

      return { overrides, devEnv }
    } catch (error) {
      Logger.warn('[ABsmartly Extension] Failed to parse override cookie:', error)
      return { overrides: {}, devEnv: null }
    }
  }

  /**
   * Check for override cookie and log its presence
   *
   * Note: The OverridesPlugin handles actual application of overrides.
   * This function just checks if the cookie exists and logs metadata.
   */
  checkOverridesCookie(): void {
    try {
      // Just check if cookie exists - OverridesPlugin handles all parsing and application
      const cookieValue = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${this.cookieName}=`))
        ?.split('=')[1]

      if (cookieValue) {
        Logger.log(
          '[ABsmartly Extension] Found absmartly_overrides cookie (will be handled by OverridesPlugin)'
        )

        // Log if development environment is present (just for debugging)
        if (cookieValue.startsWith('devEnv=')) {
          const devEnvMatch = cookieValue.match(/^devEnv=([^|]+)/)
          if (devEnvMatch) {
            Logger.log(
              '[ABsmartly Extension] Development environment in cookie:',
              decodeURIComponent(devEnvMatch[1])
            )
          }
        }
      } else {
        Logger.log('[ABsmartly Extension] No experiment overrides cookie found')
      }
    } catch (error) {
      Logger.error('[ABsmartly Extension] Error checking overrides cookie:', error)
    }
  }

  /**
   * Get the current override cookie value
   */
  getCookieValue(): string | null {
    try {
      const cookieValue = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${this.cookieName}=`))
        ?.split('=')[1]

      return cookieValue || null
    } catch (error) {
      Logger.error('[ABsmartly Extension] Error getting cookie value:', error)
      return null
    }
  }

  /**
   * Get parsed overrides from cookie
   */
  getOverrides(): ParsedOverrides {
    const cookieValue = this.getCookieValue()
    if (!cookieValue) {
      return { overrides: {}, devEnv: null }
    }

    return this.parseCookieOverrides(cookieValue)
  }
}
