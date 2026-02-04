import type { PlasmoCSConfig } from "plasmo"
import type { DOMChange } from "~src/types/dom-changes"
import { debugError, debugLog, debugWarn } from "~src/utils/debug"
import { initializeOverrides } from "~src/utils/overrides"
import { VisualEditor } from "~src/visual-editor"
import { createPreviewHeader, removePreviewHeader } from "~content/preview-header"
import { ensureSDKPluginInjected } from "~content/sdk-bridge"
import { startVisualEditor } from "~content/visual-editor-manager"
import {
  openCodeEditor,
  closeCodeEditor,
  openJSONEditor,
  closeJSONEditor,
  openEventViewer,
  closeEventViewer,
  openMarkdownEditor,
  closeMarkdownEditor,
  openJavaScriptEditor,
  closeJavaScriptEditor
} from "~content/editors"
import { handleCaptureHTML, handleGetHTMLChunk } from "~content/handlers/html-capture"
import { handleStartElementPicker, handleCancelElementPicker } from "~content/handlers/element-picker"
import { handleCheckPluginStatus } from "~content/handlers/plugin-status"
import { handlePreviewMessage } from "~content/handlers/preview"
import { setupWindowMessageListener } from "~content/window-message-handler"
import { validateMessage } from "~src/lib/message-security"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
  run_at: "document_start" // Run as early as possible to intercept SDK before it initializes
}

// Mark that content script has loaded (for debugging)
console.log("[ABsmartly] Content script executing - TOP OF FILE")
const w = window as any
w.__absmartlyContentScriptLoaded = true
console.log(
  "[ABsmartly] Content script marker set:",
  w.__absmartlyContentScriptLoaded
)
debugLog("[Visual Editor Content Script] Content script loaded")

// Runtime messaging relies solely on chrome.runtime APIs in extension context

// Keep track of the current visual editor instance
let currentEditor: VisualEditor | null = null
let isVisualEditorActive = false
let isVisualEditorStarting = false

// Initialize overrides on page load
// This ensures storage is synced to cookie for SSR compatibility
initializeOverrides()
  .then((overrides) => {
    if (Object.keys(overrides).length > 0) {
      debugLog("[Content Script] Initialized experiment overrides:", overrides)
    }
  })
  .catch((error) => {
    debugWarn("[Content Script] Failed to initialize overrides:", error)
  })

// Setup window message listener for SDK communication
setupWindowMessageListener(
  () => ({ isActive: isVisualEditorActive, isStarting: isVisualEditorStarting }),
  (updates) => {
    if (updates.isActive !== undefined) isVisualEditorActive = updates.isActive
    if (updates.isStarting !== undefined) isVisualEditorStarting = updates.isStarting
  }
)

