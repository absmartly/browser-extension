/**
 * Verifies that overlapping checkAuthStatus calls don't clobber each other.
 *
 * Repro for the bug "click Refresh after changing the endpoint, but the user
 * info still reflects the previous endpoint":
 *
 *   1. SettingsView mounts, loadConfig auto-runs checkAuthStatus(endpointA).
 *   2. User changes the endpoint to endpointB and clicks Refresh before the
 *      first response lands -> checkAuthStatus(endpointB) starts.
 *   3. endpointB responds first; React state shows user B.
 *   4. endpointA responds *later* and overwrites the state with user A.
 *
 * The fix tracks a per-call ID on a ref and discards responses that aren't
 * from the latest call.
 */

import { act, renderHook, waitFor } from "@testing-library/react"

// Prefer userEvent / a real component, but renderHook keeps this focused on the
// hook's invariant: only the latest call wins.
import { useSettingsForm } from "../useSettingsForm"

// Defer-resolving sendToBackground so the test can interleave responses.
type Resolver = (value: unknown) => void
const pendingResolvers: Resolver[] = []

jest.mock("~src/lib/messaging", () => ({
  sendToBackground: jest.fn(
    () =>
      new Promise((resolve) => {
        pendingResolvers.push(resolve)
      })
  )
}))

jest.mock("~src/utils/storage", () => ({
  getConfig: jest.fn().mockResolvedValue(null),
  setConfig: jest.fn().mockResolvedValue(undefined)
}))

jest.mock("~src/utils/debug", () => ({
  debugError: jest.fn(),
  debugLog: jest.fn(),
  debugWarn: jest.fn()
}))

const userA = {
  id: 1,
  email: "user-a@absmartly.com",
  name: "User A"
}

const userB = {
  id: 2,
  email: "user-b@absmartly.com",
  name: "User B"
}

beforeEach(() => {
  pendingResolvers.length = 0
})

describe("useSettingsForm - checkAuthStatus race condition", () => {
  it("ignores a stale response that arrives after a newer call resolves", async () => {
    const { result } = renderHook(() => useSettingsForm())

    let firstCheck: Promise<void>
    let secondCheck: Promise<void>

    await act(async () => {
      firstCheck = result.current.checkAuthStatus(
        "https://staging.absmartly.com",
        {
          apiKey: "",
          authMethod: "jwt"
        }
      )
    })
    expect(pendingResolvers).toHaveLength(1)

    await act(async () => {
      secondCheck = result.current.checkAuthStatus(
        "https://test-1.absmartly.com",
        {
          apiKey: "",
          authMethod: "jwt"
        }
      )
    })
    expect(pendingResolvers).toHaveLength(2)

    // Resolve the *second* (latest) call first — the user-visible result.
    await act(async () => {
      pendingResolvers[1]({ success: true, data: { user: userB } })
      await secondCheck
    })

    await waitFor(() => {
      expect(result.current.user).toEqual(userB)
    })

    // Now resolve the first (stale) call. Its response must NOT clobber userB.
    await act(async () => {
      pendingResolvers[0]({ success: true, data: { user: userA } })
      await firstCheck
    })

    expect(result.current.user).toEqual(userB)
  })

  it("keeps checkingAuth true while a newer call is still in flight", async () => {
    const { result } = renderHook(() => useSettingsForm())

    let firstCheck: Promise<void>
    let secondCheck: Promise<void>

    await act(async () => {
      firstCheck = result.current.checkAuthStatus(
        "https://staging.absmartly.com",
        {
          apiKey: "",
          authMethod: "jwt"
        }
      )
    })

    await act(async () => {
      secondCheck = result.current.checkAuthStatus(
        "https://test-1.absmartly.com",
        {
          apiKey: "",
          authMethod: "jwt"
        }
      )
    })

    expect(result.current.checkingAuth).toBe(true)

    // Resolve the stale call: checkingAuth must stay true because the latest
    // call hasn't resolved yet.
    await act(async () => {
      pendingResolvers[0]({ success: true, data: { user: userA } })
      await firstCheck
    })
    expect(result.current.checkingAuth).toBe(true)

    // Resolve the latest: now checkingAuth flips to false.
    await act(async () => {
      pendingResolvers[1]({ success: true, data: { user: userB } })
      await secondCheck
    })
    await waitFor(() => {
      expect(result.current.checkingAuth).toBe(false)
    })
  })
})
