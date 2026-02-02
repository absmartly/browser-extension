# Pre-Production Code Review Fixes - Complete Implementation Plan

**Session ID:** a32e0932-6633-46a8-9aed-82c25004645e
**Created:** 2026-01-30
**Status:** Ready for execution
**Estimated Total Time:** 30-40 hours

## Context

Comprehensive code review completed across 5 specialized areas (security, error handling, test coverage, comments, type design) revealing critical issues that must be fixed before production deployment. This plan addresses ALL findings systematically.

---

# Phase 1: Critical Security Fixes (Priority: CRITICAL)

## Task 1: Fix postMessage Security Vulnerabilities
**File:** `content.ts`
**Lines:** 305-311, 503-514, 517-531, 539-548, 653-656
**Severity:** Critical - 90% confidence
**Issue:** Using `"*"` as target origin allows malicious scripts to intercept messages

**Steps:**
1. Search for all `window.postMessage` calls with `"*"` origin
2. Replace with `window.location.origin` for same-origin communication
3. Add origin validation in message event listeners
4. Document why we use window.location.origin in comments

**Verification:**
```bash
# Verify no "*" origins remain
grep -n 'postMessage.*"\*"' content.ts

# Test message passing still works
npm run build:dev
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/visual-editor-complete.spec.ts
```

## Task 2: Add IPv6 SSRF Protection
**File:** `background/utils/security.ts`
**Lines:** 14-36
**Severity:** Critical - 88% confidence
**Issue:** IPv6 localhost (::1) and private ranges not blocked

**Steps:**
1. Read current BLOCKED_HOSTS array
2. Add IPv6 addresses:
   - `'::1'` (IPv6 localhost)
   - `'[::1]'` (bracketed notation)
   - `'fc00:'` (unique local prefix)
   - `'fd00:'` (unique local prefix)
   - `'fe80:'` (link-local prefix)
3. Add comprehensive comment explaining IPv6 private ranges
4. Update isBlockedHost() to handle IPv6 format checking

**Verification:**
```bash
npm run test:unit -- background/utils/__tests__/security.test.ts

# Add test cases for IPv6 blocking
# Verify each IPv6 format is blocked correctly
```

## Task 3: Fix Incomplete XPath Validation
**File:** `src/utils/xpath-validator.ts`
**Line:** 10
**Severity:** Critical - 91% confidence
**Issue:** Regex pattern allows quotes and parentheses, enabling XPath injection

**Steps:**
1. Review current XPath validation regex pattern
2. Replace with proper XPath AST parsing OR stricter whitelist
3. Block dangerous XPath functions: document(), string(), normalize-space() with user input
4. Add test cases for injection attempts
5. Document validation approach

**Verification:**
```bash
npm run test:unit -- src/utils/__tests__/xpath-validator.test.ts

# Test injection patterns:
# - "//user[name='admin' or '1'='1']"
# - "//div[@id='test']/script"
# - XPath with document() function
```

---

# Phase 2: Critical Silent Failures (Priority: CRITICAL)

## Task 4: Fix Empty Catch Block - HTML Capture
**File:** `src/utils/html-capture.ts`
**Line:** 366
**Severity:** Critical - 92% confidence
**Issue:** Empty catch silently includes wrong elements in DOM structure

**Steps:**
1. Find the `shouldExclude` function with `catch { /* ignore */ }`
2. Add console.warn with selector and error details
3. Return `true` (exclude element) on validation error as safety measure
4. Add comment: "Safety-first: exclude element if selector validation fails"

**Verification:**
```bash
npm run test:unit -- src/utils/__tests__/html-capture-dom-structure.test.ts

# Add test: malformed selector should log warning and exclude element
```

## Task 5: Fix Swallowed Chrome Runtime Errors
**File:** `src/utils/message-bridge.ts`
**Line:** 29
**Severity:** Critical - 95% confidence
**Issue:** Extension reload/update failures are completely silent

**Steps:**
1. Find `sendMessageNoResponse` function
2. Change from `.catch(() => {})` to:
   ```typescript
   .catch((error) => {
     if (error.message !== 'Could not establish connection. Receiving end does not exist.') {
       console.error('[Message Bridge] Unexpected error sending message:', message.type, error);
     }
   })
   ```
3. Document expected vs unexpected errors
4. Consider tracking error frequency for monitoring

**Verification:**
```bash
npm run test:unit -- src/utils/__tests__/message-bridge.test.ts

# Test: extension reload scenario logs appropriate error
# Test: expected "no receivers" error is silent
```

## Task 6: Add Authentication Error Logging
**File:** `background/core/api-client.ts`
**Lines:** 63-65
**Severity:** Critical - 90% confidence
**Issue:** Users can't debug why authentication failed

**Steps:**
1. Find `getJWTCookie` function's catch block
2. Add structured error logging:
   ```typescript
   catch (error) {
     console.error('[API Client] Failed to retrieve JWT cookie:', {
       domain: config.apiEndpoint,
       error: error.message,
       hasPermission: await checkCookiePermission()
     });
     return null;
   }
   ```
3. Differentiate "no cookie found" (info) vs "error retrieving" (error)
4. Add permission check with helpful message

**Verification:**
```bash
npm run test:unit -- background/core/__tests__/api-client.test.ts

# Test: permission denied logs helpful error
# Test: no cookie found logs info level
# Test: unexpected error logs full context
```

## Task 7: Remove API Key Logging
**File:** `background/main.ts`
**Lines:** 347-350
**Severity:** Critical - 85% confidence
**Issue:** First 10 chars of API keys logged, security risk

