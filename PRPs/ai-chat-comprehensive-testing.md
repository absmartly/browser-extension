# AI Chat Comprehensive E2E Testing Plan

## Goal
Create a comprehensive suite of E2E tests that thoroughly validates all AI chat capabilities including session management, conversation persistence, image handling, history management, error recovery, and edge cases. The test suite should provide confidence that the AI chat feature works reliably across all user workflows.

## Why
- **Current State**: We have partial test coverage with `ai-conversation-history.spec.ts`, `ai-session-image.spec.ts`, and `ai-dom-generation-complete.spec.ts`, but significant gaps exist
- **Risk**: AI chat is a core feature with complex state management (sessions, conversations, storage, images) prone to bugs
- **User Impact**: Users depend on conversation persistence, session continuity, and reliable image handling
- **Technical Debt**: The existing PRP `ai-chat-session-initialization-fix.md` identified storage quota issues and session initialization problems that need comprehensive testing

## What
A complete E2E test suite covering:
1. **Session lifecycle**: Initialization, persistence, cleanup, recovery after page reload
2. **Conversation management**: History, switching conversations, deletion, active conversation tracking
3. **Image handling**: Upload, persistence, base64 encoding, storage optimization
4. **Error scenarios**: Storage quota exceeded, network failures, malformed responses
5. **Edge cases**: Multiple variants, conversation limits, migration scenarios
6. **Performance**: Large conversations, rapid message sending, concurrent sessions

### Success Criteria
- [ ] All AI chat user workflows have E2E test coverage
- [ ] Tests cover happy paths, error scenarios, and edge cases
- [ ] Tests validate storage behavior and quota management
- [ ] Tests verify session continuity across page reloads
- [ ] Tests confirm image handling and storage optimization
- [ ] Tests ensure conversation history UI behaves correctly
- [ ] All tests follow the project's testing conventions (no `waitForTimeout`, proper selectors with IDs, debug logging)

## All Needed Context

### Documentation & References
```yaml
- file: tests/e2e/ai-conversation-history.spec.ts
  why: Current implementation of conversation history testing (UI, storage, deletion)

- file: tests/e2e/ai-session-image.spec.ts
  why: Session initialization and image upload test patterns

- file: tests/e2e/ai-dom-generation-complete.spec.ts
  why: Complete AI workflow testing patterns

- file: PRPs/ai-chat-session-initialization-fix.md
  why: Documents session initialization issues and storage quota problems

- file: src/components/AIDOMChangesPage.tsx
  why: Main AI chat component with session and conversation state management
  lines: 1-150 (initialization logic)

- file: src/utils/ai-conversation-storage.ts
  why: Conversation storage implementation with sanitization and quota management

- file: src/utils/ai-conversation-migration.ts
  why: Migration logic for conversation format changes

- file: background/main.ts
  why: Background script handling AI_GENERATE_DOM_CHANGES messages
  lines: 360-436

- file: CLAUDE.md
  why: Testing conventions - NEVER use waitForTimeout, always add IDs to elements
  critical: |
    - ABSOLUTELY FORBIDDEN: waitForTimeout() - use waitFor({state}), waitForSelector(), etc.
    - Always add 'id' attributes to testable elements
    - Always build first: npm run build:dev before running tests
    - Full command: SAVE_EXPERIMENT=1 npx playwright test path/to/test.spec.ts

- url: https://playwright.dev/docs/test-assertions
  why: Playwright assertion patterns for robust test writing

- url: https://playwright.dev/docs/api/class-page#page-wait-for-selector
  why: Proper waiting strategies without timeouts

- url: https://developer.chrome.com/docs/extensions/reference/api/storage
  why: Chrome storage API limits (8KB per item for sync, 100KB for local)
```

### Current Test Coverage Analysis

**What We Have:**
1. ✅ `ai-conversation-history.spec.ts`: Conversation list UI, deletion, dropdown, "New Chat" button
2. ✅ `ai-session-image.spec.ts`: Session initialization on mount, image upload, session persistence
3. ✅ `ai-dom-generation-complete.spec.ts`: Full workflow from experiment creation to DOM generation

