# IndexedDB Migration Plan: AI Conversation Storage

## Executive Summary

This document outlines a comprehensive plan to migrate AI conversation storage from `chrome.storage.local` (via Plasmo Storage API) to IndexedDB. The migration addresses storage capacity limitations while maintaining backward compatibility and preventing data loss.

**Current State:**
- Storage: chrome.storage.local via Plasmo Storage API
- Limit: 5 MB per variant
- Data: Conversations with messages, images (base64), session metadata
- File: `src/utils/ai-conversation-storage.ts`

**Target State:**
- Storage: IndexedDB with proper schema and indexes
- Limit: ~50 MB per origin (expandable with quota API)
- Same API surface for seamless transition
- Automatic migration on first access

---

## 1. Schema Design

### 1.1 Database Structure

**Database Name:** `absmartly-conversations`
**Version:** 1
**Object Stores:** 2

#### Object Store 1: `conversations`

Primary store for conversation data.

```typescript
interface ConversationRecord {
  // Primary Key (auto-generated)
  id: string                    // Conversation ID (UUID)

  // Indexed Fields
  variantName: string           // Index: 'by-variant'
  isActive: boolean             // Index: 'by-active'
  createdAt: number             // Index: 'by-created'
  updatedAt: number             // Index: 'by-updated'

  // Composite Index
  // Index: 'by-variant-updated' on [variantName, updatedAt]
  // Index: 'by-variant-active' on [variantName, isActive]

  // Data Fields
  messageCount: number
  firstUserMessage: string

  // Large Data (not indexed)
  messages: ChatMessage[]       // Array of messages with images
  conversationSession: ConversationSession
}
```

**Indexes:**
1. `by-variant` - `variantName` (non-unique) - Fast variant lookup
2. `by-active` - `isActive` (non-unique) - Find active conversations
3. `by-created` - `createdAt` (non-unique) - Sort by creation date
4. `by-updated` - `updatedAt` (non-unique) - Sort by update date
5. `by-variant-updated` - `[variantName, updatedAt]` (compound, non-unique) - Optimized list queries
6. `by-variant-active` - `[variantName, isActive]` (compound, non-unique) - Find active per variant

#### Object Store 2: `metadata`

Stores migration metadata and version information.

```typescript
interface MetadataRecord {
  key: string                   // Primary Key (keyPath)
  value: any                    // Flexible value storage
  updatedAt: number
}
```

**Special Keys:**
- `version` - Schema version number
- `migrated-from-chrome-storage` - Timestamp of migration
- `last-cleanup` - Last cleanup operation timestamp

### 1.2 Type Definitions

```typescript
// src/types/indexeddb.ts
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
  value: any
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
```

---

## 2. Migration Strategy

### 2.1 Migration Architecture

**Approach:** Lazy migration with fallback

1. On first access to any conversation API function:
   - Check if migration has been completed (via `metadata` store)
   - If not migrated, trigger one-time migration
   - Import all conversations from chrome.storage.local
   - Mark migration as complete
   - Keep chrome.storage.local data as backup (delete after 30 days)

2. Dual-read period (optional safety measure):
   - First 7 days: Read from IndexedDB, validate against chrome.storage
   - Log discrepancies but use IndexedDB data
   - After 7 days: Pure IndexedDB mode

### 2.2 Migration Flow

```typescript
async function migrateFromChromeStorage(): Promise<void> {
  // 1. Check if already migrated
  const migrated = await getMetadata('migrated-from-chrome-storage')
  if (migrated) {
    return // Already migrated
  }

  console.log('[Migration] Starting chrome.storage -> IndexedDB migration')

  // 2. Get all variant keys from chrome.storage
  const storage = new Storage({ area: 'local' })
  const allKeys = await storage.getAll()
  const conversationKeys = Object.keys(allKeys).filter(k =>
    k.startsWith('ai-conversations-')
  )

  console.log(`[Migration] Found ${conversationKeys.length} variant keys`)

  // 3. Migrate each variant's conversations
  let totalMigrated = 0
  for (const key of conversationKeys) {
    const dataStr = allKeys[key]
    if (!dataStr) continue

    try {
      const data: StoredConversationsData = JSON.parse(dataStr)
      const conversations = data.conversations || []

      // Batch insert into IndexedDB
      await batchSaveConversations(conversations)
      totalMigrated += conversations.length

      console.log(`[Migration] Migrated ${conversations.length} from ${key}`)
    } catch (error) {
      console.error(`[Migration] Error migrating ${key}:`, error)
      // Continue with other variants
    }
  }

  // 4. Mark migration complete
  await setMetadata('migrated-from-chrome-storage', {
    timestamp: Date.now(),
    totalConversations: totalMigrated,
    version: DB_VERSION
  })

  console.log(`[Migration] Complete. Migrated ${totalMigrated} conversations`)

  // 5. Schedule cleanup (delete chrome.storage data after 30 days)
  await scheduleCleanup()
}
```

