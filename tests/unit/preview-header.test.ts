import { createPreviewHeader } from "~content/preview-header"

describe("preview header Exit Preview button", () => {
  const runtime = (global as any).chrome.runtime

  afterEach(() => {
    ;(global as any).chrome.runtime = runtime
    jest.restoreAllMocks()
  })

  it("strips preview markers without writing the selection sidecar back", () => {
    document.body.innerHTML =
      '<div id="wrap" data-absmartly-experiment="exp" data-absmartly-modified="true"><span id="child">Current</span></div>'
    const wrap = document.getElementById("wrap")
    const child = document.getElementById("child")
    wrap.setAttribute(
      "data-absmartly-original",
      JSON.stringify({ textContent: "Stale", innerHTML: "<i>Stale</i>" })
    )
    const sendMessage = jest.fn()
    ;(global as any).chrome.runtime = {
      getURL: (path: string) => path,
      sendMessage
    }
    // The header mounts a closed shadow root.
    const attachShadow = Element.prototype.attachShadow
    let root: ShadowRoot
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (
      this: Element,
      init
    ) {
      root = attachShadow.call(this, init)
      return root
    })
    createPreviewHeader("exp", "v1", false, false)

    root.querySelector("button").click()

    expect(document.getElementById("child")).toBe(child)
    expect(wrap.outerHTML).toBe(
      '<div id="wrap"><span id="child">Current</span></div>'
    )
    expect(sendMessage).toHaveBeenCalledWith({
      type: "PREVIEW_STATE_CHANGED",
      enabled: false
    })
  })
})
