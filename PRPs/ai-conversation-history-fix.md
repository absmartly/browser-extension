name: "AI Conversation History Fix"
description: |
  Fix the history icon in AIDOMChangesPage to show a list of previous conversations
  for the experiment/variant pair instead of showing individual messages within the
  current conversation.

## Goal

Transform the history dropdown from a "message history" view to a "conversation history" view, enabling users to:
- See all past AI conversations for the current variant
- Load any previous conversation to continue or review it
- Delete old conversations they no longer need
- View metadata (timestamp, preview, message count) for each conversation
- Maintain up to 10 conversations per variant automatically

## Why

**Business value:**
- Users often run multiple AI experiments per variant and need to compare or revisit them
- Current behavior loses all previous conversations when clicking "New Chat"
- No way to go back to a previous conversation once it's replaced
- Poor UX: History icon implies conversation history but shows message history

**User impact:**
- Enables iterative experimentation without losing work
- Reduces frustration from accidentally losing conversations
- Provides context for what changes were already tried
- Better collaboration when multiple team members work on same variant

**Integration with existing features:**
- Works seamlessly with current session management (from ai-dom-session-image-fix)
- Maintains backward compatibility with existing chat storage
- Enhances the AI DOM Changes workflow without breaking existing functionality

## What

**User-visible behavior:**
1. Click history icon (ClockIcon) in header
2. See dropdown showing list of past conversations (not messages)
3. Each conversation shows:
   - Date/time created
   - Preview of first user message (truncated)
   - Message count
   - "Active" badge if it's the current conversation
   - Delete button (trash icon)
4. Click conversation to load it (replaces current chat view)
5. Click delete button to remove conversation (with confirmation)
6. System automatically keeps most recent 10 conversations per variant
7. Existing single conversation automatically migrated to new format

**Technical requirements:**
- New storage architecture supporting multiple conversations per variant
- Migration from old `ai-chat-${variantName}` format to new `ai-conversations-${variantName}` format
- Auto-save current conversation after each message
- Conversation metadata tracking (created, updated, preview, count)
- Active conversation management
- UI redesign for conversation list dropdown

### Success Criteria
- [ ] Multiple conversations can be created and stored per variant (limit 10)
- [ ] History dropdown shows conversation list with metadata
- [ ] Clicking conversation loads it and makes it active
- [ ] Delete button removes conversation with confirmation
- [ ] Existing chat history automatically migrated on first load
- [ ] Active conversation auto-saved after each message
- [ ] UI clearly distinguishes conversations by timestamp and preview
- [ ] E2E test passes covering full workflow

## All Needed Context

### Documentation & References
```yaml
- file: src/components/AIDOMChangesPage.tsx
  lines: 1-600
  why: Current implementation of chat history and UI
  critical: Lines 328-379 contain history dropdown that needs redesign
  critical: Lines 120-139 contain storage load logic that needs migration
  critical: State management (lines 38-51) needs new conversation list state

- file: src/types/absmartly.ts
  lines: 176-181
  why: ConversationSession type definition
  critical: Need to create StoredConversation type that wraps this

- file: src/lib/storage.ts
  why: Storage utility patterns for Chrome extension
  critical: Use same patterns for new conversation storage utilities

- file: tests/e2e/ai-session-image.spec.ts
  why: Example E2E test pattern for AI DOM Changes page
  critical: Use similar structure for conversation history test

- file: CLAUDE.md
  why: Project conventions and testing requirements
  critical: Must add IDs to new UI elements for E2E testing
  critical: Must run npm run build:dev before testing
  critical: NEVER use waitForTimeout() in tests
```

### Current Codebase Structure
```bash
src/
├── components/
│   └── AIDOMChangesPage.tsx          # MODIFY - Add conversation list state and UI
├── types/
│   └── absmartly.ts                  # MODIFY - Add StoredConversation types
├── utils/
│   ├── storage.ts                    # Reference for patterns
│   └── (new files below)
└── lib/
    └── storage.ts                     # Reference for Chrome storage patterns

tests/
└── e2e/
    └── ai-session-image.spec.ts      # Reference for test patterns
```