**Steps:**
1. Find all console.log statements that log apiKey
2. Replace with debugLog or remove entirely
3. Use `'[REDACTED]'` if key presence needs to be logged
4. Add comment: "Never log API keys, even partially"
5. Search entire codebase for similar patterns

**Verification:**
```bash
# Verify no API key logging remains
grep -rn "console\.\(log\|error\|warn\).*apiKey" background/ src/

# Verify debug logs work for non-sensitive data
npm run build:dev
```

## Task 8: Fix Generic AI Error Messages
**File:** `src/lib/ai-dom-generator.ts`
**Lines:** 71-82
**Severity:** High - 86% confidence
**Issue:** All AI errors look identical to users, no actionable guidance

**Steps:**
1. Read current error handling in ai-dom-generator
2. Create error classification function:
   ```typescript
   function classifyAIError(error: Error): {
     type: 'timeout' | 'auth' | 'rate_limit' | 'invalid_input' | 'quota' | 'unknown';
     message: string;
     userAction: string;
   }
   ```
3. Provide specific messages:
   - Timeout: "AI service timed out. Try a simpler request."
   - Auth: "API key invalid or expired. Check Settings."
   - Rate limit: "Rate limit reached. Wait X seconds."
   - Quota: "API quota exceeded. Check your billing."
4. Update UI to show userAction prominently

**Verification:**
```bash
npm run test:unit -- src/lib/__tests__/ai-dom-generator.test.ts

# Test each error type returns correct classification
```

## Task 9: Add Granular Error Context to Experiment Save
**File:** `src/hooks/useExperimentSave.ts`
**Lines:** 339-345
**Severity:** High - 84% confidence
**Issue:** "Failed to save" doesn't indicate WHICH step failed

**Steps:**
1. Read multi-step save logic
2. Add separate try-catch for each step:
   - Validate experiment data
   - Save to ABsmartly API
   - Update local storage
   - Sync with background script
3. Provide step-specific error messages
4. Add progress indication for multi-step saves

**Verification:**
```bash
npm run test:unit -- src/hooks/__tests__/useExperimentSave.test.ts

# Test: API failure shows "Failed to save to ABsmartly"
# Test: Storage failure shows "Failed to update local data"
```

## Task 10: Enhance OpenRouter Error Context
**File:** `src/lib/ai-providers/openrouter.ts`
**Severity:** High - 82% confidence
**Issue:** OpenRouter errors don't provide enough debugging context

**Steps:**
1. Read current error handling
2. Add model name and request ID to error messages
3. Parse OpenRouter-specific error codes
4. Add retry-after header handling for rate limits
5. Log full error response in debug mode

**Verification:**
```bash
npm run test:unit -- src/lib/ai-providers/__tests__/openrouter.test.ts

# Test: rate limit error includes retry-after time
# Test: model error includes model name
```

---

# Phase 3: Type Safety & Validation (Priority: HIGH)

## Task 11: Add Zod Validation at All JSON.parse Boundaries
**Files:** Multiple (25+ locations)
**Severity:** Critical - 95% confidence
**Issue:** Malformed API responses crash the extension

**Steps:**
1. Create `src/lib/validation-schemas.ts`:
   ```typescript
   import { z } from 'zod'

   export const ExperimentSchema = z.object({
     id: z.number().int().positive(),
     name: z.string().min(1),
     state: z.enum(['created', 'ready', 'running', 'development', 'full_on', 'stopped', 'archived', 'scheduled']),
     variants: z.array(VariantSchema).min(1),
     // ... complete schema
   })

   export const VariantConfigSchema = z.record(z.unknown())
   ```

2. Create validation helpers:
   ```typescript
   export function parseExperiment(data: unknown): Experiment {
     return ExperimentSchema.parse(data)
   }

   export function parseVariantConfig(configStr: string): Record<string, any> {
     const parsed = JSON.parse(configStr)
     return VariantConfigSchema.parse(parsed)
   }
   ```

3. Replace JSON.parse in these critical locations:
   - `src/hooks/useExperimentVariants.ts:35` - variant config
   - `background/main.ts` - experiment data from messages
   - `src/hooks/useABsmartly.ts` - API responses
   - `src/components/ExperimentList.tsx` - cached experiments
   - `background/core/api-client.ts` - all API responses

4. Add graceful error handling for validation failures
5. Log validation errors with data sample (first 100 chars)

**Verification:**
```bash
npm run test:unit -- src/lib/__tests__/validation-schemas.test.ts
npm run test:unit -- src/hooks/__tests__/useExperimentVariants.test.ts

# Test: malformed experiment data throws validation error
# Test: missing required field throws validation error
# Test: invalid enum value throws validation error
```

## Task 12: Fix DOMChangeStyleRules Type Ambiguity
**File:** `src/types/dom-changes.ts`
**Severity:** High - 85% confidence
**Issue:** Both `value` and `states` optional allows invalid empty changes

**Steps:**
1. Read current DOMChangeStyleRules interface
2. Change to discriminated union:
   ```typescript
   export type DOMChangeStyleRules = {
     selector: string
     type: 'styleRules'
     important?: boolean
     mode?: 'replace' | 'merge'
   } & (
     | { value: string; states?: never }
     | { value?: never; states: { default?: Record<string, string>; hover?: Record<string, string>; ... } }
   )
   ```
3. Update visual editor to handle new type structure
4. Update SDK bridge to validate before applying

**Verification:**
```bash
npm run test:unit -- src/types/__tests__/dom-changes.test.ts
npm run build:dev

# Test: cannot create styleRules with neither value nor states
# Test: can create with value only
# Test: can create with states only
```

## Task 13: Fix ChromeMessage Type Safety
**File:** `src/types/messages.ts`
**Severity:** High - 80% confidence
**Issue:** Catch-all undermines exhaustiveness checking

