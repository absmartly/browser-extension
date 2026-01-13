import { useState, useEffect, useCallback } from 'react'
import type { ChatMessage, ConversationSession, StoredConversation, ConversationListItem } from '~src/types/absmartly'
import { getConversationList, saveConversation, loadConversation, deleteConversation, setActiveConversation } from '~src/utils/ai-conversation-storage'
import { needsMigration, migrateConversation } from '~src/utils/ai-conversation-migration'
import { capturePageHTML } from '~src/utils/html-capture'
import { sendToBackground } from '~src/lib/messaging'

export function useConversationHistory(variantName: string) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [conversationSession, setConversationSession] = useState<ConversationSession | null>(null)
  const [conversationList, setConversationList] = useState<ConversationListItem[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string>('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initializeSessionHTML = useCallback(async (session: ConversationSession, conversationId: string) => {
    console.log('[initializeSessionHTML] Starting background HTML capture...')

    try {
      const captureResult = await capturePageHTML()
      console.log('[initializeSessionHTML] HTML captured, length:', captureResult.html.length, 'URL:', captureResult.url, 'structure lines:', captureResult.domStructure?.split('\n').length)

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
        console.log('[initializeSessionHTML] ✅ HTML context initialized successfully')
      } else {
        throw new Error(response.error || 'Failed to initialize session')
      }
    } catch (error) {
      console.error('[initializeSessionHTML] ❌ HTML capture failed:', error)
    }
  }, [])

  useEffect(() => {
    console.log('[useConversationHistory] ========== INITIALIZATION START ==========')
    console.log('[useConversationHistory] variantName:', variantName)

    ;(async () => {
      try {
        setIsLoadingHistory(true)

        if (await needsMigration(variantName)) {
          console.log('[useConversationHistory] Migrating old conversation format')
          await migrateConversation(variantName)
        }

        const list = await getConversationList(variantName)
        console.log('[useConversationHistory] Loaded conversation list:', list.length, 'conversations for variant:', variantName)
        setConversationList(list)
        setIsLoadingHistory(false)

        const activeConv = list.find(c => c.isActive)

        if (activeConv) {
          const loaded = await loadConversation(variantName, activeConv.id)
          if (loaded) {
            setChatHistory(loaded.messages)
            setConversationSession(loaded.conversationSession)
            setCurrentConversationId(loaded.id)
            console.log('[useConversationHistory] Loaded active conversation:', loaded.id)

            if (!loaded.conversationSession.htmlSent) {
              initializeSessionHTML(loaded.conversationSession, loaded.id)
                .catch(err => {
                  console.warn('[useConversationHistory] HTML initialization failed (non-blocking):', err)
                })
            }
            return
          }
        }

        const newSession: ConversationSession = {
          id: crypto.randomUUID(),
          htmlSent: false,
          messages: [],
        }
        const newConvId = crypto.randomUUID()

        setConversationSession(newSession)
        setCurrentConversationId(newConvId)
        console.log('[useConversationHistory] Created new conversation:', newConvId)

        initializeSessionHTML(newSession, newConvId)
          .catch(err => {
            console.warn('[useConversationHistory] HTML initialization failed (non-blocking):', err)
          })

      } catch (error) {
        console.error('[useConversationHistory] ❌ INITIALIZATION ERROR:', error)
        setError(error instanceof Error ? error.message : 'Failed to load conversation history')
        setIsLoadingHistory(false)
      }
    })()
  }, [variantName, initializeSessionHTML])

  const handleNewChat = useCallback(async () => {
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
        console.warn('[useConversationHistory] Failed to save conversation before creating new chat:', storageError)
      }
    }

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
    setError(null)

    const list = await getConversationList(variantName)
    setConversationList(list)

    console.log('[useConversationHistory] New chat session:', newConvId)
  }, [chatHistory, currentConversationId, conversationSession, variantName])

  const switchConversation = useCallback(async (conv: ConversationListItem) => {
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
        console.warn('[useConversationHistory] Failed to save conversation before switching:', storageError)
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

      console.log('[useConversationHistory] Loaded conversation:', loaded.id)
    }
  }, [chatHistory, currentConversationId, conversationSession, variantName])

  const handleDeleteConversation = useCallback(async (convId: string) => {
    await deleteConversation(variantName, convId)

    const isActive = currentConversationId === convId
    if (isActive) {
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
      setError(null)
    }

    const list = await getConversationList(variantName)
    setConversationList(list)

    console.log('[useConversationHistory] Deleted conversation:', convId)
  }, [variantName, currentConversationId])

  const refreshHTML = useCallback(async () => {
    if (!conversationSession) {
      setError('No active conversation to refresh')
      return false
    }

    try {
      console.log('[useConversationHistory] Refreshing HTML context...')
      const captureResult = await capturePageHTML()
      console.log('[useConversationHistory] HTML captured, length:', captureResult.html.length, 'URL:', captureResult.url, 'structure lines:', captureResult.domStructure?.split('\n').length)

      const response = await sendToBackground({
        type: 'AI_REFRESH_HTML',
        html: captureResult.html,
        pageUrl: captureResult.url,
        domStructure: captureResult.domStructure,
        conversationSession
      })

      if (response.success && response.session) {
        setConversationSession(response.session as ConversationSession)
        console.log('[useConversationHistory] ✅ HTML context refreshed successfully')
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
      id: currentConversationId,
      variantName,
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

      const list = await getConversationList(variantName)
      setConversationList(list)
    } catch (storageError) {
      console.warn('[useConversationHistory] Failed to save conversation:', storageError)
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
