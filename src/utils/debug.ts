/**
 * Debug logging utility that only logs when DEBUG flag is enabled
 * Can be controlled via environment variable or localStorage
 */

// Check if debug mode is enabled
const isDebugEnabled = (): boolean => {
  // Check localStorage first (for browser environment)
  /*
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return localStorage.getItem('ABSMARTLY_DEBUG') === 'true'
  }
  
  // Check environment variable (for tests)
  if (typeof process !== 'undefined' && process.env) {
    return process.env.ABSMARTLY_DEBUG === 'true'
  }
  */
  return false
}

/**
 * Debug log - only outputs when debug mode is enabled
 */
export const debugLog = (...args: any[]) => {
  if (isDebugEnabled()) {
    console.log(...args)
  }
}

/**
 * Debug warn - only outputs when debug mode is enabled
 */
export const debugWarn = (...args: any[]) => {
  if (isDebugEnabled()) {
    console.warn(...args)
  }
}

/**
 * Debug error - only outputs when debug mode is enabled
 */
export const debugError = (...args: any[]) => {
  if (isDebugEnabled()) {
    console.error(...args)
  }
}

/**
 * Always log - bypasses debug flag (use for important messages)
 */
export const alwaysLog = (...args: any[]) => {
  console.log(...args)
}
