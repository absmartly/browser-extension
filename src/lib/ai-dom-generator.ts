import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import { ClaudeCodeBridgeClient } from '~src/lib/claude-code-client'
import { AI_DOM_GENERATION_SYSTEM_PROMPT } from '~src/prompts/ai-dom-generation-system-prompt'
import { getSystemPromptOverride } from '~src/components/SystemPromptEditor'

const SYSTEM_PROMPT = AI_DOM_GENERATION_SYSTEM_PROMPT

async function getSystemPrompt(): Promise<string> {
  const override = await getSystemPromptOverride()
  return override || SYSTEM_PROMPT
}

// Tool definition for Anthropic Claude
const DOM_CHANGES_TOOL: Anthropic.Tool = {
  name: 'dom_changes_generator',
  description: 'Generates DOM change objects for A/B tests. Each change targets elements via CSS selectors.',
  input_schema: {
    type: 'object',
    properties: {
      domChanges: {
        type: 'array',
        description: 'Array of DOM change objects. Each must have: selector (CSS), type (text|html|style|styleRules|class|attribute|javascript|move|create|delete), and type-specific properties.',
        items: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for target element(s)' },
            type: {
              type: 'string',
              enum: ['text', 'html', 'style', 'styleRules', 'class', 'attribute', 'javascript', 'move', 'create', 'delete'],
              description: 'Type of DOM change to apply'
            },
            value: { description: 'Value for text/html/attribute changes, or CSS object for style changes' },
            css: { type: 'object', description: 'CSS properties object for style type (alternative to value)' },
            states: { type: 'object', description: 'CSS states for styleRules type (normal, hover, active, focus)' },
            add: { type: 'array', items: { type: 'string' }, description: 'Classes to add (for class type)' },
            remove: { type: 'array', items: { type: 'string' }, description: 'Classes to remove (for class type)' },
            element: { type: 'string', description: 'HTML to create (for create type)' },
            targetSelector: { type: 'string', description: 'Target location (for move/create types)' },
            position: { type: 'string', enum: ['before', 'after', 'firstChild', 'lastChild'], description: 'Position relative to target' },
            important: { type: 'boolean', description: 'Add !important flag to styles' },
            waitForElement: { type: 'boolean', description: 'Wait for element to appear (SPA mode)' }
          },
          required: ['selector', 'type']
        }
      },
      response: {
        type: 'string',
        description: 'Markdown explanation of what you changed and why. No action descriptions (no "I\'ll click..." or "Let me navigate...").'
      },
      action: {
        type: 'string',
        enum: ['append', 'replace_all', 'replace_specific', 'remove_specific', 'none'],
        description: 'How to apply changes: append=add to existing, replace_all=clear all first, replace_specific=replace specific selectors, remove_specific=remove specific selectors, none=no changes'
      },
      targetSelectors: {
        type: 'array',
        description: 'CSS selectors to target when action is replace_specific or remove_specific',
        items: { type: 'string' }
      }
    },
    required: ['domChanges', 'response', 'action']
  }
}

// Tool definition for OpenAI (uses different schema format)
const DOM_CHANGES_TOOL_OPENAI: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'dom_changes_generator',
    description: 'Generates DOM change objects for A/B tests. Each change targets elements via CSS selectors.',
    parameters: {
      type: 'object',
      properties: {
        domChanges: {
          type: 'array',
          description: 'Array of DOM change objects. Each must have: selector (CSS), type (text|html|style|styleRules|class|attribute|javascript|move|create|delete), and type-specific properties.',
          items: {
            type: 'object',
            properties: {
              selector: { type: 'string', description: 'CSS selector for target element(s)' },
              type: {
                type: 'string',
                enum: ['text', 'html', 'style', 'styleRules', 'class', 'attribute', 'javascript', 'move', 'create', 'delete'],
                description: 'Type of DOM change to apply'
              },
              value: { description: 'Value for text/html/attribute changes, or CSS object for style changes' },
              css: { type: 'object', description: 'CSS properties object for style type (alternative to value)' },
              states: { type: 'object', description: 'CSS states for styleRules type (normal, hover, active, focus)' },
              add: { type: 'array', items: { type: 'string' }, description: 'Classes to add (for class type)' },
              remove: { type: 'array', items: { type: 'string' }, description: 'Classes to remove (for class type)' },
              element: { type: 'string', description: 'HTML to create (for create type)' },
              targetSelector: { type: 'string', description: 'Target location (for move/create types)' },
              position: { type: 'string', enum: ['before', 'after', 'firstChild', 'lastChild'], description: 'Position relative to target' },
              important: { type: 'boolean', description: 'Add !important flag to styles' },
              waitForElement: { type: 'boolean', description: 'Wait for element to appear (SPA mode)' }
            },
            required: ['selector', 'type']
          }
        },
        response: {
          type: 'string',
          description: 'Markdown explanation of what you changed and why. No action descriptions (no "I\'ll click..." or "Let me navigate...").'
        },
        action: {
          type: 'string',
          enum: ['append', 'replace_all', 'replace_specific', 'remove_specific', 'none'],
          description: 'How to apply changes: append=add to existing, replace_all=clear all first, replace_specific=replace specific selectors, remove_specific=remove specific selectors, none=no changes'
        },
        targetSelectors: {
          type: 'array',
          description: 'CSS selectors to target when action is replace_specific or remove_specific',
          items: { type: 'string' }
        }
      },
      required: ['domChanges', 'response', 'action']
    }
  }
}