// Listen for messages from the background script
// Prevent multiple listener registrations (can happen during hot reload)
if (!w.__absmartlyMessageListenerRegistered) {
  console.log("[ABsmartly] Registering chrome.runtime.onMessage listener")
  w.__absmartlyMessageListenerRegistered = true

  const messageListenerRegistered = chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      console.log("[ABsmartly] Message received:", message?.type)
      debugLog("[Visual Editor Content Script] Received message:", message.type)

      // Validate message security
      const validation = validateMessage(message, sender, {
        requireExtensionOrigin: true,
        requireMainFrame: false
      })

      if (!validation.valid) {
        if (validation.securityViolation) {
          debugError('[Content Script] Security violation:', validation.error)
        }
        sendResponse({ success: false, error: validation.error })
        return true
      }

      // Handle PING message (content script health check)
      if (message.type === "PING") {
        console.log("[ABsmartly] PING received, sending PONG")
        sendResponse({ success: true, pong: true })
        return true
      }

      // Handle SDK plugin injection request
      if (message.type === "INJECT_SDK_PLUGIN") {
        console.log("[Content Script] 📌 Received INJECT_SDK_PLUGIN message")
        debugLog(
          "[Visual Editor Content Script] Injecting SDK plugin on demand"
        )
        ensureSDKPluginInjected()
          .then(() => {
            sendResponse({ success: true })
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message })
          })
        return true // Keep message channel open for async response
      }

      // Handle HTML capture request
      if (message.type === "CAPTURE_HTML") {
        return handleCaptureHTML(sendResponse)
      }

      // Handle HTML chunk request (for API providers' agentic loop)
      if (message.type === "GET_HTML_CHUNK") {
        return handleGetHTMLChunk(message.selector, sendResponse)
      }

      // Handle element picker message
      if (message.type === "START_ELEMENT_PICKER") {
        return handleStartElementPicker(message.fieldId, sendResponse)
      }

      // Handle cancel element picker message
      if (message.type === "CANCEL_ELEMENT_PICKER") {
        return handleCancelElementPicker(sendResponse)
      }

      if (message.type === "CHECK_PLUGIN_STATUS") {
        return handleCheckPluginStatus(sendResponse)
      }

      if (message.type === "CHECK_VISUAL_EDITOR_ACTIVE") {
        const isActive = isVisualEditorActive || isVisualEditorStarting
        debugLog("[Visual Editor Content Script] CHECK_VISUAL_EDITOR_ACTIVE:", {
          isVisualEditorActive,
          isVisualEditorStarting,
          result: isActive
        })
        sendResponse(isActive)
        return true
      }

      if (message.type === "SET_VISUAL_EDITOR_STARTING") {
        debugLog(
          "[Visual Editor Content Script] Setting visual editor starting flag:",
          message.starting
        )
        isVisualEditorStarting = message.starting
        sendResponse({ success: true })
        return true
      }

      if (message.type === "START_VISUAL_EDITOR") {
        console.log("[ABsmartly] ✅ MESSAGE RECEIVED: START_VISUAL_EDITOR")
        console.log("[ABsmartly] Message payload:", JSON.stringify(message))
        debugLog(
          "[Visual Editor Content Script] START_VISUAL_EDITOR received:",
          {
            variantName: message.variantName,
            experimentName: message.experimentName,
            changesCount: message.changes?.length || 0
          }
        )

        if (currentEditor) {
          currentEditor.destroy()
          currentEditor = null
        }

        startVisualEditor(
          {
            variantName: message.variantName,
            experimentName: message.experimentName,
            changes: message.changes,
            useShadowDOM: message.useShadowDOM
          },
          (active) => { isVisualEditorActive = active },
          (starting) => { isVisualEditorStarting = starting }
        )
          .then((result) => {
            if (result.editor) {
              currentEditor = result.editor
            }
            console.log(
              "[ABsmartly] ✅ startVisualEditor completed with result:",
              JSON.stringify(result)
            )
            debugLog(
              "[Visual Editor Content Script] Visual editor start completed:",
              result
            )
            sendResponse(result)
          })
          .catch((error) => {
            console.error("[ABsmartly] ❌ startVisualEditor failed:", error)
            debugError(
              "[Visual Editor Content Script] Error in startVisualEditor:",
              error
            )
            sendResponse({ success: false, error: error.message })
          })

        return true
      }

      if (message.type === "STOP_VISUAL_EDITOR") {
        debugLog("[Visual Editor Content Script] Stopping visual editor")

        isVisualEditorActive = false
        isVisualEditorStarting = false

        if (currentEditor) {
          const changes = currentEditor.getChanges()
          currentEditor.destroy()
          currentEditor = null
          sendResponse({ success: true, changes })
        } else {
          sendResponse({ success: true, changes: [] })
        }

        return true
      }

      if (message.type === "GET_VISUAL_EDITOR_STATUS") {
        sendResponse({
          active: isVisualEditorActive,
          changes: currentEditor?.getChanges() || []
        })
        return true
      }

      // Visual editor preview messages aren't sent through chrome.tabs.sendMessage
      // They're sent via chrome.runtime.sendMessage and need to be handled differently

      // Handle preview messages
      if (message.type === "ABSMARTLY_PREVIEW") {
        return handlePreviewMessage(message, isVisualEditorActive, isVisualEditorStarting, sendResponse)
      }

      // Code editor messages
      if (message.type === "OPEN_CODE_EDITOR") {
        openCodeEditor(message.data)
        sendResponse({ success: true })
        return true
      }

      if (message.type === "CLOSE_CODE_EDITOR") {
        closeCodeEditor()
        sendResponse({ success: true })
        return true
      }

      // JSON editor messages
      if (message.type === "OPEN_JSON_EDITOR") {
        openJSONEditor(message.data, isVisualEditorActive, currentEditor)
        sendResponse({ success: true })
        return true
      }

      if (message.type === "CLOSE_JSON_EDITOR") {
        closeJSONEditor()
        sendResponse({ success: true })
        return true
      }

      // Markdown editor messages
      if (message.type === "OPEN_MARKDOWN_EDITOR") {
        openMarkdownEditor(message.data, isVisualEditorActive, currentEditor)
        sendResponse({ success: true })
        return true
      }

      if (message.type === "CLOSE_MARKDOWN_EDITOR") {
        closeMarkdownEditor()
        sendResponse({ success: true })
        return true
      }

      // JavaScript Editor messages
      if (message.type === "OPEN_JAVASCRIPT_EDITOR") {
        openJavaScriptEditor(message.data, isVisualEditorActive, currentEditor)
        sendResponse({ success: true })
        return true
      }

      if (message.type === "CLOSE_JAVASCRIPT_EDITOR") {
        closeJavaScriptEditor()
        sendResponse({ success: true })
        return true
      }

      // Event viewer messages
      if (message.type === "OPEN_EVENT_VIEWER") {
        openEventViewer(message.data)
        sendResponse({ success: true })
        return true
      }

      if (message.type === "CLOSE_EVENT_VIEWER") {
        closeEventViewer()
        sendResponse({ success: true })
        return true
      }

      // Return false for messages we don't handle to keep channel open for other listeners
      return false
    }
  )

  debugLog("[Visual Editor Content Script] Loaded and listening for messages")
} else {
  console.log(
    "[ABsmartly] chrome.runtime.onMessage listener already registered, skipping"
  )
  debugLog("[Visual Editor Content Script] Message listener already registered")
}

