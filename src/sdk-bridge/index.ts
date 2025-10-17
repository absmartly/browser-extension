/**
 * ABsmartly SDK Bridge - Main Entry Point
 *
 * This module bridges the ABsmartly browser extension with the ABsmartly SDK
 * running on the page. It handles SDK detection, plugin initialization,
 * DOM changes, and message passing.
 *
 * @module ABSmartlySDKBridge
 * @version 1.1.0
 */

// Version
export const SDK_BRIDGE_VERSION = '1.1.0'

// Temporary placeholder functions for testing build
export function getVariantAssignments(experimentNames: string[]) {
  console.log('[SDK Bridge] getVariantAssignments called:', experimentNames)
  return Promise.resolve({ assignments: {}, experimentsInContext: [] })
}

export function getContextPath() {
  console.log('[SDK Bridge] getContextPath called')
  return {
    found: false,
    path: null,
    hasContext: false,
    hasPeek: false,
    hasTreatment: false
  }
}

// Log that we're loaded
console.log('[SDK Bridge] Module loaded - version', SDK_BRIDGE_VERSION)
