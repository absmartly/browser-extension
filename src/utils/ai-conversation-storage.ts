import { Storage } from '@plasmohq/storage'
import type {
  StoredConversation,
  StoredConversationsData,
  ConversationListItem
} from '~src/types/absmartly'
import { compressImages } from './image-compression'

const storage = new Storage()

const CONVERSATIONS_VERSION = 1
const MAX_CONVERSATIONS_PER_VARIANT = 10
const MAX_STORAGE_SIZE_BYTES = 90000

function getStorageKey(variantName: string): string {
  return `ai-conversations-${variantName}`
}

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
    const key = getStorageKey(variantName)
    const dataStr = await storage.get<string>(key)

    if (!dataStr) {
      return []
    }

    const data: StoredConversationsData = JSON.parse(dataStr)
    return data.conversations || []
  } catch (error) {
    console.error('[ConversationStorage] Error getting conversations:', error)
    return []
  }
}

export async function saveConversation(conversation: StoredConversation): Promise<void> {
  try {
    const conversations = await getConversations(conversation.variantName)

    const sanitizedConversation = await sanitizeConversationForStorage(conversation)

    const existingIndex = conversations.findIndex(c => c.id === sanitizedConversation.id)

    if (existingIndex >= 0) {
      sanitizedConversation.updatedAt = Date.now()
      conversations[existingIndex] = sanitizedConversation
    } else {
      sanitizedConversation.createdAt = sanitizedConversation.createdAt || Date.now()
      sanitizedConversation.updatedAt = Date.now()
      conversations.push(sanitizedConversation)
    }

    if (conversations.length > MAX_CONVERSATIONS_PER_VARIANT) {
      conversations.sort((a, b) => a.createdAt - b.createdAt)
      conversations.splice(0, conversations.length - MAX_CONVERSATIONS_PER_VARIANT)
    }

    const data: StoredConversationsData = {
      conversations,
      version: CONVERSATIONS_VERSION
    }

    const serialized = JSON.stringify(data)
    const sizeInBytes = new Blob([serialized]).size

    if (sizeInBytes > MAX_STORAGE_SIZE_BYTES) {
      console.warn(`[ConversationStorage] Conversation data is large: ${sizeInBytes} bytes (max: ${MAX_STORAGE_SIZE_BYTES})`)

      if (sizeInBytes > 100000) {
        throw new Error(`Storage quota exceeded. Conversation is too large (${Math.round(sizeInBytes / 1024)}KB). Try starting a new conversation.`)
      }
    }

    const key = getStorageKey(conversation.variantName)
    await storage.set(key, serialized)

    console.log(`[ConversationStorage] Saved conversation ${conversation.id} for ${conversation.variantName} (${sizeInBytes} bytes)`)
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
    const conversations = await getConversations(variantName)
    const conversation = conversations.find(c => c.id === conversationId)

    if (conversation) {
      console.log(`[ConversationStorage] Loaded conversation ${conversationId}`)
    } else {
      console.warn(`[ConversationStorage] Conversation ${conversationId} not found`)
    }

    return conversation || null
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
    const conversations = await getConversations(variantName)
    const filtered = conversations.filter(c => c.id !== conversationId)

    const data: StoredConversationsData = {
      conversations: filtered,
      version: CONVERSATIONS_VERSION
    }

    const key = getStorageKey(variantName)
    await storage.set(key, JSON.stringify(data))

    console.log(`[ConversationStorage] Deleted conversation ${conversationId}`)
  } catch (error) {
    console.error('[ConversationStorage] Error deleting conversation:', error)
    throw error
  }
}

export async function getConversationList(variantName: string): Promise<ConversationListItem[]> {
  try {
    const conversations = await getConversations(variantName)

    const list: ConversationListItem[] = conversations.map(conv => ({
      id: conv.id,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv.messageCount,
      firstUserMessage: conv.firstUserMessage,
      isActive: conv.isActive
    }))

    list.sort((a, b) => b.updatedAt - a.updatedAt)

    return list
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
    const conversations = await getConversations(variantName)

    for (const conv of conversations) {
      conv.isActive = conv.id === conversationId
    }

    const data: StoredConversationsData = {
      conversations,
      version: CONVERSATIONS_VERSION
    }

    const key = getStorageKey(variantName)
    await storage.set(key, JSON.stringify(data))

    console.log(`[ConversationStorage] Set active conversation to ${conversationId}`)
  } catch (error) {
    console.error('[ConversationStorage] Error setting active conversation:', error)
    throw error
  }
}
