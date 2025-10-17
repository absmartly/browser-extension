/**
 * This script is injected directly into the page context
 * It has access to the page's window object and can interact with the ABsmartly SDK
 */

(function() {
  'use strict';

  // Simple HTML sanitization to prevent XSS
  function sanitizeHTML(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.textContent = html; // This escapes all HTML
    return temp.innerHTML;
  }

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

  // Check if already injected - but still need to set up message listener
  if (window.__absmartlyExtensionInjected) {
    debugLog('[ABsmartly Extension] Already injected, but ensuring message listener is active');
    // Don't return here - we still need to set up the message listener
    // in case it was lost (e.g., after navigation or re-injection)
  } else {
    window.__absmartlyExtensionInjected = true;
  }
  
  // Track initialization state
  let isInitializing = false;
  let isInitialized = false;
  let cachedContext = null; // Cache the context to avoid repeated detection
  
  // State tracking for preview changes (so we can revert them)
  const previewStateMap = new Map(); // Map<Element, {experimentName, originalState}>
  let contextPropertyPath = null; // Store WHERE the context is found

  /**
   * Apply a single preview change and track it for reversion
   */
  function applyPreviewChange(change, experimentName) {
    if (!change.selector || !change.type) {
      debugWarn('[ABsmartly Page] Invalid change, missing selector or type');
      return false;
    }

    // Skip disabled changes
    if (change.enabled === false) {
      debugLog('[ABsmartly Page] Skipping disabled change:', change.selector);
      return false;
    }

    const elements = document.querySelectorAll(change.selector);
    
    if (elements.length === 0) {
      debugWarn('[ABsmartly Page] No elements found for selector:', change.selector);
      return false;
    }

    debugLog(`[ABsmartly Page] Applying preview change to ${elements.length} element(s):`, change.selector, change.type);

    elements.forEach((element) => {
      // Store original state if not already stored for this experiment
      if (!previewStateMap.has(element) || previewStateMap.get(element).experimentName !== experimentName) {
        const originalState = captureElementState(element);
        previewStateMap.set(element, {
          experimentName,
          originalState,
          selector: change.selector,
          changeType: change.type
        });
        debugLog('[ABsmartly Page] Stored original state for element:', element);
      }

      // Mark element with experiment
      element.setAttribute('data-absmartly-experiment', experimentName);
      element.setAttribute('data-absmartly-modified', 'true');

      // Apply the change based on type
      switch (change.type) {
        case 'text':
          element.textContent = change.value;
          break;

        case 'html':
          element.innerHTML = sanitizeHTML(change.value);
          break;

        case 'style':
        case 'styles':
          const styles = change.styles || change.value;
          if (typeof styles === 'object') {
            Object.entries(styles).forEach(([prop, value]) => {
              element.style[prop] = value;
            });
          } else if (typeof styles === 'string') {
            element.setAttribute('style', styles);
          }
          break;

        case 'class':
          if (change.className) {
            element.classList.add(change.className);
          }
          break;

        case 'attribute':
          if (change.attribute && change.value !== undefined) {
            element.setAttribute(change.attribute, change.value);
          }
          break;

        case 'delete':
          // In preview mode, mimic delete by hiding (display: none)
          element.style.display = 'none';
          debugLog('[ABsmartly Page] Mimicking delete by hiding element (old code path)');
          break;
      }

      debugLog('[ABsmartly Page] Applied change to element:', element);
    });

    return true;
  }

  /**
   * Capture the current state of an element
   */
  function captureElementState(element) {
    const state = {
      textContent: element.textContent,
      innerHTML: element.innerHTML,
      attributes: {},
      styles: {},
      classList: Array.from(element.classList)
    };

    // Capture all attributes
    for (const attr of Array.from(element.attributes)) {
      state.attributes[attr.name] = attr.value;
    }

    // Capture inline styles
    if (element.style.length > 0) {
      for (let i = 0; i < element.style.length; i++) {
        const prop = element.style[i];
        state.styles[prop] = element.style.getPropertyValue(prop);
      }
    }

    return state;
  }

  /**
   * Remove all preview changes for an experiment
   */
  function removePreviewChanges(experimentName) {
    debugLog('[ABsmartly Page] Removing preview changes for experiment:', experimentName);

    let restoredCount = 0;
    const elementsToRemove = [];

    // First, restore elements we tracked in previewStateMap
    previewStateMap.forEach((data, element) => {
      if (data.experimentName === experimentName) {
        // Restore element to original state
        restoreElementState(element, data.originalState);
        elementsToRemove.push(element);
        restoredCount++;
      }
    });

    // Clean up the map
    elementsToRemove.forEach(element => previewStateMap.delete(element));

    // Also remove markers from any elements with this experiment (e.g., from visual editor)
    // Try both the actual experiment name and __preview__ (visual editor default)
    const markedElements = document.querySelectorAll(
      `[data-absmartly-experiment="${experimentName}"], [data-absmartly-experiment="__preview__"]`
    );
    markedElements.forEach(element => {
      // If element has data-absmartly-original, restore from it (VE-modified elements)
      if (element.dataset.absmartlyOriginal) {
        try {
          const originalData = JSON.parse(element.dataset.absmartlyOriginal);
          debugLog('[ABsmartly Page] Original data for element:', {
            tagName: element.tagName,
            id: element.id,
            textContent: originalData.textContent?.substring(0, 100),
            innerHTML: originalData.innerHTML?.substring(0, 100),
            hasStyles: !!originalData.styles
          });

          // Restore innerHTML (which also restores textContent)
          // We prioritize innerHTML because it contains the complete structure
          // and textContent would be overwritten by innerHTML anyway
          if (originalData.innerHTML !== undefined) {
            element.innerHTML = sanitizeHTML(originalData.innerHTML);
            debugLog('[ABsmartly Page] Restored innerHTML from VE original');
          } else if (originalData.textContent !== undefined) {
            // Fallback to textContent if innerHTML not available
            element.textContent = originalData.textContent;
            debugLog('[ABsmartly Page] Restored text content from VE original');
          }

          // Restore styles
          if (originalData.styles) {
            Object.keys(originalData.styles).forEach(prop => {
              element.style[prop] = originalData.styles[prop];
            });
            debugLog('[ABsmartly Page] Restored styles from VE original');
          }

          // Restore attributes
          if (originalData.attributes) {
            Object.keys(originalData.attributes).forEach(attr => {
              if (originalData.attributes[attr] !== null) {
                element.setAttribute(attr, originalData.attributes[attr]);
              } else {
                element.removeAttribute(attr);
              }
            });
            debugLog('[ABsmartly Page] Restored attributes from VE original');
          }
        } catch (e) {
          console.warn('[ABsmartly Page] Failed to restore element from data-absmartly-original:', e);
        }

        // Remove the original data attribute - we're back at original state now
        element.removeAttribute('data-absmartly-original');
      }

      element.removeAttribute('data-absmartly-experiment');
      element.removeAttribute('data-absmartly-modified');
      restoredCount++;
    });

    debugLog(`[ABsmartly Page] Removed preview changes, cleaned ${restoredCount} elements`);
    return restoredCount > 0;
  }

  /**
   * Restore an element to its original state
   */
  function restoreElementState(element, originalState) {
    try {
      // Restore text content
      if (originalState.textContent !== undefined) {
        element.textContent = originalState.textContent;
      }

      // Restore innerHTML
      if (originalState.innerHTML !== undefined) {
        element.innerHTML = sanitizeHTML(originalState.innerHTML);
      }

      // Restore attributes
      if (originalState.attributes) {
        // First, remove all current attributes except data-* ones we want to clean
        const currentAttrs = Array.from(element.attributes);
        currentAttrs.forEach(attr => {
          if (!originalState.attributes.hasOwnProperty(attr.name)) {
            element.removeAttribute(attr.name);
          }
        });

        // Then restore original attributes
        Object.entries(originalState.attributes).forEach(([name, value]) => {
          element.setAttribute(name, value);
        });
      }

      // Restore styles
      if (originalState.styles) {
        // Clear all inline styles first
        element.removeAttribute('style');
        
        // Restore original styles
        Object.entries(originalState.styles).forEach(([prop, value]) => {
          element.style.setProperty(prop, value);
        });
      }

      // Restore class list
      if (originalState.classList) {
        element.className = originalState.classList.join(' ');
      }

      // Remove tracking attributes
      element.removeAttribute('data-absmartly-experiment');
      element.removeAttribute('data-absmartly-modified');

      debugLog('[ABsmartly Page] Restored element to original state:', element);
    } catch (error) {
      debugError('[ABsmartly Page] Error restoring element:', error);
    }
  }

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
              element.innerHTML = sanitizeHTML(change.value);
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

            case 'delete':
              // In preview mode, mimic delete by hiding (display: none)
              // In production, the DOM Changes plugin will actually remove the element
              if (!originalData.styles) {
                originalData.styles = {};
              }
              if (!originalData.styles.display) {
                const computedStyle = window.getComputedStyle(element);
                originalData.styles.display = element.style.display || computedStyle.display || '';
              }
              debugLog(`[ABsmartly Page] 🗑️ Mimicking delete by hiding element (display: none)`);
              element.style.display = 'none';
              element.dataset.absmartlyModified = 'true';
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
            element.innerHTML = sanitizeHTML(originalData.innerHTML);
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
   * Send message to extension - always via content script
   */
  function sendMessageToExtension(message) {
    // Always send via window.postMessage (content script will relay to background)
    window.postMessage(message, '*');
  }

  /**
   * Intercept eventLogger calls and forward to extension
   */
  function interceptEventLogger(context) {
    debugLog('[ABsmartly Extension] 🎯 interceptEventLogger called', {
      hasContext: !!context,
      alreadyIntercepted: context?.__eventLoggerIntercepted,
      hasEventLogger: !!(context?.eventLogger),
      has_eventLogger: context?._eventLogger !== undefined,
      contextKeys: context ? Object.keys(context).filter(k => k.includes('event') || k.includes('logger')) : [],
      // Log ALL context methods to understand the SDK version
      allContextMethods: context ? Object.keys(context).filter(k => typeof context[k] === 'function') : [],
      hasTreatment: context && typeof context.treatment === 'function',
      hasReady: context && typeof context.ready === 'function',
      hasPeek: context && typeof context.peek === 'function'
    });

    if (!context || context.__eventLoggerIntercepted) {
      debugLog('[ABsmartly Extension] ⚠️ Skipping interception - no context or already intercepted');
      return;
    }

    const originalEventLogger = context.eventLogger ? context.eventLogger() : null;
    debugLog('[ABsmartly Extension] 📝 Original eventLogger:', {
      hasMethod: !!context.eventLogger,
      originalEventLogger: !!originalEventLogger,
      typeOfOriginal: typeof originalEventLogger
    });

    // Create wrapper eventLogger
    const wrappedEventLogger = (ctx, eventName, data) => {
      debugLog('[ABsmartly Extension] 🔔 SDK Event:', { eventName, data });

      const eventMessage = {
        source: 'absmartly-page',
        type: 'SDK_EVENT',
        payload: {
          eventName,
          data: data ? JSON.parse(JSON.stringify(data)) : null,
          timestamp: new Date().toISOString()
        }
      };

      debugLog('[ABsmartly Extension] 📤 Sending SDK event via postMessage:', eventMessage);
      // Send via unified message function
      sendMessageToExtension(eventMessage);

      // Call original eventLogger if it exists
      if (originalEventLogger) {
        originalEventLogger(ctx, eventName, data);
      }
    };

    // Replace the eventLogger
    if (context._eventLogger !== undefined) {
      debugLog('[ABsmartly Extension] ✅ Replacing context._eventLogger');
      context._eventLogger = wrappedEventLogger;
    } else {
      debugWarn('[ABsmartly Extension] ⚠️ context._eventLogger is undefined, cannot intercept');
    }

    context.__eventLoggerIntercepted = true;
    debugLog('[ABsmartly Extension] ✅ EventLogger intercepted successfully');
  }

  /**
   * Intercept SDK's createContext method to auto-intercept all new contexts
   */
  function interceptSDKCreateContext(sdk) {
    if (!sdk || !sdk.createContext || sdk.__createContextIntercepted) {
      return;
    }

    const originalCreateContext = sdk.createContext.bind(sdk);

    sdk.createContext = async function(config) {
      debugLog('[ABsmartly Extension] Intercepting createContext call');

      // Call original createContext
      const context = await originalCreateContext(config);

      // Intercept the eventLogger on this new context
      interceptEventLogger(context);

      return context;
    };

    sdk.__createContextIntercepted = true;
    debugLog('[ABsmartly Extension] SDK createContext intercepted successfully');
  }

  /**
   * Intercept SDK constructor to intercept all SDK instances
   */
  function interceptSDKConstructor(sdkModule) {
    if (!sdkModule || !sdkModule.SDK || sdkModule.SDK.__constructorIntercepted) {
      return;
    }

    const OriginalSDK = sdkModule.SDK;

    // Create a proxy constructor
    sdkModule.SDK = function(config) {
      debugLog('[ABsmartly Extension] Intercepting new SDK() call');

      // Create SDK instance
      const sdkInstance = new OriginalSDK(config);

      // Intercept createContext on this SDK instance
      if (sdkInstance && typeof sdkInstance.createContext === 'function') {
        interceptSDKCreateContext(sdkInstance);
      }

      return sdkInstance;
    };

    // Copy static properties
    Object.setPrototypeOf(sdkModule.SDK, OriginalSDK);
    Object.assign(sdkModule.SDK, OriginalSDK);

    sdkModule.SDK.__constructorIntercepted = true;
    debugLog('[ABsmartly Extension] SDK constructor intercepted successfully');
  }

  /**
   * Detects ABsmartly SDK on the window object - uses cache if available
   */
  function detectABsmartlySDK() {
    // Check for SDK module (has SDK constructor)
    const sdkModuleLocations = [
      window.absmartly,
      window.ABsmartly,
      window.__absmartly
    ];

    for (const location of sdkModuleLocations) {
      if (location && location.SDK && typeof location.SDK === 'function') {
        debugLog('[ABsmartly Extension] SDK module found, intercepting SDK constructor');
        interceptSDKConstructor(location);
        break;
      }
    }

    // Check for SDK instances (have createContext method)
    let sdk = null;
    const sdkLocations = [
      window.sdk,
      window.absmartly,
      window.ABsmartly,
      window.__absmartly
    ];

    for (const location of sdkLocations) {
      if (location && typeof location.createContext === 'function') {
        sdk = location;
        debugLog('[ABsmartly Extension] SDK instance found');

        // Intercept createContext to auto-intercept all future contexts
        interceptSDKCreateContext(sdk);
        break;
      }
    }

    // Return cached context if we already found it
    if (cachedContext) {
      return { sdk, context: cachedContext };
    }

    // Check common context locations
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

      debugLog('[ABsmartly Extension] ✅ Context found and cached at:', contextPropertyPath);
      debugLog('[ABsmartly Extension] 📊 Context details:', {
        hasTreatment: !!context.treatment,
        hasPeek: !!context.peek,
        hasData: !!context.data,
        hasEventLogger: !!context.eventLogger,
        has_eventLogger: context._eventLogger !== undefined,
        contextType: typeof context
      });

      // Intercept eventLogger on this context
      interceptEventLogger(context);
    } else if (!context) {
      debugWarn('[ABsmartly Extension] ⚠️ No context found after detection');
    }

    return { sdk, context };
  }

  /**
   * Executes script tags found in HTML content
   * Scripts injected via innerHTML don't execute, so we need to recreate them
   */
  function executeScriptsInHTML(html, location) {
    debugLog(`[ABsmartly Extension] Processing scripts for ${location}`);
    
    // Create a temporary container
    const temp = document.createElement('div');
    temp.innerHTML = sanitizeHTML(html);
    
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
          // Inline script execution disabled for security (prevents code injection)
          // const code = script.textContent || script.innerText || '';
          // if (code) {
          //   const fn = new Function(code);
          //   fn();
          //   debugLog(`[ABsmartly Extension] Successfully executed inline script from ${location}`);
          // }
          debugWarn(`[ABsmartly Extension] Inline script execution disabled for security from ${location}`);
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
   * Helper function to check if current URL matches the filter
   * Returns true if URL matches or if no filter is specified
   */
  function matchesUrlFilter(urlFilter) {
    if (!urlFilter) return true; // No filter means apply on all pages

    const currentUrl = window.location.href;
    const currentPath = window.location.pathname;
    const currentDomain = window.location.hostname;
    const currentQuery = window.location.search;
    const currentHash = window.location.hash;

    // Determine what to match against
    let matchTarget;
    const matchType = (typeof urlFilter === 'object' && !Array.isArray(urlFilter))
      ? urlFilter.matchType || 'path'
      : 'path';

    switch (matchType) {
      case 'full-url':
        matchTarget = currentUrl;
        break;
      case 'domain':
        matchTarget = currentDomain;
        break;
      case 'query':
        matchTarget = currentQuery;
        break;
      case 'hash':
        matchTarget = currentHash;
        break;
      case 'path':
      default:
        matchTarget = currentPath;
    }

    // Get patterns
    let includePatterns = [];
    let excludePatterns = [];
    let isRegex = false;

    if (typeof urlFilter === 'string') {
      includePatterns = [urlFilter];
    } else if (Array.isArray(urlFilter)) {
      includePatterns = urlFilter;
    } else {
      includePatterns = urlFilter.include || [];
      excludePatterns = urlFilter.exclude || [];
      isRegex = urlFilter.mode === 'regex';
    }

    // Check exclude patterns first
    if (excludePatterns.length > 0) {
      for (const pattern of excludePatterns) {
        if (isRegex) {
          try {
            const regex = new RegExp(pattern);
            if (regex.test(matchTarget)) {
              debugLog(`[ABsmartly Extension] URL excluded by pattern: ${pattern}`);
              return false;
            }
          } catch (e) {
            debugWarn(`[ABsmartly Extension] Invalid regex pattern: ${pattern}`, e);
          }
        } else {
          // Simple wildcard matching
          const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
          const regex = new RegExp(`^${regexPattern}$`);
          if (regex.test(matchTarget)) {
            debugLog(`[ABsmartly Extension] URL excluded by pattern: ${pattern}`);
            return false;
          }
        }
      }
    }

    // Check include patterns
    if (includePatterns.length === 0) {
      return true; // No include patterns means include all (that aren't excluded)
    }

    for (const pattern of includePatterns) {
      if (isRegex) {
        try {
          const regex = new RegExp(pattern);
          if (regex.test(matchTarget)) {
            debugLog(`[ABsmartly Extension] URL matched by pattern: ${pattern}`);
            return true;
          }
        } catch (e) {
          debugWarn(`[ABsmartly Extension] Invalid regex pattern: ${pattern}`, e);
        }
      } else {
        // Simple wildcard matching
        const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(matchTarget)) {
          debugLog(`[ABsmartly Extension] URL matched by pattern: ${pattern}`);
          return true;
        }
      }
    }

    debugLog(`[ABsmartly Extension] URL did not match any include patterns`);
    return false;
  }

  /**
   * Inject custom code from experiment variants' __inject_html variables
   */
  function injectExperimentCode(context) {
    if (!context || !context.data_) {
      debugLog('[ABsmartly Extension] No context data available for experiment code injection');
      return;
    }

    const data = context.data_;

    // Iterate through all experiments in the context
    if (!data.experiments || !Array.isArray(data.experiments)) {
      debugLog('[ABsmartly Extension] No experiments found in context');
      return;
    }

    debugLog(`[ABsmartly Extension] Checking ${data.experiments.length} experiments for injection code`);

    data.experiments.forEach((experiment, idx) => {
      try {
        // Get the assigned variant for this experiment
        const assignment = context.assignments_ ? context.assignments_[experiment.id] : null;
        if (assignment === null || assignment === undefined) {
          return; // Not assigned to this experiment
        }

        const variant = experiment.variants ? experiment.variants[assignment] : null;
        if (!variant || !variant.config) {
          return;
        }

        // Parse variant config
        let variantConfig;
        try {
          variantConfig = typeof variant.config === 'string'
            ? JSON.parse(variant.config)
            : variant.config;
        } catch (e) {
          debugWarn(`[ABsmartly Extension] Failed to parse variant config for experiment ${experiment.name}:`, e);
          return;
        }

        // Check for __inject_html variable
        const injectHtml = variantConfig.__inject_html;
        if (!injectHtml) {
          return; // No injection code for this variant
        }

        debugLog(`[ABsmartly Extension] Found __inject_html in experiment "${experiment.name}", variant ${assignment}`);

        // Parse injection code
        let injectionCode;
        try {
          injectionCode = typeof injectHtml === 'string'
            ? JSON.parse(injectHtml)
            : injectHtml;
        } catch (e) {
          debugWarn(`[ABsmartly Extension] Failed to parse __inject_html for experiment ${experiment.name}:`, e);
          return;
        }

        // Check URL filter
        if (injectionCode.urlFilter && !matchesUrlFilter(injectionCode.urlFilter)) {
          debugLog(`[ABsmartly Extension] Skipping injection for experiment "${experiment.name}" - URL filter not matched`);
          return;
        }

        // Inject code at each location
        ['headStart', 'headEnd', 'bodyStart', 'bodyEnd'].forEach(location => {
          if (injectionCode[location]) {
            debugLog(`[ABsmartly Extension] Injecting code for experiment "${experiment.name}" at ${location}`);
            executeScriptsInHTML(injectionCode[location], location);
          }
        });

        debugLog(`[ABsmartly Extension] Successfully processed injection code for experiment "${experiment.name}"`);
      } catch (error) {
        debugError(`[ABsmartly Extension] Error processing experiment ${idx}:`, error);
      }
    });
  }

  // Removed parseCookieOverrides - OverridesPlugin handles all cookie parsing now

  /* DEPRECATED - Kept for reference only
  function parseCookieOverrides(cookieValue) {
    if (!cookieValue) return { overrides: {}, devEnv: null };

    try {
      let devEnv = null;
      let experimentsStr = cookieValue;

      // Check if dev environment is included
      if (cookieValue.startsWith('devEnv=')) {
        const parts = cookieValue.split('|');
        devEnv = decodeURIComponent(parts[0].substring(7)); // Remove 'devEnv=' prefix
        experimentsStr = parts[1] || '';
      }

      const overrides = {};
      if (experimentsStr) {
        // NEW FORMAT: comma separates experiments, dot separates values within each experiment
        const experiments = experimentsStr.split(',');

        for (const exp of experiments) {
          const [name, values] = exp.split(':');
          if (!name || !values) continue;

          const decodedName = decodeURIComponent(name);
          const parts = values.split('.');

          if (parts.length === 1) {
            // Simple format: just variant (running experiment)
            overrides[decodedName] = parseInt(parts[0], 10);
          } else if (parts.length === 2) {
            // Format: variant.env
            overrides[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10)
            };
          } else {
            // Full format: variant.env.id
            overrides[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10),
              id: parseInt(parts[2], 10)
            };
          }
        }
      }

      return { overrides, devEnv };
    } catch (error) {
      debugWarn('[ABsmartly Extension] Failed to parse override cookie:', error);
      return { overrides: {}, devEnv: null };
    }
  }
  */

  /**
   * Store override metadata for SDK consumption
   * The OverridesPlugin handles the actual application of overrides
   */
  function checkOverridesCookie() {
    try {
      // Just check if cookie exists - OverridesPlugin handles all parsing and application
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('absmartly_overrides='))
        ?.split('=')[1];

      if (cookieValue) {
        debugLog('[ABsmartly Extension] Found absmartly_overrides cookie (will be handled by OverridesPlugin)');
        // Log if development environment is present (just for debugging)
        if (cookieValue.startsWith('devEnv=')) {
          const devEnvMatch = cookieValue.match(/^devEnv=([^|]+)/);
          if (devEnvMatch) {
            debugLog('[ABsmartly Extension] Development environment in cookie:', decodeURIComponent(devEnvMatch[1]));
          }
        }
      } else {
        debugLog('[ABsmartly Extension] No experiment overrides cookie found');
      }
    } catch (error) {
      debugError('[ABsmartly Extension] Error checking overrides cookie:', error);
    }
  }

