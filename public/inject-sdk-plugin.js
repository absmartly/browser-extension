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
  
  // Track initialization state
  let isInitializing = false;
  let isInitialized = false;
  let cachedContext = null; // Cache the context to avoid repeated detection

  // Capture the extension URL from the current script (must be done synchronously at script load)
  const scriptSrc = document.currentScript ? document.currentScript.src : null;
  const extensionBaseUrl = scriptSrc ? scriptSrc.replace('inject-sdk-plugin.js', '') : null;

  /**
   * Checks if the DOM Changes Plugin is already loaded on the page
   */
  function isPluginAlreadyLoaded() {
    // Use cached context if available
    const context = cachedContext || detectABsmartlySDK().context;
    
    // Check if plugin is registered with the context (new detection method)
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
   * Detects ABsmartly SDK on the window object - uses cache if available
   */
  function detectABsmartlySDK() {
    // Return cached context if we already found it
    if (cachedContext) {
      return { sdk: null, context: cachedContext };
    }

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
        context = location;
        break;
      }
    }

    // Second pass: Check if any location has a context property with treatment method
    if (!context) {
      for (const location of possibleLocations) {
        if (location && location.context && typeof location.context.treatment === 'function') {
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
              context = ctx;
              break;
            }
          }
          if (context) break;
        }
      }
    }

    // Cache the context for future use
    if (context && !cachedContext) {
      cachedContext = context;
      console.log('[ABsmartly Extension] Context found and cached');
    }

    return { sdk: null, context };
  }

  /**
   * Executes script tags found in HTML content
   * Scripts injected via innerHTML don't execute, so we need to recreate them
   */
  function executeScriptsInHTML(html, location) {
    console.log(`[ABsmartly Extension] Processing scripts for ${location}`);
    
    // Create a temporary container
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Find all script tags
    const scripts = temp.querySelectorAll('script');
    
    scripts.forEach((script, index) => {
      console.log(`[ABsmartly Extension] Executing script ${index + 1} from ${location}`);
      
      try {
        if (script.src) {
          // External script - create a new script element
          const newScript = document.createElement('script');
          newScript.src = script.src;
          newScript.async = script.async;
          newScript.defer = script.defer;
          newScript.setAttribute('data-absmartly-injected', location);
          
          // Add to appropriate location
          insertAtLocation(newScript, location);
        } else {
          // Inline script - execute the code immediately
          const code = script.textContent || script.innerText || '';
          if (code) {
            const fn = new Function(code);
            fn();
            console.log(`[ABsmartly Extension] Successfully executed inline script from ${location}`);
          }
        }
      } catch (error) {
        console.error(`[ABsmartly Extension] Failed to execute script from ${location}:`, error);
      }
    });
  }

  /**
   * Inserts an element at the correct location based on the injection point
   */
  function insertAtLocation(element, location) {
    switch(location) {
      case 'headStart':
        if (document.head.firstChild) {
          document.head.insertBefore(element, document.head.firstChild);
        } else {
          document.head.appendChild(element);
        }
        break;
      case 'headEnd':
        document.head.appendChild(element);
        break;
      case 'bodyStart':
        if (document.body.firstChild) {
          document.body.insertBefore(element, document.body.firstChild);
        } else {
          document.body.appendChild(element);
        }
        break;
      case 'bodyEnd':
        document.body.appendChild(element);
        break;
      default:
        console.warn(`[ABsmartly Extension] Unknown injection location: ${location}`);
    }
  }

  /**
   * Wait for SDK and custom code, then initialize
   */
  function waitForSDKAndInitialize() {
    const maxAttempts = 50; // 5 seconds
    let attempts = 0;

    const checkAndInit = () => {
      attempts++;

      // Detect context only once
      if (!cachedContext) {
        detectABsmartlySDK();
      }

      // Check if plugin is already loaded (uses cached context)
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

      const context = cachedContext;

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

      // Handle preview changes
      if (event.data.type === 'PREVIEW_CHANGES') {
        console.log('[ABsmartly Page] Handling PREVIEW_CHANGES message');
        const { changes } = event.data.payload || {};
        
        // Try to get the plugin instance
        let plugin = null;
        
        // First try from context
        if (cachedContext && cachedContext.__domPlugin && cachedContext.__domPlugin.instance) {
          plugin = cachedContext.__domPlugin.instance;
          console.log('[ABsmartly Page] Got plugin from context.__domPlugin');
        }
        // Fallback to window reference
        else if (window.__absmartlyExtensionPlugin) {
          plugin = window.__absmartlyExtensionPlugin;
          console.log('[ABsmartly Page] Got plugin from window.__absmartlyExtensionPlugin');
        }
        
        if (plugin && typeof plugin.previewChanges === 'function') {
          console.log('[ABsmartly Page] Calling plugin.previewChanges with changes:', changes);
          plugin.previewChanges(changes || []);
        } else {
          console.error('[ABsmartly Page] Plugin not found or previewChanges method not available');
        }
        return;
      }

      // Handle remove preview
      if (event.data.type === 'REMOVE_PREVIEW') {
        console.log('[ABsmartly Page] Handling REMOVE_PREVIEW message');
        
        // Try to get the plugin instance
        let plugin = null;
        
        // First try from context
        if (cachedContext && cachedContext.__domPlugin && cachedContext.__domPlugin.instance) {
          plugin = cachedContext.__domPlugin.instance;
          console.log('[ABsmartly Page] Got plugin from context.__domPlugin');
        }
        // Fallback to window reference
        else if (window.__absmartlyExtensionPlugin) {
          plugin = window.__absmartlyExtensionPlugin;
          console.log('[ABsmartly Page] Got plugin from window.__absmartlyExtensionPlugin');
        }
        
        if (plugin && typeof plugin.removePreview === 'function') {
          console.log('[ABsmartly Page] Calling plugin.removePreview');
          plugin.removePreview();
        } else {
          console.error('[ABsmartly Page] Plugin not found or removePreview method not available');
        }
        return;
      }

      if (event.data.type === 'INITIALIZE_PLUGIN') {
        // Prevent multiple initializations
        if (isInitialized || isInitializing) {
          console.log('[ABsmartly Extension] Already initialized or initializing, skipping');
          return;
        }
        isInitializing = true;
        
        const { customCode } = event.data.payload || {};
        
        // Check again if plugin is already loaded
        const existingPlugin = isPluginAlreadyLoaded();
        if (existingPlugin && existingPlugin !== 'active-but-inaccessible') {
          // Custom code will be injected via INJECTION_CODE message from the plugin
          isInitialized = true;
          isInitializing = false;
          return;
        }

        // Use cached context (should already be detected by waitForSDKAndInitialize)
        const context = cachedContext;
        
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
              console.log('[ABsmartly Extension] ABSmartlyDOMChanges object:', window.ABSmartlyDOMChanges);
              console.log('[ABsmartly Extension] Available properties:', Object.keys(window.ABSmartlyDOMChanges || {}));
              
              // The UMD bundle exposes ABSmartlyDOMChanges globally
              // Check different possible export patterns
              if (window.ABSmartlyDOMChanges) {
                // Try direct property
                if (window.ABSmartlyDOMChanges.DOMChangesPlugin) {
                  window.DOMChangesPlugin = window.ABSmartlyDOMChanges.DOMChangesPlugin;
                }
                // Try default export
                else if (window.ABSmartlyDOMChanges.default) {
                  window.DOMChangesPlugin = window.ABSmartlyDOMChanges.default;
                }
                // Try if ABSmartlyDOMChanges itself is the plugin class
                else if (typeof window.ABSmartlyDOMChanges === 'function') {
                  window.DOMChangesPlugin = window.ABSmartlyDOMChanges;
                }
                
                if (window.DOMChangesPlugin) {
                  console.log('[ABsmartly Extension] DOMChangesPlugin found and assigned');
                  // Continue with initialization after plugin loads, pass the context
                  initializePlugin(context);
                } else {
                  console.error('[ABsmartly Extension] Could not find DOMChangesPlugin in bundle');
                }
              } else {
                console.error('[ABsmartly Extension] ABSmartlyDOMChanges not found on window');
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
          const context = ctx || cachedContext;
          
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
                console.log('[ABsmartly Extension] Injecting custom code directly');
                try {
                  // Parse the custom code object
                  const codeData = typeof customCode === 'string' ? JSON.parse(customCode) : customCode;
                  
                  // Call the plugin's injectCode method for HTML/CSS
                  if (plugin.injectCode && typeof plugin.injectCode === 'function') {
                    plugin.injectCode(codeData);
                    console.log('[ABsmartly Extension] Custom code injected via plugin.injectCode');
                  }
                  
                  // ALWAYS execute scripts manually since the plugin's injection doesn't execute them
                  ['headStart', 'headEnd', 'bodyStart', 'bodyEnd'].forEach(location => {
                    if (codeData[location]) {
                      console.log(`[ABsmartly Extension] Executing scripts for ${location}`);
                      executeScriptsInHTML(codeData[location], location);
                    }
                  });
                } catch (error) {
                  console.error('[ABsmartly Extension] Failed to inject custom code:', error);
                }
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
              isInitialized = true;
              isInitializing = false;
            }).catch(error => {
              console.error('[ABsmartly Extension] Failed to initialize plugin:', error);
              isInitializing = false;
            });
          } catch (error) {
            console.error('[ABsmartly Extension] Failed to initialize plugin:', error);
            isInitializing = false;
          }
        }
        
        // Now initialize the plugin with the context we already have
        initializePlugin(context);
      } else if (event.data.type === 'INJECT_CUSTOM_CODE') {
        // This message type is not currently used - custom code comes via INJECTION_CODE
        console.log('[ABsmartly Extension] INJECT_CUSTOM_CODE message received but not used');
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