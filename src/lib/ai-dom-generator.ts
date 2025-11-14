import Anthropic from '@anthropic-ai/sdk'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import { debugLog, debugError } from '~src/utils/debug'
import { ClaudeCodeBridgeClient } from '~src/lib/claude-code-client'
import { AI_DOM_GENERATION_SYSTEM_PROMPT } from '~src/prompts/ai-dom-generation-system-prompt'

const SYSTEM_PROMPT = AI_DOM_GENERATION_SYSTEM_PROMPT

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
    debugLog('🤖 Generating DOM changes with AI...')
    debugLog('📝 Prompt:', prompt)
    debugLog('📄 HTML length:', html.length)
    debugLog('🖼️ Images:', images?.length || 0)

    // Try Claude Code Bridge first (uses Claude subscription, no API costs)
    try {
      debugLog('🔗 Attempting to use Claude Code Bridge...')
      const result = await generateWithBridge(html, prompt, currentChanges, images, options?.conversationSession)
      debugLog('✅ Successfully generated with Claude Code Bridge')
      return result
    } catch (bridgeError) {
      debugLog('⚠️ Claude Code Bridge not available, falling back to Anthropic API:', bridgeError)
      console.log('[AI Generator] Bridge unavailable, using Anthropic API fallback')
    }

    let authConfig: any = { dangerouslyAllowBrowser: true }

    if (options?.useOAuth && options?.oauthToken) {
      debugLog('🔐 Using OAuth token for authentication')
      authConfig.apiKey = options.oauthToken
      authConfig.defaultHeaders = {
        'Authorization': `Bearer ${options.oauthToken}`
      }
    } else if (apiKey) {
      debugLog('🔑 Using API key for authentication')
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

    let systemPrompt = SYSTEM_PROMPT
    if (!session.htmlSent) {
      systemPrompt += `\n\nHTML Content:\n\`\`\`html\n${html.slice(0, 50000)}\n\`\`\``
      session.htmlSent = true
      debugLog('📄 Including HTML in system prompt (initializing conversation)')
    }

    let userMessageText = ''

    if (currentChanges.length > 0) {
      userMessageText += `Current DOM Changes:\n\`\`\`json\n${JSON.stringify(currentChanges, null, 2)}\n\`\`\`\n\n`
    }

    userMessageText += `User Request: ${prompt}`

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

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [...session.messages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      })), newUserMessage] as Anthropic.MessageParam[]
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    let responseText = content.text.trim()
    debugLog('🤖 AI Response:', responseText.substring(0, 200))

    let textBefore = ''
    let textAfter = ''
    let jsonText = responseText

    if (responseText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    const jsonMatch = jsonText.match(/^(.*?)(\{[\s\S]*\})(.*?)$/s)
    if (jsonMatch) {
      textBefore = jsonMatch[1].trim()
      jsonText = jsonMatch[2].trim()
      textAfter = jsonMatch[3].trim()
    }

    const validation = validateAIDOMGenerationResult(jsonText)

    if (validation.isValid) {
      if (textBefore || textAfter) {
        let modifiedResponse = validation.result.response
        if (textBefore) {
          modifiedResponse = textBefore + '\n\n' + modifiedResponse
          debugLog('📝 Prepended text before JSON:', textBefore.substring(0, 100))
        }
        if (textAfter) {
          modifiedResponse = modifiedResponse + '\n\n' + textAfter
          debugLog('📝 Appended text after JSON:', textAfter.substring(0, 100))
        }
        validation.result.response = modifiedResponse
      }
      debugLog('✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)

      session.messages.push({ role: 'assistant', content: validation.result.response })

      return {
        ...validation.result,
        session
      }
    }

    debugLog('ℹ️ Response is not structured JSON, normalizing as conversational message')

    session.messages.push({ role: 'assistant', content: responseText })

    return {
      domChanges: [],
      response: responseText,
      action: 'none',
      session
    }
  } catch (error) {
    debugError('❌ Failed to generate DOM changes:', error)
    throw error
  }
}

