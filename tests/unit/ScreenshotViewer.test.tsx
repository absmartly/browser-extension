import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { ScreenshotViewer } from "~src/components/ScreenshotViewer"

describe("ScreenshotViewer", () => {
  it("shows the After image by default and toggles to Before", () => {
    render(
      <ScreenshotViewer
        variantName="Variant 1"
        beforeDataUrl="data:image/png;base64,A"
        afterDataUrl="data:image/png;base64,B"
        onClose={jest.fn()}
      />
    )
    const img = screen.getByTestId("screenshot-viewer-img") as HTMLImageElement
    expect(img.src).toContain("B")
    fireEvent.click(screen.getByTestId("screenshot-viewer-toggle"))
    expect((screen.getByTestId("screenshot-viewer-img") as HTMLImageElement).src).toContain("A")
  })

  it("calls onClose when the close button is clicked", () => {
    const onClose = jest.fn()
    render(
      <ScreenshotViewer
        variantName="Variant 1"
        beforeDataUrl="data:image/png;base64,A"
        afterDataUrl="data:image/png;base64,B"
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByTestId("screenshot-viewer-close"))
    expect(onClose).toHaveBeenCalled()
  })

  it("calls onClose when Escape is pressed", () => {
    const onClose = jest.fn()
    render(
      <ScreenshotViewer
        variantName="Variant 1"
        beforeDataUrl="data:image/png;base64,A"
        afterDataUrl="data:image/png;base64,B"
        onClose={onClose}
      />
    )
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
