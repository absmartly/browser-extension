# E2E Tests Documentation

**Report Generated:** February 3, 2026
**Project:** ABsmartly Browser Extension - E2E Test Suite
**Test Location:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/`

## Summary Statistics

- **Total Test Files:** 54
- **Total Tests (excluding skipped):** 168+
- **Skipped Tests:** 24
- **Test Framework:** Playwright + Jest
- **Configuration:** `playwright.config.ts` with Chrome MV3 extension support

---

## Test Files Overview

### 1. **simple-smoke-test.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/simple-smoke-test.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| Extension loads and sidebar is accessible | Verifies sidebar can be injected into a test page and iframe loads properly | ✅ Active |

**Key Testing Patterns:**
- Extension sidebar injection via iframe
- DOM element visibility checks
- Content length validation

---

### 2. **settings-auth.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/settings-auth.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should show authenticated user data with API Key authentication | Tests API key auth method with ABsmartly endpoint configuration | ✅ Active |
| should authenticate with JWT and Google OAuth | Tests JWT auth method and OAuth flow integration | ✅ Active |

**Key Testing Patterns:**
- Environment variable loading from .env.dev.local
- Authentication method switching (API Key ↔ JWT)
- Refresh button functionality
- Auth status display (authenticated vs not-authenticated)
- OAuth popup handling

---

### 3. **api-integration.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/api-integration.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| sidebar boots and makes a real API call via background | Verifies sidebar loads with real ABsmartly API credentials | ✅ Active |
| sidebar shows experiments after API call | Tests experiment list rendering after successful API response | ✅ Active |
| can navigate to experiment details | Tests clicking through to experiment detail view | ✅ Active |
| storage persists across page reloads | Validates Chrome storage persistence between page reloads | ✅ Active |

**Key Testing Patterns:**
- Credential seeding (API key, endpoint, environment)
- Loading spinner detection and timeout
- Empty state vs experiment list display
- Navigation to detail views

---

### 4. **visual-editor-complete.spec.ts** ⭐ PRIMARY VE TEST
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/visual-editor-complete.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| Complete workflow: sidebar → experiment → visual editor → actions → save → verify | Comprehensive VE test covering all editor operations | ✅ Active |

**Test Steps (20+ nested test steps):**
1. Inject sidebar
2. Create new experiment
3. Activate Visual Editor
4. Test VE protection (buttons disabled)
5. Test all visual editor actions
6. Test undo/redo functionality
7. Save changes to sidebar
8. Verify changes persisted
9. Exit preview mode via toolbar
10. Test preview mode toggle (enable/disable)
11. Add URL filter and verify JSON payload
12. Test launching second VE instance
13. Test individual DOM change checkbox toggles
14. Test attribute changes in preview mode
15. Test discarding changes
16. Fill metadata (owners, teams, tags)
17. Save experiment to database (optional - SAVE_EXPERIMENT flag)

**Key Testing Patterns:**
- Screenshot capture for debugging
- Page alive checks (prevent crashes)
- Preview mode lifecycle
- Undo/redo button state validation
- URL filter configuration
- Metadata form filling
- Visual editor protection mechanism

**Timeout:** 15 seconds (default) or 90 seconds with SLOW=1 flag

---

### 5. **experiment-flows.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/experiment-flows.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| Create new experiment from scratch with Header component | Tests experiment creation form with all components | ⏭️ **SKIPPED** |

**Reason for Skip:** Page crash when clicking Create Experiment Draft button

**Known Issues:**
- Form submission handler error causing page crash
- Selectors returning NOT_FOUND for form fields
- Needs error boundaries and better error handling

**Test Steps (when enabled):**
1. Verify Header component in experiment list
2. Open create experiment form
3. Verify Header in create form
4. Fill experiment creation form
5. Test name sync functionality
6. Verify variants section
7. Create experiment
8. Open created experiment details
9. Verify state labels display correctly
10. Navigate through settings and back

---

### 6. **url-filtering.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/url-filtering.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| URL filtering on single variant - user assigned to filtered variant | Tests URL filter matching for individual variant | ✅ Active |
| Different URL filters on different variants - all variants tracked | Tests multiple variants with different URL filters | ✅ Active |
| URL filtering with matchType options | Tests path, domain, query, hash matching modes | ✅ Active |

**Key Testing Patterns:**
- Mock SDK Context setup
- DOM changes applier functions
- URL pattern matching (simple vs regex mode)
- Multiple URL filter modes (path, domain, query, hash)
- Exposure tracking independent of URL filter

---

### 7. **variable-sync.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/variable-sync.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| Should preserve __inject_html and DOM changes when adding custom variables | Tests data preservation across variant modifications | ⏭️ **SKIPPED** |

**Reason for Skip:** Variant mismatch - injection only works on Control variant, test expects it on Variant 1

**Test Steps (when enabled):**
1. Inject sidebar
2. Create new experiment
3. Add __inject_html code via Custom Code Injection section
4. Add DOM changes via Visual Editor
5. Add URL filter configuration
6. Verify initial state (check all 3 elements present)
7. Add custom variable "hello"="there"
8. Verify __inject_html, __dom_changes, and custom variable preserved
9. Add second custom variable "foo"="bar"
10. Verify all data still present in config

**Key Testing Patterns:**
- Custom code injection flow
- CodeMirror editor usage
- JSON config validation
- Multiple custom variable management

---

### 8. **message-bridge.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/message-bridge.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| Test PING message (background ↔ sidebar) | Verifies basic message bridge communication | ✅ Active |
| Test CAPTURE_HTML message (sidebar → content script) | Tests HTML capture from content script | ⏭️ **SKIPPED** |
| Test AI_GENERATE_DOM_CHANGES message flow | Tests AI generation message routing | ✅ Active |
| Test API_REQUEST message (sidebar → background) | Tests API request message handling | ✅ Active |
| Test CHECK_AUTH message | Tests authentication check message | ✅ Active |
| Test message flow: content script → sidebar → content script | Tests bidirectional messaging | ✅ Active |
| Verify message-bridge sends messages correctly | Validates message bridge transport mode | ✅ Active |

**Key Testing Patterns:**
- chrome.runtime.sendMessage usage
- Message response handling with callbacks
- Error handling and chrome.runtime.lastError checks
- Service worker console logging
- Frame attachment and console listener setup

---

### 9. **quick-experiments-check.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/quick-experiments-check.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| Check experiments are loading from API | Verifies sidebar loads experiment list from API | ✅ Active |

**Key Testing Patterns:**
- Loading spinner detection
- Experiment count validation
- Empty state display
- Sidebar body content inspection

---

### 10. **ai-dom-generation.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/ai-dom-generation.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| Generate DOM changes using AI prompts | Full AI-powered DOM change generation | ⏭️ **SKIPPED** |
| Refresh HTML button updates page context | Tests HTML refresh button functionality | ✅ Active |
| AI uses get_html_chunk tool with Anthropic API | Validates AI tool usage for HTML retrieval | ✅ Active |

---

### 11. **ai-dom-granular-operations.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/ai-dom-granular-operations.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should handle append action - add new changes to existing ones | Tests appending AI-generated changes | ✅ Active |
| should handle replace_all action - replace all existing changes | Tests replacing all changes with AI-generated ones | ✅ Active |
| should handle replace_specific action - replace specific changes only | Tests targeted change replacement | ✅ Active |
| should handle remove_specific action - remove specific changes only | Tests targeted change removal | ✅ Active |
| should handle none action - conversational response only | Tests conversational-only responses | ✅ Active |
| should maintain change history across multiple operations | Tests change history preservation | ✅ Active |

**Key Testing Patterns:**
- AI action types (append, replace_all, replace_specific, remove_specific, none)
- DOM changes accumulation and modification
- Change history tracking

---

### 12. **ai-provider-settings.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/ai-provider-settings.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should display AI provider selection with Claude Subscription by default | Tests default provider display | ✅ Active |
| should show API key input when switching to Anthropic API | Tests provider-specific UI changes | ✅ Active |
| should show warning when selecting OpenAI API | Tests warning message display | ✅ Active |
| should persist AI provider selection | Tests provider selection persistence | ✅ Active |
| should connect to Claude Code Bridge when available | Tests bridge availability detection | ✅ Active |
| should allow custom port configuration | Tests custom port input | ✅ Active |

---

### 13. **ai-provider-factory.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/ai-provider-factory.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should switch between providers and persist API keys | Tests provider switching with key persistence | ✅ Active |
| should use HTML compression for all providers | Validates compression across providers | ✅ Active |
| should show schema is passed to bridge correctly | Tests schema passing to bridge | ✅ Active |
| should handle bridge restart recovery | Tests recovery after bridge restart | ✅ Active |
| should switch from Anthropic to OpenAI and clear previous key | Tests key clearing on provider switch | ✅ Active |
| should display error for invalid API key format | Tests validation error display | ✅ Active |
| should allow custom port configuration for bridge | Tests custom port configuration | ✅ Active |
| should show provider-specific help text | Tests help text display per provider | ✅ Active |

---

### 14. **ai-storage-quota.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/ai-storage-quota.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should sanitize images before storage | Tests image sanitization for storage | ✅ Active |
| should warn when conversation exceeds 90KB | Tests quota warning threshold | ✅ Active |
| should handle storage quota exceeded error | Tests quota exceeded error handling | ✅ Active |
| should sanitize session messages before storage | Tests message sanitization | ✅ Active |

---

### 15. **claude-api-key-authentication.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/claude-api-key-authentication.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should display Claude API Key input in settings | Tests API key input visibility | ✅ Active |
| should allow entering and saving Claude API Key | Tests key input and persistence | ✅ Active |
| should persist Claude API Key across page reloads | Tests storage persistence | ✅ Active |

---

### 16. **visual-editor-context-menu.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/visual-editor-context-menu.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| Complete visual editor context menu workflow | Tests all context menu operations | ✅ Active |
| Visual editor with real extension sidebar | Tests VE integration with actual extension | ✅ Active |

---

### 17. **visual-editor-persistence.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/visual-editor-persistence.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| 1. Save changes and verify format | Tests change format validation | ✅ Active |
| 2. Load editor with existing changes | Tests loading pre-existing changes | ✅ Active |
| 3. Apply saved changes to fresh page | Tests change application to new pages | ✅ Active |
| 4. Export/import change sets | Tests change export/import functionality | ✅ Active |
| 5. Handle invalid change data gracefully | Tests error handling for bad data | ✅ Active |
| 6. Test change merging and deduplication | Tests change merging logic | ✅ Active |
| 7. Verify selector stability across page reloads | Tests selector consistency | ✅ Active |
| 8. Test with dynamic content and AJAX updates | Tests VE with dynamic content | ✅ Active |
| 9. Cross-browser change compatibility | Tests cross-browser compatibility | ✅ Active |
| 10. Performance with large change sets | Tests performance with many changes | ✅ Active |
| 11. Message passing to extension background | Tests postMessage API | ✅ Active |
| 12. LocalStorage persistence of changes | Tests localStorage APIs | ✅ Active |
| 13. Cross-tab synchronization of changes | Tests broadcast channel or storage events | ⏭️ **SKIPPED** |
| 14. Reload page and verify changes persist | Tests persistence across page reloads | ✅ Active |
| 15. Test with multiple variants/experiments | Tests multiple change sets | ✅ Active |
| 16. Conflict resolution for concurrent changes | Tests merge strategies | ✅ Active |
| 17. Backup and restore functionality | Tests export/import workflows | ✅ Active |
| 18. Change validation before saving | Tests data integrity validation | ✅ Active |

---

### 18. **bug-fixes.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/bug-fixes.spec.ts`

