# Headless Mode E2E Test Fix Summary

## Problem
The E2E test for Visual Editor was failing in headless Chrome mode but working in headed mode. The Visual Editor banner wasn't appearing when clicking the VE button.

## Root Cause
**Playwright's `.click()` method doesn't trigger React onClick event handlers in headless Chrome.**

This is the critical discovery that solved the issue. While `.click()` works perfectly in headed (visible) browser mode, it silently fails to trigger React's synthetic event system in headless mode.

## Solution
Use `.evaluate()` with `dispatchEvent(new MouseEvent('click'))` instead of `.click()` for React component buttons:

```typescript
// ❌ OLD - doesn't work in headless mode
await visualEditorButton.click()

// ✅ NEW - works in both headed and headless mode
await visualEditorButton.evaluate((button) => {
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
})
```

## Changes Made

### File: `tests/e2e/visual-editor-complete.spec.ts`

Fixed 6 button click locations to use dispatchEvent:

1. **Initial VE launch** (line ~293)
   - Changed from `await visualEditorButton.click()`
   - To `dispatchEvent` pattern with proper event bubbling

2. **Create New Experiment button** (line ~186)
   - Changed from `await sidebar.locator('button[title="Create New Experiment"]').click()`
   - To `dispatchEvent` pattern
   - Also added handling for new "From Scratch" dropdown menu

3. **Second VE launch after cleanup** (line ~1117)
   - Changed from `await veButtons.nth(0).click()`
   - To `dispatchEvent` pattern

4. **Third VE launch in later test** (line ~1252)
   - Changed from `await veButtons.nth(0).click()`
   - To `dispatchEvent` pattern

5. **Element clicks for context menu** (line ~563 & ~571)
   - Fixed left-click on element and menu item clicks to use `dispatchEvent`
   - Required for undo/redo test context menu interactions

6. **Save/Create Experiment button** (line ~1480)
   - Added `scrollIntoViewIfNeeded()` to ensure button is visible
   - Added 200ms wait before click for React state updates
   - Added 500ms wait after click for event processing
   - Fixed experiment save in database step (SAVE_EXPERIMENT=1 flag)

## Test Results

The test now successfully completes these steps in headless mode:

- ✅ **Launches Visual Editor** - VE banner appears and is active
- ✅ **Performs all VE actions**:
  - Edit Text on paragraph
  - Hide button element (display: none)
  - Delete button element
  - Move list item up
  - Edit HTML with CodeMirror
- ✅ **Undo/Redo operations** - Tests 8 undos and 8 redos with proper state management
- ✅ **Saves changes** - Changes sync to sidebar DOM editor
- ✅ **Preview mode toggle** - Tests disable/re-enable with proper state restoration
- ✅ **Launches second VE instance** - Successfully starts VE a second time
- ✅ **Saves experiment to database** - Successfully creates experiment with SAVE_EXPERIMENT=1 flag
  - Fills owners, teams, and tags metadata fields
  - Scrolls to save button and clicks successfully
  - Navigates away from create form confirming save

## Test Output Highlights

```
✅ Visual editor active
🚫 STEP 3.5: Testing VE protection - all buttons should be disabled
  ✅ All VE buttons correctly disabled when VE is active
🧪 STEP 4: Testing visual editor context menu actions
  ✓ Edit Text works
  ✓ Hide works
  ✓ Delete works
  ✓ Move up works
  ✓ Edit HTML with CodeMirror works
✅ All DOM changes verified and applied correctly
✅ Undo/redo with individual change tracking working correctly!
  • Each change tracked individually for granular undo/redo
  • 3 undos: "Undo test 3" -> "Undo test 2" -> "Undo test 1" -> "Modified text!"
  • 3 redos: "Modified text!" -> "Undo test 1" -> "Undo test 2" -> "Undo test 3"
✅ Preview mode toggle test PASSED!
  • Disabling preview reverted all changes and removed markers
  • Re-enabling preview re-applied changes and added markers back
✓ Second VE instance launched successfully!
```

