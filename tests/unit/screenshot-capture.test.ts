import { captureVisibleTab } from "~src/utils/screenshot-capture"

describe("captureVisibleTab", () => {
  beforeEach(() => {
    ;(global as any).chrome = {
      runtime: {
        sendMessage: jest.fn()
      }
    }
  })

  it("returns the data URL on success", async () => {
    ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
      ok: true,
      dataUrl: "data:image/png;base64,XXX"
    })
    const result = await captureVisibleTab()
    expect(result).toBe("data:image/png;base64,XXX")
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "ABSMARTLY_CAPTURE_VISIBLE_TAB"
    })
  })

  it("throws if the background returns an error", async () => {
    ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
      ok: false,
      error: "no active tab"
    })
    await expect(captureVisibleTab()).rejects.toThrow("no active tab")
  })
})
