import * as selectorGenerator from "../../utils/selector-generator"
import EventHandlers from "../event-handlers"
import StateManager from "../state-manager"

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const hover = (target: Element) =>
  target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
const leave = (target: Element) =>
  target.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
const tooltip = () => document.getElementById("absmartly-hover-tooltip")

describe("EventHandlers hover tooltip", () => {
  let handlers: EventHandlers
  let generate: jest.SpyInstance

  beforeEach(() => {
    document.body.innerHTML =
      '<button id="first">1</button><button id="second">2</button><button id="third">3</button>'
    handlers = new EventHandlers(
      new StateManager({ variantName: "v", experimentName: "e", logoUrl: "" })
    )
    handlers.attachEventListeners()
    generate = jest.spyOn(selectorGenerator, "generateRobustSelector")
  })

  afterEach(() => {
    handlers.detachEventListeners()
    generate.mockRestore()
  })

  it("generates one selector per frame, for the element still hovered", async () => {
    hover(document.getElementById("first"))
    hover(document.getElementById("second"))
    hover(document.getElementById("third"))
    expect(generate).not.toHaveBeenCalled()
    expect(tooltip()).toBeNull()

    await nextFrame()

    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0][0]).toBe(document.getElementById("third"))
    expect(tooltip().textContent).toBe("#third")
  })

  it("drops a pending tooltip when the pointer leaves before the frame", async () => {
    const first = document.getElementById("first")
    hover(first)
    leave(first)

    await nextFrame()

    expect(generate).not.toHaveBeenCalled()
    expect(tooltip()).toBeNull()
    expect(first.classList.contains("absmartly-hover")).toBe(false)
  })

  it("drops a pending tooltip when hover is disabled before the frame", async () => {
    hover(document.getElementById("first"))
    handlers.setHoverEnabled(false)

    await nextFrame()

    expect(generate).not.toHaveBeenCalled()
    expect(tooltip()).toBeNull()
  })

  it("drops a pending tooltip when the listeners are detached before the frame", async () => {
    hover(document.getElementById("first"))
    handlers.detachEventListeners()

    await nextFrame()

    expect(generate).not.toHaveBeenCalled()
    expect(tooltip()).toBeNull()
  })

  it("shows no tooltip and does not throw when the hovered element is removed before the frame", async () => {
    document.body.innerHTML = "<div><button>1</button></div>"
    const button = document.querySelector("button")
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => errors.push(event.error)
    window.addEventListener("error", onError)
    hover(button)
    button.remove()

    await nextFrame()
    window.removeEventListener("error", onError)

    expect(errors).toEqual([])
    expect(generate).not.toHaveBeenCalled()
    expect(tooltip()).toBeNull()
  })
})