**Critical Gaps:**
1. ❌ Session recovery after page reload
2. ❌ Storage quota exceeded error handling
3. ❌ Conversation switching and loading
4. ❌ Image persistence across page reloads (should NOT persist per storage optimization)
5. ❌ Multiple messages in single conversation (thread continuity)
6. ❌ Conversation migration scenarios
7. ❌ Error handling (network failures, malformed responses, API errors)
8. ❌ Edge cases (max conversation limit, very large messages, rapid sending)
9. ❌ Multi-variant conversation isolation
10. ❌ Session ID continuity during multiple generations
11. ❌ HTML sent flag behavior
12. ❌ Active conversation persistence
13. ❌ Message sanitization before storage
14. ❌ Preview mode interaction with AI chat
15. ❌ Background script message relay failures

### Known Gotchas & Library Quirks
```typescript
// CRITICAL: Chrome storage limits
// - chrome.storage.local: 102,400 bytes (100KB) per item
// - Extension total quota: ~10MB
// Current implementation: sanitizeConversationForStorage() removes:
//   - images from messages (not persisted)
//   - session messages array (Claude maintains server-side)
// File: src/utils/ai-conversation-storage.ts:18-30

// CRITICAL: Session initialization timing
// Session MUST be initialized on mount, NOT on first message
// HTML capture happens immediately to avoid delay
// File: src/components/AIDOMChangesPage.tsx:110-150

// CRITICAL: Conversation limits
// MAX_CONVERSATIONS_PER_VARIANT = 10
// Oldest conversations are removed when limit exceeded
// File: src/utils/ai-conversation-storage.ts:66-69

// CRITICAL: Test mode detection
// window.__absmartlyTestMode = true must be set for tests
// Enables message bridge in file:// protocol contexts
// Pattern: tests/e2e/ai-dom-generation-complete.spec.ts:58-59

// CRITICAL: Element IDs for testing
// All testable elements MUST have id attributes
// Pattern: id="ai-prompt", id="ai-generate-button"
// File: src/components/AIDOMChangesPage.tsx

// FORBIDDEN: waitForTimeout()
// NEVER use page.waitForTimeout() or any arbitrary timeouts
// ALWAYS use: waitFor({state}), waitForSelector(), expect().toBeVisible()
// File: CLAUDE.md:25-52
```

## Implementation Blueprint

### Test Structure Overview

```
tests/e2e/
├── ai-conversation-history.spec.ts          [EXISTS] ✅
├── ai-session-image.spec.ts                 [EXISTS] ✅
├── ai-dom-generation-complete.spec.ts       [EXISTS] ✅
├── ai-session-recovery.spec.ts              [NEW] - Page reload session recovery
├── ai-storage-quota.spec.ts                 [NEW] - Storage error handling
├── ai-conversation-switching.spec.ts        [NEW] - Loading & switching conversations
├── ai-thread-continuity.spec.ts             [NEW] - Multiple messages in conversation
├── ai-error-handling.spec.ts                [NEW] - Network errors, API failures
├── ai-edge-cases.spec.ts                    [NEW] - Limits, performance, edge scenarios
└── ai-multi-variant-isolation.spec.ts       [NEW] - Conversation isolation per variant
```

### Tasks to Complete (In Order)