**Steps:**
1. Read current ChromeMessage type
2. Make catch-all explicit:
   ```typescript
   export type ChromeMessage =
     | ElementSelectedMessage
     | DragDropCompleteMessage
     | VisualEditorMessage
     | UnknownMessage

   type UnknownMessage = {
     type: Exclude<string, 'ELEMENT_SELECTED' | 'DRAG_DROP_COMPLETE' | 'VISUAL_EDITOR_CHANGES'>
     payload?: unknown
   }
   ```
3. Add exhaustiveness helper:
   ```typescript
   export function assertExhaustive(x: never): never {
     throw new Error(`Unhandled message type: ${JSON.stringify(x)}`)
   }
   ```
4. Update message handlers to use exhaustiveness checks
5. Fix VisualEditorMessage to use `DOMChange[]` not `unknown[]`

**Verification:**
```bash
npm run test:unit -- background/core/__tests__/message-router.test.ts
npm run build:dev

# TypeScript should error if switch cases are incomplete
```

## Task 14: Add Discriminated Union for ABsmartlyConfig
**File:** `src/types/absmartly.ts`
**Severity:** High - 80% confidence
**Issue:** Auth method doesn't enforce required fields

**Steps:**
1. Read current ABsmartlyConfig interface
2. Change to discriminated union:
   ```typescript
   export type ABsmartlyConfig = {
     apiEndpoint: string
     applicationId?: number
     domChangesFieldName?: string
     // ... common fields
   } & (
     | { authMethod: 'apikey'; apiKey: string }
     | { authMethod: 'jwt'; apiKey?: never }
   )
   ```
3. Update all config usage to handle new type
4. Update config validation in config-manager.ts

**Verification:**
```bash
npm run test:unit -- background/core/__tests__/config-manager.test.ts
npm run build:dev

# TypeScript should require apiKey when authMethod is 'apikey'
```

## Task 15: Add Branded Types for Domain Concepts
**Files:** Multiple type files
**Severity:** Medium - 75% confidence
**Issue:** Primitive types used for constrained values

**Steps:**
1. Create `src/types/branded.ts`:
   ```typescript
   export type CSSSelector = string & { readonly __brand: 'CSSSelector' }
   export type ExperimentID = number & { readonly __brand: 'ExperimentID' }
   export type APIKey = string & { readonly __brand: 'APIKey'; readonly __redacted: true }

   export function cssSelector(s: string): CSSSelector {
     try {
       document.querySelector(s)
       return s as CSSSelector
     } catch {
       throw new Error(`Invalid CSS selector: ${s}`)
     }
   }

   export function experimentId(id: number): ExperimentID {
     if (!Number.isInteger(id) || id <= 0) {
       throw new Error(`Invalid experiment ID: ${id}`)
     }
     return id as ExperimentID
   }
   ```

2. Update DOMChange types to use CSSSelector
3. Update Experiment type to use ExperimentID
4. Update ABsmartlyConfig to use APIKey (prevents logging)

**Verification:**
```bash
npm run test:unit -- src/types/__tests__/branded.test.ts
npm run build:dev

# Test: invalid selector throws error
# Test: negative experiment ID throws error
```

---

# Phase 4: Critical Test Coverage - API & Auth (Priority: HIGH)

## Task 16: Add Comprehensive API Client Error Tests
**File:** `background/core/__tests__/api-client.test.ts`
**Severity:** Critical - 10/10 priority
**Current Coverage:** ~10% of error paths
**Issue:** Experiments may appear to save but fail silently

**Steps:**
1. Create test fixtures for various error responses
2. Test network timeout scenarios:
   - `getExperiments()` timeout
   - `createExperiment()` timeout
   - `updateExperiment()` timeout
3. Test malformed API responses:
   - Invalid JSON
   - Missing required fields
   - Wrong data types
4. Test rate limiting (429 status):
   - First request throttled
   - Retry-after header handling
5. Test authentication errors:
   - 401 Unauthorized (expired token)
   - 403 Forbidden (insufficient permissions)
6. Test partial failure scenarios:
   - Experiment created but variants failed
   - Update succeeded but refresh failed

**Verification:**
```bash
npm run test:unit -- background/core/__tests__/api-client.test.ts

# Should have 20+ test cases covering all error scenarios
# Code coverage for api-client.ts should be > 80%
```

## Task 17: Add Authentication Edge Case Tests
**File:** `src/utils/__tests__/auth.test.ts`
**Severity:** Critical - 9/10 priority
**Current Coverage:** Minimal
**Issue:** Users logged out unexpectedly or stuck in infinite loops

**Steps:**
1. Test JWT token expiry:
   - Token expires during session
   - Token expires between requests
   - Refresh token expired
2. Test concurrent authentication:
   - Multiple tabs authenticate simultaneously
   - Race condition in token refresh
3. Test cookie parsing failures:
   - Malformed JWT
   - Missing claims
   - Invalid signature
4. Test strategy fallback:
   - JWT strategy fails, fallback to API key
   - API key invalid, show login prompt
5. Test avatar fetch failures:
   - Network error
   - Invalid URL
   - 404 not found

**Verification:**
```bash
npm run test:unit -- src/utils/__tests__/auth.test.ts

# Should have 15+ test cases
# Mock chrome.cookies API for testing
```

## Task 18: Add React Hooks Error Path Tests
**Files:** 25 hook files, only 2 have tests
**Severity:** Critical - 8/10 priority
**Current Coverage:** 8%
**Issue:** Component crashes take down entire UI

**Priority hooks to test:**
1. `useExperimentSave.ts` - save failure recovery
2. `useABsmartly.ts` - API error handling
3. `useVisualEditorCoordination.ts` - editor crash recovery
4. `useConversationHistory.ts` - storage quota handling
5. `useExperimentVariants.ts` - malformed config handling

