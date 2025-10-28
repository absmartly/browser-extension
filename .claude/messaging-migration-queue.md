# Messaging Migration Task Queue

## Context
Migrate all components to use three new messaging helper functions instead of direct chrome API calls:
- `sendToContent(message)` - for messages to content script
- `sendToBackground(message)` - for messages to background script
- `broadcastToExtension(message)` - for broadcast to all extension pages

All helpers are in `src/lib/messaging.ts` and throw errors on failure (use try/catch).

**HOW TO USE THIS QUEUE:**
1. Agents should pick the FIRST PENDING task from the list below
2. Mark it as TAKEN by your agent, update the file
3. Complete the task
4. Mark it as DONE, update the file
5. Move to next PENDING task

---

## Task Queue (in priority order)

### COMPONENT MIGRATION TASKS

#### Task 1: DOMChangesInlineEditor.tsx (5 locations) - DONE ✅
**File**: src/components/DOMChangesInlineEditor.tsx
**Locations**:
- Line 131-133: `sendToContent` with START_ELEMENT_PICKER ✅
- Line 580-583: `sendToContent` with SET_VISUAL_EDITOR_STARTING ✅
- Line 629-634: `sendToContent` with START_VISUAL_EDITOR ✅
- Line 697-699: `sendToContent` with START_DRAG_DROP_PICKER ✅
- Line 724-726: `sendToContent` with START_ELEMENT_PICKER ✅

**Status**: DONE
**Assigned to**: Claude (already migrated)

---

#### Task 2: DOMChangeEditor.tsx (1 location) - DONE ✅
**File**: src/components/DOMChangeEditor.tsx
**Locations**:
- Line 713-718: `sendToContent` with OPEN_JAVASCRIPT_EDITOR ✅

**Status**: DONE
**Assigned to**: Claude (already migrated)

---

#### Task 3: VariantConfigJSONEditor.tsx (2 locations) - PENDING
**File**: src/components/VariantConfigJSONEditor.tsx
**Locations**:
- Line 40: `chrome.tabs.sendMessage` with OPEN_JSON_EDITOR → `await sendToContent({type: 'OPEN_JSON_EDITOR', data: {...}})`
- Line 94: `chrome.tabs.sendMessage` with CLOSE_JSON_EDITOR → `await sendToContent({type: 'CLOSE_JSON_EDITOR'})`

**Status**: PENDING
**Assigned to**: (waiting for agent)

---

#### Task 4: CustomCodeEditor.tsx (2 locations) - PENDING
**File**: src/components/CustomCodeEditor.tsx
**Locations**:
- Line 71: `chrome.tabs.sendMessage` with OPEN_CODE_EDITOR → `await sendToContent({type: 'OPEN_CODE_EDITOR', data: {...}})`
- Line 129: `chrome.tabs.sendMessage` with CLOSE_CODE_EDITOR → `await sendToContent({type: 'CLOSE_CODE_EDITOR'})`

**Status**: PENDING
**Assigned to**: (waiting for agent)

---

#### Task 5: ExperimentDetail.tsx & ExperimentEditor.tsx (4 locations) - PENDING
**Files**: src/components/ExperimentDetail.tsx and src/components/ExperimentEditor.tsx
**Locations**:
- ExperimentDetail.tsx Line 177: `chrome.tabs.sendMessage` with STOP_VISUAL_EDITOR → `await sendToContent({type: 'STOP_VISUAL_EDITOR'})`
- ExperimentDetail.tsx Line 182: `chrome.tabs.sendMessage` with ABSMARTLY_PREVIEW (remove) → `await sendToContent({type: 'ABSMARTLY_PREVIEW', action: 'remove', ...})`
- ExperimentEditor.tsx Line 177: `chrome.tabs.sendMessage` with STOP_VISUAL_EDITOR → `await sendToContent({type: 'STOP_VISUAL_EDITOR'})`
- ExperimentEditor.tsx Line 183: `chrome.tabs.sendMessage` with ABSMARTLY_PREVIEW (update) → `await sendToContent({type: 'ABSMARTLY_PREVIEW', action: 'update', ...})`

**Status**: PENDING
**Assigned to**: (waiting for agent)

---

#### Task 6: VariantList.tsx (2 locations) - PENDING
**File**: src/components/VariantList.tsx
**Locations**:
- Line 193: `chrome.tabs.sendMessage` with ABSMARTLY_PREVIEW (remove) → `await sendToContent({type: 'ABSMARTLY_PREVIEW', action: 'remove', ...})`
- Line 279: `chrome.tabs.sendMessage` with ABSMARTLY_PREVIEW (update) → `await sendToContent({type: 'ABSMARTLY_PREVIEW', action: 'update', ...})`

**Status**: PENDING
**Assigned to**: (waiting for agent)

---

#### Task 7: SettingsView.tsx (1 location) - PENDING
**File**: src/components/SettingsView.tsx
**Locations**:
- Line 258: `chrome.runtime.sendMessage` with CHECK_AUTH → `const response = await sendToBackground({type: 'CHECK_AUTH', requestId, configJson})`

**Status**: PENDING
**Assigned to**: (waiting for agent)

---

#### Task 8: EventsDebugPage.tsx (3 locations) - PENDING
**File**: src/components/EventsDebugPage.tsx
**Locations**:
- Line 38: `chrome.runtime.sendMessage` with GET_BUFFERED_EVENTS → `const response = await sendToBackground({type: 'GET_BUFFERED_EVENTS'})`
- Line 100: `chrome.runtime.sendMessage` with CLEAR_BUFFERED_EVENTS → `await sendToBackground({type: 'CLEAR_BUFFERED_EVENTS'})`
- Line 112: `chrome.tabs.sendMessage` with OPEN_EVENT_VIEWER → `await sendToContent({type: 'OPEN_EVENT_VIEWER', data: {...}})`

**Status**: PENDING
**Assigned to**: (waiting for agent)

---

### CLEANUP TASKS

#### Task 9: Remove test mode setup calls - PENDING
**Files**:
- content.ts line 39: Remove `setupContentScriptMessageListener()`
- tabs/sidebar.tsx line 13: Remove `setupMessageResponseHandler()`

**Status**: PENDING
**Assigned to**: (waiting for agent)

---

#### Task 10: Remove FORWARD_TO_CONTENT_SCRIPT handler - PENDING
**File**: background/main.ts
**Locations**: Lines 202-222 (the handler that was added in the refactor)

**Status**: PENDING
**Assigned to**: (waiting for agent)

---

## Summary
- **Total Tasks**: 10
- **Total Component Locations**: 25+
- **Status**: All PENDING
- **Agents Needed**: 5 specialized agents

---

## Notes
- All files need: `import { sendToContent, sendToBackground, broadcastToExtension } from '~src/lib/messaging'`
- Convert callbacks to async/await: `sendMessage(msg, callback)` → `const response = await sendMessage(msg)`
- Preserve all message data structure, just change HOW they're sent
- Use try/catch for error handling (helpers throw on error)