```yaml
Task 1: Create ai-session-recovery.spec.ts
  Purpose: Test session persistence across page reloads
  Dependencies: None
  Validates:
    - Session ID persists after reload
    - htmlSent flag remains true after initial send
    - Conversation messages restore correctly
    - Active conversation is maintained
    - onGenerate callback is missing error shown
    - Return to editor restores state
  Pattern: Mirror test structure from ai-session-image.spec.ts
  Critical: Use waitFor({state: 'visible'}) not waitForTimeout()

Task 2: Create ai-storage-quota.spec.ts
  Purpose: Test storage quota handling and error recovery
  Dependencies: None
  Validates:
    - Large conversation triggers warning
    - Storage quota error is caught and shown to user
    - Sanitization removes images before storage
    - Sanitization clears session messages
    - New conversation suggested when quota exceeded
    - Storage size calculation works correctly
  Pattern: Inject large data and verify error handling
  Critical: Mock large conversations, don't create real ones

Task 3: Create ai-conversation-switching.spec.ts
  Purpose: Test loading and switching between conversations
  Dependencies: Task 1 (session recovery patterns)
  Validates:
    - Load inactive conversation from history
    - Messages display correctly after load
    - Session ID changes when loading different conversation
    - Active badge moves to loaded conversation
    - DOM changes restore with conversation
    - Previous conversation can be reloaded
  Pattern: Pre-populate storage with multiple conversations
  Critical: Verify chrome.storage.local persistence

Task 4: Create ai-thread-continuity.spec.ts
  Purpose: Test multiple messages in single conversation
  Dependencies: None
  Validates:
    - Session ID remains same across multiple messages
    - HTML only sent once (htmlSent flag)
    - Chat history grows with each message
    - Message order is preserved
    - Assistant responses appear in history
    - Conversation updatedAt timestamp changes
    - messageCount increases correctly
  Pattern: Send 5+ messages in sequence
  Critical: Verify session.id consistency

Task 5: Create ai-error-handling.spec.ts
  Purpose: Test network failures and API error scenarios
  Dependencies: None
  Validates:
    - Network timeout shows user-friendly error
    - API 401 error suggests re-authentication
    - API 429 rate limit shows retry message
    - Malformed JSON response handled gracefully
    - Empty response from AI handled
    - Background script message failure
    - Error doesn't crash the page
    - User can retry after error
  Pattern: Mock background responses with errors
  Critical: Test all error code paths

Task 6: Create ai-edge-cases.spec.ts
  Purpose: Test limits, performance, and edge scenarios
  Dependencies: Task 2 (storage patterns)
  Validates:
    - 11th conversation triggers oldest deletion
    - Very long message (10KB+) handled
    - Rapid message sending (5 messages < 1 second)
    - Empty prompt blocked or handled
    - Special characters in prompts (emoji, unicode)
    - Conversation with 50+ messages
    - Image + very long prompt
    - New Chat clears images
  Pattern: Stress testing with edge inputs
  Critical: Verify MAX_CONVERSATIONS_PER_VARIANT limit

Task 7: Create ai-multi-variant-isolation.spec.ts
  Purpose: Test conversation isolation between variants
  Dependencies: None
  Validates:
    - Variant A conversations don't appear in Variant B
    - Storage keys are variant-specific
    - Switching variants shows correct conversations
    - Deleting in one variant doesn't affect others
    - Active conversation per variant is independent
    - Migration applies per variant
  Pattern: Create experiment with multiple variants
  Critical: Test storage key isolation

Task 8: Enhance existing ai-conversation-history.spec.ts
  Purpose: Add missing test cases to existing test
  Dependencies: None
  Validates:
    - Load conversation and verify content
    - Active conversation badge updates correctly
    - Timestamp formatting (Today, Yesterday, dates)
    - Empty state when no conversations
    - History button disabled when empty
  Pattern: Extend existing test suite
  Critical: Don't break existing tests

Task 9: Enhance existing ai-session-image.spec.ts
  Purpose: Add verification that images DON'T persist in storage
  Dependencies: Task 2 (storage validation patterns)
  Validates:
    - Images display in current session
    - Images sent to API correctly
    - Images NOT in storage after save
    - Page reload doesn't show images
    - Sanitization removed images
  Pattern: Add step to check storage contents
  Critical: Verify sanitization works

Task 10: Create test helper utilities
  Purpose: Reduce code duplication across tests
  Dependencies: All previous tasks
  Creates:
    - tests/e2e/utils/ai-test-helpers.ts
    - createTestConversation(count, variantName)
    - populateConversationStorage(conversations)
    - verifySessionPersistence(sessionId)
    - mockAIResponse(type: 'success' | 'error')
    - createLargeConversation(messageCount, messageSize)
  Pattern: Extract common patterns from test files
  Critical: DRY principle for maintainability
```

### Per-Task Pseudocode

