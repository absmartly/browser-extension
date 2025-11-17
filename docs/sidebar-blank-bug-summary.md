# Sidebar Blank Bug - Quick Summary

## The Problem

**When:** Turning off preview mode with global selectors (`body`, `h1`, `button`, etc.)
**What:** Sidebar goes completely blank
**Why:** PreviewManager's `querySelectorAll()` matches sidebar container elements and removes/modifies them

## Root Cause

```typescript
// File: src/sdk-bridge/dom/preview-manager.ts, Line 61
const elements = document.querySelectorAll(change.selector)
```

**Issue:** No filtering to exclude sidebar elements from DOM operations!

When selector is `body` or `div`:
1. Sidebar container (`#absmartly-sidebar-root`) is matched
2. Original state is captured (including sidebar in `innerHTML`)
3. On preview removal, body is restored to state BEFORE sidebar existed
4. Sidebar container gets removed from DOM
5. Sidebar goes blank 💥

## The Fix

Add element filtering to exclude sidebar elements:

```typescript
// Add to PreviewManager class
private shouldExcludeElement(element: Element): boolean {
  if (element.id === 'absmartly-sidebar-root' ||
      element.id === 'absmartly-sidebar-iframe') {
    return true
  }

  const sidebarContainer = document.getElementById('absmartly-sidebar-root')
  if (sidebarContainer && sidebarContainer.contains(element)) {
    return true
  }

  return false
}

// Apply in applyPreviewChange (Line 61)
const allElements = document.querySelectorAll(change.selector)
const elements = Array.from(allElements).filter(el => !this.shouldExcludeElement(el))

// Apply in removePreviewChanges (Line 311)
const allMarkedElements = document.querySelectorAll(...)
const markedElements = Array.from(allMarkedElements).filter(el => !this.shouldExcludeElement(el))
```

## Files to Modify

1. **Primary Fix:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/src/sdk-bridge/dom/preview-manager.ts`
   - Add `shouldExcludeElement()` method
   - Apply filter at line 61 (applyPreviewChange)
   - Apply filter at line 311 (removePreviewChanges)

2. **Verification Logging:** Same file, add logging to verify filtering works

3. **Optional:** `/Users/joalves/git_tree/ext-dev1-claude-sdk/content.ts`
   - Add sidebar presence monitoring for early detection

## Test Cases

| Selector | Risk | Should Work After Fix |
|----------|------|----------------------|
| `body` | 🔴 Critical | ✅ Yes |
| `div` | 🔴 Critical | ✅ Yes |
| `h1` | 🟡 Medium | ✅ Yes |
| `button` | 🟡 Medium | ✅ Yes |
| `[data-framer-name='Hero']` | 🟢 Low | ✅ Already works |

## Why This Wasn't Caught

- Most tests use specific selectors
- Global selectors are uncommon in practice
- Bug only appears when preview is turned OFF
- No JavaScript errors (silent failure)

## Implementation Steps

1. Add `shouldExcludeElement()` method
2. Apply filter in `applyPreviewChange()`
3. Apply filter in `removePreviewChanges()`
4. Add logging to verify
5. Test with global selectors
6. Rebuild extension: `npm run build:dev`
7. Run E2E tests to verify fix

## Success Criteria

- ✅ Preview ON with global selectors works
- ✅ Preview OFF with global selectors works
- ✅ Sidebar stays visible throughout
- ✅ No JavaScript errors
- ✅ No regression with specific selectors
