/**
 * Relay helper for preview diagnostic messages.
 *
 * The page-side SDK bridge posts three message types that must fan out
 * to any listening extension contexts (sidebar, devtools panels):
 *
 *   - `PREVIEW_JS_ERROR`    (JavaScript execution failed; CSP or runtime)
 *   - `PREVIEW_CSP_PROBE`   (host page blocks dynamic code execution)
 *   - `PREVIEW_JS_PENDING`  (selector not in DOM yet, change queued)
 *
 * This helper re-broadcasts them with a `_BROADCAST` suffix so receivers
 * can tell an originating message from a relayed one, mirroring the
 * existing `SDK_EVENT` / `SDK_EVENT_BROADCAST` convention.
 */

import { debugError } from "~src/utils/debug"

export const PREVIEW_DIAGNOSTIC_TYPES = new Set<string>([
  "PREVIEW_JS_ERROR",
  "PREVIEW_CSP_PROBE",
  "PREVIEW_JS_PENDING"
])

export function isPreviewDiagnosticMessage(type: unknown): type is string {
  return typeof type === "string" && PREVIEW_DIAGNOSTIC_TYPES.has(type)
}

export function broadcastPreviewDiagnostic(message: {
  type: string
  payload: unknown
}): void {
  chrome.runtime
    .sendMessage({
      type: `${message.type}_BROADCAST`,
      payload: message.payload
    })
    .catch((error: unknown) => {
      const errMsg = (error as { message?: string })?.message ?? ""
      if (
        !errMsg.includes("Receiving end does not exist") &&
        !errMsg.includes("message port closed")
      ) {
        debugError(
          `[Background] Unexpected error broadcasting ${message.type}:`,
          error
        )
      }
    })
}
