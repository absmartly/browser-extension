import { Storage } from '@plasmohq/storage'
import type { ChatMessage, ConversationSession, StoredConversation } from '~src/types/absmartly'
import { saveConversation, getConversations } from './ai-conversation-storage'
import { unsafeSessionId, unsafeConversationId, unsafeVariantName, type VariantName } from '~src/types/branded'

import { debugLog, debugWarn } from '~src/utils/debug'
const storage = new Storage()

function getOldStorageKey(variantName: VariantName): string {
  return `ai-chat-${variantName}`
}

export async function needsMigration(variantName: VariantName): Promise<boolean> {
  try {
    const oldKey = getOldStorageKey(variantName)
    const oldData = await storage.get<string>(oldKey)

    const newConversations = await getConversations(variantName)

    return !!oldData && newConversations.length === 0
  } catch (error) {
    console.error('[ConversationMigration] Error checking migration need:', error)
    return false
  }
}

export async function migrateConversation(variantName: VariantName): Promise<void> {
  try {
    const oldKey = getOldStorageKey(variantName)
    const oldDataStr = await storage.get<string>(oldKey)

    if (!oldDataStr) {
      debugLog('[ConversationMigration] No old data found to migrate')
      return
    }

    const oldMessages: ChatMessage[] = JSON.parse(oldDataStr)

    if (!Array.isArray(oldMessages) || oldMessages.length === 0) {
      debugLog('[ConversationMigration] Old data is empty or invalid, skipping migration')
      await storage.remove(oldKey)
      return
    }

    const firstUserMessage = oldMessages.find(m => m.role === 'user')?.content || 'Migrated conversation'
    const truncatedMessage = firstUserMessage.substring(0, 50)

    const newSession: ConversationSession = {
      id: unsafeSessionId(crypto.randomUUID()),
      htmlSent: false,
      messages: []
    }

    const migratedConversation: StoredConversation = {
      id: unsafeConversationId(crypto.randomUUID()),
      variantName,
      messages: oldMessages,
      conversationSession: newSession,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: oldMessages.length,
      firstUserMessage: truncatedMessage,
      isActive: true
    }

    await saveConversation(migratedConversation)

    await storage.remove(oldKey)

    debugLog(`[ConversationMigration] Successfully migrated conversation for ${variantName}`)
    debugLog(`[ConversationMigration] Migrated ${oldMessages.length} messages`)
  } catch (error) {
    console.error('[ConversationMigration] Error during migration:', error)
    throw error
  }
}
