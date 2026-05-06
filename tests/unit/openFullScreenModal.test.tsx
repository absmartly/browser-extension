import "@testing-library/jest-dom"
import React from "react"

import { openFullScreenModal } from "~src/components/fullscreen/openFullScreenModal"

describe("openFullScreenModal", () => {
  afterEach(() => {
    document.querySelectorAll("#absmartly-fullscreen-host").forEach((n) =>
      n.remove()
    )
  })

  it("creates a body-level host with a shadow root and removes it on close", async () => {
    const promise = openFullScreenModal({
      render: ({ close }) => (
        <button data-testid="x-close" onClick={() => close("done")}>
          close
        </button>
      )
    })

    // React 18 createRoot.render is async; let the initial commit flush.
    await new Promise((r) => setTimeout(r, 0))

    const host = document.getElementById("absmartly-fullscreen-host")
    expect(host).not.toBeNull()
    expect(host?.shadowRoot).not.toBeNull()
    const btn = host!.shadowRoot!.querySelector(
      '[data-testid="x-close"]'
    ) as HTMLButtonElement
    expect(btn).not.toBeNull()
    btn.click()

    await expect(promise).resolves.toBe("done")
    expect(document.getElementById("absmartly-fullscreen-host")).toBeNull()
  })

  it("resolves with null when closed without a value", async () => {
    const promise = openFullScreenModal({
      render: ({ close }) => (
        <button data-testid="x-close" onClick={() => close()}>
          close
        </button>
      )
    })

    // React 18 createRoot.render is async; let the initial commit flush.
    await new Promise((r) => setTimeout(r, 0))

    const host = document.getElementById("absmartly-fullscreen-host")!
    const btn = host.shadowRoot!.querySelector(
      '[data-testid="x-close"]'
    ) as HTMLButtonElement
    btn.click()

    await expect(promise).resolves.toBeNull()
  })
})
