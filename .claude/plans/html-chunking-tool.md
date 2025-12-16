# Plan: HTML Chunking Tool for LLM Context Management

## Problem Statement

Currently, the full HTML is captured, compressed, and passed to the AI in the system prompt. This approach has limitations:

1. **Context overflow**: Large HTML pages (100KB+) may not fit in the model's context window
2. **Inefficiency**: The LLM often only needs specific sections to make targeted changes
3. **Cost**: Sending full HTML consumes tokens unnecessarily
4. **Performance**: Large context slows down response times

## Solution: On-Demand HTML Retrieval Tool

Instead of passing the full HTML upfront, we'll:
1. Pass a **lightweight DOM structure overview** (tree of elements with selectors)
2. Provide an **LLM-callable tool** to request specific HTML sections
3. Cache the full HTML for fast retrieval

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Initial Request                          │
├─────────────────────────────────────────────────────────────────┤
│  System Prompt + DOM Structure (lightweight tree)               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ body                                                     │   │
│  │ ├── header#main-header                                  │   │
│  │ ├── nav.navbar (3 items)                                │   │
│  │ ├── main#content                                        │   │
│  │ │   ├── section.hero                                    │   │
│  │ │   ├── section.features (6 children)                   │   │
│  │ │   └── section.pricing                                 │   │
│  │ └── footer#main-footer                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Processing                               │
├─────────────────────────────────────────────────────────────────┤
│  User: "Change the hero section headline"                       │
│                                                                 │
│  LLM thinks: I need to see the hero section HTML                │
│  LLM calls: get_html_chunk({ selector: "section.hero" })        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tool Response                                │
├─────────────────────────────────────────────────────────────────┤
│  Returns HTML for section.hero:                                 │
│  <section class="hero">                                         │
│    <h1>Welcome to Our Platform</h1>                            │
│    <p>The best solution for your needs</p>                     │
│    <button class="cta-btn">Get Started</button>                │
│  </section>                                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Generates Changes                        │
├─────────────────────────────────────────────────────────────────┤
│  Now LLM can generate precise DOM changes for section.hero      │
│  with accurate selectors based on actual HTML structure         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Provider-Specific Architecture

### Key Difference: Bridge vs API Providers

| Aspect | Bridge Provider | API Providers (Anthropic/OpenAI) |
|--------|-----------------|----------------------------------|
| **HTML Storage** | Stored in bridge server at conversation start | Cached in extension |
| **Chunk Retrieval** | CLI tool queries bridge server | Real-time DOM queries via content script |
| **Tool Implementation** | External CLI command | Native tool calling with agentic loop |
| **Refresh Mechanism** | Extension sends new HTML to bridge | Extension recaptures from live DOM |

---