**Test Group 1: Exit VE and Preview cleanup**
| Test | Status |
|------|--------|
| should stop VE when navigating back from experiment detail | ✅ Active |
| should stop Preview mode when navigating away | ✅ Active |

**Test Group 2: Clear all overrides button**
| Test | Status |
|------|--------|
| should show clear all button when overrides exist | ✅ Active |
| should clear all overrides when clicked | ✅ Active |

**Test Group 3: Dropdown collapse when clicking outside**
| Test | Status |
|------|--------|
| should close SearchableSelect dropdown when clicking outside | ✅ Active |

**Test Group 4: Units prefilled in dropdown**
| Test | Status |
|------|--------|
| should show selected unit type for existing experiment | ✅ Active |

**Test Group 5: URL filters not being lost**
| Test | Status |
|------|--------|
| should persist URL filter changes | ✅ Active |

**Test Group 6: Avatars showing in owners dropdown**
| Test | Status |
|------|--------|
| should display avatars or initials in owner dropdown | ✅ Active |

**Test Group 7: JSON editor working in VE mode**
| Test | Status |
|------|--------|
| should allow opening JSON editor while in VE mode | ✅ Active |

**Test Group 8: Control variant warning**
| Test | Status |
|------|--------|
| should show Control variant collapsed by default | ✅ Active |
| should show warning when expanding Control variant | ✅ Active |

