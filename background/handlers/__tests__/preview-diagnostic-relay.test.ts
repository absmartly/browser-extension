import {
  PREVIEW_DIAGNOSTIC_TYPES,
  broadcastPreviewDiagnostic,
  isPreviewDiagnosticMessage
} from "../preview-diagnostic-relay"

jest.mock("~src/utils/debug", () => ({
  debugError: jest.fn(),
  debugLog: jest.fn(),
  debugWarn: jest.fn()
}))

const mockSendMessage = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  mockSendMessage.mockReset()
  mockSendMessage.mockResolvedValue(undefined)
  ;(global as any).chrome = {
    runtime: {
      sendMessage: mockSendMessage
    }
  }
})

afterEach(() => {
  delete (global as any).chrome
})

describe("preview-diagnostic-relay", () => {
  describe("isPreviewDiagnosticMessage", () => {
    it.each(["PREVIEW_JS_ERROR", "PREVIEW_CSP_PROBE", "PREVIEW_JS_PENDING"])(
      "accepts %s",
      (type) => {
        expect(isPreviewDiagnosticMessage(type)).toBe(true)
      }
    )

    it.each(["SDK_EVENT", "API_REQUEST", "", null, undefined, 42])(
      "rejects %p",
      (type) => {
        expect(isPreviewDiagnosticMessage(type as unknown)).toBe(false)
      }
    )

    it("exposes the expected set of diagnostic types", () => {
      expect([...PREVIEW_DIAGNOSTIC_TYPES].sort()).toEqual([
        "PREVIEW_CSP_PROBE",
        "PREVIEW_JS_ERROR",
        "PREVIEW_JS_PENDING"
      ])
    })
  })

  describe("broadcastPreviewDiagnostic", () => {
    it("re-sends PREVIEW_JS_ERROR as PREVIEW_JS_ERROR_BROADCAST with the same payload", () => {
      const payload = {
        experimentName: "exp_1",
        selector: ".hero",
        reason: "csp",
        error: "Refused to evaluate"
      }

      broadcastPreviewDiagnostic({ type: "PREVIEW_JS_ERROR", payload })

      expect(mockSendMessage).toHaveBeenCalledTimes(1)
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: "PREVIEW_JS_ERROR_BROADCAST",
        payload
      })
    })

    it("re-sends PREVIEW_CSP_PROBE as PREVIEW_CSP_PROBE_BROADCAST", () => {
      const payload = {
        evalAllowed: false,
        inlineAllowed: false,
        jsBlocked: true
      }

      broadcastPreviewDiagnostic({ type: "PREVIEW_CSP_PROBE", payload })

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: "PREVIEW_CSP_PROBE_BROADCAST",
        payload
      })
    })

    it("re-sends PREVIEW_JS_PENDING as PREVIEW_JS_PENDING_BROADCAST", () => {
      const payload = { experimentName: "exp_1", selector: ".not-yet" }

      broadcastPreviewDiagnostic({ type: "PREVIEW_JS_PENDING", payload })

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: "PREVIEW_JS_PENDING_BROADCAST",
        payload
      })
    })

    it("swallows 'Receiving end does not exist' errors silently", async () => {
      const debug = jest.requireMock("~src/utils/debug")
      mockSendMessage.mockRejectedValueOnce(
        new Error("Could not establish connection. Receiving end does not exist.")
      )

      broadcastPreviewDiagnostic({
        type: "PREVIEW_JS_ERROR",
        payload: { experimentName: "exp_1", selector: ".x" }
      })

      await new Promise((resolve) => Promise.resolve().then(resolve))

      expect(debug.debugError).not.toHaveBeenCalled()
    })

    it("swallows 'message port closed' errors silently", async () => {
      const debug = jest.requireMock("~src/utils/debug")
      mockSendMessage.mockRejectedValueOnce(
        new Error("The message port closed before a response was received.")
      )

      broadcastPreviewDiagnostic({
        type: "PREVIEW_CSP_PROBE",
        payload: { jsBlocked: true }
      })

      await new Promise((resolve) => Promise.resolve().then(resolve))

      expect(debug.debugError).not.toHaveBeenCalled()
    })

    it("logs unexpected broadcast errors via debugError", async () => {
      const debug = jest.requireMock("~src/utils/debug")
      const err = new Error("Unexpected failure")
      mockSendMessage.mockRejectedValueOnce(err)

      broadcastPreviewDiagnostic({
        type: "PREVIEW_JS_ERROR",
        payload: { experimentName: "exp_1", selector: ".x" }
      })

      await new Promise((resolve) => Promise.resolve().then(resolve))

      expect(debug.debugError).toHaveBeenCalledWith(
        "[Background] Unexpected error broadcasting PREVIEW_JS_ERROR:",
        err
      )
    })
  })
})