## Bridge Provider Architecture

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│               1. CONVERSATION START (existing endpoint)          │
├─────────────────────────────────────────────────────────────────┤
│  Extension calls existing createConversation with HTML:         │
│                                                                 │
│  POST /conversations  (already exists!)                         │
│  {                                                              │
│    session_id: "...",                                           │
│    cwd: "/",                                                    │
│    jsonSchema: {...},                                           │
│    html: "<html>...</html>"       // NEW: Full HTML for chunks  │
│  }                                                              │
│                                                                 │
│  Bridge stores HTML in memory, keyed by conversation ID        │
│                                                                 │
│  Extension generates DOM structure locally and includes it      │
│  in the system prompt (sent via sendMessage, not stored here)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               2. CLAUDE CODE PROCESSES REQUEST                   │
├─────────────────────────────────────────────────────────────────┤
│  Claude receives system prompt with DOM structure:              │
│                                                                 │
│  "You have access to a CLI tool to retrieve HTML chunks:        │
│   npx @absmartly/claude-code-bridge get-chunk \                 │
│     --conversation-id <id> --selector <selector>                │
│                                                                 │
│  ## Page DOM Structure                                          │
│  body                                                           │
│  ├── header#main-header                                         │
│  ├── main#content                                               │
│  │   ├── section.hero                                           │
│  │   └── section.pricing                                        │
│  └── footer"                                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               3. CLAUDE CODE RETRIEVES CHUNKS                    │
├─────────────────────────────────────────────────────────────────┤
│  Claude Code spawns CLI to get HTML:                            │
│                                                                 │
│  $ npx @absmartly/claude-code-bridge get-chunk \                │
│      --conversation-id conv-123 \                               │
│      --selector "section.hero"                                  │
│                                                                 │
│  CLI queries bridge server:                                     │
│  GET /conversations/conv-123/chunk?selector=section.hero        │
│                                                                 │
│  Returns: <section class="hero">...</section>                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               4. REFRESH (USER TRIGGERED)                        │
├─────────────────────────────────────────────────────────────────┤
│  User clicks "Refresh HTML" button in extension UI:             │
│                                                                 │
│  Extension recaptures DOM and sends to bridge:                  │
│  POST /conversations/:id/refresh                                │
│  { html: "<html>...</html>", structure: "..." }                 │
│                                                                 │
│  Bridge updates stored HTML for that conversation               │
│  Also sends new structure summary to Claude in next message     │
└─────────────────────────────────────────────────────────────────┘
```

### Bridge Server Changes

**Extend existing `POST /conversations` endpoint:**

The `createConversation` method already exists - we just add `html` to the request body:

```javascript
// EXISTING endpoint - extend to store HTML
app.post('/conversations', (req, res) => {
  const { session_id, cwd, permissionMode, jsonSchema, html } = req.body
  const conversationId = generateId()

  // Store conversation with HTML (NEW)
  conversations.set(conversationId, {
    session_id,
    html,           // NEW: Full HTML for chunk retrieval
    timestamp: Date.now()
  })

  // ... spawn Claude process as before ...
  res.json({ conversationId })
})

// NEW: Get HTML chunk by selector
app.get('/conversations/:id/chunk', (req, res) => {
  const { selector } = req.query
  const conv = conversations.get(req.params.id)
  if (!conv) return res.status(404).json({ error: 'Conversation not found' })

  // Use cheerio to extract chunk from stored HTML
  const $ = cheerio.load(conv.html)
  const element = $(selector)
  if (!element.length) return res.status(404).json({ error: 'Element not found' })

  res.json({
    selector,
    html: element.prop('outerHTML'),
    found: true
  })
})

// Refresh HTML (user triggered)
app.post('/conversations/:id/refresh', (req, res) => {
  const { html } = req.body
  const conv = conversations.get(req.params.id)
  if (!conv) return res.status(404).json({ error: 'Conversation not found' })

  conv.html = html
  conv.timestamp = Date.now()

  res.json({ success: true })
})
```

### CLI Tool

**New file: `claude-code-bridge/bin/get-chunk.js`**

```javascript
#!/usr/bin/env node
const { program } = require('commander')
const fetch = require('node-fetch')

program
  .requiredOption('--conversation-id <id>', 'Conversation ID')
  .requiredOption('--selector <selector>', 'CSS selector')
  .option('--bridge-url <url>', 'Bridge server URL', 'http://localhost:3456')

program.parse()
const opts = program.opts()

async function getChunk() {
  const url = `${opts.bridgeUrl}/conversations/${opts.conversationId}/chunk?selector=${encodeURIComponent(opts.selector)}`
  const response = await fetch(url)
  const data = await response.json()

  if (data.error) {
    console.error(`Error: ${data.error}`)
    process.exit(1)
  }

  console.log(data.html)
}

getChunk()
```

**Usage by Claude Code:**
```bash
npx @absmartly/claude-code-bridge get-chunk \
  --conversation-id conv-abc-123 \
  --selector "section.hero"
