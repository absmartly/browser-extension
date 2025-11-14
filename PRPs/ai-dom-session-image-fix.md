name: "AI DOM Session & Image Handling Fixes"
description: |
  Fix three critical bugs preventing proper AI DOM changes session management and image handling:
  1. Images not received by Claude CLI - Bridge ignores files parameter
  2. Session not initialized on page mount - Created lazily on first message
  3. Session not passed through message chain - Background script doesn't forward session

---

## Goal
Fix AI DOM Changes feature to properly:
- Send images from extension to Claude CLI via the bridge
- Initialize conversation sessions when AI page opens (not lazily on first message)
- Pass session state through the entire message chain (UI → Background → AI Generator → Bridge)
- Enable HTML optimization by sending HTML only once per session

## Why
- **User Impact**: Users can't use images to help Claude understand their DOM change requests
- **Performance**: HTML is sent with EVERY message instead of just once, making responses slow
- **Session Continuity**: No proper conversation memory between messages
- **Data Efficiency**: Wasting bandwidth by re-sending HTML (50KB+) with every request

## What
Implement three coordinated fixes across the stack:

1. **Bridge Image Handling** (`~/git_tree/claude-code-bridge/index.js`):
   - Parse data URI format for images
   - Build multi-part content array with text + images
   - Send in Claude CLI's stream-json format

2. **Session Initialization** (`src/components/AIDOMChangesPage.tsx`):
   - Create ConversationSession on component mount
   - Pass session to onGenerate callback
   - Handle session updates from responses
   - Reset session on "New Chat"

3. **Session Propagation** (`background/main.ts`):
   - Accept conversationSession in AI_GENERATE_DOM_CHANGES message
   - Pass session to generateDOMChanges via options
   - Return updated session in response

### Success Criteria
- [ ] Bridge properly formats and sends images in multi-part content
- [ ] AIDOMChangesPage creates session on mount (visible in console logs)
- [ ] Background script accepts, passes, and returns session
- [ ] HTML sent only once per session (first message)
- [ ] Session ID reused across multiple messages
- [ ] Images uploaded by user are received and processed by Claude
- [ ] "New Chat" button creates new session with new ID
- [ ] E2E test for image+session flow passes

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window

- doc: Feature Plan
  file: .claude/tasks/ai-dom-session-image-fix-plan.md
  why: Complete specification with root cause analysis and expected behavior

- doc: Claude CLI Stream JSON Format
  url: https://docs.anthropic.com/en/docs/build-with-claude/streaming
  why: Multi-part content format for text + images
  critical: |
    Text only: { type: 'user', message: { role: 'user', content: 'text' } }
    Text + Images: { type: 'user', message: { role: 'user', content: [
      { type: 'text', text: '...' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } }
    ] } }

- file: src/lib/ai-dom-generator.ts
  why: Shows how generateDOMChanges creates/uses ConversationSession
  pattern: |
    - Session created with crypto.randomUUID()
    - htmlSent flag prevents re-sending HTML
    - messages array stores conversation history
    - conversationId links to bridge conversation

- file: src/components/AIDOMChangesPage.tsx
  why: Current implementation creates no session state
  gotcha: onGenerate callback is recreated on page reload, causing function loss

- file: src/types/absmartly.ts (lines 176-181)
  why: ConversationSession interface definition
  code: |
    export interface ConversationSession {
      id: string
      htmlSent: boolean
      messages: Array<{role: 'user' | 'assistant', content: string}>
      conversationId?: string  // Bridge conversation ID
    }

- file: src/lib/claude-code-client.ts
  why: Bridge client shows how to create/manage conversations
  pattern: createConversation(), sendMessage(), streamResponses()

- file: tests/e2e/ai-dom-generation-complete.spec.ts
  why: Test patterns for AI DOM changes E2E tests
  pattern: Inject sidebar, setup page, trigger AI generation, verify results
