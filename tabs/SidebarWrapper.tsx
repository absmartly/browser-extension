import React from "react"

// Simple loading component for now
export default function SidebarWrapper() {
  return (
    <div style={{ padding: '20px' }}>
      <h2>ABSmartly Extension</h2>
      <p>Loading experiments...</p>
      <p style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        Note: The extension UI is currently being loaded. 
        If this message persists, there may be an issue with the import system.
      </p>
    </div>
  )
}