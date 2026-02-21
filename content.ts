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
  run_at: "document_start"
}

debugLog("[ABsmartly] Content script executing - TOP OF FILE")
const w = window as any
w.__absmartlyContentScriptLoaded = true
debugLog(
  "[ABsmartly] Content script marker set:",
  w.__absmartlyContentScriptLoaded
)
debugLog("[Visual Editor Content Script] Content script loaded")

let currentEditor: VisualEditor | null = null
let isVisualEditorActive = false
let isVisualEditorStarting = false

initializeOverrides()
  .then((overrides) => {
    if (Object.keys(overrides).length > 0) {
      debugLog("[Content Script] Initialized experiment overrides:", overrides)
    }
  })
  .catch((error) => {
    debugWarn("[Content Script] Failed to initialize overrides:", error)
  })

setupWindowMessageListener(
  () => ({ isActive: isVisualEditorActive, isStarting: isVisualEditorStarting }),
  (updates) => {
    if (updates.isActive !== undefined) isVisualEditorActive = updates.isActive
    if (updates.isStarting !== undefined) isVisualEditorStarting = updates.isStarting
  }
)

if (!w.__absmartlyMessageListenerRegistered) {
  debugLog("[ABsmartly] Registering chrome.runtime.onMessage listener")
  w.__absmartlyMessageListenerRegistered = true

  const messageListenerRegistered = chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      debugLog("[ABsmartly] Message received:", message?.type)
      debugLog("[Visual Editor Content Script] Received message:", message.type)

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

      if (message.type === "PING") {
        debugLog("[ABsmartly] PING received, sending PONG")
        sendResponse({ success: true, pong: true })
        return true
      }

      if (message.type === "INJECT_SDK_PLUGIN") {
        debugLog("[Content Script] Received INJECT_SDK_PLUGIN message")
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
        return true
      }

      if (message.type === "CAPTURE_HTML") {
        return handleCaptureHTML(sendResponse)
      }

      if (message.type === "GET_HTML_CHUNK") {
        return handleGetHTMLChunk(message.selector, sendResponse)
      }

      if (message.type === "START_ELEMENT_PICKER") {
        return handleStartElementPicker(message.fieldId, sendResponse)
      }

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
        debugLog("[ABsmartly] MESSAGE RECEIVED: START_VISUAL_EDITOR")
        debugLog("[ABsmartly] Message payload:", JSON.stringify(message))
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
            debugLog(
              "[ABsmartly] startVisualEditor completed with result:",
              JSON.stringify(result)
            )
            debugLog(
              "[Visual Editor Content Script] Visual editor start completed:",
              result
            )
            sendResponse(result)
          })
          .catch((error) => {
            debugError("[ABsmartly] startVisualEditor failed:", error)
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

      if (message.type === "ABSMARTLY_PREVIEW") {
        return handlePreviewMessage(message, isVisualEditorActive, isVisualEditorStarting, sendResponse)
      }

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

      return false
    }
  )

  debugLog("[Visual Editor Content Script] Loaded and listening for messages")
} else {
  debugLog(
    "[ABsmartly] chrome.runtime.onMessage listener already registered, skipping"
  )
  debugLog("[Visual Editor Content Script] Message listener already registered")
}

const debugDiv = document.createElement("div")
debugDiv.id = "absmartly-debug-content-loaded"
debugDiv.style.display = "none"
debugDiv.textContent =
  "ABSmartly Content Script Loaded at " + new Date().toISOString()
document.documentElement.appendChild(debugDiv)

;(window as any).__absmartlyContentLoaded = true

window.postMessage(
  { type: "ABSMARTLY_CONTENT_READY", timestamp: Date.now() },
  window.location.origin
)

window.addEventListener("message", (event) => {
  const sidebarIframe = document.getElementById(
    "absmartly-sidebar-iframe"
  ) as HTMLIFrameElement

  if (
    event.source !== window &&
    (!sidebarIframe || event.source !== sidebarIframe.contentWindow)
  ) {
    return
  }

  if (event.data.source === "absmartly-tests") {
    if (event.data.type === "TEST_OPEN_SIDEBAR") {
      debugLog("[Content Script] Received TEST_OPEN_SIDEBAR from tests")
      window.postMessage(
        {
          source: "absmartly-extension",
          type: "TEST_SIDEBAR_RESULT",
          success: true,
          message: "Sidebar open message received"
        },
        window.location.origin
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
        window.location.origin
      )
      return
    }

    if (event.data.type === "TEST_START_VISUAL_EDITOR") {
      debugLog("[Content Script] Received TEST_START_VISUAL_EDITOR from tests")
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
          window.location.origin
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
        window.location.origin
      )
      return
    }
  }

  if (event.data.type === "ABSMARTLY_VISUAL_EDITOR_EXIT") {
    debugLog(
      "[Visual Editor Content Script] Received EXIT message from visual editor"
    )

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

      chrome.runtime.sendMessage({
        type: "VISUAL_EDITOR_STOPPED",
        changes: changes
      })

      if (experimentName && variantName) {
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

ensureSDKPluginInjected().catch((err) => {
  debugError("[Content Script] Failed to auto-inject SDK bridge:", err)
})
