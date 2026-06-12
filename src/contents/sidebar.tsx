import type { PlasmoCSConfig } from "plasmo"
import React, { lazy, Suspense, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import { Storage } from "@plasmohq/storage"

import ExtensionUI from "~src/components/ExtensionUI"
import { debugError, debugLog, debugWarn } from "~src/utils/debug"

import "~style.css"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle"
}

const storage = new Storage()

const LoadingContent = () => {
  return (
    <div style={{ padding: "20px" }}>
      <h2
        style={{
          fontSize: "18px",
          fontWeight: "600",
          marginBottom: "16px",
          color: "#111827"
        }}>
        ABSmartly Extension
      </h2>

      <div
        style={{
          padding: "16px",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          marginBottom: "16px"
        }}>
        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            marginBottom: "12px"
          }}>
          Loading extension...
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "20px"
          }}>
          <div
            style={{
              border: "3px solid #f3f4f6",
              borderTop: "3px solid #3b82f6",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              animation: "spin 1s linear infinite"
            }}
          />
        </div>
      </div>
    </div>
  )
}

let sidebarContainer: HTMLElement | null = null
let sidebarVisible = false
let sidebarMinimized = false
let reactRoot: any = null

export const injectSidebar = () => {
  const existing = document.getElementById("absmartly-sidebar-root")
  if (existing) {
    if (!existing.shadowRoot) {
      debugLog(
        "🔵 ABSmartly Extension: Found stale sidebar without shadow DOM, removing it"
      )
      existing.remove()
    } else {
      debugLog(
        "🔵 ABSmartly Extension: Sidebar already exists, toggling visibility"
      )
      const currentTransform = existing.style.transform
      const isVisible =
        currentTransform === "translateX(0px)" ||
        currentTransform === "translateX(0%)" ||
        !currentTransform

      if (isVisible) {
        existing.style.transform = "translateX(100%)"
        sidebarVisible = false
        storage.set("sidebar-visible", false).catch((error) => {
          debugError("Failed to save sidebar visibility state:", error)
        })
      } else {
        existing.style.transform = "translateX(0)"
        sidebarVisible = true
        storage.set("sidebar-visible", true).catch((error) => {
          debugError("Failed to save sidebar visibility state:", error)
        })
      }
      return
    }
  }

  debugLog("🔵 ABSmartly Extension: Creating sidebar with shadow DOM")

  sidebarContainer = document.createElement("div")
  sidebarContainer.id = "absmartly-sidebar-root"
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

  const shadowRoot = sidebarContainer.attachShadow({ mode: "open" })

  const styleSheet = document.createElement("style")
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
    /*
     * Left-edge drag handle for fine-tuning the sidebar width (FT-1905).
     * A thin 6px strip with an ew-resize cursor, positioned absolutely on
     * the left of the host so the user can grab it without overlapping form
     * controls. ::after gives it a subtle visual indicator on hover.
     */
    .sidebar-resize-handle {
      position: absolute;
      top: 0;
      left: 0;
      width: 6px;
      height: 100%;
      cursor: ew-resize;
      z-index: 2147483647;
      background: transparent;
      user-select: none;
    }
    .sidebar-resize-handle::after {
      content: "";
      position: absolute;
      top: 0;
      left: 2px;
      width: 2px;
      height: 100%;
      background: transparent;
      transition: background 0.15s;
    }
    .sidebar-resize-handle:hover::after,
    .sidebar-resize-handle.dragging::after {
      background: #3b82f6;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
  shadowRoot.appendChild(styleSheet)

  const container = document.createElement("div")
  container.className = "sidebar-container"

  const header = document.createElement("div")
  header.className = "sidebar-header"

  const body = document.createElement("div")
  body.className = "sidebar-body"
  body.id = "extension-ui-root"

  const updateSidebar = () => {
    sidebarContainer!.style.width = sidebarMinimized ? "48px" : "384px"
    header.innerHTML = ""
    header.className = sidebarMinimized
      ? "sidebar-header minimized"
      : "sidebar-header"

    if (sidebarMinimized) {
      const expandBtn = document.createElement("button")
      expandBtn.className = "expand-btn"
      expandBtn.innerHTML = "←"
      expandBtn.title = "Expand sidebar"
      expandBtn.onclick = () => {
        sidebarMinimized = false
        updateSidebar()
        chrome.storage.local.set({ sidebarMinimized: false })
      }

      const text = document.createElement("div")
      text.className = "vertical-text"
      text.innerText = "ABSmartly"

      header.appendChild(expandBtn)
      header.appendChild(text)
    } else {
      const logoContainer = document.createElement("div")
      logoContainer.className = "logo-container"

      const logo = document.createElement("img")
      logo.src = chrome.runtime.getURL("assets/icon.png")
      logo.alt = "ABSmartly"
      logo.className = "logo"

      const title = document.createElement("span")
      title.className = "title"
      title.innerText = "ABSmartly"

      logoContainer.appendChild(logo)
      logoContainer.appendChild(title)

      const buttonsContainer = document.createElement("div")
      buttonsContainer.className = "buttons-container"

      const minimizeBtn = document.createElement("button")
      minimizeBtn.className = "btn"
      minimizeBtn.innerHTML = "→"
      minimizeBtn.title = "Minimize sidebar"
      minimizeBtn.onclick = () => {
        sidebarMinimized = true
        updateSidebar()
        chrome.storage.local.set({ sidebarMinimized: true })
      }

      const closeBtn = document.createElement("button")
      closeBtn.className = "btn"
      closeBtn.innerHTML = "✕"
      closeBtn.title = "Close sidebar"
      closeBtn.onclick = () => {
        sidebarVisible = false
        sidebarContainer!.style.transform = "translateX(100%)"
      }

      buttonsContainer.appendChild(minimizeBtn)
      buttonsContainer.appendChild(closeBtn)

      header.appendChild(logoContainer)
      header.appendChild(buttonsContainer)
    }
  }

  chrome.storage.local.get(["sidebarMinimized"], (result) => {
    sidebarMinimized = result.sidebarMinimized || false
    updateSidebar()
  })

  container.appendChild(header)
  container.appendChild(body)

  // Left-edge drag handle for fine-tuning sidebar width (FT-1905).
  // Lives inside the shadow root so it scrolls/positions with the sidebar.
  // We update the host container's `width` directly during the drag (using
  // rAF batching), then post one ABSMARTLY_SIDEBAR_RESIZE message at the end
  // so the saved/preFullscreen state stays consistent across reopens.
  const resizeHandle = document.createElement("div")
  resizeHandle.className = "sidebar-resize-handle"
  resizeHandle.setAttribute("data-testid", "sidebar-resize-handle")
  resizeHandle.id = "sidebar-resize-handle"
  resizeHandle.title = "Drag to resize sidebar"

  let dragRafId: number | null = null
  let pendingWidth: number | null = null
  const clampWidth = (px: number): number => {
    const min = 240
    // Cap drag at 50% of viewport — the only resize affordance left after
    // the "Expand form" button was removed, so the handle has to be able
    // to reach the same half-screen layout on its own.
    const max = Math.max(min, Math.floor(window.innerWidth * 0.5))
    return Math.max(min, Math.min(max, px))
  }
  const flushDrag = () => {
    dragRafId = null
    if (pendingWidth === null || !sidebarContainer) return
    sidebarContainer.style.transition = "none"
    sidebarContainer.style.width = `${pendingWidth}px`
    pendingWidth = null
  }

  resizeHandle.addEventListener("mousedown", (e) => {
    if (!sidebarContainer) return
    e.preventDefault()
    e.stopPropagation()
    resizeHandle.classList.add("dragging")
    document.body.style.userSelect = "none"

    const onMove = (ev: MouseEvent) => {
      if (!sidebarContainer) return
      // Sidebar is anchored to the right of the viewport, so the new width
      // is `viewportWidth - mouseX`. clamp to keep the form usable.
      const next = clampWidth(window.innerWidth - ev.clientX)
      pendingWidth = next
      if (dragRafId === null) {
        dragRafId = window.requestAnimationFrame(flushDrag)
      }
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      resizeHandle.classList.remove("dragging")
      document.body.style.userSelect = ""
      if (dragRafId !== null) {
        cancelAnimationFrame(dragRafId)
        dragRafId = null
      }
      if (pendingWidth !== null && sidebarContainer) {
        sidebarContainer.style.width = `${pendingWidth}px`
        pendingWidth = null
      }
      // Sync the saved pre-resize width with the background helper so the
      // next Expand-form / restore cycle starts from the right baseline.
      const finalWidth = sidebarContainer?.style.width || "384px"
      try {
        chrome.runtime
          .sendMessage({
            type: "ABSMARTLY_SIDEBAR_RESIZE",
            mode: "custom",
            width: finalWidth
          })
          .catch?.(() => {})
      } catch {
        // best-effort: drag still updated the DOM directly
      }
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp, { once: true })
  })

  shadowRoot.appendChild(container)
  shadowRoot.appendChild(resizeHandle)

  document.body.appendChild(sidebarContainer)

  reactRoot = createRoot(body)
  reactRoot.render(
    <Suspense fallback={<LoadingContent />}>
      <ExtensionUI />
    </Suspense>
  )

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      sidebarContainer!.style.transform = "translateX(0)"
      sidebarVisible = true
      storage.set("sidebar-visible", true).catch((error) => {
        debugError("Failed to save sidebar visibility state:", error)
      })
    })
  })

  debugLog("🔵 ABSmartly Extension: Sidebar injected with shadow DOM")
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TOGGLE_SIDEBAR") {
    injectSidebar()
    sendResponse({ success: true })
    return true
  }
  if (message.type === "GET_PAGE_CONTEXT") {
    sendResponse({
      url: window.location.href,
      title: document.title,
      visibleText: document.body?.innerText?.slice(0, 8000) || ""
    })
    return true
  }
})

if ((module as any).hot) {
  ;(module as any).hot
    .accept()(module as any)
    .hot.dispose(() => {
      if (reactRoot) {
        reactRoot.unmount()
      }
      if (sidebarContainer && sidebarContainer.parentNode) {
        sidebarContainer.parentNode.removeChild(sidebarContainer)
      }
    })
}

export default async () => {
  debugLog("🔵 ABSmartly Extension: Sidebar content script loaded")

  try {
    const wasSidebarVisible = await storage.get("sidebar-visible")
    if (
      wasSidebarVisible === "true" ||
      (wasSidebarVisible as unknown) === true
    ) {
      debugLog(
        "🔵 ABSmartly Extension: Auto-injecting sidebar (was previously visible)"
      )
      injectSidebar()
    }
  } catch (error) {
    debugError("Failed to check sidebar visibility state:", error)
  }
}