```

### Current Codebase tree
```bash
.
├── background/
│   ├── main.ts              # Message handler (needs session passing)
│   └── core/
├── src/
│   ├── components/
│   │   ├── AIDOMChangesPage.tsx         # Needs session state
│   │   ├── ExtensionUI.tsx              # Creates onGenerate callback
│   │   └── DOMChangesInlineEditor.tsx   # Calls AI_GENERATE_DOM_CHANGES
│   ├── lib/
│   │   ├── ai-dom-generator.ts          # Already handles sessions
│   │   └── claude-code-client.ts        # Bridge client
│   └── types/
│       └── absmartly.ts                 # ConversationSession interface
├── tests/
│   └── e2e/
│       ├── ai-dom-generation-complete.spec.ts  # Reference for test patterns
│       └── (new) ai-session-image.spec.ts      # New test to create
└── ~/git_tree/claude-code-bridge/
    └── index.js             # sendUserMessage() needs fix
```

### Bridge Repository Information
```yaml
LOCATION: ~/git_tree/claude-code-bridge/
  - This is a SEPARATE repository from the extension
  - Changes must be committed separately
  - Bridge server must be running for tests to work

RUNNING THE BRIDGE:
  Terminal command:
    cd ~/git_tree/claude-code-bridge
    node index.js

  Expected output:
    ✅ ABsmartly Claude Code Bridge running on http://localhost:3000
    ✓ Authenticated (pro subscription)

  If authentication fails:
    npx @anthropic-ai/claude-code login

TESTING THE FIX:
  1. Make changes to index.js
  2. Restart bridge server (Ctrl+C and run node index.js again)
  3. Test from extension
  4. Check bridge console for logs

IMPORTANT: The bridge spawns Claude CLI processes using:
  npx @anthropic-ai/claude-code --output-format stream-json --input-format stream-json

  This means the fix must output correctly formatted stream-json that Claude CLI expects.
```

### Known Gotchas & Library Quirks
```javascript
// CRITICAL: Bridge expects specific format for Claude CLI
// ❌ WRONG - Will fail with images
const userMessage = {
  type: 'user',
  message: {
    role: 'user',
    content: 'some text'  // Only string
  }
}

// ✅ CORRECT - Multi-part content for images
const userMessage = {
  type: 'user',
  message: {
    role: 'user',
    content: [
      { type: 'text', text: 'some text' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } }
    ]
  }
}

// GOTCHA: Data URIs need parsing
// Format: data:image/png;base64,iVBORw0KGgo...
// Extract: media_type='image/png', data='iVBORw0KGgo...'
const match = file.match(/^data:image\/(\w+);base64,(.+)$/)
const [, format, data] = match  // format='png', data='base64string'

// GOTCHA: AIDOMChangesPage onGenerate callback lost on reload
// Solution: Check if typeof onGenerate !== 'function' and show error

// PATTERN: Session ID generation
const sessionId = crypto.randomUUID()  // Use browser's crypto API

// PATTERN: Message passing with response
chrome.runtime.sendMessage({ type: 'AI_GENERATE_DOM_CHANGES', ... }, (response) => {
  if (response.success) {
    // Use response.session to update local state
  }
})
```

## Implementation Blueprint

### Task List (Execute in Order)

```yaml
Task 1: Fix Bridge Image Handling (Foundation Layer)
  file: ~/git_tree/claude-code-bridge/index.js
  function: sendUserMessage(conversationId, content, files)
  location: lines 217-238

  CURRENT CODE (lines 217-238):
    function sendUserMessage(conversationId, content, files) {
      const claudeProcess = claudeProcesses.get(conversationId)
      if (!claudeProcess) {
        console.error(`[${conversationId}] No Claude process found`)
        return
      }

      const messages = conversationMessages.get(conversationId) || []
      messages.push({ role: 'user', content })
      conversationMessages.set(conversationId, messages)

      const userMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: content  // ❌ PROBLEM: Only sends text, ignores files
        }
      }

      console.log(`[${conversationId}] Sending to Claude:`, JSON.stringify(userMessage).substring(0, 200))
      claudeProcess.stdin.write(JSON.stringify(userMessage) + '\n')
    }

  REPLACE WITH:
    function sendUserMessage(conversationId, content, files) {
      const claudeProcess = claudeProcesses.get(conversationId)
      if (!claudeProcess) {
        console.error(`[${conversationId}] No Claude process found`)
        return
      }

      const messages = conversationMessages.get(conversationId) || []
      messages.push({ role: 'user', content })
      conversationMessages.set(conversationId, messages)

      // Build content - multi-part if images, plain text otherwise
      let messageContent

      if (files && files.length > 0) {
        // Multi-part content: text + images
        messageContent = [{ type: 'text', text: content }]

        // Add each image to content array
        for (const file of files) {
          // Extract base64 data and media type from data URI
          // Format: data:image/png;base64,iVBORw0KGgoAAAANS...
          const match = file.match(/^data:image\/(\w+);base64,(.+)$/)
          if (match) {
            const [, format, data] = match
            messageContent.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: `image/${format}`,
                data: data
              }
            })
          } else {
            console.warn(`[${conversationId}] Invalid data URI format: ${file.substring(0, 50)}...`)
          }
        }
        console.log(`[${conversationId}] Sending message with ${files.length} image(s)`)
      } else {
        // Text-only content
        messageContent = content
      }

      const userMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: messageContent
        }
      }

      console.log(`[${conversationId}] Sending to Claude:`, JSON.stringify(userMessage).substring(0, 200))
      claudeProcess.stdin.write(JSON.stringify(userMessage) + '\n')
    }

  VERIFY:
    - Bridge console shows "Sending message with N image(s)" when images present
    - Bridge console shows content as array when images present
    - Bridge console shows content as string when no images
    - No "Invalid data URI format" warnings (unless actual invalid data)
    - No errors in bridge server console