#### Task 1: ai-session-recovery.spec.ts
```typescript
test.describe('AI Session Recovery After Page Reload', () => {
  let testPage, sidebar, extensionUrl

  test('should persist session across page reload', async () => {
    // STEP 1: Setup - Create experiment and open AI page
    await injectSidebar(testPage, extensionUrl)
    await createExperiment('Session Recovery Test')
    await navigateToAIPage(sidebar)

    // STEP 2: Verify initial session creation
    const sessionId = await getSessionIdFromConsole(allConsoleMessages)
    expect(sessionId).toBeDefined()
    log(`Initial session ID: ${sessionId}`)

    // STEP 3: Send first message (triggers HTML capture)
    await sendMessage(sidebar, 'Change button to blue')
    await waitForResponse(sidebar)

    // STEP 4: Verify htmlSent flag is now true
    const storage1 = await getConversationStorage(testPage, 'A')
    expect(storage1.conversations[0].conversationSession.htmlSent).toBe(true)

    // STEP 5: Reload the page
    await testPage.reload({ waitUntil: 'networkidle' })
    await sidebar.locator('body').waitFor({ state: 'visible' })

    // STEP 6: Navigate back to AI page
    await navigateToAIPage(sidebar)

    // STEP 7: Verify session persisted
    const sessionId2 = await getSessionIdFromConsole(allConsoleMessages)
    expect(sessionId2).toBe(sessionId)

    // STEP 8: Verify messages restored
    const messages = await sidebar.locator('.chat-message').count()
    expect(messages).toBeGreaterThan(0)

    // STEP 9: Send another message without HTML re-capture
    await sendMessage(sidebar, 'Change text to red')
    await waitForResponse(sidebar)

    // STEP 10: Verify session still same
    const sessionId3 = await getSessionIdFromConsole(allConsoleMessages)
    expect(sessionId3).toBe(sessionId)

    // PATTERN: No waitForTimeout() used, all waits are state-based
    // PATTERN: Verify session ID via console messages
    // PATTERN: Check storage directly via testPage.evaluate()
  })

  test('should show function missing error after reload without navigation', async () => {
    // Setup and create AI session
    await createExperimentAndOpenAI()

    // Reload page directly
    await testPage.reload()

    // EXPECT: Error message about reinitialization
    const errorMessage = sidebar.locator('text=needs to be reinitialized')
    await errorMessage.waitFor({ state: 'visible' })

    // Verify "Return to Variant Editor" button present
    const returnButton = sidebar.locator('button:has-text("Return to Variant Editor")')
    await expect(returnButton).toBeVisible()

    // Click and verify return works
    await returnButton.click()
    const editorTitle = sidebar.locator('text=DOM Changes')
    await editorTitle.waitFor({ state: 'visible' })
  })
})
```

#### Task 2: ai-storage-quota.spec.ts
```typescript
test.describe('AI Storage Quota Management', () => {
  test('should sanitize images before storage', async () => {
    await createExperimentAndOpenAI()

    // Upload image
    await uploadImage(sidebar, TEST_IMAGES.HELLO)
    await sendMessage(sidebar, 'What do you see?')
    await waitForResponse(sidebar)

    // Check storage - images should be removed
    const storage = await testPage.evaluate(async () => {
      const data = await chrome.storage.local.get('ai-conversations-A')
      return JSON.parse(data['ai-conversations-A'])
    })

    const lastMessage = storage.conversations[0].messages[0]
    expect(lastMessage.images).toBeUndefined()
    log('✅ Images sanitized from storage')
  })

  test('should handle storage quota exceeded error', async () => {
    // Pre-populate with very large conversation
    await testPage.evaluate(async () => {
      const largeConv = createLargeConversation(100, 1000) // 100 messages, 1KB each
      await chrome.storage.local.set({
        'ai-conversations-A': JSON.stringify({ conversations: [largeConv], version: 1 })
      })
    })

    await createExperimentAndOpenAI()

    // Try to send message
    await sendMessage(sidebar, 'Test')

    // Expect error about storage quota
    const errorMsg = sidebar.locator('text=/storage quota|too large/i')
    await errorMsg.waitFor({ state: 'visible', timeout: 5000 })

    // Verify suggestion to start new conversation
    const newChatSuggestion = sidebar.locator('text=/new conversation/i')
    await expect(newChatSuggestion).toBeVisible()
  })

  test('should warn when conversation exceeds 90KB', async () => {
    // Monitor console for warnings
    const warnings: string[] = []
    testPage.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('large')) {
        warnings.push(msg.text())
      }
    })

    // Create conversation approaching limit
    const largeConv = createConversationWithSize(85000) // 85KB
    await populateStorage([largeConv])

    await sendMessage(sidebar, 'Add more content')
    await waitForResponse(sidebar)

    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('large')
  })
})
```

