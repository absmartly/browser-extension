import React, { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { SystemPromptEditor, getSystemPromptOverride, clearSystemPromptOverride } from '../SystemPromptEditor'

interface SystemPromptSectionProps {
  onPromptChange?: (hasOverride: boolean) => void
}

export const SystemPromptSection = React.memo(function SystemPromptSection({
  onPromptChange
}: SystemPromptSectionProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [hasOverride, setHasOverride] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkForOverride()
  }, [])

  const checkForOverride = async () => {
    setIsLoading(true)
    try {
      const override = await getSystemPromptOverride()
      const hasPrompt = !!override
      setHasOverride(hasPrompt)
      onPromptChange?.(hasPrompt)
    } catch (error) {
      console.error('Failed to check system prompt override:', error)
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

  const handleSavePrompt = async (prompt: string) => {
    setHasOverride(true)
    onPromptChange?.(true)
    await checkForOverride()
  }

  const handleResetToDefault = async () => {
    if (!confirm('Reset to default system prompt? This will remove your custom override.')) {
      return
    }

    try {
      await clearSystemPromptOverride()
      setHasOverride(false)
      onPromptChange?.(false)
    } catch (error) {
      console.error('Failed to reset system prompt:', error)
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
          AI Chat System Prompt
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Customize the system prompt used for AI-powered DOM generation. The default prompt provides comprehensive instructions for DOM change generation.
        </p>
        <p className="text-xs text-blue-600 mb-3">
          💡 Note: The editor opens full-screen on your current web page. Navigate to any website first, then click the button below.
        </p>

        <div className="flex items-center gap-2">
          <Button
            id="edit-system-prompt-button"
            onClick={handleOpenEditor}
            variant="secondary"
          >
            {hasOverride ? 'Edit Custom Prompt' : 'Customize Prompt'}
          </Button>

          {hasOverride && (
            <Button
              id="reset-system-prompt-button"
              onClick={handleResetToDefault}
              variant="secondary"
            >
              Reset to Default
            </Button>
          )}
        </div>

        {hasOverride && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-700">
              ✓ Using custom system prompt
            </p>
          </div>
        )}
      </div>

      <SystemPromptEditor
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        onSave={handleSavePrompt}
      />
    </>
  )
})
