import { act, renderHook, waitFor } from "@testing-library/react"

import type { ABsmartlyConfig } from "~src/types/absmartly"
import { getConfig } from "~src/utils/storage"

import { useABsmartly } from "../useABsmartly"

jest.mock("~src/utils/storage", () => ({
  getConfig: jest.fn()
}))
jest.mock("~src/lib/background-api-client", () => ({
  BackgroundAPIClient: jest.fn().mockImplementation(() => ({}))
}))

const badConfig = {
  apiEndpoint: "https://fixture.absmartly.com",
  authMethod: "apikey",
  apiKey: "synthetic-bad-key"
} as ABsmartlyConfig
const goodConfig = {
  ...badConfig,
  apiKey: "synthetic-good-key"
} as ABsmartlyConfig
const USER = { id: 7, email: "fixture@example.invalid" }

describe("useABsmartly auth recovery after a corrected config", () => {
  let storedKey: string
  let sendMessage: jest.Mock

  beforeEach(() => {
    storedKey = badConfig.apiKey!
    ;(getConfig as jest.Mock).mockResolvedValue(badConfig)
    sendMessage = jest.fn(async () =>
      storedKey === "synthetic-good-key"
        ? { success: true, data: { user: USER } }
        : { success: false, error: "Not authenticated" }
    )
    ;(global as any).chrome.runtime = { sendMessage }
  })

  it("re-checks immediately when a corrected config is saved within the throttle window", async () => {
    const { result } = renderHook(() => useABsmartly())
    await waitFor(() =>
      expect(result.current.authErrorType).toBe("not-authenticated")
    )
    expect(sendMessage).toHaveBeenCalledTimes(1)

    storedKey = "synthetic-good-key"
    act(() => result.current.updateConfig(goodConfig))

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(result.current.authErrorType).toBeNull()
  })

  it("re-checks after an in-flight check for the previous config finishes", async () => {
    let releaseFirst!: () => void
    sendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = () =>
            resolve({ success: false, error: "Not authenticated" })
        })
    )
    const { result } = renderHook(() => useABsmartly())
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))

    storedKey = "synthetic-good-key"
    act(() => result.current.updateConfig(goodConfig))
    await act(async () => releaseFirst())

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(result.current.authErrorType).toBeNull()
  })

  it("still throttles repeated focus checks for an unchanged config", async () => {
    const { result } = renderHook(() => useABsmartly())
    await waitFor(() =>
      expect(result.current.authErrorType).toBe("not-authenticated")
    )
    act(() => {
      window.dispatchEvent(new Event("focus"))
      window.dispatchEvent(new Event("focus"))
    })
    await act(async () => {})
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })
})
