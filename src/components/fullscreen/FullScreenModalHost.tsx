import React from "react"

interface FullScreenModalHostProps {
  children: React.ReactNode
}

export function FullScreenModalHost({ children }: FullScreenModalHostProps) {
  return (
    <div
      id="absmartly-fullscreen-modal-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "white",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        font: "14px system-ui, sans-serif"
      }}>
      {children}
    </div>
  )
}