**Steps for each hook:**
1. Test error boundary integration
2. Test state recovery after errors
3. Test cleanup on unmount during errors
4. Test error propagation to UI

**Verification:**
```bash
npm run test:unit -- src/hooks/__tests__/useExperimentSave.test.ts
npm run test:unit -- src/hooks/__tests__/useABsmartly.test.ts
# ... etc

# Each hook should have 5-10 error path tests
```

---

# Phase 5: Critical Test Coverage - AI & Storage (Priority: HIGH)

## Task 19: Add AI Generation Error Recovery Tests
**File:** `src/lib/__tests__/ai-dom-generator.test.ts`
**Severity:** Critical - 9/10 priority
**Current Coverage:** Minimal
**Issue:** Lost conversation history, invalid DOM changes, silent failures

**Steps:**
1. Test quota exceeded:
   - API returns 429
   - Shows user-friendly message
   - Retries after delay
2. Test streaming interruption:
   - Connection dropped mid-stream
   - Partial response received
   - Recovers conversation state
3. Test malformed AI responses:
   - Invalid JSON in response
   - Missing required fields
   - XSS attempt in generated code
4. Test token limit exceeded:
   - Context window full
   - Truncation strategy applied
   - User notified
5. Test conversation session corruption:
   - Invalid message history
   - Recovery from last good state
   - User can restart session

**Verification:**
```bash
npm run test:unit -- src/lib/__tests__/ai-dom-generator.test.ts

# Should have 15+ test cases
# Mock AI provider responses for different error scenarios
```

## Task 20: Add IndexedDB Quota Handling Tests
**File:** `src/utils/__tests__/indexeddb-storage.test.ts`
**Severity:** Critical - 8/10 priority
**Current Coverage:** None
**Issue:** Complete loss of conversation history, extension unusable

**Steps:**
1. Test quota exceeded during save:
   - Conversation history full
   - Shows quota warning
   - Offers to clear old data
2. Test database corruption recovery:
   - Detect corruption on open
   - Rebuild from backup
   - Fallback to chrome.storage
3. Test concurrent write conflicts:
   - Multiple tabs writing simultaneously
   - Last write wins with merge
   - No data loss
4. Test transaction abort handling:
   - Transaction fails midway
   - Rollback successful
   - Retry mechanism

**Verification:**
```bash
npm run test:unit -- src/utils/__tests__/indexeddb-storage.test.ts

# Should have 12+ test cases
# Mock IndexedDB quota and corruption scenarios
```

## Task 21: Add Visual Editor Undo/Redo Edge Case Tests
**File:** `src/visual-editor/core/__tests__/undo-redo-manager.test.ts`
**Severity:** High - 7/10 priority
**Current Coverage:** Basic happy paths only
**Issue:** Undo stack corruption, lost changes

**Steps:**
1. Test undo after external change:
   - Change made via API
   - Undo local change
   - Conflict resolution
2. Test redo after undo with new change:
   - Undo, make new change
   - Redo should be disabled
   - History branch correctly
3. Test max history size:
   - Exceed max undo steps
   - Oldest change pruned
   - Memory usage bounded
4. Test undo during async operation:
   - Change being saved
   - User hits undo
   - Race condition handled

**Verification:**
```bash
npm run test:unit -- src/visual-editor/core/__tests__/undo-redo-manager.test.ts

# Should have 10+ edge case tests
```

## Task 22: Add DOM Change Validation Tests
**File:** `src/utils/__tests__/dom-change-operations.test.ts`
**Severity:** High - 6/10 priority
**Issue:** Invalid DOM changes crash visual editor

**Steps:**
1. Test invalid selector handling
2. Test malicious CSS injection attempts
3. Test circular style rules
4. Test conflicting changes (add + remove same class)
5. Test performance with large change sets (1000+ changes)

**Verification:**
```bash
npm run test:unit -- src/utils/__tests__/dom-change-operations.test.ts

# Should have 15+ validation tests
```

---

# Phase 6: React Component Tests (Priority: MEDIUM)

## Task 23: Add React Component Behavior Tests
**Current Coverage:** ~10% of components
**Severity:** Important - 7/10 priority
**Issue:** State management bugs, prop changes not handled

**Priority components:**
1. `ExtensionUI.tsx` - routing and global state
2. `ExperimentList.tsx` - filtering and sorting
3. `ExperimentDetail.tsx` - edit mode transitions
4. `DOMChangesInlineEditor.tsx` - editor state
5. `VariantList.tsx` - variant operations

**Steps for each component:**
1. Test user interactions (clicks, inputs)
2. Test prop changes triggering re-renders
3. Test error boundaries
4. Test loading states
5. Test accessibility (keyboard navigation)

**Verification:**
```bash
npm run test:unit -- src/components/__tests__/ExtensionUI.test.tsx
# ... etc

# Each component should have 8-15 behavior tests
```

---

# Phase 7: Code Quality Polish (Priority: MEDIUM)

## Task 24: Fix Inaccurate/Misleading Comments
**Files:** Multiple
**Severity:** Medium
**Issues Identified:**
1. `tests/e2e/visual-editor-complete.spec.ts` - Inaccurate timeout comment
2. `src/utils/html-capture.ts` - Misleading entropy comment
3. Various files - Comments admitting code duplication

**Steps:**
1. Remove inaccurate timeout handling comment
2. Clarify entropy calculation comment
3. Remove comments that say "duplicate code" - fix duplication instead
4. Review all TODOs - complete or document why deferred

