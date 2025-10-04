import React, { useState } from 'react'
import { Button } from './ui/Button'
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline'

interface AIDOMChangesDialogProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (prompt: string) => Promise<void>
  variantName: string
}

export function AIDOMChangesDialog({
  isOpen,
  onClose,
  onGenerate,
  variantName
}: AIDOMChangesDialogProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onGenerate(prompt)
      setPrompt('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate DOM changes')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Generate DOM Changes with AI
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Variant: <span className="font-medium text-gray-900">{variantName}</span>
            </p>
            <p className="text-sm text-gray-600">
              Describe what you want to change on the page. The AI will analyze the HTML and generate appropriate DOM changes.
            </p>
          </div>

          <div className="mb-4">
            <label htmlFor="ai-prompt" className="block text-sm font-medium text-gray-700 mb-2">
              What would you like to change?
            </label>
            <textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Example: Change the CTA button to red with white text and rounded corners"
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
            />
            <p className="mt-1 text-xs text-gray-500">
              Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to generate
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 font-medium mb-1">Example prompts:</p>
            <ul className="text-sm text-blue-700 space-y-1 ml-4 list-disc">
              <li>Change the main CTA button background to blue</li>
              <li>Hide the pricing section</li>
              <li>Add a banner at the top saying "Limited Time Offer"</li>
              <li>Make the headline text bigger and bold</li>
              <li>Change all product images to have rounded corners</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
          >
            {loading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
