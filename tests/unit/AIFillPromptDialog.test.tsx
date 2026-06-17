import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { AIFillPromptDialog } from "~src/components/AIFillPromptDialog"

describe("AIFillPromptDialog", () => {
  it("renders an empty textarea when opened", () => {
    render(
      <AIFillPromptDialog
        open
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    )
    expect(screen.getByTestId("ai-fill-prompt-textarea")).toHaveValue("")
  })

  it("calls onConfirm with the typed prompt", () => {
    const onConfirm = jest.fn()
    render(
      <AIFillPromptDialog
        open
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    )
    fireEvent.change(screen.getByTestId("ai-fill-prompt-textarea"), {
      target: { value: "Focus on mobile only" }
    })
    fireEvent.click(screen.getByTestId("ai-fill-prompt-confirm"))
    expect(onConfirm).toHaveBeenCalledWith("Focus on mobile only")
  })

  it("calls onConfirm with empty string when Skip is clicked", () => {
    const onConfirm = jest.fn()
    render(
      <AIFillPromptDialog
        open
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("ai-fill-prompt-skip"))
    expect(onConfirm).toHaveBeenCalledWith("")
  })

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = jest.fn()
    render(
      <AIFillPromptDialog
        open
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByTestId("ai-fill-prompt-cancel"))
    expect(onCancel).toHaveBeenCalled()
  })

  it("renders nothing when open is false", () => {
    const { container } = render(
      <AIFillPromptDialog
        open={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
