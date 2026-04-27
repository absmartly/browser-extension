import React from "react"

import { Button } from "./ui/Button"

interface UnsavedChangesModalProps {
  isOpen: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
  saving?: boolean
}

export function UnsavedChangesModal({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
  saving = false
}: UnsavedChangesModalProps) {
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
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
