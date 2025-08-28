import React from "react"

// Simple self-contained component for the sidebar
// This avoids complex imports that might not bundle correctly
export default function SidebarContent() {
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
          Extension is loading...
        </p>
        <p style={{ 
          fontSize: '12px',
          color: '#9ca3af'
        }}>
          The full interface will be available once the extension loads completely.
        </p>
      </div>
      
      <div style={{
        padding: '12px',
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
        border: '1px solid #dbeafe'
      }}>
        <p style={{
          fontSize: '12px',
          color: '#1e40af'
        }}>
          💡 Tip: You can minimize this sidebar using the arrow button at the top.
        </p>
      </div>
    </div>
  )
}