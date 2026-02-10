import { debugLog } from "~src/utils/debug"

let pluginStatusCheckInProgress = false
let pluginStatusCheckQueue: Array<(result: any) => void> = []
let lastPluginStatusResult: any | null = null
let lastPluginStatusAt = 0
const PLUGIN_STATUS_CACHE_MS = 2000

export function handleCheckPluginStatus(sendResponse: (response: any) => void) {
  const now = Date.now()
  if (lastPluginStatusResult && now - lastPluginStatusAt < PLUGIN_STATUS_CACHE_MS) {
    sendResponse(lastPluginStatusResult)
    return true
  }

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
      lastPluginStatusResult = result
      lastPluginStatusAt = Date.now()
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
      lastPluginStatusResult = errorResult
      lastPluginStatusAt = Date.now()
      sendResponse(errorResult)
      pluginStatusCheckQueue.forEach((queuedResponse) =>
        queuedResponse(errorResult)
      )
      pluginStatusCheckQueue = []
      pluginStatusCheckInProgress = false
    })

  return true
}
