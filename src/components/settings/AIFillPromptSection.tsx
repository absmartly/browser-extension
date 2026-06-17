import React, { useEffect, useState } from "react"

import {
  AIFillPromptEditor,
  clearAIFillPromptOverride,
  getAIFillPromptOverride
} from "../AIFillPromptEditor"
import { Button } from "../ui/Button"

interface AIFillPromptSectionProps {
  onPromptChange?: (hasOverride: boolean) => void
}

export const AIFillPromptSection = React.memo(function AIFillPromptSection({
  onPromptChange
}: AIFillPromptSectionProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [hasOverride, setHasOverride] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkForOverride()
  }, [])

  const checkForOverride = async () => {
    setIsLoading(true)
    try {
      const override = await getAIFillPromptOverride()
      const hasPrompt = !!override
      setHasOverride(hasPrompt)
      onPromptChange?.(hasPrompt)
    } catch (error) {
      console.error("Failed to check AI Fill prompt override:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenEditor = () => {
    setIsEditorOpen(true)
  }

  const handleCloseEditor = () => {
    setIsEditorOpen(false)
  }

  const handleSavePrompt = async (_prompt: string) => {
    setHasOverride(true)
    onPromptChange?.(true)
    await checkForOverride()
  }

  const handleResetToDefault = async () => {
    if (
      !confirm(
        "Reset to default Fill with AI prompt? This will remove your custom override."
      )
    ) {
      return
    }

    try {
      await clearAIFillPromptOverride()
      setHasOverride(false)
      onPromptChange?.(false)
    } catch (error) {
      console.error("Failed to reset AI Fill prompt:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="border-t pt-4 mt-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="border-t pt-4 mt-4">
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Fill with AI System Prompt
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Customize the system prompt used by the &quot;Fill with AI&quot;
          button in the experiment editor. The default prompt instructs the
          model to fill every field of the experiment form (display name,
          hypothesis, custom fields, applications, tags, metrics, variants, …)
          based on the page context and any DOM changes already authored.
        </p>
        <p className="text-xs text-blue-600 mb-3">
          💡 Note: The editor opens full-screen on your current web page.
          Navigate to any website first, then click the button below.
        </p>

        <div className="flex items-center gap-2">
          <Button
            id="edit-ai-fill-prompt-button"
            onClick={handleOpenEditor}
            variant="secondary">
            {hasOverride ? "Edit Custom Prompt" : "Customize Prompt"}
          </Button>

          {hasOverride && (
            <Button
              id="reset-ai-fill-prompt-button"
              onClick={handleResetToDefault}
              variant="secondary">
              Reset to Default
            </Button>
          )}
        </div>

        {hasOverride && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-700">
              ✓ Using custom Fill with AI prompt
            </p>
          </div>
        )}
      </div>

      <AIFillPromptEditor
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        onSave={handleSavePrompt}
      />
    </>
  )
})
