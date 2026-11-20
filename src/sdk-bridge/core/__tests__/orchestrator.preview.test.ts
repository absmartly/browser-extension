/**
 * Orchestrator preview messages against a real PreviewManager and the real
 * @absmartly/sdk-plugins manipulator.
 */

import { Orchestrator } from "../orchestrator"

jest.mock("../../sdk/sdk-detector")
jest.mock("../../sdk/sdk-interceptor")
jest.mock("../../experiment/override-manager")
jest.mock("../../utils/logger")

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const send = (type: string, payload: Record<string, unknown>) =>
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { source: "absmartly-extension", type, payload },
      source: window,
      origin: window.location.origin
    })
  )

describe("Orchestrator replace-mode preview through PreviewManager", () => {
  const orchestrator = new Orchestrator({ debug: false })
  orchestrator.setupMessageListener()
  let posted: jest.SpyInstance

  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = '<p id="a">A</p><div id="host"></div>'
    posted = jest.spyOn(window, "postMessage").mockImplementation(() => {})
    ;(window as any).__ran = 0
  })

  afterEach(() => {
    send("REMOVE_PREVIEW", { experimentName: "b" })
    send("REMOVE_PREVIEW", { experimentName: "a" })
    posted.mockRestore()
  })

  const pendingReports = () =>
    posted.mock.calls
      .map(([message]) => message)
      .filter((message) => message?.type === "PREVIEW_JS_PENDING")
      .map(({ payload }) => [payload.experimentName, payload.selector])

  it("reports a javascript change whose selector is missing and runs it when the element mounts", async () => {
    send("PREVIEW_CHANGES", {
      experimentName: "a",
      changes: [{ selector: "#a", type: "text", value: "AA" }]
    })
    send("PREVIEW_CHANGES", {
      experimentName: "b",
      updateMode: "replace",
      changes: [
        { selector: "#host", type: "text", value: "B" },
        {
          selector: "#absent",
          type: "javascript",
          value: "window.__ran++; element.title = 'js'"
        }
      ]
    })
    expect(pendingReports()).toEqual([["b", "#absent"]])
    expect(document.getElementById("host").textContent).toBe("B")

    // Replacing the older experiment unwinds b and re-applies it, which
    // registers b's pending javascript again without running it.
    send("PREVIEW_CHANGES", {
      experimentName: "a",
      updateMode: "replace",
      changes: [{ selector: "#a", type: "text", value: "A2" }]
    })
    expect(pendingReports()).toEqual([["b", "#absent"]])
    expect((window as any).__ran).toBe(0)

    const late = document.createElement("div")
    late.id = "absent"
    document.body.append(late)
    await Promise.resolve()
    await nextFrame()
    await nextFrame()

    expect((window as any).__ran).toBe(1)
    expect(late.title).toBe("js")
    send("REMOVE_PREVIEW", { experimentName: "b" })
    expect(late.hasAttribute("title")).toBe(false)
    expect(document.getElementById("host").textContent).toBe("")
    expect(document.getElementById("a").textContent).toBe("A2")
  })
})
