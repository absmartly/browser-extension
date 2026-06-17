import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { VariantScreenshots } from "~src/components/VariantScreenshots"
import type { VariantScreenshot } from "~src/types/ai-fill"

const sample: VariantScreenshot[] = [
  {
    variantIndex: 1,
    variantName: "Variant 1",
    beforeDataUrl: "data:image/png;base64,A",
    afterDataUrl: "data:image/png;base64,B",
    width: 1280,
    height: 800
  }
]

describe("VariantScreenshots", () => {
  it("renders one thumbnail per variant", () => {
    render(<VariantScreenshots screenshots={sample} />)
    expect(screen.getByTestId("variant-thumb-1")).toBeInTheDocument()
  })

  it("opens the viewer on thumbnail click and closes it from the viewer", () => {
    render(<VariantScreenshots screenshots={sample} />)
    fireEvent.click(screen.getByTestId("variant-thumb-1"))
    expect(screen.getByTestId("screenshot-viewer")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("screenshot-viewer-close"))
    expect(screen.queryByTestId("screenshot-viewer")).not.toBeInTheDocument()
  })
})