Task 2: Add Session State to AIDOMChangesPage (UI Layer)
  file: src/components/AIDOMChangesPage.tsx

  ADD state (after line 41):
    const [conversationSession, setConversationSession] = useState<ConversationSession | null>(null)

  ADD initialization effect (after line 105):
    useEffect(() => {
      const newSession: ConversationSession = {
        id: crypto.randomUUID(),
        htmlSent: false,
        messages: [],
      }
      setConversationSession(newSession)
      console.log('[AIDOMChangesPage] Session initialized:', newSession.id)
    }, [])

  MODIFY handleGenerate function (around line 203):
    - PASS conversationSession to onGenerate(prompt, images, conversationSession)
    - WAIT for result which includes updated session
    - UPDATE state: setConversationSession(result.session)

  MODIFY handleNewChat function (around line 267):
    - CREATE new session with crypto.randomUUID()
    - SET conversationSession state to new session
    - LOG new session ID

  VERIFY:
    - Console shows "Session initialized" on page mount
    - Console shows session ID on first message
    - Console shows same session ID on second message
    - Console shows different session ID after "New Chat"

Task 3: Update Background Message Handler (Middleware Layer)
  file: background/main.ts
  location: lines 360-397

  MODIFY AI_GENERATE_DOM_CHANGES handler:
    - EXTRACT conversationSession from message destructuring (line 367)
    - ADD conversationSession to options object (after line 381)
    - RETURN session in response (line 386)

  Changes:
    Line 367: const { html, prompt, currentChanges, images, conversationSession } = message
    Line 381: Add to options:
      if (conversationSession) {
        options.conversationSession = conversationSession
      }
    Line 386: Change sendResponse to include session:
      sendResponse({
        success: true,
        result,
        session: result.session  // NEW
      })

  VERIFY:
    - Background console shows received session ID
    - Background console shows passing session to generator
    - Background console shows returning session in response

Task 4: Update DOMChangesInlineEditor (Integration Layer)
  file: src/components/DOMChangesInlineEditor.tsx

  FIND: chrome.runtime.sendMessage for AI_GENERATE_DOM_CHANGES
  SEARCH pattern: "type: \"AI_GENERATE_DOM_CHANGES\""

  MODIFY message:
    - ADD conversationSession: null (or pass from parent if available)

  MODIFY response handler:
    - HANDLE response.session if present
    - STORE or propagate session to parent

  NOTE: This is optional - inline editor can start with null session each time

  VERIFY:
    - Inline editor can still generate DOM changes
    - No errors in console

Task 5: Create E2E Test for Image Upload + Session
  file: tests/e2e/ai-session-image.spec.ts (NEW FILE)

  CREATE test:
    - SETUP: Inject sidebar, navigate to AI page
    - STEP 1: Verify session initialized (check window.__conversationSession)
    - STEP 2: Upload HELLO_WORLD test image (use existing test images)
    - STEP 3: Type prompt asking about image content
    - STEP 4: Generate and wait for response
    - STEP 5: Verify response mentions "HELLO" and "WORLD"
    - STEP 6: Verify session ID unchanged
    - STEP 7: Send second message
    - STEP 8: Verify same session ID still used
    - STEP 9: Click "New Chat"
    - STEP 10: Verify new session ID created

  VERIFY:
    - Test passes consistently
    - No timeouts or flakiness
    - Screenshots captured for debugging