### 2.3 Rollback Support

```typescript
async function rollbackToChromeStorage(): Promise<void> {
  console.log('[Rollback] Exporting IndexedDB back to chrome.storage')

  const db = await openDatabase()
  const allConversations = await getAllConversationsFromDB(db)

  // Group by variant
  const byVariant = new Map<string, StoredConversation[]>()
  for (const conv of allConversations) {
    const list = byVariant.get(conv.variantName) || []
    list.push(conv)
    byVariant.set(conv.variantName, list)
  }

  // Write back to chrome.storage
  const storage = new Storage({ area: 'local' })
  for (const [variantName, conversations] of byVariant) {
    const data: StoredConversationsData = {
      conversations,
      version: CONVERSATIONS_VERSION
    }
    const key = `ai-conversations-${variantName}`
    await storage.set(key, JSON.stringify(data))
  }

  console.log(`[Rollback] Exported ${allConversations.length} conversations`)
}
```

---

## 3. API Compatibility Layer

### 3.1 Database Connection Management

```typescript
// src/utils/indexeddb-connection.ts

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
      console.log('[IndexedDB] Database opened successfully')
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      console.log(`[IndexedDB] Upgrading database to version ${db.version}`)

      // Create conversations store
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        const convStore = db.createObjectStore(STORE_CONVERSATIONS, {
          keyPath: 'id'
        })

        // Create indexes
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

        console.log('[IndexedDB] Created conversations store with indexes')
      }

      // Create metadata store
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'key' })
        console.log('[IndexedDB] Created metadata store')
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
```

### 3.2 Core Storage Operations

```typescript
// src/utils/indexeddb-storage.ts

async function ensureMigrated(): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_METADATA, 'readonly')
  const store = tx.objectStore(STORE_METADATA)

  return new Promise((resolve, reject) => {
    const request = store.get('migrated-from-chrome-storage')
    request.onsuccess = () => {
      if (!request.result) {
        // Not migrated yet, trigger migration
        migrateFromChromeStorage()
          .then(() => resolve())
          .catch(reject)
      } else {
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function getConversations(
  variantName: string
): Promise<StoredConversation[]> {
  await ensureMigrated()

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
      resolve([]) // Graceful degradation
    }
  })
}

export async function saveConversation(
  conversation: StoredConversation
): Promise<void> {
  await ensureMigrated()

  // Apply same sanitization as before
  const sanitized = await sanitizeConversationForStorage(conversation)

  // Check and enforce max conversations per variant
  const existing = await getConversations(conversation.variantName)

  const existingIndex = existing.findIndex(c => c.id === sanitized.id)
  if (existingIndex >= 0) {
    sanitized.updatedAt = Date.now()
  } else {
    sanitized.createdAt = sanitized.createdAt || Date.now()
    sanitized.updatedAt = Date.now()
    existing.push(sanitized)
  }

  // Enforce max conversations limit
  if (existing.length > MAX_CONVERSATIONS_PER_VARIANT) {
    existing.sort((a, b) => a.createdAt - b.createdAt)
    const toDelete = existing.splice(0, existing.length - MAX_CONVERSATIONS_PER_VARIANT)

    // Delete old conversations
    await batchDeleteConversations(toDelete.map(c => c.id))
  }

  // Save to IndexedDB
  const db = await openDatabase()
  const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite')
  const store = tx.objectStore(STORE_CONVERSATIONS)

  return new Promise((resolve, reject) => {
    const request = store.put(sanitized)
    request.onsuccess = () => {
      console.log(`[IndexedDB] Saved conversation ${sanitized.id}`)
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
  await ensureMigrated()

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
  await ensureMigrated()

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
  await ensureMigrated()

  const db = await openDatabase()
  const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
  const store = tx.objectStore(STORE_CONVERSATIONS)
  const index = store.index('by-variant-updated')

  // Use index for sorted retrieval (desc order)
  const range = IDBKeyRange.bound(
    [variantName, 0],
    [variantName, Date.now()],
    false,
    false
  )

  return new Promise((resolve, reject) => {
    const conversations: ConversationListItem[] = []
    const request = index.openCursor(range, 'prev') // Descending order

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
  await ensureMigrated()

  const db = await openDatabase()
  const conversations = await getConversations(variantName)

  const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite')
  const store = tx.objectStore(STORE_CONVERSATIONS)

  // Update all conversations in this variant
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
```

