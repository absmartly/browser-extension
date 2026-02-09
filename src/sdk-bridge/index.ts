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

import { Orchestrator } from './core/orchestrator'

import { debugLog, debugWarn } from '~src/utils/debug'
// Version
export const SDK_BRIDGE_VERSION = '1.1.0'

// CRITICAL: Do not run SDK bridge inside the sidebar iframe!
// The sidebar is the extension UI and should not process preview changes
if (window.self !== window.top) {
  // We're in an iframe - check if it's the sidebar
  const isInSidebarIframe = window.frameElement?.id === 'absmartly-sidebar-iframe'
  if (!isInSidebarIframe) {
    // Not the sidebar - initialize normally
    initializeBridge()
  }
  // If it is the sidebar iframe, exit early without initializing
} else {
  // We're in the main page - initialize normally
  initializeBridge()
}

function initializeBridge() {
  // Create orchestrator instance
  const orchestrator = new Orchestrator()

  // Setup message listener for extension communication
  orchestrator.setupMessageListener()

  // Expose APIs for extension to call
  orchestrator.exposeVariantAssignments()
  orchestrator.exposeContextPath()

  // Start the initialization process
  orchestrator.start()

  // Log that we're loaded
  debugLog('[SDK Bridge] Module loaded - version', SDK_BRIDGE_VERSION)
}