```

### Pseudocode with Critical Details

```javascript
// Task 1: Bridge sendUserMessage() - Multi-part content handling
function sendUserMessage(conversationId, content, files) {
  // ... existing process lookup ...

  let messageContent

  if (files && files.length > 0) {
    // Multi-part content: text + images
    messageContent = [{ type: 'text', text: content }]

    for (const file of files) {
      // Parse data URI: data:image/png;base64,iVBORw0KGgo...
      const match = file.match(/^data:image\/(\w+);base64,(.+)$/)
      if (match) {
        const [, format, data] = match
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: `image/${format}`,  // e.g., "image/png"
            data: data  // Base64 string without prefix
          }
        })
      } else {
        console.warn(`Invalid data URI format: ${file.substring(0, 50)}...`)
      }
    }
  } else {
    // Text-only content
    messageContent = content
  }

  const userMessage = {
    type: 'user',
    message: { role: 'user', content: messageContent }
  }

  console.log(`[${conversationId}] Sending message with ${files?.length || 0} images`)
  claudeProcess.stdin.write(JSON.stringify(userMessage) + '\n')
}

// Task 2: AIDOMChangesPage - Session initialization
export const AIDOMChangesPage = ({ variantName, onGenerate, ... }) => {
  const [conversationSession, setConversationSession] = useState<ConversationSession | null>(null)

  // Initialize session on mount
  useEffect(() => {
    const newSession: ConversationSession = {
      id: crypto.randomUUID(),
      htmlSent: false,
      messages: [],
    }
    setConversationSession(newSession)
    console.log('[AIDOMChangesPage] Session initialized:', newSession.id)
  }, [])  // Empty deps = run once on mount

  const handleGenerate = async () => {
    // ... validation ...

    try {
      // CRITICAL: Pass session to onGenerate
      const result = await onGenerate(prompt, images, conversationSession)

      // CRITICAL: Update session from result
      if (result.session) {
        setConversationSession(result.session)
        console.log('[AIDOMChangesPage] Session updated:', result.session.id)
      }

      // ... update UI ...
    } catch (err) {
      // ... error handling ...
    }
  }

  const handleNewChat = () => {
    const newSession: ConversationSession = {
      id: crypto.randomUUID(),
      htmlSent: false,
      messages: [],
    }
    setConversationSession(newSession)
    console.log('[AIDOMChangesPage] New chat session:', newSession.id)

    // ... clear UI state ...
  }
}

// Task 3: Background script - Session forwarding
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AI_GENERATE_DOM_CHANGES") {
    const { html, prompt, currentChanges, images, conversationSession } = message

    (async () => {
      try {
        const config = await getStoredConfig()
        const options: any = {}

        // Forward session if present
        if (conversationSession) {
          options.conversationSession = conversationSession
        }

        const result = await generateDOMChanges(
          html, prompt, apiKey, currentChanges, images, options
        )

        // Return session in response
        sendResponse({
          success: true,
          domChanges: result.domChanges,
          explanation: result.explanation,
          session: result.session  // CRITICAL: Include session
        })
      } catch (error) {
        sendResponse({ success: false, error: error.message })
      }
    })()

    return true
  }
})
```

### Integration Points
```yaml
SESSION FLOW:
  - CREATE: AIDOMChangesPage useEffect on mount
  - STORE: Component state (conversationSession)
  - PASS: onGenerate(prompt, images, session) → Background → AI Generator → Bridge
  - UPDATE: Response contains updated session → setConversationSession(result.session)
  - RESET: "New Chat" button creates new session

MESSAGE CHAIN:
  UI (AIDOMChangesPage)
    ↓ onGenerate(prompt, images, session)
  ExtensionUI wrapper
    ↓ chrome.runtime.sendMessage({ type: 'AI_GENERATE_DOM_CHANGES', ..., conversationSession })
  Background Script (background/main.ts)
    ↓ generateDOMChanges(html, prompt, apiKey, changes, images, { conversationSession })
  AI DOM Generator (src/lib/ai-dom-generator.ts)
    ↓ generateWithBridge(html, prompt, changes, images, conversationSession)
  Bridge Client (src/lib/claude-code-client.ts)
    ↓ sendMessage(conversationId, userMessage, files, systemPrompt)
  Bridge Server (~/git_tree/claude-code-bridge/index.js)
    ↓ sendUserMessage(conversationId, content, files)
  Claude CLI
    ← stream-json responses

