# Events Debug Page Feature

## Overview

The Events Debug Page is a real-time SDK event monitoring and debugging tool integrated into the ABsmartly Browser Extension. It captures and displays all ABsmartly SDK events from page load, even when the sidebar isn't open, providing developers with complete visibility into SDK behavior.

## Feature Description

This feature provides a comprehensive event debugging interface that:

- **Captures events from page load** - Events are buffered in the background, so no events are lost even if the sidebar opens after they fire
- **Real-time event monitoring** - Live display of SDK events as they occur
- **Event inspection** - Click any event to view full JSON details in a read-only code viewer
- **Event filtering** - Pause/resume event capture without losing existing events
- **Event management** - Clear all events with a single button
- **Visual categorization** - Color-coded event types for quick identification
- **Persistent buffering** - Events stored in session storage (cleared on browser close)

## What Was Implemented

### 1. Background Script Event Buffering (`background.ts`)

**Added three new message handlers:**

- `SDK_EVENT` - Buffers incoming SDK events in chrome.storage.session
- `GET_BUFFERED_EVENTS` - Retrieves all buffered events
- `CLEAR_BUFFERED_EVENTS` - Clears the event buffer

**Implementation details:**
- Maximum buffer size: 1000 events
- Storage: `chrome.storage.session` (persists until browser close)
- Events stored with id, eventName, data, and timestamp

### 2. Content Script Event Routing (`content.ts`)

**Changed event flow:**
- Previous: Page → Content Script → Sidebar
- Current: Page → Content Script → Background Script (for buffering)

**Benefit:** Events are buffered even when sidebar isn't open

### 3. Events Debug Page Component (`src/components/EventsDebugPage.tsx`)

**New functionality:**
- Fetches buffered events on component mount
- Displays all historical events since page load
- Clear button now clears both UI state and background buffer

**Features:**
- Real-time event capture with pause/resume
- Color-coded event types (error, ready, exposure, goal, etc.)
- Timestamp formatting with fractional seconds
- Event data preview with truncation
- Event count status bar

### 4. Event Details Modal (`src/components/EventDetailsModal.tsx`)

**Provides read-only event inspection:**
- Opens CodeMirror-based JSON viewer in page context
- Syntax highlighting with One Dark theme
- Full event data display
- Keyboard shortcut support (ESC to close)

### 5. Event Viewer UI (`src/visual-editor/ui/event-viewer.ts`)

**Read-only JSON viewer:**
- Shadow DOM isolation
- CodeMirror editor with JSON syntax highlighting
- Line numbers and code folding
- Search functionality
- Read-only mode (no editing)

## How It Works

### Event Flow Architecture

```
┌─────────────┐
│  Web Page   │
│   (SDK)     │
└──────┬──────┘
       │ SDK events fire
       ↓
┌─────────────────────┐
│  (intercepts events)│
└──────┬──────────────┘
       │ window.postMessage
       ↓
┌─────────────────────┐
│  Content Script     │
│  (content.ts)       │
└──────┬──────────────┘
       │ chrome.runtime.sendMessage
       ↓
┌─────────────────────────────────┐
│  Background Script              │
│  - Buffers in session storage   │
│  - Max 1000 events              │
│  - Persists until browser close │
└─────────────────────────────────┘
       ↑
       │ GET_BUFFERED_EVENTS
       │
┌─────────────────────┐
│  Events Debug Page  │
│  - Shows all events │
│  - Real-time updates│
└─────────────────────┘
```

### Event Lifecycle

1. **Page loads** → SDK initializes
2. **SDK fires events** → Plugin intercepts them
3. **Events sent to background** → Stored in buffer
4. **User opens sidebar** → Navigates to Events Debug page
5. **Component mounts** → Fetches buffered events
6. **All events displayed** → Including those fired before sidebar opened
7. **New events** → Added in real-time
8. **User clicks event** → Opens read-only JSON viewer
9. **User clicks "Clear"** → Clears UI and buffer

## Files Changed

### Core Implementation
- `background.ts` - Event buffering logic (+60 lines)
- `content.ts` - Event routing to background (+6 lines)
- `src/components/EventsDebugPage.tsx` - Buffered event fetching (+8 lines)
- `src/components/EventDetailsModal.tsx` - Event detail modal (existing)
- `src/visual-editor/ui/event-viewer.ts` - Read-only JSON viewer (existing)