interface ValidationError {
  isValid: false
  errors: string[]
}

interface ValidationSuccess {
  isValid: true
  result: AIDOMGenerationResult
}

type ValidationResult = ValidationError | ValidationSuccess

function validateAIDOMGenerationResult(responseText: string): ValidationResult {
  const errors: string[] = []

  let parsedResult: any
  try {
    parsedResult = JSON.parse(responseText)
  } catch (error) {
    return {
      isValid: false,
      errors: ['Response is not valid JSON. Your response must be pure JSON starting with { and ending with }.']
    }
  }

  if (!parsedResult.domChanges) {
    errors.push('Missing required field: "domChanges" (must be an array of DOM change objects)')
  } else if (!Array.isArray(parsedResult.domChanges)) {
    errors.push('"domChanges" must be an array, got: ' + typeof parsedResult.domChanges)
  }

  if (!parsedResult.response) {
    errors.push('Missing required field: "response" (must be a string with your conversational message)')
  } else if (typeof parsedResult.response !== 'string') {
    errors.push('"response" must be a string, got: ' + typeof parsedResult.response)
  }

  if (!parsedResult.action) {
    errors.push('Missing required field: "action" (must be one of: append, replace_all, replace_specific, remove_specific, none)')
  } else if (!['append', 'replace_all', 'replace_specific', 'remove_specific', 'none'].includes(parsedResult.action)) {
    errors.push(`"action" must be one of: append, replace_all, replace_specific, remove_specific, none. Got: "${parsedResult.action}"`)
  }

  if ((parsedResult.action === 'replace_specific' || parsedResult.action === 'remove_specific') &&
      (!parsedResult.targetSelectors || !Array.isArray(parsedResult.targetSelectors) || parsedResult.targetSelectors.length === 0)) {
    errors.push(`Action "${parsedResult.action}" requires a non-empty "targetSelectors" array`)
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    result: parsedResult as AIDOMGenerationResult
  }
}

// Legacy prompt kept for reference (replaced by comprehensive prompt above)
const LEGACY_SYSTEM_PROMPT = `You are an AI assistant specialized in generating DOM changes for the ABsmartly A/B testing platform.

Your task is to analyze HTML and generate valid DOM change objects based on user requests.

## Available DOM Change Types:

### 1. text - Change text content
{
  "selector": "CSS selector",
  "type": "text",
  "value": "New text content",
  "enabled": true,
  "waitForElement": false
}

### 2. html - Change innerHTML
{
  "selector": "CSS selector",
  "type": "html",
  "value": "<div>New HTML content</div>",
  "enabled": true,
  "waitForElement": false
}

### 3. style - Apply inline CSS styles
{
  "selector": "CSS selector",
  "type": "style",
  "value": {
    "background-color": "#ff0000",
    "color": "white",
    "padding": "10px"
  },
  "mode": "merge",
  "enabled": true,
  "waitForElement": false
}

### 4. styleRules - Apply CSS with pseudo-states
{
  "selector": "CSS selector",
  "type": "styleRules",
  "states": {
    "normal": {
      "background-color": "#007bff",
      "color": "white"
    },
    "hover": {
      "background-color": "#0056b3"
    },
    "active": {
      "background-color": "#004085"
    }
  },
  "important": false,
  "enabled": true,
  "waitForElement": false
}

### 5. class - Add/remove CSS classes
{
  "selector": "CSS selector",
  "type": "class",
  "add": ["class1", "class2"],
  "remove": ["class3"],
  "mode": "merge",
  "enabled": true,
  "waitForElement": false
}

### 6. attribute - Modify element attributes
{
  "selector": "CSS selector",
  "type": "attribute",
  "value": {
    "href": "https://example.com",
    "target": "_blank"
  },
  "mode": "merge",
  "enabled": true,
  "waitForElement": false
}

### 7. remove - Hide/remove element
{
  "selector": "CSS selector",
  "type": "remove",
  "enabled": true,
  "waitForElement": false
}

### 8. insert - Insert HTML near element
{
  "selector": "CSS selector (reference element)",
  "type": "insert",
  "html": "<div>Content to insert</div>",
  "position": "before",
  "enabled": true,
  "waitForElement": false
}

### 9. move - Move element to new location
{
  "selector": "CSS selector (element to move)",
  "type": "move",
  "targetSelector": "CSS selector (destination)",
  "position": "after",
  "enabled": true,
  "waitForElement": false
}

### 10. create - Create new element
{
  "selector": "unique-id-for-created-element",
  "type": "create",
  "element": "<div>New element HTML</div>",
  "targetSelector": "CSS selector (parent)",
  "position": "lastChild",
  "enabled": true,
  "waitForElement": false
}

## Important Guidelines:

1. **Selectors**: Use CSS selectors that are specific but not overly fragile. Prefer class names, IDs, or semantic attributes over deeply nested selectors.

2. **Specificity**: Choose the most appropriate change type. For example:
   - Use "text" for simple text changes
   - Use "style" for basic CSS changes
   - Use "styleRules" when you need hover/active states
   - Use "remove" instead of "style" with display:none

3. **Multiple Changes**: You can return multiple DOM changes if the user's request requires it.

4. **Enabled**: Always set "enabled": true for new changes.

5. **waitForElement**: Set to true if the element might not be immediately present on page load.

6. **Position values**: Can be "before", "after", "firstChild", or "lastChild"

7. **Mode values**: Can be "replace" or "merge" (default is "merge")

## Response Format:

Return ONLY a valid JSON array of DOM change objects. No explanation, no markdown formatting, just the JSON array.

Example response:
[
  {
    "selector": ".cta-button",
    "type": "style",
    "value": {
      "background-color": "#ff0000"
    },
    "enabled": true
  }
]

Analyze the provided HTML and user request, then generate the appropriate DOM changes.`

