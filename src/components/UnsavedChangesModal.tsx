import React, { useEffect, useRef } from "react"

import { Button } from "./ui/Button"

interface UnsavedChangesModalProps {
  isOpen: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
  saving?: boolean
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function UnsavedChangesModal({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
  saving = false
}: UnsavedChangesModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  const savingRef = useRef(saving)
  savingRef.current = saving

  // Move focus into the dialog when it opens and restore it to the element
  // that opened it (e.g. the header Back button) when it closes.
  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const cancelButton = dialogRef.current?.querySelector<HTMLElement>(
      "#unsaved-changes-cancel"
    )
    ;(cancelButton ?? dialogRef.current)?.focus()
    return () => {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [isOpen])

  // While saving, every action button is disabled and the browser drops focus
  // from the pressed button to <body>, outside the Tab trap. Keep focus on
  // the dialog itself until the buttons are usable again.
  useEffect(() => {
    if (!isOpen || !saving || !dialogRef.current) return
    const active = document.activeElement as HTMLButtonElement | null
    if (!dialogRef.current.contains(active) || active?.disabled) {
      dialogRef.current.focus()
    }
  }, [isOpen, saving])

  if (!isOpen) return null

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      if (!savingRef.current) onCancelRef.current()
      return
    }
    if (event.key !== "Tab" || !dialogRef.current) return

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    )
    if (focusable.length === 0) {
      event.preventDefault()
      dialogRef.current.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    const inside = !!active && dialogRef.current.contains(active)
    if (
      event.shiftKey &&
      (!inside || active === first || active === dialogRef.current)
    ) {
      event.preventDefault()
      last.focus()
    } else if (
      !event.shiftKey &&
      (!inside || active === last || active === dialogRef.current)
    ) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={dialogRef}
      id="unsaved-changes-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-heading"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 focus:outline-none">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3
          id="unsaved-changes-heading"
          className="text-lg font-semibold text-gray-900 mb-2">
          Save changes?
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          You have unsaved changes. Save them before leaving?
        </p>
        <div className="flex justify-end space-x-2">
          <Button
            id="unsaved-changes-cancel"
            onClick={onCancel}
            variant="secondary"
            size="sm"
            disabled={saving}>
            Cancel
          </Button>
          <Button
            id="unsaved-changes-discard"
            onClick={onDiscard}
            variant="secondary"
            size="sm"
            disabled={saving}>
            Discard
          </Button>
          <Button
            id="unsaved-changes-save"
            onClick={onSave}
            variant="primary"
            size="sm"
            disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