### 3.3 Helper Functions

```typescript
// Batch operations for migration
async function batchSaveConversations(
  conversations: StoredConversation[]
): Promise<void> {
  if (conversations.length === 0) return

  const db = await openDatabase()
  const tx = db.transaction(STORE_CONVERSATIONS, 'readwrite')
  const store = tx.objectStore(STORE_CONVERSATIONS)

  const promises = conversations.map(conv =>
    new Promise((resolve, reject) => {
      const request = store.put(conv)
      request.onsuccess = () => resolve(true)
      request.onerror = () => reject(request.error)
    })
  )

  await Promise.all(promises)
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

async function getMetadata(key: string): Promise<any> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_METADATA, 'readonly')
  const store = tx.objectStore(STORE_METADATA)

  return new Promise((resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result?.value)
    request.onerror = () => reject(request.error)
  })
}

async function setMetadata(key: string, value: any): Promise<void> {
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
```

---

## 4. Performance Considerations

### 4.1 Index Strategy

**Indexes Defined:**
1. `by-variant` - Most common query (list all conversations for variant)
2. `by-variant-updated` - Compound index for sorted list queries (avoids in-memory sorting)
3. `by-variant-active` - Quick lookup of active conversation per variant
4. Single-field indexes for flexibility

**Query Optimization:**
- Use compound indexes for common queries (variant + sort field)
- Cursor iteration for large result sets (avoid loading all into memory)
- Range queries on indexed fields only

### 4.2 Batch Operations

**Migration:**
- Batch insert conversations in single transaction (up to 100 at a time)
- Parallel migrations across variants
- Progress tracking for UI feedback

**Cleanup:**
- Batch delete old conversations when limit exceeded
- Transaction-based consistency

### 4.3 Memory Management

**Large Objects:**
- Messages with base64 images can be large (100KB+ each)
- IndexedDB handles large objects natively
- Cursor iteration prevents loading all messages at once

**Strategies:**
1. Lazy load conversation details (list shows metadata only)
2. Use cursors for iteration instead of `getAll()`
3. Close database connections when not in use

### 4.4 Quota Management

