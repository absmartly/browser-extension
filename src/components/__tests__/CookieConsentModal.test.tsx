import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import { CookieConsentModal } from "../CookieConsentModal"
import { UnsavedChangesModal } from "../UnsavedChangesModal"

describe("CookieConsentModal", () => {
  const props = { onGrant: jest.fn(), onDeny: jest.fn() }

  beforeEach(() => jest.clearAllMocks())

  it("is a modal dialog that takes focus when it opens", () => {
    render(<CookieConsentModal {...props} isOpen={true} />)
    const dialog = screen.getByRole("dialog", {
      name: "ABsmartly Access Required"
    })
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(screen.getByRole("button", { name: "Grant Access" })).toHaveFocus()
  })

  it("is keyboard-usable when it opens over the unsaved-changes dialog, and returns focus to it", () => {
    const unsaved = {
      isOpen: true,
      onSave: jest.fn(),
      onDiscard: jest.fn(),
      onCancel: jest.fn()
    }
    function Layered({ promptOpen }: { promptOpen: boolean }) {
      return (
        <>
          <UnsavedChangesModal {...unsaved} />
          <CookieConsentModal {...props} isOpen={promptOpen} />
        </>
      )
    }
    const { rerender } = render(<Layered promptOpen={false} />)
    const unsavedCancel = document.getElementById(
      "unsaved-changes-cancel"
    ) as HTMLElement
    expect(unsavedCancel).toHaveFocus()

    rerender(<Layered promptOpen={true} />)
    const grant = screen.getByRole("button", { name: "Grant Access" })
    expect(grant).toHaveFocus()
    const promptCancel = document.getElementById(
      "cookie-consent-cancel"
    ) as HTMLElement
    fireEvent.keyDown(grant, { key: "Tab", shiftKey: true })
    expect(promptCancel).toHaveFocus()
    fireEvent.keyDown(promptCancel, { key: "Tab" })
    expect(grant).toHaveFocus()
    promptCancel.focus()
    expect(promptCancel).toHaveFocus()
    fireEvent.click(promptCancel)
    expect(props.onDeny).toHaveBeenCalledTimes(1)

    rerender(<Layered promptOpen={false} />)
    expect(unsavedCancel).toHaveFocus()
  })
})
