# Refactoring Roadmap - ABsmartly Browser Extension

## Overview

This document provides a detailed roadmap for addressing the issues identified in two comprehensive code reviews. Issues are organized by phase, priority, and estimated effort.

## Related Documentation

- **[Codebase_Review_Report.md](./Codebase_Review_Report.md)** - Detailed analysis of all 15+ issues from first review
- **[REVIEW_SUMMARY.md](./REVIEW_SUMMARY.md)** - Quick reference summary with key metrics
- **[CODE_REVIEW_INDEX.md](./CODE_REVIEW_INDEX.md)** - Navigation guide for all review documents

## Second Review Findings (Added)

The second comprehensive code review identified 12 additional issues:

**Critical Severity (3 issues):**
- Hardcoded API Key (98/100) - useDOMChangesEditor.ts:309
- Test waitForTimeout() violations (95/100) - 345 instances across 42 files
- Text-based test selectors (92/100) - CLAUDE.md violation

**Important Severity (6 issues):**
- XSS via innerHTML (85/100) - content.ts:900 and others
- Missing error boundaries (82/100) - ExtensionUI.tsx
- Unsafe JSON.parse (81/100) - ExperimentDetail.tsx:141
- Race conditions (80/100) - Visual editor global state
- Memory leaks (80/100) - Event listeners not cleaned up
- Commented code (80/100) - visual-editor.ts

**Medium Severity (3 issues):**
- Component > 500 lines (85/100) - content.ts 1605 lines
- any types used (83/100) - state-manager.ts
- Inconsistent error handling (80/100) - background/main.ts:126

**Total Issues Across Both Reviews: 27**

These have been integrated into Phase 0 (immediate fixes) and existing phases below.

---

## Phase 0: Immediate Security Fixes (30 minutes)

### Sprint 0.1: Remove Hardcoded API Key (30 minutes) ✅ COMPLETED

**Issue: Hardcoded Anthropic API Key Exposed**
- **Severity**: CRITICAL (98/100)
- **File**: `src/hooks/useDOMChangesEditor.ts:309`
- **Security Risk**: API key visible in client-side code

**Tasks:**
1. Locate hardcoded API key in useDOMChangesEditor.ts
2. Remove hardcoded fallback value
3. Add proper error handling when key missing
4. Update Settings UI to show error if not configured
5. Search codebase for any other hardcoded secrets

**Implementation:**
```typescript
// BEFORE (line 309)
const apiKey = process.env.PLASMO_PUBLIC_ANTHROPIC_API_KEY || "sk-ant-api03-..."

// AFTER
const apiKey = process.env.PLASMO_PUBLIC_ANTHROPIC_API_KEY
if (!apiKey) {
  throw new Error('Anthropic API key not configured. Please add it in Settings.')
}
```

**Verification:**
```bash
# Search for any hardcoded keys
grep -r "sk-ant-api" src/
grep -r "PLASMO_PUBLIC.*||" src/ | grep -v "test"
```

**Acceptance Criteria:**
- No hardcoded API keys in source
- Extension shows clear error when key missing
- No regression in functionality

---

## Phase 1: Critical Security & Stability Fixes (10-15 hours)

### Sprint 1.1: Message Security Hardening (3-4 hours)

**Issue #1: Insecure Message Passing**
- **Files to Modify:**
  - `src/lib/messaging.ts`
  - `content.ts`
  - `background/main.ts`
  - `src/background/core/message-router.ts`

- **Tasks:**
  1. Add origin validation to content script message handlers
  2. Implement frameId validation (main frame only)
  3. Add message type whitelisting
  4. Create message signature/integrity checks
  5. Add comprehensive security tests

- **Estimated Effort:** 3-4 hours
- **Testing:** Unit tests for origin validation, integration tests for message flow

- **Acceptance Criteria:**
  - All messages validate sender origin
  - frameId always specified and validated
  - Message signature prevents tampering
  - Security tests pass with fuzzy payloads

---

### Sprint 1.2: Type Safety at API Boundary (3-4 hours)

**Issue #3: Loose API Response Validation**
- **Files to Modify:**
  - `src/lib/background-api-client.ts`
  - `src/types/absmartly.ts`

