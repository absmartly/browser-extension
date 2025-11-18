# IndexedDB Test Fixes Plan

This document provides a comprehensive plan to fix all failing IndexedDB tests (both unit tests and E2E tests).

## Table of Contents

1. [Unit Tests - Overview](#unit-tests---overview)
2. [Unit Tests - Fix Strategy](#unit-tests---fix-strategy)
3. [E2E Tests - Overview](#e2e-tests---overview)
4. [E2E Tests - Issues Identified](#e2e-tests---issues-identified)
5. [E2E Tests - Fix Strategy](#e2e-tests---fix-strategy)
6. [Implementation Plan](#implementation-plan)
7. [Code Examples](#code-examples)

---

## Unit Tests - Overview

### Location
- `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/utils/__tests__/indexeddb-storage.test.ts`
- `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/utils/__tests__/indexeddb-connection.test.ts`

### Status
All 18 tests failing with:
```
ReferenceError: indexedDB is not defined
```

### Root Cause
Jest/JSDOM environment does not provide IndexedDB API by default. The tests are trying to use `indexedDB.open()`, `indexedDB.deleteDatabase()`, etc., but these are undefined in the test environment.

---

## Unit Tests - Fix Strategy

### Option 1: Use fake-indexeddb (RECOMMENDED)

**Pros:**
- Most realistic simulation of IndexedDB
- Comprehensive API coverage
- Well-maintained library
- Works in Node.js environment
- No modifications to source code needed

**Cons:**
- Additional dependency

**Implementation:**

1. **Install fake-indexeddb:**
```bash
npm install --save-dev fake-indexeddb
```

2. **Create Jest setup file** (`tests/setup/jest.setup.ts`):
```typescript
import 'fake-indexeddb/auto'

// Make IndexedDB globally available
global.indexedDB = require('fake-indexeddb')
global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange')
```

3. **Update Jest config** (`jest.config.js`):
```javascript
module.exports = {
  // ... existing config
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
}
```

4. **Update test files** to use better cleanup:
```typescript
afterEach(async () => {
  closeDatabase()
  // Delete all databases to ensure clean state
  const databases = await indexedDB.databases()
  for (const db of databases) {
    if (db.name) {
      await deleteDatabase(db.name)
    }
  }
})
```

### Option 2: Manual Mocking (NOT RECOMMENDED)

**Why not recommended:**
- Incomplete API coverage
- Hard to maintain
- Prone to bugs
- Doesn't test actual IndexedDB behavior

If you must mock manually, you'd need to mock:
- `indexedDB.open()`
- `indexedDB.deleteDatabase()`
- `IDBDatabase`, `IDBTransaction`, `IDBObjectStore`, `IDBIndex`
- Request success/error callbacks
- Transaction lifecycle

**This is extremely complex and not worth the effort.**

---

## E2E Tests - Overview

### Location
`/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/indexeddb-conversation-persistence.spec.ts`

### Status
Test gets stuck at "Checking conversation history button..." and times out.

### Test Flow
1. ✅ Pre-populate IndexedDB with 3 conversations (in setup page)
2. ✅ Load sidebar and navigate to AI page
3. ❌ **STUCK HERE:** Verify conversations loaded from IndexedDB (waiting for history button)

---

## E2E Tests - Issues Identified

### Issue 1: Missing Test Page Load

**Problem:** The test loads the sidebar directly without loading a test HTML page first.

**Working pattern (from visual-editor-complete.spec.ts):**
```typescript
// Load test page FIRST
await testPage.goto(`/visual-editor-test.html?use_shadow_dom=0`, {
  waitUntil: 'domcontentloaded',
  timeout: 10000
})

// THEN inject sidebar
const sidebar = await injectSidebar(testPage, extensionUrl)
```

**Current broken code:**
```typescript
// Goes directly to sidebar URL - NO test page!
const sidebarUrl = extensionUrl('tabs/sidebar.html')
await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
```

**Why this breaks:**
- Sidebar needs a content page context to communicate with
- Without a test page, content script injection doesn't work properly
- Message passing between sidebar and content script fails

### Issue 2: Using testPage.goto() Instead of injectSidebar()

**Problem:** Test navigates to sidebar URL directly instead of using `injectSidebar()` helper.

**Why this breaks:**
- `testPage.goto(sidebarUrl)` loads sidebar as main page, not as iframe
- Sidebar loses proper extension context
- Cannot communicate with content script
- Frame locator won't work

**Working pattern:**
```typescript
// Load test page
await testPage.goto(`/visual-editor-test.html`, { waitUntil: 'domcontentloaded' })

// Inject sidebar as iframe
const sidebar = await injectSidebar(testPage, extensionUrl)

// Now sidebar is in iframe and can communicate with content script
```

**Current broken code:**
```typescript
// Loading sidebar as main page (WRONG!)
await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })

// Trying to use sidebar locators directly on main page (WRONG!)
const createButton = testPage.locator('button[title="Create New Experiment"]')
```

### Issue 3: Not Using setupTestPage Helper

**Problem:** Manual page setup instead of using proven helper.

**Working pattern:**
```typescript
const { sidebar, allMessages } = await setupTestPage(
  testPage,
  extensionUrl,
  '/visual-editor-test.html'
)
```

**Current code:**
```typescript
// Manual setup - error-prone
const contentPage = await context.newPage()
await contentPage.goto(`http://localhost:3456${TEST_PAGE_URL}`, ...)
// ... manual sidebar injection
```

### Issue 4: Using Playwright Click Instead of Helper

**Problem:** Using `testPage.locator().click()` instead of `click()` helper.

**Working pattern:**
```typescript
import { click } from '../utils/test-helpers'

await click(sidebar, 'button[title="Create New Experiment"]', 5000)
```

**Current code:**
```typescript
// Playwright click on React component (FLAKY!)
await createButton.click()
```

### Issue 5: Using waitForTimeout (FORBIDDEN)

**Problem:** Test uses custom `debugWait()` that ALWAYS waits, even in non-SLOW mode.

**Current broken code:**
```typescript
const debugWait = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms))

// This ALWAYS waits 500ms!
await debugWait(500)
```

**Working pattern:**
```typescript
// Import from test-helpers
import { debugWait } from './utils/test-helpers'

// Only waits if SLOW=1
await debugWait(500)
```

**Real implementation:**
```typescript
export async function debugWait(ms: number = 300): Promise<void> {
  const SLOW_MODE = process.env.SLOW === '1'
  if (SLOW_MODE) {
    await new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

### Issue 6: Wrong Locator Context

**Problem:** Using `testPage.locator()` for sidebar elements instead of `sidebar.locator()`.

**Working pattern:**
```typescript
// Sidebar elements must use sidebar locator
const createButton = sidebar.locator('button[title="Create New Experiment"]')
await createButton.waitFor({ state: 'visible', timeout: 10000 })
```

**Current code:**
```typescript
// Using testPage for sidebar elements (WRONG!)
const createButton = testPage.locator('button[title="Create New Experiment"]')
```

### Issue 7: Complex Navigation Logic

**Problem:** Test manually navigates through UI to reach AI page instead of using URL navigation or helper functions.

**Simpler approach:**
```typescript
// Option 1: Direct navigation (if AI page has a URL)
await sidebar.frameLocator(...).goto('path/to/ai-page')

// Option 2: Use helper function that encapsulates navigation
await navigateToAIPage(sidebar)
```

**Current code:**
```typescript
// 50+ lines of manual clicking through UI
// Clicking "Generate with AI" button
// Waiting for "AI DOM Generator"
// Multiple waits and checks
```

### Issue 8: No Error Logging/Screenshots

**Problem:** When test gets stuck, there's no debugging information.

**Working pattern:**
```typescript
try {
  await historyButton.waitFor({ state: 'visible', timeout: 5000 })
} catch (e) {
  await testPage.screenshot({ path: 'test-results/history-button-missing.png' })
  log(`ERROR: History button not visible: ${e.message}`)

  // Check if page crashed
  const pageAlive = await testPage.evaluate(() => true).catch(() => false)
  log(`Page alive: ${pageAlive}`)

  throw e
}
```

---

## E2E Tests - Fix Strategy

### Fix 1: Use Proper Test Page Setup

**Replace:**
```typescript
const contentPage = await context.newPage()
await contentPage.goto(`http://localhost:3456${TEST_PAGE_URL}`, ...)
```

**With:**
```typescript
// Use setupTestPage helper
const { sidebar, allMessages } = await setupTestPage(
  testPage,
  extensionUrl,
  '/visual-editor-test.html'
)
```

This automatically:
- Loads test page
- Sets viewport
- Sets test mode flag
- Injects sidebar with proper context
- Captures console messages

### Fix 2: Remove Direct Sidebar Navigation

**Remove all instances of:**
```typescript
const sidebarUrl = extensionUrl('tabs/sidebar.html')
await testPage.goto(sidebarUrl, ...)
```

**Sidebar injection is handled by `setupTestPage` or `injectSidebar`.**

### Fix 3: Use Click Helper

**Replace:**
```typescript
await createButton.click()
await fromScratchButton.click()
```

**With:**
```typescript
import { click } from '../utils/test-helpers'

await click(sidebar, 'button[title="Create New Experiment"]', 5000)
await click(sidebar, 'button:has-text("From Scratch")', 5000)
```

### Fix 4: Import Proper debugWait

**Replace:**
```typescript
const debugWait = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms))
```

**With:**
```typescript
import { debugWait } from '../utils/test-helpers'
```

### Fix 5: Use Sidebar Locators

**Replace:**
```typescript
const createButton = testPage.locator('button[title="Create New Experiment"]')
```

**With:**
```typescript
const createButton = sidebar.locator('button[title="Create New Experiment"]')
```

### Fix 6: Simplify Navigation

**Instead of 50+ lines of manual navigation, create a helper:**

```typescript
// helpers/ai-navigation.ts
export async function navigateToAIPage(sidebar: FrameLocator): Promise<void> {
  // Click "Generate with AI" button
  const generateButton = sidebar.locator('button:has-text("Generate with AI")').first()
  await generateButton.waitFor({ state: 'visible', timeout: 10000 })
  await click(sidebar, generateButton)
  await debugWait()

  // Wait for AI page to load
  await sidebar.locator('text=AI DOM Generator').waitFor({
    state: 'visible',
    timeout: 10000
  })
}
```

**Then use:**
```typescript
await navigateToAIPage(sidebar)
```

### Fix 7: Add Debugging

Add screenshots and logging at critical points:

```typescript
await test.step('Verify conversations loaded from IndexedDB', async () => {
  log('Checking conversation history button...')

  // Take screenshot before checking
  await testPage.screenshot({
    path: 'test-results/before-history-check.png',
    fullPage: true
  })

  const historyButton = sidebar.locator('button[title="Conversation History"]')

  try {
    await historyButton.waitFor({ state: 'visible', timeout: 5000 })
  } catch (e) {
    // Screenshot on failure
    await testPage.screenshot({
      path: 'test-results/history-button-missing.png',
      fullPage: true
    })
    log('ERROR: History button not visible')

    // Check page state
    const pageAlive = await testPage.evaluate(() => true).catch(() => false)
    log(`Page alive: ${pageAlive}`)

    throw new Error('History button not visible - see screenshot')
  }

  const isDisabled = await historyButton.isDisabled()
  expect(isDisabled).toBe(false)
  log('✅ History button is enabled')
})
```

### Fix 8: Fix IndexedDB Setup

The IndexedDB pre-population should happen in the extension context, not in a separate page:

**Current approach (WRONG):**
```typescript
// Opens separate setup page
const setupPage = await context.newPage()
await setupPage.goto(sidebarUrl, ...)
await setupPage.evaluate(async () => {
  // Populate IndexedDB
})
await setupPage.close()
```

**Why this breaks:**
- Different browser context
- IndexedDB is isolated per origin
- Setup page and test page don't share IndexedDB

**Correct approach:**
```typescript
// Populate IndexedDB in the same page/context where we'll test
await testPage.evaluate(async () => {
  const DB_NAME = 'absmartly-conversations'
  // ... populate IndexedDB
})

// OR use the sidebar iframe context after injection:
await sidebar.locator('body').evaluate(async () => {
  const DB_NAME = 'absmartly-conversations'
  // ... populate IndexedDB
})
```

---

## Implementation Plan

### Phase 1: Fix Unit Tests (30 minutes)

1. ✅ Install `fake-indexeddb`
2. ✅ Create Jest setup file
3. ✅ Update Jest config
4. ✅ Run tests and verify all pass
5. ✅ Commit: "fix: add fake-indexeddb for unit tests"

### Phase 2: Fix E2E Test Structure (45 minutes)

1. ✅ Import proper helpers (click, debugWait, setupTestPage)
2. ✅ Remove custom debugWait function
3. ✅ Replace testPage.goto(sidebarUrl) with setupTestPage
4. ✅ Fix all locator contexts (testPage → sidebar)
5. ✅ Replace .click() with click() helper
6. ✅ Test the changes
7. ✅ Commit: "fix: use proper test helpers in IndexedDB E2E tests"

### Phase 3: Fix IndexedDB Setup (30 minutes)

1. ✅ Move IndexedDB population to correct context
2. ✅ Use sidebar.locator('body').evaluate() for setup
3. ✅ Remove separate setup page
4. ✅ Test the changes
5. ✅ Commit: "fix: populate IndexedDB in correct context"

### Phase 4: Simplify Navigation (30 minutes)

1. ✅ Create helper function for AI page navigation
2. ✅ Replace manual navigation with helper
3. ✅ Test the changes
4. ✅ Commit: "refactor: simplify AI page navigation in E2E tests"

### Phase 5: Add Debugging (20 minutes)

1. ✅ Add screenshots at critical points
2. ✅ Add error logging
3. ✅ Add page state checks
4. ✅ Test the changes
5. ✅ Commit: "test: add debugging to IndexedDB E2E tests"

### Phase 6: Run Full Test Suite

1. ✅ Run all unit tests: `npm test`
2. ✅ Build extension: `npm run build:dev`
3. ✅ Run E2E tests: `npx playwright test tests/e2e/indexeddb-conversation-persistence.spec.ts`
4. ✅ Fix any remaining issues
5. ✅ Final commit: "test: all IndexedDB tests passing"

**Total estimated time:** ~3 hours

---

## Code Examples

### Example 1: Fixed Unit Test Setup

**File:** `tests/setup/jest.setup.ts`
```typescript
import 'fake-indexeddb/auto'

global.indexedDB = require('fake-indexeddb')
global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange')
```

**File:** `jest.config.js`
```javascript
module.exports = {
  preset: '@plasmo/framework',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx'
  ],
}
```

### Example 2: Fixed E2E Test Structure

**Before (BROKEN):**
```typescript
test('should persist conversations to IndexedDB', async ({ context, extensionUrl }) => {
  const contentPage = await context.newPage()
  await contentPage.goto(`http://localhost:3456${TEST_PAGE_URL}`, { waitUntil: 'load' })

  const sidebarUrl = extensionUrl('tabs/sidebar.html')
  await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })

  const createButton = testPage.locator('button[title="Create New Experiment"]')
  await createButton.click()
})
```

**After (FIXED):**
```typescript
import { setupTestPage, click, debugWait, log, initializeTestLogging } from '../utils/test-helpers'

test('should persist conversations to IndexedDB', async ({ context, extensionUrl }) => {
  initializeTestLogging()

  // Setup page with sidebar
  const { sidebar, allMessages } = await setupTestPage(
    testPage,
    extensionUrl,
    '/visual-editor-test.html'
  )

  await test.step('Navigate to AI page', async () => {
    // Use helper to click button
    await click(sidebar, 'button[title="Create New Experiment"]', 5000)
    await debugWait()
  })
})
```

### Example 3: Fixed IndexedDB Setup

**Before (BROKEN):**
```typescript
const setupPage = await context.newPage()
await setupPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })

