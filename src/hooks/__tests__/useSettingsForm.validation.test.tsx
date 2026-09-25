import { act, renderHook } from "@testing-library/react"

import { sendToBackground } from "~src/lib/messaging"

import { useSettingsForm } from "../useSettingsForm"

jest.mock("~src/lib/messaging", () => ({
  sendToBackground: jest.fn().mockResolvedValue({ reachable: false })
}))
jest.mock("~src/utils/storage", () => ({
  getConfig: jest.fn().mockResolvedValue(null),
  setConfig: jest.fn()
}))

describe("endpoint syntax independent of reachability", () => {
  it.each([
    "http://[",
    "https://",
    "ftp://example.com",
    "http://a:99999",
    "http://a b",
    "http:/api.example.com",
    "https:api.example.com",
    "HTTP:///api.example.com"
  ])("rejects %s", async (endpoint) => {
    const { result } = renderHook(() => useSettingsForm())
    act(() => result.current.setApiEndpoint(endpoint))
    await act(async () => {
      expect(await result.current.validateForm()).toBe(false)
    })
    expect(result.current.errors.apiEndpoint).toMatch(/Invalid endpoint/)
  })

  it("does not let an older reachability failure replace a newer syntax error", async () => {
    let finish!: (value: unknown) => void
    ;(sendToBackground as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const { result } = renderHook(() => useSettingsForm())
    act(() => result.current.setApiEndpoint("https://example.com"))
    await act(async () => {
      expect(await result.current.validateForm()).toBe(true)
    })
    act(() => result.current.setApiEndpoint("http://["))
    await act(async () => {
      expect(await result.current.validateForm()).toBe(false)
    })
    expect(result.current.errors.apiEndpoint).toMatch(/Invalid endpoint URL/)
    await act(async () => {
      finish({ reachable: false })
    })
    expect(result.current.errors.apiEndpoint).toMatch(/Invalid endpoint URL/)
  })

  it.each([
    ["localhost:38473/path", "https://localhost:38473/path"],
    ["http://localhost:38473/path/", "http://localhost:38473/path"],
    ["https://example.com/v1", "https://example.com/v1"],
    ["example.com", "https://example.com"],
    ["HTTP://localhost:1234", "HTTP://localhost:1234"],
    ["http://[::1]:1234", "http://[::1]:1234"]
  ])("accepts unreachable but valid %s", async (endpoint, normalized) => {
    const { result } = renderHook(() => useSettingsForm())
    act(() => result.current.setApiEndpoint(endpoint))
    await act(async () => {
      expect(await result.current.validateForm()).toBe(true)
    })
    expect(result.current.buildConfig().apiEndpoint).toBe(normalized)
  })
})