#### Task 4: ai-thread-continuity.spec.ts
```typescript
test.describe('AI Thread Continuity', () => {
  test('should maintain same session across multiple messages', async () => {
    await createExperimentAndOpenAI()

    const prompts = [
      'Change button to blue',
      'Make it bigger',
      'Add a border',
      'Change text to "Click me"',
      'Hide on mobile'
    ]

    let sessionId: string | null = null

    for (const [index, prompt] of prompts.entries()) {
      log(`Sending message ${index + 1}: ${prompt}`)

      await sendMessage(sidebar, prompt)
      await waitForResponse(sidebar)

      // Extract session from console
      const currentSession = await getSessionIdFromConsole(allConsoleMessages)

      if (index === 0) {
        sessionId = currentSession
        log(`Session established: ${sessionId}`)
      } else {
        expect(currentSession).toBe(sessionId)
        log(`✅ Session maintained: ${sessionId}`)
      }

      // Verify message count grows
      const messageCount = await sidebar.locator('.chat-message').count()
      expect(messageCount).toBeGreaterThanOrEqual((index + 1) * 2) // User + Assistant
    }

    // Verify final conversation state
    const storage = await getConversationStorage(testPage, 'A')
    const conv = storage.conversations[0]

    expect(conv.messageCount).toBeGreaterThanOrEqual(prompts.length * 2)
    expect(conv.conversationSession.htmlSent).toBe(true)
    log('✅ Thread continuity maintained across all messages')
  })

  test('should only send HTML once', async () => {
    await createExperimentAndOpenAI()

    // Monitor for HTML capture logs
    const htmlCaptureLogs: string[] = []
    testPage.on('console', (msg) => {
      if (msg.text().includes('capturePageHTML') || msg.text().includes('HTML captured')) {
        htmlCaptureLogs.push(msg.text())
      }
    })

    // Send 3 messages
    for (let i = 0; i < 3; i++) {
      await sendMessage(sidebar, `Message ${i + 1}`)
      await waitForResponse(sidebar)
    }

    // HTML should only be captured once (on initialization)
    expect(htmlCaptureLogs.length).toBe(1)
    log('✅ HTML captured only once during session')
  })
})
```

### Integration Points

```yaml
STORAGE:
  - Key pattern: 'ai-conversations-{variantName}'
  - Format: StoredConversationsData with version and conversations array
  - Sanitization: Images and session messages removed before save
  - Quota: Monitored at 90KB, hard limit 100KB per item

COMPONENTS:
  - Entry: src/components/AIDOMChangesPage.tsx
  - Session init: useEffect at line 110-150
  - Storage util: src/utils/ai-conversation-storage.ts
  - Migration: src/utils/ai-conversation-migration.ts

BACKGROUND:
  - Message: AI_GENERATE_DOM_CHANGES
  - Handler: background/main.ts line 360-436
  - Session: Passed in message, returned in response

CONSOLE LOGS:
  - Session init: '[AIDOMChangesPage] Session initialized: {id}'
  - Current session: '[AIDOMChangesPage] Current session: {id}'
  - New chat: '[AIDOMChangesPage] New chat session: {id}'
  - Storage save: '[ConversationStorage] Saved conversation {id} for {variant} ({size} bytes)'
```

## Validation Loop

### Level 1: Build & Syntax
```bash
# CRITICAL: Always build before running tests
npm run build:dev

# Expected: Build completes without errors
# If errors: Fix TypeScript/build issues first
```

### Level 2: Individual Test Execution
```bash
# Run each new test file individually during development
# This follows the project's testing convention

# Test 1: Session Recovery
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-session-recovery.spec.ts

# Test 2: Storage Quota
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-storage-quota.spec.ts

# Test 3: Conversation Switching
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-conversation-switching.spec.ts

# Test 4: Thread Continuity
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-thread-continuity.spec.ts

# Test 5: Error Handling
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-error-handling.spec.ts

# Test 6: Edge Cases
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-edge-cases.spec.ts

# Test 7: Multi-Variant Isolation
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-multi-variant-isolation.spec.ts

# Expected: Each test passes with clear debug output
# If failing: Check screenshots in test-results/, read console output
# NEVER filter output with grep/head/tail - need full output for debugging
```

