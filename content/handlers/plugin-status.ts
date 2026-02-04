import { debugLog } from "~src/utils/debug"

let pluginStatusCheckInProgress = false
let pluginStatusCheckQueue: Array<(result: any) => void> = []

export function handleCheckPluginStatus(sendResponse: (response: any) => void) {
  if (pluginStatusCheckInProgress) {
    debugLog(
      "[Content Script] Plugin status check already in progress, queuing request"
    )
    pluginStatusCheckQueue.push(sendResponse)
    return true
  }

  pluginStatusCheckInProgress = true
  debugLog(
    "[Content Script] Forwarding CHECK_PLUGIN_STATUS to page script"
  )

  window.postMessage(
    {
      source: "absmartly-extension",
      type: "CHECK_PLUGIN_STATUS"
    },
    "*"
  )

  const handleResponse = (event: MessageEvent) => {
    if (
      event.data &&
      event.data.source === "absmartly-page" &&
      event.data.type === "PLUGIN_STATUS_RESPONSE"
    ) {
      debugLog(
        "[Content Script] Received plugin status response:",
        event.data.payload
      )
      window.removeEventListener("message", handleResponse)

      const result = event.data.payload

      sendResponse(result)

      pluginStatusCheckQueue.forEach((queuedResponse) =>
        queuedResponse(result)
      )
      pluginStatusCheckQueue = []

      pluginStatusCheckInProgress = false
    }
  }

  window.addEventListener("message", handleResponse)

  setTimeout(() => {
    if (pluginStatusCheckInProgress) {
      window.removeEventListener("message", handleResponse)
      const timeoutResult = { pluginDetected: false, timeout: true }
      sendResponse(timeoutResult)
      pluginStatusCheckQueue.forEach((queuedResponse) =>
        queuedResponse(timeoutResult)
      )
      pluginStatusCheckQueue = []
      pluginStatusCheckInProgress = false
    }
  }, 2000)

  return true
}
