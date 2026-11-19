/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "file:///tmp/page.html"}
 */
import { createPreviewHeader } from "~content/preview-header"
import { Orchestrator } from "~src/sdk-bridge/core/orchestrator"

jest.mock("~src/sdk-bridge/sdk/sdk-detector")
jest.mock("~src/sdk-bridge/sdk/sdk-interceptor")
jest.mock("~src/sdk-bridge/experiment/override-manager")
jest.mock("~src/sdk-bridge/utils/logger")

describe("preview header Exit Preview on an opaque origin", () => {
  const runtime = (global as any).chrome.runtime

  afterEach(() => {
    ;(global as any).chrome.runtime = runtime
    jest.restoreAllMocks()
  })

  it("posts REMOVE_PREVIEW with a valid targetOrigin and still reports the state change", () => {
    expect(window.location.origin).toBe("null")
    document.body.innerHTML = '<p id="p">Original</p>'
    const orchestrator = new Orchestrator({ debug: false })
    orchestrator.setupMessageListener()
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: "absmartly-extension",
          type: "PREVIEW_CHANGES",
          payload: {
            experimentName: "exp",
            changes: [{ selector: "#p", type: "text", value: "Previewed" }]
          }
        },
        source: window,
        origin: "null"
      })
    )
    expect(document.getElementById("p").textContent).toBe("Previewed")

    const sendMessage = jest.fn()
    ;(global as any).chrome.runtime = {
      getURL: (path: string) => path,
      sendMessage
    }
    const attachShadow = Element.prototype.attachShadow
    let root: ShadowRoot
    jest
      .spyOn(Element.prototype, "attachShadow")
      .mockImplementation(function (this: Element, init) {
        root = attachShadow.call(this, init)
        return root
      })
    // The real postMessage runs first so jsdom validates targetOrigin as a
    // browser does; jsdom's own dispatch carries no `source`, so the bridge
    // receives an equivalent same-window event.
    const realPostMessage = window.postMessage.bind(window)
    const postMessage = jest
      .spyOn(window, "postMessage")
      .mockImplementation(((data: unknown, targetOrigin: string) => {
        realPostMessage(data, targetOrigin)
        window.dispatchEvent(
          new MessageEvent("message", { data, source: window, origin: "null" })
        )
      }) as typeof window.postMessage)
    createPreviewHeader("exp", "v1", false, false)

    root.querySelector("button").click()

    expect(postMessage).toHaveBeenCalledWith(
      {
        source: "absmartly-extension",
        type: "REMOVE_PREVIEW",
        payload: { experimentName: "exp" }
      },
      "*"
    )
    expect(sendMessage).toHaveBeenCalledWith({
      type: "PREVIEW_STATE_CHANGED",
      enabled: false
    })
    expect(document.getElementById("p").textContent).toBe("Original")
  })
})