- **Tasks:**
  1. Install and configure Zod (or similar)
  2. Create schemas for all API response types
  3. Add validation at `makeRequest()` boundary
  4. Implement proper error handling for validation failures
  5. Add tests for invalid response shapes

- **Estimated Effort:** 3-4 hours
- **Implementation Example:**
  ```typescript
  const ExperimentSchema = z.object({
    id: z.number(),
    name: z.string(),
    variants: z.array(VariantSchema),
    // ... other required fields
  })

  async makeRequest(...): Promise<unknown> {
    const response = await chrome.runtime.sendMessage(...)
    return ExperimentSchema.parse(response.data)
  }
  ```

- **Acceptance Criteria:**
  - All API responses validated at boundary
  - Validation errors caught and logged
  - Type-safe return values guaranteed
  - Tests verify invalid responses are rejected

---

### Sprint 1.3: Code Execution Sandbox Improvement (4-6 hours)

**Issue #2: Function Constructor Code Execution Risk**
- **Files to Modify:**
  - `src/sdk-bridge/experiment/code-executor.ts`
  - `src/utils/code-validator.ts`

- **Tasks:**
  1. Research Web Worker sandboxing options
  2. Create WorkerSandbox wrapper class
  3. Migrate code execution to Web Worker
  4. Improve code validation patterns
  5. Add comprehensive security tests
  6. Document security model

- **Estimated Effort:** 4-6 hours
- **Alternative Approach:** Use iframe with CSP if Worker unsuitable

- **Acceptance Criteria:**
  - Code executes in isolated Worker context
  - No access to extension globals
  - Validation patterns document all allowed patterns
  - Security tests verify sandbox boundaries

---

## Phase 2: Architecture & Maintainability (15-20 hours)

### Sprint 2.1: Consolidate Selector Generators (3-4 hours)

**Issue #4: Massive Selector Generation Duplication**
- **Files to Refactor:**
  - `src/utils/selector-generator.ts` (1,101 LOC)
  - `src/visual-editor/utils/selector-generator.ts` (620 LOC)
  - `src/utils/selector-generator-core.ts`
  - `src/utils/selector-generator-visual.ts` (526 LOC)

- **Tasks:**
  1. Analyze all 4 implementations for common patterns
  2. Extract base algorithms to `selector-generator/base.ts`
  3. Create strategy pattern for different selector types
  4. Implement CSS strategy, XPath strategy, Visual strategy
  5. Update all imports to use new consolidated module
  6. Run full test suite to ensure no behavior changes

- **Estimated Effort:** 3-4 hours
- **Expected Result:** Reduce ~2,300 LOC to ~600 LOC (74% reduction)

- **Implementation Plan:**
  ```
  src/utils/selector-generator/
  ├── base.ts (shared algorithms)
  ├── strategies/
  │   ├── css.ts (CSS selector strategy)
  │   ├── xpath.ts (XPath strategy)
  │   └── visual.ts (visual selector strategy)
  ├── index.ts (exports unified API)
  └── __tests__/ (consolidated tests)
  ```

- **Acceptance Criteria:**
  - All tests pass with new implementation
  - Bundle size reduced by 1,500+ LOC
  - Performance not degraded
  - All strategies produce equivalent results

---

### Sprint 2.2: Consolidate AI Providers (6-8 hours)

**Issue #5: AI Provider Code Duplication**
- **Files to Refactor:**
  - `src/lib/ai-providers/anthropic.ts`
  - `src/lib/ai-providers/openai.ts`
  - `src/lib/ai-providers/gemini.ts`
  - `src/lib/ai-providers/openrouter.ts`

- **Tasks:**
  1. Analyze all 4 implementations for common patterns
  2. Create base provider class with common methods
  3. Extract utilities: token counter, message formatter, error handler
  4. Implement specialized classes inheriting from base
  5. Update factory to use new classes
  6. Run all provider tests

- **Estimated Effort:** 6-8 hours
- **Expected Result:** Reduce ~2,300 LOC to ~1,400 LOC (40% reduction)

