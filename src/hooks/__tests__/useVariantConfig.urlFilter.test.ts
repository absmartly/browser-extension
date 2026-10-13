import { setDOMChangesInConfig } from "../useVariantConfig"

describe("setDOMChangesInConfig (FT-2251)", () => {
  const urlFilter = {
    include: ["/products/*"],
    mode: "simple" as const,
    matchType: "path" as const
  }

  it("keeps a URL filter when the variant has no DOM changes", () => {
    const result = setDOMChangesInConfig(
      { cta_color: "blue" },
      { changes: [], urlFilter }
    )
    expect(result).toEqual({
      cta_color: "blue",
      __dom_changes: { changes: [], urlFilter }
    })
  })

  it("uses the configured DOM field name", () => {
    const result = setDOMChangesInConfig(
      {},
      { changes: [], urlFilter: "/checkout" },
      "custom_changes"
    )
    expect(result).toEqual({
      custom_changes: { changes: [], urlFilter: "/checkout" }
    })
  })

  it("still removes the field when nothing is left to store", () => {
    expect(
      setDOMChangesInConfig({ a: 1, __dom_changes: [] }, { changes: [] })
    ).toEqual({ a: 1 })
    expect(
      setDOMChangesInConfig({ a: 1 }, { changes: [], urlFilter: undefined })
    ).toEqual({ a: 1 })
    expect(setDOMChangesInConfig({ a: 1 }, [])).toEqual({ a: 1 })
  })

  it("keeps DOM changes and their settings unchanged", () => {
    const changes = [
      { selector: "#main-title", type: "text" as const, value: "Hi" }
    ]
    expect(setDOMChangesInConfig({}, { changes, urlFilter })).toEqual({
      __dom_changes: { changes, urlFilter }
    })
  })
})
