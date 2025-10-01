import React from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '~src/components/ErrorBoundary'
import ExtensionSidebar from '~src/components/ExtensionUI'
import "~style.css"

// Test: Add global listener for ALL chrome.runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[index.tsx GLOBAL] Received chrome.runtime message:', message.type)
  return false // Don't keep channel open
})

console.log('[index.tsx] Script loaded, chrome.runtime.onMessage listener registered')

const container = document.getElementById('__plasmo')
if (container) {
  const root = createRoot(container)
  root.render(
    <ErrorBoundary>
      <ExtensionSidebar />
    </ErrorBoundary>
  )
}