**Verification:**
```bash
# Search for problematic comment patterns
grep -rn "TODO\|FIXME\|HACK\|duplicate" src/ tests/

# Verify no contradictory comments remain
```

## Task 25: Remove Redundant Comments
**Files:** Multiple (8+ instances)
**Severity:** Low
**Issue:** Comments restate obvious code

**Patterns to remove:**
- State description comments that restate variable names
- Selector type comments (obvious from code)
- Variable assignment comments
- Verbose HTML capture comments

**Steps:**
1. Find all "// State for..." comments - remove if variable name is clear
2. Find all "// CSS selector" comments - remove (type is obvious)
3. Find all "// Set X to Y" comments - remove (assignment is obvious)
4. Keep only non-obvious comments (complex algorithms, business logic)

**Verification:**
```bash
# Verify code remains self-explanatory
npm run build:dev

# Comments should decrease by ~20-30
```

## Task 26: Standardize Debug Logging
**Files:** Multiple
**Severity:** Medium
**Issue:** Inconsistent use of console.log vs debugLog

**Steps:**
1. Audit all logging statements
2. Replace console.log with debugLog for:
   - Message passing events
   - State transitions
   - API requests/responses (non-sensitive)
3. Keep console.error for actual errors
4. Keep console.warn for warnings
5. Remove excessive debug logs in hot paths

**Verification:**
```bash
# Find remaining console.log (should be minimal)
grep -rn "console\.log" src/ background/ | wc -l

# Should be < 20 remaining
```

---

# Phase 8: E2E Test Fixes (Priority: MEDIUM)

## Task 27: Fix 28 Skipped E2E Tests
**Files:** Multiple test files
**Severity:** High - reveals real product bugs
**Issue:** Tests hang, page crashes, changes don't persist

**Categorize skipped tests:**
1. **Page crashes** (8 tests) - likely SDK plugin issues
2. **Timeout/hanging** (12 tests) - likely selector or wait issues
3. **Persistence failures** (5 tests) - likely storage issues
4. **Other** (3 tests) - need investigation

**Steps:**
1. Create issue tracker for each skipped test
2. Run each test individually with debug screenshots
3. Fix underlying product bugs (not test issues)
4. Re-enable tests one by one
5. Document root causes

**Verification:**
```bash
# Count skipped tests (should decrease)
grep -r "test.skip\|it.skip" tests/e2e/ | wc -l

# Run full E2E suite
npm test
```

## Task 28: Replace Text-Based Test Selectors with IDs
**Files:** Multiple E2E test files
**Severity:** Medium - 6/10 priority
**Issue:** Violates CLAUDE.md rule, tests break on copy changes

**Steps:**
1. Audit all E2E tests for text-based selectors:
   ```bash
   grep -rn "getByText\|has-text" tests/e2e/
   ```
2. For each text selector:
   - Add `id` attribute to the component
   - Update test to use `#id` selector
   - Rebuild extension
   - Verify test still passes
3. Document ID naming convention

**Verification:**
```bash
# No text selectors should remain
grep -rn "getByText\|has-text" tests/e2e/ | wc -l

# Should be 0
```

---

# Success Criteria

## Phase 1: Critical Security (Tasks 1-3)
- [ ] All postMessage calls use window.location.origin
- [ ] IPv6 addresses blocked in SSRF protection
- [ ] XPath validation prevents injection
- [ ] All security tests pass

## Phase 2: Critical Silent Failures (Tasks 4-10)
- [ ] No empty catch blocks remain
- [ ] Chrome runtime errors logged with context
- [ ] Auth errors logged with debugging info
- [ ] No API keys logged (even partially)
- [ ] AI errors provide user-actionable guidance
- [ ] Save errors indicate specific step failures

## Phase 3: Type Safety (Tasks 11-15)
- [ ] Zod validation at all JSON.parse boundaries
- [ ] DOMChangeStyleRules can't be empty
- [ ] ChromeMessage enables exhaustiveness checking
- [ ] ABsmartlyConfig enforces auth requirements
- [ ] Branded types prevent invalid selectors

## Phase 4-5: Critical Test Coverage (Tasks 16-22)
- [ ] API client error paths > 80% coverage
- [ ] Auth edge cases covered
- [ ] React hooks error recovery tested
- [ ] AI generation errors handled gracefully
- [ ] IndexedDB quota and corruption tested
- [ ] Visual editor edge cases covered

## Phase 6-7: Quality Polish (Tasks 23-26)
- [ ] React components have behavior tests
- [ ] Inaccurate comments fixed
- [ ] Redundant comments removed
- [ ] Debug logging standardized

## Phase 8: E2E Test Health (Tasks 27-28)
- [ ] All skipped tests re-enabled or documented
- [ ] No text-based selectors in tests
- [ ] Full E2E suite passes consistently

---

# Execution Strategy

## Batch Execution
- **Batch size:** 3 tasks
- **Review checkpoints:** After each batch
- **Stop conditions:** Verification fails, blocker encountered
- **Documentation:** Update this plan with progress notes

## Estimated Timeline
- **Phase 1 (Security):** 6-8 hours
- **Phase 2 (Silent Failures):** 8-10 hours
- **Phase 3 (Type Safety):** 6-8 hours
- **Phase 4-5 (Critical Tests):** 16-20 hours
- **Phase 6-7 (Quality Polish):** 6-8 hours
- **Phase 8 (E2E Fixes):** 8-12 hours
- **Total:** 50-66 hours

## Priority for Production Launch
**Must complete before production:**
- Phase 1 (all 3 tasks)
- Phase 2 (all 7 tasks)
- Phase 3 (tasks 11-13)
- Phase 4 (tasks 16-18)

