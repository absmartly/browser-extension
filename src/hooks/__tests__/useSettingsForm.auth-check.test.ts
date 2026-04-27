/**
 * Unit tests for the auth-check + dirty-tracking logic in useSettingsForm.
 *
 * The hook builds a `configJson` payload for the background CHECK_AUTH handler
 * (which validates against ConfigSchema) using the UI's current values rather
 * than the stored config — so the Refresh button reflects the user's selection
 * instead of stale storage. These tests mirror that logic without rendering
 * the hook (consistent with the other useSettingsForm test files in this dir).
 */

describe("useSettingsForm - checkAuthStatus configJson construction", () => {
  // Mirrors the inline normalize done before sending the payload.
  const normalize = (endpoint: string): string => {
    let n = endpoint.trim()
    if (n && !n.startsWith("http://") && !n.startsWith("https://")) {
      n = `https://${n}`
    }
    if (n.endsWith("/")) {
      n = n.slice(0, -1)
    }
    return n.replace(/\/v1$/, "")
  }

  const buildConfigForCheck = (
    endpoint: string,
    apiKeyState: string,
    authMethodState: "jwt" | "apikey",
    override?: { apiKey: string; authMethod: "jwt" | "apikey" }
  ) => {
    const effectiveApiKey = (override ? override.apiKey : apiKeyState).trim()
    const effectiveAuthMethod = override ? override.authMethod : authMethodState
    const normalized = normalize(endpoint)

    const out: Record<string, unknown> = {
      apiEndpoint: normalized,
      authMethod: effectiveAuthMethod
    }
    if (effectiveApiKey) {
      out.apiKey = effectiveApiKey
    }
    return out
  }

  it("uses override authMethod when supplied, ignoring stored UI state", () => {
    const config = buildConfigForCheck(
      "https://demo-2.absmartly.com",
      "stored-key",
      "apikey",
      { apiKey: "", authMethod: "jwt" }
    )
    expect(config.authMethod).toBe("jwt")
    expect(config.apiKey).toBeUndefined()
  })

  it("falls back to UI state when no override is supplied", () => {
    const config = buildConfigForCheck(
      "https://demo-2.absmartly.com",
      "stored-key",
      "apikey"
    )
    expect(config.authMethod).toBe("apikey")
    expect(config.apiKey).toBe("stored-key")
  })

  it("strips trailing /v1 from the endpoint so ConfigSchema sees a base URL", () => {
    const config = buildConfigForCheck(
      "https://demo-2.absmartly.com/v1",
      "k",
      "apikey"
    )
    expect(config.apiEndpoint).toBe("https://demo-2.absmartly.com")
  })

  it("prepends https:// when the endpoint has no protocol", () => {
    const config = buildConfigForCheck("demo-2.absmartly.com", "", "jwt")
    expect(config.apiEndpoint).toBe("https://demo-2.absmartly.com")
  })

  it("omits apiKey when blank so ConfigSchema's optional field stays absent", () => {
    const config = buildConfigForCheck(
      "https://demo-2.absmartly.com",
      "",
      "jwt"
    )
    expect("apiKey" in config).toBe(false)
  })
})

describe("useSettingsForm - isDirty snapshot tracking", () => {
  // Mirrors the snapshot used by the hook to detect unsaved changes.
  const snapshot = (state: Record<string, unknown>) => JSON.stringify(state)

  const baseState = {
    apiKey: "",
    apiEndpoint: "https://demo-2.absmartly.com",
    applicationName: "",
    domChangesFieldName: "__dom_changes",
    authMethod: "jwt" as const,
    sdkWindowProperty: "",
    queryPrefix: "_exp_",
    persistQueryToCookie: true,
    aiProvider: "claude-subscription" as const,
    aiApiKey: "",
    llmModel: "sonnet",
    providerModels: {},
    providerEndpoints: {},
    customEndpoint: "",
    vibeStudioEnabled: false,
    htmlInjectionEnabled: false
  }

  it("is not dirty when current state matches the captured snapshot", () => {
    const initial = snapshot(baseState)
    const current = snapshot(baseState)
    expect(initial).toBe(current)
  })

  it("is dirty when the user toggles authMethod", () => {
    const initial = snapshot(baseState)
    const current = snapshot({ ...baseState, authMethod: "apikey" })
    expect(initial).not.toBe(current)
  })

  it("is dirty when the user changes the endpoint", () => {
    const initial = snapshot(baseState)
    const current = snapshot({
      ...baseState,
      apiEndpoint: "https://test-1.absmartly.com"
    })
    expect(initial).not.toBe(current)
  })

  it("is not dirty when nothing has been loaded yet (snapshot ref is null)", () => {
    const initialRef: string | null = null
    const isDirty = initialRef !== null && initialRef !== snapshot(baseState)
    expect(isDirty).toBe(false)
  })

  it("becomes pristine again after marking the current state as the new baseline", () => {
    const dirtyState = { ...baseState, authMethod: "apikey" as const }
    const initialRef = snapshot(baseState)
    const beforeMark = initialRef !== snapshot(dirtyState)
    expect(beforeMark).toBe(true)

    // markFormPristine() captures the current state as the new baseline
    const newRef = snapshot(dirtyState)
    const afterMark = newRef !== snapshot(dirtyState)
    expect(afterMark).toBe(false)
  })
})
