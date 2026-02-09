import type { ChatMessage, ConversationSession } from './absmartly'

export interface IDBConversationRecord {
  id: string
  variantName: string
  isActive: boolean
  createdAt: number
  updatedAt: number
  messageCount: number
  firstUserMessage: string
  messages: ChatMessage[]
  conversationSession: ConversationSession
}

export interface IDBMetadataRecord {
  key: string
  value: unknown
  updatedAt: number
}

export interface IDBSchema {
  conversations: IDBConversationRecord
  metadata: IDBMetadataRecord
}

export const DB_NAME = 'absmartly-conversations'
export const DB_VERSION = 1
export const STORE_CONVERSATIONS = 'conversations'
export const STORE_METADATA = 'metadata'
