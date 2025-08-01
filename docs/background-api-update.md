# Background Service Worker API Update

## Summary

I've refactored the ABSmartly Chrome Extension to route all API requests through the background service worker to avoid CORS issues when making requests from the popup.

## Changes Made

### 1. Background Service Worker (`background.ts`)
- Added API request handling functionality
- Implemented `makeAPIRequest` helper function
- Added message handlers for:
  - `API_REQUEST`: General API requests to ABSmartly
  - `CHECK_AUTH`: Special handler for `/auth/current-user` endpoint
- Proper handling of cookies with `withCredentials: true` when no API key is provided

### 2. New Background API Client (`src/lib/background-api-client.ts`)
- Created a new API client that sends messages to the background worker
- All API methods now use `chrome.runtime.sendMessage`
- Maintains the same interface as the original ABSmartlyClient

### 3. Updated Hook (`src/hooks/useABSmartly.ts`)
- Replaced direct API client with BackgroundAPIClient
- Removed client initialization logic (now uses singleton)
- All API calls now go through the background service worker

### 4. Settings Component (`src/components/SettingsView.tsx`)
- Updated `checkAuthStatus` to use message passing
- Auth check now sends `CHECK_AUTH` message to background

### 5. Manifest Permissions (`package.json`)
- Added `cookies` permission for proper cookie access

## How It Works

1. **Popup/Content Script** makes an API request:
   ```javascript
   chrome.runtime.sendMessage({
     type: 'API_REQUEST',
     method: 'GET',
     path: '/experiments'
   })
   ```

2. **Background Service Worker** receives the message and:
   - Gets the stored configuration
   - Makes the actual HTTP request with proper headers
   - Handles cookies if no API key is provided
   - Returns the response

3. **Response** is sent back to the popup/content script

## Benefits

- ✅ No more CORS issues
- ✅ Cookies are properly included in requests
- ✅ Authentication status can be detected when logged into ABSmartly
- ✅ Centralized API request handling
- ✅ Better security - API keys stay in background context

## Testing

After reloading the extension:
1. Open the extension popup
2. Go to settings
3. Enter your ABSmartly endpoint
4. If you're logged into ABSmartly in your browser, you should see your user info
5. If not, you'll see "Not authenticated" with an option to authenticate