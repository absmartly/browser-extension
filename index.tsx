import React from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '~src/components/ErrorBoundary'
import ExtensionSidebar from '~src/components/ExtensionUI'
import { debugLog, debugError } from '~src/utils/debug'
import "~style.css"

// Test: Add global listener for ALL chrome.runtime messages (only if chrome.runtime exists)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debugLog('[index.tsx GLOBAL] Received chrome.runtime message:', message.type)
    return false // Don't keep channel open
  })
  debugLog('[index.tsx] Script loaded, chrome.runtime.onMessage listener registered')
} else {
  debugLog('[index.tsx] Script loaded in non-extension context (test mode), chrome.runtime not available')

  // In test mode, listen for polyfilled chrome.runtime.sendMessage calls via postMessage
  window.addEventListener('message', (event) => {
    if ((event.data?.source === 'absmartly-content-script' || event.data?.source === 'absmartly-visual-editor') && event.data?.responseId) {
      debugLog('[index.tsx] Received polyfilled message:', event.data.type, 'source:', event.data.source, 'responseId:', event.data.responseId)

      // Mock the background script's response for REQUEST_INJECTION_CODE
      if (event.data.type === 'REQUEST_INJECTION_CODE') {
        // Send back a mock response
        const response = {
          data: null, // No custom code in test
          config: null // No config in test
        }

        window.postMessage({
          source: 'absmartly-extension',
          responseId: event.data.responseId,
          response: response
        }, '*')

        debugLog('[index.tsx] Sent mock response for REQUEST_INJECTION_CODE')
      } else {
        // Forward all other messages to background script using real chrome.runtime
        // (This is needed because in test mode, messages are sent via postMessage polyfill,
        // but we still need to reach the actual background script)
        debugLog('[index.tsx] Forwarding message to background script:', event.data.type)

        // Extract the original message (without polyfill metadata)
        const { source, responseId, ...originalMessage } = event.data

        // Forward to background script using real chrome.runtime
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(originalMessage).then(response => {
            // Send response back to content script via postMessage
            window.postMessage({
              source: 'absmartly-extension',
              responseId: responseId,
              response: response
            }, '*')
            debugLog('[index.tsx] Forwarded response from background:', response)
          }).catch(error => {
            debugError('[index.tsx] Error forwarding message to background:', error)
            // Send error response back
            window.postMessage({
              source: 'absmartly-extension',
              responseId: responseId,
              response: { success: false, error: error.message || 'Message forwarding failed' }
            }, '*')
          })
        } else {
          debugError('[index.tsx] Cannot forward message - chrome.runtime not available')
        }
      }
    }
  })

  debugLog('[index.tsx] Added postMessage listener for polyfilled chrome.runtime calls')
}

const container = document.getElementById('__plasmo')
if (container) {
  const root = createRoot(container)
  root.render(
    <ErrorBoundary>
      <ExtensionSidebar />
    </ErrorBoundary>
  )
}