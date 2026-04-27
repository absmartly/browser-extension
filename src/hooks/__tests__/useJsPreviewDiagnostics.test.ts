import { act, renderHook } from "@testing-library/react"

import { useJsPreviewDiagnostics } from "../useJsPreviewDiagnostics"

jest.mock("~src/utils/debug", () => ({
  debugLog: jest.fn(),
  debugError: jest.fn()
}))

type Listener = (message: unknown) => void

interface ChromeRuntimeMock {
  onMessage: {
    addListener: jest.Mock
    removeListener: jest.Mock
    listeners: Listener[]
  }
}

describe("useJsPreviewDiagnostics", () => {
  let chromeMock: { runtime: ChromeRuntimeMock }

  const installChrome = () => {
    const listeners: Listener[] = []
    chromeMock = {
      runtime: {
        onMessage: {
          listeners,
          addListener: jest.fn((fn: Listener) => {
            listeners.push(fn)
          }),
          removeListener: jest.fn((fn: Listener) => {
            const idx = listeners.indexOf(fn)
            if (idx >= 0) listeners.splice(idx, 1)
          })
        }
      }
    }
    ;(global as any).chrome = chromeMock
  }

  const emit = (message: unknown) => {
    for (const listener of chromeMock.runtime.onMessage.listeners) {
      listener(message)
    }
  }

  beforeEach(() => {
    installChrome()
  })

  afterEach(() => {
    delete (global as any).chrome
  })

  it("starts with no warnings and no change diagnostics", () => {
    const { result } = renderHook(() => useJsPreviewDiagnostics())

    expect(result.current.pageWarning).toBeNull()
    expect(result.current.changeDiagnostics).toEqual({})
  })

  it("stores a page warning when CSP probe reports eval blocked", () => {
    const { result } = renderHook(() => useJsPreviewDiagnostics())

    act(() => {
      emit({
        type: "PREVIEW_CSP_PROBE_BROADCAST",
        payload: {
          evalAllowed: false,
          inlineAllowed: false,
          jsBlocked: true,
          evalError: "Refused to evaluate",
          inlineError: "inline <script> blocked",
          timestamp: "2026-04-21T00:00:00Z"
        }
      })
    })

    expect(result.current.pageWarning).toEqual({
      evalAllowed: false,
      inlineAllowed: false,
      jsBlocked: true,
      evalError: "Refused to evaluate",
      inlineError: "inline <script> blocked",
      timestamp: "2026-04-21T00:00:00Z"
    })
  })

  it("records a per-change CSP diagnostic keyed by experiment + selector", () => {
    const { result } = renderHook(() => useJsPreviewDiagnostics())

    act(() => {
      emit({
        type: "PREVIEW_JS_ERROR_BROADCAST",
        payload: {
          experimentName: "exp_1",
          selector: ".hero",
          reason: "csp",
          error: "Refused to evaluate",
          timestamp: "2026-04-21T00:00:01Z"
        }
      })
    })

    const key = result.current.getChangeKey("exp_1", ".hero")
    expect(result.current.changeDiagnostics[key]).toEqual({
      reason: "csp",
      message: "Refused to evaluate",
      timestamp: "2026-04-21T00:00:01Z"
    })
  })

  it("records runtime errors separately from CSP failures", () => {
    const { result } = renderHook(() => useJsPreviewDiagnostics())

    act(() => {
      emit({
        type: "PREVIEW_JS_ERROR_BROADCAST",
        payload: {
          experimentName: "exp_1",
          selector: ".hero",
          reason: "runtime",
          error: "TypeError: x is not a function",
          timestamp: "2026-04-21T00:00:02Z"
        }
      })
    })

    const key = result.current.getChangeKey("exp_1", ".hero")
    expect(result.current.changeDiagnostics[key].reason).toBe("runtime")
    expect(result.current.changeDiagnostics[key].message).toContain("TypeError")
  })

  it("pending diagnostics do not overwrite an existing csp/runtime error", () => {
    const { result } = renderHook(() => useJsPreviewDiagnostics())
    const key = result.current.getChangeKey("exp_1", ".hero")

    act(() => {
      emit({
        type: "PREVIEW_JS_ERROR_BROADCAST",
        payload: {
          experimentName: "exp_1",
          selector: ".hero",
          reason: "csp",
          error: "Blocked",
          timestamp: "2026-04-21T00:00:00Z"
        }
      })
    })
    expect(result.current.changeDiagnostics[key].reason).toBe("csp")

    act(() => {
      emit({
        type: "PREVIEW_JS_PENDING_BROADCAST",
        payload: {
          experimentName: "exp_1",
          selector: ".hero",
          timestamp: "2026-04-21T00:00:01Z"
        }
      })
    })

    expect(result.current.changeDiagnostics[key].reason).toBe("csp")
  })

  it("a pending diagnostic is promoted to an error if one arrives later", () => {
    const { result } = renderHook(() => useJsPreviewDiagnostics())
    const key = result.current.getChangeKey("exp_1", ".hero")

    act(() => {
      emit({
        type: "PREVIEW_JS_PENDING_BROADCAST",
        payload: {
          experimentName: "exp_1",
          selector: ".hero",
          timestamp: "2026-04-21T00:00:00Z"
        }
      })
    })
    expect(result.current.changeDiagnostics[key].reason).toBe("pending")

    act(() => {
      emit({
        type: "PREVIEW_JS_ERROR_BROADCAST",
        payload: {
          experimentName: "exp_1",
          selector: ".hero",
          reason: "csp",
          error: "Blocked",
          timestamp: "2026-04-21T00:00:01Z"
        }
      })
    })

    expect(result.current.changeDiagnostics[key].reason).toBe("csp")
  })

  it("clear() resets both page warning and per-change diagnostics", () => {
    const { result } = renderHook(() => useJsPreviewDiagnostics())

    act(() => {
      emit({
        type: "PREVIEW_CSP_PROBE_BROADCAST",
        payload: {
          evalAllowed: false,
          inlineAllowed: false,
          jsBlocked: true,
          timestamp: "t"
        }
      })
      emit({
        type: "PREVIEW_JS_ERROR_BROADCAST",
        payload: {
          experimentName: "exp_1",
          selector: ".x",
          reason: "csp",
          error: "e",
          timestamp: "t"
        }
      })
    })

    expect(result.current.pageWarning).not.toBeNull()
    expect(Object.keys(result.current.changeDiagnostics)).toHaveLength(1)

    act(() => {
      result.current.clear()
    })

    expect(result.current.pageWarning).toBeNull()
    expect(result.current.changeDiagnostics).toEqual({})
  })

  it("removes the chrome.runtime listener on unmount", () => {
    const { unmount } = renderHook(() => useJsPreviewDiagnostics())

    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledTimes(1)
    unmount()
    expect(chromeMock.runtime.onMessage.removeListener).toHaveBeenCalledTimes(1)
  })
})
