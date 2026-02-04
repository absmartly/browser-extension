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

export async function ensureSDKPluginInjected() {
  if (!sdkBridgeInjected && !sdkBridgeInjecting) {
    console.log("[Content Script] 🚀 Injecting SDK bridge...")
    sdkBridgeInjecting = true
    try {
      await injectSDKBridgeScript()
      sdkBridgeInjected = true
      console.log("[Content Script] ✅ SDK bridge injected successfully")
    } catch (error) {
      console.error("[Content Script] ❌ Failed to inject SDK bridge:", error)
    } finally {
      sdkBridgeInjecting = false
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  } else if (sdkBridgeInjecting) {
    console.log(
      "[Content Script] ⏳ SDK bridge injection already in progress, waiting..."
    )
    while (sdkBridgeInjecting) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
}
