import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { AIFillButton } from "~src/components/AIFillButton"
import { fillExperimentFromAI } from "~src/lib/ai-experiment-filler"
import { captureVisibleTab } from "~src/utils/screenshot-capture"

jest.mock("~src/lib/ai-experiment-filler")
jest.mock("~src/utils/screenshot-capture")

beforeAll(() => {
  // Use a microtask-based polyfill so async flows in the component resolve
  // within `await act(...)` without needing fake timers.
  global.requestAnimationFrame = ((cb: any) => {
    Promise.resolve().then(() => cb(0))
    return 0
  }) as typeof requestAnimationFrame
})

const baseProps = {
  draft: {
    name: "",
    display_name: "",
    percentage_of_traffic: 100,
    percentages: "50/50",
    audience: "{}",
    audience_strict: false,
    application_ids: [] as number[],
    tag_ids: [] as number[],
    variantNames: ["Control"],
    customFieldValues: {}
  },
  customFields: [],
  pageUrl: "https://example.com",
  pageTitle: "Example",
  pageVisibleText: "Hello",
  variantDomChanges: [] as any,
  onPreviewToggle: jest.fn(),
  onPreviewWithChanges: jest.fn(),
  aiProviderConfig: { aiProvider: "claude-subscription" as const },
  onResult: jest.fn()
}

describe("AIFillButton", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(captureVisibleTab as jest.Mock).mockResolvedValue("data:image/png;base64,X")
    ;(fillExperimentFromAI as jest.Mock).mockResolvedValue({
      display_name: "Generated"
    })
  })

  it("opens the prompt dialog when clicked", () => {
    render(<AIFillButton {...baseProps} />)
    fireEvent.click(screen.getByTestId("ai-fill-button"))
    expect(screen.getByTestId("ai-fill-prompt-dialog")).toBeInTheDocument()
  })

  it("calls fillExperimentFromAI without screenshots when no variant has changes", async () => {
    render(<AIFillButton {...baseProps} />)
    fireEvent.click(screen.getByTestId("ai-fill-button"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("ai-fill-prompt-skip"))
    })
    expect(captureVisibleTab).not.toHaveBeenCalled()
    expect(fillExperimentFromAI).toHaveBeenCalled()
    const req = (fillExperimentFromAI as jest.Mock).mock.calls[0][0]
    expect(req.variantScreenshots).toHaveLength(0)
    expect(baseProps.onResult).toHaveBeenCalledWith(
      { display_name: "Generated" },
      []
    )
  })

  it("captures before/after for each variant with DOM changes and forwards them", async () => {
    const props = {
      ...baseProps,
      onPreviewToggle: jest.fn(),
      onPreviewWithChanges: jest.fn(),
      onResult: jest.fn(),
      variantDomChanges: [
        {
          variantIndex: 1,
          variantName: "Variant 1",
          changes: [{ selector: ".x", action: "text", value: "Y" }] as any
        }
      ]
    }
    ;(captureVisibleTab as jest.Mock)
      .mockResolvedValueOnce("data:image/png;base64,BEFORE")
      .mockResolvedValueOnce("data:image/png;base64,AFTER")

    render(<AIFillButton {...props} />)
    fireEvent.click(screen.getByTestId("ai-fill-button"))
    await act(async () => {
      fireEvent.click(screen.getByTestId("ai-fill-prompt-skip"))
    })

    expect(props.onPreviewToggle).toHaveBeenCalledWith(false)
    expect(props.onPreviewWithChanges).toHaveBeenCalledWith(true, expect.any(Array))
    expect(captureVisibleTab).toHaveBeenCalledTimes(2)
    const req = (fillExperimentFromAI as jest.Mock).mock.calls[0][0]
    expect(req.variantScreenshots).toHaveLength(1)
    expect(req.variantScreenshots[0].beforeDataUrl).toContain("BEFORE")
    expect(req.variantScreenshots[0].afterDataUrl).toContain("AFTER")
    expect(props.onResult).toHaveBeenCalledWith(
      { display_name: "Generated" },
      [
        expect.objectContaining({
          variantIndex: 1,
          beforeDataUrl: expect.stringContaining("BEFORE"),
          afterDataUrl: expect.stringContaining("AFTER")
        })
      ]
    )
  })
})
