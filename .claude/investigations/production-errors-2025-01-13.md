# Production Error Investigation - 2025-01-13

## Executive Summary

**Status**: CRITICAL - Multiple production errors causing complete extension failure

**Root Causes Identified**:
1. Missing import of `sendMessage` function in DOMChangesInlineEditor.tsx (line 634)
2. Possible message routing issues between sidebar, content script, and background
3. Race condition in HTML capture when extension tabs are active

## Error 1: ReferenceError - sendMessage is not defined

### Location
- File: `src/components/DOMChangesInlineEditor.tsx`
- Line: 634
- Function: `handleLaunchVisualEditorInner()`

### Code Context
```typescript
// Line 634 - BROKEN CODE
sendMessage({ type: 'PING' }, (response) => {
  debugLog('PING response:', response)
})
```

### Problem
The file imports messaging functions at line 6:
```typescript
import { sendToContent, sendToBackground } from '~src/lib/messaging'
```

However, at line 634, the code attempts to call `sendMessage()` which:
- **Is not imported**
- **Does not exist in the messaging module**
- **Was likely leftover debug code or from a refactoring**

### Impact
- Crashes immediately when user clicks "Launch Visual Editor" button
- Prevents ANY Visual Editor functionality from working
- Blocks all DOM manipulation features

### Fix Required
**Option 1 (Remove)**: Delete the debug PING test entirely (lines 633-636)
```typescript
// Delete these lines:
// Test if we can send any message at all
sendMessage({ type: 'PING' }, (response) => {
  debugLog('PING response:', response)
})
```

**Option 2 (Fix)**: Use the correct messaging function
```typescript
// Replace with:
sendToBackground({ type: 'PING' }).then(response => {
  debugLog('PING response:', response)
}).catch(err => {
  debugError('PING failed:', err)
})
```

**Recommendation**: Option 1 (Remove) - This is debug code that shouldn't be in production.

---

## Error 2: "Could not establish connection. Receiving end does not exist"

### Context
This error occurs during HTML capture in production, but E2E tests pass successfully.

### Analysis

#### Where HTML Capture is Used
File: `src/utils/html-capture.ts`

The function attempts to:
1. Query all tabs in current window
2. Find first non-extension tab
3. Send `CAPTURE_HTML` message to content script

#### Recent Changes (Commit 1e1ef8b7)
Enhanced logging was added to diagnose "Failed to capture HTML" errors:
- Added extensive console.log statements
- Changed from `active: true` query to finding first non-extension tab
- Better error handling for edge cases

#### Why E2E Tests Pass
Tests likely:
- Run in controlled environment with proper tab setup
- Don't have extension sidebar as active tab
- Have content script fully loaded before messages are sent

#### Why Production Fails
Possible scenarios:
1. **Race Condition**: Content script not fully initialized when message is sent
2. **Extension Tab Active**: When sidebar is open, chrome.tabs.query might behave differently
3. **Message Routing**: The content script message listener (line 268 in content.ts) handles `CAPTURE_HTML`, but:
   - Content script may not be injected on some pages
   - Message may be sent before content script loads

### Content Script Registration
File: `content.ts` (lines 247-279)

```typescript
// Line 268-279: CAPTURE_HTML handler
if (message.type === 'CAPTURE_HTML') {
  console.log('%c[ABsmartly] 📸 CAPTURE_HTML REQUEST RECEIVED', ...)
  try {
    const html = document.documentElement.outerHTML
    sendResponse({ success: true, html })
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message })
  }
  return true
}
```

This handler is registered correctly, but:
- Content script runs at `document_start` (line 22)
- Message might be sent before listener is registered
- No verification that content script is ready

### Potential Issues

#### Issue 2a: Timing Race Condition
```typescript
// html-capture.ts line 37
const response = await chrome.tabs.sendMessage(contentTab.id, {
  type: 'CAPTURE_HTML'
})
```

If content script hasn't finished loading, this will fail with "receiving end does not exist".

#### Issue 2b: Tab Selection Logic
```typescript
// html-capture.ts lines 21-26
const contentTab = allTabs.find(t =>
  t.url &&
  !t.url.startsWith('chrome-extension://') &&
  !t.url.startsWith('chrome://') &&
  !t.url.startsWith('about:')
)
```

This finds the FIRST non-extension tab, but:
- Might not be the tab user expects
- Tab might not have content script loaded yet
- No verification of content script status

### Fix Required

**Immediate Fix**: Add content script ready check before sending message

