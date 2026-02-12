import React, { useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { SparklesIcon, PhotoIcon, XMarkIcon, EyeIcon } from '@heroicons/react/24/outline'

interface ChatInputProps {
  prompt: string
  onPromptChange: (value: string) => void
  loading: boolean
  onSubmit: () => void
  images: string[]
  onImagesChange: (images: string[]) => void
  error: string | null
  isPreviewEnabled: boolean
  onPreviewToggle: () => void
}

export function ChatInput({
  prompt,
  onPromptChange,
  loading,
  onSubmit,
  images,
  onImagesChange,
  error,
  isPreviewEnabled,
  onPreviewToggle
}: ChatInputProps) {
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))

    const imagePromises = imageFiles.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    })

    try {
      const newImages = await Promise.all(imagePromises)
      onImagesChange([...images, ...newImages])
    } catch (err) {
      console.error('Failed to load images:', err)
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return

    e.preventDefault()

    const files = imageItems.map(item => item.getAsFile()).filter((f): f is File => f !== null)
    await handleImageFiles(files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer?.files
    if (files) {
      await handleImageFiles(files)
    }
  }

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div
      className={`border-t border-gray-200 p-4 bg-gray-50 ${isDragging ? 'bg-purple-50 border-purple-300' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-purple-100/90 border-2 border-dashed border-purple-400 rounded-lg flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <PhotoIcon className="h-12 w-12 text-purple-600 mx-auto mb-2" />
            <p className="text-purple-900 font-medium">Drop images here</p>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {images.map((img, index) => (
            <div key={index} className="relative group">
              <img
                src={img}
                alt={`Attachment ${index + 1}`}
                className="h-20 w-20 object-cover rounded border border-gray-300"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove image"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="ai-prompt" className="block text-sm font-medium text-gray-700 mb-2">
          What would you like to change?
        </label>
        <textarea
          ref={textareaRef}
          id="ai-prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={loading}
          placeholder="Example: Change the CTA button to red with white text and rounded corners. You can also paste or drag images here!"
          className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
        />
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Press Enter to send • Shift+Enter for new line • Paste or drag images
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleImageFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            <PhotoIcon className="h-4 w-4" />
            Add Image
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Button
          id="ai-generate-button"
          onClick={onSubmit}
          disabled={loading || (!prompt.trim() && images.length === 0)}
          data-loading={loading ? 'true' : 'false'}
          className="flex-1"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Generating...
            </>
          ) : (
            <>
              <SparklesIcon className="h-4 w-4 mr-2" />
              Generate DOM Changes
            </>
          )}
        </Button>
        <button
          id="vibe-studio-preview-toggle"
          onClick={onPreviewToggle}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            isPreviewEnabled
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          title={isPreviewEnabled ? 'Preview is ON' : 'Preview is OFF'}
        >
          <EyeIcon className="h-4 w-4" />
          {isPreviewEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