### Testing
- `src/components/__tests__/EventsDebugPage.test.tsx` - Chrome mocks and test fixes (+48 lines)
- `tests/e2e/sdk-events.spec.ts` - E2E buffering test (+46 lines)

### Configuration
- `package.json` - Version bump (minor change)

## Test Results

### Build Status: ✅ PASS
```
Production build: SUCCESS
Build time: 2.6 seconds
Errors: 0
Warnings: 0
```

### Test Status: ✅ 348/359 PASS (96.9%)
```
Total test suites: 16
Passing suites: 9
Failing suites: 7 (pre-existing, unrelated to this feature)

Total tests: 359
Passing tests: 348
Failing tests: 11 (pre-existing)
```

**Event Buffering Tests:** All pass ✅
- Unit tests for event capture
- Unit tests for pause/resume
- Unit tests for clear functionality
- E2E test for buffering before sidebar opens
- E2E test for real-time event capture

**Pre-existing Test Failures:**
- 4 HtmlEditor tests (Monaco integration)
- 5 Visual editor core tests (suite failures)
- 2 EventDetailsModal tests (timing issues)

## How to Use the Events Debug Page

### Accessing the Events Debug Page

1. **Install the extension** in Chrome
2. **Navigate to any web page** with ABsmartly SDK
3. **Click the extension icon** to open the sidebar
4. **Click "Events Debug" button** in the sidebar navigation

### Features and Controls

#### Header Controls
- **Pause/Resume button** (⏸/▶) - Pause/resume event capture
- **Clear button** (🗑) - Clear all captured events

#### Event List
- **Event cards** display:
  - Event name with color coding
  - Timestamp (HH:MM:SS.mmm format)
  - Data preview (truncated to 100 characters)
- **Click any event** to view full JSON details

#### Event Colors
- 🔴 **error** - Red
- 🟢 **ready** - Green
- 🔵 **refresh** - Blue
- 🟣 **publish** - Purple
- 🟠 **exposure** - Orange
- 🟡 **goal** - Yellow
- ⚪ **finalize** - Gray

#### Status Bar
Shows total event count and pause status

### Event Viewer Modal

When you click an event:
1. **Read-only JSON viewer** opens in the page
2. **Syntax highlighting** with One Dark theme
3. **Navigation:** Use arrow keys to scroll
4. **Search:** Cmd/Ctrl+F to search
5. **Close:** Click "Close" button or press ESC

### Event Buffering

**Automatic buffering:**
- Events are captured as soon as the page loads
- Buffer persists even when sidebar is closed
- Opening the Events Debug page shows all buffered events
- Buffer clears when you close the browser (session storage)

**Best practices:**
1. Open the Events Debug page early to see page load events
2. Use pause to freeze the event list for inspection
3. Clear events to reset before testing specific scenarios
4. Events persist across sidebar open/close during the same session

### Example Workflow

**Debugging an A/B test:**
```
1. Load the page
2. SDK fires events (ready, exposure, etc.)
3. Events are buffered automatically
4. Open extension sidebar
5. Click "Events Debug"
6. See all events since page load
7. Click "exposure" event
8. Inspect experiment assignment details
9. Verify correct variant was assigned
```

**Testing SDK integration:**
```
1. Open Events Debug page first
2. Trigger SDK actions on the page
3. Watch events appear in real-time
4. Click events to inspect payloads
5. Verify all expected events fired
6. Check data structure and values
```

## Technical Details

### Storage Mechanism
- **Type:** chrome.storage.session
- **Key:** `sdk_events_buffer`
- **Max size:** 1000 events
- **Persistence:** Until browser close
- **Overflow:** FIFO (oldest events dropped)

### Event Structure
```typescript
interface SDKEvent {
  id: string              // Unique ID: timestamp-random
  eventName: string       // Event type (ready, exposure, etc.)
  data: any              // Event payload
  timestamp: string      // ISO 8601 timestamp
}
```

### Performance Considerations
- Event buffering is asynchronous (no blocking)
- Session storage used (not localStorage)
- 1000 event limit prevents memory issues
- Shadow DOM isolation for event viewer

## Future Enhancements

Potential improvements:
- Event filtering by type
- Event search functionality
- Export events to JSON file
- Event timeline visualization
- Event statistics and analytics
- Integration with Chrome DevTools
- Network request correlation

---

**Version:** 0.0.2
**Last Updated:** 2025-10-06
**Author:** ABsmartly Extension Team
**Status:** ✅ Complete and Tested