- **Implementation Plan:**
  ```
  src/lib/ai-providers/
  ├── base.ts (AIProvider base class)
  ├── utils/
  │   ├── token-counter.ts (shared)
  │   ├── message-formatter.ts (shared)
  │   ├── error-handler.ts (shared)
  │   └── validation.ts (shared)
  ├── providers/
  │   ├── anthropic.ts (extends base)
  │   ├── openai.ts (extends base)
  │   ├── gemini.ts (extends base)
  │   └── openrouter.ts (extends base)
  └── factory.ts (unchanged API)
  ```

- **Common Methods to Extract:**
  - Token counting logic
  - Message format conversion
  - Error response parsing
  - Tool call validation

- **Acceptance Criteria:**
  - All provider tests pass
  - Performance not degraded
  - Bundle size reduced by 900+ LOC
  - New providers easier to add

---

### Sprint 2.3: Unify Storage Implementation (2-3 hours)

**Issue #6: Multiple Storage Instances**
- **Files to Modify:**
  - `src/utils/storage.ts`

- **Tasks:**
  1. Create `StorageManager` class with tiers
  2. Define storage tiers: TRANSIENT, SESSION, PERSISTENT, SECURE
  3. Implement migration utilities
  4. Update all usage sites to use new API
  5. Add documentation

- **Estimated Effort:** 2-3 hours
- **Implementation Example:**
  ```typescript
  export class StorageManager {
    // TRANSIENT: Fast access, no persistence
    async getTransient(key: string)
    async setTransient(key: string, value: any)

    // SESSION: Browser session only
    async getSession(key: string)
    async setSession(key: string, value: any)

    // PERSISTENT: Across browser sessions
    async getPersistent(key: string)
    async setPersistent(key: string, value: any)

    // SECURE: Encrypted storage for credentials
    async getSecure(key: string)
    async setSecure(key: string, value: any)
  }
  ```

- **Acceptance Criteria:**
  - Single StorageManager instance used throughout
  - Migration paths documented
  - All tests pass
  - No data loss during migration

---

### Sprint 2.4: Refactor useABsmartly Hook (4-6 hours)

**Issue #12: useABsmartly Returns 20+ Methods**
- **Files to Modify:**
  - `src/hooks/useABsmartly.ts`
  - Component imports of useABsmartly

- **Tasks:**
  1. Create `ABsmartlyContext` with config and user data
  2. Split hook into: `useABsmartlyConfig()`, `useABsmartlyAPI()`, `useABsmartlyAuth()`
  3. Create API method hooks for each major operation
  4. Update all components to use new hooks
  5. Add context provider wrapper

- **Estimated Effort:** 4-6 hours
- **Implementation Example:**
  ```typescript
  // New API
  const config = useABsmartlyConfig()
  const { getExperiments, getExperiment } = useABsmartlyAPI()
  const { user, isAuthenticated, checkAuth } = useABsmartlyAuth()
  ```

- **Acceptance Criteria:**
  - All components refactored to new API
  - No unnecessary re-renders
  - Tests pass
  - Bundle size maintained or reduced

---

## Phase 3: Code Quality & Performance (10-15 hours)

### Sprint 3.1: Remove Commented-Out Code (30 minutes)

**Issue: Commented Code in Visual Editor**
- **Severity**: IMPORTANT (80/100)
- **File**: `src/visual-editor/core/visual-editor.ts`
- **CLAUDE.md Violation**: "NEVER add comments to code unless absolutely necessary"

**Tasks:**
1. Find all commented-out code about removed toolbar
2. Delete entirely (refactoring is complete)
3. Search for other commented code blocks
4. Remove dead code

**Commands:**
```bash
grep -r "// Removed\|// TODO" src/visual-editor/
```

**Acceptance Criteria:**
- No commented-out code in visual-editor/
- Only necessary comments remain
- Code cleaner and easier to read

---

### Sprint 3.2: Fix Type Safety - Replace any Types (1 hour)

**Issue: Using any Type**
- **Severity**: MEDIUM (83/100)
- **File**: `src/visual-editor/core/state-manager.ts:9-11`

**Tasks:**
1. Define proper types for changes array
2. Define ChangeRecord type for undo/redo
3. Replace any[] with typed arrays
4. Update all usages
5. Verify TypeScript compilation

