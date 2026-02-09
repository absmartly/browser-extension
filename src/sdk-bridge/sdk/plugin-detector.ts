/**
 * Plugin Detector
 *
 * Detects if ABsmartly DOM Changes Plugin is already loaded
 *
 * @module PluginDetector
 */

import { Logger } from '../utils/logger'

export class PluginDetector {
  /**
   * Checks if the DOM Changes Plugin is already loaded on the page
   */
  detectPlugin(context?: any): any | string | null {
    // Check if plugin is registered with the context (primary detection method)
    if (context && context.__domPlugin && context.__domPlugin.initialized) {
      Logger.log('[ABsmartly Extension] Plugin detected via context.__domPlugin registration:', {
        version: context.__domPlugin.version,
        capabilities: context.__domPlugin.capabilities,
        timestamp: context.__domPlugin.timestamp
      })
      // Plugin is properly registered with context
      return context.__domPlugin.instance
    }

    // Check if site has its own plugin instance (they might have stored it somewhere)
    if ((window as any).__absmartlyPlugin) {
      Logger.log('[ABsmartly Extension] Site plugin instance found at window.__absmartlyPlugin')
      return (window as any).__absmartlyPlugin
    }

    if ((window as any).__absmartlyDOMChangesPlugin) {
      Logger.log('[ABsmartly Extension] Site plugin instance found at window.__absmartlyDOMChangesPlugin')
      return (window as any).__absmartlyDOMChangesPlugin
    }

    // Check global plugin registry (window.__ABSMARTLY_PLUGINS__)
    const registry = (window as any).__ABSMARTLY_PLUGINS__
    if (registry) {
      const domPlugin = registry.dom
      const overridesPlugin = registry.overrides
      const domInitialized = !!domPlugin?.initialized
      const overridesInitialized = !!overridesPlugin?.initialized

      if (domInitialized || overridesInitialized) {
        Logger.log('[ABsmartly Extension] Plugin detected via global registry:', {
          domInitialized,
          overridesInitialized
        })
        if (domPlugin?.instance) return domPlugin.instance
        if (overridesPlugin?.instance) return overridesPlugin.instance
        return 'active-but-inaccessible'
      }
    }

    // Check for plugin data attributes in the DOM (indicates plugin is active)
    const pluginElements = document.querySelectorAll(
      '[data-absmartly-modified], [data-absmartly-created], [data-absmartly-injected]'
    )
    if (pluginElements.length > 0) {
      Logger.log(
        '[ABsmartly Extension] DOM Changes Plugin artifacts found in DOM - plugin is active but instance not accessible'
      )
      // Plugin is active but we can't access the instance
      return 'active-but-inaccessible'
    }

    return null
  }

  /**
   * Check if plugin is accessible (not just active but inaccessible)
   */
  isPluginAccessible(detectionResult: any): boolean {
    return detectionResult !== null && detectionResult !== 'active-but-inaccessible'
  }

  /**
   * Check if plugin is active (either accessible or detected via DOM artifacts)
   */
  isPluginActive(detectionResult: any): boolean {
    return detectionResult !== null
  }
}