// Shared HTML sanitization - removes invalid Unicode characters
function sanitizeHtml(htmlStr: string): string {
  return htmlStr
    .split('')
    .map((char, index, arr) => {
      const code = char.charCodeAt(0)

      if (code >= 0xD800 && code <= 0xDBFF) {
        if (index + 1 < arr.length) {
          const nextCode = arr[index + 1].charCodeAt(0)
          if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
            return char
          }
        }
        return ''
      }

      if (code >= 0xDC00 && code <= 0xDFFF) {
        return ''
      }

      if (code >= 0x00 && code <= 0x08) return ''
      if (code === 0x0B || code === 0x0C) return ''
      if (code >= 0x0E && code <= 0x1F) return ''
      if (code === 0xFFFD) return ''

      return char
    })
    .join('')
}

// Shared HTML compression - removes extension elements and reduces size
function compressHtml(html: string): string {
  if (!html) {
    console.error('[Compress] ❌ HTML is undefined or empty!')
    return ''
  }

  let compressed = html
  console.log('[Compress] Starting compression, original length:', html.length)

  const plasmoLoadingStart = compressed.indexOf('<div id="__plasmo-loading__"')
  if (plasmoLoadingStart !== -1) {
    let depth = 0
    let inTag = false
    let currentTag = ''
    let plasmoEnd = -1

    for (let i = plasmoLoadingStart; i < compressed.length; i++) {
      const char = compressed[i]

      if (char === '<') {
        inTag = true
        currentTag = ''
      } else if (char === '>') {
        inTag = false

        if (currentTag.startsWith('div') || currentTag.startsWith('div ')) {
          depth++
        } else if (currentTag === '/div') {
          depth--
          if (depth === 0) {
            plasmoEnd = i + 1
            break
          }
        }
        currentTag = ''
      } else if (inTag) {
        currentTag += char
      }
    }

    if (plasmoEnd !== -1) {
      console.log('[Compress] Removing Plasmo loading div:', plasmoEnd - plasmoLoadingStart, 'characters')
      compressed = compressed.substring(0, plasmoLoadingStart) + compressed.substring(plasmoEnd)
    }
  }

  const beforeOtherPlasmo = compressed.length
  compressed = compressed
    .replace(/<div[^>]*id="__plasmo"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<plasmo-csui[^>]*>[\s\S]*?<\/plasmo-csui>/gi, '')
    .replace(/<div[^>]*data-plasmo[^>]*>[\s\S]*?<\/div>/gi, '')
    // Remove extension debug divs
    .replace(/<div[^>]*id="absmartly-debug-[^"]*"[^>]*>.*?<\/div>/gi, '')

  console.log('[Compress] After other Plasmo removal:', compressed.length, 'Removed:', beforeOtherPlasmo - compressed.length)

  compressed = compressed
    .replace(/<iframe[^>]*id="absmartly-sidebar-iframe"[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe[^>]*chrome-extension[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<div[^>]*id="absmartly-preview-header-host"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/\s+data-absmartly-preview-[a-z-]+="[^"]*"/gi, '')
    .replace(/\s+data-absmartly-original-[a-z-]+="[^"]*"/gi, '')
    .replace(/\s+data-absmartly-modified="[^"]*"/gi, '')
    .replace(/<div[^>]*class="[^"]*extension[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    // Remove noisy Framer framework attributes (keep data-framer-name as it's useful)
    .replace(/\s+data-framer-hydrate-v2="[^"]*"/gi, '')
    .replace(/\s+data-framer-appear-id="[^"]*"/gi, '')
    .replace(/\s+data-framer-ssr-released-at="[^"]*"/gi, '')
    .replace(/\s+data-framer-page-optimized-at="[^"]*"/gi, '')
    .replace(/\s+data-framer-generated-page="[^"]*"/gi, '')
    .replace(/\s+data-framer-component-type="[^"]*"/gi, '')
    .replace(/\s+data-styles-preset="[^"]*"/gi, '')
    .replace(/\s+data-framer-page-link-current="[^"]*"/gi, '')

  const beforeHeadStrip = compressed.length
  compressed = compressed.replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, (match, headContent) => {
    let styleTags = (headContent.match(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi) || [])
      // Filter out framework styles
      .filter(tag => {
        return !tag.includes('plasmo') &&
               !tag.includes('__plasmo') &&
               !tag.includes('data-plasmo') &&
               !tag.includes('data-framer-css-ssr-minified') && // Framer framework CSS
               !tag.includes('__framer-editorbar') && // Framer editor
               !tag.includes('_goober') && // Goober framework
               !tag.includes('type="text/css"') // External font imports
      })
      .map(tag => {
        // Remove @font-face declarations
        let cleaned = tag.replace(/@font-face\s*\{[^}]*\}/gi, '')
        // Remove empty font comments
        cleaned = cleaned.replace(/\/\*\s*(vietnamese|latin-ext|latin|cyrillic-ext|cyrillic|greek)\s*\*\//gi, '')
        // Remove ALL CSS comments
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove @import statements (external fonts)
        cleaned = cleaned.replace(/@import\s+url\([^)]+\);?/gi, '')
        return cleaned
      })
      .filter(tag => {
        const content = tag.replace(/<\/?style[^>]*>/gi, '').trim()
        // Keep if has actual CSS (not just comments/whitespace)
        return content.length > 0 && !content.match(/^\/\*[\s\S]*\*\/$/)
      })

    console.log('[Compress] Found', styleTags.length, 'essential style tags in head')
    return styleTags.length > 0 ? `<head>${styleTags.join('')}</head>` : '<head></head>'
  })
  console.log('[Compress] After head strip:', compressed.length, 'Removed:', beforeHeadStrip - compressed.length)

  return compressed
    // Remove Framer editor UI elements
    .replace(/<div[^>]*id="__framer-editorbar-container"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<iframe[^>]*id="__framer-editorbar"[^>]*>[\s\S]*?<\/iframe>/gi, '')
    // Remove tooltip containers
    .replace(/<div[^>]*id="tooltip-root"[^>]*>[\s\S]*?<\/div>/gi, '')
    // Remove HubSpot interactives
    .replace(/<div[^>]*id="hs-web-interactives-[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    // Remove other framework containers
    .replace(/<div[^>]*id="tldx-[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<tldx-lmi-shadow-root[^>]*>[\s\S]*?<\/tldx-lmi-shadow-root>/gi, '')
    // Remove archetype and other tracking iframes
    .replace(/<iframe[^>]*owner="archetype"[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    // Remove scripts, comments, inline styles, and inline JS handlers
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+style="[^"]*"/gi, '')
    // Remove inline JavaScript event handlers
    .replace(/\s+on[a-z]+="[^"]*"/gi, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim()
}

export async function generateDOMChanges(
  html: string,
  prompt: string,
  apiKey: string,
  currentChanges: DOMChange[] = [],
  images?: string[],
  options?: {
    useOAuth?: boolean
    oauthToken?: string
    aiProvider?: 'claude-subscription' | 'anthropic-api' | 'openai-api'
    conversationSession?: ConversationSession
  }
): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
  try {
    console.log('[AI Gen] 🤖 Generating DOM changes with AI...')
    console.log('[AI Gen] 📝 Prompt:', prompt)
    console.log('[AI Gen] 📄 HTML defined:', !!html)
    console.log('[AI Gen] 📄 HTML type:', typeof html)
    console.log('[AI Gen] 📄 HTML length:', html?.length || 'undefined')
    console.log('[AI Gen] 🖼️ Images:', images?.length || 0)
    console.log('[AI Gen] 💾 Has conversation session:', !!options?.conversationSession)
    if (options?.conversationSession) {
      console.log('[AI Gen] Session ID:', options.conversationSession.id)
      console.log('[AI Gen] Session conversationId:', options.conversationSession.conversationId)
      console.log('[AI Gen] Session htmlSent:', options.conversationSession.htmlSent)
    }

    // Validate HTML is provided (unless session already has it sent)
    if (!html && !options?.conversationSession?.htmlSent) {
      throw new Error('HTML is required for the first message in a conversation')
    }

    // SHARED: Compress and sanitize HTML for all providers (only if HTML provided)
    const compressedHtml = html ? compressHtml(html) : ''
    const cleanHtml = html ? sanitizeHtml(compressedHtml) : ''
    if (html) {
      console.log('[AI Gen] Original HTML:', html.length, '→ Compressed:', compressedHtml.length, '→ Sanitized:', cleanHtml.length)
    } else {
      console.log('[AI Gen] Skipping HTML compression (using existing session HTML)')
    }

    // Try Claude Code Bridge only if explicitly using 'claude-subscription'
    if (options?.aiProvider === 'claude-subscription') {
      try {
        console.log('[AI Gen] 🔗 Attempting to use Claude Code Bridge...')
        const result = await generateWithBridge(cleanHtml, prompt, currentChanges, images, options?.conversationSession)
        console.log('[AI Gen] ✅ Successfully generated with Claude Code Bridge')
        return result
      } catch (bridgeError) {
        console.log('[AI Gen] ⚠️ Claude Code Bridge not available, falling back to API:', bridgeError)
        console.log('[AI Gen] Bridge error details:', bridgeError.message, bridgeError.stack)
      }
    }

    // Use OpenAI API if specified
    if (options?.aiProvider === 'openai-api') {
      console.log('[AI Gen] 🤖 Using OpenAI API')
      return await generateWithOpenAI(cleanHtml, prompt, apiKey, currentChanges, images, options)
    }

    // Default to Anthropic API
    console.log('[AI Gen] 🤖 Using Anthropic API')
    let authConfig: any = { dangerouslyAllowBrowser: true }

    if (options?.useOAuth && options?.oauthToken) {
      console.log('🔐 Using OAuth token for authentication')
      authConfig.apiKey = options.oauthToken
      authConfig.defaultHeaders = {
        'Authorization': `Bearer ${options.oauthToken}`
      }
    } else if (apiKey) {
      console.log('🔑 Using API key for authentication')
      authConfig.apiKey = apiKey
    } else {
      throw new Error('Either API key or OAuth token is required')
    }

    const anthropic = new Anthropic(authConfig)

    let session = options?.conversationSession
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        htmlSent: true,
        messages: []
      }
    }

    let systemPrompt = sanitizeHtml(await getSystemPrompt())
    console.log('[AI Gen] Base system prompt length:', systemPrompt.length)

    if (!session.htmlSent) {
      if (!cleanHtml) {
        throw new Error('HTML is required for first message in conversation')
      }

      systemPrompt += `\n\nHTML Content:\n\`\`\`html\n${cleanHtml}\n\`\`\``
      session.htmlSent = true
      console.log('📄 Including HTML in system prompt (initializing conversation)')
    }

    systemPrompt = sanitizeHtml(systemPrompt)
    console.log('[AI Gen] Final system prompt length after sanitization:', systemPrompt.length)

    // Print the complete system prompt to console
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 COMPLETE SYSTEM PROMPT BEING SENT TO CLAUDE:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(systemPrompt)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📊 System prompt length: ${systemPrompt.length} characters`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    let userMessageText = ''

    if (currentChanges.length > 0) {
      const sanitizedChanges = sanitizeHtml(JSON.stringify(currentChanges, null, 2))
      userMessageText += `Current DOM Changes:\n\`\`\`json\n${sanitizedChanges}\n\`\`\`\n\n`
    }

    const sanitizedPrompt = sanitizeHtml(prompt)
    userMessageText += `User Request: ${sanitizedPrompt}`

    const contentParts: Anthropic.MessageParam['content'] = [
      {
        type: 'text',
        text: userMessageText
      }
    ]

    if (images && images.length > 0) {
      for (const img of images) {
        const match = img.match(/^data:(image\/\w+);base64,(.+)$/)
        if (match) {
          const [, mediaType, base64Data] = match
          if (Array.isArray(contentParts)) {
            contentParts.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Data
              }
            })
          }
        }
      }
    }

    const newUserMessage: Anthropic.MessageParam = {
      role: 'user',
      content: contentParts
    }
    session.messages.push({ role: 'user', content: userMessageText })

    const requestBody = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [...session.messages.slice(0, -1).map(m => ({
        role: m.role,
        content: sanitizeHtml(m.content) // Sanitize historical messages too
      })), newUserMessage] as Anthropic.MessageParam[],
      tools: [DOM_CHANGES_TOOL],
      tool_choice: { type: 'tool', name: 'dom_changes_generator' }
    }

    // Test if request body can be JSON encoded before sending
    try {
      JSON.stringify(requestBody)
      console.log('[AI Gen] ✅ Request body is valid JSON')
    } catch (jsonError) {
      console.error('[AI Gen] ❌ Request body contains invalid JSON:', jsonError)
      throw new Error(`Invalid JSON in request body: ${jsonError.message}`)
    }

    const message = await anthropic.messages.create(requestBody as any)

    const content = message.content[0]

    // Handle tool use response
    if (content.type === 'tool_use') {
      console.log('🔧 Received tool_use response from Claude')
      const toolInput = content.input as any

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📦 RAW STRUCTURED OUTPUT FROM ANTHROPIC (tool call arguments):')
      console.log(JSON.stringify(toolInput, null, 2))
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      // Validate the tool input
      const validation = validateAIDOMGenerationResult(JSON.stringify(toolInput))

      if (validation.isValid) {
        console.log('✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)

        session.messages.push({ role: 'assistant', content: validation.result.response })

        return {
          ...validation.result,
          session
        }
      } else {
        console.error('❌ Tool use validation failed:', validation.errors)
        throw new Error(`Tool use validation failed: ${validation.errors.join(', ')}`)
      }
    }

    // Fallback to text parsing (should rarely be hit with tool_choice forcing)
    console.warn('⚠️ Tool calling not used - falling back to text parsing')

    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    let responseText = content.text.trim()
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📝 FULL TEXT RESPONSE FROM ANTHROPIC:')
    console.log(responseText)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Strip markdown code fences if present
    let jsonText = responseText
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    // Extract JSON object from text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }

    const validation = validateAIDOMGenerationResult(jsonText)

    if (validation.isValid) {
      console.log('✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)

      // Validate before returning
      if (!validation.result.domChanges || !Array.isArray(validation.result.domChanges)) {
        console.error('⚠️ validation.result.domChanges is invalid:', validation.result.domChanges)
        throw new Error('Validation result missing domChanges array')
      }

      session.messages.push({ role: 'assistant', content: validation.result.response })

      const returnValue = {
        ...validation.result,
        session
      }

      // Log return value structure
      console.log('[AI Generator] Returning from Anthropic API:', {
        domChanges: returnValue.domChanges?.length,
        response: returnValue.response?.substring(0, 50),
        action: returnValue.action,
        session: returnValue.session?.id
      })

      return returnValue
    }

    console.log('ℹ️ Response is not structured JSON, normalizing as conversational message')

    session.messages.push({ role: 'assistant', content: responseText })

    const returnValue = {
      domChanges: [],
      response: responseText,
      action: 'none',
      session
    }

    // Log return value structure
    console.log('[AI Generator] Returning conversational message:', {
      domChanges: returnValue.domChanges.length,
      response: returnValue.response.substring(0, 50),
      action: returnValue.action,
      session: returnValue.session?.id
    })

    return returnValue
  } catch (error) {
    console.error('❌ Failed to generate DOM changes:', error)
    throw error
  }
}