**Can defer to post-launch:**
- Phase 5 (tasks 19-22) - add over time
- Phase 6 (task 23) - improve gradually
- Phase 7 (tasks 24-26) - polish
- Phase 8 (tasks 27-28) - fix as time permits

---

# Phase 9: Complete Hooks Test Coverage (Priority: HIGH)
**Goal:** Achieve 100% test coverage for all React hooks (25 files)
**Current:** 2/25 hooks tested (8%)
**Target:** 25/25 hooks tested (100%)
**Estimated Time:** 25-30 hours

## Task 29: Test Business Logic Hooks (Batch 1)
**Files:** 5 hooks - core business logic
**Severity:** High - 8/10 priority

1. `useABsmartly.ts` - Main API integration hook
2. `useExperimentSave.ts` - Experiment persistence
3. `useExperimentVariants.ts` - Variant management
4. `useExperimentLoading.ts` - Data loading lifecycle
5. `useExperimentInitialization.ts` - Setup and initialization

**Test Requirements Per Hook:**
- Happy path scenarios (3-5 tests)
- Error paths (API failures, validation errors)
- Loading states and transitions
- Cleanup and unmount behavior
- Edge cases (empty data, race conditions)

**Verification:**
```bash
npm run test:unit -- src/hooks/__tests__/useABsmartly.test.ts
npm run test:unit -- src/hooks/__tests__/useExperimentSave.test.ts
npm run test:unit -- src/hooks/__tests__/useExperimentVariants.test.ts
npm run test:unit -- src/hooks/__tests__/useExperimentLoading.test.ts
npm run test:unit -- src/hooks/__tests__/useExperimentInitialization.test.ts

# Each hook should have 8-12 tests
```

## Task 30: Test UI State Management Hooks (Batch 2)
**Files:** 5 hooks - UI state and interactions

1. `useExtensionState.ts` - Global extension state
2. `useSidebarState.ts` - Sidebar state management
3. `useViewNavigation.ts` - View routing and navigation
4. `useSettingsForm.ts` - Settings form state
5. `useExperimentFilters.ts` - List filtering logic

**Test Requirements:**
- State updates and synchronization
- URL state persistence
- Form validation and submission
- Filter combinations and edge cases
- Reset and clear functionality

**Verification:**
```bash
npm run test:unit -- src/hooks/__tests__/use*.test.ts

# Coverage should show 100% for these hooks
```

## Task 31: Test Editor Coordination Hooks (Batch 3)
**Files:** 5 hooks - visual editor coordination

1. `useVisualEditorCoordination.ts` - Editor lifecycle
2. `useDOMChangesEditor.ts` - DOM change editing
3. `useEditorResources.ts` - Editor resource loading
4. `useEditorStateRestoration.ts` - State persistence
5. `useVariantPreview.ts` - Preview mode management

**Test Requirements:**
- Editor mode transitions
- Message passing with content script
- State restoration after navigation
- Resource cleanup
- Preview mode edge cases

## Task 32: Test Data Management Hooks (Batch 4)
**Files:** 5 hooks - data operations

1. `useConversationHistory.ts` - AI conversation storage
2. `useFavorites.ts` - Favorite experiments
3. `useTemplates.ts` - Experiment templates
4. `useVariantConfig.ts` - Variant configuration
5. `useCustomFields.ts` - Custom field management

**Test Requirements:**
- CRUD operations (Create, Read, Update, Delete)
- Storage quota handling
- Data migration scenarios
- Concurrent access handling
- Cache invalidation

## Task 33: Test Utility & Helper Hooks (Batch 5)
**Files:** 5 hooks - utilities and helpers

1. `useExperimentHandlers.ts` - Event handlers
2. `usePermissions.ts` - Permission management
3. `useSDKStatus.ts` - SDK plugin status
4. `useLoginRedirect.ts` - OAuth flow handling
5. `useDebounce.ts` - Input debouncing

**Test Requirements:**
- Handler composition and memoization
- Permission changes and revocation
- SDK detection and communication
- OAuth token flow
- Debounce timing and cancellation

---

# Phase 10: Complete Components Test Coverage (Priority: HIGH)
**Goal:** Achieve 100% test coverage for all React components (62 files)
**Current:** 6/62 components tested (10%)
**Target:** 62/62 components tested (100%)
**Estimated Time:** 40-50 hours

## Task 34: Test Core UI Components (Batch 1)
**Files:** 10 primitive UI components

1. `src/components/ui/Button.tsx`
2. `src/components/ui/Input.tsx`
3. `src/components/ui/Select.tsx`
4. `src/components/ui/Checkbox.tsx`
5. `src/components/ui/Dialog.tsx`
6. `src/components/ui/Alert.tsx`
7. `src/components/ui/Badge.tsx`
8. `src/components/ui/MultiSelect.tsx`
9. `src/components/ui/SearchableSelect.tsx`
10. `src/components/ui/MultiSelectTags.tsx`

**Test Requirements:**
- Render with different props
- User interactions (clicks, inputs, keyboard)
- Accessibility (ARIA labels, keyboard navigation)
- Disabled and error states
- Variant styles

**Verification:**
```bash
npm run test:unit -- src/components/ui/__tests__/

# Each component should have 5-8 tests
```

## Task 35: Test Main Application Components (Batch 2)
**Files:** 5 core application components

1. `ExtensionUI.tsx` - Main app container
2. `ExperimentList.tsx` - Experiment listing
3. `ExperimentDetail.tsx` - Experiment details view
4. `VariantList.tsx` - Variant management
5. `ExperimentEditor.tsx` - Experiment editing

**Test Requirements:**
- Component mounting and initialization
- Props updates and re-renders
- User interactions and state changes
- API integration (mocked)
- Error boundaries
- Loading states