```typescript
// In html-capture.ts
export async function capturePageHTML(): Promise<string> {
  // ... existing tab finding logic ...

  // NEW: Verify content script is loaded
  try {
    await chrome.tabs.sendMessage(contentTab.id, { type: 'PING' })
  } catch (error) {
    // Content script not loaded - inject it
    await chrome.scripting.executeScript({
      target: { tabId: contentTab.id },
      files: ['content.js']
    })
    // Wait for content script to initialize
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Now send CAPTURE_HTML
  const response = await chrome.tabs.sendMessage(contentTab.id, {
    type: 'CAPTURE_HTML'
  })
  // ... rest of code ...
}
```

**Better Fix**: Add explicit ready signal from content script

```typescript
// In content.ts - add at startup
chrome.runtime.sendMessage({
  type: 'CONTENT_SCRIPT_READY',
  tabId: chrome.runtime.id
}).catch(() => {
  // Background script not ready yet - that's OK
})

// In background - track ready content scripts
const readyContentScripts = new Set<number>()
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'CONTENT_SCRIPT_READY') {
    readyContentScripts.add(msg.tabId)
  }
})

// In html-capture.ts - check if ready first
if (!readyContentScripts.has(contentTab.id)) {
  throw new Error('Content script not ready on target page')
}
```

---

## Error 3: Message Routing Architecture Issues

### Current Architecture

**Sidebar (sidebar.tsx)**
- Runs in extension context
- Uses `sendToContent()` and `sendToBackground()` from messaging.ts

**Content Script (content.ts)**
- Runs in page context
- Listens for chrome.runtime.onMessage
- Has special test mode handling with iframe bridge (lines 36-97)

**Background (main.ts)**
- Central message hub
- Validates sender (lines 82-91)
- Routes messages (lines 96-113)

### Test Mode vs Production Mode

#### Test Mode (E2E)
- Sidebar loaded in iframe
- Messages use window.postMessage
- Content script bridges messages (lines 99-145)
- Works because all parts are synchronized

#### Production Mode
- Sidebar loaded in extension context
- Messages use chrome.runtime.sendMessage
- Direct communication with content script
- Can fail if content script not ready

### Why Tests Pass But Production Fails

1. **Test Setup**: Tests explicitly wait for content script to load
2. **Synchronous Loading**: Tests load sidebar and content together
3. **No Tab Switching**: Tests run on single page
4. **Controlled Environment**: No user navigation or race conditions

Production has:
- User can open sidebar on any page
- Content script may not be loaded yet
- Tab switching creates timing issues
- Extension tabs confuse message routing

---

## Recommended Fixes - Priority Order

### 1. IMMEDIATE (Blocks all functionality)
**Fix `sendMessage` error in DOMChangesInlineEditor.tsx**
- Remove lines 633-636 (debug PING code)
- Test: Verify Visual Editor can launch

### 2. HIGH (Prevents AI features)
**Fix HTML capture race condition**
- Add content script ready check
- Inject content script if not present
- Add retry logic with timeout
- Test: Verify AI generation works in production

### 3. MEDIUM (Architecture improvement)
**Add message delivery verification**
- Content script sends ready signal on load
- Background tracks which tabs have content script
- Sidebar checks readiness before sending messages
- Better error messages for user

### 4. LOW (Nice to have)
**Improve error handling**
- More specific error messages
- User-friendly notifications
- Automatic recovery attempts

---

## Testing Strategy

### Manual Testing Required
1. **Fresh install test**: Install extension in clean profile
2. **Launch Visual Editor**: On various pages (with/without reload)
3. **AI Generation**: Test on multiple pages
4. **Tab switching**: Open sidebar, switch tabs, test features

### E2E Tests to Add
1. **Content script readiness**: Test messages before content loads
2. **Race conditions**: Rapid-fire button clicks
3. **Tab scenarios**: Multiple tabs, switching, closing
4. **Error recovery**: Simulate failures and verify recovery

---

## Related Files to Review

### High Priority
- `src/components/DOMChangesInlineEditor.tsx` - Main error location
- `src/utils/html-capture.ts` - HTML capture logic
- `content.ts` - Message listeners
- `background/main.ts` - Message routing

### Medium Priority
- `src/lib/messaging.ts` - Messaging utilities
- `src/contents/sidebar.tsx` - Sidebar initialization
- Tests comparing E2E vs production behavior

---

## Questions for User

1. What specific user action triggers the "receiving end" error?
2. Does the error occur on all pages or specific ones?
3. Does reloading the page fix it temporarily?
4. Are there any console errors before the main error?

---

## Timeline of Changes

Recent commits that may have introduced issues:
- `cd6b8c4b` - Revert AI page restoration (might have left broken code)
- `1e1ef8b7` - Enhanced HTML capture logging (exposed race condition)
- `4a06f9e4` - HTML capture tab filtering (changed behavior)

The `sendMessage` error is likely from commit cd6b8c4b where code was reverted but left
behind a debug statement that wasn't properly cleaned up.
