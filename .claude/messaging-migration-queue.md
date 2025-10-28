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

#### Task 3: VariantConfigJSONEditor.tsx (2 locations) - DONE ✅
**File**: src/components/VariantConfigJSONEditor.tsx
**Locations**:
- Line 40: `sendToContent` with OPEN_JSON_EDITOR ✅
- Line 94: `sendToContent` with CLOSE_JSON_EDITOR ✅

**Status**: DONE
**Assigned to**: Claude (already migrated)

---

#### Task 4: CustomCodeEditor.tsx (2 locations) - DONE ✅
**File**: src/components/CustomCodeEditor.tsx
**Locations**:
- Line 71: `sendToContent` with OPEN_CODE_EDITOR ✅
- Line 129: `sendToContent` with CLOSE_CODE_EDITOR ✅

**Status**: DONE
**Assigned to**: Claude (already migrated)

---

#### Task 5: ExperimentDetail.tsx & ExperimentEditor.tsx (4 locations) - DONE ✅
**Files**: src/components/ExperimentDetail.tsx and src/components/ExperimentEditor.tsx
**Locations**:
- ExperimentDetail.tsx: `sendToContent` with STOP_VISUAL_EDITOR ✅
- ExperimentDetail.tsx: `sendToContent` with ABSMARTLY_PREVIEW (remove) ✅
- ExperimentEditor.tsx: `sendToContent` with STOP_VISUAL_EDITOR ✅
- ExperimentEditor.tsx: `sendToContent` with ABSMARTLY_PREVIEW (update) ✅

**Status**: DONE
**Assigned to**: Claude (already migrated)

---

#### Task 6: VariantList.tsx (2 locations) - DONE ✅
**File**: src/components/VariantList.tsx
**Locations**:
- Line 193: `sendToContent` with ABSMARTLY_PREVIEW (remove) ✅
- Line 279: `sendToContent` with ABSMARTLY_PREVIEW (update) ✅

**Status**: DONE
**Assigned to**: Claude (already migrated)

---

#### Task 7: SettingsView.tsx (1 location) - DONE ✅
**File**: src/components/SettingsView.tsx
**Locations**:
- Line 258: `sendToBackground` with CHECK_AUTH ✅

**Status**: DONE
**Assigned to**: Claude (already migrated)

---

#### Task 8: EventsDebugPage.tsx (3 locations) - DONE ✅
**File**: src/components/EventsDebugPage.tsx
**Locations**:
- Line 38: `sendToBackground` with GET_BUFFERED_EVENTS ✅
- Line 100: `sendToBackground` with CLEAR_BUFFERED_EVENTS ✅
- Line 112: `sendToContent` with OPEN_EVENT_VIEWER ✅

**Status**: DONE
**Assigned to**: Claude (already migrated)

---

### CLEANUP TASKS

#### Task 9: Remove test mode setup calls - DONE ✅
**Files**:
- content.ts: No references found (cleanup complete) ✅
- tabs/sidebar.tsx: Removed setupMessageListener import and iframe polyfill (lines 3, 10-21) ✅

**Status**: DONE
**Assigned to**: Claude

---

#### Task 10: Remove FORWARD_TO_CONTENT_SCRIPT handler - DONE ✅
**File**: background/main.ts
**Status**: Verified removed (no references found) ✅

**Status**: DONE
**Assigned to**: Claude

---

## Summary
- **Total Tasks**: 10
- **Total Component Locations**: 25+
- **Status**: ALL COMPLETE ✅
- **Completion Date**: Completed in previous session
- **All messaging migrations verified working in visual-editor-complete.spec.ts E2E test**

---

## Notes
- All files need: `import { sendToContent, sendToBackground, broadcastToExtension } from '~src/lib/messaging'`
- Convert callbacks to async/await: `sendMessage(msg, callback)` → `const response = await sendMessage(msg)`
- Preserve all message data structure, just change HOW they're sent
- Use try/catch for error handling (helpers throw on error)
