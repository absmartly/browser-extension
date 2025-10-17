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

// Version
export const SDK_BRIDGE_VERSION = '1.1.0'

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
console.log('[SDK Bridge] Module loaded - version', SDK_BRIDGE_VERSION)