// Also log to the page directly to ensure we can see it
const debugDiv = document.createElement("div")
debugDiv.id = "absmartly-debug-content-loaded"
debugDiv.style.display = "none"
debugDiv.textContent =
  "ABSmartly Content Script Loaded at " + new Date().toISOString()
document.documentElement.appendChild(debugDiv)

// Expose a global function for testing (content script context only)
;(window as any).__absmartlyContentLoaded = true

// Send a message to the page to confirm we're loaded (CSP-safe communication)
// Tests can listen for this message instead of checking a global variable
window.postMessage(
  { type: "ABSMARTLY_CONTENT_READY", timestamp: Date.now() },
  "*"
)

// Listen for messages from the visual editor and test messages
window.addEventListener("message", (event) => {
  // Get sidebar iframe reference
  const sidebarIframe = document.getElementById(
    "absmartly-sidebar-iframe"
  ) as HTMLIFrameElement

  // Only handle messages from:
  // 1. The same window (visual editor, tests)
  // 2. The sidebar iframe (when in test mode)
  if (
    event.source !== window &&
    (!sidebarIframe || event.source !== sidebarIframe.contentWindow)
  ) {
    return
  }

  // Handle test messages for programmatic sidebar control
  if (event.data.source === "absmartly-tests") {
    if (event.data.type === "TEST_OPEN_SIDEBAR") {
      debugLog("[Content Script] Received TEST_OPEN_SIDEBAR from tests")
      // Simulate opening the sidebar - in reality, this would be triggered by the extension
      // For tests, we just confirm the message was received
      window.postMessage(
        {
          source: "absmartly-extension",
          type: "TEST_SIDEBAR_RESULT",
          success: true,
          message: "Sidebar open message received"
        },
        "*"
      )
      return
    }

    if (event.data.type === "TEST_CLOSE_SIDEBAR") {
      debugLog("[Content Script] Received TEST_CLOSE_SIDEBAR from tests")
      window.postMessage(
        {
          source: "absmartly-extension",
          type: "TEST_SIDEBAR_RESULT",
          success: true,
          message: "Sidebar close message received"
        },
        "*"
      )
      return
    }

    if (event.data.type === "TEST_START_VISUAL_EDITOR") {
      debugLog("[Content Script] Received TEST_START_VISUAL_EDITOR from tests")
      // Use shared start function directly
      startVisualEditor(
        {
          variantName: event.data.variantName || "test-variant",
          experimentName: event.data.experimentName,
          changes: event.data.changes || []
        },
        (active) => { isVisualEditorActive = active },
        (starting) => { isVisualEditorStarting = starting }
      ).then((result) => {
        if (result.editor) {
          currentEditor = result.editor
        }
        window.postMessage(
          {
            source: "absmartly-extension",
            type: "TEST_SIDEBAR_RESULT",
            success: result.success,
            message: result.success
              ? "Visual editor started"
              : `Failed: ${result.error}`
          },
          "*"
        )
      })
      return
    }

    if (event.data.type === "TEST_STATUS") {
      debugLog("[Content Script] Received TEST_STATUS from tests")
      window.postMessage(
        {
          source: "absmartly-extension",
          type: "TEST_SIDEBAR_RESULT",
          success: true,
          active: isVisualEditorActive,
          changes: currentEditor?.getChanges() || []
        },
        "*"
      )
      return
    }
  }

  if (event.data.type === "ABSMARTLY_VISUAL_EDITOR_EXIT") {
    debugLog(
      "[Visual Editor Content Script] Received EXIT message from visual editor"
    )

    // Stop the visual editor
    if (currentEditor) {
      const changes = currentEditor.getChanges()
      const experimentName = currentEditor.experimentName
      const variantName = currentEditor.variantName

      currentEditor.destroy()
      currentEditor = null
      isVisualEditorActive = false
      isVisualEditorStarting = false
      debugLog(
        `[Content Script] VE exited. Flags now: isActive=${isVisualEditorActive}, isStarting=${isVisualEditorStarting}`
      )

      // Send message to extension that visual editor was stopped
      chrome.runtime.sendMessage({
        type: "VISUAL_EDITOR_STOPPED",
        changes: changes
      })

      // Restore the preview header since preview is still active
      // Store VE changes for restoration when preview is toggled
      // Note: VE changes include physically removed elements (delete operations),
      // so we need to track them separately for restoration
      if (experimentName && variantName) {
        // Store VE changes globally for preview toggle handling
        ;(window as any).__absmartlyVEChanges = {
          experimentName,
          changes
        }
        debugLog("[Content Script] Stored VE changes for preview toggle", {
          experimentName,
          changeCount: changes.length
        })

        createPreviewHeader(experimentName, variantName, isVisualEditorActive, isVisualEditorStarting)
      }
    }
  }
})



// Listen for messages from the injected script and SDK plugin

// Also listen for test events
document.addEventListener("absmartly-test", (event: any) => {
  debugLog("[Visual Editor Content Script] Received test event:", event.detail)
  document.dispatchEvent(
    new CustomEvent("absmartly-response", {
      detail: {
        message: "Content script received your message",
        originalMessage: event.detail
      }
    })
  )
})


// Automatically inject SDK bridge on page load to capture SDK events passively
// This allows the Events Debug page to receive events without needing to be opened first
ensureSDKPluginInjected().catch((err) => {
  debugError("[Content Script] Failed to auto-inject SDK bridge:", err)
})