```

---

## API Provider Architecture (Anthropic/OpenAI)

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│               1. INITIAL REQUEST                                 │
├─────────────────────────────────────────────────────────────────┤
│  Extension captures HTML and caches it locally                  │
│  Sends DOM structure (not full HTML) to API                     │
│                                                                 │
│  Request:                                                       │
│  {                                                              │
│    system: "... DOM Structure: body\n├── header...",            │
│    messages: [{ role: "user", content: "Change hero" }],        │
│    tools: [get_html_chunk, dom_changes_generator]               │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               2. TOOL CALL: get_html_chunk                       │
├─────────────────────────────────────────────────────────────────┤
│  API Response:                                                  │
│  { type: "tool_use", name: "get_html_chunk",                    │
│    input: { selector: "section.hero" }}                         │
│                                                                 │
│  Extension QUERIES LIVE DOM via content script:                 │
│  - Finds element matching selector                              │
│  - Returns current HTML (may differ from initial capture)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               3. TOOL RESULT (Native Multi-Turn)                 │
├─────────────────────────────────────────────────────────────────┤
│  Request (Anthropic format):                                    │
│  {                                                              │
│    messages: [                                                  │
│      { role: "user", content: "Change hero" },                  │
│      { role: "assistant", content: [tool_use block] },          │
│      { role: "user", content: [                                 │
│        { type: "tool_result",                                   │
│          content: "<section class='hero'>...</section>" }       │
│      ]}                                                         │
│    ]                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               4. FINAL RESULT: dom_changes_generator             │
├─────────────────────────────────────────────────────────────────┤
│  API Response:                                                  │
│  { type: "tool_use", name: "dom_changes_generator",             │
│    input: { domChanges: [...], response: "...", action: "..." }}│
└─────────────────────────────────────────────────────────────────┘
```

### Real-Time DOM Query via Content Script

**In content script (`content.tsx`):**

```typescript
// Listen for HTML chunk requests from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_HTML_CHUNK') {
    const { selector } = message
    const element = document.querySelector(selector)

    if (!element) {
      sendResponse({ error: `Element not found: ${selector}` })
      return
    }

    sendResponse({
      selector,
      html: element.outerHTML,
      found: true
    })
  }
})
```

**In API provider (agentic loop):**

```typescript
async generate(...) {
  let iterations = 0
  const MAX_ITERATIONS = 5

  while (iterations < MAX_ITERATIONS) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      messages,
      tools: [this.getHtmlChunkTool(), this.getDomChangesTool()],
      tool_choice: { type: 'auto' }
    })

    const toolUse = response.content.find(c => c.type === 'tool_use')

    if (!toolUse) break

    if (toolUse.name === 'get_html_chunk') {
      // Query live DOM via content script
      const chunk = await this.queryLiveDOM(toolUse.input.selector)

      // Add to messages for next turn
      messages.push({ role: 'assistant', content: response.content })
      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: chunk.html
        }]
      })
      iterations++
      continue
    }

    if (toolUse.name === 'dom_changes_generator') {
      return this.validateAndReturn(toolUse.input, session)
    }
  }
}
```

---

## Refresh HTML Feature

### UI Component

**Add to extension sidebar:**

```tsx
<Button
  id="refresh-html-button"
  variant="outline"
  onClick={handleRefreshHTML}
  disabled={isRefreshing}
>
  {isRefreshing ? 'Refreshing...' : 'Refresh HTML'}
</Button>
```

### Behavior by Provider

| Provider | Refresh Action |
|----------|----------------|
| **Bridge** | Re-capture DOM, POST to `/conversations/:id/refresh`, send new structure summary in next message |
| **API** | Re-capture DOM, update local cache, next `get_html_chunk` returns fresh HTML |

---

## Implementation Plan

### Phase 1: DOM Structure Generator

**New file: `src/lib/ai-providers/dom-structure.ts`**