await setupPage.evaluate(async () => {
  // Populate IndexedDB
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('absmartly-conversations', 1)
    request.onsuccess = () => resolve(request.result)
    // ...
  })
  // ...
})

await setupPage.close()
```

**After (FIXED):**
```typescript
const { sidebar, allMessages } = await setupTestPage(
  testPage,
  extensionUrl,
  '/visual-editor-test.html'
)

await test.step('Pre-populate IndexedDB with conversations', async () => {
  log('Populating IndexedDB...')

  // Populate in sidebar context (extension context)
  await sidebar.locator('body').evaluate(async () => {
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
          // ... create other indexes
        }
      }
    })

    // Add conversations
    const conversations = []
    for (let i = 0; i < 3; i++) {
      conversations.push({
        id: `conv-${i}`,
        variantName: 'A',
        messages: [
          {
            role: 'user',
            content: `Test conversation ${i + 1}`,
            timestamp: Date.now(),
            id: `msg-${i}`
          }
        ],
        // ... rest of conversation data
      })
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

    console.log('[TEST SETUP] Added 3 conversations to IndexedDB')
  })

  log('✓ IndexedDB populated')
})
```

### Example 4: Navigation Helper

**File:** `tests/e2e/helpers/ai-navigation.ts`
```typescript
import { type FrameLocator } from '@playwright/test'
import { click, debugWait, log } from '../utils/test-helpers'

