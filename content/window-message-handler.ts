import { debugLog, debugError } from "~src/utils/debug"
import { createPreviewHeader } from "./preview-header"

export function setupWindowMessageListener(
  getVisualEditorState: () => { isActive: boolean; isStarting: boolean },
  setVisualEditorState: (updates: { isActive?: boolean; isStarting?: boolean }) => void
) {
  window.addEventListener("message", async (event) => {
    const isFileProtocol =
      window.location.protocol === "file:" || event.origin === "null"
    if (!isFileProtocol && event.origin !== window.location.origin) {
      debugLog('[Security] Message rejected from origin:', {
        receivedOrigin: event.origin,
        expectedOrigin: window.location.origin,
        messageType: event.data?.type,
        source: event.data?.source
      })
      return
    }

    if (
      event.data &&
      event.data.source === "absmartly-visual-editor" &&
      event.data.type === "VISUAL_EDITOR_CLOSED"
    ) {
      debugLog("[Content Script] Visual editor closed, updating state")
      setVisualEditorState({ isActive: false, isStarting: false })

      if (event.data.experimentName && event.data.variantName) {
        debugLog(
          "[Content Script] Creating preview header after visual editor close"
        )
        const { isActive, isStarting } = getVisualEditorState()
        createPreviewHeader(event.data.experimentName, event.data.variantName, isActive, isStarting)
      }
      return
    }

    if (event.data && event.data.source === "absmartly-page") {
      debugLog("[Content Script] Received message from page:", event.data)

      if (event.data.type === "SDK_EVENT") {
        chrome.runtime
          .sendMessage({
            type: "SDK_EVENT",
            payload: event.data.payload
          })
          .catch((err) => {
            debugError(
              "[Content Script] Failed to send SDK_EVENT to background:",
              err
            )
          })
      } else if (
        event.data.type === "REQUEST_CUSTOM_CODE" ||
        event.data.type === "SDK_CONTEXT_READY"
      ) {
        const response = await chrome.runtime.sendMessage({
          type: "REQUEST_INJECTION_CODE",
          source: "content-script"
        })

        const config = response?.config || null

        window.postMessage(
          {
            source: "absmartly-extension",
            type: "INITIALIZE_PLUGIN",
            payload: { config }
          },
          window.location.origin
        )
      } else if (event.data.type === "REQUEST_SDK_INJECTION_CONFIG") {
        const response = await chrome.runtime.sendMessage({
          type: "REQUEST_INJECTION_CODE",
          source: "content-script"
        })

        const config = response?.config || null

        window.postMessage(
          {
            source: "absmartly-extension",
            type: "SDK_INJECTION_CONFIG",
            payload: { config }
          },
          window.location.origin
        )
      } else if (event.data.type === "PLUGIN_INITIALIZED") {
        chrome.runtime.sendMessage({
          type: "PLUGIN_INITIALIZED",
          source: "content-script"
        })
      }
    }
  })
}
