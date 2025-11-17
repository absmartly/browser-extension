import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { ArrowLeftIcon, SparklesIcon, PlusIcon, XMarkIcon, PhotoIcon, ClockIcon, EyeIcon, ArrowUturnLeftIcon, TrashIcon } from '@heroicons/react/24/outline'
import { ChangeViewerModal } from './ChangeViewerModal'
import { renderMarkdown } from '~src/utils/markdown'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession, ChatMessage, StoredConversation, ConversationListItem } from '~src/types/absmartly'
import { getConversations, saveConversation, loadConversation, deleteConversation, getConversationList, setActiveConversation } from '~src/utils/ai-conversation-storage'
import { needsMigration, migrateConversation } from '~src/utils/ai-conversation-migration'
import { formatConversationTimestamp } from '~src/utils/time-format'
import { capturePageHTML } from '~src/utils/html-capture'
import { sendToBackground } from '~src/lib/messaging'
import { compressImages } from '~src/utils/image-compression'

interface AIDOMChangesPageProps {
  variantName: string
  currentChanges: DOMChange[]
  onBack: () => void
  onGenerate: (prompt: string, images?: string[], conversationSession?: ConversationSession | null) => Promise<AIDOMGenerationResult>
  onRestoreChanges: (changes: DOMChange[]) => void
  onPreviewToggle?: (enabled: boolean) => void
}

