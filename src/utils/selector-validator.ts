/**
 * CSS Selector Validation Utility
 *
 * Validates CSS selectors to prevent injection attacks and ensure
 * only safe patterns are used in DOM manipulation.
 */

import { debugWarn } from './debug'

const ALLOWED_SELECTOR_PATTERN = /^[a-zA-Z0-9\-_#\.\s\[\]="':>+~*^$|()]+$/

const DANGEROUS_SELECTOR_PATTERNS = [
  /javascript:/i,
  /<script/i,
  /on\w+\s*=/i,
  /data:text\/html/i
]

/**
 * Validates a CSS selector to ensure it's safe to use
 *
 * @param selector - The CSS selector to validate
 * @returns true if the selector is safe, false otherwise
 */
export function validateSelector(selector: string): boolean {
  if (!selector || typeof selector !== 'string') {
    debugWarn('[Selector Validator] Invalid selector: not a string')
    return false
  }

  if (selector.length > 1000) {
    debugWarn('[Selector Validator] Selector too long (max 1000 chars)')
    return false
  }

  if (!ALLOWED_SELECTOR_PATTERN.test(selector)) {
    debugWarn('[Selector Validator] Selector contains unsafe characters:', selector)
    return false
  }

  for (const pattern of DANGEROUS_SELECTOR_PATTERNS) {
    if (pattern.test(selector)) {
      debugWarn('[Selector Validator] Selector contains dangerous pattern:', selector)
      return false
    }
  }

  try {
    document.querySelector(selector)
  } catch (e) {
    debugWarn('[Selector Validator] Invalid CSS selector syntax:', selector)
    return false
  }

  return true
}

/**
 * Sanitizes a CSS selector by removing unsafe characters
 * Note: This should only be used as a fallback, validation is preferred
 *
 * @param selector - The CSS selector to sanitize
 * @returns Sanitized CSS selector
 */
export function sanitizeSelector(selector: string): string {
  return selector
    .replace(/[^\w\s\-_#\.\[\]="':>+~*^$|()]/g, '')
    .slice(0, 1000)
}
