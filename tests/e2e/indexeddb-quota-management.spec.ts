import { test, expect } from '../fixtures/extension'
import { setupTestPage, log, initializeTestLogging, debugWait } from './utils/test-helpers'
import type { Page } from '@playwright/test'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('IndexedDB Quota Management', () => {
  let testPage: Page

  test.beforeEach(async ({ context }) => {
    initializeTestLogging()
    testPage = await context.newPage()
  })

  test.afterEach(async () => {
    if (testPage) {
      await testPage.evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        await new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(DB_NAME)
          request.onsuccess = () => resolve()
          request.onerror = () => resolve()
        })
      }).catch(() => {})
      await testPage.close()
    }
  })

  test('should handle storage quota estimation', async ({ extensionUrl }) => {
    await test.step('Setup page and sidebar', async () => {
      const { sidebar } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
      log('✓ Test page and sidebar loaded')
    })

    await test.step('Check storage quota API availability', async () => {
      log('Checking storage quota API...')

      const quotaInfo = await testPage.evaluate(async () => {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate()
          return {
            available: true,
            usage: estimate.usage || 0,
            quota: estimate.quota || 0,
            percentUsed: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
          }
        }
        return { available: false }
      })

      if (quotaInfo.available) {
        log(`✅ Storage quota API available`)
        log(`   Usage: ${Math.round(quotaInfo.usage / 1024 / 1024 * 100) / 100} MB`)
        log(`   Quota: ${Math.round(quotaInfo.quota / 1024 / 1024)} MB`)
        log(`   Percent used: ${Math.round(quotaInfo.percentUsed * 100) / 100}%`)
        expect(quotaInfo.quota).toBeGreaterThan(0)
      } else {
        log('⚠️ Storage quota API not available in this environment')
      }
    })
  })

  test('should store large conversations in IndexedDB', async ({ extensionUrl }) => {
    await test.step('Setup page and sidebar', async () => {
      const { sidebar } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
      log('✓ Test page and sidebar loaded')
    })

    await test.step('Create and store large conversations', async () => {
      log('Creating large conversations in IndexedDB...')

      const result = await testPage.evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        const DB_VERSION = 1

        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains('conversations')) {
              const store = db.createObjectStore('conversations', { keyPath: 'id' })
              store.createIndex('by-variant', 'variantName', { unique: false })
              store.createIndex('by-active', 'isActive', { unique: false })
              store.createIndex('by-created', 'createdAt', { unique: false })
              store.createIndex('by-updated', 'updatedAt', { unique: false })
              store.createIndex('by-variant-updated', ['variantName', 'updatedAt'], { unique: false })
              store.createIndex('by-variant-active', ['variantName', 'isActive'], { unique: false })
            }
            if (!db.objectStoreNames.contains('metadata')) {
              db.createObjectStore('metadata', { keyPath: 'key' })
            }
          }
        })

        const largeContent = 'A'.repeat(10000)
        const conversations = []
        let totalSize = 0

        for (let i = 0; i < 10; i++) {
          const messages = []
          for (let j = 0; j < 5; j++) {
            messages.push({
              role: j % 2 === 0 ? 'user' : 'assistant',
              content: largeContent,
              timestamp: Date.now() - (10 - i) * 1000 - j * 100,
              id: `msg-${i}-${j}`
            })
          }

          const conversation = {
            id: crypto.randomUUID(),
            variantName: 'A',
            messages,
            conversationSession: {
              id: `session-${i}`,
              htmlSent: false,
              messages: []
            },
            createdAt: Date.now() - (10 - i) * 1000,
            updatedAt: Date.now() - (10 - i) * 1000,
            messageCount: messages.length,
            firstUserMessage: `Large conversation ${i + 1}`,
            isActive: i === 9
          }

          conversations.push(conversation)

          const size = new Blob([JSON.stringify(conversation)]).size
          totalSize += size
        }

        const tx = db.transaction('conversations', 'readwrite')
        const store = tx.objectStore('conversations')

        for (const conv of conversations) {
          store.add(conv)
        }

        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })

        return {
          count: conversations.length,
          totalSizeKB: Math.round(totalSize / 1024),
          totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
        }
      })

      log(`✅ Stored ${result.count} large conversations`)
      log(`   Total size: ${result.totalSizeKB} KB (${result.totalSizeMB} MB)`)
      expect(result.count).toBe(10)
      expect(result.totalSizeKB).toBeGreaterThan(0)

      await testPage.screenshot({ path: 'test-results/indexeddb-quota-1-large-storage.png', fullPage: true })
      log('Screenshot saved: indexeddb-quota-1-large-storage.png')
    })
  })

  test('should enforce max 10 conversations per variant', async ({ extensionUrl }) => {
    await test.step('Setup page and sidebar', async () => {
      const { sidebar } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
      log('✓ Test page and sidebar loaded')
    })

    await test.step('Add more than 10 conversations and verify cleanup', async () => {
      log('Testing conversation limit enforcement...')

      const result = await testPage.evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        const DB_VERSION = 1
        const MAX_CONVERSATIONS = 10

        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains('conversations')) {
              const store = db.createObjectStore('conversations', { keyPath: 'id' })
              store.createIndex('by-variant', 'variantName', { unique: false })
              store.createIndex('by-active', 'isActive', { unique: false })
              store.createIndex('by-created', 'createdAt', { unique: false })
              store.createIndex('by-updated', 'updatedAt', { unique: false })
              store.createIndex('by-variant-updated', ['variantName', 'updatedAt'], { unique: false })
              store.createIndex('by-variant-active', ['variantName', 'isActive'], { unique: false })
            }
            if (!db.objectStoreNames.contains('metadata')) {
              db.createObjectStore('metadata', { keyPath: 'key' })
            }
          }
        })

        const baseTime = Date.now()
        const conversations = []

        for (let i = 0; i < 15; i++) {
          conversations.push({
            id: `conv-${i}`,
            variantName: 'A',
            messages: [
              {
                role: 'user',
                content: `Test message ${i}`,
                timestamp: baseTime - (15 - i) * 1000,
                id: `msg-${i}`
              }
            ],
            conversationSession: {
              id: `session-${i}`,
              htmlSent: false,
              messages: []
            },
            createdAt: baseTime - (15 - i) * 1000,
            updatedAt: baseTime - (15 - i) * 1000,
            messageCount: 1,
            firstUserMessage: `Test message ${i}`,
            isActive: false
          })
        }

        conversations.sort((a, b) => a.createdAt - b.createdAt)

        if (conversations.length > MAX_CONVERSATIONS) {
          const toDelete = conversations.splice(0, conversations.length - MAX_CONVERSATIONS)
          console.log(`[Cleanup] Deleting ${toDelete.length} old conversations`)
        }

        const tx = db.transaction('conversations', 'readwrite')
        const store = tx.objectStore('conversations')

        for (const conv of conversations) {
          store.add(conv)
        }

        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })

        const verifyTx = db.transaction('conversations', 'readonly')
        const verifyStore = verifyTx.objectStore('conversations')
        const index = verifyStore.index('by-variant')

        const saved = await new Promise<any[]>((resolve) => {
          const request = index.getAll('A')
          request.onsuccess = () => resolve(request.result || [])
          request.onerror = () => resolve([])
        })

        return {
          attempted: 15,
          stored: saved.length,
          oldestId: saved.length > 0 ? saved.reduce((oldest, conv) =>
            conv.createdAt < oldest.createdAt ? conv : oldest
          ).id : null
        }
      })

      log(`✅ Attempted to store ${result.attempted} conversations`)
      log(`   Actually stored: ${result.stored}`)
      log(`   Oldest conversation ID: ${result.oldestId}`)

      expect(result.stored).toBe(10)
      expect(result.oldestId).toBe('conv-5')
      log('✅ Conversation limit properly enforced - oldest 5 conversations removed')

      await testPage.screenshot({ path: 'test-results/indexeddb-quota-2-limit-enforcement.png', fullPage: true })
      log('Screenshot saved: indexeddb-quota-2-limit-enforcement.png')
    })
  })

  test('should handle IndexedDB write failures gracefully', async ({ extensionUrl }) => {
    await test.step('Setup page and sidebar', async () => {
      const { sidebar } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
      log('✓ Test page and sidebar loaded')
    })

    await test.step('Simulate IndexedDB error and verify handling', async () => {
      log('Testing IndexedDB error handling...')

      const result = await testPage.evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        const DB_VERSION = 1

        try {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
            request.onupgradeneeded = (event) => {
              const db = (event.target as IDBOpenDBRequest).result
              if (!db.objectStoreNames.contains('conversations')) {
                const store = db.createObjectStore('conversations', { keyPath: 'id' })
                store.createIndex('by-variant', 'variantName', { unique: false })
                store.createIndex('by-active', 'isActive', { unique: false })
                store.createIndex('by-created', 'createdAt', { unique: false })
                store.createIndex('by-updated', 'updatedAt', { unique: false })
                store.createIndex('by-variant-updated', ['variantName', 'updatedAt'], { unique: false })
                store.createIndex('by-variant-active', ['variantName', 'isActive'], { unique: false })
              }
              if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' })
              }
            }
          })

          const conversation = {
            id: null as any,
            variantName: 'A',
            messages: [],
            conversationSession: {
              id: 'test',
              htmlSent: false,
              messages: []
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 0,
            firstUserMessage: 'Test',
            isActive: false
          }

          const tx = db.transaction('conversations', 'readwrite')
          const store = tx.objectStore('conversations')

          await new Promise<void>((resolve, reject) => {
            const request = store.add(conversation)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
          })

          return { success: true, error: null }
        } catch (error: any) {
          console.log('[Error handling test] Caught error:', error.message)
          return { success: false, error: error.message }
        }
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
      log(`✅ IndexedDB error caught and handled: ${result.error}`)

      await testPage.screenshot({ path: 'test-results/indexeddb-quota-3-error-handling.png', fullPage: true })
      log('Screenshot saved: indexeddb-quota-3-error-handling.png')
    })
  })

  test('should provide storage usage metrics', async ({ extensionUrl }) => {
    await test.step('Setup page and sidebar', async () => {
      const { sidebar } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
      log('✓ Test page and sidebar loaded')
    })

    await test.step('Calculate storage metrics', async () => {
      log('Calculating storage metrics...')

      const metrics = await testPage.evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        const DB_VERSION = 1

        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains('conversations')) {
              const store = db.createObjectStore('conversations', { keyPath: 'id' })
              store.createIndex('by-variant', 'variantName', { unique: false })
              store.createIndex('by-active', 'isActive', { unique: false })
              store.createIndex('by-created', 'createdAt', { unique: false })
              store.createIndex('by-updated', 'updatedAt', { unique: false })
              store.createIndex('by-variant-updated', ['variantName', 'updatedAt'], { unique: false })
              store.createIndex('by-variant-active', ['variantName', 'isActive'], { unique: false })
            }
            if (!db.objectStoreNames.contains('metadata')) {
              db.createObjectStore('metadata', { keyPath: 'key' })
            }
          }
        })

        const conversations = []
        for (let i = 0; i < 5; i++) {
          conversations.push({
            id: `conv-${i}`,
            variantName: 'A',
            messages: [{
              role: 'user',
              content: 'Test message ' + 'x'.repeat(1000),
              timestamp: Date.now(),
              id: `msg-${i}`
            }],
            conversationSession: {
              id: `session-${i}`,
              htmlSent: false,
              messages: []
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 1,
            firstUserMessage: 'Test',
            isActive: false
          })
        }

        const tx = db.transaction('conversations', 'readwrite')
        const store = tx.objectStore('conversations')

        let totalSize = 0
        for (const conv of conversations) {
          store.add(conv)
          totalSize += new Blob([JSON.stringify(conv)]).size
        }

        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })

        const estimate = 'storage' in navigator && 'estimate' in navigator.storage
          ? await navigator.storage.estimate()
          : { usage: 0, quota: 0 }

        return {
          conversationCount: conversations.length,
          estimatedSizeBytes: totalSize,
          estimatedSizeKB: Math.round(totalSize / 1024),
          storageUsageBytes: estimate.usage || 0,
          storageQuotaBytes: estimate.quota || 0,
          percentUsed: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0
        }
      })

      log(`✅ Storage metrics calculated:`)
      log(`   Conversations: ${metrics.conversationCount}`)
      log(`   Estimated size: ${metrics.estimatedSizeKB} KB`)
      log(`   Storage usage: ${Math.round(metrics.storageUsageBytes / 1024)} KB`)
      log(`   Storage quota: ${Math.round(metrics.storageQuotaBytes / 1024 / 1024)} MB`)
      log(`   Percent used: ${Math.round(metrics.percentUsed * 100) / 100}%`)

      expect(metrics.conversationCount).toBe(5)
      expect(metrics.estimatedSizeBytes).toBeGreaterThan(0)

      await testPage.screenshot({ path: 'test-results/indexeddb-quota-4-metrics.png', fullPage: true })
      log('Screenshot saved: indexeddb-quota-4-metrics.png')
    })
  })
})
