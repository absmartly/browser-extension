import { createPreviewHeader } from "~content/preview-header"
import { Orchestrator } from "~src/sdk-bridge/core/orchestrator"

jest.mock("~src/sdk-bridge/sdk/sdk-detector")
jest.mock("~src/sdk-bridge/sdk/sdk-interceptor")
jest.mock("~src/sdk-bridge/experiment/override-manager")
jest.mock("~src/sdk-bridge/utils/logger")

describe("preview header Exit Preview button", () => {
  const runtime = (global as any).chrome.runtime

  afterEach(() => {
    ;(global as any).chrome.runtime = runtime
    jest.restoreAllMocks()
  })

  // Mounts the header and returns its closed shadow root.
  const mountHeader = (experimentName: string, sendMessage: jest.Mock) => {
    ;(global as any).chrome.runtime = {
      getURL: (path: string) => path,
      sendMessage
    }
    const attachShadow = Element.prototype.attachShadow
    let root: ShadowRoot
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (
      this: Element,
      init
    ) {
      root = attachShadow.call(this, init)
      return root
    })
    createPreviewHeader(experimentName, "v1", false, false)
    return root
  }

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
    jest.spyOn(window, "postMessage").mockImplementation(() => {})
    const root = mountHeader("exp", sendMessage)

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

  it("removes the experiment's journaled preview through the page bridge", () => {
    document.body.innerHTML =
      '<p id="p" title="orig">Original</p><p id="other">Other</p>'
    const original = document.body.innerHTML
    const orchestrator = new Orchestrator({ debug: false })
    orchestrator.setupMessageListener()
    // Page messages reach the bridge's listener as window message events.
    const deliver = (data: unknown) =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data,
          source: window,
          origin: window.location.origin
        })
      )
    jest
      .spyOn(window, "postMessage")
      .mockImplementation((data: unknown) => deliver(data))
    deliver({
      source: "absmartly-extension",
      type: "PREVIEW_CHANGES",
      payload: {
        experimentName: "exp",
        changes: [
          { selector: "#p", type: "text", value: "Previewed" },
          { selector: "#p", type: "attribute", value: { title: "x" } }
        ]
      }
    })
    expect(document.getElementById("p").textContent).toBe("Previewed")
    const root = mountHeader("exp", jest.fn())

    root.querySelector("button").click()

    expect(document.getElementById("absmartly-preview-header-host")).toBeNull()
    expect(document.body.innerHTML).toBe(original)
  })
})
