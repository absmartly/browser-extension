import React, { useState, useEffect, useRef } from "react"
import { Storage } from "@plasmohq/storage"
import { debugLog, debugError } from "~src/utils/debug"
import "~style.css"
import { generateDOMChanges } from "~src/lib/ai-dom-generator"
import ExtensionUI from "~src/components/ExtensionUI"

const storage = new Storage()

debugLog('🔵 ABSmartly Extension: Sidebar script loaded')

// Listen for messages from background script and handle directly in React components
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DEBUG') {
    debugLog(message.message)
  }
  return false
})

// TEMP: Instrument DOM to detect root removal/clearing inside iframe
try {
  const root = document.getElementById('__plasmo')
  console.log('[Sidebar Instrumentation] __plasmo exists:', !!root)

  const logChildren = (label: string) => {
    const el = document.getElementById('__plasmo')
    console.log(`[Sidebar Instrumentation] ${label} children:`, el ? el.children.length : 'root-missing')
  }

  logChildren('initial')

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        const el = document.getElementById('__plasmo')
        if (!el) {
          console.error('[Sidebar Instrumentation] CRITICAL: __plasmo removed from DOM')
        }
      }
    }
  })

  observer.observe(document.documentElement, { childList: true, subtree: false, attributes: false })

  window.addEventListener('pageshow', () => logChildren('pageshow'))
  window.addEventListener('load', () => logChildren('load'))
  window.addEventListener('error', (e) => {
    console.error('[Sidebar Instrumentation] window error:', e)
  })
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[Sidebar Instrumentation] unhandledrejection:', e.reason)
  })
} catch (e) {
  console.error('[Sidebar Instrumentation] init failed:', e)
}

// SidebarContent wrapper - now directly renders ExtensionUI without lazy loading
const SidebarContent = () => {
  return <ExtensionUI />
}

const ABSmartlySidebar = () => {
  const mountId = useRef(`sidebar-${Date.now()}`)

  // Style the __plasmo div to fill the iframe
  useEffect(() => {
    console.log('[sidebar.tsx] 🟢 ABSmartlySidebar MOUNTED', mountId.current)

    const plasmoRoot = document.getElementById('__plasmo')
    if (plasmoRoot) {
      console.log('[sidebar.tsx] Found __plasmo div, applying styles')
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

      // Set up MutationObserver to track critical DOM changes only
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          // Only log if the entire plasmoRoot was removed (critical issue)
          if (mutation.removedNodes.length > 0 && mutation.target === document.body) {
            const removedPlasmo = Array.from(mutation.removedNodes).some(n =>
              (n as HTMLElement).id === '__plasmo'
            )
            if (removedPlasmo) {
              console.error('[sidebar.tsx] ⚠️ CRITICAL: __plasmo root was removed from DOM')
            }
          }
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: false,
        attributes: false
      })

      console.log('[sidebar.tsx] MutationObserver set up on __plasmo')

      return () => {
        console.log('[sidebar.tsx] Disconnecting MutationObserver')
        observer.disconnect()
      }
    } else {
      console.error('[sidebar.tsx] ❌ __plasmo div not found!')
    }

    return () => {
      console.log('[sidebar.tsx] 🔴 ABSmartlySidebar UNMOUNTED', mountId.current)
    }
  }, [])

  console.log('[sidebar.tsx] ABSmartlySidebar RENDER, mountId:', mountId.current)

  // Return only the body content (no header)
  return <SidebarContent />
}

// Note: Plasmo handles the mounting, so we don't need manual mounting code

// Default export for Plasmo
export default ABSmartlySidebar