## Task 36: Test Settings Components (Batch 3)
**Files:** 8 settings-related components

1. `SettingsView.tsx` - Settings container
2. `settings/AuthenticationStatusSection.tsx`
3. `settings/SDKConfigSection.tsx`
4. `settings/SDKInjectionSection.tsx`
5. `settings/DOMChangesStorageSection.tsx`
6. `settings/AIProviderSection.tsx`
7. `settings/SystemPromptSection.tsx`
8. `settings/QueryStringOverridesSection.tsx`

**Test Requirements:**
- Form inputs and validation
- Save and cancel operations
- Section expansion/collapse
- Integration with settings hook
- Authentication flows

## Task 37: Test Experiment Management Components (Batch 4)
**Files:** 8 experiment-specific components

1. `ExperimentMetadata.tsx`
2. `ExperimentCodeInjection.tsx`
3. `CreateExperimentDropdown.tsx`
4. `DOMChangesInlineEditor.tsx`
5. `DOMChangesJSONEditor.tsx`
6. `CustomCodeEditor.tsx`
7. `ChangeViewerModal.tsx`
8. `Pagination.tsx`

**Test Requirements:**
- Editor state management
- Code validation
- JSON parsing and formatting
- Modal open/close
- Pagination controls

## Task 38: Test Utility Components (Batch 5)
**Files:** 10 utility and helper components

1. `GlobalDefaultsSection.tsx`
2. `VisualEditorTrigger.tsx`
3. `ExperimentFilters.tsx`
4. `ExperimentSearch.tsx`
5. `VariantOverrideButtons.tsx`
6. `ExperimentStatusBadge.tsx`
7. `LoadingSpinner.tsx`
8. `EmptyState.tsx`
9. `ErrorBoundary.tsx`
10. `Tooltip.tsx`

**Test Requirements:**
- Conditional rendering
- Event handling
- Error boundary catching
- Loading and empty states
- Tooltip positioning

## Task 39: Test Remaining Components (Batch 6)
**Files:** All remaining untested components (~21 files)
**Approach:** Survey remaining components and create tests systematically

**Verification:**
```bash
# Check coverage
npm run test:unit -- --coverage src/components/

# Should show >95% coverage for all components
```

---

# Phase 11: Complete Utils Test Coverage (Priority: HIGH)
**Goal:** Achieve 100% test coverage for all utility functions
**Current:** 16/31 utils tested (52%)
**Target:** 31/31 utils tested (100%)
**Estimated Time:** 15-20 hours

## Task 40: Test Authentication & Security Utils
**Files:** 5 critical security utilities

1. `auth.ts` - Authentication strategies
2. `auth-error-handler.ts` - Auth error handling
3. `cookies.ts` - Cookie management
4. `avatar.ts` - Avatar URL handling
5. `storage.ts` - Extension storage wrapper

**Test Requirements:**
- Authentication flow (JWT, API key)
- Cookie parsing (secure, httpOnly)
- Storage operations (get, set, remove)
- Error handling and fallbacks
- Security edge cases (XSS, injection)

**Verification:**
```bash
npm run test:unit -- src/utils/__tests__/auth.test.ts
npm run test:unit -- src/utils/__tests__/cookies.test.ts
npm run test:unit -- src/utils/__tests__/storage.test.ts

# Each file should have 10-15 tests
```

## Task 41: Test DOM & Editor Utils
**Files:** 5 editor-related utilities

1. `html-capture.ts` - DOM structure capture
2. `selector-generator-core.ts` - CSS selector generation
3. `selector-suggestions.ts` - Selector recommendations
4. `selector-cleaner.ts` - Selector optimization
5. `sdk-bridge.ts` - SDK communication bridge

**Test Requirements:**
- HTML parsing and sanitization
- Selector uniqueness and specificity
- Edge cases (shadow DOM, iframes)
- Performance with large DOMs
- SDK message formatting

## Task 42: Test Helper Utils
**Files:** 7 helper utilities

1. `debug.ts` - Debug logging
2. `duration.ts` - Time formatting
3. `time-format.ts` - Date/time display
4. `markdown.ts` - Markdown parsing
5. `image-compression.ts` - Image optimization
6. `overrides.ts` - Query string overrides
7. `experiment-state.ts` - State helpers

**Test Requirements:**
- Input validation
- Edge cases (null, undefined, empty)
- Format conversions
- Performance with large inputs
- Error handling

---

# Phase 12: Complete Visual Editor Test Coverage (Priority: MEDIUM)
**Goal:** Achieve 100% test coverage for visual editor modules
**Current:** 5/23 files tested (~22%)
**Target:** 23/23 files tested (100%)
**Estimated Time:** 20-25 hours

## Task 43: Test Visual Editor Core
**Files:** 8 core editor modules

1. `core/editor-coordinator.ts` - Main coordinator
2. `core/element-actions.ts` - Element manipulation
3. `core/edit-modes.ts` - Edit mode management
4. `core/drag-drop.ts` - Drag and drop
5. `core/resize.ts` - Element resizing
6. `core/inline-edit.ts` - Inline editing
7. `core/selection.ts` - Element selection
8. `core/undo-redo-manager.ts` - History management

**Test Requirements:**
- Mode transitions
- Action composition
- Undo/redo stack integrity
- Concurrent operations
- Edge cases (nested elements, shadow DOM)

## Task 44: Test Visual Editor UI
**Files:** 7 UI modules

1. `ui/toolbar.ts` - Toolbar controls
2. `ui/context-menu.ts` - Right-click menu
3. `ui/property-panel.ts` - Style editor
4. `ui/color-picker.ts` - Color selection
5. `ui/highlighter.ts` - Element highlighting
6. `ui/resize-handles.ts` - Resize UI
7. `ui/drag-indicator.ts` - Drop target indicator

