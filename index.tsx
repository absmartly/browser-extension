import React from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '~src/components/ErrorBoundary'
import ExtensionSidebar from '~src/components/ExtensionUI'
import "~style.css"

// Test: Add global listener for ALL chrome.runtime messages (only if chrome.runtime exists)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[index.tsx GLOBAL] Received chrome.runtime message:', message.type)
    return false // Don't keep channel open
  })
  console.log('[index.tsx] Script loaded, chrome.runtime.onMessage listener registered')
} else {
  console.log('[index.tsx] Script loaded in non-extension context (test mode), chrome.runtime not available')

  // In test mode, listen for polyfilled chrome.runtime.sendMessage calls via postMessage
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'absmartly-content-script' && event.data?.responseId) {
      console.log('[index.tsx] Received polyfilled message:', event.data.type, 'responseId:', event.data.responseId)

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

        console.log('[index.tsx] Sent mock response for REQUEST_INJECTION_CODE')
      } else {
        // Forward all other messages to background script using real chrome.runtime
        // (This is needed because in test mode, messages are sent via postMessage polyfill,
        // but we still need to reach the actual background script)
        console.log('[index.tsx] Forwarding message to background script:', event.data.type)

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
            console.log('[index.tsx] Forwarded response from background:', response)
          }).catch(error => {
            console.error('[index.tsx] Error forwarding message to background:', error)
            // Send error response back
            window.postMessage({
              source: 'absmartly-extension',
              responseId: responseId,
              response: { success: false, error: error.message || 'Message forwarding failed' }
            }, '*')
          })
        } else {
          console.error('[index.tsx] Cannot forward message - chrome.runtime not available')
        }
      }
    }
  })

  console.log('[index.tsx] Added postMessage listener for polyfilled chrome.runtime calls')
}

function IndexSidePanel() {
  return (
    <ErrorBoundary>
      <ExtensionSidebar />
    </ErrorBoundary>
  )
}

export default IndexSidePanel