/**
   * Wait for SDK and custom code, then initialize
   */
  function waitForSDKAndInitialize() {
    debugLog('[ABsmartly Extension] 🚀 waitForSDKAndInitialize started');
    const maxAttempts = 50; // 5 seconds
    let attempts = 0;

    const checkAndInit = () => {
      attempts++;
      debugLog(`[ABsmartly Extension] 🔍 Check attempt ${attempts}/${maxAttempts}`);

      // Detect context only once
      if (!cachedContext) {
        debugLog('[ABsmartly Extension] 🔎 No cached context, detecting SDK...');
        detectABsmartlySDK();
      } else {
        debugLog('[ABsmartly Extension] ✅ Using cached context');
      }
      
      // Log context data when found (but only if context is ready)
      if (cachedContext && cachedContext.data && typeof cachedContext.data === 'function') {
        // Use ready() promise to wait for context to be ready before accessing data
        if (cachedContext.ready && typeof cachedContext.ready === 'function') {
          cachedContext.ready().then(() => {
            try {
              const data = cachedContext.data();
              debugLog('[ABsmartly Extension] Context data on init:', data);
              debugLog('[ABsmartly Extension] Experiments available:', data?.experiments ? Object.keys(data.experiments) : 'none');
            } catch (error) {
              debugLog('[ABsmartly Extension] Error accessing context data:', error.message);
            }
          }).catch(error => {
            debugLog('[ABsmartly Extension] Context ready() failed:', error.message);
          });
        }
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
        // Store metadata for SDK consumption (OverridesPlugin handles actual application)
        checkOverridesCookie();
        
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
        
        // Store override metadata for SDK consumption
        // The OverridesPlugin will handle actual application of overrides
        checkOverridesCookie();
        
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

  // Listen for messages from content script (only set up once)
  if (!window.__absmartlyMessageListenerSet) {
    window.__absmartlyMessageListenerSet = true;
    debugLog('[ABsmartly Extension] Setting up message listener for extension messages');
    window.addEventListener('message', (event) => {
    if (event.data && event.data.source === 'absmartly-extension') {
      debugLog('[ABsmartly Page] Received message from extension:', event.data);

      // Handle dynamic override updates
      if (event.data.type === 'APPLY_OVERRIDES') {
        debugLog('[ABsmartly Page] Applying overrides dynamically');
        const { overrides } = event.data.payload || {};

        // The OverridesPlugin handles override application
        // We just need to update metadata and reload the page
        if (overrides) {
          // Store metadata about overrides
          checkOverridesCookie();
          // After updating overrides, we need to refresh the page for changes to take effect
          debugLog('[ABsmartly Page] Override metadata updated. Page will reload to apply changes.');
        }
        return;
      }

      // Handle preview changes - we do this ourselves, not relying on any plugin
      if (event.data.type === 'PREVIEW_CHANGES') {
        debugLog('[ABsmartly Page] Handling PREVIEW_CHANGES message');
        const { changes, experimentName } = event.data.payload || {};
        const expName = experimentName || '__preview__';
        
        debugLog('[ABsmartly Page] Applying preview changes for experiment:', expName);
        debugLog('[ABsmartly Page] Changes to apply:', changes);
        
        // First, remove any existing preview changes for this experiment
        removePreviewChanges(expName);
        
        // Now apply the new changes and track them
        if (changes && Array.isArray(changes)) {
          changes.forEach((change) => {
            applyPreviewChange(change, expName);
          });
        }
        
        debugLog('[ABsmartly Page] Successfully applied preview changes');
        return;
      }

      // Handle remove preview - we do this ourselves, not relying on any plugin
      if (event.data.type === 'REMOVE_PREVIEW') {
        debugLog('[ABsmartly Page] Handling REMOVE_PREVIEW message');
        const { experimentName } = event.data.payload || {};
        const expName = experimentName || '__preview__';
        
        debugLog('[ABsmartly Page] Removing preview changes for experiment:', expName);
        removePreviewChanges(expName);
        
        debugLog('[ABsmartly Page] Successfully removed preview changes');
        return;
      }



      if (event.data.type === 'INITIALIZE_PLUGIN') {
        // Prevent multiple initializations
        if (isInitialized || isInitializing) {
          debugLog('[ABsmartly Extension] Already initialized or initializing, skipping');
          return;
        }
        isInitializing = true;

        const { config } = event.data.payload || {};
        debugLog('[ABsmartly Extension] Received config from extension:', config);
        
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
        
        // Check if the website already has the plugins loaded and initialized
        if (window.ABsmartlySDKPlugins && context.__domPlugin && context.__domPlugin.initialized) {
          debugLog('[ABsmartly Extension] Plugins already loaded and initialized by website, skipping extension initialization');
          isInitialized = true;
          isInitializing = false;
          return;
        }

        // Check if plugins are available, if not load them from extension
        if (typeof window.ABsmartlySDKPlugins === 'undefined' || typeof window.ABsmartlyExtensionPlugin === 'undefined') {
          debugLog('[ABsmartly Extension] Plugins not found, loading from extension...');

          // Use the captured extension URL
          if (extensionBaseUrl) {
            // Function to load plugin scripts with error handling
            const loadPlugins = async () => {
              try {
                // Load SDK plugins (Lite version)
                const sdkPluginUrl = extensionBaseUrl + 'absmartly-sdk-plugins.dev.js?v=' + Date.now();
                debugLog(`[ABsmartly Extension] Loading SDK plugins from: ${sdkPluginUrl}`);

                await new Promise((resolve, reject) => {
                  const script = document.createElement('script');
                  script.src = sdkPluginUrl;
                  script.onload = () => {
                    debugLog('[ABsmartly Extension] SDK plugins loaded');
                    resolve();
                  };
                  script.onerror = () => {
                    debugError('[ABsmartly Extension] Failed to load SDK plugins');
                    reject();
                  };
                  document.head.appendChild(script);
                });

                // Verify SDK plugins are loaded
                if (window.ABsmartlySDKPlugins) {
                  const { DOMChangesPluginLite, OverridesPluginLite } = window.ABsmartlySDKPlugins;

                  if (DOMChangesPluginLite && OverridesPluginLite) {
                    debugLog('[ABsmartly Extension] SDK plugin classes loaded successfully');
                    window.__absmartlyPluginClasses = {
                      DOMChangesPluginLite,
                      OverridesPluginLite
                    };
                  } else {
                    debugError('[ABsmartly Extension] Required plugin classes not found');
                  }
                } else {
                  debugError('[ABsmartly Extension] SDK plugins not properly loaded');
                }
              } catch (error) {
                debugError('[ABsmartly Extension] Error loading plugins:', error);
              }
            };

            loadPlugins();
            return; // Wait for scripts to load
          } else {
            debugError('[ABsmartly Extension] Cannot determine extension URL to load plugins');
            return;
          }
        }
        
        // If plugins are already available, prepare for initialization
        if (window.ABsmartlySDKPlugins) {
          debugLog('[ABsmartly Extension] Plugin libraries already loaded');

          // Check if already initialized by the website
          if (context.__domPlugin && context.__domPlugin.initialized) {
            debugLog('[ABsmartly Extension] Plugin already initialized by website, skipping');
            isInitialized = true;
            isInitializing = false;
            return;
          }

          const { DOMChangesPluginLite, OverridesPluginLite } = window.ABsmartlySDKPlugins;

          if (DOMChangesPluginLite && OverridesPluginLite) {
            debugLog('[ABsmartly Extension] All plugin classes available, ready for initialization');
            // Store classes for initialization
            window.__absmartlyPluginClasses = {
              DOMChangesPluginLite,
              OverridesPluginLite
            };
          } else {
            debugError('[ABsmartly Extension] Required plugin classes not found');
          }
        }

        // Function to initialize both plugins in the correct order
        async function initializePlugins(ctx, config) {
          const context = ctx || cachedContext;

          if (!context) {
            debugError('[ABsmartly Extension] No context available for plugin initialization');
            return;
          }

          // Wait for context to be ready before initializing plugins
          if (context.ready && typeof context.ready === 'function') {
            try {
              debugLog('[ABsmartly Extension] Waiting for context to be ready before initializing plugins...');
              await context.ready();
              debugLog('[ABsmartly Extension] Context is now ready');
            } catch (error) {
              debugError('[ABsmartly Extension] Error waiting for context to be ready:', error);
              // Continue anyway - context might still work
            }
          }

          // Get plugin classes (stored during script load)
          const classes = window.__absmartlyPluginClasses;

          if (!classes) {
            debugError('[ABsmartly Extension] Plugin classes not available');
            return;
          }

          const { DOMChangesPluginLite, OverridesPluginLite } = classes;

          if (!DOMChangesPluginLite || !OverridesPluginLite) {
            debugError('[ABsmartly Extension] Required plugin classes not available');
            debugLog('[ABsmartly Extension] Available:', Object.keys(classes));
            return;
          }

          try {
            // STEP 1: Initialize OverridesPlugin FIRST (must be before DOMChangesPlugin)
            debugLog('[ABsmartly Extension] Initializing OverridesPlugin with config...');

            const overridesConfig = {
              context: context,
              cookieName: 'absmartly_overrides',
              debug: DEBUG
            };

            // Add config from extension if available
            if (config) {
              // Add cookie options (simplified for client-side)
              overridesConfig.cookieOptions = {
                path: '/',
                maxAge: 2592000 // 30 days
                // No secure or sameSite - not supported in document.cookie
              };

              // Add query string configuration
              overridesConfig.useQueryString = true;
              overridesConfig.queryPrefix = config.queryPrefix || '_exp_';
              overridesConfig.envParam = 'env';
              overridesConfig.persistQueryToCookie = config.persistQueryToCookie ?? true;

              // Add endpoints if available
              if (config.sdkEndpoint) {
                // Remove trailing /v1 if present since OverridesPlugin might add it
                overridesConfig.sdkEndpoint = config.sdkEndpoint.replace(/\/v1\/?$/, '');
              }
              if (config.apiEndpoint) {
                // Remove trailing /v1 if present since OverridesPlugin might add it
                overridesConfig.absmartlyEndpoint = config.apiEndpoint.replace(/\/v1\/?$/, '');
              }

              debugLog('[ABsmartly Extension] Using endpoints:', {
                sdk: overridesConfig.sdkEndpoint,
                api: overridesConfig.absmartlyEndpoint
              });
            }

            const overridesPlugin = new OverridesPluginLite(overridesConfig);

            // Apply overrides from cookies
            overridesPlugin.initialize().then(() => {
              debugLog('[ABsmartly Extension] OverridesPlugin initialized, overrides applied');

              // STEP 2: Initialize DOMChangesPluginLite
              debugLog('[ABsmartly Extension] Initializing DOMChangesPluginLite...');
              const domPlugin = new DOMChangesPluginLite({
                context: context,
                autoApply: true,
                spa: true,
                visibilityTracking: true,
                dataSource: 'variable',
                dataFieldName: '__dom_changes',
                debug: DEBUG
              });

              // Initialize DOM plugin
              domPlugin.initialize().then(() => {
                debugLog('[ABsmartly Extension] DOMChangesPluginLite initialized successfully');

                // Inject per-experiment custom code from __inject_html variables
                try {
                  debugLog('[ABsmartly Extension] Checking for experiment-specific injection code');
                  injectExperimentCode(context);
                } catch (error) {
                  debugError('[ABsmartly Extension] Failed to inject experiment code:', error);
                }

                // Notify extension
                window.postMessage({
                  source: 'absmartly-page',
                  type: 'PLUGIN_INITIALIZED',
                  payload: {
                    version: '1.0.0-lite',
                    capabilities: ['auto-apply', 'overrides']
                  }
                }, '*');

                debugLog('[ABsmartly Extension] Both plugins initialized successfully');
                isInitialized = true;
                isInitializing = false;
              }).catch(error => {
                debugError('[ABsmartly Extension] Failed to initialize DOMChangesPlugin:', error);
                isInitializing = false;
              });
            }).catch(error => {
              debugError('[ABsmartly Extension] Failed to initialize OverridesPlugin:', error);
              isInitializing = false;
            });
          } catch (error) {
            debugError('[ABsmartly Extension] Failed to initialize plugins:', error);
            isInitializing = false;
          }
        }

        // Now initialize the plugins with the context and config we have (only if not already initialized)
        if (!isInitialized) {
          initializePlugins(context, config);
          isInitialized = true;
        } else {
          debugLog('[ABsmartly Extension] Plugins already initialized, skipping');
        }
        isInitializing = false;
      } else if (event.data.type === 'INJECT_CUSTOM_CODE') {
        // This message type is not currently used - custom code comes via INJECTION_CODE
        debugLog('[ABsmartly Extension] INJECT_CUSTOM_CODE message received but not used');
      }
    }
    });
  }

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