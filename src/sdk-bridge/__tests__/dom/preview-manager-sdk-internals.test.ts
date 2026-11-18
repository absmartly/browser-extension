/**
 * PreviewManager depends on two SDK internals for late SPA matches. These
 * tests run the real SDK and simulate an upgrade that removed one of them.
 */

describe("PreviewManager SDK internals check", () => {
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    document.body.innerHTML = '<div id="a">A</div><div id="b">B</div>'
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    document.body.innerHTML = ""
  })

  const loadIsolated = (
    mutate?: (
      sdk: typeof import("@absmartly/sdk-plugins/core/dom-manipulator")
    ) => void
  ) => {
    let PreviewManager: typeof import("../../dom/preview-manager").PreviewManager
    jest.isolateModules(() => {
      const sdk = require("@absmartly/sdk-plugins/core/dom-manipulator")
      mutate?.(sdk)
      PreviewManager = require("../../dom/preview-manager").PreviewManager
    })
    return PreviewManager
  }

  const internalsErrors = () =>
    errorSpy.mock.calls.filter((args) =>
      args.some(
        (arg: unknown) =>
          typeof arg === "string" &&
          arg.includes("applyChangeToSpecificElement")
      )
    )

  it("does not report anything against the installed SDK", () => {
    const PreviewManager = loadIsolated()
    const manager = new PreviewManager()

    manager.applyPreviewChange(
      { selector: "#a", type: "style", value: { color: "red" } },
      "exp"
    )

    expect(document.getElementById("a").style.color).toBe("red")
    expect(internalsErrors()).toHaveLength(0)
    manager.clearAll()
  })

  it("reports a missing per-element apply method once across sessions", () => {
    const PreviewManager = loadIsolated((sdk) => {
      delete (sdk.DOMManipulatorLite.prototype as any)
        .applyChangeToSpecificElement
    })
    const manager = new PreviewManager()

    manager.applyPreviewChange(
      { selector: "#a", type: "style", value: { color: "red" } },
      "one"
    )
    manager.applyPreviewChange(
      { selector: "#b", type: "style", value: { color: "blue" } },
      "two"
    )

    expect(internalsErrors()).toHaveLength(1)
    manager.clearAll()
  })
})