---

### 19. **experiment-filtering.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/experiment-filtering.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should apply filters using buildFilterParams helper | Tests filter parameter builder | ✅ Active |
| should clear filters | Tests filter clearing | ✅ Active |

---

### 20. **indexeddb-conversation-persistence.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/indexeddb-conversation-persistence.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should persist conversations to IndexedDB | Tests IndexedDB storage of conversations | ✅ Active |

---

### 21. **indexeddb-quota-management.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/indexeddb-quota-management.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should handle storage quota estimation | Tests quota calculation | ✅ Active |
| should store large conversations in IndexedDB | Tests large data storage | ✅ Active |
| should enforce max 10 conversations per variant | Tests conversation limit | ✅ Active |
| should handle IndexedDB write failures gracefully | Tests error handling | ✅ Active |
| should provide storage usage metrics | Tests metrics reporting | ✅ Active |

---

### 22. **visual-improvements.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/visual-improvements.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| Verify BETA badge in extension header | Tests BETA badge display | ✅ Active |
| Verify Settings page back button | Tests Settings navigation | ✅ Active |
| Verify Create Experiment dropdown shows templates | Tests template dropdown | ✅ Active |
| Verify Visual Editor floating bar | Tests VE floating toolbar | ✅ Active |

---

### 23. **style-input-overflow.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/style-input-overflow.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| Verify style input handles long values without overflow | Tests UI overflow handling | ✅ Active |