```typescript
async function checkStorageQuota(): Promise<{
  usage: number
  quota: number
  percentUsed: number
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentUsed: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
    }
  }
  return { usage: 0, quota: 0, percentUsed: 0 }
}

async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return await navigator.storage.persist()
  }
  return false
}
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Week 1)

**Deliverables:**
- [ ] Create IndexedDB schema and connection utilities
- [ ] Implement database initialization and upgrade logic
- [ ] Add metadata store for migration tracking
- [ ] Write unit tests for database operations

**Files to Create:**
- `src/types/indexeddb.ts` - Type definitions
- `src/utils/indexeddb-connection.ts` - Connection management
- `src/utils/indexeddb-storage.ts` - Core CRUD operations
- `tests/unit/indexeddb-storage.test.ts` - Unit tests

**Acceptance Criteria:**
- Database opens successfully
- Object stores created with correct indexes
- Can write and read test data
- All unit tests pass

**Time Estimate:** 3-4 days

---

### Phase 2: Migration Logic (Week 1-2)

**Deliverables:**
- [ ] Implement chrome.storage -> IndexedDB migration
- [ ] Add migration status tracking
- [ ] Implement rollback functionality
- [ ] Test with real conversation data

**Files to Modify:**
- `src/utils/indexeddb-storage.ts` - Add migration functions
- Add migration helpers

**Acceptance Criteria:**
- Existing conversations successfully migrate
- No data loss during migration
- Migration marked complete in metadata
- Rollback works correctly

**Time Estimate:** 2-3 days

---

### Phase 3: API Integration (Week 2)

**Deliverables:**
- [ ] Replace chrome.storage calls with IndexedDB
- [ ] Maintain exact same API signatures
- [ ] Add performance monitoring
- [ ] Update error handling

**Files to Modify:**
- `src/utils/ai-conversation-storage.ts` - Switch to IndexedDB

**Acceptance Criteria:**
- All existing API functions work identically
- No breaking changes to consuming components
- Performance meets or exceeds chrome.storage
- Error handling graceful and informative

**Time Estimate:** 2-3 days

---

### Phase 4: Testing & Validation (Week 2-3)

**Deliverables:**
- [ ] E2E tests for migration scenarios
- [ ] Performance benchmarking
- [ ] Edge case testing (quota exceeded, corruption, etc.)
- [ ] Manual testing with real usage patterns

**Files to Create:**
- `tests/e2e/indexeddb-migration.spec.ts` - Migration E2E tests
- `tests/e2e/conversation-storage-perf.spec.ts` - Performance tests

**Test Scenarios:**
1. Fresh install (no existing data)
2. Migration from small dataset (1-5 conversations)
3. Migration from large dataset (50+ conversations)
4. Quota exceeded handling
5. Concurrent access from multiple tabs
6. Database corruption recovery

**Acceptance Criteria:**
- All E2E tests pass
- Performance within acceptable range (<100ms for list, <50ms for load)
- No data loss in any scenario
- Graceful degradation on errors

**Time Estimate:** 3-4 days

---

### Phase 5: Production Rollout (Week 3)

**Deliverables:**
- [ ] Feature flag for gradual rollout
- [ ] Monitoring and alerting
- [ ] Documentation updates
- [ ] User communication plan

**Implementation:**
```typescript
// Feature flag check
const USE_INDEXEDDB = await storage.get('feature-indexeddb-storage') ?? true

