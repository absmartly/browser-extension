import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { DB_NAME, DB_VERSION, STORE_CONVERSATIONS, STORE_METADATA } from '~src/types/indexeddb'
import { openDatabase, closeDatabase } from '~src/utils/indexeddb-connection'

describe('IndexedDB Connection Management', () => {
  afterEach(async () => {
    closeDatabase()
    await clearDatabase()
  })

  describe('Database Opening', () => {
    it('should open database with correct name and version', async () => {
      const db = await openDatabase()

      expect(db.name).toBe(DB_NAME)
      expect(db.version).toBe(DB_VERSION)
    })

    it('should create conversations object store', async () => {
      const db = await openDatabase()

      expect(db.objectStoreNames.contains(STORE_CONVERSATIONS)).toBe(true)
    })

    it('should create metadata object store', async () => {
      const db = await openDatabase()

      expect(db.objectStoreNames.contains(STORE_METADATA)).toBe(true)
    })

    it('should reuse existing database connection', async () => {
      const db1 = await openDatabase()
      const db2 = await openDatabase()

      expect(db1).toBe(db2)
    })
  })

  describe('Database Schema', () => {
    it('should create conversations store with correct keyPath', async () => {
      const db = await openDatabase()
      const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
      const store = tx.objectStore(STORE_CONVERSATIONS)

      expect(store.keyPath).toBe('id')
    })

    it('should create metadata store with correct keyPath', async () => {
      const db = await openDatabase()
      const tx = db.transaction(STORE_METADATA, 'readonly')
      const store = tx.objectStore(STORE_METADATA)

      expect(store.keyPath).toBe('key')
    })

    it('should create all required indexes on conversations store', async () => {
      const db = await openDatabase()
      const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
      const store = tx.objectStore(STORE_CONVERSATIONS)

      const expectedIndexes = [
        'by-variant',
        'by-active',
        'by-created',
        'by-updated',
        'by-variant-updated',
        'by-variant-active'
      ]

      for (const indexName of expectedIndexes) {
        expect(store.indexNames.contains(indexName)).toBe(true)
      }
    })

    it('should create by-variant index with correct properties', async () => {
      const db = await openDatabase()
      const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
      const store = tx.objectStore(STORE_CONVERSATIONS)
      const index = store.index('by-variant')

      expect(index.keyPath).toBe('variantName')
      expect(index.unique).toBe(false)
    })

    it('should create by-variant-updated compound index', async () => {
      const db = await openDatabase()
      const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
      const store = tx.objectStore(STORE_CONVERSATIONS)
      const index = store.index('by-variant-updated')

      expect(index.keyPath).toEqual(['variantName', 'updatedAt'])
      expect(index.unique).toBe(false)
    })

    it('should create by-variant-active compound index', async () => {
      const db = await openDatabase()
      const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
      const store = tx.objectStore(STORE_CONVERSATIONS)
      const index = store.index('by-variant-active')

      expect(index.keyPath).toEqual(['variantName', 'isActive'])
      expect(index.unique).toBe(false)
    })
  })

  describe('Connection Pooling', () => {
    it('should return same database instance on multiple calls', async () => {
      const db1 = await openDatabase()
      const db2 = await openDatabase()
      const db3 = await openDatabase()

      expect(db1).toBe(db2)
      expect(db2).toBe(db3)
    })

    it('should create new connection after closing', async () => {
      const db1 = await openDatabase()
      const db1Name = db1.name

      closeDatabase()

      const db2 = await openDatabase()
      const db2Name = db2.name

      expect(db1Name).toBe(db2Name)
    })
  })

  describe('Database Closing', () => {
    it('should close database connection', async () => {
      await openDatabase()
      closeDatabase()

      const db = await openDatabase()
      expect(db).toBeTruthy()
    })

    it('should handle multiple close calls gracefully', async () => {
      await openDatabase()
      closeDatabase()
      closeDatabase()
      closeDatabase()

      const db = await openDatabase()
      expect(db).toBeTruthy()
    })
  })

  describe('Upgrade Handling', () => {
    it('should handle database upgrade gracefully', async () => {
      const db = await openDatabase()
      expect(db.version).toBe(DB_VERSION)

      closeDatabase()

      const db2 = await openDatabase()
      expect(db2.version).toBe(DB_VERSION)
    })
  })

  describe('Error Handling', () => {
    it('should handle database open errors', async () => {
      const originalIndexedDB = global.indexedDB

      global.indexedDB = {
        ...originalIndexedDB,
        open: () => {
          const request = {
            error: new Error('Test error')
          } as IDBOpenDBRequest
          setTimeout(() => {
            if (request.onerror) {
              request.onerror(new Event('error'))
            }
          }, 0)
          return request
        }
      } as any

      await expect(openDatabase()).rejects.toThrow()

      global.indexedDB = originalIndexedDB
    })
  })
})

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