---

### 24. **ai-conversation-history.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/ai-conversation-history.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should display conversation history UI with correct behavior | Tests conversation history display | ✅ Active |

---

### 25. **ai-dom-changes-persistence.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/ai-dom-changes-persistence.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should save DOM changes to variant editor after exiting AI chat | Tests AI changes persistence | ✅ Active |

---

### 26. **move-operation-original-position.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/move-operation-original-position.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should preserve original position when changing selector after move | Tests move operation preservation | ✅ Active |
| should preserve original position when changing target selector | Tests target selector preservation | ✅ Active |

---

### 27. **ui-persistence-with-checkboxes.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/ui-persistence-with-checkboxes.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should persist styles when persistStyle is true | Tests style persistence checkbox | ✅ Active |
| should persist attributes when persistAttribute is true | Tests attribute persistence checkbox | ✅ Active |
| should NOT persist when persistStyle is false | Tests non-persistence | ✅ Active |

---

### 28. **variant-list-performance.spec.ts**
**File Path:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/tests/e2e/variant-list-performance.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| should render URL filter section without unnecessary re-renders | Tests React.memo optimization | ✅ Active |
| should render global defaults section without unnecessary re-renders | Tests re-render optimization | ✅ Active |
| should not re-render sections when other variant properties change | Tests isolated re-rendering | ✅ Active |

---

### Additional Test Files

The following additional test files are present in the suite:

| File | Test Count | Status | Key Focus |
|------|-----------|--------|-----------|
| ai-chat-diagnostic-simple.spec.ts | 1 | ✅ Active | AI chat diagnostics |
| ai-chat-diagnostic.spec.ts | 2 | ✅ Active | AI chat stability |
| ai-chat-fix-test.spec.ts | 2 | ✅ Active | AI component mount |
| ai-chat-mount.spec.ts | 2 | ✅ Active | AI mount diagnostics |
| ai-conversation-switching.spec.ts | 2 | ⏭️ Skipped | Conversation management |
| ai-dom-generation-complete.spec.ts | 2 | ⏭️ Skipped | AI workflow |
| ai-page-persistence.spec.ts | 1 | ⏭️ Skipped | AI persistence |
| ai-session-image.spec.ts | 1 | ⏭️ Skipped | Session & images |
| ai-session-recovery.spec.ts | 2 | ⏭️ Skipped | Session recovery |
| claude-bridge-direct.spec.ts | 1 | ✅ Active | Bridge integration |
| claude-code-bridge-integration.spec.ts | 5 | ✅ Active | Bridge lifecycle |
| events-debug-page.spec.ts | 9 | ✅ Active | Event debugging |
| experiment-code-injection.spec.ts | 1 | ✅ Active | Code injection UI |
| experiment-data-persistence.spec.ts | 1 | ⏭️ Skipped | Data persistence |
| sdk-events.spec.ts | 1 | ⏭️ Skipped | SDK event tracking |
| settings-auth-refresh.spec.ts | 1 | ✅ Active | Auth refresh UI |
| test-seed.spec.ts | 1 | ✅ Active | Seed data test |
| visual-editor-absmartly.spec.ts | 1 | ✅ Active | VE context menu |
| visual-editor-demo.spec.ts | 1 | ⏭️ Skipped | VE demo |
| visual-editor-focused.spec.ts | 1 | ✅ Active | VE operations |
| visual-editor-full.spec.ts | 1 | ✅ Active | VE full workflow |
| visual-editor-image-source.spec.ts | 6 | ✅ Active | Image source handling |
| visual-editor-simple.spec.ts | 1 | ⏭️ Skipped | VE simple test |
| visual-editor-summary.spec.ts | 1 | ⏭️ Skipped | VE summary |
| visual-editor-unified.spec.ts | 1 | ⏭️ Skipped | VE unified |
| visual-editor-working.spec.ts | 1 | ✅ Active | VE context menu |

---

## Key Testing Patterns & Infrastructure

### 1. **Fixture Setup**
```typescript
import { test, expect } from '../fixtures/extension'
```
- Provides `extensionId`, `extensionUrl()`, `context`, `seedStorage()`, `getStorage()`
- Handles Chrome extension context setup

### 2. **Test Page Helpers**
- `injectSidebar()` - Injects extension sidebar via iframe
- `setupTestPage()` - Configures test page with sidebar and helpers
- `debugWait()` - Optional debug pause between steps
- `setupConsoleLogging()` - Captures console messages for analysis

### 3. **Common Test Flows**

**Sidebar Injection Pattern:**
```typescript
const sidebar = await injectSidebar(testPage, extensionUrl)
await sidebar.locator('body').waitFor({ timeout: 10000 })
```

**Storage Seeding Pattern:**
```typescript
await seedStorage({
  'absmartly-apikey': apiKey,
  'absmartly-endpoint': endpoint,
  'absmartly-auth-method': 'apikey'
})
```

**Message Bridge Pattern:**
```typescript
const result = await sidebar.locator('body').evaluate(async () => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
      resolve({ success: true, response })
    })
  })
})
```

### 4. **Critical Testing Rules**

⚠️ **NEVER use `waitForTimeout()`** - Always wait for specific DOM states:
- `waitFor({ state: 'visible' })`
- `waitFor({ state: 'hidden' })`
- `waitForFunction()` with specific conditions

⏱️ **10-Second Timeout Rule** - Tests must complete in <10 seconds unless explicitly extended with `test.setTimeout()`

🔍 **Always Use ID Selectors** - Tests use `id` attributes for reliable element targeting:
- ✅ `locator('#visual-editor-button')`
- ❌ `locator('button:has-text("Visual Editor")')`

📸 **Debug Capture Pattern** - Comprehensive debugging includes:
- Screenshots before/after critical operations
- Page alive checks: `await testPage.evaluate(() => true).catch(() => false)`
- Console message collection and filtering

### 5. **Extension-Specific Patterns**

**Visual Editor Testing:**
- Activate VE via button click
- Verify protection (buttons disabled during VE)
- Perform operations (text edit, style change, etc.)
- Test undo/redo functionality
- Save and verify changes persisted
- Test preview mode toggle
- Clean up page state

**API Integration Testing:**
- Seed credentials before tests
- Wait for loading spinner disappearance
- Check for both positive (experiments list) and negative (empty state) outcomes
- Verify navigation between views

**AI/Chat Testing:**
- Set AI provider (Claude, OpenAI, etc.)
- Configure API keys
- Test message generation and response
- Verify storage and persistence
- Test conversation history

---

## Test Execution Commands

```bash
# Build extension before running tests (CRITICAL)
npm run build:dev

# Run all tests
npm test

# Run specific test with environment variable
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/visual-editor-complete.spec.ts

# Run with debug mode
DEBUG=1 npx playwright test tests/e2e/simple-smoke-test.spec.ts

# Run with slow motion (useful for debugging)
SLOW=1 npx playwright test tests/e2e/visual-editor-complete.spec.ts

# Run with UI mode
npm run test:ui
```

