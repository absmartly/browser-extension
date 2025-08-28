import React, { useState, useEffect, lazy, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { Storage } from "@plasmohq/storage"
import "~style.css"

const storage = new Storage()

// This script will be injected programmatically by the background script
console.log('🔵 ABSmartly Extension: Sidebar script loaded')

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
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    // Listen for messages from the background script
    const messageHandler = (message: any) => {
      console.log('🔵 ABSmartly Extension: Received message:', message)
      if (message.type === 'TOGGLE_SIDEBAR') {
        setIsVisible(prev => !prev)
      } else if (message.type === 'SHOW_SIDEBAR') {
        setIsVisible(true)
      } else if (message.type === 'HIDE_SIDEBAR') {
        setIsVisible(false)
      }
    }

    chrome.runtime.onMessage.addListener(messageHandler)

    // Load saved state
    storage.get("sidebarMinimized").then((minimized) => {
      if (minimized !== undefined) {
        setIsMinimized(minimized)
      }
    })

    return () => {
      chrome.runtime.onMessage.removeListener(messageHandler)
    }
  }, [])

  const handleToggleMinimize = async () => {
    const newMinimized = !isMinimized
    setIsMinimized(newMinimized)
    await storage.set("sidebarMinimized", newMinimized)
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div 
      id="absmartly-sidebar"
      style={{
        position: 'fixed',
        top: '0',
        right: '0',
        width: isMinimized ? '48px' : '384px', // w-96 in Tailwind
        height: '100vh',
        backgroundColor: 'white',
        borderLeft: '1px solid #e5e7eb',
        boxShadow: '-4px 0 6px -1px rgba(0, 0, 0, 0.1)',
        zIndex: 2147483647,
        transition: 'width 0.3s ease-in-out',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
        fontSize: '14px',
        lineHeight: '1.5',
        color: '#111827',
      }}
    >
      {isMinimized ? (
        <div 
          style={{
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            onClick={handleToggleMinimize}
            style={{
              width: '24px',
              height: '24px',
              padding: '0',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
            title="Expand sidebar"
          >
            ←
          </button>
          <div 
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: '12px',
              color: '#6b7280',
              letterSpacing: '0.05em',
            }}
          >
            ABSmartly
          </div>
        </div>
      ) : (
        <>
          <div 
            style={{
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#3b82f6',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src={chrome.runtime.getURL('assets/absmartly-logo-white.svg')}
                alt="ABSmartly"
                style={{ height: '24px' }}
              />
              <span style={{ fontWeight: '600', fontSize: '16px', color: 'white' }}>ABSmartly</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleToggleMinimize}
                style={{
                  padding: '4px 8px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
                title="Minimize sidebar"
              >
                →
              </button>
              <button
                onClick={handleClose}
                style={{
                  padding: '4px 8px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
                title="Close sidebar"
              >
                ✕
              </button>
            </div>
          </div>
          <div style={{ 
            height: 'calc(100% - 57px)', 
            overflow: 'auto',
          }}>
            <SidebarContent />
          </div>
        </>
      )}
    </div>
  )
}

// Mount the sidebar when the script is injected
if (typeof document !== 'undefined') {
  console.log('🔵 ABSmartly Extension: Checking for mount...')
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountSidebar)
  } else {
    mountSidebar()
  }
}

function mountSidebar() {
  console.log('🔵 ABSmartly Extension: Mounting sidebar')
  
  // Check if we've already mounted
  if (document.getElementById('absmartly-sidebar-root')) {
    console.log('🔵 ABSmartly Extension: Sidebar already mounted')
    return
  }
  
  // Create container
  const container = document.createElement('div')
  container.id = 'absmartly-sidebar-root'
  container.style.cssText = 'all: initial; z-index: 2147483647;'
  document.body.appendChild(container)
  
  // Create shadow root for isolation
  const shadowRoot = container.attachShadow({ mode: 'closed' })
  
  // Load and inject the CSS into shadow DOM
  // Try to load the sidebar CSS file (filename changes with each build)
  fetch(chrome.runtime.getURL('manifest.json'))
    .then(response => response.json())
    .then(manifest => {
      // Find the sidebar CSS file from web_accessible_resources
      const resources = manifest.web_accessible_resources?.[0]?.resources || []
      const cssFile = resources.find(r => r.startsWith('sidebar') && r.endsWith('.css'))
      
      if (cssFile) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = chrome.runtime.getURL(cssFile)
        shadowRoot.appendChild(link)
      } else {
        console.warn('Could not find sidebar CSS file in manifest')
      }
    })
    .catch(err => {
      console.error('Failed to load sidebar CSS:', err)
    })
  
  // Add CSS for spinner animation and additional styles
  const style = document.createElement('style')
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Base styles for shadow DOM */
    * {
      box-sizing: border-box;
    }
    
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    }
  `
  shadowRoot.appendChild(style)
  
  // Create React root inside shadow DOM
  const reactContainer = document.createElement('div')
  reactContainer.className = 'absmartly-extension-root'
  shadowRoot.appendChild(reactContainer)
  
  // Mount React app
  const root = createRoot(reactContainer)
  root.render(<ABSmartlySidebar />)
  
  console.log('🔵 ABSmartly Extension: Sidebar mounted successfully')
}

// Default export for Plasmo
export default ABSmartlySidebar