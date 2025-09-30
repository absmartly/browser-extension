/**
 * Browser Bundle Entry Point
 * This file is bundled for injection into the page context
 * It exposes the ExtensionDOMPlugin and its dependencies globally
 */

/// <reference lib="dom" />

import { ExtensionDOMPlugin } from './ExtensionDOMPlugin'
import { StateManager } from './StateManager'
import { MessageBridge } from './MessageBridge'
import { CodeInjector } from './CodeInjector'

// Expose on window for browser context
declare global {
  interface Window {
    ABsmartlyExtensionPlugin?: {
      ExtensionDOMPlugin: typeof ExtensionDOMPlugin
      StateManager: typeof StateManager
      MessageBridge: typeof MessageBridge
      CodeInjector: typeof CodeInjector
      version: string
    }
  }
}

// Export as global for browser use
if (typeof window !== 'undefined') {
  window.ABsmartlyExtensionPlugin = {
    ExtensionDOMPlugin,
    StateManager,
    MessageBridge,
    CodeInjector,
    version: '1.0.0'
  }
}

// Also export for module use
export { ExtensionDOMPlugin, StateManager, MessageBridge, CodeInjector }