---

## Known Issues & Skipped Tests Summary

### Blocked Tests (24 total)

| Test File | Reason | Impact |
|-----------|--------|--------|
| experiment-flows.spec.ts | Page crash on form submission | High - Experiment creation flow broken |
| variable-sync.spec.ts | Variant mismatch in injection | Medium - Variable sync needs fix |
| ai-conversation-switching.spec.ts | Not implemented | Low - Future feature |
| ai-dom-generation-complete.spec.ts | Incomplete workflow | Medium - AI workflow testing |
| ai-page-persistence.spec.ts | Not implemented | Low - Future feature |
| ai-session-image.spec.ts | Not implemented | Low - Image handling |
| ai-session-recovery.spec.ts | Not implemented | Medium - Session management |
| message-bridge.spec.ts (CAPTURE_HTML) | Message routing issue | Low - HTML capture not critical |
| visual-editor-persistence.spec.ts (cross-tab) | Not implemented | Low - Multi-tab sync |
| visual-editor-demo.spec.ts | Demo only | Low - Not production test |
| visual-editor-image-source.spec.ts (6 tests) | Image handling incomplete | Low - Feature not ready |
| visual-editor-simple.spec.ts | Not implemented | Low - Duplicate coverage |
| visual-editor-summary.spec.ts | Not implemented | Low - Duplicate coverage |
| visual-editor-unified.spec.ts | Not implemented | Low - Duplicate coverage |
| experiment-data-persistence.spec.ts | Not implemented | Medium - Persistence validation |
| sdk-events.spec.ts | Not implemented | Low - Event tracking |

---

## Test Coverage Analysis

### By Feature Area

| Feature | Test Count | Coverage |
|---------|-----------|----------|
| Visual Editor | 25+ | ⭐⭐⭐⭐ Excellent |
| AI Features | 22+ | ⭐⭐⭐⭐ Excellent |
| API Integration | 10+ | ⭐⭐⭐ Good |
| Authentication | 8+ | ⭐⭐⭐ Good |
| Storage/Persistence | 15+ | ⭐⭐⭐ Good |
| Message Bridge | 7+ | ⭐⭐⭐ Good |
| Bug Fixes | 16+ | ⭐⭐⭐ Good |
| UI Components | 10+ | ⭐⭐ Partial |

### By Test Type

- **Smoke Tests:** 2 (basic functionality)
- **Integration Tests:** 35+ (API, messages, storage)
- **Component Tests:** 25+ (UI components)
- **Feature Tests:** 50+ (feature workflows)
- **Diagnostic Tests:** 8 (troubleshooting)

---

## Environment Setup

### Required Environment Variables
```bash
PLASMO_PUBLIC_ABSMARTLY_API_KEY=<your-api-key>
PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT=https://dev-1.absmartly.com/v1
PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT=development
```

### Optional Environment Variables
```bash
DEBUG=1           # Enable debug logging
SLOW=1            # Add delays for manual inspection
SAVE_EXPERIMENT=1 # Actually save experiments to database
PWDEBUG=1         # Playwright debug mode
```

---

## Recommendations

### High Priority
1. ✅ Fix experiment creation flow (experiment-flows.spec.ts) - Currently crashes on form submission
2. ✅ Implement variable sync preservation - Ensure __inject_html persists when adding variables
3. ✅ Complete AI conversation switching - Enable multi-conversation management

### Medium Priority
4. Implement AI session recovery after page reload
5. Complete image source handling in Visual Editor
6. Add cross-tab synchronization tests

### Low Priority
7. Add more comprehensive UI component tests
8. Expand coverage for edge cases
9. Add performance benchmarking tests

---

## Documentation Notes

- All tests use Playwright's built-in fixture system
- Tests follow consistent naming convention: `test('description', async ...)`
- Complex tests are broken into logical `test.step()` blocks for clarity
- Error conditions are captured with screenshots for debugging
- Console messages are filtered and logged for analysis
- Page state is validated before/after critical operations

---

*Report Created: February 3, 2026*
*Last Updated: Current Session*
*Total Test Files Analyzed: 54*