**Implementation:**
```typescript
import type { DOMChange } from '../types/visual-editor'

interface ChangeRecord {
  change: DOMChange
  oldValue: unknown
}

interface VisualEditorState {
  changes: DOMChange[]
  undoStack: ChangeRecord[]
  redoStack: ChangeRecord[]
}
```

**Acceptance Criteria:**
- No any types in state-manager.ts
- TypeScript strict mode passes
- Tests pass

---

### Sprint 3.3: Fix Inconsistent Error Handling (30 minutes)

**Issue: Error Object Instead of Message**
- **Severity**: MEDIUM (80/100)
- **File**: `background/main.ts:126`

**Tasks:**
1. Find instance at line 126
2. Change from passing error object to error.message
3. Search for similar patterns
4. Standardize error response format

**Acceptance Criteria:**
- Consistent error.message usage
- Error responses properly formatted
- Tests verify error format

---

### Sprint 3.4: Refactor Large Components (2-3 hours)

**Issue: Component Exceeds 500 Lines**
- **Severity**: MEDIUM (85/100)
- **File**: `content.ts` (1605+ lines)
- **CLAUDE.md Rule**: "Keep components focused and under 500 lines"

**Tasks:**
1. Extract message handlers into separate modules
2. Create content/handlers/ directory
3. Split by concern: visual-editor, element-picker, preview, messages
4. Update imports
5. Verify all functionality works

**Acceptance Criteria:**
- content.ts under 500 lines
- Handlers in separate modules
- All tests pass
- No functionality changes

---

### Sprint 3.5: Clean Up Console.log (1 hour)

**Issue #15: Console.log Statements**
- **Files to Modify:** Multiple (content.ts, visual-editor.ts, ai-dom-generator.ts, etc.)

- **Tasks:**
  1. Find all `console.log()` statements
  2. Replace with `debugLog()` or remove
  3. Ensure debug module configuration works
  4. Test logging in dev and prod modes

- **Estimated Effort:** 1 hour
- **Commands:**
  ```bash
  # Find all console.log
  grep -r "console\.log" src/ --include="*.ts" --include="*.tsx"

  # Replace with debugLog
  # sed -i '' 's/console\.log/debugLog/g' ...
  ```

- **Acceptance Criteria:**
  - No console.log in source (except in tests/debugLog)
  - Debug mode works correctly
  - No performance regressions

---

### Sprint 3.2: Standardize Error Handling (3-4 hours)

**Issue #9: Inconsistent Error Handling**
- **Files to Modify:**
  - Create `src/utils/error-handler.ts`
  - Update error handling in: useABsmartly.ts, background-api-client.ts, messaging.ts

- **Tasks:**
  1. Create error handler utility class
  2. Define custom error types: APIError, ValidationError, NetworkError
  3. Implement error wrapping pattern
  4. Update all async operations to use new pattern
  5. Add consistent error logging

- **Estimated Effort:** 3-4 hours
- **Implementation Example:**
  ```typescript
  export class ErrorHandler {
    static wrapError(error: unknown, context: string): AppError {
      const cause = error instanceof Error ? error : new Error(String(error))
      return new AppError(context, { cause })
    }

    static logError(error: unknown, context: string) {
      const appError = ErrorHandler.wrapError(error, context)
      debugError(`[${context}] ${appError.message}`, appError)
    }
  }
  ```

- **Acceptance Criteria:**
  - Consistent error handling across codebase
  - Error context preserved in logs
  - User-facing messages appropriate
  - Tests cover error scenarios

---

### Sprint 0.6: Fix Race Conditions in Visual Editor State (1 hour)

**Issue: Race Condition in Visual Editor State**
- **Severity**: IMPORTANT (80/100)
- **File**: `content.ts:38-45`
- **Risk**: Multiple mutable globals without synchronization

**Tasks:**
1. Identify all global state variables in content.ts
2. Create state machine or atomic state management
3. Add synchronization for state transitions
4. Test concurrent message scenarios

**Acceptance Criteria:**
- No race conditions in state management
- Concurrent messages handled safely
- Tests verify synchronization

---

### Sprint 3.3: Fix Memory Leaks in Visual Editor (2-3 hours)

