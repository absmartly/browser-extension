import { debugLog, debugWarn } from '~src/utils/debug'
import type {
  StoredConversation,
  ConversationListItem
} from '~src/types/absmartly'
import { compressImages } from './image-compression'
import * as idbStorage from './indexeddb-storage'

async function sanitizeConversationForStorage(conv: StoredConversation): Promise<StoredConversation> {
  const messagesWithThumbnails = await Promise.all(
    conv.messages.map(async (msg) => ({
      ...msg,
      images: await compressImages(msg.images),
    }))
  )

  return {
    ...conv,
    messages: messagesWithThumbnails,
    conversationSession: {
      ...conv.conversationSession,
      messages: []
    }
  }
}

export async function getConversations(variantName: string): Promise<StoredConversation[]> {
  try {
    return await idbStorage.getConversations(variantName)
  } catch (error) {
    console.error('[ConversationStorage] Error getting conversations:', error)
    return []
  }
}

export async function saveConversation(conversation: StoredConversation): Promise<void> {
  try {
    const sanitized = await sanitizeConversationForStorage(conversation)
    await idbStorage.saveConversation(sanitized)

    debugLog(`[ConversationStorage] Saved conversation ${conversation.id} for ${conversation.variantName}`)
  } catch (error) {
    console.error('[ConversationStorage] Error saving conversation:', error)

    if (error instanceof Error && error.message.includes('quota')) {
      throw new Error('Storage quota exceeded. Please start a new conversation or delete old conversations.')
    }

    throw error
  }
}

export async function loadConversation(
  variantName: string,
  conversationId: string
): Promise<StoredConversation | null> {
  try {
    const conversation = await idbStorage.loadConversation(variantName, conversationId)

    if (conversation) {
      debugLog(`[ConversationStorage] Loaded conversation ${conversationId}`)
    } else {
      debugWarn(`[ConversationStorage] Conversation ${conversationId} not found`)
    }

    return conversation
  } catch (error) {
    console.error('[ConversationStorage] Error loading conversation:', error)
    return null
  }
}

export async function deleteConversation(
  variantName: string,
  conversationId: string
): Promise<void> {
  try {
    await idbStorage.deleteConversation(variantName, conversationId)
    debugLog(`[ConversationStorage] Deleted conversation ${conversationId}`)
  } catch (error) {
    console.error('[ConversationStorage] Error deleting conversation:', error)
    throw error
  }
}

export async function getConversationList(variantName: string): Promise<ConversationListItem[]> {
  try {
    return await idbStorage.getConversationList(variantName)
  } catch (error) {
    console.error('[ConversationStorage] Error getting conversation list:', error)
    return []
  }
}

export async function setActiveConversation(
  variantName: string,
  conversationId: string
): Promise<void> {
  try {
    await idbStorage.setActiveConversation(variantName, conversationId)
    debugLog(`[ConversationStorage] Set active conversation to ${conversationId}`)
  } catch (error) {
    console.error('[ConversationStorage] Error setting active conversation:', error)
    throw error
  }
}
