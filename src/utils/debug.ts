// Simple debug flag - change this to false to disable all debug logging
const DEBUG = true

// Dead simple debug functions
export function debugLog(...args: any[]) {
  if (DEBUG) console.log(...args)
}

export function debugError(...args: any[]) {
  if (DEBUG) console.error(...args)
}

export function debugWarn(...args: any[]) {
  if (DEBUG) console.warn(...args)
}

// Also make them available globally as a fallback
if (typeof window !== 'undefined') {
  (window as any).debugLog = debugLog;
  (window as any).debugError = debugError;
  (window as any).debugWarn = debugWarn;
}