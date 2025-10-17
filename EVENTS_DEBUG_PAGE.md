# Events Debug Page

## Overview

The Events Debug Page is a real-time monitoring tool for ABsmartly SDK events. It captures and displays all events fired by the ABsmartly SDK, including errors, exposures, goals, and lifecycle events, providing developers with visibility into SDK behavior.

## How It Works

### Architecture

The feature uses a three-layer architecture for event capture and display:

1. **Page Context Layer** (`public/inject-sdk-plugin.js`)
   - Intercepts the ABsmartly SDK's `eventLogger` when the context is detected
   - Wraps the original eventLogger to capture all events
   - Forwards events via `window.postMessage` to the content script

2. **Content Script Layer** (`content.ts`)
   - Listens for `SDK_EVENT` messages from the page context
   - Forwards events to the extension UI using `sendMessageToExtension`

3. **Extension UI Layer** (`src/components/EventsDebugPage.tsx`)
   - Displays events in real-time as they arrive
   - Provides filtering, pausing, and detailed inspection capabilities

### Event Flow

```
SDK Context (page)
  └─> eventLogger interception
      └─> postMessage to content script
          └─> chrome.runtime.sendMessage to extension UI
              └─> EventsDebugPage component
```

### Captured Events

The following SDK events are captured automatically:

- **error** - When the context receives an error
- **ready** - When context initialization completes
- **refresh** - When `context.refresh()` succeeds
- **publish** - When `context.publish()` succeeds
- **exposure** - When `context.treatment()` creates first exposure
- **goal** - When `context.track()` succeeds
- **finalize** - When `context.finalize()` succeeds

## How to Use

### Accessing the Events Debug Page

1. Open the ABsmartly browser extension
2. Click the **bolt icon** (⚡) in the toolbar (next to the settings icon)
3. The Events Debug Page will open, showing a split-panel interface

### Interface Features

#### Left Panel - Events List
- Shows all captured events in chronological order (newest first)
- Each event displays:
  - **Event type** (color-coded badge)
  - **Timestamp** (HH:MM:SS.mmm format)
  - **Preview** of event data (truncated to 100 characters)
- Click any event to view full details in the right panel
- Active selection is highlighted with blue background

#### Right Panel - Event Details
- Shows complete information for the selected event:
  - **Event Type** - Color-coded badge
  - **Timestamp** - Full date and time
  - **Event Data** - Pretty-printed JSON with full event payload

#### Toolbar Controls

- **Pause/Resume Button** (⏸/▶)
  - Pause event capture to examine current events
  - Resume to continue capturing
  - Status indicator shows when paused

- **Clear Button** (🗑)
  - Removes all captured events
  - Resets the event counter

#### Event Counter
- Bottom status bar shows total events captured
- Updates in real-time as events arrive

### Color-Coded Event Types

Events are color-coded for quick identification:

- 🔴 **error** - Red (critical issues)
- 🟢 **ready** - Green (SDK initialized)
- 🔵 **refresh** - Blue (data refreshed)
- 🟣 **publish** - Purple (data published)
- 🟠 **exposure** - Orange (experiment exposure)
- 🟡 **goal** - Yellow (goal tracked)
- ⚪ **finalize** - Gray (cleanup completed)

## Files Changed

### New Files

1. **`src/components/EventsDebugPage.tsx`**
   - New React component for the Events Debug UI
   - 223 lines
   - Features: split-panel layout, pause/resume, event filtering, detail view

### Modified Files

1. **`public/inject-sdk-plugin.js`**
   - Added `interceptEventLogger()` function (lines 662-700)
   - Modified `detectABsmartlySDK()` to call interceptor (line 778)
   - Captures all SDK events and forwards to extension

2. **`content.ts`**
   - Added SDK_EVENT message handler (lines 749-754)
   - Forwards events from page to extension UI

3. **`src/components/ExtensionUI.tsx`**
   - Added `EventsDebugPage` import (line 10)
   - Added `BoltIcon` import (line 18)
   - Added 'events' to View type (line 24)
   - Added Events Debug button to toolbar (lines 787-794)
   - Added events view rendering (lines 913-915)

## Testing Instructions

### Manual Testing

#### 1. Basic Event Capture

