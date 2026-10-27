import { safeParseVariantConfig } from "../validation-schemas"
import { getVariantConfigError } from "../variant-config-validation"

describe("variant config DOM validation", () => {
  const change = { selector: "#heading", type: "text", value: "Updated" }

  it.each(["__dom_changes", "custom_dom"])(
    "validates the active field %s without changing config",
    (field) => {
      const config = {
        color: "green",
        [field]: {
          changes: [change],
          urlFilter: "/products/*",
          extra: { preserve: true }
        }
      }
      const before = JSON.stringify(config)
      expect(getVariantConfigError(config, field)).toBeUndefined()
      expect(JSON.stringify(config)).toBe(before)
      expect(
        getVariantConfigError({ [field]: [change] }, field)
      ).toBeUndefined()
      expect(
        getVariantConfigError({ [field]: { changes: [] } }, field)
      ).toBeUndefined()
    }
  )

  it.each([
    null,
    42,
    "invalid",
    { changes: "invalid" },
    [null],
    { changes: [null] },
    [1],
    ["invalid"],
    [[]],
    [{}],
    [{ selector: "#heading", type: "text", value: null }],
    { changes: [], urlFilter: { include: "invalid" } }
  ])("rejects malformed default and custom DOM data: %p", (value) => {
    for (const field of ["__dom_changes", "custom_dom"]) {
      expect(getVariantConfigError({ [field]: value }, field)).toBeDefined()
    }
  })

  it("treats an inactive default field as an ordinary variable", () => {
    expect(
      getVariantConfigError(
        { __dom_changes: "ordinary value", custom_dom: [] },
        "custom_dom"
      )
    ).toBeUndefined()
  })

  it("reloads the configured field while preserving unrelated default-name data", () => {
    const config = {
      __dom_changes: "ordinary value",
      custom_dom: { changes: [change], urlFilter: "/products/*" },
      color: "green"
    }
    expect(
      safeParseVariantConfig(JSON.stringify(config), "custom_dom")
    ).toEqual({ success: true, data: config })
    expect(
      safeParseVariantConfig('{"custom_dom":{"changes":[null]}}', "custom_dom")
        .success
    ).toBe(false)
  })
})
