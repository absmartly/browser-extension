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
      }
    }
  })

  console.log('[index.tsx] Added postMessage listener for polyfilled chrome.runtime calls')
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