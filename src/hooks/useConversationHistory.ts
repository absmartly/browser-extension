import { useState, useEffect, useCallback } from 'react'
import type { ChatMessage, ConversationSession, StoredConversation, ConversationListItem } from '~src/types/absmartly'
import { getConversationList, saveConversation, loadConversation, deleteConversation, setActiveConversation } from '~src/utils/ai-conversation-storage'
import { needsMigration, migrateConversation } from '~src/utils/ai-conversation-migration'
import { capturePageHTML } from '~src/utils/html-capture'
import { sendToBackground } from '~src/lib/messaging'
import type { ConversationId, VariantName } from '~src/types/branded'
import { unsafeConversationId, unsafeVariantName, unsafeSessionId } from '~src/types/branded'

import { debugLog, debugWarn } from '~src/utils/debug'
export function useConversationHistory(variantName: string) {
  const safeVariantName = unsafeVariantName(variantName)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [conversationSession, setConversationSession] = useState<ConversationSession | null>(null)
  const [conversationList, setConversationList] = useState<ConversationListItem[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string>('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initializeSessionHTML = useCallback(async (session: ConversationSession, conversationId: string) => {
    debugLog('[initializeSessionHTML] Starting background HTML capture...')

    try {
      const captureResult = await capturePageHTML()
      debugLog('[initializeSessionHTML] HTML captured, length:', captureResult.html.length, 'URL:', captureResult.url, 'structure lines:', captureResult.domStructure?.split('\n').length)

      const response = await sendToBackground({
        type: 'AI_INITIALIZE_SESSION',
        html: captureResult.html,
        pageUrl: captureResult.url,
        domStructure: captureResult.domStructure,
        conversationSession: session
      })

      if (response.success && response.session) {
        const initializedSession = response.session as ConversationSession
        setConversationSession(initializedSession)
        debugLog('[initializeSessionHTML] ✅ HTML context initialized successfully')
      } else {
        throw new Error(response.error || 'Failed to initialize session')
      }
    } catch (error) {
      console.error('[initializeSessionHTML] ❌ HTML capture failed:', error)
    }
  }, [])

  useEffect(() => {
    debugLog('[useConversationHistory] ========== INITIALIZATION START ==========')
    debugLog('[useConversationHistory] variantName:', variantName)

    ;(async () => {
      try {
        setIsLoadingHistory(true)

        if (await needsMigration(safeVariantName)) {
          debugLog('[useConversationHistory] Migrating old conversation format')
          await migrateConversation(safeVariantName)
        }

        const list = await getConversationList(safeVariantName)
        debugLog('[useConversationHistory] Loaded conversation list:', list.length, 'conversations for variant:', variantName)
        setConversationList(list)
        setIsLoadingHistory(false)

        const activeConv = list.find(c => c.isActive)

        if (activeConv) {
          const loaded = await loadConversation(safeVariantName, activeConv.id)
          if (loaded) {
            setChatHistory(loaded.messages)
            setConversationSession(loaded.conversationSession)
            setCurrentConversationId(loaded.id)
            debugLog('[useConversationHistory] Loaded active conversation:', loaded.id)

            if (!loaded.conversationSession.htmlSent) {
              initializeSessionHTML(loaded.conversationSession, loaded.id)
                .catch(err => {
                  debugWarn('[useConversationHistory] HTML initialization failed (non-blocking):', err)
                })
            }
            return
          }
        }

        const newSession: ConversationSession = {
          id: unsafeSessionId(crypto.randomUUID()),
          htmlSent: false,
          messages: [],
        }
        const newConvId = unsafeConversationId(crypto.randomUUID())

        setConversationSession(newSession)
        setCurrentConversationId(newConvId)
        debugLog('[useConversationHistory] Created new conversation:', newConvId)

        initializeSessionHTML(newSession, newConvId)
          .catch(err => {
            debugWarn('[useConversationHistory] HTML initialization failed (non-blocking):', err)
          })

      } catch (error) {
        console.error('[useConversationHistory] ❌ INITIALIZATION ERROR:', error)
        setError(error instanceof Error ? error.message : 'Failed to load conversation history')
        setIsLoadingHistory(false)
      }
    })()
  }, [variantName, initializeSessionHTML])

  const handleNewChat = useCallback(async () => {
    if (!conversationSession || !variantName) return

    if (chatHistory.length > 0 && currentConversationId) {
      const currentConv: StoredConversation = {
        id: unsafeConversationId(currentConversationId),
        variantName: unsafeVariantName(variantName),
        messages: chatHistory,
        conversationSession,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: chatHistory.length,
        firstUserMessage: chatHistory.find(m => m.role === 'user')?.content.substring(0, 50) || 'Conversation',
        isActive: false
      }

      try {
        await saveConversation(currentConv)
      } catch (storageError) {
        debugWarn('[useConversationHistory] Failed to save conversation before creating new chat:', storageError)
      }
    }

    const newSession: ConversationSession = {
      id: unsafeSessionId(crypto.randomUUID()),
      htmlSent: false,
      messages: [],
    }
    setConversationSession(newSession)

    const newConvId = unsafeConversationId(crypto.randomUUID())
    setCurrentConversationId(newConvId)
    await setActiveConversation(safeVariantName, newConvId)

    setChatHistory([])
    setError(null)

    const list = await getConversationList(safeVariantName)
    setConversationList(list)

    debugLog('[useConversationHistory] New chat session:', newConvId)
  }, [chatHistory, currentConversationId, conversationSession, variantName])

  const switchConversation = useCallback(async (conv: ConversationListItem) => {
    if (!conversationSession || !variantName) return

    if (chatHistory.length > 0 && currentConversationId !== conv.id) {
      const currentConv: StoredConversation = {
        id: unsafeConversationId(currentConversationId),
        variantName: unsafeVariantName(variantName),
        messages: chatHistory,
        conversationSession,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: chatHistory.length,
        firstUserMessage: chatHistory.find(m => m.role === 'user')?.content.substring(0, 50) || 'Conversation',
        isActive: false
      }

      try {
        await saveConversation(currentConv)
      } catch (storageError) {
        debugWarn('[useConversationHistory] Failed to save conversation before switching:', storageError)
      }
    }

    const loaded = await loadConversation(safeVariantName, conv.id)
    if (loaded) {
      setChatHistory(loaded.messages)
      setConversationSession(loaded.conversationSession)
      setCurrentConversationId(loaded.id)
      await setActiveConversation(safeVariantName, loaded.id)

      const list = await getConversationList(safeVariantName)
      setConversationList(list)

      debugLog('[useConversationHistory] Loaded conversation:', loaded.id)
    }
  }, [chatHistory, currentConversationId, conversationSession, variantName])

  const handleDeleteConversation = useCallback(async (convId: string) => {
    await deleteConversation(safeVariantName, unsafeConversationId(convId))

    const isActive = currentConversationId === convId
    if (isActive) {
      const newSession: ConversationSession = {
        id: unsafeSessionId(crypto.randomUUID()),
        htmlSent: false,
        messages: [],
      }
      setConversationSession(newSession)

      const newConvId = unsafeConversationId(crypto.randomUUID())
      setCurrentConversationId(newConvId)
      await setActiveConversation(safeVariantName, newConvId)

      setChatHistory([])
      setError(null)
    }

    const list = await getConversationList(safeVariantName)
    setConversationList(list)

    debugLog('[useConversationHistory] Deleted conversation:', convId)
  }, [variantName, currentConversationId])

  const refreshHTML = useCallback(async () => {
    if (!conversationSession) {
      setError('No active conversation to refresh')
      return false
    }

    try {
      debugLog('[useConversationHistory] Refreshing HTML context...')
      const captureResult = await capturePageHTML()
      debugLog('[useConversationHistory] HTML captured, length:', captureResult.html.length, 'URL:', captureResult.url, 'structure lines:', captureResult.domStructure?.split('\n').length)

      const response = await sendToBackground({
        type: 'AI_REFRESH_HTML',
        html: captureResult.html,
        pageUrl: captureResult.url,
        domStructure: captureResult.domStructure,
        conversationSession
      })

      if (response.success && response.session) {
        setConversationSession(response.session as ConversationSession)
        debugLog('[useConversationHistory] ✅ HTML context refreshed successfully')
        return true
      } else {
        throw new Error(response.error || 'Failed to refresh HTML')
      }
    } catch (error) {
      console.error('[useConversationHistory] ❌ HTML refresh failed:', error)
      setError(error instanceof Error ? error.message : 'Failed to refresh HTML')
      return false
    }
  }, [conversationSession])

  const saveCurrentConversation = useCallback(async (messages: ChatMessage[], session: ConversationSession) => {
    const updatedConversation: StoredConversation = {
      id: unsafeConversationId(currentConversationId),
      variantName: unsafeVariantName(variantName),
      messages,
      conversationSession: session,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: messages.length,
      firstUserMessage: messages.find(m => m.role === 'user')?.content.substring(0, 50) || 'New conversation',
      isActive: true
    }

    try {
      await saveConversation(updatedConversation)
      await setActiveConversation(variantName, currentConversationId)

      const list = await getConversationList(safeVariantName)
      setConversationList(list)
    } catch (storageError) {
      debugWarn('[useConversationHistory] Failed to save conversation:', storageError)
      throw storageError
    }
  }, [currentConversationId, variantName])

  return {
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
  }
}
