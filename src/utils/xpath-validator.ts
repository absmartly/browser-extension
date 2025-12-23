/**
 * XPath Validation Utility
 *
 * Validates XPath expressions from AI providers to prevent injection attacks
 * and ensure only safe patterns are executed in the DOM.
 */

import { debugWarn } from './debug'

const SAFE_XPATH_PATTERN = /^\/\/[a-zA-Z0-9\[\]@='"\s\.\-_\*\/\(\):]+$/

const DANGEROUS_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /auth/i,
  /credit.?card/i,
  /ssn/i,
  /sensitive/i
]

/**
 * Validates an XPath expression to ensure it's safe to execute
 *
 * @param xpath - The XPath expression to validate
 * @returns true if the XPath is safe to execute, false otherwise
 */
export function validateXPath(xpath: string): boolean {
  if (!xpath || typeof xpath !== 'string') {
    debugWarn('[XPath Validator] Invalid XPath: not a string')
    return false
  }

  if (xpath.length > 500) {
    debugWarn('[XPath Validator] XPath too long (max 500 chars)')
    return false
  }

  if (!SAFE_XPATH_PATTERN.test(xpath)) {
    debugWarn('[XPath Validator] XPath contains unsafe characters:', xpath)
    return false
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(xpath)) {
      debugWarn('[XPath Validator] XPath targets potentially sensitive data:', xpath)
      return false
    }
  }

  return true
}

/**
 * Sanitizes an XPath expression by escaping special characters
 * Note: This should only be used as a fallback, validation is preferred
 *
 * @param xpath - The XPath expression to sanitize
 * @returns Sanitized XPath expression
 */
export function sanitizeXPath(xpath: string): string {
  return xpath
    .replace(/[^\w\s\[\]@='"\.\-_\*\/\(\):]/g, '')
    .slice(0, 500)
}