CONSOLE LOG CHECKPOINTS:
  1. "[AIDOMChangesPage] Session initialized: {uuid}"
  2. "[AIDOMChangesPage] Sending message with session: {uuid}"
  3. "[Background] Received session: {uuid}"
  4. "[AI Generator] Using session: {uuid}"
  5. "[Bridge] Sending message to conversation: {conversationId}"
  6. "[Bridge] Sending message with {N} images"
  7. "[Bridge] Message sent successfully"
```

## Validation Loop

### Level 1: Syntax & Type Checking
```bash
# Run these FIRST before testing
cd /Users/joalves/git_tree/ext-dev1-claude-sdk

# Build the extension (REQUIRED before E2E tests!)
npm run build:dev

# Expected: No TypeScript errors, build succeeds
# If errors: Fix TypeScript types, ensure ConversationSession is imported correctly
```

### Level 2: Manual Testing

#### Step 1: Test Bridge Fix in Isolation
```bash
# Terminal 1: Start bridge server with your changes
cd ~/git_tree/claude-code-bridge
node index.js
# Expected: "✅ ABsmartly Claude Code Bridge running on http://localhost:3000"

# Terminal 2: Test bridge directly with curl (before extension testing)
# Test 1: Text-only message (should work same as before)
curl -X POST http://localhost:3000/conversations \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test-session-123"}' \
  && echo "Conversation created"

curl -X POST http://localhost:3000/conversations/test-session-123/messages \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, what is 2+2?", "systemPrompt": "You are a helpful assistant."}' \
  && echo "Message sent"

# Expected bridge console output:
# [test-session-123] Sending to Claude: {"type":"user","message":{"role":"user","content":"Hello, what is 2+2?"}}
# (content is plain string, no array)

# Test 2: Message with image (the fix we're testing)
# First, create a small test image as base64 (or use existing)
# Example data URI: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==

curl -X POST http://localhost:3000/conversations/test-session-456/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "What do you see in this image?",
    "files": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
    "systemPrompt": "You are a helpful assistant."
  }' \
  && echo "Image message sent"

# Expected bridge console output:
# [test-session-456] Sending message with 1 image(s)
# [test-session-456] Sending to Claude: {"type":"user","message":{"role":"user","content":[{"type":"text","text":"What do you...
# (content is array with text and image blocks)

# If you see "Sending message with 1 image(s)", the bridge fix is working! ✅
```

#### Step 2: Test Full Extension Integration
```bash
# Terminal 1: Bridge server should still be running from Step 1
# Keep watching bridge console for logs

# Terminal 2: Open test page with extension
# 1. Open Chrome with extension loaded
# 2. Navigate to test page
# 3. Open extension sidebar
# 4. Click "Generate with AI" on a variant
# 5. Check browser console for:
#    - "[AIDOMChangesPage] Session initialized: ..."
# 6. Upload an image
# 7. Type a prompt asking about the image
# 8. Click "Generate DOM Changes"
# 9. Check BOTH consoles:
#    BROWSER CONSOLE:
#    - "[AIDOMChangesPage] Sending message with session: {uuid}"
#    - "[Background] Received session: {uuid}"
#
#    BRIDGE CONSOLE (Terminal 1):
#    - "[conv_...] Sending message with 1 image(s)"
#    - "[conv_...] Claude event: ..." (response from Claude)
#
# 10. Type second message without image
# 11. Verify same session ID is used
# 12. Click "New Chat"
# 13. Verify new session ID created

# Expected behavior:
# ✅ Session ID logged on mount
# ✅ Session ID passed through message chain (visible in both consoles)
# ✅ Bridge console shows "Sending message with N image(s)"
# ✅ Claude responds with content about the image
# ✅ HTML sent only on first message (check bridge logs)
# ✅ Same session across multiple messages
# ✅ New session after "New Chat"
```

### Level 3: E2E Test
```bash
# Run the new E2E test
cd /Users/joalves/git_tree/ext-dev1-claude-sdk

# CRITICAL: Build first!
npm run build:dev

# Run test with experiment saving and full output
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-session-image.spec.ts