export async function getConversations(variantName: string): Promise<StoredConversation[]> {
  if (USE_INDEXEDDB) {
    return getConversationsFromIndexedDB(variantName)
  } else {
    return getConversationsFromChromeStorage(variantName)
  }
}
```

**Rollout Plan:**
1. Week 1: Internal testing (10% of users)
2. Week 2: Beta users (50% of users)
3. Week 3: Full rollout (100% of users)
4. Week 4: Remove chrome.storage fallback

**Acceptance Criteria:**
- Zero critical bugs reported
- Performance metrics within targets
- User satisfaction maintained
- Cleanup of old chrome.storage data scheduled

**Time Estimate:** 5-7 days

---

## 6. Testing Strategy

### 6.1 Unit Tests

**Coverage Areas:**
- Database connection and initialization
- CRUD operations on conversations
- Index usage and query optimization
- Metadata operations
- Error handling and edge cases

**Key Tests:**
```typescript
describe('IndexedDB Storage', () => {
  beforeEach(async () => {
    // Clear database before each test
    await clearDatabase()
  })

  test('should create database with correct schema', async () => {
    const db = await openDatabase()
    expect(db.objectStoreNames.contains('conversations')).toBe(true)
    expect(db.objectStoreNames.contains('metadata')).toBe(true)
  })

  test('should save and retrieve conversation', async () => {
    const conv = createTestConversation()
    await saveConversation(conv)
    const loaded = await loadConversation(conv.variantName, conv.id)
    expect(loaded).toEqual(conv)
  })

  test('should enforce max conversations limit', async () => {
    const conversations = createTestConversations(15) // Over limit of 10
    for (const conv of conversations) {
      await saveConversation(conv)
    }
    const remaining = await getConversations('test-variant')
    expect(remaining.length).toBe(10)
  })

  test('should handle quota exceeded gracefully', async () => {
    // Mock quota exceeded scenario
    const largeConv = createLargeConversation(10000) // 10MB
    await expect(saveConversation(largeConv)).rejects.toThrow()
  })
})
```

### 6.2 Integration Tests

**Scenarios:**
1. Migration from chrome.storage with various data sizes
2. Concurrent access from multiple components
3. Database upgrade from version 1 to 2
4. Rollback and recovery

**Example:**
```typescript
describe('Migration Integration', () => {
  test('should migrate all conversations from chrome.storage', async () => {
    // Setup: Populate chrome.storage with test data
    await populateChromeStorage(['variant1', 'variant2'], 5)

    // Execute migration
    await migrateFromChromeStorage()

    // Verify: All conversations in IndexedDB
    const v1Convs = await getConversations('variant1')
    const v2Convs = await getConversations('variant2')
    expect(v1Convs.length).toBe(5)
    expect(v2Convs.length).toBe(5)

    // Verify migration metadata
    const migrated = await getMetadata('migrated-from-chrome-storage')
    expect(migrated).toBeTruthy()
  })
})
```

### 6.3 E2E Tests

**User Flows:**
1. Create new conversation -> Save -> Load -> Verify
2. Switch between conversations
3. Delete conversation
4. Migration on extension update
5. Multiple tabs accessing same conversation

**Playwright Test:**
```typescript
test('should persist conversation across page reloads', async ({ page, extensionId }) => {
  // Navigate to extension
  await page.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)

  // Create conversation
  await page.click('#new-conversation')
  await page.fill('#chat-input', 'Test message')
  await page.click('#send-message')

  // Wait for response
  await page.waitForSelector('.assistant-message')

  // Reload page
  await page.reload()

  // Verify conversation persisted
  const messages = await page.locator('.chat-message').count()
  expect(messages).toBeGreaterThan(0)
})
```

### 6.4 Performance Tests

**Metrics to Track:**
- List load time (<100ms for 10 conversations)
- Conversation load time (<50ms)
- Save operation time (<100ms)
- Migration time (<5s for 100 conversations)
- Memory usage (should not exceed 50MB)

**Benchmark Test:**
```typescript
describe('Performance Benchmarks', () => {
  test('should list conversations in under 100ms', async () => {
    await populateConversations('variant', 10)

    const start = performance.now()
    await getConversationList('variant')
    const duration = performance.now() - start

    expect(duration).toBeLessThan(100)
  })

  test('should load conversation in under 50ms', async () => {
    const conv = await createAndSaveConversation()

    const start = performance.now()
    await loadConversation(conv.variantName, conv.id)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(50)
  })
})
```

---

## 7. Rollback Plan

### 7.1 Rollback Triggers

**When to Rollback:**
- Critical bug affecting >5% of users
- Data loss reported
- Performance degradation >50%
- Quota issues causing extension failures

### 7.2 Rollback Process

**Step 1: Disable IndexedDB (Immediate)**
```typescript
// Set feature flag to disable IndexedDB
await storage.set('feature-indexeddb-storage', false)

// This will revert to chrome.storage.local immediately
// No extension reload needed
```

**Step 2: Export Data from IndexedDB**
```typescript
// Run rollback utility to export all conversations
await rollbackToChromStorage()

