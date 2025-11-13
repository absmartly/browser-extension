import React, { useState, useRef, useEffect } from 'react'
import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { ArrowLeftIcon, SparklesIcon, PlusIcon, XMarkIcon, PhotoIcon, ClockIcon, EyeIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { ChangeViewerModal } from './ChangeViewerModal'
import { renderMarkdown } from '~src/utils/markdown'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  domChangesSnapshot?: DOMChange[]
  timestamp: number
  id: string
  aiResponse?: string
}

interface AIDOMChangesPageProps {
  variantName: string
  currentChanges: DOMChange[]
  onBack: () => void
  onGenerate: (prompt: string, images?: string[]) => Promise<AIDOMGenerationResult>
  onRestoreChanges: (changes: DOMChange[]) => void
}

export const AIDOMChangesPage = React.memo(function AIDOMChangesPage({
  variantName,
  currentChanges,
  onBack,
  onGenerate,
  onRestoreChanges
}: AIDOMChangesPageProps) {

  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [attachedImages, setAttachedImages] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [viewerModal, setViewerModal] = useState<{ changes: DOMChange[], response: string, timestamp: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const historyButtonRef = useRef<HTMLButtonElement>(null)

  // Check if onGenerate function is missing (e.g., after page reload)
  const isFunctionMissing = !onGenerate || typeof onGenerate !== 'function'

  if (isFunctionMissing) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-6 w-6 text-purple-600" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">AI DOM Generator</h1>
                <p className="text-xs text-gray-500">Variant: {variantName}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 mb-3">
                The AI generator needs to be reinitialized after page reload.
              </p>
              <Button
                onClick={onBack}
                className="w-full"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Return to Variant Editor
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Your chat history has been preserved and will be restored when you return to this page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Load chat history for this variant on mount
  useEffect(() => {
    const storage = new Storage({ area: "local" })
    const storageKey = `ai-chat-${variantName}`

    storage.get<ChatMessage[]>(storageKey).then(savedHistory => {
      if (savedHistory && Array.isArray(savedHistory)) {
        setChatHistory(savedHistory)
      }
    })
  }, [variantName])

  // Save chat history whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      const storage = new Storage({ area: "local" })
      const storageKey = `ai-chat-${variantName}`
      storage.set(storageKey, chatHistory)
    }
  }, [chatHistory, variantName])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showHistory && historyButtonRef.current && !historyButtonRef.current.contains(event.target as Node)) {
        const dropdown = document.querySelector('.absolute.right-0.mt-2.w-80')
        if (dropdown && !dropdown.contains(event.target as Node)) {
          setShowHistory(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHistory])

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
      const images = await Promise.all(imagePromises)
      setAttachedImages(prev => [...prev, ...images])
    } catch (err) {
      setError('Failed to load images')
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
    setAttachedImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleGenerate = async () => {
    console.log('[AIDOMChangesPage] handleGenerate called, prompt:', prompt, 'images:', attachedImages.length)

    if (!prompt.trim() && attachedImages.length === 0) {
      console.log('[AIDOMChangesPage] Empty prompt and no images')
      setError('Please enter a prompt or attach an image')
      return
    }

    console.log('[AIDOMChangesPage] Setting loading to true')
    setLoading(true)
    setError(null)

    const timestamp = Date.now()
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt,
      images: attachedImages.length > 0 ? [...attachedImages] : undefined,
      timestamp,
      id: `user-${timestamp}`
    }
    setChatHistory(prev => [...prev, userMessage])

    try {
      const result = await onGenerate(prompt, attachedImages.length > 0 ? attachedImages : undefined)

      const assistantTimestamp = Date.now()
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.response,
        aiResponse: result.response,
        domChangesSnapshot: result.domChanges,
        timestamp: assistantTimestamp,
        id: `assistant-${assistantTimestamp}`
      }
      setChatHistory(prev => [...prev, assistantMessage])
      setPrompt('')
      setAttachedImages([])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate DOM changes'
      setError(errorMessage)
      setChatHistory(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const handleNewChat = () => {
    setChatHistory([])
    setPrompt('')
    setAttachedImages([])
    setError(null)

    // Clear persisted chat history
    const storage = new Storage({ area: "local" })
    const storageKey = `ai-chat-${variantName}`
    storage.remove(storageKey)
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            title="Back"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-6 w-6 text-purple-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                AI DOM Generator
              </h2>
              <p className="text-xs text-gray-600">Variant: {variantName}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              ref={historyButtonRef}
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title="Chat History"
              disabled={chatHistory.length === 0}
            >
              <ClockIcon className={`h-5 w-5 ${chatHistory.length === 0 ? 'text-gray-300' : 'text-gray-600'}`} />
            </button>
            {showHistory && chatHistory.length > 0 && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Chat History</h3>
                  <p className="text-xs text-gray-600">{chatHistory.length} messages</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {chatHistory.map((message, index) => (
                    <div
                      key={index}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        const element = document.querySelector(`[data-message-index="${index}"]`)
                        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        setShowHistory(false)
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          message.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {message.role === 'user' ? 'U' : 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-1">
                            {message.role === 'user' ? 'You' : 'Assistant'}
                          </p>
                          <p className="text-sm text-gray-900 line-clamp-2">
                            {message.content || '(Image only)'}
                          </p>
                          {message.images && message.images.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              📷 {message.images.length} image{message.images.length > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleNewChat}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            title="New Chat"
          >
            <PlusIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <SparklesIcon className="h-16 w-16 text-purple-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              AI-Powered DOM Changes
            </h3>
            <p className="text-gray-600 max-w-md mb-4">
              Describe what you want to change on the page, and the AI will analyze the HTML
              and generate the appropriate DOM changes for you.
            </p>
            <p className="text-sm text-purple-600 font-medium mb-2">
              💡 You can paste or drag images to help the AI understand your request!
            </p>
            <div className="mt-6 space-y-2 text-left w-full max-w-md">
              <p className="text-sm text-gray-700 font-medium">Example prompts:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Change the CTA button to red with white text</li>
                <li>• Add rounded corners to all product images</li>
                <li>• Hide the promotional banner</li>
                <li>• Make the headline text larger and bold</li>
                <li>• Replace the logo with this image (paste/drag image)</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-4">
            {chatHistory.map((message, index) => (
              <div
                key={message.id || index}
                data-message-index={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.images && message.images.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {message.images.map((img, imgIndex) => (
                        <img
                          key={imgIndex}
                          src={img}
                          alt={`Attached ${imgIndex + 1}`}
                          className="max-w-full rounded border border-white/20"
                          style={{ maxHeight: '200px' }}
                        />
                      ))}
                    </div>
                  )}
                  {message.content && (
                    message.role === 'assistant' && message.aiResponse ? (
                      <div
                        className="text-sm prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.aiResponse) }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )
                  )}
                  {message.role === 'assistant' && message.domChangesSnapshot && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                      <button
                        onClick={() => setViewerModal({
                          changes: message.domChangesSnapshot!,
                          response: message.aiResponse || '',
                          timestamp: message.timestamp
                        })}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        <EyeIcon className="h-4 w-4" />
                        View Changes ({message.domChangesSnapshot.length})
                      </button>
                      <button
                        onClick={() => {
                          if (message.domChangesSnapshot) {
                            onRestoreChanges(message.domChangesSnapshot)
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-300 rounded hover:bg-purple-100 transition-colors"
                      >
                        <ArrowUturnLeftIcon className="h-4 w-4" />
                        Restore
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

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

        {attachedImages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedImages.map((img, index) => (
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
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={loading}
            placeholder="Example: Change the CTA button to red with white text and rounded corners. You can also paste or drag images here!"
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to send • Paste or drag images
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

        <Button
          id="ai-generate-button"
          onClick={handleGenerate}
          disabled={loading || (!prompt.trim() && attachedImages.length === 0)}
          className="w-full"
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
      </div>

      {viewerModal && (
        <ChangeViewerModal
          isOpen={true}
          onClose={() => setViewerModal(null)}
          changes={viewerModal.changes}
          response={viewerModal.response}
          timestamp={viewerModal.timestamp}
        />
      )}
    </div>
  )
})
