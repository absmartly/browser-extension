export interface CaptureResult {
  ok: boolean
  dataUrl?: string
  error?: string
}

export async function captureVisibleTab(): Promise<string> {
  const result: CaptureResult = await chrome.runtime.sendMessage({
    type: "ABSMARTLY_CAPTURE_VISIBLE_TAB"
  })
  if (!result?.ok || !result.dataUrl) {
    throw new Error(result?.error || "Failed to capture visible tab")
  }
  return result.dataUrl
}
