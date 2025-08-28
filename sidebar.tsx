import type { PlasmoCSConfig } from "plasmo"
import { createRoot } from "react-dom/client"
import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"
import IndexPopupContent from "./popup"
import "~style.css"
import "./sidebar.css"

// Configure content script
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  css: ["sidebar.css"],
  run_at: "document_end"
}

// Sidebar wrapper component
function SidebarWrapper() {
  const [isSidebarOpen, setIsSidebarOpen] = useStorage("sidebarOpen", false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Small delay to ensure DOM is ready
    setTimeout(() => setIsReady(true), 100)
  }, [])

  useEffect(() => {
    // Adjust page margin when sidebar opens/closes
    if (isSidebarOpen) {
      document.body.style.marginRight = "400px"
      document.body.style.transition = "margin-right 0.3s ease"
    } else {
      document.body.style.marginRight = "0"
    }

    return () => {
      document.body.style.marginRight = ""
      document.body.style.transition = ""
    }
  }, [isSidebarOpen])

  if (!isReady) return null

  return (
    <>
      {/* Toggle Button */}
      <button
        className="absmartly-sidebar-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        title={isSidebarOpen ? "Close ABsmartly" : "Open ABsmartly"}
      >
        {isSidebarOpen ? "×" : "AB"}
      </button>

      {/* Sidebar Container */}
      <div className={`absmartly-sidebar ${isSidebarOpen ? "open" : "closed"}`}>
        <div className="absmartly-sidebar-inner">
          <IndexPopupContent />
        </div>
      </div>
    </>
  )
}

// Mount the sidebar
const mount = () => {
  // Check if sidebar already exists
  if (document.getElementById("absmartly-sidebar-root")) {
    return
  }

  // Create container for sidebar
  const container = document.createElement("div")
  container.id = "absmartly-sidebar-root"
  document.body.appendChild(container)

  // Create React root and render sidebar
  const root = createRoot(container)
  root.render(<SidebarWrapper />)
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount)
} else {
  mount()
}

// Export for Plasmo
export default SidebarWrapper