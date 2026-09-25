import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import { URLFilterSection } from "../URLFilterSection"

const renderSection = (urlFilter: any) => {
  render(
    <URLFilterSection
      variantIndex={1}
      config={{ changes: [], urlFilter }}
      onConfigChange={jest.fn()}
      canEdit={true}
    />
  )
  fireEvent.click(document.getElementById("url-filtering-toggle-variant-1")!)
}

const modeSelect = () =>
  document.getElementById("url-filter-mode-variant-1") as HTMLSelectElement

describe("URLFilterSection initial mode (FT-2251)", () => {
  it("reopens a filter saved from Simple mode as Simple with its pattern", async () => {
    renderSection({
      include: ["/products/*"],
      mode: "simple",
      matchType: "path"
    })
    expect(await screen.findByDisplayValue("/products/*")).toBeInTheDocument()
    expect(modeSelect().value).toBe("simple")
  })

  it("keeps Advanced for filters with exclusions", () => {
    renderSection({
      include: ["/products/*"],
      exclude: ["/products/old"],
      mode: "simple",
      matchType: "path"
    })
    expect(modeSelect().value).toBe("advanced")
  })

  it("keeps Advanced for regex filters", () => {
    renderSection({ include: ["^/p/\\d+$"], mode: "regex", matchType: "path" })
    expect(modeSelect().value).toBe("advanced")
  })

  it("still shows All pages when there is no filter", () => {
    renderSection(undefined)
    expect(modeSelect().value).toBe("all")
  })
})
