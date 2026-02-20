import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import type { StoredConversation } from '~src/types/absmartly'
import { DB_NAME } from '~src/types/indexeddb'
import * as idbStorage from '~src/utils/indexeddb-storage'
import { openDatabase, closeDatabase } from '~src/utils/indexeddb-connection'
import { unsafeSessionId, unsafeConversationId, unsafeVariantName } from '~src/types/branded'

describe('IndexedDB Storage Operations', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    closeDatabase()
    await clearDatabase()
  })

  describe('Database Initialization', () => {
    it('should create database with correct schema', async () => {
      const db = await openDatabase()
      expect(db.name).toBe(DB_NAME)
      expect(db.version).toBe(1)
      expect(db.objectStoreNames.contains('conversations')).toBe(true)
      expect(db.objectStoreNames.contains('metadata')).toBe(true)
    })

    it('should create conversations store with all indexes', async () => {
      const db = await openDatabase()
      const tx = db.transaction('conversations', 'readonly')
      const store = tx.objectStore('conversations')

      expect(store.indexNames.contains('by-variant')).toBe(true)
      expect(store.indexNames.contains('by-active')).toBe(true)
      expect(store.indexNames.contains('by-created')).toBe(true)
      expect(store.indexNames.contains('by-updated')).toBe(true)
      expect(store.indexNames.contains('by-variant-updated')).toBe(true)
      expect(store.indexNames.contains('by-variant-active')).toBe(true)
    })
  })

  describe('CRUD Operations', () => {
    it('should save and retrieve a conversation', async () => {
      const conversation = createTestConversation('test-variant', 'conv-1')

      await idbStorage.saveConversation(conversation)
      const loaded = await idbStorage.loadConversation(unsafeVariantName('test-variant'), unsafeConversationId('conv-1'))

      expect(loaded).toBeTruthy()
      expect(loaded?.id).toBe('conv-1')
      expect(loaded?.variantName).toBe('test-variant')
      expect(loaded?.messages.length).toBe(2)
    })

    it('should update existing conversation', async () => {
      const conversation = createTestConversation('test-variant', 'conv-1')

      await idbStorage.saveConversation(conversation)

      conversation.messages.push({
        role: 'user',
        content: 'New message',
        timestamp: Date.now(),
        id: 'msg-3'
      })
      conversation.messageCount = 3

      await idbStorage.saveConversation(conversation)
      const loaded = await idbStorage.loadConversation(unsafeVariantName('test-variant'), unsafeConversationId('conv-1'))

      expect(loaded?.messages.length).toBe(3)
      expect(loaded?.messageCount).toBe(3)
    })

    it('should delete a conversation', async () => {
      const conversation = createTestConversation('test-variant', 'conv-1')

      await idbStorage.saveConversation(conversation)
      await idbStorage.deleteConversation(unsafeVariantName('test-variant'), unsafeConversationId('conv-1'))

      const loaded = await idbStorage.loadConversation(unsafeVariantName('test-variant'), unsafeConversationId('conv-1'))
      expect(loaded).toBeNull()
    })

    it('should get all conversations for a variant', async () => {
      await idbStorage.saveConversation(createTestConversation('variant-a', 'conv-1'))
      await idbStorage.saveConversation(createTestConversation('variant-a', 'conv-2'))
      await idbStorage.saveConversation(createTestConversation('variant-b', 'conv-3'))

      const conversations = await idbStorage.getConversations(unsafeVariantName('variant-a'))

      expect(conversations.length).toBe(2)
      expect(conversations.every(c => c.variantName === 'variant-a')).toBe(true)
    })
  })

  describe('Conversation List', () => {
    it('should return conversation list with metadata only', async () => {
      await idbStorage.saveConversation(createTestConversation('variant-a', 'conv-1'))
      await idbStorage.saveConversation(createTestConversation('variant-a', 'conv-2'))

      const list = await idbStorage.getConversationList(unsafeVariantName('variant-a'))

      expect(list.length).toBe(2)
      expect(list[0]).toHaveProperty('id')
      expect(list[0]).toHaveProperty('createdAt')
      expect(list[0]).toHaveProperty('updatedAt')
      expect(list[0]).toHaveProperty('messageCount')
      expect(list[0]).toHaveProperty('firstUserMessage')
      expect(list[0]).toHaveProperty('isActive')
      expect(list[0]).not.toHaveProperty('messages')
    })

    it('should return list sorted by updatedAt descending', async () => {
      const now = Date.now()
      const conv1 = createTestConversation('variant-a', 'conv-1')
      conv1.createdAt = now - 3000
      conv1.updatedAt = now - 3000

      const conv2 = createTestConversation('variant-a', 'conv-2')
      conv2.createdAt = now - 2000
      conv2.updatedAt = now - 2000

      const conv3 = createTestConversation('variant-a', 'conv-3')
      conv3.createdAt = now - 1000
      conv3.updatedAt = now - 1000

      await idbStorage.saveConversation(conv1)
      await idbStorage.saveConversation(conv2)
      await idbStorage.saveConversation(conv3)

      const list = await idbStorage.getConversationList(unsafeVariantName('variant-a'))

      expect(list[0].id).toBe('conv-3')
      expect(list[1].id).toBe('conv-2')
      expect(list[2].id).toBe('conv-1')
    })
  })

  describe('Active Conversation', () => {
    it('should set active conversation', async () => {
      await idbStorage.saveConversation(createTestConversation('variant-a', 'conv-1'))
      await idbStorage.saveConversation(createTestConversation('variant-a', 'conv-2'))

      await idbStorage.setActiveConversation(unsafeVariantName('variant-a'), unsafeConversationId('conv-2'))

      const conv1 = await idbStorage.loadConversation(unsafeVariantName('variant-a'), unsafeConversationId('conv-1'))
      const conv2 = await idbStorage.loadConversation(unsafeVariantName('variant-a'), unsafeConversationId('conv-2'))

      expect(conv1?.isActive).toBe(false)
      expect(conv2?.isActive).toBe(true)
    })

    it('should deactivate previous active conversation', async () => {
      const conv1 = createTestConversation('variant-a', 'conv-1')
      conv1.isActive = true

      const conv2 = createTestConversation('variant-a', 'conv-2')
      conv2.isActive = false

      await idbStorage.saveConversation(conv1)
      await idbStorage.saveConversation(conv2)

      await idbStorage.setActiveConversation(unsafeVariantName('variant-a'), unsafeConversationId('conv-2'))

      const updated1 = await idbStorage.loadConversation(unsafeVariantName('variant-a'), unsafeConversationId('conv-1'))
      const updated2 = await idbStorage.loadConversation(unsafeVariantName('variant-a'), unsafeConversationId('conv-2'))

      expect(updated1?.isActive).toBe(false)
      expect(updated2?.isActive).toBe(true)
    })
  })

  describe('Conversation Limits', () => {
    it('should enforce max 10 conversations per variant', async () => {
      for (let i = 0; i < 15; i++) {
        const conv = createTestConversation('variant-a', `conv-${i}`)
        conv.createdAt = Date.now() - (15 - i) * 1000
        await idbStorage.saveConversation(conv)
      }

      const conversations = await idbStorage.getConversations(unsafeVariantName('variant-a'))

      expect(conversations.length).toBe(10)
    })

    it('should delete oldest conversations when limit exceeded', async () => {
      const now = Date.now()

      for (let i = 0; i < 15; i++) {
        const conv = createTestConversation('variant-a', `conv-${i}`)
        conv.createdAt = now - (15 - i) * 1000
        await idbStorage.saveConversation(conv)
      }

      const conversations = await idbStorage.getConversations(unsafeVariantName('variant-a'))

      const oldestId = conversations.reduce((oldest, conv) =>
        conv.createdAt < oldest.createdAt ? conv : oldest
      ).id

      expect(oldestId).toBe('conv-5')
    })
  })

  describe('Metadata Operations', () => {
    it('should save and retrieve metadata', async () => {
      await idbStorage.setMetadata('test-key', { foo: 'bar' })
      const value = await idbStorage.getMetadata('test-key')

      expect(value).toEqual({ foo: 'bar' })
    })

    it('should update existing metadata', async () => {
      await idbStorage.setMetadata('test-key', { version: 1 })
      await idbStorage.setMetadata('test-key', { version: 2 })

      const value = await idbStorage.getMetadata('test-key')
      expect(value).toEqual({ version: 2 })
    })

    it('should return undefined for non-existent metadata', async () => {
      const value = await idbStorage.getMetadata('non-existent')
      expect(value).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle loading non-existent conversation gracefully', async () => {
      const conversation = await idbStorage.loadConversation(unsafeVariantName('variant-a'), unsafeConversationId('non-existent'))
      expect(conversation).toBeNull()
    })

    it('should handle getting conversations from non-existent variant', async () => {
      const conversations = await idbStorage.getConversations(unsafeVariantName('non-existent-variant'))
      expect(conversations).toEqual([])
    })

    it('should handle getting list from empty variant', async () => {
      const list = await idbStorage.getConversationList(unsafeVariantName('empty-variant'))
      expect(list).toEqual([])
    })
  })
})

function createTestConversation(variantName: string, id: string): StoredConversation {
  return {
    id: unsafeConversationId(id),
    variantName: unsafeVariantName(variantName),
    messages: [
      {
        role: 'user',
        content: 'Test message 1',
        timestamp: Date.now(),
        id: 'msg-1'
      },
      {
        role: 'assistant',
        content: 'Test response 1',
        timestamp: Date.now(),
        id: 'msg-2'
      }
    ],
    conversationSession: {
      id: unsafeSessionId(`session-${id}`),
      htmlSent: false,
      messages: []
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 2,
    firstUserMessage: 'Test message 1',
    isActive: false
  }
}

async function clearDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      console.warn('Database deletion blocked')
      resolve()
    }
  })
}
