export function handleCaptureHTML(sendResponse: (response: any) => void) {
  console.log("[ABsmartly] Capture HTML request received")
  try {
    const html = document.documentElement.outerHTML
    console.log("[ABsmartly] HTML captured, length:", html.length)
    sendResponse({ success: true, html })
  } catch (error) {
    console.error("[ABsmartly] Capture error:", error)
    sendResponse({ success: false, error: (error as Error).message })
  }
  return true
}

export function handleGetHTMLChunk(
  selector: string,
  sendResponse: (response: any) => void
) {
  console.log("[ABsmartly] HTML chunk request for selector:", selector)
  try {
    if (!selector) {
      sendResponse({
        success: false,
        found: false,
        error: "Selector is required"
      })
      return true
    }

    const element = document.querySelector(selector)
    if (!element) {
      console.log("[ABsmartly] Element not found for selector:", selector)
      sendResponse({
        success: true,
        found: false,
        html: "",
        error: `Element not found: ${selector}`
      })
      return true
    }

    const html = element.outerHTML
    console.log("[ABsmartly] HTML chunk captured, length:", html.length)
    sendResponse({ success: true, found: true, html })
  } catch (error) {
    console.error("[ABsmartly] HTML chunk error:", error)
    sendResponse({
      success: false,
      found: false,
      error: (error as Error).message
    })
  }
  return true
}