**Issue #7: Memory Leak Risk (Updated from Second Review)**
- **Files to Modify:**
  - `src/visual-editor/core/visual-editor.ts`
  - `src/visual-editor/core/cleanup.ts`

- **Tasks:**
  1. Create LifecycleManager to track resources
  2. Register all event listeners in lifecycle
  3. Implement proper cleanup sequence
  4. Test memory footprint with DevTools
  5. Add memory test to test suite

- **Estimated Effort:** 2-3 hours
- **Testing:** Use Chrome DevTools to profile memory before/after

- **Acceptance Criteria:**
  - All event listeners cleaned up on destroy
  - Memory usage stable across sessions
  - No listener leaks detected by DevTools
  - Tests verify cleanup

---

### Sprint 3.4: Standardize Naming Conventions (2-3 hours)

**Issue #14: Inconsistent Naming**
- **Files to Modify:** Multiple throughout codebase

- **Tasks:**
  1. Define naming standard (camelCase for TS, snake_case in API)
  2. Create type adapters for API responses
  3. Add naming conventions to CLAUDE.md
  4. Update existing violations (prioritize high-impact files)

- **Estimated Effort:** 2-3 hours
- **Implementation Example:**
  ```typescript
  // API uses snake_case
  interface APIExperiment {
    display_name: string
    unit_type_id: number
  }

  // Convert to camelCase for TypeScript
  interface Experiment {
    displayName: string
    unitTypeId: number
  }

  // Use Zod for transformation
  const ExperimentSchema = z.object({
    display_name: z.string().transform(() => 'displayName')
  })
  ```

- **Acceptance Criteria:**
  - No snake_case in TypeScript code (except API adapters)
  - API responses transformed automatically
  - Tests verify transformations
  - Documentation updated

---

### Sprint 3.5: Add Input Validation (2-3 hours)

**Issue #13: Missing Input Validation**
- **Files to Modify:**
  - Create `src/utils/input-validator.ts`
  - Update AI generation and code execution files

- **Tasks:**
  1. Create input validation utilities
  2. Add size limit validation
  3. Add rate limiting
  4. Add request timeout guards
  5. Add tests for validation

- **Estimated Effort:** 2-3 hours
- **Validation Rules:**
  - Prompt max 50KB
  - Code snippet max 100KB
  - Rate limit: 5 requests per minute per user
  - Timeout: 60 seconds max per request

- **Acceptance Criteria:**
  - All inputs validated at entry points
  - Rate limiting enforced
  - Oversized inputs rejected gracefully
  - Tests verify validation

---

## Phase 4: Long-term Improvements (10-15 hours)

### Sprint 4.1: Add Comprehensive Input Validation (6-8 hours)

**Issue #13: Enhanced Input Validation**
- Implement request/response size validation across app
- Add comprehensive fuzzing tests
- Implement input sanitization

### Sprint 4.2: Performance Optimization (4-6 hours)

- Profile and optimize hot paths
- Add memoization for expensive calculations
- Implement lazy loading for large modules
- Create performance benchmarks

---

## Phase 5: Test Quality Improvements (8-10 hours)

### Sprint 5.1: Fix Test Pattern Violations (8-10 hours)

**Issue: CLAUDE.md Test Pattern Violations**
- **Severity**: CRITICAL (92-95/100)
- **Violations**: waitForTimeout() usage (315 instances), text-based selectors (106 instances)

**Tasks:**
1. Fix helper file violations (✅ COMPLETED)
   - Replaced 5 waitForTimeout() calls in visual-editor-helper.ts with proper waits
2. Fix active test spec files
   - Replace 12 waitForTimeout() calls in diagnostic tests
   - Clean up or delete 300+ violations in backup/old test files
3. Add ID attributes to components without them
4. Replace 106 text-based selectors with #id selectors across 30+ test files
5. Run test suite to verify all changes

**Priority Order:**
1. Add IDs to production components first (enables test fixes)
2. Fix high-value test files (most-used test specs)
3. Clean up backup test files (.bak, .bak2, etc.)
4. Fix remaining test files

