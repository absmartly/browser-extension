# Comprehensive Plan for Remaining Work

## Current Status Summary

### What Was Completed ✅
1. **Messaging Migration Refactor** - ALL 10 TASKS COMPLETE
   - All 8 component migrations completed (25+ locations)
   - All 2 cleanup tasks completed
   - Verified working in visual-editor-complete.spec.ts E2E test
   - Commit: `03691d49` - Fixed sidebar setupMessageListener import issue

2. **Sidebar Injection Fix** - COMPLETE
   - Removed broken `setupMessageListener` import from tabs/sidebar.tsx
   - Removed iframe test-mode polyfill block (lines 3, 10-21)
   - Fixed "sidebar iframe body is hidden" test failure
   - Result: visual-editor-complete.spec.ts now PASSES all 11 steps

3. **Code Quality Verification** - COMPLETE
   - No remaining broken imports or references
   - FORWARD_TO_CONTENT_SCRIPT handler already removed from background/main.ts
   - All migration queue file tasks verified as DONE

### Test Coverage Status
- **PASSING**: visual-editor-complete.spec.ts (comprehensive workflow test)
- **28 total E2E test files** in tests/e2e/ directory
- **UNKNOWN**: Status of other 27 E2E test files (not yet run after sidebar fix)

---

## Priority 1: Immediate Testing (Critical - Do This First)

### Task 1.1: Run Full E2E Test Suite
**Goal**: Identify any other tests broken by the sidebar fix

```bash
npm run build:dev  # Ensure build is ready
npx playwright test tests/e2e/ --reporter=list
```

**Expected Outcomes**:
- Some tests may now pass (due to sidebar fix)
- Some tests may fail (need investigation)
- Identifies full scope of remaining issues

**Action Items**:
- [ ] Run full test suite and capture results
- [ ] Create issue list of failing tests with error messages
- [ ] Categorize failures by root cause:
  - Messaging API changes (still using chrome.tabs.sendMessage?)
  - Sidebar injection issues (similar to fixed issue?)
  - DOM/visual editor issues
  - Authentication/API issues
  - Other

---

## Priority 2: Fix Test Failures (Based on Test Results)

### Task 2.1: Identify Common Failure Patterns
Review test failure output to find:
- Are 90% failing due to same root cause?
- Are multiple different issues?
- Are some tests timing out?
- Are some tests failing on message passing?

### Task 2.2: Fix High-Impact Issues First
Fix whatever failures affect the most tests (20/80 principle):
- Likely candidates: messaging issues, sidebar setup issues, authentication issues
- Quick wins: Import errors, missing function calls

### Task 2.3: Run Tests in Phases
1. Run tests in groups by category to isolate issues
2. Fix each category before moving to next
3. Re-run full suite periodically to track progress

---

## Priority 3: Code Cleanup & Modernization

### Task 3.1: Remove Obsolete Test Files
The git status shows these deleted files that may need cleanup:
- `tests/unit/ExperimentCodeInjection.test.ts` (deleted - REMOVED)
- `tests/unit/ExperimentDetail.test.ts` (deleted - REMOVED)
- `tests/unit/ExperimentEditor.test.ts` (deleted - REMOVED)
- `tests/unit/ExperimentMetadata.test.ts` (deleted - REMOVED)
- `tests/unit/VariantList.test.ts` (deleted - REMOVED)

**Check if these should be:**
- [ ] Formally removed with git rm
- [ ] Replaced with new unit tests
- [ ] Left as historical record

### Task 3.2: Clean Up Untracked Test Files
These untracked files in root directory:
- `ExperimentCodeInjection.test.ts`
- `ExperimentDetail.test.ts`
- `ExperimentEditor.test.ts`
- `ExperimentMetadata.test.ts`
- `VariantList.test.ts`

**Action**: Remove or move to proper location

### Task 3.3: Review and Organize .claude/ Documentation
Currently has:
- `E2E_TEST_PROJECT_CHARTER.md` (untracked)
- `SUBAGENT_BRIEFING.md` (untracked)
- `context_e2e_test_fix.md` (untracked)
- `e2e-test-plan.md` (untracked)
- `messaging-migration-queue.md` (UPDATED - in progress)
- `COMPREHENSIVE_NEXT_STEPS.md` (this file - new)

**Action**: Review, consolidate, and organize documentation

---

## Priority 4: Feature & Integration Testing

