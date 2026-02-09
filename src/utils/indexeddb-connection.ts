import { debugLog, debugWarn } from '~src/utils/debug'
import {
  DB_NAME,
  DB_VERSION,
  STORE_CONVERSATIONS,
  STORE_METADATA
} from '~src/types/indexeddb'

let dbPromise: Promise<IDBDatabase> | null = null

export async function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[IndexedDB] Error opening database:', request.error)
      dbPromise = null
      reject(request.error)
    }

    request.onsuccess = () => {
      debugLog('[IndexedDB] Database opened successfully')
      const db = request.result
      db.onclose = () => {
        debugWarn('[IndexedDB] Database connection closed by browser')
        dbPromise = null
      }
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      debugLog(`[IndexedDB] Upgrading database to version ${db.version}`)

      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        const convStore = db.createObjectStore(STORE_CONVERSATIONS, {
          keyPath: 'id'
        })

        convStore.createIndex('by-variant', 'variantName', { unique: false })
        convStore.createIndex('by-active', 'isActive', { unique: false })
        convStore.createIndex('by-created', 'createdAt', { unique: false })
        convStore.createIndex('by-updated', 'updatedAt', { unique: false })
        convStore.createIndex('by-variant-updated',
          ['variantName', 'updatedAt'],
          { unique: false }
        )
        convStore.createIndex('by-variant-active',
          ['variantName', 'isActive'],
          { unique: false }
        )

        debugLog('[IndexedDB] Created conversations store with indexes')
      }

      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'key' })
        debugLog('[IndexedDB] Created metadata store')
      }
    }
  })

  return dbPromise
}

export function closeDatabase(): void {
  if (dbPromise) {
    dbPromise.then(db => db.close())
    dbPromise = null
  }
}
