import React, { useState, useEffect, lazy, Suspense } from "react"
import { createRoot } from "react-dom/client"
import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"
import ExtensionUI from "~src/components/ExtensionUI"
import { debugLog, debugError, debugWarn } from "~src/utils/debug"
import "~style.css"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle"
}

const storage = new Storage()

// Loading component for Suspense
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

// Global variables to track sidebar state
let sidebarContainer: HTMLElement | null = null
let sidebarVisible = false
let sidebarMinimized = false
let reactRoot: any = null

// Function to create and inject sidebar (exported for use from content.ts)
export const injectSidebar = () => {
  // Check if sidebar already exists
  const existing = document.getElementById('absmartly-sidebar-root')
  if (existing) {
    debugLog('🔵 ABSmartly Extension: Sidebar already exists, toggling visibility')
    const currentTransform = existing.style.transform
    const isVisible = currentTransform === 'translateX(0px)' || currentTransform === 'translateX(0%)' || !currentTransform
    
    if (isVisible) {
      existing.style.transform = 'translateX(100%)'
      sidebarVisible = false
    } else {
      existing.style.transform = 'translateX(0)'
      sidebarVisible = true
    }
    return
  }

  debugLog('🔵 ABSmartly Extension: Creating sidebar with shadow DOM')
  
  // Create container
  sidebarContainer = document.createElement('div')
  sidebarContainer.id = 'absmartly-sidebar-root'
  sidebarContainer.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 384px;
    height: 100vh;
    z-index: 2147483647;
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out, width 0.3s ease-in-out;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `
  
  // Create shadow root
  const shadowRoot = sidebarContainer.attachShadow({ mode: 'open' })
  
  // Add styles to shadow DOM
  const styleSheet = document.createElement('style')
  styleSheet.textContent = `
    :host {
      all: initial;
      display: block;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #111827;
      background: white;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
    }
    * {
      box-sizing: border-box;
    }
    .sidebar-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: white;
    }
    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: #3b82f6;
      flex-shrink: 0;
    }
    .sidebar-header.minimized {
      padding: 12px;
      flex-direction: column;
      gap: 12px;
      background-color: white;
      border-right: 1px solid #e5e7eb;
    }
    .logo-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo {
      height: 24px;
      filter: brightness(0) invert(1);
    }
    .title {
      font-weight: 600;
      font-size: 16px;
      color: white;
    }
    .buttons-container {
      display: flex;
      gap: 8px;
    }
    .btn {
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      color: white;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    .expand-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      background: #3b82f6;
      border: none;
      border-radius: 4px;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: background 0.2s;
    }
    .expand-btn:hover {
      background: #2563eb;
    }
    .vertical-text {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-size: 12px;
      color: #6b7280;
      letter-spacing: 0.05em;
      flex: 1;
      display: flex;
      align-items: center;
    }
    .sidebar-body {
      flex: 1;
      overflow: auto;
      position: relative;
    }
    #extension-ui-root {
      width: 100%;
      height: 100%;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
  shadowRoot.appendChild(styleSheet)
  
  // Create sidebar structure
  const container = document.createElement('div')
  container.className = 'sidebar-container'
  
  // Create header
  const header = document.createElement('div')
  header.className = 'sidebar-header'
  
  // Create body for React content
  const body = document.createElement('div')
  body.className = 'sidebar-body'
  body.id = 'extension-ui-root'
  
  // Function to update sidebar UI
  const updateSidebar = () => {
    sidebarContainer!.style.width = sidebarMinimized ? '48px' : '384px'
    header.innerHTML = ''
    header.className = sidebarMinimized ? 'sidebar-header minimized' : 'sidebar-header'
    
    if (sidebarMinimized) {
      // Minimized state
      const expandBtn = document.createElement('button')
      expandBtn.className = 'expand-btn'
      expandBtn.innerHTML = '←'
      expandBtn.title = 'Expand sidebar'
      expandBtn.onclick = () => {
        sidebarMinimized = false
        updateSidebar()
        chrome.storage.local.set({ sidebarMinimized: false })
      }
      
      const text = document.createElement('div')
      text.className = 'vertical-text'
      text.innerText = 'ABSmartly'
      
      header.appendChild(expandBtn)
      header.appendChild(text)
    } else {
      // Full state
      const logoContainer = document.createElement('div')
      logoContainer.className = 'logo-container'
      
      const logo = document.createElement('img')
      logo.src = chrome.runtime.getURL('assets/icon.png')
      logo.alt = 'ABSmartly'
      logo.className = 'logo'
      
      const title = document.createElement('span')
      title.className = 'title'
      title.innerText = 'ABSmartly'
      
      logoContainer.appendChild(logo)
      logoContainer.appendChild(title)
      
      const buttonsContainer = document.createElement('div')
      buttonsContainer.className = 'buttons-container'
      
      const minimizeBtn = document.createElement('button')
      minimizeBtn.className = 'btn'
      minimizeBtn.innerHTML = '→'
      minimizeBtn.title = 'Minimize sidebar'
      minimizeBtn.onclick = () => {
        sidebarMinimized = true
        updateSidebar()
        chrome.storage.local.set({ sidebarMinimized: true })
      }
      
      const closeBtn = document.createElement('button')
      closeBtn.className = 'btn'
      closeBtn.innerHTML = '✕'
      closeBtn.title = 'Close sidebar'
      closeBtn.onclick = () => {
        sidebarVisible = false
        sidebarContainer!.style.transform = 'translateX(100%)'
      }
      
      buttonsContainer.appendChild(minimizeBtn)
      buttonsContainer.appendChild(closeBtn)
      
      header.appendChild(logoContainer)
      header.appendChild(buttonsContainer)
    }
  }
  
  // Load saved minimized state
  chrome.storage.local.get(['sidebarMinimized'], (result) => {
    sidebarMinimized = result.sidebarMinimized || false
    updateSidebar()
  })
  
  container.appendChild(header)
  container.appendChild(body)
  shadowRoot.appendChild(container)
  
  // Append to document
  document.body.appendChild(sidebarContainer)
  
  // Mount React component with Suspense
  reactRoot = createRoot(body)
  reactRoot.render(
    <Suspense fallback={<LoadingContent />}>
      <ExtensionUI />
    </Suspense>
  )
  
  // Show sidebar after React mounts
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      sidebarContainer!.style.transform = 'translateX(0)'
      sidebarVisible = true
    })
  })
  
  debugLog('🔵 ABSmartly Extension: Sidebar injected with shadow DOM')
}

// Listen for messages to toggle sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_SIDEBAR') {
    injectSidebar()
    sendResponse({ success: true })
    return true
  }
})

// Export for HMR support
if (module.hot) {
  module.hot.accept()
  module.hot.dispose(() => {
    // Clean up on HMR
    if (reactRoot) {
      reactRoot.unmount()
    }
    if (sidebarContainer && sidebarContainer.parentNode) {
      sidebarContainer.parentNode.removeChild(sidebarContainer)
    }
  })
}

// Don't auto-inject, wait for user action
export default () => {
  debugLog('🔵 ABSmartly Extension: Sidebar content script loaded')
}

// Export injectSidebar for dynamic imports
export { injectSidebar }