```typescript
interface DOMNode {
  tag: string
  id?: string
  classes?: string[]
  selector: string          // Computed unique selector
  childCount: number        // Number of direct children
  textPreview?: string      // First 50 chars of text content
  children?: DOMNode[]      // Recursive children (up to depth)
}

interface DOMStructure {
  root: DOMNode
  totalElements: number
  maxDepth: number
  timestamp: number
}

function generateDOMStructure(html: string, options?: {
  maxDepth?: number           // Default: 4
  includeTextPreview?: boolean
  excludeSelectors?: string[]
}): DOMStructure

function formatDOMStructureAsText(structure: DOMStructure): string
```

### Phase 2: Bridge Server Updates

1. Extend existing `POST /conversations` to accept `html` param
2. Add `GET /conversations/:id/chunk` endpoint (NEW)
3. Add `POST /conversations/:id/refresh` endpoint (NEW)
4. Create CLI tool: `bin/get-chunk.js`
5. Update `package.json` with bin entry

### Phase 3: Extension Updates

1. **ClaudeCodeBridgeClient** - Extend `createConversation()` to accept `html`:
   ```typescript
   async createConversation(
     sessionId: string,
     cwd: string,
     permissionMode: 'ask' | 'allow' = 'ask',
     jsonSchema?: any,
     html?: string         // NEW: stored on bridge for chunk retrieval
   ): Promise<{ conversationId: string }>
   ```
2. **DOM Structure Generator** - Generate structure from HTML locally
3. **Bridge Provider** - Pass HTML when creating conversation, include structure in system prompt
4. **Content Script** - Add message listener for `GET_HTML_CHUNK` (for API providers)
5. **API Providers** - Implement agentic loop with tool calls
6. **UI** - Add Refresh HTML button

### Phase 4: System Prompt Updates

Add new section explaining:
- DOM structure format
- How to use `get_html_chunk` tool
- When to request chunks vs generate changes
- Refresh HTML capability

---

## File Structure

```
src/lib/ai-providers/
├── anthropic.ts           # Updated with agentic loop
├── openai.ts              # Updated with agentic loop
├── bridge.ts              # Updated to send HTML at start
├── dom-structure.ts       # NEW: DOM structure generator
├── html-cache.ts          # NEW: HTML caching by conversation ID
├── html-chunk-tool.ts     # NEW: Tool definitions
└── ...

claude-code-bridge/
├── index.js               # Updated with new endpoints
├── bin/
│   └── get-chunk.js       # NEW: CLI tool
└── package.json           # Updated with bin entry
```

---

## Conversation ID as Cache Key

Using conversation ID (not page URL or tab ID) allows:

1. **Session resume across windows** - User can close browser, reopen, and continue
2. **Multiple tabs on same URL** - Each conversation has its own context
3. **Simple lookup** - Both extension and bridge use same key

```typescript
// Extension side
const htmlCache = new Map<string, { html: string, structure: DOMStructure }>()

function cacheHTML(conversationId: string, html: string) {
  const structure = generateDOMStructure(html)
  htmlCache.set(conversationId, { html, structure })
}

function getChunk(conversationId: string, selector: string) {
  const cached = htmlCache.get(conversationId)
  if (!cached) throw new Error('No HTML cached for conversation')
  // Extract chunk from cached HTML
}
```

---

## Success Metrics

- **Token reduction**: 50%+ reduction in input tokens for large pages
- **Accuracy**: No regression in DOM change accuracy
- **Latency**: Acceptable despite multi-turn (< 2x single-turn)
- **Reliability**: <1% fallback to full HTML mode
- **Provider parity**: All three providers work consistently

---

## Rollout Strategy

1. **Feature flag**: Add `useChunkedHTML` option in settings
2. **Fallback**: If structure/chunk fails, fall back to full HTML
3. **Gradual rollout**:
   - Phase 1: API providers (native tool support)
   - Phase 2: Bridge provider (after CLI tool tested)