// This copies all IndexedDB data back to chrome.storage.local
// Preserves data from both sources
```

**Step 3: Verification**
- Check chrome.storage for all conversations
- Verify conversation counts match
- Test basic CRUD operations
- Monitor error rates

**Step 4: Communication**
- Notify users of rollback
- Provide status updates
- Explain any temporary limitations

### 7.3 Rollback Testing

**Pre-Rollback:**
- Test rollback procedure in staging
- Verify data export accuracy
- Ensure chrome.storage limits not exceeded

**Post-Rollback:**
- Monitor error rates
- Check user reports
- Verify data integrity

---

## 8. Risk Assessment & Mitigation

### 8.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Data loss during migration | High | Low | Dual-read period, keep chrome.storage backup, extensive testing |
| Quota exceeded | Medium | Medium | Implement quota monitoring, compression, cleanup |
| Browser compatibility | Medium | Low | Feature detection, fallback to chrome.storage |
| Performance regression | Medium | Low | Performance benchmarks, index optimization |
| Concurrent access issues | Medium | Medium | Transaction-based operations, proper locking |
| Database corruption | High | Very Low | Regular backups, recovery procedures |

### 8.2 Mitigation Strategies

**Data Loss Prevention:**
- Keep chrome.storage backup for 30 days
- Implement export/import functionality
- Regular data validation checks

**Quota Management:**
- Monitor storage usage
- Implement compression for images
- Automatic cleanup of old conversations
- Request persistent storage permission

**Performance Monitoring:**
- Track operation latencies
- Alert on performance degradation
- Optimize indexes based on usage patterns

**Corruption Recovery:**
- Detect corruption on database open
- Fallback to chrome.storage on corruption
- Manual recovery tools for advanced users

---

## 9. Success Metrics

### 9.1 Technical Metrics

- **Migration Success Rate:** >99.9%
- **Data Integrity:** 100% (no data loss)
- **Performance:**
  - List load: <100ms (vs 150ms chrome.storage)
  - Conversation load: <50ms (vs 80ms chrome.storage)
  - Save operation: <100ms (vs 120ms chrome.storage)
- **Storage Capacity:** 10x increase (5MB -> 50MB+)
- **Error Rate:** <0.1%

### 9.2 User Metrics

- **User Satisfaction:** Maintain or improve
- **Bug Reports:** <5 critical bugs
- **Rollback Rate:** <1%
- **Adoption Rate:** >95% within 30 days

---

## 10. Documentation & Training

### 10.1 Developer Documentation

**Files to Update:**
- `README.md` - Add IndexedDB section
- `docs/architecture.md` - Update storage architecture
- `src/utils/README.md` - Document new storage API

**Code Documentation:**
- JSDoc comments for all public functions
- Type definitions with descriptions
- Migration guide for developers

### 10.2 User Documentation

**User-Facing Changes:**
- Increased storage capacity
- Faster conversation loading
- Better performance with large conversations

**User Guide Updates:**
- How to export conversations
- Troubleshooting storage issues
- FAQ on migration

---

## 11. Timeline Summary

| Phase | Duration | Dependencies | Deliverables |
|-------|----------|--------------|--------------|
| Phase 1: Foundation | 3-4 days | None | Schema, connection utilities, unit tests |
| Phase 2: Migration Logic | 2-3 days | Phase 1 | Migration functions, rollback, tests |
| Phase 3: API Integration | 2-3 days | Phase 2 | Updated storage API, error handling |
| Phase 4: Testing & Validation | 3-4 days | Phase 3 | E2E tests, performance benchmarks |
| Phase 5: Production Rollout | 5-7 days | Phase 4 | Feature flag, monitoring, docs |

**Total Estimated Time:** 15-21 days (3-4 weeks)

---

## 12. Appendix

### A. IndexedDB Best Practices

1. **Always use transactions** - Group related operations
2. **Close connections** - Avoid memory leaks
3. **Handle version upgrades** - Provide migration paths
4. **Use indexes wisely** - Balance query performance with storage overhead
5. **Error handling** - Always handle transaction errors
6. **Quota management** - Monitor and request permissions

### B. Chrome Storage vs IndexedDB Comparison

| Feature | chrome.storage.local | IndexedDB |
|---------|---------------------|-----------|
| Storage Limit | 5 MB (10 MB unlocked) | ~50 MB (expandable) |
| Data Structure | Key-Value (JSON) | Object Stores (structured) |
| Query Capabilities | None (load all) | Indexes, cursors, ranges |
| Performance | Good for small data | Excellent for large data |
| Transactions | No | Yes (ACID) |
| Browser Support | Chrome only | All modern browsers |
| Complexity | Low | Medium |

### C. Useful Resources

- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Chrome Extensions Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [IndexedDB Best Practices](https://developers.google.com/web/fundamentals/instant-and-offline/web-storage/indexeddb-best-practices)
- [Storage Quota Management](https://web.dev/storage-for-the-web/)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-17 | Backend Architect | Initial migration plan |