### Desired Codebase Structure
```bash
src/
├── components/
│   └── AIDOMChangesPage.tsx                    # MODIFY - Conversation list management
├── types/
│   └── absmartly.ts                            # MODIFY - Add StoredConversation interface
├── utils/
│   ├── ai-conversation-storage.ts              # CREATE - Conversation CRUD operations
│   ├── ai-conversation-migration.ts            # CREATE - Migrate old format
│   └── time-format.ts                          # CREATE - Format timestamps for UI
└── lib/
    └── storage.ts                               # Reference only

tests/
├── unit/
│   ├── ai-conversation-storage.test.ts         # CREATE - Unit tests for storage
│   └── ai-conversation-migration.test.ts       # CREATE - Unit tests for migration
└── e2e/
    └── ai-conversation-history.spec.ts         # CREATE - E2E test for full workflow
```

### Known Gotchas & Library Quirks
```typescript
// CRITICAL: Plasmo Storage API is async and requires await
// Example: const storage = new Storage()
//          const data = await storage.get('key')

// CRITICAL: Chrome storage has size limits
// Max 10MB for local storage, we limit to 10 conversations to stay safe

// CRITICAL: Must use crypto.randomUUID() for conversation IDs
// This matches the pattern from ConversationSession

// CRITICAL: JSON.stringify/parse for complex objects in storage
// ChatMessage[] and ConversationSession must be serialized

// GOTCHA: The current code stores at key `ai-chat-${variantName}`
// Migration must check this key and convert to array format

// GOTCHA: The onGenerate callback becomes null after page reload
// Our storage must handle this gracefully (lines 54-99 show fallback)

// PATTERN: Auto-save after each message
// See lines 216-277 where handleGenerate updates chatHistory
// We need to also save to storage at this point

// PATTERN: UI dropdown uses absolute positioning
// See lines 338-379 for current dropdown pattern to maintain
```

## Implementation Blueprint

### Data Models and Structure

```typescript
// src/types/absmartly.ts - ADD these types after ConversationSession

/**
 * Stored conversation with full chat history and metadata
 */
export interface StoredConversation {
  id: string                          // UUID via crypto.randomUUID()
  variantName: string                 // Which variant this conversation belongs to
  messages: ChatMessage[]             // Full UI chat messages (from AIDOMChangesPage)
  conversationSession: ConversationSession  // API session data (for continuity)
  createdAt: number                   // Unix timestamp
  updatedAt: number                   // Unix timestamp
  messageCount: number                // Derived from messages.length
  firstUserMessage: string            // Preview text for dropdown (truncated to 50 chars)
  isActive: boolean                   // Currently active conversation flag
}

/**
 * Lightweight conversation metadata for dropdown display
 */
export interface ConversationListItem {
  id: string
  createdAt: number
  updatedAt: number
  messageCount: number
  firstUserMessage: string
  isActive: boolean
}

/**
 * Array of conversations stored per variant
 */
export interface StoredConversationsData {
  conversations: StoredConversation[]
  version: number                     // Schema version for future migrations
}
```

### Implementation Tasks

