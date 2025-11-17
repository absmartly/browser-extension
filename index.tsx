import React from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '~src/components/ErrorBoundary'
import ExtensionSidebar from '~src/components/ExtensionUI'
import { debugLog, debugError } from '~src/utils/debug'
import "~style.css"

chrome.runtime.onMessage.addListener((message) => {
  debugLog('[index.tsx GLOBAL] Received chrome.runtime message:', message.type)
  return false
})

const container = document.getElementById('__plasmo')
if (container) {
  const root = createRoot(container)
  root.render(
    <ErrorBoundary>
      <ExtensionSidebar />
    </ErrorBoundary>
  )
}