1. Build and load the extension
2. Navigate to a page with ABsmartly SDK
3. Open the extension sidebar
4. Click the Events Debug button (⚡)
5. **Expected**: Events Debug Page opens with empty state

#### 2. SDK Initialization Events

1. With Events Debug Page open, refresh the page
2. **Expected**: See "ready" event appear with green badge
3. Click the ready event
4. **Expected**: Right panel shows context data with experiments

#### 3. Exposure Events

1. Trigger a `context.treatment()` call on the page
2. **Expected**: See "exposure" event with orange badge
3. **Expected**: Event data shows experiment name and variant

#### 4. Goal Events

1. Trigger a `context.track()` call on the page
2. **Expected**: See "goal" event with yellow badge
3. **Expected**: Event data shows goal name and properties

#### 5. Pause/Resume Functionality

1. Capture several events
2. Click the Pause button
3. Trigger more SDK events on the page
4. **Expected**: Event list does not update (paused)
5. **Expected**: Yellow status bar shows "Event capture paused"
6. Click Resume button
7. **Expected**: New events start appearing again

#### 6. Clear Events

1. Capture several events
2. Click the Clear button (trash icon)
3. **Expected**: All events removed
4. **Expected**: Empty state message appears
5. **Expected**: Event counter shows "0 events captured"

#### 7. Event Detail View

1. Capture an exposure or goal event
2. Click the event in the list
3. **Expected**: Right panel updates with event details
4. **Expected**: JSON data is properly formatted
5. **Expected**: All event properties are visible

### Automated Testing

To add automated tests, create `tests/events-debug-page.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('Events Debug Page displays SDK events', async ({ page }) => {
  // Navigate to test page with SDK
  await page.goto('http://localhost:8080/test-page.html')

  // Open extension and navigate to Events Debug
  // ... extension interaction code ...

  // Trigger SDK event
  await page.evaluate(() => {
    window.absmartly.track('test_goal', { value: 1 })
  })

  // Verify event appears
  await expect(page.locator('[data-testid="event-item"]')).toBeVisible()
  await expect(page.locator('text=goal')).toBeVisible()
})
```

### Edge Cases to Test

1. **No SDK Present**
   - Open Events Debug on page without SDK
   - Expected: Empty state, no errors

2. **Rapid Event Firing**
   - Trigger 100+ events quickly
   - Expected: All events captured, UI remains responsive

3. **Large Event Payloads**
   - Trigger event with large JSON data (>10KB)
   - Expected: Data displayed correctly, no truncation in detail view

4. **SDK Context Not Ready**
   - Open Events Debug before SDK initializes
   - Expected: No events until SDK ready, then events appear

5. **Multiple Contexts**
   - Page with multiple ABsmartly contexts
   - Expected: Events from all contexts captured

## Troubleshooting

### Events Not Appearing

**Symptom**: Events Debug Page shows no events despite SDK activity

**Solutions**:
1. Verify SDK is detected:
   - Open browser console
   - Look for `[ABsmartly Extension] Context found and cached`
   - Look for `[ABsmartly Extension] EventLogger intercepted successfully`

2. Check message passing:
   - Look for `[ABsmartly Extension] SDK Event:` logs in console
   - Verify content script is loaded

3. Reload the page:
   - The eventLogger is intercepted on SDK detection
   - Refresh to re-initialize

### Events Missing Data

**Symptom**: Events show but data field is empty

**Solutions**:
1. Check event type - some events (like "finalize") have no data
2. Verify SDK version supports eventLogger callback
3. Check for JSON serialization errors in console

### UI Not Updating

**Symptom**: Events appear in console but not in UI

**Solutions**:
1. Check if events are paused (yellow status bar)
2. Verify message listener is active:
   - Look for message handler errors in extension console
3. Reload the extension

## Future Enhancements

Potential improvements for future versions:

1. **Event Filtering**
   - Filter by event type
   - Search in event data
   - Date/time range filtering

2. **Export Functionality**
   - Export events as JSON
   - Export as CSV for analysis
   - Share event logs

3. **Event Statistics**
   - Count by event type
   - Timeline visualization
   - Performance metrics

4. **Real-time Monitoring**
   - Event rate (events/second)
   - Alert on error events
   - Custom event triggers

5. **Integration with Experiment Views**
   - Link exposure events to experiments
   - Show goal events in experiment detail
   - Cross-reference with variant data