async function generateWithBridge(html: string, prompt: string, currentChanges: DOMChange[] = [], images?: string[], conversationSession?: ConversationSession): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
  console.log('[Bridge] generateWithBridge() called')
  const bridgeClient = new ClaudeCodeBridgeClient()

  try {
    console.log('[Bridge] About to call bridgeClient.connect()...')
    await bridgeClient.connect()
    console.log('[Bridge] ✅ connect() completed successfully')
    console.log('[Bridge] Connection:', bridgeClient.getConnection())

    console.log('[Bridge] Input session:', JSON.stringify(conversationSession))
    console.log('[Bridge] Input HTML:', html ? `${html.length} chars` : 'undefined')

    let session = conversationSession
    let conversationId: string
    let systemPromptToSend = await getSystemPrompt()

    if (!session || !session.conversationId) {
      console.log('[Bridge] No session or no conversationId, creating new conversation')
      console.log('[Bridge] session:', session)
      console.log('[Bridge] session.conversationId:', session?.conversationId)
      const sessionId = crypto.randomUUID()

      if (!html) {
        throw new Error('HTML is required for creating new bridge conversation')
      }
      systemPromptToSend += `\n\nHTML Content:\n\`\`\`html\n${html}\n\`\`\``
      console.log('[Bridge] Including HTML in system prompt (initializing conversation)')

      // Print the complete system prompt to console
      console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('[Bridge] 🔍 COMPLETE SYSTEM PROMPT BEING SENT TO CLAUDE:')
      console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(systemPromptToSend)
      console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`[Bridge] 📊 System prompt length: ${systemPromptToSend.length} characters`)
      console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

      console.log('[Bridge] About to create conversation with sessionId:', sessionId)
      const result = await bridgeClient.createConversation(
        sessionId,
        '/',
        'allow',
        DOM_CHANGES_TOOL.input_schema // Pass schema to bridge
      )
      conversationId = result.conversationId
      console.log('[Bridge] ✅ Conversation created with JSON schema from extension')

      session = {
        id: sessionId,
        htmlSent: true,
        messages: [],
        conversationId
      }
      console.log('[Bridge] ✅ Created new conversation:', conversationId)
    } else {
      conversationId = session.conversationId
      console.log('[Bridge] Reusing existing conversation:', conversationId)
    }

    let userMessage = ''

    if (currentChanges.length > 0) {
      userMessage += `Current DOM Changes:\n\`\`\`json\n${JSON.stringify(currentChanges, null, 2)}\n\`\`\`\n\n`
    }

    userMessage += `User Request: ${prompt}`
    session.messages.push({ role: 'user', content: userMessage })

    const responseData = await new Promise<{ type: 'text' | 'tool_use', data: any }>((resolve, reject) => {
      let fullResponse = ''
      let receivedToolUse = false

      console.log('[Bridge] Starting stream for conversation:', conversationId)
      const eventSource = bridgeClient.streamResponses(
        conversationId,
        (event) => {
          // Log ALL events with full data for debugging
          console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log(`[Bridge] 📦 RAW EVENT TYPE: ${event.type}`)
          console.log('[Bridge] Full event data:', JSON.stringify(event, null, 2))
          console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          if (event.type === 'tool_use') {
            console.log('[Bridge] 🔧 Received tool_use response from Claude')
            receivedToolUse = true
            eventSource.close()
            resolve({ type: 'tool_use', data: event.data })
          } else if (event.type === 'text') {
            fullResponse += event.data
          } else if (event.type === 'done') {
            console.log('[Bridge] Stream done, full response length:', fullResponse.length)
            eventSource.close()
            if (!receivedToolUse) {
              resolve({ type: 'text', data: fullResponse })
            }
          } else if (event.type === 'error') {
            console.error('[Bridge] Claude error:', event.data)
            eventSource.close()
            reject(new Error(`Claude error: ${event.data || 'Unknown error'}`))
          }
        },
        (error) => {
          console.error('[Bridge] Stream error:', error)
          eventSource.close()
          reject(error)
        }
      )

      setTimeout(async () => {
        console.log('[Bridge] Sending message to conversation:', conversationId)
        try {
          await bridgeClient.sendMessage(conversationId, userMessage, images || [], systemPromptToSend, DOM_CHANGES_TOOL.input_schema)
          console.log('[Bridge] Message sent successfully (with schema)')
        } catch (error) {
          console.error('[Bridge] Failed to send message:', error)
          eventSource.close()
          reject(error)
        }
      }, 100)

      setTimeout(() => {
        console.error('[Bridge] Response timeout after 60s')
        eventSource.close()
        reject(new Error('Bridge response timeout after 60s'))
      }, 60000)
    })

    // Handle tool_use response (structured output)
    if (responseData.type === 'tool_use') {
      console.log('[Bridge] Processing tool_use response')

      console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('[Bridge] 📦 RAW STRUCTURED OUTPUT FROM CLAUDE (tool call arguments):')
      console.log(JSON.stringify(responseData.data, null, 2))
      console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      const validation = validateAIDOMGenerationResult(JSON.stringify(responseData.data))

      if (validation.isValid) {
        console.log('[Bridge] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)
        session.messages.push({ role: 'assistant', content: validation.result.response })

        return {
          ...validation.result,
          session
        }
      } else {
        console.error('[Bridge] ❌ Tool use validation failed:', validation.errors)
        throw new Error(`Tool use validation failed: ${validation.errors.join(', ')}`)
      }
    }

    // Fallback: Handle text response (should rarely be hit with tool_choice forcing)
    console.warn('[Bridge] ⚠️ Tool calling not used - falling back to text parsing')

    let responseText = responseData.data.trim()
    console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[Bridge] 📝 FULL TEXT RESPONSE:')
    console.log(responseText)
    console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Strip markdown code fences if present
    let jsonText = responseText
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    // Extract JSON object from text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }

    const validation = validateAIDOMGenerationResult(jsonText)

    if (validation.isValid) {
      console.log('[Bridge] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)

      // Validate before returning
      if (!validation.result.domChanges || !Array.isArray(validation.result.domChanges)) {
        console.error('⚠️ Bridge validation.result.domChanges is invalid:', validation.result.domChanges)
        throw new Error('Bridge validation result missing domChanges array')
      }

      session.messages.push({ role: 'assistant', content: validation.result.response })

      const returnValue = {
        ...validation.result,
        session
      }

      // Log return value structure
      console.log('[AI Generator] Returning from Bridge (validated):', {
        domChanges: returnValue.domChanges?.length,
        response: returnValue.response?.substring(0, 50),
        action: returnValue.action,
        session: returnValue.session?.id
      })

      return returnValue
    }

    console.log('[Bridge] ℹ️ Response is not structured JSON, normalizing as conversational message')

    session.messages.push({ role: 'assistant', content: responseText })

    const returnValueConv = {
      domChanges: [],
      response: responseText,
      action: 'none' as const,
      session
    }

    // Log return value structure
    console.log('[AI Generator] Returning from Bridge (conversational):', {
      domChanges: returnValueConv.domChanges.length,
      response: returnValueConv.response.substring(0, 50),
      action: returnValueConv.action,
      session: returnValueConv.session?.id
    })

    return returnValueConv
  } catch (error) {
    console.error('❌ Bridge generation failed:', error)
    throw new Error(`Claude Code Bridge error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    bridgeClient.disconnect()
  }
}

async function generateWithOpenAI(
  html: string,
  prompt: string,
  apiKey: string,
  currentChanges: DOMChange[] = [],
  images?: string[],
  options?: {
    useOAuth?: boolean
    oauthToken?: string
    conversationSession?: ConversationSession
  }
): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
  console.log('[OpenAI] generateWithOpenAI() called')

  const openai = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  })

  let session = options?.conversationSession
  if (!session) {
    session = {
      id: crypto.randomUUID(),
      htmlSent: true,
      messages: []
    }
  }

  let systemPrompt = await getSystemPrompt()
  if (!session.htmlSent) {
    if (!html) {
      throw new Error('HTML is required for first message in conversation')
    }
    systemPrompt += `\n\nHTML Content:\n\`\`\`html\n${html}\n\`\`\``
    session.htmlSent = true
    console.log('[OpenAI] Including HTML in system prompt (initializing conversation, using pre-cleaned HTML)')
  }

  console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('[OpenAI] 🔍 COMPLETE SYSTEM PROMPT BEING SENT TO OPENAI:')
  console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(systemPrompt)
  console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`[OpenAI] 📊 System prompt length: ${systemPrompt.length} characters`)
  console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  let userMessageText = ''
  if (currentChanges.length > 0) {
    userMessageText += `Current DOM Changes:\n\`\`\`json\n${JSON.stringify(currentChanges, null, 2)}\n\`\`\`\n\n`
  }
  userMessageText += `User Request: ${prompt}`

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...session.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    })),
    { role: 'user', content: userMessageText }
  ]

  if (images && images.length > 0) {
    console.log('[OpenAI] ⚠️ Note: Image support not yet implemented for OpenAI')
  }

  session.messages.push({ role: 'user', content: userMessageText })

  console.log('[OpenAI] Calling OpenAI API with tool_choice forcing...')
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: messages,
    tools: [DOM_CHANGES_TOOL_OPENAI],
    tool_choice: { type: 'function', function: { name: 'dom_changes_generator' } }
  })

  console.log('[OpenAI] Received response from OpenAI')
  const message = completion.choices[0]?.message

  if (!message) {
    throw new Error('No message in OpenAI response')
  }

  if (message.tool_calls && message.tool_calls.length > 0) {
    console.log('[OpenAI] 🔧 Received tool_calls response from OpenAI')
    const toolCall = message.tool_calls[0]

    if (toolCall.function.name === 'dom_changes_generator') {
      console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('[OpenAI] 📦 RAW STRUCTURED OUTPUT FROM OPENAI (tool call arguments):')
      console.log(toolCall.function.arguments)
      console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      const toolInput = JSON.parse(toolCall.function.arguments)
      const validation = validateAIDOMGenerationResult(JSON.stringify(toolInput))

      if (validation.isValid) {
        console.log('[OpenAI] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)
        session.messages.push({ role: 'assistant', content: validation.result.response })

        return {
          ...validation.result,
          session
        }
      } else {
        console.error('[OpenAI] ❌ Tool call validation failed:', validation.errors)
        throw new Error(`Tool call validation failed: ${validation.errors.join(', ')}`)
      }
    }
  }

  throw new Error('OpenAI did not return a tool call')
}
