import React, { useState } from "react"

interface AIFillPromptDialogProps {
  open: boolean
  onConfirm: (prompt: string) => void
  onCancel: () => void
}

export function AIFillPromptDialog({
  open,
  onConfirm,
  onCancel
}: AIFillPromptDialogProps) {
  const [prompt, setPrompt] = useState("")

  if (!open) return null

  return (
    <div
      id="ai-fill-prompt-overlay"
      data-testid="ai-fill-prompt-overlay"
      className="fixed inset-0 bg-black bg-opacity-50 z-[2147483647] flex items-center justify-center p-4">
      <div
        id="ai-fill-prompt-dialog"
        data-testid="ai-fill-prompt-dialog"
        className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-3">
        <h3 id="ai-fill-prompt-title" className="text-lg font-semibold">
          Fill with AI
        </h3>
        <p className="text-sm text-gray-600">
          Optional: add any extra context the AI should consider before filling
          the form. The current draft, page content, and any authored DOM
          changes are sent automatically.
        </p>
        <textarea
          id="ai-fill-prompt-textarea"
          data-testid="ai-fill-prompt-textarea"
          className="w-full border border-gray-300 rounded p-2 text-sm min-h-[100px]"
          placeholder="e.g. Focus on mobile users; emphasize urgency in the hypothesis."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            id="ai-fill-prompt-cancel"
            data-testid="ai-fill-prompt-cancel"
            type="button"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            onClick={onCancel}>
            Cancel
          </button>
          <button
            id="ai-fill-prompt-skip"
            data-testid="ai-fill-prompt-skip"
            type="button"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            onClick={() => onConfirm("")}>
            Skip & Fill
          </button>
          <button
            id="ai-fill-prompt-confirm"
            data-testid="ai-fill-prompt-confirm"
            type="button"
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => onConfirm(prompt)}>
            Fill with AI
          </button>
        </div>
      </div>
    </div>
  )
}