// DIAGNOSTIC: Helper to generate unique mount IDs
const generateMountId = () => `mount-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const AIDOMChangesPage = React.memo(function AIDOMChangesPage({
  variantName,
  currentChanges,
  onBack,
  onGenerate,
  onRestoreChanges,
  onPreviewToggle
}: AIDOMChangesPageProps) {
  console.log('[AIDOMChangesPage] ========== COMPONENT RENDER START ==========')
  console.log('[AIDOMChangesPage] Props:', { variantName, currentChangesCount: currentChanges?.length })

  // DIAGNOSTIC: Track component instance lifecycle
  const mountId = useRef(generateMountId())
  const renderCount = useRef(0)

  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [attachedImages, setAttachedImages] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [viewerModal, setViewerModal] = useState<{ changes: DOMChange[], response: string, timestamp: number } | null>(null)
  const [latestDomChanges, setLatestDomChanges] = useState<DOMChange[]>(currentChanges)
  const [conversationSession, setConversationSession] = useState<ConversationSession | null>(null)
  const [conversationList, setConversationList] = useState<ConversationListItem[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string>('')
  const [isInitialized, setIsInitialized] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const historyButtonRef = useRef<HTMLButtonElement>(null)
  const onPreviewToggleRef = useRef(onPreviewToggle)

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

  // DIAGNOSTIC: Track mount/unmount lifecycle
  useEffect(() => {
    const id = mountId.current
    console.log(JSON.stringify({
      type: 'LIFECYCLE',
      component: 'AIDOMChangesPage',
      event: 'MOUNT',
      mountId: id,
      timestamp: Date.now(),
      props: {
        variantName,
        currentChangesCount: currentChanges?.length
      }
    }))

    return () => {
      console.log(JSON.stringify({
        type: 'LIFECYCLE',
        component: 'AIDOMChangesPage',
        event: 'UNMOUNT',
        mountId: id,
        timestamp: Date.now(),
        totalRenders: renderCount.current
      }))
    }
  }, [])

  // Track preview state
  const [previewActive, setPreviewActive] = useState(false)

  // Keep ref updated with latest callback
  useEffect(() => {
    onPreviewToggleRef.current = onPreviewToggle
  }, [onPreviewToggle])

  // Enable preview mode when entering AI chat (only runs once on mount)
  useEffect(() => {
    if (onPreviewToggleRef.current) {
      console.log('[AIDOMChangesPage] Enabling preview mode on mount')
      onPreviewToggleRef.current(true)
      setPreviewActive(true)
    }
  }, [])

  // Initialize conversation - this should NEVER block the UI from showing
  useEffect(() => {
    console.log('[AIDOMChangesPage] ========== INITIALIZATION START ==========')
    console.log('[AIDOMChangesPage] variantName:', variantName)

    ;(async () => {
      try {
        setIsLoadingHistory(true)

        // Step 1: Check for migration (quick, shouldn't fail)
        if (await needsMigration(variantName)) {
          console.log('[AIDOMChangesPage] Migrating old conversation format')
          await migrateConversation(variantName)
        }

        // Step 2: Load conversation list (quick, shouldn't fail)
        const list = await getConversationList(variantName)
        console.log('[AIDOMChangesPage] Loaded conversation list:', list.length, 'conversations')
        setConversationList(list)
        setIsLoadingHistory(false)

        // Step 3: Load active conversation or create new one
        const activeConv = list.find(c => c.isActive)

        if (activeConv) {
          const loaded = await loadConversation(variantName, activeConv.id)
          if (loaded) {
            setChatHistory(loaded.messages)
            setConversationSession(loaded.conversationSession)
            setCurrentConversationId(loaded.id)
            console.log('[AIDOMChangesPage] Loaded active conversation:', loaded.id)

            // Try to initialize HTML if not sent yet - but don't block on failure
            if (!loaded.conversationSession.htmlSent) {
              initializeSessionHTML(loaded.conversationSession, loaded.id)
                .catch(err => {
                  console.warn('[AIDOMChangesPage] HTML initialization failed (non-blocking):', err)
                })
            }
            return
          }
        }

        // Create new conversation
        const newSession: ConversationSession = {
          id: crypto.randomUUID(),
          htmlSent: false,
          messages: [],
        }
        const newConvId = crypto.randomUUID()

        setConversationSession(newSession)
        setCurrentConversationId(newConvId)
        console.log('[AIDOMChangesPage] Created new conversation:', newConvId)

        // Try to initialize HTML in background - don't block on failure
        initializeSessionHTML(newSession, newConvId)
          .catch(err => {
            console.warn('[AIDOMChangesPage] HTML initialization failed (non-blocking):', err)
          })

      } catch (error) {
        console.error('[AIDOMChangesPage] ❌ INITIALIZATION ERROR:', error)
        setError(error instanceof Error ? error.message : 'Failed to load conversation history')
        setIsLoadingHistory(false)
      }
    })()
  }, [variantName])

  // Initialize HTML context for the session - runs in background, doesn't block UI
  const initializeSessionHTML = async (session: ConversationSession, conversationId: string) => {
    console.log('[initializeSessionHTML] Starting background HTML capture...')

    try {
      const html = await capturePageHTML()
      console.log('[initializeSessionHTML] HTML captured, length:', html.length)

      const response = await sendToBackground({
        type: 'AI_INITIALIZE_SESSION',
        html,
        conversationSession: session
      })

      if (response.success && response.session) {
        const initializedSession = response.session as ConversationSession
        setConversationSession(initializedSession)
        console.log('[initializeSessionHTML] ✅ HTML context initialized successfully')
      } else {
        throw new Error(response.error || 'Failed to initialize session')
      }
    } catch (error) {
      console.error('[initializeSessionHTML] ❌ HTML capture failed:', error)
      // Don't set error state - this is optional functionality
      // User can still chat, just without preemptive HTML context
    }
  }

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
    console.log('[AIDOMChangesPage] Current session:', conversationSession?.id)

    if (!prompt.trim() && attachedImages.length === 0) {
      console.log('[AIDOMChangesPage] Empty prompt and no images')
      setError('Please enter a prompt or attach an image')
      return
    }

    console.log('[AIDOMChangesPage] Setting loading to true')
    setLoading(true)
    setError(null)

    const compressedImages = attachedImages.length > 0 ? await compressImages(attachedImages) : undefined
    console.log('[AIDOMChangesPage] Compressed images:', compressedImages?.length || 0)

    const timestamp = Date.now()
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt,
      images: compressedImages,
      timestamp,
      id: `user-${timestamp}`
    }
    setChatHistory(prev => [...prev, userMessage])

    try {
      const result = await onGenerate(prompt, compressedImages, conversationSession)

      if (result.session) {
        setConversationSession(result.session)
        console.log('[AIDOMChangesPage] Session updated:', result.session.id)
      }

      const assistantTimestamp = Date.now()
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.response,
        aiResponse: result.response,
        domChangesSnapshot: result.domChanges,
        timestamp: assistantTimestamp,
        id: `assistant-${assistantTimestamp}`
      }
      const newHistory = [...chatHistory, userMessage, assistantMessage]
      setChatHistory(newHistory)

      // Auto-save conversation after each message
      const updatedConversation: StoredConversation = {
        id: currentConversationId,
        variantName,
        messages: newHistory,
        conversationSession: result.session || conversationSession!,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: newHistory.length,
        firstUserMessage: newHistory.find(m => m.role === 'user')?.content.substring(0, 50) || 'New conversation',
        isActive: true
      }

      try {
        await saveConversation(updatedConversation)
        await setActiveConversation(variantName, currentConversationId)

        const list = await getConversationList(variantName)
        setConversationList(list)
      } catch (storageError) {
        console.warn('[AIDOMChangesPage] Failed to save conversation:', storageError)
        const warningMessage = storageError instanceof Error
          ? storageError.message
          : 'Failed to save conversation history. Your changes are still applied, but may not be saved.'

        setTimeout(() => {
          if (window.confirm(`${warningMessage}\n\nWould you like to start a new conversation?`)) {
            handleNewChat()
          }
        }, 500)
      }

      // Track the latest DOM changes
      if (result.domChanges && result.domChanges.length > 0) {
        setLatestDomChanges(result.domChanges)
        // Save changes to variant immediately
        if (onRestoreChanges) {
          onRestoreChanges(result.domChanges)
        }

        // If preview is active, refresh it to apply the new changes
        if (previewActive && onPreviewToggleRef.current) {
          console.log('[AIDOMChangesPage] Refreshing preview with new DOM changes from AI')
          // Toggle off then on to force re-application of changes
          onPreviewToggleRef.current(false)
          // Use setTimeout to ensure the off state is processed before turning back on
          setTimeout(() => {
            if (onPreviewToggleRef.current) {
              onPreviewToggleRef.current(true)
              setPreviewActive(true)
            }
          }, 100)
        }
      }

    } catch (err) {
      console.error('[AIDOMChangesPage] Error in handleGenerate:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate DOM changes'
      setError(errorMessage)
      setChatHistory(prev => prev.slice(0, -1))
    } finally {
      console.log('[AIDOMChangesPage] Clearing prompt and images, then setting loading to false')
      setPrompt('')
      setAttachedImages([])
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const handleNewChat = async () => {
    // Save current conversation first
    if (chatHistory.length > 0 && currentConversationId) {
      const currentConv: StoredConversation = {
        id: currentConversationId,
        variantName,
        messages: chatHistory,
        conversationSession: conversationSession!,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: chatHistory.length,
        firstUserMessage: chatHistory.find(m => m.role === 'user')?.content.substring(0, 50) || 'Conversation',
        isActive: false
      }

      try {
        await saveConversation(currentConv)
      } catch (storageError) {
        console.warn('[AIDOMChangesPage] Failed to save conversation before creating new chat:', storageError)
      }
    }

    // Create new conversation
    const newSession: ConversationSession = {
      id: crypto.randomUUID(),
      htmlSent: false,
      messages: [],
    }
    setConversationSession(newSession)

    const newConvId = crypto.randomUUID()
    setCurrentConversationId(newConvId)
    await setActiveConversation(variantName, newConvId)

    setChatHistory([])
    setAttachedImages([])
    setError(null)
    setLatestDomChanges(currentChanges)

    // Refresh conversation list
    const list = await getConversationList(variantName)
    setConversationList(list)

    console.log('[AIDOMChangesPage] New chat session:', newConvId)
  }

  console.log('[AIDOMChangesPage] ========== RENDER START (isInitialized:', isInitialized, 'chatHistory:', chatHistory.length, ') ==========')

  // DIAGNOSTIC: Track each render with structured logging
  renderCount.current++
  console.log(JSON.stringify({
    type: 'LIFECYCLE',
    component: 'AIDOMChangesPage',
    event: 'RENDER',
    mountId: mountId.current,
    renderNumber: renderCount.current,
    timestamp: Date.now(),
    state: {
      isInitialized,
      chatHistoryLength: chatHistory.length,
      conversationSessionId: conversationSession?.id,
      loading,
      error: error ? true : false
    }
  }))

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
              title={isLoadingHistory ? 'Loading conversations...' : 'Conversation History'}
              disabled={isLoadingHistory || conversationList.length === 0}
            >
              {isLoadingHistory ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-600" />
              ) : (
                <ClockIcon className={`h-5 w-5 ${conversationList.length === 0 ? 'text-gray-300' : 'text-gray-600'}`} />
              )}
            </button>
            {showHistory && conversationList.length > 0 && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Conversation History</h3>
                  <p className="text-xs text-gray-600">{conversationList.length} conversation{conversationList.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {conversationList.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3 hover:bg-gray-50 transition-colors group"
                      id={`conversation-${conv.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="flex-1 cursor-pointer min-w-0"
                          onClick={async () => {
                            if (chatHistory.length > 0 && currentConversationId !== conv.id) {
                              const currentConv: StoredConversation = {
                                id: currentConversationId,
                                variantName,
                                messages: chatHistory,
                                conversationSession: conversationSession!,
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                                messageCount: chatHistory.length,
                                firstUserMessage: chatHistory.find(m => m.role === 'user')?.content.substring(0, 50) || 'Conversation',
                                isActive: false
                              }

                              try {
                                await saveConversation(currentConv)
                              } catch (storageError) {
                                console.warn('[AIDOMChangesPage] Failed to save conversation before switching:', storageError)
                              }
                            }

                            const loaded = await loadConversation(variantName, conv.id)
                            if (loaded) {
                              setChatHistory(loaded.messages)
                              setConversationSession(loaded.conversationSession)
                              setCurrentConversationId(loaded.id)
                              await setActiveConversation(variantName, loaded.id)

                              const list = await getConversationList(variantName)
                              setConversationList(list)

                              setShowHistory(false)
                              console.log('[AIDOMChangesPage] Loaded conversation:', loaded.id)
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-medium text-gray-900">
                              {formatConversationTimestamp(conv.createdAt)}
                            </p>
                            {conv.isActive && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-2 mb-1">
                            {conv.firstUserMessage || 'No messages yet'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''} • Updated {formatConversationTimestamp(conv.updatedAt)}
                          </p>
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()

                            if (!confirm('Delete this conversation? This cannot be undone.')) {
                              return
                            }

                            await deleteConversation(variantName, conv.id)

                            if (conv.isActive) {
                              const newSession: ConversationSession = {
                                id: crypto.randomUUID(),
                                htmlSent: false,
                                messages: [],
                              }
                              setConversationSession(newSession)

                              const newConvId = crypto.randomUUID()
                              setCurrentConversationId(newConvId)
                              await setActiveConversation(variantName, newConvId)

                              setChatHistory([])
                              setAttachedImages([])
                              setError(null)
                            }

                            const list = await getConversationList(variantName)
                            setConversationList(list)

                            console.log('[AIDOMChangesPage] Deleted conversation:', conv.id)
                          }}
                          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete conversation"
                          id={`delete-conversation-${conv.id}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
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
                        <div key={imgIndex} className="relative inline-block">
                          <img
                            src={img}
                            alt={`Attached ${imgIndex + 1}`}
                            className="max-w-full rounded border border-white/20"
                            style={{ maxHeight: '200px' }}
                          />
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded backdrop-blur-sm">
                            Thumbnail
                          </div>
                        </div>
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
                            setLatestDomChanges(message.domChangesSnapshot)

                            // Refresh preview if active
                            if (previewActive && onPreviewToggleRef.current) {
                              console.log('[AIDOMChangesPage] Refreshing preview after restoring changes from history')
                              onPreviewToggleRef.current(false)
                              setTimeout(() => {
                                if (onPreviewToggleRef.current) {
                                  onPreviewToggleRef.current(true)
                                  setPreviewActive(true)
                                }
                              }, 100)
                            }
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