export async function navigateToAIPage(sidebar: FrameLocator): Promise<void> {
  log('Navigating to AI page...')

  // Scroll to DOM Changes section
  await sidebar.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
  await debugWait()

  // Click "Generate with AI" button
  const generateButton = sidebar.locator('button:has-text("Generate with AI")').first()
  await generateButton.waitFor({ state: 'visible', timeout: 10000 })
  await generateButton.scrollIntoViewIfNeeded()
  await debugWait()

  await click(sidebar, generateButton)
  await debugWait()

  // Wait for AI page to load
  await sidebar.locator('text=AI DOM Generator').waitFor({
    state: 'visible',
    timeout: 10000
  })

  log('✓ AI page loaded')
}

export async function waitForConversationHistoryButton(
  sidebar: FrameLocator
): Promise<void> {
  const historyButton = sidebar.locator('button[title="Conversation History"]')

  await historyButton.waitFor({ state: 'visible', timeout: 5000 })

  log('✓ Conversation history button visible')
}
```

### Example 5: Fixed Test with Debugging

```typescript
import { test, expect } from '../fixtures/extension'
import { setupTestPage, click, debugWait, log, initializeTestLogging } from '../utils/test-helpers'
import { navigateToAIPage } from './helpers/ai-navigation'

test.describe('IndexedDB Conversation Persistence', () => {
  let testPage: any

  test.beforeEach(async ({ context, extensionUrl }) => {
    initializeTestLogging()
    testPage = await context.newPage()
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) {
      // Clean up IndexedDB
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

  test('should persist conversations to IndexedDB', async ({ context, extensionUrl }) => {
    test.setTimeout(process.env.SLOW === '1' ? 60000 : 30000)

    let sidebar: any

    await test.step('Setup page and sidebar', async () => {
      const result = await setupTestPage(testPage, extensionUrl, '/visual-editor-test.html')
      sidebar = result.sidebar
      await debugWait()
    })

    await test.step('Pre-populate IndexedDB', async () => {
      log('Populating IndexedDB...')

      await sidebar.locator('body').evaluate(async () => {
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
              store.createIndex('by-variant-updated', ['variantName', 'updatedAt'], { unique: false })
            }
            if (!db.objectStoreNames.contains('metadata')) {
              db.createObjectStore('metadata', { keyPath: 'key' })
            }
          }
        })

        const conversations = []
        const baseTime = Date.now()

        for (let i = 0; i < 3; i++) {
          conversations.push({
            id: `conv-${i}`,
            variantName: 'A',
            messages: [
              {
                role: 'user',
                content: `Test conversation ${i + 1}`,
                timestamp: baseTime - (3 - i) * 60000,
                id: `msg-${i}`
              }
            ],
            conversationSession: {
              id: `session-${i}`,
              htmlSent: false,
              messages: []
            },
            createdAt: baseTime - (3 - i) * 60000,
            updatedAt: baseTime - (3 - i) * 60000 + 5000,
            messageCount: 1,
            firstUserMessage: `Test conversation ${i + 1}`,
            isActive: i === 2
          })
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

        console.log('[TEST] Added 3 conversations to IndexedDB')
      })

      log('✓ IndexedDB populated')
    })

    await test.step('Create experiment and navigate to AI page', async () => {
      log('Creating experiment...')

      await click(sidebar, 'button[title="Create New Experiment"]', 5000)
      await debugWait()

      await click(sidebar, 'button:has-text("From Scratch")', 5000)
      await debugWait()

      // Wait for form to load
      await sidebar.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ Experiment editor opened')

      await navigateToAIPage(sidebar)
    })

    await test.step('Verify conversations loaded', async () => {
      log('Checking conversation history button...')

      // Take screenshot before check
      await testPage.screenshot({
        path: 'test-results/indexeddb-before-history-check.png',
        fullPage: true
      })

      const historyButton = sidebar.locator('button[title="Conversation History"]')

      try {
        await historyButton.waitFor({ state: 'visible', timeout: 5000 })
      } catch (e) {
        // Debug screenshots
        await testPage.screenshot({
          path: 'test-results/indexeddb-history-button-missing.png',
          fullPage: true
        })

        // Check if page crashed
        const pageAlive = await testPage.evaluate(() => true).catch(() => false)
        log(`ERROR: Page alive: ${pageAlive}`)

        // Get console errors
        const errors = await testPage.evaluate(() => {
          return (window as any).__lastError || 'No error captured'
        })
        log(`Console errors: ${JSON.stringify(errors)}`)

        throw new Error('History button not visible - check screenshots')
      }

      const isDisabled = await historyButton.isDisabled()
      expect(isDisabled).toBe(false)
      log('✅ History button is enabled')

      await click(sidebar, historyButton)
      await debugWait()

      const conversationItems = sidebar.locator('[id^="conversation-"]')
      const itemCount = await conversationItems.count()

      expect(itemCount).toBe(3)
      log('✅ All 3 conversations loaded')

      await testPage.screenshot({
        path: 'test-results/indexeddb-conversations-loaded.png',
        fullPage: true
      })
    })
  })
})
```

---

## Summary

### Unit Tests
- **Solution:** Install and configure `fake-indexeddb`
- **Effort:** Low (30 minutes)
- **Risk:** Very low
- **Confidence:** High - proven solution used widely

### E2E Tests
- **Main Issues:**
  1. Not loading test page before sidebar
  2. Not using `injectSidebar()` helper
  3. Using Playwright click instead of custom helper
  4. Wrong locator contexts (page vs sidebar)
  5. Custom debugWait that always waits
  6. IndexedDB setup in wrong context
- **Solution:** Follow patterns from `visual-editor-complete.spec.ts`
- **Effort:** Medium (2-3 hours)
- **Risk:** Low - using proven patterns
- **Confidence:** High - patterns work in existing tests

### Next Steps
1. Fix unit tests first (quick win)
2. Fix E2E test structure (moderate effort)
3. Add debugging and helpers (polish)
4. Run full test suite and iterate

**The key is to follow the proven patterns from the working E2E test, not reinvent the wheel.**
