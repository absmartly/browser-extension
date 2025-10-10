# Runtime Messaging Polyfill

## Overview

The runtime messaging polyfill provides a unified API for Chrome extension messaging that works seamlessly in both production and test environments. It eliminates the need for dual listener patterns by making `chrome.runtime.onMessage` work in both normal Chrome extension contexts and iframe/test contexts.

## Problem Solved

Previously, components needed dual listeners to handle messages:

```typescript
// ❌ OLD WAY - Dual Listeners (DON'T DO THIS)
const chromeListener = (message: any) => {
  if (message.type === 'MY_MESSAGE') {
    // handle message
  }
}

const postMessageListener = (event: MessageEvent) => {
  if (event.data?.source === 'absmartly-extension-incoming' &&
      event.data?.type === 'MY_MESSAGE') {
    // handle message
  }
}

chrome.runtime.onMessage.addListener(chromeListener)
window.addEventListener('message', postMessageListener)
```

## Solution

With the polyfill, use a single listener:

```typescript
// ✅ NEW WAY - Single Listener (DO THIS)
const listener = (message: any, sender: any, sendResponse: Function) => {
  if (message.type === 'MY_MESSAGE') {
    // handle message
    sendResponse({ success: true })
  }
}

chrome.runtime.onMessage.addListener(listener)
```

The polyfill automatically:
- Routes `window.postMessage` events to `chrome.runtime.onMessage` listeners in test contexts
- Works transparently in production
- No component code changes needed

## How It Works

### In Tests

The `BackgroundRunner` class injects the polyfill into test pages:

```typescript
// tests/helpers/background-runner.ts
async initialize(buildPath: string) {
  await this.page.evaluate(() => {
    // Polyfill code is injected here
    // Sets up chrome.runtime.onMessage to forward window.postMessage
  })
}
```

### Message Flow

#### Production (Chrome Extension):
```
Component → chrome.runtime.sendMessage() → Background Script
Background Script → chrome.tabs.sendMessage() → Component
Component receives via chrome.runtime.onMessage listener ✓
```

#### Tests (Iframe):
```
Component → chrome.runtime.sendMessage() → window.postMessage()
window.postMessage() → Polyfill → chrome.runtime.onMessage listeners
Component receives via same chrome.runtime.onMessage listener ✓
```

## Usage Examples

### Sending Messages

```typescript
// Works in both production and tests
chrome.runtime.sendMessage({
  type: 'CHECK_AUTH',
  requestId: 'auth_123'
})
```

### Receiving Messages

```typescript
// Set up listener (works everywhere)
useEffect(() => {
  const listener = (message: any, sender: any, sendResponse: Function) => {
    if (message.type === 'CHECK_AUTH_RESULT') {
      console.log('Auth result:', message.result)
      sendResponse({ acknowledged: true })
    }
  }

  chrome.runtime.onMessage.addListener(listener)

  return () => {
    chrome.runtime.onMessage.removeListener(listener)
  }
}, [])
```

### Async Response Pattern

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_DATA') {
    // Async operation
    fetchData().then(data => {
      sendResponse({ success: true, data })
    }).catch(error => {
      sendResponse({ success: false, error: error.message })
    })

    return true // Keep channel open for async response
  }
})
```

## Testing Integration

The polyfill is automatically available in Playwright tests when using `BackgroundRunner`:

```typescript
import { test } from '@playwright/test'
import { BackgroundRunner } from './helpers/background-runner'

test('message passing works', async ({ page }) => {
  const bg = new BackgroundRunner(page)
  await bg.initialize()

  // Now components can use chrome.runtime.onMessage
  // and it will work in the test iframe context
})
```

## Migration Guide

If you have existing dual listener code:

### Step 1: Remove window.postMessage Listener

```diff
- const postMessageListener = (event: MessageEvent) => { ... }
- window.addEventListener('message', postMessageListener)
```

### Step 2: Keep Only Chrome Listener

```diff
- const chromeListener = (message: any) => { ... }
- chrome.runtime.onMessage.addListener(chromeListener)
+ const listener = (message: any, sender: any, sendResponse: Function) => { ... }
+ chrome.runtime.onMessage.addListener(listener)
```

### Step 3: Update Cleanup

```diff
- chrome.runtime.onMessage.removeListener(chromeListener)
- window.removeEventListener('message', postMessageListener)
+ chrome.runtime.onMessage.removeListener(listener)
```

## Benefits

1. **Simpler Code**: ~50% less message handling boilerplate
2. **Single API**: Same code works in production and tests
3. **Type Safety**: Better TypeScript support with unified types
4. **Maintainability**: Changes only needed in one place
5. **No Test Awareness**: Components don't need to know about test context

## Implementation Files

- `tests/helpers/runtime-polyfill.ts` - Polyfill module
- `tests/helpers/background-runner.ts` - Test runner integration
- `src/components/SettingsView.tsx` - Example refactored component

## Future Enhancements

Potential improvements:
- Add message routing/filtering utilities
- Create React hooks for common messaging patterns
- Add TypeScript types for message payloads
- Support for more Chrome extension messaging APIs (ports, etc.)
