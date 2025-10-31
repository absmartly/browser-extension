/**
 * Debug logging utility that only logs when DEBUG flag is enabled
 * Optimized for tree-shaking in production builds
 */

// Use a constant that will be replaced at build time
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * Debug log - only outputs when debug mode is enabled
 * In production builds, this becomes an empty function
 */
export const debugLog = IS_PRODUCTION
  ? function() {}
  : function() { console.log.apply(console, arguments) }

/**
 * Debug warn - only outputs when debug mode is enabled
 * In production builds, this becomes an empty function
 */
export const debugWarn = IS_PRODUCTION
  ? function() {}
  : function() { console.warn.apply(console, arguments) }

/**
 * Debug error - always preserved for production error tracking
 */
export const debugError = function() {
  console.error.apply(console, arguments)
}

/**
 * Always log - bypasses debug flag (use for important messages)
 */
export const alwaysLog = function() {
  console.log.apply(console, arguments)
}
