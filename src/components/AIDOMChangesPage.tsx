import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from './ui/Button'
import { Header } from './Header'
import { ArrowLeftIcon, SparklesIcon, PlusIcon, ClockIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { ChangeViewerModal } from './ChangeViewerModal'
import { ChatMessageList } from './ai-chat/ChatMessageList'
import { ChatInput } from './ai-chat/ChatInput'
import { useConversationHistory } from '~src/hooks/useConversationHistory'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession, ChatMessage, StoredConversation } from '~src/types/absmartly'
import { saveConversation, setActiveConversation, getConversationList, deleteConversation } from '~src/utils/ai-conversation-storage'
import { sessionStorage, localAreaStorage } from '~src/utils/storage'
import { formatConversationTimestamp } from '~src/utils/time-format'
import { compressImagesForLLM } from '~src/utils/image-compression'
import { applyDOMChangeAction } from '~src/utils/dom-change-operations'
import { getDOMChangesFromConfig, getChangesConfig, setDOMChangesInConfig } from '~src/hooks/useVariantConfig'

import { debugLog, debugWarn } from '~src/utils/debug'
interface AIDOMChangesPageProps {
  variantName: string
  currentChanges: DOMChange[]
  onBack: () => void
  onGenerate: (prompt: string, images?: string[], conversationSession?: ConversationSession | null) => Promise<AIDOMGenerationResult>
  onRestoreChanges: (changes: DOMChange[]) => void
  onPreviewToggle?: (enabled: boolean) => void
  onPreviewRefresh?: () => void
  onPreviewWithChanges?: (enabled: boolean, changes: DOMChange[]) => void
}

