import { debugWarn, debugLog } from './debug'
import { isSSRFSafe } from '~background/utils/security'

export interface ValidationResult {
  valid: boolean
  reason?: string
  warnings?: string[]
}

const DANGEROUS_PATTERNS = [
  { pattern: /\beval\s*\(/, reason: 'Direct eval() call detected', severity: 'critical' },
  { pattern: /Function\s*\(/, reason: 'Function constructor detected', severity: 'critical' },
  { pattern: /document\.cookie/i, reason: 'Access to document.cookie detected', severity: 'critical' },
  { pattern: /localStorage/i, reason: 'Access to localStorage detected', severity: 'critical' },
  { pattern: /sessionStorage/i, reason: 'Access to sessionStorage detected', severity: 'critical' },
  { pattern: /XMLHttpRequest/i, reason: 'XMLHttpRequest usage detected', severity: 'critical' },
  { pattern: /fetch\s*\(/, reason: 'fetch() call detected', severity: 'critical' },
  { pattern: /import\s*\(/, reason: 'Dynamic import() detected', severity: 'critical' },
  { pattern: /require\s*\(/, reason: 'require() call detected', severity: 'critical' },
  { pattern: /chrome\./i, reason: 'Chrome API access detected', severity: 'critical' },
  { pattern: /browser\./i, reason: 'Browser API access detected', severity: 'critical' },
  { pattern: /\.__proto__/, reason: 'Prototype manipulation detected', severity: 'critical' },
  { pattern: /\.constructor/, reason: 'Constructor access detected', severity: 'high' },
  { pattern: /while\s*\(\s*true\s*\)/i, reason: 'Infinite while loop detected', severity: 'high' },
  { pattern: /for\s*\(\s*;\s*;\s*\)/i, reason: 'Infinite for loop detected', severity: 'high' },
  { pattern: /window\.location\s*=|location\.href\s*=/, reason: 'Page navigation detected', severity: 'medium' },
  { pattern: /document\.write/, reason: 'document.write() usage detected', severity: 'medium' }
]

const MAX_CODE_LENGTH = 50000

export function validateExperimentCode(code: string): ValidationResult {
  if (!code || typeof code !== 'string') {
    return {
      valid: false,
      reason: 'Code must be a non-empty string'
    }
  }

  if (code.length > MAX_CODE_LENGTH) {
    return {
      valid: false,
      reason: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`
    }
  }

  const warnings: string[] = []

  for (const { pattern, reason, severity } of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      if (severity === 'critical') {
        debugWarn(`[CodeValidator] BLOCKED: ${reason}`)
        return {
          valid: false,
          reason: `Security violation: ${reason}`
        }
      } else if (severity === 'high') {
        debugWarn(`[CodeValidator] WARNING (high): ${reason}`)
        warnings.push(reason)
      } else {
        debugLog(`[CodeValidator] INFO: ${reason}`)
      }
    }
  }

  if (warnings.length > 0) {
    debugLog(`[CodeValidator] Code validated with ${warnings.length} warning(s)`)
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

export function validateExperimentURL(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      reason: 'URL must be a non-empty string'
    }
  }

  try {
    const parsed = new URL(url)

    const blockedProtocols = ['javascript:', 'data:', 'file:', 'vbscript:']
    if (blockedProtocols.includes(parsed.protocol.toLowerCase())) {
      return {
        valid: false,
        reason: `Blocked protocol: ${parsed.protocol}`
      }
    }

    if (!isSSRFSafe(url)) {
      return {
        valid: false,
        reason: `Access to internal network address blocked: ${parsed.hostname}`
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      reason: 'Invalid URL format'
    }
  }
}
