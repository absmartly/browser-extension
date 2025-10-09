import React, { useState, useEffect, lazy, Suspense } from "react"
import { Storage } from "@plasmohq/storage"
import "~style.css"

const storage = new Storage()

// This script will be injected programmatically by the background script
console.log('🔵 ABSmartly Extension: Sidebar script loaded')

// In test mode, listen for polyfilled chrome.runtime.sendMessage calls via postMessage
// and forward them to the background script
if (window.parent !== window) {
  // We're in an iframe (test mode)
  console.log('[tabs/sidebar.tsx] Running in iframe, setting up message forwarding')

  window.addEventListener('message', (event) => {
    if (event.data?.source === 'absmartly-content-script' && event.data?.responseId) {
      console.log('[tabs/sidebar.tsx] Received polyfilled message:', event.data.type, 'responseId:', event.data.responseId)

      // Mock the background script's response for REQUEST_INJECTION_CODE
      if (event.data.type === 'REQUEST_INJECTION_CODE') {
        const response = {
          data: null, // No custom code in test
          config: null // No config in test
        }

        window.postMessage({
          source: 'absmartly-extension',
          responseId: event.data.responseId,
          response: response
        }, '*')

        console.log('[tabs/sidebar.tsx] Sent mock response for REQUEST_INJECTION_CODE')
      } else {
        // Forward all other messages to background script using real chrome.runtime
        console.log('[tabs/sidebar.tsx] Forwarding message to background script:', event.data.type)

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
            console.log('[tabs/sidebar.tsx] Forwarded response from background:', response)
          }).catch(error => {
            console.error('[tabs/sidebar.tsx] Error forwarding message to background:', error)
            // Send error response back
            window.postMessage({
              source: 'absmartly-extension',
              responseId: responseId,
              response: { success: false, error: error.message || 'Message forwarding failed' }
            }, '*')
          })
        } else {
          console.error('[tabs/sidebar.tsx] Cannot forward message - chrome.runtime not available')
        }
      }
    }
  })

  console.log('[tabs/sidebar.tsx] Message forwarding listener registered')
  
  // Also listen for messages FROM background script and forward them to iframe content
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[tabs/sidebar.tsx] Received message from background:', message.type)

    // Log DEBUG messages directly
    if (message.type === 'DEBUG') {
      console.log(message.message)
    }

    // Forward to iframe content as a regular message event
    window.postMessage({
      source: 'absmartly-extension-incoming',
      ...message
    }, '*')
    return false
  })
  console.log('[tabs/sidebar.tsx] Incoming message listener registered')
}

// Lazy load the ExtensionUI to avoid bundling issues
const ExtensionUI = lazy(() => import("~src/components/ExtensionUI"))

// Fallback component while loading
const LoadingContent = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ 
        fontSize: '18px', 
        fontWeight: '600',
        marginBottom: '16px',
        color: '#111827'
      }}>
        ABSmartly Extension
      </h2>
      
      <div style={{
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <p style={{ 
          fontSize: '14px',
          color: '#6b7280',
          marginBottom: '12px'
        }}>
          Loading extension...
        </p>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            border: '3px solid #f3f4f6',
            borderTop: '3px solid #3b82f6',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      </div>
    </div>
  )
}

// SidebarContent wrapper that uses Suspense for lazy loading
const SidebarContent = () => {
  return (
    <Suspense fallback={<LoadingContent />}>
      <ExtensionUI />
    </Suspense>
  )
}

const ABSmartlySidebar = () => {
  // Style the __plasmo div to fill the iframe
  useEffect(() => {
    const plasmoRoot = document.getElementById('__plasmo')
    if (plasmoRoot) {
      Object.assign(plasmoRoot.style, {
        width: '100%',
        height: '100%',
        backgroundColor: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
        fontSize: '14px',
        lineHeight: '1.5',
        color: '#111827',
        overflow: 'auto',
      })
    }
  }, [])

  // Return only the body content (no header)
  return <SidebarContent />
}

// Note: Plasmo handles the mounting, so we don't need manual mounting code

// Default export for Plasmo
export default ABSmartlySidebar