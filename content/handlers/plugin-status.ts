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
    "[Content Script] Checking plugin status via background (MAIN world)"
  )

  const timeoutId = setTimeout(() => {
    if (pluginStatusCheckInProgress) {
      const timeoutResult = { pluginDetected: false, timeout: true }
      sendResponse(timeoutResult)
      pluginStatusCheckQueue.forEach((queuedResponse) =>
        queuedResponse(timeoutResult)
      )
      pluginStatusCheckQueue = []
      pluginStatusCheckInProgress = false
    }
  }, 2000)

  chrome.runtime
    .sendMessage({ type: "CHECK_PLUGIN_STATUS_MAIN" })
    .then((result) => {
      if (!pluginStatusCheckInProgress) return
      clearTimeout(timeoutId)
      sendResponse(result)
      pluginStatusCheckQueue.forEach((queuedResponse) =>
        queuedResponse(result)
      )
      pluginStatusCheckQueue = []
      pluginStatusCheckInProgress = false
    })
    .catch((error) => {
      if (!pluginStatusCheckInProgress) return
      clearTimeout(timeoutId)
      const errorResult = { pluginDetected: false, error: error?.message || String(error) }
      sendResponse(errorResult)
      pluginStatusCheckQueue.forEach((queuedResponse) =>
        queuedResponse(errorResult)
      )
      pluginStatusCheckQueue = []
      pluginStatusCheckInProgress = false
    })

  return true
}
