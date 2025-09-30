# Visual Editor Unification Plan

This plan defines the final refactor to ensure a single Visual Editor implementation is used by both the extension and the Playwright tests. Tests will exercise the extension itself and programmatically open the sidebar (since Playwright cannot click the browser action icon) and then click the in-page "Visual Editor" button like a user. The end state removes all duplicate/legacy context menu code and avoids short-lived shims.

## Objectives

- Use the core Visual Editor under `src/visual-editor/` for both the extension and tests.
- Remove duplicate context menus and legacy editor code:
  - Remove `src/injected/modules/context-menu.ts` (and injected wiring).
  - Remove `src/content/visual-editor.ts` (legacy inline menu) after migrating any unique behavior.
- Provide a programmatic test trigger that calls into the content script to open/inject the sidebar; tests then click the "Visual Editor" button in-page.
- Keep core editor/browser code free of `chrome.*` dependencies.

## Target Architecture Overview

- **Core editor (authoritative):** `src/visual-editor/`
  - Context menu: `src/visual-editor/core/context-menu.ts`
  - Coordinator: `src/visual-editor/core/editor-coordinator.ts`
  - Visual Editor main: `src/visual-editor/core/visual-editor.ts`
  - UI/Styles/Utils under `src/visual-editor/ui/` and `src/visual-editor/utils/`
- **Extension content script:** `content.ts`
  - Imports core editor from `~src/visual-editor`
  - Receives messages via `chrome.runtime.onMessage`
  - NEW: also listens for `window.postMessage` in-page messages used by tests to start/stop the sidebar programmatically
- **Tests:**
  - Load a page with the extension enabled
  - Use `page.evaluate` to post a message to the page that the content script will handle to open/inject the sidebar
  - Wait for the sidebar DOM to appear, then click the in-page "Visual Editor" button (mirrors the user flow)
  - No page-injected standalone bundle and no injected modules

## Workplan (No code duplication; no shims)

### ✅ 1. Single source of truth for context menu (COMPLETED)

- ✅ Kept `src/visual-editor/core/context-menu.ts` as the canonical implementation
- ✅ Standardized actions & labels:
  - `edit` (label: Edit Text)
  - `editHtml` (label: Edit HTML)
  - `rearrange`, `resize`
  - `move-up`, `move-down`
  - `copy`, `copySelector`
  - `selectRelative`
  - `insert-block`
  - `hide`, `delete`
- ✅ Updated `src/visual-editor/core/editor-coordinator.ts` to use standardized action ids only (no legacy compatibility)

### ✅ 2. Remove duplicate/legacy menus (COMPLETED)

- ✅ Deleted `src/injected/modules/context-menu.ts` and entire `src/injected/` directory
- ✅ Deleted `src/content/visual-editor.ts` legacy editor

### ✅ 3. Programmatic sidebar trigger via content script (COMPLETED)

- ✅ Added `window.addEventListener('message', ...)` handler in `content.ts` for test control
- ✅ Support messages added but **NOT USED IN TESTS**:
  - Tests now directly inject sidebar as iframe (matching real extension behavior)
  - No need for `TEST_OPEN_SIDEBAR` message

### 🔄 4. Update Playwright E2E tests (IN PROGRESS)

**Current Status:**
- ✅ Created test page: `tests/test-pages/visual-editor-test.html`
- ✅ Updated test to inject sidebar as iframe directly (matching real extension behavior)
- ✅ Test navigates to experiment and clicks Visual Editor button
- ✅ Added `file://*/*` to host_permissions in package.json manifest
- ✅ Added `TEST_START_VISUAL_EDITOR` message handler in content.ts
- ⚠️ **BLOCKER**: Visual editor not starting - need to debug content script message handling
- ⚠️ Need to complete full workflow test with all 6 steps:

**Required Test Flow:**
1. ✅ Inject sidebar iframe into test page
2. ✅ Click first experiment in sidebar experiment list
3. ✅ Click "Visual Editor" button in sidebar
4. ❌ **TODO:** Test ALL context menu actions:
   - Edit Text (click element, right-click, select "Edit Text", type new text, press Enter)
   - Edit HTML (click element, right-click, select "Edit HTML", edit Monaco editor, click Save)
   - Hide (click element, right-click, select "Hide", verify element hidden)
   - Delete (click element, right-click, select "Delete", verify element removed)
   - Move up (click element, right-click, select "Move up", verify element moved)
   - Move down (click element, right-click, select "Move down", verify element moved)
   - Copy (click element, right-click, select "Copy")
   - Copy Selector Path (click element, right-click, select "Copy Selector Path")
   - Rearrange (click element, right-click, select "Rearrange", test drag/drop)
   - Resize (click element, right-click, select "Resize", test resize handles)
   - Select Relative Element (click element, right-click, select "Select Relative Element")
   - Insert new block (click element, right-click, select "Insert new block")
5. ❌ **TODO:** Click Save button in visual editor header/banner
6. ❌ **TODO:** Verify ALL changes appear in sidebar DOM changes Monaco editor:
   - Text changes (type: 'text')
   - Style changes (type: 'style' - from Hide action)
   - Delete changes (type: 'delete')
   - Move changes (type: 'move')
   - HTML changes (type: 'html')

**Test Files:**
- `tests/e2e/visual-editor-complete.spec.ts` - Simplified structure (needs implementation)
- `tests/e2e/visual-editor-unified.spec.ts` - Has complete implementation but messy duplicate code

**Next Steps:**
1. Implement full test with all context menu actions in `visual-editor-complete.spec.ts`
2. Add helper functions for common test operations (click element, right-click, select menu item)
3. Add assertions to verify each action works and creates correct DOM change
4. Verify save button works and changes appear in sidebar Monaco editor
5. Clean up old test files once complete test passes

### 🔄 5. Styles and UI consolidation (NEEDS VERIFICATION)

- ✅ Style injection centralized in `src/visual-editor/ui/styles.ts`
- ✅ Removed style injection from deleted legacy/injected files
- ❌ **TODO:** Validate z-indexes and overlay behavior in both extension and test flows

### ❌ 6. Validation & acceptance (NOT STARTED)

- ❌ Manual extension run validation needed
- ❌ Playwright full test run needed
- ✅ No references to `src/injected` or `src/content/visual-editor.ts` remain
- ❌ **TODO:** Verify no `chrome.*` usage exists in core/editor code paths

## File-by-File Changes (at high level)

- `src/visual-editor/core/context-menu.ts`
  - Keep and standardize action ids and labels
- `src/visual-editor/core/editor-coordinator.ts`
  - Map standardized action ids to handlers
  - Remove temporary dual-id support after tests updated
- `content.ts`
  - Add in-page `window.postMessage` handlers for test control (`TEST_OPEN_SIDEBAR`, optional `TEST_CLOSE_SIDEBAR`, `TEST_STATUS`) that only open/close the sidebar
  - Reuse existing editor start/stop logic that the sidebar button invokes (no new direct-start test message)
- Remove:
  - `src/injected/visual-editor-main.ts`
  - `src/injected/modules/context-menu.ts`
  - `src/content/visual-editor.ts` (or move to `legacy/` if you prefer to keep as reference)
- Tests (`tests/e2e/*.spec.ts`)
  - Replace any injected-bundle usage with programmatic window-message trigger
  - Update assertions to standardized actions/labels

## Risks & Mitigations

- **Risk:** Tests previously depended on injected bundles/paths
  - **Mitigation:** Update tests in the same PR; ensure CI runs a browser with the extension enabled
- **Risk:** Hidden coupling to `chrome.*` in core
  - **Mitigation:** Grep and remove; `chrome.*` must remain only in `content.ts` and background/service worker code
- **Risk:** UI/overlay z-index conflicts
  - **Mitigation:** Validate on diverse test pages and with common frameworks (Tailwind, React)

## Acceptance Criteria

- A single context menu implementation exists under `src/visual-editor/core/` and is used in both extension and tests
- Programmatic test trigger works reliably without clicking the extension icon
- All injected/legacy duplicates are removed
- All Playwright E2E tests pass without relying on page-injected bundles
- Manual QA via the extension shows identical or improved UX

## Post-Refactor Cleanup

- Verify no dead files or unused exports remain in `src/injected/` and root
- Update docs/readme to reflect the new testing trigger approach (sidebar open → button click)
- Ensure version bump and changelog entry for the unified architecture
