import { EventViewer } from "../event-viewer"

const host = () =>
  document.getElementById("absmartly-event-viewer-host") as HTMLElement | null

describe("EventViewer keyboard handling", () => {
  let viewer: EventViewer
  let sendMessage: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    document.body.innerHTML = ""
    sendMessage = jest.fn()
    ;(global as any).chrome = { runtime: { sendMessage } }
    viewer = new EventViewer()
  })

  afterEach(() => {
    viewer.close()
    jest.useRealTimers()
  })

  it("moves focus into the dialog when opened", () => {
    const iframe = document.createElement("iframe")
    iframe.tabIndex = 0
    document.body.appendChild(iframe)
    iframe.focus()

    viewer.show("goal", "now", '{"a":1}')

    expect(document.activeElement).toBe(host())
    const dialog = host()!.shadowRoot!.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(host()!.shadowRoot!.activeElement).toBe(dialog)
  })

  it("closes on Escape right after opening, before the editor is created", () => {
    viewer.show("goal", "now", "{}")

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))

    expect(host()).toBeNull()
  })

  it("closes on Escape pressed inside the dialog", () => {
    viewer.show("goal", "now", "{}")
    jest.runOnlyPendingTimers()

    const dialog = host()!.shadowRoot!.querySelector('[role="dialog"]')!
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        composed: true
      })
    )

    expect(host()).toBeNull()
  })

  it("restores focus to the previously focused element on close", () => {
    const button = document.createElement("button")
    document.body.appendChild(button)
    button.focus()

    viewer.show("goal", "now", "{}")
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))

    expect(document.activeElement).toBe(button)
  })

  it("removes its key handler on close and ignores other keys", () => {
    viewer.show("goal", "now", "{}")
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
    expect(host()).not.toBeNull()

    viewer.close()
    const second = new EventViewer()
    second.show("goal", "now", "{}")
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    expect(host()).toBeNull()
    expect(sendMessage).toHaveBeenCalledWith({ type: "EVENT_VIEWER_CLOSE" })
  })
})

describe("EventViewer focus containment", () => {
  let viewer: EventViewer

  const inner = () => host()!.shadowRoot!.activeElement as HTMLElement | null
  const press = (key: string, shiftKey = false) => {
    const event = new KeyboardEvent("keydown", {
      key,
      shiftKey,
      bubbles: true,
      cancelable: true
    })
    document.dispatchEvent(event)
    return event
  }

  beforeEach(() => {
    jest.useFakeTimers()
    document.body.innerHTML = '<button id="page-button">Page</button>'
    ;(global as any).chrome = { runtime: { sendMessage: jest.fn() } }
    viewer = new EventViewer()
    viewer.show("goal", "now", "{}")
    jest.runOnlyPendingTimers()
  })

  afterEach(() => {
    viewer.close()
    jest.useRealTimers()
  })

  it("cycles Tab through the dialog buttons without reaching the page", () => {
    const [copy, close] = Array.from(
      host()!.shadowRoot!.querySelectorAll<HTMLElement>(".event-viewer-button")
    )
    const seen: Array<HTMLElement | null> = []
    for (let i = 0; i < 4; i++) {
      expect(press("Tab").defaultPrevented).toBe(true)
      seen.push(inner())
    }
    expect(seen).toEqual([copy, close, copy, close])
    expect(document.activeElement).toBe(host())
  })

  it("cycles Shift+Tab backwards", () => {
    const [copy, close] = Array.from(
      host()!.shadowRoot!.querySelectorAll<HTMLElement>(".event-viewer-button")
    )
    press("Tab", true)
    expect(inner()).toBe(close)
    press("Tab", true)
    expect(inner()).toBe(copy)
    press("Tab", true)
    expect(inner()).toBe(close)
  })

  it("stops handling Tab after close", () => {
    viewer.close()
    expect(press("Tab").defaultPrevented).toBe(false)
  })
})
