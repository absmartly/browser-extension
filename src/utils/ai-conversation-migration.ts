import { Storage } from '@plasmohq/storage'
import type { ChatMessage, ConversationSession, StoredConversation } from '~src/types/absmartly'
import { saveConversation, getConversations } from './ai-conversation-storage'

const storage = new Storage()

function getOldStorageKey(variantName: string): string {
  return `ai-chat-${variantName}`
}

export async function needsMigration(variantName: string): Promise<boolean> {
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

export async function migrateConversation(variantName: string): Promise<void> {
  try {
    const oldKey = getOldStorageKey(variantName)
    const oldDataStr = await storage.get<string>(oldKey)

    if (!oldDataStr) {
      console.log('[ConversationMigration] No old data found to migrate')
      return
    }

    const oldMessages: ChatMessage[] = JSON.parse(oldDataStr)

    if (!Array.isArray(oldMessages) || oldMessages.length === 0) {
      console.log('[ConversationMigration] Old data is empty or invalid, skipping migration')
      await storage.remove(oldKey)
      return
    }

    const firstUserMessage = oldMessages.find(m => m.role === 'user')?.content || 'Migrated conversation'
    const truncatedMessage = firstUserMessage.substring(0, 50)

    const newSession: ConversationSession = {
      id: crypto.randomUUID(),
      htmlSent: false,
      messages: []
    }

    const migratedConversation: StoredConversation = {
      id: crypto.randomUUID(),
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

    console.log(`[ConversationMigration] Successfully migrated conversation for ${variantName}`)
    console.log(`[ConversationMigration] Migrated ${oldMessages.length} messages`)
  } catch (error) {
    console.error('[ConversationMigration] Error during migration:', error)
    throw error
  }
}
