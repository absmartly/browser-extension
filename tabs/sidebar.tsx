import React, { useState, useEffect, lazy, Suspense } from "react"
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