### Level 3: Regression Testing
```bash
# Run all AI-related tests to ensure no regressions
npm run build:dev
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-*.spec.ts

# Expected: All tests pass
# If any fail: Investigate, fix, and re-run
```

### Level 4: Full Test Suite
```bash
# Run complete E2E suite to ensure no integration issues
npm run build:dev
npm test

# Expected: All tests pass including new AI tests
# Verify: No new failures in unrelated tests
```

## Final Validation Checklist

### Test Coverage
- [ ] Session recovery after page reload tested
- [ ] Storage quota handling tested
- [ ] Conversation switching tested
- [ ] Thread continuity (multiple messages) tested
- [ ] Error handling (network, API errors) tested
- [ ] Edge cases (limits, performance) tested
- [ ] Multi-variant isolation tested
- [ ] Existing tests enhanced
- [ ] Test helper utilities created

### Code Quality
- [ ] No `waitForTimeout()` used anywhere
- [ ] All waits use `waitFor({state})`, `waitForSelector()`, or assertions
- [ ] Element IDs added to any new UI components
- [ ] Debug logging follows existing patterns
- [ ] Screenshots taken at key test steps
- [ ] Console monitoring for critical logs

### Documentation
- [ ] Each test file has clear describe/test names
- [ ] Test steps logged with emoji markers (✅, ⚠️, 📝)
- [ ] Comments explain WHY not just WHAT
- [ ] Complex test logic has explanatory comments

### Integration
- [ ] Tests use existing fixtures from tests/fixtures/extension
- [ ] Tests follow existing helper patterns (debugWait, log, injectSidebar)
- [ ] Tests respect SLOW_MODE and DEBUG_MODE environment variables
- [ ] Tests create screenshots in test-results/ directory

---

## Anti-Patterns to Avoid

- ❌ **NEVER use `waitForTimeout()`** - Use state-based waits: `waitFor({state: 'visible'})`, `expect().toBeVisible()`, `waitForSelector()`
- ❌ Don't filter test output with grep/head/tail - Full output needed for debugging
- ❌ Don't assume storage works - Always verify with `testPage.evaluate()`
- ❌ Don't mock Chrome APIs unless testing error handling - Use real storage
- ❌ Don't test implementation details - Test user-visible behavior
- ❌ Don't create brittle selectors - Always add `id` attributes to testable elements
- ❌ Don't skip the build step - Always `npm run build:dev` before tests
- ❌ Don't run all tests during development - Run specific test files
- ❌ Don't ignore console errors - Monitor and validate console output
- ❌ Don't test too much in one test - Keep tests focused and atomic

---

## Success Metrics

After implementation, the test suite should:
1. ✅ Catch session initialization bugs before they reach production
2. ✅ Validate storage quota handling prevents user data loss
3. ✅ Ensure conversation persistence works reliably
4. ✅ Verify error scenarios are handled gracefully
5. ✅ Provide confidence in AI chat feature stability
6. ✅ Enable safe refactoring with comprehensive regression coverage
7. ✅ Serve as documentation for AI chat behavior

---

## PRP Confidence Score: 9/10

**Rationale:**
- ✅ Comprehensive context provided (existing tests, implementation, storage patterns)
- ✅ Clear task breakdown with dependencies
- ✅ Executable validation gates at multiple levels
- ✅ References to existing patterns and conventions
- ✅ Specific pseudocode with critical details
- ✅ Integration points clearly documented
- ⚠️ Minor uncertainty: Exact behavior of error scenarios may need adjustment during implementation
- ⚠️ Minor uncertainty: Background script mocking patterns may need refinement

**Why high confidence:**
- Implementation follows established patterns from existing tests
- All necessary context is included or referenced
- Validation can be performed iteratively
- Anti-patterns clearly documented
- References real code and real issues (storage quota, session initialization)