**Test Requirements:**
- UI rendering and positioning
- User interactions
- Keyboard shortcuts
- Accessibility
- Responsive behavior

## Task 45: Test Visual Editor Utils
**Files:** 8 utility modules

1. `utils/selector-generator.ts`
2. `utils/dom-utils.ts`
3. `utils/position-utils.ts`
4. `utils/style-utils.ts`
5. `utils/event-utils.ts`
6. `utils/iframe-handler.ts`
7. `utils/shadow-dom-handler.ts`
8. `utils/css-parser.ts`

**Test Requirements:**
- Selector accuracy and uniqueness
- Position calculations (viewport, scroll)
- Style parsing and application
- Event delegation
- Cross-frame communication

---

# Phase 13: Complete SDK Bridge Test Coverage (Priority: MEDIUM)
**Goal:** Achieve 100% test coverage for SDK bridge modules
**Current:** 3/13 files tested (~23%)
**Target:** 13/13 files tested (100%)
**Estimated Time:** 12-15 hours

## Task 46: Test SDK Bridge Core
**Files:** 5 core modules

1. `core/orchestrator.ts` - Main orchestrator
2. `core/lifecycle.ts` - Lifecycle management
3. `core/message-handler.ts` - Message routing
4. `core/state-manager.ts` - State synchronization
5. `core/error-handler.ts` - Error management

**Test Requirements:**
- Initialization sequence
- Message passing protocols
- State synchronization
- Error recovery
- Cleanup on shutdown

## Task 47: Test SDK Bridge DOM & Experiment
**Files:** 5 DOM/experiment modules

1. `dom/element-state.ts` - Element tracking
2. `dom/preview-manager.ts` - Preview mode
3. `experiment/code-executor.ts` - Code execution
4. `experiment/code-injector.ts` - Code injection
5. `experiment/variant-applier.ts` - Variant application

**Test Requirements:**
- DOM mutation observation
- Preview toggle without side effects
- Secure code execution (sandboxing)
- Variant application order
- Conflict resolution

## Task 48: Test SDK Bridge Utils
**Files:** 3 utility modules

1. `utils/html-sanitizer.ts` - HTML sanitization
2. `utils/script-loader.ts` - Script injection
3. `utils/message-validator.ts` - Message validation

**Test Requirements:**
- XSS prevention
- Script CSP compliance
- Message schema validation
- Performance benchmarks

---

# Updated Success Criteria

## Phase 9: Complete Hooks Coverage (Tasks 29-33)
- [ ] All 25 hooks have comprehensive test files
- [ ] Each hook has 8-12 tests covering happy paths and errors
- [ ] Hook test coverage > 95%

## Phase 10: Complete Components Coverage (Tasks 34-39)
- [ ] All 62 components have test files
- [ ] UI components have accessibility tests
- [ ] Complex components have integration tests
- [ ] Component test coverage > 95%

## Phase 11: Complete Utils Coverage (Tasks 40-42)
- [ ] All 31 utility functions tested
- [ ] Security utils have vulnerability tests
- [ ] Performance utils have benchmarks
- [ ] Utils test coverage > 98%

## Phase 12: Complete Visual Editor Coverage (Tasks 43-45)
- [ ] All 23 visual editor modules tested
- [ ] Cross-frame communication tested
- [ ] Shadow DOM edge cases covered
- [ ] Visual editor coverage > 95%

## Phase 13: Complete SDK Bridge Coverage (Tasks 46-48)
- [ ] All 13 SDK bridge modules tested
- [ ] Message protocol tested end-to-end
- [ ] Security boundaries validated
- [ ] SDK bridge coverage > 95%

---

# Updated Execution Strategy

## Revised Timeline
- **Phase 1 (Security):** 6-8 hours
- **Phase 2 (Silent Failures):** 8-10 hours
- **Phase 3 (Type Safety):** 6-8 hours
- **Phase 4 (API & Auth Tests):** 6-8 hours
- **Phase 5 (AI & Storage Tests):** 10-12 hours
- **Phase 6 (React Component Tests):** 6-8 hours
- **Phase 7 (Code Quality):** 6-8 hours
- **Phase 8 (E2E Fixes):** 8-12 hours
- **Phase 9 (Complete Hooks):** 25-30 hours ⭐ NEW
- **Phase 10 (Complete Components):** 40-50 hours ⭐ NEW
- **Phase 11 (Complete Utils):** 15-20 hours ⭐ NEW
- **Phase 12 (Complete Visual Editor):** 20-25 hours ⭐ NEW
- **Phase 13 (Complete SDK Bridge):** 12-15 hours ⭐ NEW
- **Total:** 174-235 hours (~4-6 weeks of AI work)

## Priority for Production Launch
**Must complete before production:**
- Phases 1-3 (Security + Types) - 20-26 hours
- Phase 4 (Critical API/Auth tests) - 6-8 hours
- Phase 9-10 (Hooks + Core Components) - 65-80 hours

**High priority post-launch:**
- Phase 5 (AI/Storage tests) - 10-12 hours
- Phase 11 (Utils coverage) - 15-20 hours

**Medium priority:**
- Phases 6-8 (Polish + E2E) - 20-28 hours
- Phases 12-13 (Editor/Bridge) - 32-40 hours

## Test Coverage Goals
- **Pre-production:** 80-85% overall coverage
- **Post-launch Sprint 1:** 90-95% coverage
- **Post-launch Sprint 2:** 95-100% coverage

---

# Progress Tracking

## Completed Tasks
_Update as tasks are completed_

## Blocked Tasks
_Document any blockers here_

## Notes
_Add implementation notes, gotchas, learnings_
