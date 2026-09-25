import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import { UnsavedChangesModal } from "../UnsavedChangesModal"

describe("UnsavedChangesModal", () => {
  const defaultProps = {
    isOpen: true,
    onSave: jest.fn(),
    onDiscard: jest.fn(),
    onCancel: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <UnsavedChangesModal {...defaultProps} isOpen={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders heading and message when open", () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("Save changes?")).toBeInTheDocument()
    expect(
      screen.getByText("You have unsaved changes. Save them before leaving?")
    ).toBeInTheDocument()
  })

  it("calls onSave when Save button is clicked", () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1)
    expect(defaultProps.onDiscard).not.toHaveBeenCalled()
    expect(defaultProps.onCancel).not.toHaveBeenCalled()
  })

  it("calls onDiscard when Discard button is clicked", () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    expect(defaultProps.onDiscard).toHaveBeenCalledTimes(1)
    expect(defaultProps.onSave).not.toHaveBeenCalled()
    expect(defaultProps.onCancel).not.toHaveBeenCalled()
  })

  it("calls onCancel when Cancel button is clicked", () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
    expect(defaultProps.onSave).not.toHaveBeenCalled()
    expect(defaultProps.onDiscard).not.toHaveBeenCalled()
  })

  it("disables all buttons and shows 'Saving...' on Save when saving=true", () => {
    render(<UnsavedChangesModal {...defaultProps} saving={true} />)
    const saveButton = screen.getByRole("button", { name: "Saving..." })
    const discardButton = screen.getByRole("button", { name: "Discard" })
    const cancelButton = screen.getByRole("button", { name: "Cancel" })

    expect(saveButton).toBeDisabled()
    expect(discardButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
  })

  it("does not call handlers when buttons are clicked while saving", () => {
    render(<UnsavedChangesModal {...defaultProps} saving={true} />)
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(defaultProps.onDiscard).not.toHaveBeenCalled()
    expect(defaultProps.onCancel).not.toHaveBeenCalled()
  })

  it("renders three buttons in the order Cancel, Discard, Save", () => {
    render(<UnsavedChangesModal {...defaultProps} />)
    const buttons = screen.getAllByRole("button")
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Cancel",
      "Discard",
      "Save"
    ])
  })

  describe("keyboard behaviour", () => {
    it("moves focus into the dialog when it opens", () => {
      render(<UnsavedChangesModal {...defaultProps} />)
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()
    })

    it("keeps Tab and Shift+Tab focus inside the dialog", () => {
      render(
        <>
          <button id="behind-overlay">Behind</button>
          <UnsavedChangesModal {...defaultProps} />
        </>
      )
      const cancel = screen.getByRole("button", { name: "Cancel" })
      const save = screen.getByRole("button", { name: "Save" })
      save.focus()
      fireEvent.keyDown(save, { key: "Tab" })
      expect(cancel).toHaveFocus()
      fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true })
      expect(save).toHaveFocus()
    })

    it("cancels on Escape", () => {
      render(<UnsavedChangesModal {...defaultProps} />)
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
      expect(defaultProps.onDiscard).not.toHaveBeenCalled()
      expect(defaultProps.onSave).not.toHaveBeenCalled()
    })

    it("ignores Escape while saving", () => {
      render(<UnsavedChangesModal {...defaultProps} saving={true} />)
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
      expect(defaultProps.onCancel).not.toHaveBeenCalled()
    })

    it("keeps focus inside the dialog while Save is in flight", () => {
      const { rerender } = render(
        <>
          <button id="behind-overlay">Behind</button>
          <UnsavedChangesModal {...defaultProps} />
        </>
      )
      screen.getByRole("button", { name: "Save" }).focus()
      rerender(
        <>
          <button id="behind-overlay">Behind</button>
          <UnsavedChangesModal {...defaultProps} saving={true} />
        </>
      )
      const dialog = screen.getByRole("dialog")
      expect(dialog).toHaveFocus()
      fireEvent.keyDown(dialog, { key: "Tab" })
      expect(dialog).toHaveFocus()
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })
      expect(dialog).toHaveFocus()
      fireEvent.keyDown(dialog, { key: "Escape" })
      expect(defaultProps.onCancel).not.toHaveBeenCalled()

      rerender(
        <>
          <button id="behind-overlay">Behind</button>
          <UnsavedChangesModal {...defaultProps} saving={false} />
        </>
      )
      fireEvent.keyDown(dialog, { key: "Tab" })
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()
    })

    it("restores focus to the element that opened it after closing", () => {
      function Harness() {
        const [open, setOpen] = React.useState(false)
        return (
          <>
            <button id="opener" onClick={() => setOpen(true)}>
              Back
            </button>
            <UnsavedChangesModal
              {...defaultProps}
              isOpen={open}
              onCancel={() => setOpen(false)}
            />
          </>
        )
      }
      render(<Harness />)
      const opener = screen.getByRole("button", { name: "Back" })
      opener.focus()
      fireEvent.click(opener)
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
      expect(screen.queryByRole("dialog")).toBeNull()
      expect(opener).toHaveFocus()
    })
  })
})
