/**
 * This script is injected directly into the page context
 * It has access to the page's window object and can interact with the ABsmartly SDK
 */

(function() {
  'use strict';

  // Simple debug flag and functions
  const DEBUG = true;
  
  function debugLog(...args) {
    if (DEBUG) console.log(...args);
  }
  
  function debugError(...args) {
    if (DEBUG) console.error(...args);
  }
  
  function debugWarn(...args) {
    if (DEBUG) console.warn(...args);
  }

  // Version for cache busting
  const INJECT_VERSION = '1.0.7';
  debugLog('[ABsmartly Extension] Inject SDK Plugin version:', INJECT_VERSION);

  // Check if already injected
  if (window.__absmartlyExtensionInjected) {
    debugLog('[ABsmartly Extension] Already injected, skipping');
    return;
  }
  window.__absmartlyExtensionInjected = true;
  
  // Track initialization state
  let isInitializing = false;
  let isInitialized = false;
  let cachedContext = null; // Cache the context to avoid repeated detection
  let contextPropertyPath = null; // Store WHERE the context is found

  // Capture the extension URL from the current script (must be done synchronously at script load)
  const scriptSrc = document.currentScript ? document.currentScript.src : null;
  debugLog('[ABsmartly Extension] Script source:', scriptSrc);
  const extensionBaseUrl = scriptSrc ? scriptSrc.replace(/inject-sdk-plugin\.[a-f0-9]+\.js$/, '').replace(/inject-sdk-plugin\.js$/, '') : null;
  debugLog('[ABsmartly Extension] Extension base URL:', extensionBaseUrl);

  /**
   * Manually apply DOM changes as a fallback when plugin methods aren't available
   */
  function applyDOMChangesManually(changes) {
    debugLog('[ABsmartly Page] 🎨 Applying DOM changes manually:', changes);
    debugLog('[ABsmartly Page] 📊 Total changes to apply:', changes.length);
    
    if (!changes || !Array.isArray(changes)) {
      debugWarn('[ABsmartly Page] Invalid changes array');
      return;
    }
    
    changes.forEach((change, index) => {
      try {
        debugLog(`[ABsmartly Page] 🔄 Processing change ${index + 1}/${changes.length}:`, {
          type: change.type,
          selector: change.selector,
          enabled: change.enabled !== false,
          value: change.value,
          textValue: change.textValue,
          styles: change.styles,
          fullChange: change
        });
        
        if (!change.selector || !change.type) {
          debugWarn(`[ABsmartly Page] ⚠️ Invalid change at index ${index}:`, change);
          return;
        }
        
        // Skip disabled changes
        if (change.enabled === false) {
          debugLog(`[ABsmartly Page] ⏭️ Skipping disabled change: ${change.selector}`);
          return;
        }
        
        const elements = document.querySelectorAll(change.selector);
        debugLog(`[ABsmartly Page] 🎯 Found ${elements.length} element(s) matching selector: "${change.selector}"`);
        
        if (elements.length === 0) {
          debugWarn(`[ABsmartly Page] ⚠️ No elements found for selector: ${change.selector}`);
          return;
        }
        
        elements.forEach((element, elementIndex) => {
          debugLog(`[ABsmartly Page] 🎯 Processing element ${elementIndex + 1}/${elements.length} for change type: ${change.type}`);
          
          // Log detailed element state BEFORE any changes
          const computedStyle = window.getComputedStyle(element);
          debugLog(`[ABsmartly Page] 📸 Element BEFORE change:`, {
            selector: change.selector,
            tagName: element.tagName,
            id: element.id || 'no-id',
            className: element.className || 'no-class',
            textContent: element.textContent?.substring(0, 100),
            innerHTML: element.innerHTML?.substring(0, 200),
            inlineStyles: element.getAttribute('style') || 'no-inline-styles',
            computedBackground: computedStyle.backgroundColor,
            computedBorder: computedStyle.border,
            computedBorderRadius: computedStyle.borderRadius,
            computedPadding: computedStyle.padding,
            computedMargin: computedStyle.margin,
            fullOuterHTML: element.outerHTML.substring(0, 1000)
          });
          
          // Store original values for preview removal
          if (!element.dataset.absmartlyOriginal) {
            element.dataset.absmartlyOriginal = JSON.stringify({});
          }
          const originalData = JSON.parse(element.dataset.absmartlyOriginal);
          
          switch (change.type) {
            case 'text':
              if (!originalData.textContent) {
                originalData.textContent = element.textContent;
                debugLog(`[ABsmartly Page] 📝 Storing original text: "${originalData.textContent}"`);
              }
              debugLog(`[ABsmartly Page] ✏️ Changing text from "${element.textContent}" to "${change.value}"`);
              element.textContent = change.value;
              // Mark element as modified
              element.dataset.absmartlyModified = 'true';
              break;
              
            case 'html':
              if (!originalData.innerHTML) {
                originalData.innerHTML = element.innerHTML;
                debugLog(`[ABsmartly Page] 📄 Storing original HTML (${originalData.innerHTML.length} chars):`, originalData.innerHTML.substring(0, 200));
              }
              debugLog(`[ABsmartly Page] 🔄 Replacing HTML content with:`, change.value?.substring(0, 200));
              element.innerHTML = change.value;
              element.dataset.absmartlyModified = 'true';
              break;
              
            case 'attribute':
              if (change.attribute) {
                if (!originalData.attributes) {
                  originalData.attributes = {};
                }
                if (!originalData.attributes[change.attribute]) {
                  originalData.attributes[change.attribute] = element.getAttribute(change.attribute);
                }
                element.setAttribute(change.attribute, change.value);
              }
              break;
              
            case 'style':
            case 'styles':
              // Handle both formats: change.styles and change.value
              const styleObj = change.styles || change.value;
              if (!originalData.styles) {
                originalData.styles = {};
                originalData.originalStyleAttribute = element.getAttribute('style') || '';
              }
              
              debugLog(`[ABsmartly Page] 🎨 Processing style change:`, {
                changeType: change.type,
                styleObj: styleObj,
                typeOfStyleObj: typeof styleObj
              });
              
              if (typeof styleObj === 'string') {
                // Store original style attribute if not already stored
                if (!originalData.originalStyleAttribute) {
                  originalData.originalStyleAttribute = element.getAttribute('style') || '';
                }
                debugLog(`[ABsmartly Page] 🎨 Applying style string: "${styleObj}"`);
                element.setAttribute('style', styleObj);
              } else if (styleObj && typeof styleObj === 'object') {
                debugLog(`[ABsmartly Page] 🎨 Applying style object:`, styleObj);
                Object.entries(styleObj).forEach(([prop, value]) => {
                  if (!originalData.styles[prop]) {
                    originalData.styles[prop] = element.style[prop] || '';
                    debugLog(`[ABsmartly Page] 📦 Storing original style.${prop}: "${originalData.styles[prop]}"`);
                  }
                  debugLog(`[ABsmartly Page] 🖌️ Setting style.${prop}: "${value}"`);
                  element.style[prop] = value;
                });
              }
              // Mark element as modified
              element.dataset.absmartlyModified = 'true';
              break;
              
            case 'class':
              debugLog(`[ABsmartly Page] 🏷️ Processing class changes - Add: ${change.add}, Remove: ${change.remove}`);
              if (change.action === 'add' && change.className) {
                element.classList.add(change.className);
              } else if (change.action === 'remove' && change.className) {
                element.classList.remove(change.className);
              } else if (change.action === 'toggle' && change.className) {
                element.classList.toggle(change.className);
              }
              break;
              
            default:
              debugWarn(`[ABsmartly Page] Unknown change type: ${change.type}`);
          }
          
          // Store the updated original data
          element.dataset.absmartlyOriginal = JSON.stringify(originalData);
          
          // Log detailed element state AFTER changes
          const computedStyleAfter = window.getComputedStyle(element);
          debugLog(`[ABsmartly Page] 📸 Element AFTER change:`, {
            selector: change.selector,
            tagName: element.tagName,
            id: element.id || 'no-id',
            className: element.className || 'no-class',
            textContent: element.textContent?.substring(0, 100),
            innerHTML: element.innerHTML?.substring(0, 200),
            inlineStyles: element.getAttribute('style') || 'no-inline-styles',
            computedBackground: computedStyleAfter.backgroundColor,
            computedBorder: computedStyleAfter.border,
            computedBorderRadius: computedStyleAfter.borderRadius,
            computedPadding: computedStyleAfter.padding,
            computedMargin: computedStyleAfter.margin,
            datasetModified: element.dataset.absmartlyModified,
            fullOuterHTML: element.outerHTML.substring(0, 1000)
          });
        });
      } catch (error) {
        debugError(`[ABsmartly Page] ❌ Error applying change at index ${index}:`, error, change);
      }
    });
    
    debugLog('[ABsmartly Page] ✅ DOM changes application complete');
    debugLog('[ABsmartly Page] 📊 Summary: Applied changes to', document.querySelectorAll('[data-absmartly-modified]').length, 'elements');
  }
  
  /**
   * Remove manually applied DOM changes
   */
  function removeDOMChangesManually() {
    debugLog('[ABsmartly Page] 🔙 Removing DOM changes manually');
    debugLog('[ABsmartly Page] 🔍 Looking for elements with data-absmartly attributes...');
    
    // Look for both modified elements and preview elements
    const modifiedElements = document.querySelectorAll('[data-absmartly-modified], [data-absmartly-experiment="__preview__"]');
    debugLog(`[ABsmartly Page] Found ${modifiedElements.length} elements to restore`);
    
    modifiedElements.forEach((element, index) => {
      try {
        // Log element state BEFORE restoration
        const computedStyleBefore = window.getComputedStyle(element);
        debugLog(`[ABsmartly Page] 🔄 Element ${index + 1}/${modifiedElements.length} BEFORE restoration:`, {
          tagName: element.tagName,
          id: element.id || 'no-id',
          className: element.className || 'no-class',
          currentText: element.textContent?.substring(0, 100),
          currentInlineStyles: element.getAttribute('style') || 'no-inline-styles',
          computedBackground: computedStyleBefore.backgroundColor,
          computedBorder: computedStyleBefore.border,
          computedBorderRadius: computedStyleBefore.borderRadius,
          currentOuterHTML: element.outerHTML.substring(0, 500)
        });
        
        const originalData = element.dataset.absmartlyOriginal ? 
          JSON.parse(element.dataset.absmartlyOriginal) : null;
        
        debugLog(`[ABsmartly Page] 📦 Original data to restore:`, originalData);
        
        if (originalData) {
          // Restore text content
          if (originalData.textContent !== undefined) {
            debugLog(`[ABsmartly Page] 📝 Restoring text from "${element.textContent}" to "${originalData.textContent}"`);
            element.textContent = originalData.textContent;
          }
          
          // Restore innerHTML
          if (originalData.innerHTML !== undefined) {
            debugLog(`[ABsmartly Page] 📄 Restoring HTML (${originalData.innerHTML.length} chars)`);
            element.innerHTML = originalData.innerHTML;
          }
          
          // Restore attributes
          if (originalData.attributes) {
            Object.entries(originalData.attributes).forEach(([attr, value]) => {
              if (value === null) {
                element.removeAttribute(attr);
              } else {
                element.setAttribute(attr, value);
              }
            });
          }
          
          // Restore styles - try original style attribute first
          if (originalData.originalStyleAttribute !== undefined) {
            debugLog(`[ABsmartly Page] 🎨 Restoring original style attribute: "${originalData.originalStyleAttribute}"`);
            if (originalData.originalStyleAttribute === '') {
              element.removeAttribute('style');
            } else {
              element.setAttribute('style', originalData.originalStyleAttribute);
            }
          } else if (originalData.styles) {
            // Fallback to individual style properties
            debugLog(`[ABsmartly Page] 🎨 Restoring individual styles:`, originalData.styles);
            Object.entries(originalData.styles).forEach(([prop, value]) => {
              debugLog(`[ABsmartly Page] 🖌️ Restoring style.${prop} from "${element.style[prop]}" to "${value || ''}"`);
              element.style[prop] = value || '';
            });
          }
        }
        
        // Clean up data attributes
        delete element.dataset.absmartlyModified;
        delete element.dataset.absmartlyOriginal;
        delete element.dataset.absmartlyExperiment;
        delete element.dataset.absmartlyCreated;
        delete element.dataset.absmartlyInjected;
        
        // Log element state AFTER restoration
        const computedStyleAfter = window.getComputedStyle(element);
        debugLog(`[ABsmartly Page] ✅ Element ${index + 1}/${modifiedElements.length} AFTER restoration:`, {
          tagName: element.tagName,
          id: element.id || 'no-id',
          className: element.className || 'no-class',
          restoredText: element.textContent?.substring(0, 100),
          restoredInlineStyles: element.getAttribute('style') || 'no-inline-styles',
          computedBackground: computedStyleAfter.backgroundColor,
          computedBorder: computedStyleAfter.border,
          computedBorderRadius: computedStyleAfter.borderRadius,
          finalOuterHTML: element.outerHTML.substring(0, 500)
        });
      } catch (error) {
        debugError('[ABsmartly Page] ❌ Error restoring element:', error, element);
      }
    });
    
    debugLog('[ABsmartly Page] ✅ DOM changes removal complete');
    debugLog('[ABsmartly Page] 📊 Summary: Restored', modifiedElements.length, 'elements to original state');
  }

  /**
   * Checks if the DOM Changes Plugin is already loaded on the page
   */
  function isPluginAlreadyLoaded() {
    // Use cached context if available
    const context = cachedContext || detectABsmartlySDK().context;
    
    // Check if plugin is registered with the context (new detection method as per PLUGIN_DETECTION.md)
    if (context && context.__domPlugin && context.__domPlugin.initialized) {
      debugLog('[ABsmartly Extension] Plugin detected via context.__domPlugin registration:', {
        version: context.__domPlugin.version,
        capabilities: context.__domPlugin.capabilities,
        timestamp: context.__domPlugin.timestamp
      });
      // Plugin is properly registered with context, no need to store globally
      return context.__domPlugin.instance;
    }

    // No need to check window storage - plugin should only be accessed via context

    // Check if site has its own plugin instance (they might have stored it somewhere)
    if (window.__absmartlyPlugin) {
      debugLog('[ABsmartly Extension] Site plugin instance found at window.__absmartlyPlugin');
      // Don't store plugin globally - access via context only
      return window.__absmartlyPlugin;
    }
    
    if (window.__absmartlyDOMChangesPlugin) {
      debugLog('[ABsmartly Extension] Site plugin instance found at window.__absmartlyDOMChangesPlugin');
      // Don't store plugin globally - access via context only
      return window.__absmartlyDOMChangesPlugin;
    }

    // Check for plugin data attributes in the DOM (indicates plugin is active)
    const pluginElements = document.querySelectorAll('[data-absmartly-modified], [data-absmartly-created], [data-absmartly-injected]');
    if (pluginElements.length > 0) {
      debugLog('[ABsmartly Extension] DOM Changes Plugin artifacts found in DOM - plugin is active but instance not accessible');
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

    // Cache the context and its location for future use
    if (context && !cachedContext) {
      cachedContext = context;
      
      // Store where we found it
      if (window.ABsmartlyContext === context) {
        contextPropertyPath = 'ABsmartlyContext';
      } else if (window.absmartly === context) {
        contextPropertyPath = 'absmartly';
      } else if (window.sdk && window.sdk.context === context) {
        contextPropertyPath = 'sdk.context';
      } else {
        contextPropertyPath = 'unknown';
      }
      
      debugLog('[ABsmartly Extension] Context found and cached at:', contextPropertyPath);
    }

    return { sdk: null, context };
  }

  /**
   * Executes script tags found in HTML content
   * Scripts injected via innerHTML don't execute, so we need to recreate them
   */
  function executeScriptsInHTML(html, location) {
    debugLog(`[ABsmartly Extension] Processing scripts for ${location}`);
    
    // Create a temporary container
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Find all script tags
    const scripts = temp.querySelectorAll('script');
    
    scripts.forEach((script, index) => {
      debugLog(`[ABsmartly Extension] Executing script ${index + 1} from ${location}`);
      
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
            debugLog(`[ABsmartly Extension] Successfully executed inline script from ${location}`);
          }
        }
      } catch (error) {
        debugError(`[ABsmartly Extension] Failed to execute script from ${location}:`, error);
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
        debugWarn(`[ABsmartly Extension] Unknown injection location: ${location}`)
    }
  }

  /**
   * Apply experiment overrides from cookie
   */
  function applyExperimentOverrides(context) {
    try {
      // Read the absmartly_overrides cookie
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('absmartly_overrides='))
        ?.split('=')[1];
      
      if (cookieValue) {
        const overrides = JSON.parse(decodeURIComponent(cookieValue));
        debugLog('[ABsmartly Extension] Found experiment overrides in cookie:', overrides);
        
        // Apply overrides to the context
        if (typeof context.override === 'function') {
          Object.entries(overrides).forEach(([experimentName, variantIndex]) => {
            debugLog(`[ABsmartly Extension] Applying override: ${experimentName} -> variant ${variantIndex}`);
            context.override(experimentName, variantIndex);
          });
        } else if (typeof context.overrides === 'function') {
          // Some SDKs might use overrides method instead
          debugLog('[ABsmartly Extension] Using context.overrides method');
          context.overrides(overrides);
        } else {
          debugWarn('[ABsmartly Extension] Context does not have override/overrides method');
        }
      }
    } catch (error) {
      debugError('[ABsmartly Extension] Failed to apply experiment overrides:', error);
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
      
      // Log context data when found
      if (cachedContext && cachedContext.data && typeof cachedContext.data === 'function') {
        const data = cachedContext.data();
        debugLog('[ABsmartly Extension] Context data on init:', data);
        debugLog('[ABsmartly Extension] Experiments available:', data?.experiments ? Object.keys(data.experiments) : 'none');
      }

      // Check if plugin is already loaded (uses cached context)
      const existingPlugin = isPluginAlreadyLoaded();
      if (existingPlugin) {
        if (existingPlugin === 'active-but-inaccessible') {
          debugLog('[ABsmartly Extension] Plugin is active but we cannot access it to inject custom code');
          return;
        }
        
        debugLog('[ABsmartly Extension] Plugin already loaded, requesting custom code injection only');
        
        // Plugin is already loaded and registered with context
        
        // Apply overrides if context is available
        if (cachedContext) {
          applyExperimentOverrides(cachedContext);
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
        debugLog('[ABsmartly Extension] SDK context found, requesting plugin initialization');
        
        // Check if context needs to be ready
        if (context.ready && typeof context.ready === 'function' && context.pending && context.pending()) {
          debugLog('[ABsmartly Extension] Context is pending, waiting for it to be ready...');
          context.ready().then(() => {
            debugLog('[ABsmartly Extension] Context is now ready after waiting');
            const data = context.data ? context.data() : null;
            debugLog('[ABsmartly Extension] Context data after ready:', data);
            debugLog('[ABsmartly Extension] Experiments after ready:', data?.experiments ? Object.keys(data.experiments) : 'none');
          }).catch(err => {
            debugError('[ABsmartly Extension] Error waiting for context:', err);
          });
        }
        
        // Apply experiment overrides from cookie
        applyExperimentOverrides(context);
        
        // Request plugin initialization from extension
        window.postMessage({
          source: 'absmartly-page',
          type: 'SDK_CONTEXT_READY'
        }, '*');
      } else if (attempts < maxAttempts) {
        setTimeout(checkAndInit, 100);
      } else {
        debugLog('[ABsmartly Extension] No ABsmartly SDK found after 5 seconds');
      }
    };

    // Start checking
    checkAndInit();
  }

  // Listen for messages from content script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.source === 'absmartly-extension') {
      debugLog('[ABsmartly Page] Received message from extension:', event.data);

      // Handle dynamic override updates
      if (event.data.type === 'APPLY_OVERRIDES') {
        debugLog('[ABsmartly Page] Applying overrides dynamically');
        const { overrides } = event.data.payload || {};
        
        if (cachedContext && overrides) {
          // Apply the overrides to the context
          if (typeof cachedContext.override === 'function') {
            Object.entries(overrides).forEach(([experimentName, variantIndex]) => {
              debugLog(`[ABsmartly Page] Applying override: ${experimentName} -> variant ${variantIndex}`);
              cachedContext.override(experimentName, variantIndex);
            });
            
            // After applying overrides, we need to refresh the page for DOM changes to take effect
            // Since DOM changes are applied during initialization
            debugLog('[ABsmartly Page] Overrides applied. Page will reload to apply DOM changes.');
          } else {
            debugWarn('[ABsmartly Page] Context does not have override method');
          }
        }
        return;
      }

      // Handle preview changes
      if (event.data.type === 'PREVIEW_CHANGES') {
        debugLog('[ABsmartly Page] Handling PREVIEW_CHANGES message');
        const { changes, updateMode } = event.data.payload || {};
        
        // Try to get the plugin instance - check all possible locations
        let plugin = null;
        
        // First try from context
        if (cachedContext && cachedContext.__domPlugin && cachedContext.__domPlugin.instance) {
          plugin = cachedContext.__domPlugin.instance;
          debugLog('[ABsmartly Page] Got plugin from context.__domPlugin');
        }
        // Don't use window reference - only use context.__domPlugin
        // Try site's own plugin instances
        else if (window.__absmartlyPlugin) {
          plugin = window.__absmartlyPlugin;
          debugLog('[ABsmartly Page] Got plugin from window.__absmartlyPlugin');
        }
        else if (window.__absmartlyDOMChangesPlugin) {
          plugin = window.__absmartlyDOMChangesPlugin;
          debugLog('[ABsmartly Page] Got plugin from window.__absmartlyDOMChangesPlugin');
        }
        // If still no plugin, try to detect it
        else {
          const existingPlugin = isPluginAlreadyLoaded();
          if (existingPlugin && existingPlugin !== 'active-but-inaccessible') {
            plugin = existingPlugin;
            debugLog('[ABsmartly Page] Got plugin from isPluginAlreadyLoaded()');
          }
        }
        
        if (plugin) {
          const { experimentName } = event.data.payload || {};
          const expName = experimentName || '__preview__';
          debugLog('[ABsmartly Page] Applying preview changes for experiment:', expName);
          debugLog('[ABsmartly Page] Update mode:', updateMode);
          debugLog('[ABsmartly Page] Changes to apply:', changes);
          
          try {
            // Always remove all changes first for now
            // The plugin doesn't have a way to remove individual changes yet
            if (typeof plugin.removeChanges === 'function') {
              plugin.removeChanges(expName);
              debugLog('[ABsmartly Page] Removed existing changes for experiment:', expName);
            }
            
            // Apply changes using the public applyChange method
            if (typeof plugin.applyChange === 'function') {
              let appliedCount = 0;
              for (const change of (changes || [])) {
                if (plugin.applyChange(change, expName)) {
                  appliedCount++;
                  debugLog('[ABsmartly Page] Applied change:', change.selector, change.type);
                } else {
                  debugLog('[ABsmartly Page] Failed to apply change:', change.selector, change.type);
                }
              }
              debugLog('[ABsmartly Page] Successfully applied', appliedCount, 'of', (changes || []).length, 'changes via applyChange');
            } else if (plugin.domManipulator && typeof plugin.domManipulator.applyChange === 'function') {
              // Fallback to domManipulator for older plugin versions
              debugLog('[ABsmartly Page] Using domManipulator fallback (older plugin version)');
              let appliedCount = 0;
              for (const change of (changes || [])) {
                if (plugin.domManipulator.applyChange(change, expName)) {
                  appliedCount++;
                  debugLog('[ABsmartly Page] Applied change:', change.selector, change.type);
                } else {
                  debugLog('[ABsmartly Page] Failed to apply change:', change.selector, change.type);
                }
              }
              debugLog('[ABsmartly Page] Successfully applied', appliedCount, 'of', (changes || []).length, 'changes via domManipulator');
            } else {
              debugLog('[ABsmartly Page] ERROR: No applyChange method available on plugin');
            }
            
            debugLog('[ABsmartly Page] Successfully applied preview changes');
            
            // IMMEDIATE DOM INSPECTION
            debugLog('[ABsmartly Page] 🔍 IMMEDIATE DOM CHECK:');
            if (changes && changes.length > 0) {
              changes.forEach((change) => {
                if (change.selector === 'div:nth-of-type(1) > div:nth-of-type(1) > div > h1') {
                  const h1Elements = document.querySelectorAll(change.selector);
                  h1Elements.forEach((el) => {
                    const computed = window.getComputedStyle(el);
                    debugLog('[ABsmartly Page] 🔍 H1 Element State:', {
                      text: el.textContent,
                      inlineStyles: el.getAttribute('style'),
                      backgroundColor: computed.backgroundColor,
                      border: computed.border,
                      borderRadius: computed.borderRadius,
                      parentBg: el.parentElement ? window.getComputedStyle(el.parentElement).backgroundColor : 'none'
                    });
                  });
                }
              });
            }
            
            // Immediately inspect DOM state after plugin applies changes
            if (changes && changes.length > 0) {
              debugLog('[ABsmartly Page] 🔍 DEBUG: Inspecting DOM state after plugin changes - Version 1.0.3');
              debugLog('[ABsmartly Page] 🔍 Changes to inspect:', changes);
              changes.forEach((change, index) => {
                if (change.selector) {
                  const elements = document.querySelectorAll(change.selector);
                  elements.forEach((element, elemIndex) => {
                    const computedStyle = window.getComputedStyle(element);
                    debugLog(`[ABsmartly Page] 🔍 Element after plugin change ${index + 1}:`, {
                      selector: change.selector,
                      changeType: change.type,
                      enabled: change.enabled !== false,
                      element: element,
                      tagName: element.tagName,
                      id: element.id || 'no-id',
                      className: element.className || 'no-class',
                      textContent: element.textContent?.substring(0, 100),
                      inlineStyles: element.getAttribute('style') || 'no-inline-styles',
                      dataAttributes: {
                        absmartlyExperiment: element.dataset.absmartlyExperiment,
                        absmartlyOriginal: element.dataset.absmartlyOriginal?.substring(0, 100),
                        absmartlyModified: element.dataset.absmartlyModified
                      },
                      computedStyles: {
                        backgroundColor: computedStyle.backgroundColor,
                        border: computedStyle.border,
                        borderRadius: computedStyle.borderRadius,
                        padding: computedStyle.padding,
                        boxShadow: computedStyle.boxShadow,
                        display: computedStyle.display
                      },
                      outerHTML: element.outerHTML.substring(0, 500)
                    });
                  });
                }
              });
            }
          } catch (error) {
            debugError('[ABsmartly Page] Error applying preview changes:', error);
          }
        } else if (plugin) {
          debugError('[ABsmartly Page] Plugin found but required methods not available. Plugin:', plugin);
          debugLog('[ABsmartly Page] Available plugin methods:', Object.keys(plugin).filter(k => typeof plugin[k] === 'function'));
          
          // Try to apply changes manually as last resort
          if (changes && changes.length > 0) {
            debugLog('[ABsmartly Page] Attempting manual DOM changes application');
            applyDOMChangesManually(changes);
          }
        } else {
          debugError('[ABsmartly Page] Plugin not found. Checking available objects...');
          debugLog('[ABsmartly Page] window.__absmartlyPlugin:', window.__absmartlyPlugin);
          debugLog('[ABsmartly Page] cachedContext:', cachedContext);
          debugLog('[ABsmartly Page] cachedContext.__domPlugin:', cachedContext ? cachedContext.__domPlugin : 'no context');
          
          // Try to apply changes manually as last resort
          if (changes && changes.length > 0) {
            debugLog('[ABsmartly Page] Attempting manual DOM changes application without plugin');
            applyDOMChangesManually(changes);
          }
        }
        return;
      }

      // Handle remove preview
      if (event.data.type === 'REMOVE_PREVIEW') {
        debugLog('[ABsmartly Page] Handling REMOVE_PREVIEW message');
        
        // Try to get the plugin instance - check all possible locations
        let plugin = null;
        
        // First try from context
        if (cachedContext && cachedContext.__domPlugin && cachedContext.__domPlugin.instance) {
          plugin = cachedContext.__domPlugin.instance;
          debugLog('[ABsmartly Page] Got plugin from context.__domPlugin');
        }
        // Don't use window reference - only use context.__domPlugin
        // Try site's own plugin instances
        else if (window.__absmartlyPlugin) {
          plugin = window.__absmartlyPlugin;
          debugLog('[ABsmartly Page] Got plugin from window.__absmartlyPlugin');
        }
        else if (window.__absmartlyDOMChangesPlugin) {
          plugin = window.__absmartlyDOMChangesPlugin;
          debugLog('[ABsmartly Page] Got plugin from window.__absmartlyDOMChangesPlugin');
        }
        // If still no plugin, try to detect it
        else {
          const existingPlugin = isPluginAlreadyLoaded();
          if (existingPlugin && existingPlugin !== 'active-but-inaccessible') {
            plugin = existingPlugin;
            debugLog('[ABsmartly Page] Got plugin from isPluginAlreadyLoaded()');
          }
        }
        
        if (plugin && typeof plugin.removeChanges === 'function') {
          const { experimentName } = event.data.payload || {};
          const expName = experimentName || '__preview__';
          debugLog('[ABsmartly Page] Removing preview changes using removeChanges for experiment:', expName);
          
          // Check H1 state BEFORE removal
          const h1BeforeRemoval = document.querySelector('div:nth-of-type(1) > div:nth-of-type(1) > div > h1');
          if (h1BeforeRemoval) {
            const computedBefore = window.getComputedStyle(h1BeforeRemoval);
            debugLog('[ABsmartly Page] 🔍 H1 BEFORE removal:', {
              text: h1BeforeRemoval.textContent,
              inlineStyles: h1BeforeRemoval.getAttribute('style'),
              backgroundColor: computedBefore.backgroundColor,
              border: computedBefore.border,
              borderRadius: computedBefore.borderRadius
            });
          }
          
          // First, capture state of elements BEFORE removal
          debugLog('[ABsmartly Page] 🔍 DEBUG: Capturing state BEFORE removal');
          const elementsBeforeRemoval = [];
          // Find all elements with preview changes
          const previewElements = document.querySelectorAll('[data-absmartly-experiment="__preview__"]');
          previewElements.forEach((element) => {
            const computedStyle = window.getComputedStyle(element);
            elementsBeforeRemoval.push({
              element: element,
              tagName: element.tagName,
              textContent: element.textContent?.substring(0, 100),
              inlineStyles: element.getAttribute('style') || 'no-inline-styles',
              computedStyles: {
                backgroundColor: computedStyle.backgroundColor,
                border: computedStyle.border,
                borderRadius: computedStyle.borderRadius
              }
            });
          });
          debugLog('[ABsmartly Page] Elements before removal:', elementsBeforeRemoval);
          
          try {
            // Use removeChanges to remove all changes for this experiment
            plugin.removeChanges(expName);
            debugLog('[ABsmartly Page] Successfully called plugin.removeChanges for:', expName);
            
            // Check H1 state AFTER removal
            setTimeout(() => {
              const h1AfterRemoval = document.querySelector('div:nth-of-type(1) > div:nth-of-type(1) > div > h1');
              if (h1AfterRemoval) {
                const computedAfter = window.getComputedStyle(h1AfterRemoval);
                debugLog('[ABsmartly Page] 🔍 H1 AFTER removal:', {
                  text: h1AfterRemoval.textContent,
                  inlineStyles: h1AfterRemoval.getAttribute('style'),
                  backgroundColor: computedAfter.backgroundColor,
                  border: computedAfter.border,
                  borderRadius: computedAfter.borderRadius,
                  dataset: h1AfterRemoval.dataset
                });
              }
            }, 100);
            
            // Now inspect the same elements AFTER removal
            debugLog('[ABsmartly Page] 🔍 DEBUG: Inspecting DOM state AFTER removal');
            elementsBeforeRemoval.forEach((beforeState, index) => {
              const element = beforeState.element;
              const computedStyleAfter = window.getComputedStyle(element);
              debugLog(`[ABsmartly Page] 🔍 Element ${index + 1} after removal:`, {
                tagName: element.tagName,
                id: element.id || 'no-id',
                className: element.className || 'no-class',
                textContentBefore: beforeState.textContent,
                textContentAfter: element.textContent?.substring(0, 100),
                inlineStylesBefore: beforeState.inlineStyles,
                inlineStylesAfter: element.getAttribute('style') || 'no-inline-styles',
                dataAttributes: {
                  absmartlyExperiment: element.dataset.absmartlyExperiment,
                  absmartlyOriginal: element.dataset.absmartlyOriginal?.substring(0, 100),
                  absmartlyModified: element.dataset.absmartlyModified
                },
                computedStylesBefore: beforeState.computedStyles,
                computedStylesAfter: {
                  backgroundColor: computedStyleAfter.backgroundColor,
                  border: computedStyleAfter.border,
                  borderRadius: computedStyleAfter.borderRadius,
                  padding: computedStyleAfter.padding,
                  boxShadow: computedStyleAfter.boxShadow
                },
                outerHTML: element.outerHTML.substring(0, 500)
              });
            });
          } catch (error) {
            debugError('[ABsmartly Page] Error removing preview:', error);
          }
        } else if (plugin && typeof plugin.revertChanges === 'function') {
          // Fallback: try revertChanges method
          debugLog('[ABsmartly Page] Using revertChanges as fallback for removing preview');
          try {
            plugin.revertChanges();
            debugLog('[ABsmartly Page] Successfully reverted changes via revertChanges');
          } catch (error) {
            debugError('[ABsmartly Page] Error reverting changes:', error);
          }
        } else {
          // Fallback to manual removal
          debugLog('[ABsmartly Page] Using manual DOM changes removal as fallback');
          removeDOMChangesManually();
        }
        return;
      }

      if (event.data.type === 'INITIALIZE_PLUGIN') {
        // Prevent multiple initializations
        if (isInitialized || isInitializing) {
          debugLog('[ABsmartly Extension] Already initialized or initializing, skipping');
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
          debugError('[ABsmartly Extension] No context available for plugin initialization');
          return;
        }

        // Check if plugin is already registered with context
        if (context.__domPlugin && context.__domPlugin.initialized) {
          debugLog('[ABsmartly Extension] Plugin already initialized via context.__domPlugin');
          return;
        }
        
        // Check if ABsmartlyDOMChangesPlugin is available, if not load it from extension
        if (typeof window.ABsmartlyDOMChangesPlugin === 'undefined') {
          debugLog('[ABsmartly Extension] DOMChangesPlugin not found, loading from extension...');
          
          // Use the captured extension URL
          if (extensionBaseUrl) {
            // Function to load plugin script with error handling
            const loadPlugin = (filename, fallbackFilename) => {
              const pluginUrl = extensionBaseUrl + filename;
              debugLog(`[ABsmartly Extension] Attempting to load plugin from: ${pluginUrl}`);
              
              const script = document.createElement('script');
              script.src = pluginUrl;
              script.onload = () => {
                debugLog(`[ABsmartly Extension] ${filename} loaded successfully`);
              debugLog('[ABsmartly Extension] ABsmartlyDOMChangesPlugin object:', window.ABsmartlyDOMChangesPlugin);
              debugLog('[ABsmartly Extension] Available properties:', Object.keys(window.ABsmartlyDOMChangesPlugin || {}));
              
              // The UMD bundle exposes ABsmartlyDOMChangesPlugin globally
              // We need to instantiate it and let it register itself with the context
              if (window.ABsmartlyDOMChangesPlugin) {
                let PluginClass = null;
                
                // Try direct property
                if (window.ABsmartlyDOMChangesPlugin.DOMChangesPlugin) {
                  PluginClass = window.ABsmartlyDOMChangesPlugin.DOMChangesPlugin;
                }
                // Try default export
                else if (window.ABsmartlyDOMChangesPlugin.default) {
                  PluginClass = window.ABsmartlyDOMChangesPlugin.default;
                }
                // Try if ABsmartlyDOMChangesPlugin itself is the plugin class
                else if (typeof window.ABsmartlyDOMChangesPlugin === 'function') {
                  PluginClass = window.ABsmartlyDOMChangesPlugin;
                }
                
                if (PluginClass) {
                  debugLog('[ABsmartly Extension] Plugin class found, initializing...');
                  try {
                    // Create plugin instance - it will register itself with the context
                    const plugin = new PluginClass({
                      context: context,
                      autoApply: false,
                      spa: true,
                      visibilityTracking: true,
                      extensionBridge: true,
                      dataSource: 'variable',
                      dataFieldName: '__dom_changes',
                      debug: DEBUG
                    });
                    
                    // Plugin will register itself with context.__domPlugin during initialization
                    
                    // Initialize the plugin
                    plugin.initialize().then(() => {
                      debugLog('[ABsmartly Extension] Plugin initialized and registered with context');
                      // The plugin is now available via context.__domPlugin
                    }).catch(error => {
                      debugError('[ABsmartly Extension] Failed to initialize plugin:', error);
                    });
                  } catch (error) {
                    debugError('[ABsmartly Extension] Failed to create plugin instance:', error);
                  }
                } else {
                  debugError('[ABsmartly Extension] Could not find DOMChangesPlugin class in bundle');
                }
              } else {
                debugError('[ABsmartly Extension] ABsmartlyDOMChangesPlugin not loaded');
              }
              };
              script.onerror = () => {
                debugError(`[ABsmartly Extension] Failed to load ${filename}`);
                // Try fallback if provided
                if (fallbackFilename) {
                  debugLog(`[ABsmartly Extension] Trying fallback: ${fallbackFilename}`);
                  loadPlugin(fallbackFilename);
                }
              };
              document.head.appendChild(script);
            };
            
            // Try dev build first, fallback to production build
            loadPlugin('absmartly-dom-changes.dev.js', 'absmartly-dom-changes.min.js');
            return; // Wait for script to load
          } else {
            debugError('[ABsmartly Extension] Cannot determine extension URL to load plugin');
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
            debugError('[ABsmartly Extension] No context available for plugin initialization');
            return;
          }

          if (typeof window.DOMChangesPlugin === 'undefined') {
            debugError('[ABsmartly Extension] DOMChangesPlugin still not available');
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

            // Plugin will register itself with context.__domPlugin during initialization

            plugin.initialize().then(() => {
              
              // The plugin now registers itself with context.__domPlugin
              // We can verify it's registered
              if (context.__domPlugin && context.__domPlugin.instance === plugin) {
                debugLog('[ABsmartly Extension] Plugin successfully registered with context.__domPlugin');
                debugLog('[ABsmartly Extension] Plugin methods available:', Object.keys(plugin).filter(k => typeof plugin[k] === 'function'));
              }

              // Inject custom code if provided
              if (customCode) {
                debugLog('[ABsmartly Extension] Injecting custom code directly');
                try {
                  // Parse the custom code object
                  const codeData = typeof customCode === 'string' ? JSON.parse(customCode) : customCode;
                  
                  // Call the plugin's injectCode method for HTML/CSS
                  if (plugin.injectCode && typeof plugin.injectCode === 'function') {
                    plugin.injectCode(codeData);
                    debugLog('[ABsmartly Extension] Custom code injected via plugin.injectCode');
                  }
                  
                  // ALWAYS execute scripts manually since the plugin's injection doesn't execute them
                  ['headStart', 'headEnd', 'bodyStart', 'bodyEnd'].forEach(location => {
                    if (codeData[location]) {
                      debugLog(`[ABsmartly Extension] Executing scripts for ${location}`);
                      executeScriptsInHTML(codeData[location], location);
                    }
                  });
                } catch (error) {
                  debugError('[ABsmartly Extension] Failed to inject custom code:', error);
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

              debugLog('[ABsmartly Extension] Plugin initialized successfully');
              isInitialized = true;
              isInitializing = false;
            }).catch(error => {
              debugError('[ABsmartly Extension] Failed to initialize plugin:', error);
              isInitializing = false;
            });
          } catch (error) {
            debugError('[ABsmartly Extension] Failed to initialize plugin:', error);
            isInitializing = false;
          }
        }
        
        // Now initialize the plugin with the context we already have
        initializePlugin(context);
      } else if (event.data.type === 'INJECT_CUSTOM_CODE') {
        // This message type is not currently used - custom code comes via INJECTION_CODE
        debugLog('[ABsmartly Extension] INJECT_CUSTOM_CODE message received but not used');
      }
    }
  });

  // Expose a function to get variant assignments for the extension
  window.__absmartlyGetVariantAssignments = async function(experimentNames) {
    debugLog('[ABsmartly Extension] Getting variant assignments for:', experimentNames);
    
    const context = cachedContext || detectABsmartlySDK().context;
    
    if (!context) {
      debugWarn('[ABsmartly Extension] No context available for getting variants');
      return { assignments: {}, experimentsInContext: [] };
    }
    
    // Check if context is ready, if not wait for it
    if (context.ready && typeof context.ready === 'function') {
      try {
        await context.ready();
      } catch (error) {
        debugWarn('[ABsmartly Extension] Error waiting for context ready:', error);
      }
    }
    
    // Get experiments that exist in the context data
    let experimentsInContext = [];
    if (context.data && typeof context.data === 'function') {
      const contextData = context.data();
      if (contextData?.experiments) {
        experimentsInContext = Object.keys(contextData.experiments);
      }
    }
    
    const assignments = {};
    for (const expName of experimentNames) {
      try {
        if (typeof context.peek === 'function') {
          const variant = context.peek(expName);
          
          // Only include valid variant assignments (not -1, null, or undefined)
          // But DO include 0 as it's a valid variant
          if (variant !== undefined && variant !== null && variant !== -1) {
            assignments[expName] = variant;
          }
        }
      } catch (error) {
        debugWarn(`[ABsmartly Extension] Failed to peek experiment ${expName}:`, error);
      }
    }
    
    return { assignments, experimentsInContext };
  };
  
  // Expose the SDK context location for the extension to save in settings
  window.__absmartlyGetContextPath = function() {
    // First detect SDK if not already cached
    if (!cachedContext) {
      detectABsmartlySDK();
    }
    
    return {
      found: !!cachedContext,
      path: contextPropertyPath || null,
      hasContext: !!cachedContext,
      hasPeek: cachedContext && typeof cachedContext.peek === 'function',
      hasTreatment: cachedContext && typeof cachedContext.treatment === 'function'
    };
  };
  
  // Start the process
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForSDKAndInitialize);
  } else {
    // Give the page a moment to initialize its SDK
    setTimeout(waitForSDKAndInitialize, 100);
  }

})();