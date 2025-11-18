import type {
  StoredConversation,
  ConversationListItem
} from '~src/types/absmartly'
import type { IDBMetadataRecord } from '~src/types/indexeddb'
import { STORE_CONVERSATIONS, STORE_METADATA } from '~src/types/indexeddb'
import { openDatabase } from './indexeddb-connection'

const MAX_CONVERSATIONS_PER_VARIANT = 10

export async function getConversations(
  variantName: string
): Promise<StoredConversation[]> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
  const store = tx.objectStore(STORE_CONVERSATIONS)
  const index = store.index('by-variant')

  return new Promise((resolve, reject) => {
    const request = index.getAll(variantName)
    request.onsuccess = () => {
      resolve(request.result || [])
    }
    request.onerror = () => {
      console.error('[IndexedDB] Error getting conversations:', request.error)
      resolve([])
    }
  })
}

export async function saveConversation(
  conversation: StoredConversation
): Promise<void> {
  const existing = await getConversations(conversation.variantName)

  const existingIndex = existing.findIndex(c => c.id === conversation.id)
  if (existingIndex >= 0) {
    conversation.updatedAt = Date.now()
  } else {
    conversation.createdAt = conversation.createdAt || Date.now()
    conversation.updatedAt = Date.now()
    existing.push(conversation)
  }

  if (existing.length > MAX_CONVERSATIONS_PER_VARIANT) {
    existing.sort((a, b) => a.createdAt - b.createdAt)
    const toDelete = existing.splice(0, existing.length - MAX_CONVERSATIONS_PER_VARIANT)

    await batchDeleteConversations(toDelete.map(c => c.id))
  }

  const db = await openDatabase()
  const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite')
  const store = tx.objectStore(STORE_CONVERSATIONS)

  return new Promise((resolve, reject) => {
    const request = store.put(conversation)
    request.onsuccess = () => {
      console.log(`[IndexedDB] Saved conversation ${conversation.id}`)
      resolve()
    }
    request.onerror = () => {
      console.error('[IndexedDB] Error saving conversation:', request.error)
      reject(request.error)
    }
  })
}

export async function loadConversation(
  variantName: string,
  conversationId: string
): Promise<StoredConversation | null> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
  const store = tx.objectStore(STORE_CONVERSATIONS)

  return new Promise((resolve, reject) => {
    const request = store.get(conversationId)
    request.onsuccess = () => {
      const result = request.result
      if (result && result.variantName === variantName) {
        console.log(`[IndexedDB] Loaded conversation ${conversationId}`)
        resolve(result)
      } else {
        console.warn(`[IndexedDB] Conversation ${conversationId} not found`)
        resolve(null)
      }
    }
    request.onerror = () => {
      console.error('[IndexedDB] Error loading conversation:', request.error)
      resolve(null)
    }
  })
}

export async function deleteConversation(
  variantName: string,
  conversationId: string
): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite')
  const store = tx.objectStore(STORE_CONVERSATIONS)

  return new Promise((resolve, reject) => {
    const request = store.delete(conversationId)
    request.onsuccess = () => {
      console.log(`[IndexedDB] Deleted conversation ${conversationId}`)
      resolve()
    }
    request.onerror = () => {
      console.error('[IndexedDB] Error deleting conversation:', request.error)
      reject(request.error)
    }
  })
}

export async function getConversationList(
  variantName: string
): Promise<ConversationListItem[]> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
  const store = tx.objectStore(STORE_CONVERSATIONS)
  const index = store.index('by-variant-updated')

  const range = IDBKeyRange.bound(
    [variantName, 0],
    [variantName, Date.now()],
    false,
    false
  )

  return new Promise((resolve, reject) => {
    const conversations: ConversationListItem[] = []
    const request = index.openCursor(range, 'prev')

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        const conv = cursor.value as StoredConversation
        conversations.push({
          id: conv.id,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          messageCount: conv.messageCount,
          firstUserMessage: conv.firstUserMessage,
          isActive: conv.isActive
        })
        cursor.continue()
      } else {
        resolve(conversations)
      }
    }

    request.onerror = () => {
      console.error('[IndexedDB] Error getting conversation list:', request.error)
      resolve([])
    }
  })
}

export async function setActiveConversation(
  variantName: string,
  conversationId: string
): Promise<void> {
  const db = await openDatabase()
  const conversations = await getConversations(variantName)

  const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite')
  const store = tx.objectStore(STORE_CONVERSATIONS)

  const updates = conversations.map(conv => {
    conv.isActive = conv.id === conversationId
    return new Promise((resolve, reject) => {
      const request = store.put(conv)
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  })

  await Promise.all(updates)
  console.log(`[IndexedDB] Set active conversation to ${conversationId}`)
}

async function batchDeleteConversations(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const db = await openDatabase()
  const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite')
  const store = tx.objectStore(STORE_CONVERSATIONS)

  const promises = ids.map(id =>
    new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  )

  await Promise.all(promises)
}

export async function getMetadata(key: string): Promise<any> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_METADATA, 'readonly')
  const store = tx.objectStore(STORE_METADATA)

  return new Promise((resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result?.value)
    request.onerror = () => reject(request.error)
  })
}

export async function setMetadata(key: string, value: any): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_METADATA, 'readwrite')
  const store = tx.objectStore(STORE_METADATA)

  return new Promise((resolve, reject) => {
    const record: IDBMetadataRecord = {
      key,
      value,
      updatedAt: Date.now()
    }
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