```yaml
Task 1: Create conversation storage utilities
  CREATE src/utils/ai-conversation-storage.ts:
    - Import Storage from @plasmohq/storage
    - Import types from ~src/types/absmartly

    - FUNCTION getConversations(variantName: string): Promise<StoredConversation[]>
      PURPOSE: Fetch all conversations for variant
      LOGIC:
        - Get data from key: `ai-conversations-${variantName}`
        - Parse JSON to StoredConversationsData
        - Return conversations array (or empty array if not found)
        - Handle parse errors gracefully

    - FUNCTION saveConversation(conversation: StoredConversation): Promise<void>
      PURPOSE: Create or update a conversation
      LOGIC:
        - Get existing conversations for variant
        - Find existing by ID, update if found, push if new
        - Update updatedAt timestamp
        - If > 10 conversations, remove oldest by createdAt
        - Save back to storage with JSON.stringify

    - FUNCTION loadConversation(variantName: string, conversationId: string): Promise<StoredConversation | null>
      PURPOSE: Load specific conversation by ID
      LOGIC:
        - Get all conversations for variant
        - Find by ID
        - Return conversation or null if not found

    - FUNCTION deleteConversation(variantName: string, conversationId: string): Promise<void>
      PURPOSE: Remove conversation from storage
      LOGIC:
        - Get all conversations
        - Filter out the one with matching ID
        - Save filtered array back

    - FUNCTION getConversationList(variantName: string): Promise<ConversationListItem[]>
      PURPOSE: Get lightweight metadata for dropdown
      LOGIC:
        - Get all conversations
        - Map to ConversationListItem (no messages array)
        - Sort by updatedAt DESC (most recent first)
        - Return metadata array

    - FUNCTION setActiveConversation(variantName: string, conversationId: string): Promise<void>
      PURPOSE: Mark conversation as active
      LOGIC:
        - Get all conversations
        - Set all isActive = false
        - Set matching ID isActive = true
        - Save back

Task 2: Create migration utility
  CREATE src/utils/ai-conversation-migration.ts:
    - Import Storage, types, conversation storage utils

    - FUNCTION needsMigration(variantName: string): Promise<boolean>
      PURPOSE: Check if old format exists and needs migration
      LOGIC:
        - Check for key `ai-chat-${variantName}` exists
        - Check if new key `ai-conversations-${variantName}` does NOT exist
        - Return true if old exists and new doesn't

    - FUNCTION migrateConversation(variantName: string): Promise<void>
      PURPOSE: Convert old single conversation to new array format
      LOGIC:
        - Load old data from `ai-chat-${variantName}`
        - Parse as ChatMessage[]
        - Create new StoredConversation object:
          - id: crypto.randomUUID()
          - variantName: variantName
          - messages: old ChatMessage[]
          - conversationSession: Create new session with crypto.randomUUID()
          - createdAt: Date.now()
          - updatedAt: Date.now()
          - messageCount: messages.length
          - firstUserMessage: Extract from first user message or "Migrated conversation"
          - isActive: true
        - Save using saveConversation()
        - Delete old key `ai-chat-${variantName}`
        - Log migration success

Task 3: Create time formatting utility
  CREATE src/utils/time-format.ts:
    - FUNCTION formatConversationTimestamp(timestamp: number): string
      PURPOSE: Format Unix timestamp for conversation dropdown
      LOGIC:
        - Convert to Date object
        - If today: "Today, HH:MM AM/PM"
        - If yesterday: "Yesterday, HH:MM AM/PM"
        - If this year: "MMM DD, HH:MM AM/PM"
        - If older: "MMM DD, YYYY"
        - Use Intl.DateTimeFormat for locale support

Task 4: Update AIDOMChangesPage component
  MODIFY src/components/AIDOMChangesPage.tsx:

    - ADD imports (after line 8):
      import type { StoredConversation, ConversationListItem } from '~src/types/absmartly'
      import { getConversations, saveConversation, loadConversation, deleteConversation, getConversationList, setActiveConversation } from '~src/utils/ai-conversation-storage'
      import { needsMigration, migrateConversation } from '~src/utils/ai-conversation-migration'
      import { formatConversationTimestamp } from '~src/utils/time-format'
      import { TrashIcon } from '@heroicons/react/24/outline'

    - ADD state (after line 47):
      const [conversationList, setConversationList] = useState<ConversationListItem[]>([])
      const [currentConversationId, setCurrentConversationId] = useState<string>('')

    - REPLACE useEffect for session init (lines 109-118):
      useEffect(() => {
        ;(async () => {
          // Check for migration
          if (await needsMigration(variantName)) {
            console.log('[AIDOMChangesPage] Migrating old conversation format')
            await migrateConversation(variantName)
          }

          // Load conversation list
          const list = await getConversationList(variantName)
          setConversationList(list)

          // Find active conversation or create new
          const activeConv = list.find(c => c.isActive)
          if (activeConv) {
            // Load active conversation
            const loaded = await loadConversation(variantName, activeConv.id)
            if (loaded) {
              setChatHistory(loaded.messages)
              setConversationSession(loaded.conversationSession)
              setCurrentConversationId(loaded.id)
              console.log('[AIDOMChangesPage] Loaded active conversation:', loaded.id)
              return
            }
          }

          // No active conversation, create new
          const newSession: ConversationSession = {
            id: crypto.randomUUID(),
            htmlSent: false,
            messages: [],
          }
          setConversationSession(newSession)

          const newConvId = crypto.randomUUID()
          setCurrentConversationId(newConvId)
          console.log('[AIDOMChangesPage] Created new conversation:', newConvId)
        })()
      }, [variantName])

    - MODIFY handleGenerate (after line 277, after setChatHistory):
      // Auto-save conversation after each message
      const updatedConversation: StoredConversation = {
        id: currentConversationId,
        variantName,
        messages: newHistory,
        conversationSession: result.session || conversationSession,
        createdAt: Date.now(), // Will be preserved if conversation exists
        updatedAt: Date.now(),
        messageCount: newHistory.length,
        firstUserMessage: newHistory.find(m => m.role === 'user')?.content.substring(0, 50) || 'New conversation',
        isActive: true
      }
      await saveConversation(updatedConversation)
      await setActiveConversation(variantName, currentConversationId)

      // Refresh conversation list
      const list = await getConversationList(variantName)
      setConversationList(list)

    - MODIFY handleNewChat (lines 286-304):
      const handleNewChat = async () => {
        // Save current conversation first
        if (chatHistory.length > 0 && currentConversationId) {
          const currentConv: StoredConversation = {
            id: currentConversationId,
            variantName,
            messages: chatHistory,
            conversationSession,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: chatHistory.length,
            firstUserMessage: chatHistory.find(m => m.role === 'user')?.content.substring(0, 50) || 'Conversation',
            isActive: false
          }
          await saveConversation(currentConv)
        }

        // Create new conversation
        const newSession: ConversationSession = {
          id: crypto.randomUUID(),
          htmlSent: false,
          messages: [],
        }
        setConversationSession(newSession)

        const newConvId = crypto.randomUUID()
        setCurrentConversationId(newConvId)
        await setActiveConversation(variantName, newConvId)

        setChatHistory([])
        setAttachedImages([])
        setError(null)
        setLatestDomChanges(currentChanges)

        // Refresh conversation list
        const list = await getConversationList(variantName)
        setConversationList(list)

        console.log('[AIDOMChangesPage] New chat session:', newConvId)
      }

    - REPLACE history dropdown UI (lines 338-379):
      {showHistory && conversationList.length > 0 && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Conversation History</h3>
            <p className="text-xs text-gray-600">{conversationList.length} conversation{conversationList.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {conversationList.map((conv) => (
              <div
                key={conv.id}
                className="p-3 hover:bg-gray-50 transition-colors group"
                id={`conversation-${conv.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex-1 cursor-pointer min-w-0"
                    onClick={async () => {
                      // Save current conversation first
                      if (chatHistory.length > 0 && currentConversationId !== conv.id) {
                        const currentConv: StoredConversation = {
                          id: currentConversationId,
                          variantName,
                          messages: chatHistory,
                          conversationSession,
                          createdAt: Date.now(),
                          updatedAt: Date.now(),
                          messageCount: chatHistory.length,
                          firstUserMessage: chatHistory.find(m => m.role === 'user')?.content.substring(0, 50) || 'Conversation',
                          isActive: false
                        }
                        await saveConversation(currentConv)
                      }

                      // Load selected conversation
                      const loaded = await loadConversation(variantName, conv.id)
                      if (loaded) {
                        setChatHistory(loaded.messages)
                        setConversationSession(loaded.conversationSession)
                        setCurrentConversationId(loaded.id)
                        await setActiveConversation(variantName, loaded.id)

                        // Refresh list to show new active state
                        const list = await getConversationList(variantName)
                        setConversationList(list)

                        setShowHistory(false)
                        console.log('[AIDOMChangesPage] Loaded conversation:', loaded.id)
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium text-gray-900">
                        {formatConversationTimestamp(conv.createdAt)}
                      </p>
                      {conv.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2 mb-1">
                      {conv.firstUserMessage || 'No messages yet'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''} • Updated {formatConversationTimestamp(conv.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()

                      if (!confirm('Delete this conversation? This cannot be undone.')) {
                        return
                      }

                      await deleteConversation(variantName, conv.id)

                      // If deleted active conversation, create new one
                      if (conv.isActive) {
                        const newSession: ConversationSession = {
                          id: crypto.randomUUID(),
                          htmlSent: false,
                          messages: [],
                        }
                        setConversationSession(newSession)

                        const newConvId = crypto.randomUUID()
                        setCurrentConversationId(newConvId)
                        await setActiveConversation(variantName, newConvId)

                        setChatHistory([])
                        setAttachedImages([])
                        setError(null)
                      }

                      // Refresh list
                      const list = await getConversationList(variantName)
                      setConversationList(list)

                      console.log('[AIDOMChangesPage] Deleted conversation:', conv.id)
                    }}
                    className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete conversation"
                    id={`delete-conversation-${conv.id}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    - UPDATE history button disabled logic (line 334):
      disabled={conversationList.length === 0}

    - UPDATE history button icon color (line 336):
      <ClockIcon className={`h-5 w-5 ${conversationList.length === 0 ? 'text-gray-300' : 'text-gray-600'}`} />

Task 5: Create unit tests
  CREATE tests/unit/ai-conversation-storage.test.ts:
    - Test getConversations() with empty storage
    - Test saveConversation() creates new conversation
    - Test saveConversation() updates existing conversation
    - Test conversation limit (keeps only 10 most recent)
    - Test loadConversation() returns correct conversation
    - Test loadConversation() returns null for non-existent ID
    - Test deleteConversation() removes conversation
    - Test getConversationList() returns sorted metadata
    - Test setActiveConversation() updates active flags
    - Mock Storage from @plasmohq/storage

  CREATE tests/unit/ai-conversation-migration.test.ts:
    - Test needsMigration() returns true when old format exists
    - Test needsMigration() returns false when new format exists
    - Test migrateConversation() converts old format correctly
    - Test migrateConversation() deletes old key after migration
    - Test migration handles empty chat history
    - Mock Storage from @plasmohq/storage

Task 6: Create E2E test
  CREATE tests/e2e/ai-conversation-history.spec.ts:
    - PATTERN: Use same structure as ai-session-image.spec.ts

    - Test: "Multiple conversations and history management"
      1. Inject sidebar and create experiment
      2. Navigate to AI DOM changes page
      3. Send first message "Change button to red"
      4. Verify conversation auto-saved
      5. Click "New Chat" button
      6. Send second message "Make logo bigger"
      7. Click history icon
      8. Verify dropdown shows 2 conversations
      9. Verify first conversation shows preview "Change button to red"
      10. Verify second conversation marked as "Active"
      11. Click first conversation
      12. Verify chat history loaded with "Change button to red" message
      13. Click history icon again
      14. Click delete button on second conversation
      15. Confirm deletion dialog
      16. Verify dropdown now shows 1 conversation
      17. Reload page (test persistence)
      18. Verify conversation still loaded
      19. Verify history dropdown still shows 1 conversation

    - Test: "Migration from old format"
      1. Manually create old format storage: `ai-chat-${variantName}`
      2. Navigate to AI DOM changes page
      3. Verify migration runs automatically
      4. Verify old chat history loaded
      5. Verify history dropdown shows 1 conversation
      6. Verify old storage key deleted
```

### Integration Points
```yaml
STORAGE:
  - New keys: "ai-conversations-${variantName}" (replaces "ai-chat-${variantName}")
  - Format: JSON.stringify(StoredConversationsData)
  - Limit: 10 conversations per variant max

COMPONENT STATE:
  - Add: conversationList (ConversationListItem[])
  - Add: currentConversationId (string)
  - Keep: chatHistory (ChatMessage[]) - still used for current UI
  - Keep: conversationSession (ConversationSession) - still used for API

UI ELEMENTS (must have IDs for E2E testing):
  - History button: Already exists (no ID needed)
  - Conversation list items: id="conversation-{conv.id}"
  - Delete buttons: id="delete-conversation-{conv.id}"
  - New chat button: Already exists as button[title="New Chat"]
```

## Validation Loop

### Level 1: Syntax & Type Checking
```bash
# Run type checking (no build needed for type check)
npx tsc --noEmit

# Expected: No type errors in new files or modified components
# If errors: Fix type mismatches, missing imports, or incorrect interfaces
```

### Level 2: Unit Tests
```bash
# Run unit tests for storage utilities
npm test -- tests/unit/ai-conversation-storage.test.ts
npm test -- tests/unit/ai-conversation-migration.test.ts

# Expected: All tests pass
# If failing: Debug storage logic, check mocks, verify test assertions
```

### Level 3: Build and E2E Test
```bash
# CRITICAL: Build extension first
npm run build:dev

# Run E2E test for conversation history
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-conversation-history.spec.ts

# Expected: Test passes, all steps complete
# If failing: Check console logs, add screenshots, verify storage persistence
```

### Level 4: Manual Testing
```bash
# Start dev server
npm run dev

# Manual test checklist:
# 1. Load extension in Chrome
# 2. Create experiment and variant
# 3. Navigate to AI DOM changes
# 4. Send a message
# 5. Click "New Chat"
# 6. Send another message
# 7. Click history icon → should see 2 conversations
# 8. Click first conversation → should load it
# 9. Click delete on second conversation → should remove it
# 10. Reload page → conversation should persist
# 11. Check Chrome DevTools → Storage → should see ai-conversations-* key

# Expected: All manual tests pass without errors
```

## Final Validation Checklist
- [ ] Type checking passes: `npx tsc --noEmit`
- [ ] Unit tests pass: `npm test tests/unit/ai-conversation-*.test.ts`
- [ ] Build succeeds: `npm run build:dev`
- [ ] E2E test passes: `SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-conversation-history.spec.ts`
- [ ] Manual test: Multiple conversations can be created
- [ ] Manual test: Conversations can be loaded from history
- [ ] Manual test: Conversations can be deleted
- [ ] Manual test: Active conversation badge shows correctly
- [ ] Manual test: Migration from old format works
- [ ] Manual test: Persistence across page reloads works
- [ ] Chrome storage shows correct data structure
- [ ] No console errors in browser or test output

---

## Anti-Patterns to Avoid
- ❌ Don't modify ConversationSession type - it's used by AI generator
- ❌ Don't change the ChatMessage interface - it's used throughout component
- ❌ Don't skip migration logic - existing users will lose their chat history
- ❌ Don't forget to auto-save after each message
- ❌ Don't use waitForTimeout() in E2E tests - use waitFor() with state
- ❌ Don't forget IDs on interactive elements for E2E testing
- ❌ Don't ignore the 10 conversation limit - storage has size constraints
- ❌ Don't use synchronous storage access - Plasmo Storage is async only
- ❌ Don't forget to update conversationList state after storage operations

## Confidence Score: 9/10

**Rationale:**
- Clear problem definition with existing code to modify
- Well-defined storage architecture with proven patterns
- Comprehensive test strategy covering unit and E2E
- Migration path preserves existing user data
- UI design follows existing patterns in codebase
- All integration points identified and documented

**Risk areas (-1 point):**
- Storage size limits could be reached with large conversations (mitigated by 10 conversation limit)
- Migration could fail on corrupted data (mitigated by error handling and fallback)

**Mitigation:**
- Add logging throughout migration and storage operations
- Test with large conversations to verify storage limits
- Add error boundaries in UI for storage failures