const generateMountId = () => `mount-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const AIDOMChangesPage = React.memo(function AIDOMChangesPage({
  variantName,
  currentChanges,
  onBack,
  onGenerate,
  onRestoreChanges,
  onPreviewToggle,
  onPreviewRefresh,
  onPreviewWithChanges
}: AIDOMChangesPageProps) {
  const mountId = useRef(generateMountId())

  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachedImages, setAttachedImages] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [viewerModal, setViewerModal] = useState<{ changes: DOMChange[], response: string, timestamp: number } | null>(null)
  const [latestDomChanges, setLatestDomChanges] = useState<DOMChange[]>(currentChanges)
  const [previewEnabledOnce, setPreviewEnabledOnce] = useState(false)
  const [isPreviewEnabled, setIsPreviewEnabled] = useState(true)
  const [isRefreshingHTML, setIsRefreshingHTML] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const historyButtonRef = useRef<HTMLButtonElement>(null)
  const onPreviewToggleRef = useRef(onPreviewToggle)
  const onPreviewRefreshRef = useRef(onPreviewRefresh)

  const {
    chatHistory,
    setChatHistory,
    conversationSession,
    setConversationSession,
    conversationList,
    currentConversationId,
    isLoadingHistory,
    error,
    setError,
    handleNewChat,
    switchConversation,
    handleDeleteConversation,
    refreshHTML,
    saveCurrentConversation
  } = useConversationHistory(variantName)

  useEffect(() => {
    console.log(JSON.stringify({
      type: 'COMPONENT_LIFECYCLE',
      component: 'AIDOMChangesPage',
      event: 'MOUNT',
      timestamp: Date.now(),
      mountId: mountId.current
    }))
    return () => {
      console.log(JSON.stringify({
        type: 'COMPONENT_LIFECYCLE',
        component: 'AIDOMChangesPage',
        event: 'UNMOUNT',
        timestamp: Date.now(),
        mountId: mountId.current
      }))
    }
  }, [])

  // Intentionally avoid logging every render to prevent console noise on keystrokes.

  useEffect(() => {
    onPreviewToggleRef.current = onPreviewToggle
    onPreviewRefreshRef.current = onPreviewRefresh
  }, [onPreviewToggle, onPreviewRefresh])

  useEffect(() => {
    setLatestDomChanges(currentChanges)
  }, [currentChanges])

  useEffect(() => {
    if (!isPreviewEnabled || previewEnabledOnce) {
      return
    }
    if (latestDomChanges.length === 0) {
      return
    }
    if (onPreviewWithChanges) {
      debugLog('[AIDOMChangesPage] Auto-enabling preview on mount with existing changes:', latestDomChanges.length)
      onPreviewWithChanges(true, latestDomChanges)
      setPreviewEnabledOnce(true)
    }
  }, [isPreviewEnabled, previewEnabledOnce, latestDomChanges, onPreviewWithChanges])

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

  const handleGenerate = async () => {
    debugLog('[AIDOMChangesPage] handleGenerate called, prompt:', prompt, 'images:', attachedImages.length)
    debugLog('[AIDOMChangesPage] Current session:', conversationSession?.id)

    if (!prompt.trim() && attachedImages.length === 0) {
      debugLog('[AIDOMChangesPage] Empty prompt and no images')
      const message = 'Please enter a prompt or attach an image'
      setAiError(message)
      setError(message)
      return
    }

    debugLog('[AIDOMChangesPage] Setting loading to true')
    setLoading(true)
    setAiError(null)
    setError(null)

    const llmImages = attachedImages.length > 0 ? await compressImagesForLLM(attachedImages) : undefined
    debugLog('[AIDOMChangesPage] LLM images:', llmImages?.length || 0)

    const timestamp = Date.now()
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt,
      images: llmImages,
      timestamp,
      id: `user-${timestamp}`
    }
    setChatHistory(prev => [...prev, userMessage])

    try {
      const result = await onGenerate(prompt, llmImages, conversationSession)

      if (result.session) {
        setConversationSession(result.session)
        debugLog('[AIDOMChangesPage] Session updated:', result.session.id)
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

      try {
        await saveCurrentConversation(newHistory, result.session || conversationSession!)
      } catch (storageError) {
        debugWarn('[AIDOMChangesPage] Failed to save conversation:', storageError)
        const warningMessage = storageError instanceof Error
          ? storageError.message
          : 'Failed to save conversation history. Your changes are still applied, but may not be saved.'

        setTimeout(() => {
          if (window.confirm(`${warningMessage}\n\nWould you like to start a new conversation?`)) {
            handleNewChat()
          }
        }, 500)
      }

      if (result.domChanges && result.domChanges.length > 0) {
        const finalChanges = applyDOMChangeAction(latestDomChanges, result)
        debugLog('[AIDOMChangesPage] Applied action:', result.action, 'Final changes count:', finalChanges.length)
        console.log('[AI Generate] AIDOMChangesPage final changes count:', finalChanges.length)

        setLatestDomChanges(finalChanges)
        if (typeof window !== 'undefined') {
          ;(window as any).__absmartlyLatestDomChanges = {
            variantName,
            changes: finalChanges,
            timestamp: Date.now()
          }
        }
        console.log('[AI Persist] Storing AI changes for', variantName, 'count:', finalChanges.length)
        const storageResults = await Promise.allSettled([
          sessionStorage.set('aiDomChangesState', {
            variantName,
            changes: finalChanges,
            timestamp: Date.now()
          }),
          localAreaStorage.set('aiDomChangesState', {
            variantName,
            changes: finalChanges,
            timestamp: Date.now()
          })
        ])
        storageResults.forEach((result) => {
          if (result.status === 'rejected') {
            debugWarn('[AIDOMChangesPage] Failed to persist AI changes:', result.reason)
          }
        })
        try {
          const storageKey = 'experiment-new-variants'
          const savedVariants = await localAreaStorage.get<any[]>(storageKey)
          if (Array.isArray(savedVariants)) {
            const targetIndex = savedVariants.findIndex(v => v?.name === variantName)
            if (targetIndex !== -1) {
              const currentConfig = savedVariants[targetIndex]?.config || {}
              const domFieldName = Object.keys(currentConfig).find(k => k.includes('dom_changes')) || '__dom_changes'
              const domChangesData = getDOMChangesFromConfig(currentConfig, domFieldName)
              const baseConfig = getChangesConfig(domChangesData)
              const updatedDOMChanges = { ...baseConfig, changes: finalChanges }
              savedVariants[targetIndex] = {
                ...savedVariants[targetIndex],
                config: setDOMChangesInConfig(currentConfig, updatedDOMChanges, domFieldName)
              }
              await localAreaStorage.set(storageKey, savedVariants)
            }
          }
        } catch (storageError) {
          debugWarn('[AIDOMChangesPage] Failed to update stored variants with AI changes:', storageError)
        }

        if (!previewEnabledOnce) {
          debugLog('[AIDOMChangesPage] First message with DOM changes - enabling preview directly')
          if (onPreviewWithChanges) {
            onPreviewWithChanges(true, finalChanges)
            setPreviewEnabledOnce(true)
            setIsPreviewEnabled(true)
          }
          if (onRestoreChanges) {
            onRestoreChanges(finalChanges)
          }
        } else {
          debugLog('[AIDOMChangesPage] Subsequent message - clearing old changes then applying new ones')

          if (result.action === 'replace_all' || result.action === 'replace_specific') {
            debugLog('[AIDOMChangesPage] Clearing old changes before applying new ones')
            if (onPreviewToggleRef.current) {
              onPreviewToggleRef.current(false)
            }
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          if (onRestoreChanges) {
            onRestoreChanges(finalChanges)
          }
          if (onPreviewWithChanges) {
            onPreviewWithChanges(true, finalChanges)
            setIsPreviewEnabled(true)
          }
        }
      }

    } catch (err) {
      console.error('[AIDOMChangesPage] Error in handleGenerate:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate DOM changes'
      setAiError(errorMessage)
      setError(errorMessage)
      setChatHistory(prev => prev.slice(0, -1))
    } finally {
      debugLog('[AIDOMChangesPage] Clearing prompt and images, then setting loading to false')
      setPrompt('')
      setAttachedImages([])
      setLoading(false)
    }
  }

  const handlePreviewToggle = () => {
    const newState = !isPreviewEnabled
    setIsPreviewEnabled(newState)

    if (newState) {
      // When turning ON, reapply the latest changes
      debugLog('[AIDOMChangesPage] Preview toggled ON - reapplying changes:', latestDomChanges.length)
      if (onPreviewWithChanges) {
        onPreviewWithChanges(true, latestDomChanges)
        setPreviewEnabledOnce(true)
      }
    } else {
      // When turning OFF, remove preview
      debugLog('[AIDOMChangesPage] Preview toggled OFF - removing changes')
      if (onPreviewToggle) {
        onPreviewToggle(false)
      }
    }
  }

  const handleRefreshHTML = async () => {
    setIsRefreshingHTML(true)
    setAiError(null)
    setError(null)

    const success = await refreshHTML()

    setIsRefreshingHTML(false)
  }

  const handleViewChanges = useCallback((changes: DOMChange[], response: string, timestamp: number) => {
    setViewerModal({ changes, response, timestamp })
  }, [])

  const handleRestoreChangesFromHistory = useCallback((changes: DOMChange[]) => {
    setLatestDomChanges(changes)
  }, [])

  const handleConversationSwitch = useCallback(async (conv: any) => {
    await switchConversation(conv)
    setAiError(null)
    setShowHistory(false)
  }, [switchConversation])

  const handlePreviewWithChanges = useCallback((enabled: boolean, changes: DOMChange[]) => {
    if (onPreviewWithChanges) {
      onPreviewWithChanges(enabled, changes)
      setPreviewEnabledOnce(true)
    }
  }, [onPreviewWithChanges])

  const handleRestoreChangesCallback = useCallback((changes: DOMChange[]) => {
    if (onRestoreChanges) {
      onRestoreChanges(changes)
    }
  }, [onRestoreChanges])

  const handlePreviewRefreshCallback = useCallback(() => {
    if (onPreviewRefreshRef.current) {
      onPreviewRefreshRef.current()
    }
  }, [])

  const handleNewChatClick = useCallback(() => {
    setAiError(null)
    handleNewChat()
  }, [handleNewChat])

  const handleBack = () => {
    if (typeof window !== 'undefined') {
      ;(window as any).__absmartlyReturnToDomChanges = true
    }
    onBack()
  }

  return (
    <div className="flex flex-col h-full bg-white" data-ai-dom-changes-page="true">
      <div className="p-4">
        <Header
          title={
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-6 w-6 text-purple-600" />
              <div>
                <h2 id="ai-dom-generator-heading" className="text-lg font-semibold text-gray-900">Vibe Studio</h2>
                <p id="ai-variant-label" className="text-xs text-gray-600">Variant: {variantName}</p>
              </div>
            </div>
          }
          onBack={handleBack}
          actions={
            <div className="flex items-center gap-2 relative">
              <div>
                <button
                  ref={historyButtonRef}
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
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
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-gray-200 bg-gray-50">
                      <h3 id="conversation-history-title" className="text-sm font-semibold text-gray-900">Conversation History</h3>
                      <p className="text-xs text-gray-600">{conversationList.length} conversation{conversationList.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {conversationList.map((conv) => (
                        <div
                          key={conv.id}
                          className="p-3 hover:bg-gray-50 transition-colors group"
                          id={`conversation-${conv.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            {conv.firstScreenshot && (
                              <div className="flex-shrink-0">
                                <img
                                  src={conv.firstScreenshot}
                                  alt="Conversation thumbnail"
                                  className="w-16 h-16 object-cover rounded border border-gray-200"
                                />
                              </div>
                            )}
                            <div
                              className="flex-1 cursor-pointer min-w-0"
                              onClick={() => handleConversationSwitch(conv)}
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
                                await handleDeleteConversation(conv.id)
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
                id="refresh-html-button"
                onClick={handleRefreshHTML}
                disabled={isRefreshingHTML || loading}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                title="Refresh HTML Context"
              >
                {isRefreshingHTML ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-600" />
                ) : (
                  <ArrowPathIcon className="h-5 w-5 text-gray-600" />
                )}
              </button>
              <button
                id="ai-new-chat-button"
                onClick={handleNewChatClick}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                title="New Chat"
              >
                <PlusIcon className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-auto p-4">
        <ChatMessageList
          messages={chatHistory}
          onViewChanges={handleViewChanges}
          onRestoreChanges={handleRestoreChangesFromHistory}
          previewEnabledOnce={previewEnabledOnce}
          onPreviewWithChanges={handlePreviewWithChanges}
          onRestoreChangesCallback={handleRestoreChangesCallback}
          onPreviewRefresh={handlePreviewRefreshCallback}
        />
      </div>

      <ChatInput
        prompt={prompt}
        onPromptChange={setPrompt}
        loading={loading}
        onSubmit={handleGenerate}
        images={attachedImages}
        onImagesChange={setAttachedImages}
        error={aiError ?? error}
        isPreviewEnabled={isPreviewEnabled}
        onPreviewToggle={handlePreviewToggle}
      />

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
