/**
 * This script is injected directly into the page context
 * It has access to the page's window object and can interact with the ABsmartly SDK
 */

(function() {
  'use strict';

  // Check if already injected
  if (window.__absmartlyExtensionInjected) {
    console.log('[ABsmartly Extension] Already injected, skipping');
    return;
  }
  window.__absmartlyExtensionInjected = true;

  // Capture the extension URL from the current script (must be done synchronously at script load)
  const scriptSrc = document.currentScript ? document.currentScript.src : null;
  const extensionBaseUrl = scriptSrc ? scriptSrc.replace('inject-sdk-plugin.js', '') : null;

  /**
   * Checks if the DOM Changes Plugin is already loaded on the page
   */
  function isPluginAlreadyLoaded() {
    // Check if plugin is registered with the context (new detection method)
    const { context } = detectABsmartlySDK();
    if (context && context.__domPlugin && context.__domPlugin.initialized) {
      console.log('[ABsmartly Extension] Plugin detected via context registration:', {
        version: context.__domPlugin.version,
        capabilities: context.__domPlugin.capabilities,
        timestamp: context.__domPlugin.timestamp
      });
      return context.__domPlugin.instance;
    }

    // Fallback: Check for existing plugin instances that we created
    if (window.__absmartlyExtensionPlugin) {
      console.log('[ABsmartly Extension] Extension plugin already loaded');
      return window.__absmartlyExtensionPlugin;
    }

    // Fallback: Check if site has its own plugin instance (they might have stored it somewhere)
    if (window.__absmartlyPlugin || window.__absmartlyDOMChangesPlugin) {
      console.log('[ABsmartly Extension] Site plugin instance found');
      return window.__absmartlyPlugin || window.__absmartlyDOMChangesPlugin;
    }

    // Check for plugin data attributes in the DOM (indicates plugin is active)
    const pluginElements = document.querySelectorAll('[data-absmartly-modified], [data-absmartly-created], [data-absmartly-injected]');
    if (pluginElements.length > 0) {
      console.log('[ABsmartly Extension] DOM Changes Plugin artifacts found in DOM - plugin is active but instance not accessible');
      // Plugin is active but we can't access the instance
      return 'active-but-inaccessible';
    }

    return null;
  }

  /**
   * Detects ABsmartly SDK on the window object
   */
  function detectABsmartlySDK() {
    // Check common SDK locations
    const possibleLocations = [
      window.ABsmartlyContext,
      window.absmartly,
      window.ABsmartly,
      window.__absmartly,
      window.sdk,
      window.abSmartly,
      window.context,
      window.absmartlyContext,
      window.__context
    ];

    let context = null;

    // First pass: Check if any location is directly a context (has treatment method)
    for (const location of possibleLocations) {
      if (location && typeof location.treatment === 'function') {
        console.log('[ABsmartly Plugin] Found context directly with treatment method');
        context = location;
        break;
      }
    }

    // Second pass: Check if any location has a context property with treatment method
    if (!context) {
      for (const location of possibleLocations) {
        if (location && location.context && typeof location.context.treatment === 'function') {
          console.log('[ABsmartly Plugin] Found context in container.context with treatment method');
          context = location.context;
          break;
        }
      }
    }

    // Third pass: Check for contexts array
    if (!context) {
      for (const location of possibleLocations) {
        if (location && location.contexts && Array.isArray(location.contexts) && location.contexts.length > 0) {
          // Check each context in the array for treatment method
          for (const ctx of location.contexts) {
            if (ctx && typeof ctx.treatment === 'function') {
              console.log('[ABsmartly Plugin] Found context in contexts array with treatment method');
              context = ctx;
              break;
            }
          }
          if (context) break;
        }
      }
    }

    return { sdk: null, context };
  }

  /**
   * Wait for SDK and custom code, then initialize
   */
  function waitForSDKAndInitialize() {
    const maxAttempts = 50; // 5 seconds
    let attempts = 0;

    const checkAndInit = () => {
      attempts++;

      // Check if plugin is already loaded
      const existingPlugin = isPluginAlreadyLoaded();
      if (existingPlugin) {
        if (existingPlugin === 'active-but-inaccessible') {
          console.log('[ABsmartly Extension] Plugin is active but we cannot access it to inject custom code');
          return;
        }
        
        console.log('[ABsmartly Extension] Plugin already loaded, requesting custom code injection only');
        
        // Store reference if we have access to it
        if (typeof existingPlugin === 'object') {
          window.__absmartlyExtensionPlugin = existingPlugin;
        }
        
        // Request custom code from extension
        window.postMessage({
          source: 'absmartly-page',
          type: 'REQUEST_CUSTOM_CODE'
        }, '*');
        return;
      }

      const { context } = detectABsmartlySDK();

      if (context) {
        console.log('[ABsmartly Extension] SDK context found, requesting plugin initialization');
        
        // Request plugin initialization from extension
        window.postMessage({
          source: 'absmartly-page',
          type: 'SDK_CONTEXT_READY'
        }, '*');
      } else if (attempts < maxAttempts) {
        setTimeout(checkAndInit, 100);
      } else {
        console.log('[ABsmartly Extension] No ABsmartly SDK found after 5 seconds');
      }
    };

    // Start checking
    checkAndInit();
  }

  // Listen for messages from content script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.source === 'absmartly-extension') {
      console.log('[ABsmartly Page] Received message from extension:', event.data);

      if (event.data.type === 'INITIALIZE_PLUGIN') {
        const { customCode } = event.data.payload || {};
        
        // Check again if plugin is already loaded
        const existingPlugin = isPluginAlreadyLoaded();
        if (existingPlugin && existingPlugin !== 'active-but-inaccessible') {
          if (customCode && typeof existingPlugin === 'object') {
            console.log('[ABsmartly Extension] Injecting custom code into existing plugin');
            existingPlugin.injectCode(customCode);
          }
          return;
        }

        const { context } = detectABsmartlySDK();
        
        if (!context) {
          console.error('[ABsmartly Extension] No context available for plugin initialization');
          return;
        }

        // Check if DOMChangesPlugin is available, if not load it from extension
        if (typeof window.DOMChangesPlugin === 'undefined' && typeof window.ABSmartlyDOMChanges === 'undefined') {
          console.log('[ABsmartly Extension] DOMChangesPlugin not found, loading from extension...');
          
          // Use the captured extension URL
          if (extensionBaseUrl) {
            const pluginUrl = extensionBaseUrl + 'absmartly-dom-changes.min.js';
            console.log('[ABsmartly Extension] Loading plugin from:', pluginUrl);
            
            // Load the plugin script
            const script = document.createElement('script');
            script.src = pluginUrl;
            script.onload = () => {
              console.log('[ABsmartly Extension] DOM Changes plugin loaded successfully');
              // The UMD bundle exposes ABSmartlyDOMChanges globally
              if (window.ABSmartlyDOMChanges && window.ABSmartlyDOMChanges.DOMChangesPlugin) {
                window.DOMChangesPlugin = window.ABSmartlyDOMChanges.DOMChangesPlugin;
                // Continue with initialization after plugin loads, pass the context
                initializePlugin(context);
              } else {
                console.error('[ABsmartly Extension] Failed to load DOMChangesPlugin from bundle');
              }
            };
            script.onerror = () => {
              console.error('[ABsmartly Extension] Failed to load DOM Changes plugin from extension');
            };
            document.head.appendChild(script);
            return; // Wait for script to load
          } else {
            console.error('[ABsmartly Extension] Cannot determine extension URL to load plugin');
            return;
          }
        }
        
        // If plugin is already available or was aliased from ABSmartlyDOMChanges
        if (typeof window.DOMChangesPlugin === 'undefined' && window.ABSmartlyDOMChanges && window.ABSmartlyDOMChanges.DOMChangesPlugin) {
          window.DOMChangesPlugin = window.ABSmartlyDOMChanges.DOMChangesPlugin;
        }
        
        // Function to initialize the plugin
        function initializePlugin(ctx) {
          const context = ctx || detectABsmartlySDK().context;
          
          if (!context) {
            console.error('[ABsmartly Extension] No context available for plugin initialization');
            return;
          }

          if (typeof window.DOMChangesPlugin === 'undefined') {
            console.error('[ABsmartly Extension] DOMChangesPlugin still not available');
            return;
          }

          try {
            // Initialize the plugin
            const plugin = new window.DOMChangesPlugin({
              context: context,
              autoApply: true,
              spa: true,
              visibilityTracking: true,
              extensionBridge: true,
              dataSource: 'variable',
              dataFieldName: '__dom_changes',
              debug: true
            });

            plugin.initialize().then(() => {
              // Store our plugin instance for fallback detection
              window.__absmartlyExtensionPlugin = plugin;
              
              // The plugin now registers itself with context.__domPlugin
              // We can verify it's registered
              if (context.__domPlugin && context.__domPlugin.instance === plugin) {
                console.log('[ABsmartly Extension] Plugin successfully registered with context');
              }

              // Inject custom code if provided
              if (customCode) {
                plugin.injectCode(customCode);
              }

              // Notify extension
              window.postMessage({
                source: 'absmartly-page',
                type: 'PLUGIN_INITIALIZED',
                payload: {
                  version: context.__domPlugin ? context.__domPlugin.version : '1.0.0',
                  capabilities: context.__domPlugin ? context.__domPlugin.capabilities : []
                }
              }, '*');

              console.log('[ABsmartly Extension] Plugin initialized successfully');
            });
          } catch (error) {
            console.error('[ABsmartly Extension] Failed to initialize plugin:', error);
          }
        }
        
        // Now initialize the plugin with the context we already have
        initializePlugin(context);
      } else if (event.data.type === 'INJECT_CUSTOM_CODE') {
        const { customCode } = event.data.payload || {};
        const plugin = window.__absmartlyExtensionPlugin || window.__absmartlyPlugin || window.__absmartlyDOMChangesPlugin;
        
        if (plugin && customCode && typeof plugin === 'object') {
          console.log('[ABsmartly Extension] Injecting custom code');
          plugin.injectCode(customCode);
        } else {
          console.warn('[ABsmartly Extension] Cannot inject custom code - plugin not accessible');
        }
      }
    }
  });

  // Start the process
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForSDKAndInitialize);
  } else {
    // Give the page a moment to initialize its SDK
    setTimeout(waitForSDKAndInitialize, 100);
  }

})();