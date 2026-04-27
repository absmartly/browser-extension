import { useCallback, useEffect, useState } from "react"

import { debugLog } from "~src/utils/debug"

export type JsDiagnosticReason = "csp" | "runtime" | "pending"

export interface JsChangeDiagnostic {
  reason: JsDiagnosticReason
  message: string
  timestamp: string
}

export interface JsPagePspWarning {
  evalAllowed: boolean
  inlineAllowed: boolean
  jsBlocked: boolean
  evalError?: string
  inlineError?: string
  timestamp: string
}

export interface UseJsPreviewDiagnosticsResult {
  pageWarning: JsPagePspWarning | null
  changeDiagnostics: Record<string, JsChangeDiagnostic>
  clear: () => void
  getChangeKey: (experimentName: string | undefined, selector: string) => string
}

const changeKey = (
  experimentName: string | undefined,
  selector: string
): string => `${experimentName || "__preview__"}::${selector}`

export function useJsPreviewDiagnostics(): UseJsPreviewDiagnosticsResult {
  const [pageWarning, setPageWarning] = useState<JsPagePspWarning | null>(null)
  const [changeDiagnostics, setChangeDiagnostics] = useState<
    Record<string, JsChangeDiagnostic>
  >({})

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
      return
    }

    const runtimeOnMessage = chrome.runtime.onMessage

    const listener = (message: unknown): void => {
      if (!message || typeof message !== "object") return
      const { type, payload } = message as { type?: string; payload?: any }
      if (!type || !payload) return

      switch (type) {
        case "PREVIEW_CSP_PROBE_BROADCAST": {
          debugLog("[useJsPreviewDiagnostics] CSP probe result:", payload)
          setPageWarning({
            evalAllowed: !!payload.evalAllowed,
            inlineAllowed: !!payload.inlineAllowed,
            jsBlocked: !!payload.jsBlocked,
            evalError: payload.evalError,
            inlineError: payload.inlineError,
            timestamp: payload.timestamp || new Date().toISOString()
          })
          break
        }
        case "PREVIEW_JS_ERROR_BROADCAST": {
          debugLog("[useJsPreviewDiagnostics] JS error:", payload)
          const key = changeKey(payload.experimentName, payload.selector)
          setChangeDiagnostics((prev) => ({
            ...prev,
            [key]: {
              reason: payload.reason === "runtime" ? "runtime" : "csp",
              message: String(payload.error || "JavaScript execution failed"),
              timestamp: payload.timestamp || new Date().toISOString()
            }
          }))
          break
        }
        case "PREVIEW_JS_PENDING_BROADCAST": {
          debugLog("[useJsPreviewDiagnostics] JS pending:", payload)
          const key = changeKey(payload.experimentName, payload.selector)
          setChangeDiagnostics((prev) => {
            if (prev[key] && prev[key].reason !== "pending") {
              return prev
            }
            return {
              ...prev,
              [key]: {
                reason: "pending",
                message: "Waiting for selector to appear on the page",
                timestamp: payload.timestamp || new Date().toISOString()
              }
            }
          })
          break
        }
        default:
          break
      }
    }

    runtimeOnMessage.addListener(listener)
    return () => {
      try {
        runtimeOnMessage.removeListener(listener)
      } catch {
        // chrome runtime may have been torn down (test environment, tab close)
      }
    }
  }, [])

  const clear = useCallback(() => {
    setPageWarning(null)
    setChangeDiagnostics({})
  }, [])

  return {
    pageWarning,
    changeDiagnostics,
    clear,
    getChangeKey: changeKey
  }
}