### Task 4.1: Test Key User Workflows
Once basic E2E tests pass, verify these critical workflows:
1. Authentication flow (login/logout)
2. Experiment creation flow
3. Visual editor activation & DOM manipulation
4. Experiment save & persistence
5. Variant list management
6. Preview mode toggle
7. URL filtering
8. SDK event tracking

### Task 4.2: Test Integration Points
- [ ] Content script ↔ Sidebar messaging
- [ ] Sidebar ↔ Background script messaging
- [ ] Background script ↔ ABsmartly API
- [ ] SDK plugin injection & communication
- [ ] DOM changes application & undo/redo

---

## Priority 5: Performance & Optimization

### Task 5.1: Identify Performance Issues
Once tests pass, profile for:
- Slow message passing
- Memory leaks in sidebar
- DOM mutation performance
- Visual editor responsiveness

### Task 5.2: Optimize Critical Paths
- Reduce re-renders in React components
- Optimize message serialization
- Implement lazy loading if needed
- Profile and optimize visual editor

---

## Priority 6: Documentation & Developer Experience

### Task 6.1: Update CLAUDE.md Project Instructions
- Document the messaging helper functions
- Add examples of proper message passing
- Document test running procedures
- Add troubleshooting section

### Task 6.2: Create Developer Guides
- [ ] Messaging system architecture guide
- [ ] Adding new message types guide
- [ ] Running tests locally guide
- [ ] Debugging extension issues guide

---

## Additional Known Issues to Investigate

### Issue 1: Modified Files (git status)
- `public/inject-sdk-plugin.js` - MODIFIED (check if intentional)
- `src/components/ExperimentEditor.tsx` - MODIFIED (check changes)

### Issue 2: Message Format Consistency
Verify all migrated components use correct message format:
- All messages should have `type` field
- All messages should be JSON-serializable
- All async calls should use try/catch

### Issue 3: Test Infrastructure Improvements
Consider adding:
- [ ] Test helper utilities for common operations
- [ ] Fixtures for test data
- [ ] Mocking utilities for external APIs
- [ ] Performance testing framework

---

## Recommended Execution Order

### Phase 1: Stabilization (Today)
1. Run full E2E test suite → identify failures
2. Fix critical failures blocking most tests
3. Verify visual-editor-complete.spec.ts still passes
4. Commit fixes

### Phase 2: Coverage (This Sprint)
1. Systematically fix each failing test category
2. Add missing test cases for new messaging helpers
3. Verify all 28 E2E tests pass
4. Clean up test files and documentation

### Phase 3: Quality (Next Sprint)
1. Performance profiling and optimization
2. Code quality improvements
3. Developer documentation
4. Integration testing of all workflows

---

## Success Criteria

✅ **Immediate (Today)**
- [ ] visual-editor-complete.spec.ts passes (DONE - verify still passing)
- [ ] All broken imports fixed (DONE - verified)
- [ ] Sidebar injection working (DONE - verified with test)

📊 **Short-term (This Week)**
- [ ] At least 80% of E2E tests passing
- [ ] All critical user workflows tested and working
- [ ] Test files organized and cleaned up
- [ ] Messaging system verified in production

📈 **Medium-term (Next Sprint)**
- [ ] 100% of E2E tests passing
- [ ] Performance optimizations complete
- [ ] Comprehensive developer documentation
- [ ] Ready for production release

---

## Estimated Effort

- **Run tests & identify issues**: 30 minutes
- **Fix high-impact failures**: 2-4 hours
- **Fix remaining test failures**: 4-8 hours
- **Clean up and documentation**: 2-3 hours
- **Performance optimization**: 4-6 hours
- **Total estimated**: 12-25 hours over multiple days

---

## Notes

### Key Insight from Messaging Migration
The refactor successfully replaced direct chrome API calls with three helper functions:
- `sendToContent()` - for sidebar→content messaging
- `sendToBackground()` - for sidebar↔background messaging
- `broadcastToExtension()` - for broadcasts to all extension pages

This standardization makes the codebase more maintainable and testable.

### Next Session Should Start With
1. Run: `npm run build:dev && npx playwright test tests/e2e/`
2. Review results and identify top failing tests
3. Start fixing from highest impact issues
4. Track progress in this document

---

## Related Documentation
- `.claude/messaging-migration-queue.md` - Detailed task tracking (ALL COMPLETE)
- `CLAUDE.md` - Project guidelines
- `README.md` - General project overview