async function generateWithBridge(html: string, prompt: string, currentChanges: DOMChange[] = [], images?: string[], conversationSession?: ConversationSession): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
  const bridgeClient = new ClaudeCodeBridgeClient()

  try {
    await bridgeClient.connect()

    let session = conversationSession
    let conversationId: string
    let systemPromptToSend = SYSTEM_PROMPT

    if (!session || !session.conversationId) {
      const sessionId = crypto.randomUUID()

      systemPromptToSend += `\n\nHTML Content:\n\`\`\`html\n${html.slice(0, 50000)}\n\`\`\``
      debugLog('[Bridge] Including HTML in system prompt (initializing conversation)')

      const result = await bridgeClient.createConversation(
        sessionId,
        '/',
        'allow'
      )
      conversationId = result.conversationId

      session = {
        id: sessionId,
        htmlSent: true,
        messages: [],
        conversationId
      }
      debugLog('[Bridge] Created new conversation:', conversationId)
    } else {
      conversationId = session.conversationId
      debugLog('[Bridge] Reusing existing conversation:', conversationId)
    }

    let userMessage = ''

    if (currentChanges.length > 0) {
      userMessage += `Current DOM Changes:\n\`\`\`json\n${JSON.stringify(currentChanges, null, 2)}\n\`\`\`\n\n`
    }

    userMessage += `User Request: ${prompt}`
    session.messages.push({ role: 'user', content: userMessage })

    const responseText = await new Promise<string>((resolve, reject) => {
      let fullResponse = ''

      debugLog('[Bridge] Starting stream for conversation:', conversationId)
      const eventSource = bridgeClient.streamResponses(
        conversationId,
        (event) => {
          debugLog('[Bridge] Received event:', event.type, event.data?.substring(0, 100))
          if (event.type === 'text') {
            fullResponse += event.data
          } else if (event.type === 'done') {
            debugLog('[Bridge] Stream done, full response length:', fullResponse.length)
            eventSource.close()
            resolve(fullResponse)
          } else if (event.type === 'error') {
            debugError('[Bridge] Claude error:', event.data)
            eventSource.close()
            reject(new Error(`Claude error: ${event.data || 'Unknown error'}`))
          }
        },
        (error) => {
          debugError('[Bridge] Stream error:', error)
          eventSource.close()
          reject(error)
        }
      )

      setTimeout(async () => {
        debugLog('[Bridge] Sending message to conversation:', conversationId)
        try {
          await bridgeClient.sendMessage(conversationId, userMessage, images || [], systemPromptToSend)
          debugLog('[Bridge] Message sent successfully')
        } catch (error) {
          debugError('[Bridge] Failed to send message:', error)
          eventSource.close()
          reject(error)
        }
      }, 100)

      setTimeout(() => {
        debugError('[Bridge] Response timeout after 60s')
        eventSource.close()
        reject(new Error('Bridge response timeout after 60s'))
      }, 60000)
    })

    let cleanedResponse = responseText.trim()
    let textBefore = ''
    let textAfter = ''
    let jsonText = cleanedResponse

    if (cleanedResponse.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    const jsonMatch = jsonText.match(/^(.*?)(\{[\s\S]*\})(.*?)$/s)
    if (jsonMatch) {
      textBefore = jsonMatch[1].trim()
      jsonText = jsonMatch[2].trim()
      textAfter = jsonMatch[3].trim()
    }

    debugLog('[Bridge] Validating response')
    const validation = validateAIDOMGenerationResult(jsonText)

    if (validation.isValid) {
      if (textBefore || textAfter) {
        let modifiedResponse = validation.result.response
        if (textBefore) {
          modifiedResponse = textBefore + '\n\n' + modifiedResponse
          debugLog('[Bridge] Prepended text before JSON:', textBefore.substring(0, 100))
        }
        if (textAfter) {
          modifiedResponse = modifiedResponse + '\n\n' + textAfter
          debugLog('[Bridge] Appended text after JSON:', textAfter.substring(0, 100))
        }
        validation.result.response = modifiedResponse
      }
      debugLog('✅ Generated', validation.result.domChanges.length, 'DOM changes via bridge with action:', validation.result.action)

      session.messages.push({ role: 'assistant', content: validation.result.response })

      return {
        ...validation.result,
        session
      }
    }

    debugLog('ℹ️ Response is not structured JSON, normalizing as conversational message')

    session.messages.push({ role: 'assistant', content: cleanedResponse })

    return {
      domChanges: [],
      response: cleanedResponse,
      action: 'none',
      session
    }
  } catch (error) {
    debugError('❌ Bridge generation failed:', error)
    throw new Error(`Claude Code Bridge error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    bridgeClient.disconnect()
  }
}
