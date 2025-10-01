# Investigation: Visual Editor Test Failure

## Problem
The E2E test `visual-editor-complete.spec.ts` was failing at "STEP 6: Verifying changes in sidebar" - DOM change cards were not appearing in the sidebar after saving changes from the visual editor.

## Investigation Process

### Initial Hypothesis (Incorrect)
Initially suspected the message relay code in `background.ts` was commented out, preventing messages from reaching the sidebar. This was a red herring.

### Key Discovery
The test was passing in commit `e86db3e` (when first added) and failing in commit `ca254bf` (and all subsequent commits).

## Root Cause

### Commit e86db3e (PASSING) - Test Added
In `src/components/DOMChangesInlineEditor.tsx`, the `VISUAL_EDITOR_CHANGES_COMPLETE` message handler:

```typescript
else if (message.type === 'VISUAL_EDITOR_CHANGES_COMPLETE' && message.variantName === variantName) {
  debugLog('✅ Visual Editor Complete - Received changes:', message)

  if (message.changes && Array.isArray(message.changes) && message.changes.length > 0) {
    // Merge new changes with existing ones
    const mergedChanges = [...changes, ...message.changes]

    // Update the parent component - THIS UPDATES THE UI
    onChange(mergedChanges)

    // NO onVEStop() call here
  }
}
```

**Key points:**
- Processes changes immediately
- Calls `onChange()` to update parent component
- Does NOT call `onVEStop()` at all

### Commit ca254bf (FAILING) - "fix: prevent duplicate Visual Editor launches across variants"
The same handler was changed to:

```typescript
else if (message.type === 'VISUAL_EDITOR_CHANGES_COMPLETE' && message.variantName === variantName) {
  debugLog('✅ Visual Editor Complete - Received changes:', message)

  // Mark VE as stopped for this variant - CALLED TOO EARLY!
  onVEStop()

  if (message.changes && Array.isArray(message.changes) && message.changes.length > 0) {
    // Process changes...
    onChange(mergedChanges)
  }
}
```

**The bug:**
Calling `onVEStop()` **before** `onChange()` causes the component to update its state (setting `activeVEVariant` to `null` in the parent) before the changes are processed. This likely triggers a re-render that prevents the DOM change cards from appearing.

## Message Flow (for reference)

1. Visual editor sends `VISUAL_EDITOR_CHANGES` during editing (incremental updates)
2. Content script receives these via `onChangesUpdate` callback
3. Content script forwards via `chrome.runtime.sendMessage({ type: 'VISUAL_EDITOR_CHANGES' })`
4. `DOMChangesInlineEditor` listens for `VISUAL_EDITOR_CHANGES` and updates immediately
5. When user clicks "Save" in VE, content script sends `VISUAL_EDITOR_CHANGES_COMPLETE`
6. `DOMChangesInlineEditor` should process final changes THEN call `onVEStop()`

## Solution

Move `onVEStop()` call to **after** `onChange()` is called, ensuring changes are processed and rendered before marking the visual editor as stopped.

```typescript
else if (message.type === 'VISUAL_EDITOR_CHANGES_COMPLETE' && message.variantName === variantName) {
  debugLog('✅ Visual Editor Complete - Received changes:', message)

  if (message.changes && Array.isArray(message.changes) && message.changes.length > 0) {
    // Process changes FIRST
    const mergedChanges = [...changes, ...message.changes]
    onChange(mergedChanges)
  }

  // Mark VE as stopped AFTER processing changes
  onVEStop()
}
```

## Lessons Learned

1. **Order matters**: State updates that trigger re-renders should happen after critical data updates
2. **Git bisection is valuable**: Comparing passing and failing commits reveals the exact change that broke functionality
3. **Test coverage is important**: The E2E test caught this regression immediately
4. **Don't assume**: The commented-out message relay code was not the issue - actual message flow was working via `chrome.runtime.sendMessage` directly
