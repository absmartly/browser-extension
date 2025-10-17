/**
 * Debug logging utility that only logs when DEBUG flag is enabled
 * Can be controlled via environment variable or localStorage
 */

// Check if debug mode is enabled
const isDebugEnabled = (): boolean => {
  // In production builds, debug is always disabled
  if (process.env.NODE_ENV === 'production') {
    return false
  }

  // In development, check localStorage
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const debugFlag = localStorage.getItem('ABSMARTLY_DEBUG')
    // Default to true in development if not explicitly set to false
    return debugFlag !== 'false'
  }

  // Default to true in development
  return true
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
