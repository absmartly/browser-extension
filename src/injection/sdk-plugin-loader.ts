/**
 * SDK Plugin Loader
 * Detects ABsmartly SDK on the page and initializes the DOM Changes Plugin
 */

import { DOMChangesPlugin } from '@absmartly/dom-changes-plugin'

interface ABsmartlyContext {
  treatment: (experimentName: string) => number
  override: (experimentName: string, variant: number) => void
  ready: () => Promise<void>
  // Add other context methods as needed
}

interface ABsmartlySDK {
  createContext: (config: any) => ABsmartlyContext
  context?: ABsmartlyContext
  contexts?: ABsmartlyContext[]
}

interface WindowWithABsmartly extends Window {
  absmartly?: ABsmartlySDK
  ABsmartly?: ABsmartlySDK
  __absmartly?: ABsmartlySDK
  __absmartlyPlugin?: DOMChangesPlugin
  __absmartlyDOMChangesPlugin?: DOMChangesPlugin
  DOMChangesPlugin?: typeof DOMChangesPlugin
}

declare const window: WindowWithABsmartly

/**
 * Checks if the DOM Changes Plugin is already loaded on the page
 */
function isPluginAlreadyLoaded(): boolean {
  // Check for existing plugin instances
  if (window.__absmartlyPlugin || window.__absmartlyDOMChangesPlugin) {
    console.log('[ABsmartly Extension] DOM Changes Plugin already loaded on page')
    return true
  }

  // Check if the plugin class is available (site might be loading it)
  if (window.DOMChangesPlugin) {
    console.log('[ABsmartly Extension] DOM Changes Plugin class found on page')
    return true
  }

  // Check for plugin data attributes in the DOM
  const pluginElements = document.querySelectorAll('[data-absmartly-modified], [data-absmartly-created], [data-absmartly-injected]')
  if (pluginElements.length > 0) {
    console.log('[ABsmartly Extension] DOM Changes Plugin artifacts found in DOM')
    return true
  }

  return false
}

/**
 * Detects ABsmartly SDK on the window object
 * Checks common variable names where the SDK might be stored
 */
function detectABsmartlySDK(): { sdk: ABsmartlySDK | null, context: ABsmartlyContext | null } {
  // Check common SDK locations
  const possibleSDKs = [
    window.absmartly,
    window.ABsmartly,
    window.__absmartly,
    (window as any).sdk,
    (window as any).abSmartly
  ]

  let sdk: ABsmartlySDK | null = null
  let context: ABsmartlyContext | null = null

  // Find the SDK
  for (const possibleSDK of possibleSDKs) {
    if (possibleSDK && (possibleSDK.createContext || possibleSDK.context || possibleSDK.contexts)) {
      sdk = possibleSDK
      break
    }
  }

  // Try to find an existing context
  if (sdk) {
    if (sdk.context) {
      context = sdk.context
    } else if (sdk.contexts && sdk.contexts.length > 0) {
      context = sdk.contexts[0] // Use the first context
    }
  }

  // Also check for standalone context variables
  if (!context) {
    const possibleContexts = [
      (window as any).context,
      (window as any).absmartlyContext,
      (window as any).__context
    ]

    for (const possibleContext of possibleContexts) {
      if (possibleContext && typeof possibleContext.treatment === 'function') {
        context = possibleContext
        break
      }
    }
  }

  return { sdk, context }
}

/**
 * Initializes the DOM Changes Plugin with the detected SDK context
 */
export async function initializeSDKPlugin(customCode?: any): Promise<DOMChangesPlugin | null> {
  console.log('[ABsmartly Extension] Attempting to initialize SDK plugin...')

  // Check if plugin is already loaded
  if (isPluginAlreadyLoaded()) {
    console.log('[ABsmartly Extension] Plugin already loaded, skipping initialization')
    
    // Try to get the existing plugin instance
    const existingPlugin = window.__absmartlyPlugin || window.__absmartlyDOMChangesPlugin
    if (existingPlugin && customCode) {
      // Inject custom code into existing plugin
      console.log('[ABsmartly Extension] Injecting custom code into existing plugin')
      existingPlugin.injectCode(customCode)
    }
    return existingPlugin || null
  }

  const { sdk, context } = detectABsmartlySDK()

  if (!context) {
    console.warn('[ABsmartly Extension] No ABsmartly context found on the page')
    return null
  }

  console.log('[ABsmartly Extension] ABsmartly context detected, initializing plugin...')

  try {
    // Initialize the DOM Changes Plugin
    const plugin = new DOMChangesPlugin({
      context: context,
      autoApply: true,              // Automatically apply changes
      spa: true,                    // Enable SPA support
      visibilityTracking: true,     // Track when changes become visible
      extensionBridge: true,         // Enable browser extension communication
      dataSource: 'variable',       // Use variables for DOM changes
      dataFieldName: '__dom_changes',
      debug: true                    // Enable debug logging for development
    })

    // Initialize the plugin
    await plugin.initialize()

    // Store plugin reference for debugging
    window.__absmartlyPlugin = plugin

    // Inject custom code if provided
    if (customCode) {
      plugin.injectCode(customCode)
    }

    // Listen for injection code requests from the plugin
    plugin.on('request-injection-code', () => {
      // Request injection code from the extension
      window.postMessage({
        source: 'absmartly-sdk',
        type: 'REQUEST_INJECTION_CODE'
      }, '*')
    })

    // Listen for experiment triggers
    plugin.on('experiment-triggered', (data) => {
      console.log('[ABsmartly Extension] Experiment triggered:', data)
      // Notify extension about experiment trigger
      window.postMessage({
        source: 'absmartly-sdk',
        type: 'EXPERIMENT_TRIGGERED',
        data
      }, '*')
    })

    console.log('[ABsmartly Extension] SDK plugin initialized successfully')
    return plugin

  } catch (error) {
    console.error('[ABsmartly Extension] Failed to initialize SDK plugin:', error)
    return null
  }
}

/**
 * Waits for the SDK to be available on the page
 */
export function waitForSDK(timeout = 10000): Promise<{ sdk: ABsmartlySDK | null, context: ABsmartlyContext | null }> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    
    const checkForSDK = () => {
      const result = detectABsmartlySDK()
      
      if (result.context) {
        resolve(result)
      } else if (Date.now() - startTime < timeout) {
        setTimeout(checkForSDK, 100)
      } else {
        console.warn('[ABsmartly Extension] Timeout waiting for ABsmartly SDK')
        resolve({ sdk: null, context: null })
      }
    }

    checkForSDK()
  })
}

/**
 * Main initialization function
 */
export async function initializeWithRetry(customCode?: any): Promise<DOMChangesPlugin | null> {
  // Wait for SDK to be available
  const { context } = await waitForSDK()
  
  if (!context) {
    return null
  }

  // Initialize the plugin
  return initializeSDKPlugin(customCode)
}