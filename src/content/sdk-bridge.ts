/**
 * SDK Bridge - Injected into the page context
 * This runs in the page context and can access the ABSmartly SDK
 */

import type { DOMChange } from '../types/dom-changes'

declare global {
  interface Window {
    absmartly?: any
    ABSmartly?: any
  }
}

// This script will be injected into the page
const bridgeScript = `
(function() {
  // Store original variant values to restore on preview removal
  const originalVariants = new Map();
  const appliedChanges = new Map();
  
  // Helper to get ABsmartly context
  function getABsmartlyContext() {
    // Try different possible locations
    if (window.absmartly?.context) return window.absmartly.context;
    if (window.ABsmartly?.context) return window.ABsmartly.context;
    if (window.absmartlyContext) return window.absmartlyContext;
    
    // Try to find it in global scope
    for (const key in window) {
      if (key.includes('absmartly') || key.includes('ABSmartly')) {
        const obj = window[key];
        if (obj && typeof obj === 'object' && obj.context) {
          return obj.context;
        }
      }
    }
    
    return null;
  }
  
  // Apply DOM changes
  function applyDOMChanges(changes) {
    changes.forEach(change => {
      if (!change.enabled && change.enabled !== undefined) return;
      
      try {
        const elements = document.querySelectorAll(change.selector);
        elements.forEach(element => {
          const changeId = change.selector + '-' + change.type;
          
          // Store original state if not already stored
          if (!appliedChanges.has(changeId)) {
            appliedChanges.set(changeId, {
              selector: change.selector,
              type: change.type,
              originalState: captureElementState(element, change.type)
            });
          }
          
          // Apply the change
          switch (change.type) {
            case 'text':
              element.textContent = change.value;
              break;
              
            case 'html':
              element.innerHTML = change.value;
              break;
              
            case 'style':
              Object.entries(change.value).forEach(([property, value]) => {
                element.style.setProperty(property, value);
              });
              break;
              
            case 'class':
              if (change.add) {
                element.classList.add(...change.add);
              }
              if (change.remove) {
                element.classList.remove(...change.remove);
              }
              break;
              
            case 'attribute':
              Object.entries(change.value).forEach(([attr, value]) => {
                element.setAttribute(attr, value);
              });
              break;
              
            case 'javascript':
              new Function('element', change.value)(element);
              break;
          }
          
          // Mark as modified by extension
          element.setAttribute('data-absmartly-modified', 'true');
        });
      } catch (error) {
        console.error('Error applying DOM change:', error, change);
      }
    });
  }
  
  // Capture element state before modification
  function captureElementState(element, changeType) {
    switch (changeType) {
      case 'text':
        return { text: element.textContent };
      case 'html':
        return { html: element.innerHTML };
      case 'style':
        return { style: element.getAttribute('style') || '' };
      case 'class':
        return { classList: [...element.classList] };
      case 'attribute':
        // This is simplified - in production, store all attributes
        return { attributes: {} };
      default:
        return {};
    }
  }
  
  // Remove all DOM changes
  function removeDOMChanges() {
    // Restore original states
    appliedChanges.forEach((changeInfo, changeId) => {
      try {
        const elements = document.querySelectorAll(changeInfo.selector);
        elements.forEach(element => {
          switch (changeInfo.type) {
            case 'text':
              element.textContent = changeInfo.originalState.text;
              break;
            case 'html':
              element.innerHTML = changeInfo.originalState.html;
              break;
            case 'style':
              element.setAttribute('style', changeInfo.originalState.style);
              break;
            case 'class':
              element.className = '';
              element.classList.add(...changeInfo.originalState.classList);
              break;
          }
          
          element.removeAttribute('data-absmartly-modified');
        });
      } catch (error) {
        console.error('Error removing DOM change:', error);
      }
    });
    
    appliedChanges.clear();
  }
  
  // Listen for messages from the extension
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== 'absmartly-extension') return;
    
    const { type, payload } = event.data;
    
    switch (type) {
      case 'APPLY_CHANGES':
        applyDOMChanges(payload.changes || []);
        window.postMessage({
          source: 'absmartly-sdk',
          type: 'CHANGES_APPLIED',
          payload: { success: true }
        }, '*');
        break;
        
      case 'REMOVE_CHANGES':
        removeDOMChanges();
        window.postMessage({
          source: 'absmartly-sdk',
          type: 'CHANGES_REMOVED',
          payload: { success: true }
        }, '*');
        break;
        
      case 'GET_VARIANT':
        const context = getABsmartlyContext();
        if (context) {
          // Get current variant info
          const experiments = context.experiments || [];
          window.postMessage({
            source: 'absmartly-sdk',
            type: 'VARIANT_INFO',
            payload: { experiments }
          }, '*');
        } else {
          window.postMessage({
            source: 'absmartly-sdk',
            type: 'ERROR',
            payload: { error: 'ABSmartly context not found' }
          }, '*');
        }
        break;
        
      case 'SET_VARIANT':
        // This would require SDK support for variant overrides
        // For now, just apply the changes
        console.log('SET_VARIANT not implemented - apply changes directly');
        break;
    }
  });
  
  // Notify extension that bridge is ready
  window.postMessage({
    source: 'absmartly-sdk',
    type: 'BRIDGE_READY',
    payload: {}
  }, '*');
})();
`;

/**
 * Inject the SDK bridge script into the page
 */
export function injectSDKBridge() {
  // Check if already injected
  if (document.querySelector('#absmartly-sdk-bridge')) {
    return
  }
  
  const script = document.createElement('script')
  script.id = 'absmartly-sdk-bridge'
  script.textContent = bridgeScript
  
  // Inject at the beginning of head or body
  const target = document.head || document.body
  if (target) {
    target.insertBefore(script, target.firstChild)
  }
}