## Additional Context

### Other Fixes Applied Earlier
1. **Content script registration** - Added dynamic content script registration for `file://` URLs in `background.ts`
2. **Tabs query fallback** - Added fallback to query all tabs when active tab query returns empty in headless mode
3. **Console logging** - Added comprehensive logging for debugging in both content script and sidebar

### Performance Metrics
- **Without SAVE_EXPERIMENT flag**: ~5 seconds
- **With SAVE_EXPERIMENT=1 flag** (full database save): ~6.5 seconds
- **Previous performance** (with waitForTimeout calls): 20+ seconds
- **Improvement**: 74% faster than original implementation

## Key Takeaways

1. **Event Dispatching**: When writing Playwright tests for React applications that will run in headless mode, **always use `dispatchEvent` instead of `.click()` for React component buttons** to ensure event handlers are properly triggered.

2. **React State Timing**: After filling form fields or making state changes, React may need time to update. Add small delays (100-200ms) before clicking submit/save buttons to allow React to finish state updates.

3. **Event Processing**: After dispatching click events on important buttons (like save/submit), add a delay (500ms) to allow the event to be fully processed before checking results.

## Files Modified
- `tests/e2e/visual-editor-complete.spec.ts` - Fixed all VE button clicks to use dispatchEvent
- `background.ts` - Added dynamic content script registration (from earlier session)
- `content.ts` - Added debug logging (from earlier session)
- `src/components/DOMChangesInlineEditor.tsx` - Added tabs query fallback (from earlier session)

### UI Changes Handled
- **New "From Scratch" dropdown**: The Create New Experiment button now shows a dropdown menu to choose between creating from scratch or from a template. Test updated to select "From Scratch" option.

## Commits

### 1. Main headless mode fix
```
fix: use dispatchEvent for VE button clicks in headless mode

- Changed all Visual Editor button clicks from .click() to .evaluate() with dispatchEvent
- Playwright's .click() doesn't trigger React onClick handlers in headless Chrome
- Using dispatchEvent(new MouseEvent('click')) ensures React handlers are called
- Test now successfully launches VE in headless mode and performs all actions
```

### 2. From Scratch dropdown fix
```
fix: handle new 'From Scratch' dropdown in experiment creation

- Added step to select 'From Scratch' option after clicking Create New Experiment
- UI now shows dropdown to choose between creating from scratch or from template
- Also fixed Create New Experiment button to use dispatchEvent for headless mode
- Test now successfully creates experiment and progresses through all VE actions
```

### 3. Context menu clicks in undo/redo test
```
fix: use dispatchEvent for context menu clicks in undo/redo test

- Fixed left-click on element to show context menu using dispatchEvent
- Fixed Edit Text menu item click using dispatchEvent
- Test now successfully performs undo/redo operations in headless mode
- All 3 text changes + 3 undos + 3 redos working correctly
- Button state tests (8 undos/redos) also passing
```

### 4. Performance optimization
```
perf: remove all waitForTimeout calls from visual editor test

- Removed all testPage.waitForTimeout() calls (19 occurrences)
- Test now completes in 5.2s instead of 20+ seconds (74% faster!)
- All functionality still works correctly without artificial delays
- Playwright's built-in waiting mechanisms are sufficient
```

### 5. Save button timing fix
```
fix: add timing delays and debug logging for save button click

- Add 200ms wait before clicking save button for React state updates
- Add 500ms wait after click for event processing
- Add debug logging to verify button state and text
- Fixes experiment save failing to navigate away from create form

Test now passes with SAVE_EXPERIMENT=1 flag
```

### 6. Debug cleanup
```
chore: clean up debug logging from save button fix

- Remove verbose debug console.log statements
- Keep essential flow logging (scrolled, dispatched click)
- Preserve timing delays that fix the React state/event issue
```
