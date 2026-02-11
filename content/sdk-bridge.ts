import { debugLog, debugError } from "~src/utils/debug"

let sdkBridgeInjected = false
let sdkBridgeInjecting = false

async function injectSDKBridgeScript(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const script = document.createElement("script")
      script.src = chrome.runtime.getURL("absmartly-sdk-bridge.bundle.js")
      script.onload = () => {
        debugLog("[Content Script] SDK bridge bundle loaded")
        script.remove()
        resolve()
      }
      script.onerror = () => {
        debugError("[Content Script] Failed to load SDK bridge bundle")
        reject(new Error("Failed to load SDK bridge bundle"))
      }
      document.documentElement.appendChild(script)
    } catch (error) {
      debugError("[Content Script] Error loading SDK bridge bundle:", error)
      reject(error)
    }
  })
}

export async function ensureSDKPluginInjected(): Promise<boolean> {
  if (!sdkBridgeInjected && !sdkBridgeInjecting) {
    debugLog("[Content Script] Injecting SDK bridge...")
    sdkBridgeInjecting = true
    try {
      await injectSDKBridgeScript()
      sdkBridgeInjected = true
      debugLog("[Content Script] SDK bridge injected successfully")
      await new Promise((resolve) => setTimeout(resolve, 50))
    } catch (error) {
      debugError("[Content Script] Failed to inject SDK bridge:", error)
      return false
    } finally {
      sdkBridgeInjecting = false
    }
  } else if (sdkBridgeInjecting) {
    debugLog("[Content Script] SDK bridge injection already in progress, waiting...")
    const deadline = Date.now() + 5000
    while (sdkBridgeInjecting) {
      if (Date.now() > deadline) {
        debugError("[Content Script] SDK bridge injection timed out after 5s")
        return false
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
  return sdkBridgeInjected
}