**Commands:**
```bash
# Find violations
grep -r "waitForTimeout" tests/ | grep -v ".bak"
grep -r "has-text\|:has-text\|getByText" tests/ | grep -v ".bak"

# Run tests after fixes
npm run build:dev
SAVE_EXPERIMENT=1 npx playwright test tests/components/
```

**Acceptance Criteria:**
- Zero waitForTimeout() usage in active tests
- All active tests use #id selectors
- Test suite passes reliably
- No flaky tests from timing issues

---

## Implementation Timeline

### Recommended Phasing

```
Day 1: Phase 0 - Sprint 0.1 (Immediate Security - 30 min)
Week 1: Sprint 1.1 + 1.2 (Critical Security - 6-8 hours)
Week 2: Sprint 1.3 (Code Execution - 4-6 hours)
Week 3: Sprint 2.1 + 2.2 (Refactoring - 9-12 hours)
Week 4: Sprint 2.3 + 2.4 (Architecture - 6-9 hours)
Week 5: Sprint 3.1-3.5 (Code Quality - 5-8 hours)
Week 6: Phase 4 (Long-term improvements - 10-15 hours)
Week 7: Phase 5 (Test Quality - 8-10 hours)
```

### Updated Effort Estimates

**Total Estimated Effort:**
- Phase 0 (Immediate Security): 30 minutes ✅ COMPLETED
- Phase 1 (Critical Security): 10-15 hours
- Phase 2 (Architecture): 15-20 hours
- Phase 3 (Code Quality): 10-15 hours
- Phase 4 (Long-term): 10-15 hours
- Phase 5 (Test Quality): 8-10 hours
- **Grand Total: 54-76 hours** (7-10 developer days)

### Critical Path

1. **Day 1:** Complete Phase 0 ✅ COMPLETED
2. **Weeks 1-2:** Complete all Phase 1 items (security critical)
3. **Week 3-4:** Complete Phase 2.1 and 2.2 (high-impact refactoring)
4. **Week 5:** Complete Phase 3 items (code quality)
5. **Week 6:** Phase 4 items (long-term improvements)
6. **Week 7:** Phase 5 items (test quality improvements)

---

## Success Metrics

### Code Quality
- [ ] Code duplication reduced from 4-5% to <2%
- [ ] Bundle size reduced by 20-30%
- [ ] All ESLint/TypeScript warnings resolved
- [ ] Test coverage increased to >60%
- [ ] All components under 500 lines
- [ ] Zero `any` types in critical code
- [ ] No commented-out code remaining

### Security
- [ ] No hardcoded API keys or secrets in source
- [ ] Message origin validation implemented
- [ ] Code execution sandboxed
- [ ] All API responses validated
- [ ] Security tests added for all critical paths
- [ ] XSS vulnerabilities eliminated
- [ ] Error boundaries prevent UI crashes
- [ ] JSON.parse wrapped in try-catch

### Performance
- [ ] Memory usage stable across editor sessions
- [ ] No console errors in prod build
- [ ] Load time not increased
- [ ] Render performance maintained
- [ ] Event listeners properly cleaned up
- [ ] No memory leaks in visual editor

### Test Quality
- [ ] Zero waitForTimeout() usage (CLAUDE.md compliance)
- [ ] All tests use #id selectors (no text selectors)
- [ ] Test suite passes reliably
- [ ] No flaky tests from timing issues

### Maintainability
- [ ] Consistent naming conventions throughout
- [ ] Error handling standardized
- [ ] All modules <500 LOC
- [ ] Documentation complete

---

## Risk Mitigation

### Testing Strategy
- All refactors include comprehensive test coverage
- Integration tests before/after changes
- Security testing for all security-related changes
- Performance profiling before/after optimization

### Rollback Plan
- Create feature branches for each sprint
- Tag releases before major refactors
- Keep old implementations during transition
- Gradual migration where possible

### Communication
- Weekly status updates
- Design review before major changes
- Code review for all refactors
- Documentation of changes

---

## Notes

- All estimated times assume one developer
- Actual times may vary based on code complexity
- Security fixes (Phase 1) are highest priority
- Refactoring (Phase 2) can be parallelized
- Quality improvements (Phase 3) can be ongoing

---

**Last Updated:** February 3, 2026
**Status:** Ready for Implementation
