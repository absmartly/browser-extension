# AI Chat Session Initialization and Storage Quota Fix

## Issues

### Issue 1: Session Initialization Timing
The AI chat session is only being initiated when the user sends the first message. This causes a delay because the page HTML needs to be captured and sent during the first interaction, making the initial response slower.

**Current Flow:**
1. User opens AI chat window
2. User types prompt and clicks "Generate"
3. `handleGenerate()` is called
4. HTML is captured via `capturePageHTML()`
5. Session is created with HTML in first message
6. AI processes and responds

**Desired Flow:**
1. User opens AI chat window
2. Session is created immediately with HTML captured in background
3. User types prompt and clicks "Generate"
4. AI responds quickly (HTML already sent in session)

### Issue 2: Storage Quota Exceeded
When uploading images, the conversation storage fails with:
```
Error: Resource::kQuotaBytesPerItem quota exceeded
```

**Root Cause:**
Chrome extension storage has a limit of **8,192 bytes (8KB) per item** for `chrome.storage.sync` and **102,400 bytes (100KB) per item** for `chrome.storage.local`. The conversation is being stored with:
- Full page HTML (718KB in the error logs)
- Base64-encoded images (can be 100KB+ each)
- All chat messages
- Conversation session metadata

This easily exceeds the storage quota.

## Analysis

### Session Initialization Location
Looking at `AIDOMChangesPage.tsx`:
- Lines 104-138: `useEffect` initializes conversation on mount
- It creates a new session but does NOT capture HTML or initialize the AI conversation
- The session's `htmlSent` flag is set to `false`
- HTML is only captured in `handleAIGenerate()` (line 839 in `DOMChangesInlineEditor.tsx`)

### Storage Issue Location
Looking at `ai-conversation-storage.ts`:
- Line 60: `await storage.set(key, JSON.stringify(data))`
- The entire conversation object is serialized including:
  - `messages[]` with embedded base64 images
  - `conversationSession` with full HTML in messages
  - All metadata

The storage is using `@plasmohq/storage` which wraps Chrome storage APIs.

## Solution Plan

### Fix 1: Preemptive Session Initialization

**Goal:** Initialize the AI conversation and send HTML when the chat window opens, not on first message.

**Changes to `AIDOMChangesPage.tsx`:**

1. Add a new state for initialization status:
   ```typescript
   const [isInitializing, setIsInitializing] = useState(false)
   const [isInitialized, setIsInitialized] = useState(false)
   ```

2. Modify the initialization `useEffect` (lines 104-138) to:
   - Load existing active conversation (if exists)
   - If no active conversation or `htmlSent` is false:
     - Call `capturePageHTML()` to get page HTML
     - Send initialization message to background with HTML
     - Create conversation with `htmlSent: true`
   - Set `isInitialized: true` when done

3. Add UI feedback during initialization:
   - Show a loading indicator in the empty state
   - Display "Analyzing page..." message

4. Update `handleGenerate()` to:
   - Skip HTML capture if session already has `htmlSent: true`
   - Pass existing session to `onGenerate()`

**Changes to `DOMChangesInlineEditor.tsx`:**

1. Update `handleAIGenerate()` (lines 798-885):
   - Check if `conversationSession?.htmlSent` is true
   - If true, skip HTML capture
   - If false, capture HTML (current behavior)

**Changes to background script (`background/main.ts`):**

1. Add new message type `AI_INITIALIZE_SESSION`:
   - Accepts: `html`, `apiKey`, `conversationSession`
   - Creates conversation with HTML in system prompt
   - Returns session with `htmlSent: true`
   - No actual generation, just initialization

### Fix 2: Storage Optimization

**Goal:** Reduce stored data size to fit within Chrome storage limits.

**Strategy:** Remove large data before storage:
- Don't store base64 images in conversations (they're temporary for that session)
- Don't store HTML in conversation session (it's already sent to Claude)
- Store only essential message content and metadata

**Changes to `ai-conversation-storage.ts`:**

1. Add a sanitization function before saving:
   ```typescript
   function sanitizeConversationForStorage(conv: StoredConversation): StoredConversation {
     return {
       ...conv,
       messages: conv.messages.map(msg => ({
         ...msg,
         images: undefined, // Remove base64 images
       })),
       conversationSession: {
         ...conv.conversationSession,
         messages: [] // Clear session messages (Claude keeps them server-side)
       }
     }
   }
   ```

2. Update `saveConversation()` (line 34):
   - Sanitize conversation before JSON.stringify
   - Add try-catch with better error handling
   - If still fails, show user-friendly error about storage limits

3. Add conversation size check:
   ```typescript
   const sizeInBytes = new Blob([JSON.stringify(sanitized)]).size
   if (sizeInBytes > 90000) { // Leave 10KB buffer
     console.warn(`Conversation too large: ${sizeInBytes} bytes`)
     // Optionally trim old messages
   }
   ```

**Changes to `AIDOMChangesPage.tsx`:**

1. Update error handling in `handleGenerate()` (line 271):
   - Wrap `saveConversation()` in try-catch
   - Show user-friendly error if storage fails
   - Don't block the UI if save fails (conversation still works, just not persisted)

### Alternative Approach for Storage (if needed)

If sanitization isn't enough:

1. **Store conversation references only:**
   - Store conversation metadata (id, timestamps, message count)
   - Store actual messages in IndexedDB (larger quota)
   - Use `chrome.storage.local` for metadata

2. **Implement message pagination:**
   - Only store last N messages in storage
   - Archive older messages separately

## Implementation Order

1. **Fix storage issue first** (highest priority, blocking users):
   - Implement sanitization in `ai-conversation-storage.ts`
   - Add error handling in `AIDOMChangesPage.tsx`
   - Test with images to verify fix

2. **Fix session initialization** (UX improvement):
   - Add initialization to `AIDOMChangesPage.tsx`
   - Update `handleAIGenerate()` in `DOMChangesInlineEditor.tsx`
   - Add background handler for initialization
   - Test initialization flow

## Testing Checklist

- [ ] Open AI chat window, verify HTML is captured automatically
- [ ] Send first message, verify it responds quickly (no HTML capture delay)
- [ ] Upload an image, verify no storage quota error
- [ ] Send multiple messages with images, verify storage works
- [ ] Close and reopen chat, verify conversation loads correctly
- [ ] Create new chat, verify it initializes properly
- [ ] Check storage size with `chrome.storage.local.getBytesInUse()`

## Trade-offs and Considerations

### Session Initialization
- **Pro:** Faster first response, better UX
- **Pro:** HTML is fresh when captured (before any user changes)
- **Con:** Uses resources even if user doesn't send message
- **Con:** May need to re-capture HTML if page changes significantly

### Storage Optimization
- **Pro:** Prevents storage quota errors
- **Pro:** Faster storage operations
- **Con:** Images aren't saved in history (user won't see them after page reload)
- **Con:** Can't replay exact conversation state

### Mitigation
- For images: Could store image URLs instead of base64 (if from web)
- For HTML: Not needed in storage since Claude server maintains conversation
- For large conversations: Implement archiving for conversations > 50 messages
