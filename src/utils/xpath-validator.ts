/**
 * XPath Validation Utility
 *
 * Validates XPath expressions from AI providers to prevent injection attacks.
 * Uses a strict whitelist approach to block dangerous XPath functions and patterns.
 *
 * Security approach:
 * 1. Whitelist-based validation (only allows known-safe patterns)
 * 2. Blocks XPath functions that could access external resources or manipulate data
 * 3. Prevents SQL-style injection attempts using boolean logic
 * 4. Blocks access to sensitive form fields
 * 5. Validates XPath syntax using document.evaluate()
 */

import { debugWarn } from './debug'

export interface XPathValidationResult {
  valid: boolean
  error?: string
}

const SAFE_XPATH_PATTERN = /^\/\/[a-zA-Z0-9\[\]@='"\s\.\-_\*\/\(\):]+$/

const DANGEROUS_XPATH_FUNCTIONS = [
  /document\s*\(/i,
  /string\s*\(/i,
  /normalize-space\s*\(/i,
  /substring\s*\(/i,
  /concat\s*\(/i,
  /translate\s*\(/i,
  /sum\s*\(/i,
  /count\s*\(/i,
  /boolean\s*\(/i,
  /number\s*\(/i,
  /lang\s*\(/i,
  /\bid\s*\(/i,
  /local-name\s*\(/i,
  /namespace-uri\s*\(/i,
  /\bname\s*\(/i,
  /contains\s*\(/i,
  /starts-with\s*\(/i,
  /ends-with\s*\(/i
]

const XPATH_INJECTION_PATTERNS = [
  /\s+or\s+['"]\d+['"]\s*=\s*['"]\d+['"]/i,
  /\s+and\s+['"]\d+['"]\s*=\s*['"]\d+['"]/i,
  /\s+or\s+true\s*\(/i,
  /\s+and\s+false\s*\(/i,
  /'\s*or\s*'1'\s*=\s*'1/i,
  /"\s*or\s*"1"\s*=\s*"1/i,
  /'or'/i,
  /"or"/i
]

const DISALLOWED_XPATH_TOKENS = [
  /::/, // Axis selectors like ancestor::, following::
  /\.\./ // Parent traversal
]

const DANGEROUS_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /auth/i,
  /credit.?card/i,
  /ssn/i,
  /sensitive/i,
  /(^|[\/:\[])\s*script\b/i,
  /<script/i,
  /--/
]

export function validateXPath(xpath: string): XPathValidationResult {
  if (!xpath || typeof xpath !== 'string') {
    const error = 'Invalid XPath: not a string'
    debugWarn('[XPath Validator]', error)
    return { valid: false, error }
  }

  if (xpath.length > 500) {
    const error = 'XPath too long (max 500 chars)'
    debugWarn('[XPath Validator]', error)
    return { valid: false, error }
  }

  if (!SAFE_XPATH_PATTERN.test(xpath)) {
    const error = 'XPath contains unsafe characters'
    debugWarn('[XPath Validator]', error, xpath)
    return { valid: false, error }
  }

  for (const pattern of DANGEROUS_XPATH_FUNCTIONS) {
    if (pattern.test(xpath)) {
      const error = 'XPath contains dangerous function'
      debugWarn('[XPath Validator]', error, xpath)
      return { valid: false, error }
    }
  }

  for (const pattern of XPATH_INJECTION_PATTERNS) {
    if (pattern.test(xpath)) {
      const error = 'XPath expression contains suspicious pattern'
      debugWarn('[XPath Validator]', error, xpath)
      return { valid: false, error }
    }
  }

  for (const pattern of DISALLOWED_XPATH_TOKENS) {
    if (pattern.test(xpath)) {
      const error = 'XPath contains disallowed axis or traversal tokens'
      debugWarn('[XPath Validator]', error, xpath)
      return { valid: false, error }
    }
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(xpath)) {
      const error = 'XPath targets potentially sensitive data'
      debugWarn('[XPath Validator]', error, xpath)
      return { valid: false, error }
    }
  }

  if (typeof document !== 'undefined' && document.evaluate) {
    try {
      document.evaluate(xpath, document, null, XPathResult.ANY_TYPE, null)
    } catch (e) {
      const error = `Invalid XPath syntax: ${e instanceof Error ? e.message : String(e)}`
      debugWarn('[XPath Validator]', error)
      return { valid: false, error }
    }
  }

  return { valid: true }
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