# Expected: All steps pass, screenshots saved, no timeouts
# If failing:
#   - Check test-results/ for screenshots
#   - Review console output for specific failure
#   - Verify bridge is running
#   - Check that session is initialized
```

### Level 4: Integration Verification
```bash
# Verify complete flow with existing test
npm run build:dev
SAVE_EXPERIMENT=1 npx playwright test tests/e2e/ai-dom-generation-complete.spec.ts

# Expected: Test passes with session optimization
# Should see in logs:
#   - "[Bridge] Including HTML in system prompt (initializing conversation)"
#   - "[Bridge] Reusing existing conversation: {id}"
#   - HTML NOT sent on subsequent messages
```

## Final Validation Checklist

### Bridge Fix Validation
- [ ] Bridge code updated at ~/git_tree/claude-code-bridge/index.js lines 217-238
- [ ] Bridge server starts without errors: `node index.js`
- [ ] Curl test with text-only message works (content is string)
- [ ] Curl test with image message works (content is array, logs "Sending message with 1 image(s)")
- [ ] Bridge console shows no "Invalid data URI format" warnings with valid images
- [ ] Bridge changes committed to claude-code-bridge repository

### Extension Fix Validation
- [ ] TypeScript compiles without errors
- [ ] Extension builds successfully with `npm run build:dev`
- [ ] AIDOMChangesPage.tsx has conversationSession state
- [ ] AIDOMChangesPage.tsx has useEffect that initializes session on mount
- [ ] background/main.ts accepts conversationSession in message
- [ ] background/main.ts returns session in response

### Integration Validation
- [ ] Bridge server running and accessible at http://localhost:3000
- [ ] Session initialized on AI page mount (browser console log visible)
- [ ] Session ID passed through message chain (check logs at each layer)
- [ ] Images uploaded appear in Claude's response content
- [ ] Bridge console shows "Sending message with N image(s)" when images present
- [ ] HTML sent only once per session (first message, check bridge logs)
- [ ] Same session ID used across multiple messages (check browser console)
- [ ] "New Chat" creates new session with different ID (check browser console)

### Test Validation
- [ ] E2E test ai-session-image.spec.ts created and passes
- [ ] E2E test ai-dom-generation-complete.spec.ts still passes
- [ ] No browser console errors during manual testing
- [ ] No bridge server errors during manual testing
- [ ] Screenshots saved in test-results/ for debugging (if tests fail)

### Repository Commits
- [ ] Bridge changes committed to ~/git_tree/claude-code-bridge/
- [ ] Extension changes committed to ~/git_tree/ext-dev1-claude-sdk/
- [ ] Both repositories have clear commit messages describing the fixes

---

## Anti-Patterns to Avoid
- ❌ Don't parse data URIs manually with string splitting - use regex
- ❌ Don't send HTML with every message - check session.htmlSent flag
- ❌ Don't create session in generateDOMChanges - create in UI on mount
- ❌ Don't forget to return session in response - UI needs to update state
- ❌ Don't use placeholders for session - pass null if not available
- ❌ Don't modify session structure - use existing ConversationSession interface
- ❌ Don't skip build step before running E2E tests - they use built extension
- ❌ Don't use waitForTimeout() in tests - use waitFor({ state: 'visible' })

## Quality Score

**Confidence Level: 9/10**

Rationale:
- ✅ All code locations identified with exact line numbers
- ✅ Complete message chain mapped with console log checkpoints
- ✅ Existing patterns documented with examples
- ✅ Test patterns available for reference
- ✅ Clear validation gates at each level (bridge, syntax, manual, E2E, integration)
- ✅ Bridge fix fully specified with CURRENT CODE and REPLACE WITH blocks
- ✅ Bridge repository information and testing workflow documented
- ✅ Curl commands provided for isolated bridge testing
- ✅ Session interface already exists and is used in ai-dom-generator.ts
- ⚠️  Bridge file is external repo (~/git_tree/claude-code-bridge/) - requires separate commit (documented)

This PRP should enable one-pass implementation with very high confidence. The bridge fix is the most critical change and is now fully specified with:
- Complete current code (lines 217-238)
- Complete replacement code
- Isolated testing with curl commands
- Expected console output at each step
- Integration testing with extension

The only minor risk is that the bridge is a separate repository requiring a separate commit, but this is well-documented with clear testing steps.
