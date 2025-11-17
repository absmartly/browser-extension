import Anthropic from '@anthropic-ai/sdk'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
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
    console.log('[AI Gen] 🤖 Generating DOM changes with AI...')
    console.log('[AI Gen] 📝 Prompt:', prompt)
    console.log('[AI Gen] 📄 HTML length:', html?.length || 'undefined')
    console.log('[AI Gen] 🖼️ Images:', images?.length || 0)
    console.log('[AI Gen] 💾 Has conversation session:', !!options?.conversationSession)
    if (options?.conversationSession) {
      console.log('[AI Gen] Session ID:', options.conversationSession.id)
      console.log('[AI Gen] Session conversationId:', options.conversationSession.conversationId)
      console.log('[AI Gen] Session htmlSent:', options.conversationSession.htmlSent)
    }

    // Try Claude Code Bridge first (uses Claude subscription, no API costs)
    try {
      console.log('[AI Gen] 🔗 Attempting to use Claude Code Bridge...')
      const result = await generateWithBridge(html, prompt, currentChanges, images, options?.conversationSession)
      console.log('[AI Gen] ✅ Successfully generated with Claude Code Bridge')
      return result
    } catch (bridgeError) {
      console.log('[AI Gen] ⚠️ Claude Code Bridge not available, falling back to Anthropic API:', bridgeError)
      console.log('[AI Gen] Bridge error details:', bridgeError.message, bridgeError.stack)
    }

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

    let systemPrompt = SYSTEM_PROMPT
    if (!session.htmlSent) {
      if (!html) {
        throw new Error('HTML is required for first message in conversation')
      }
      systemPrompt += `\n\nHTML Content:\n\`\`\`html\n${html.slice(0, 50000)}\n\`\`\``
      session.htmlSent = true
      console.log('📄 Including HTML in system prompt (initializing conversation)')
    }

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
    console.log('🤖 AI Response:', responseText.substring(0, 200))

    let textBefore = ''
    let textAfter = ''
    let jsonText = responseText

    if (responseText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    // Find ALL JSON objects in the response (to handle duplicate JSON)
    // Use balanced brace matching instead of regex to handle nested objects
    const allJsonMatches: Array<{ json: string; start: number; end: number }> = []
    let pos = 0
    while (pos < jsonText.length) {
      const startPos = jsonText.indexOf('{', pos)
      if (startPos === -1) break

      // Find matching closing brace by tracking depth
      let depth = 1
      let endPos = startPos + 1
      while (endPos < jsonText.length && depth > 0) {
        if (jsonText[endPos] === '{') depth++
        if (jsonText[endPos] === '}') depth--
        endPos++
      }

      if (depth === 0) {
        const potentialJson = jsonText.substring(startPos, endPos)
        // Quick validation - does it look like our response format?
        if (potentialJson.includes('"domChanges"') && potentialJson.includes('"response"') && potentialJson.includes('"action"')) {
          allJsonMatches.push({
            json: potentialJson,
            start: startPos,
            end: endPos
          })
        }
      }

      pos = endPos > startPos ? endPos : startPos + 1
    }

    // If we found multiple JSON objects, use the LAST one (most likely the actual response)
    // and collect all text before it
    let validation: ValidationResult
    if (allJsonMatches.length > 1) {
      console.log(`⚠️ Found ${allJsonMatches.length} JSON objects in response, using the LAST one`)
      const lastMatch = allJsonMatches[allJsonMatches.length - 1]
      jsonText = lastMatch.json
      textBefore = jsonText.substring(0, lastMatch.start).trim()
      textAfter = jsonText.substring(lastMatch.end).trim()

      validation = validateAIDOMGenerationResult(jsonText)
    } else if (allJsonMatches.length === 1) {
      // Single JSON object found
      const singleMatch = allJsonMatches[0]
      jsonText = singleMatch.json
      textBefore = jsonText.substring(0, singleMatch.start).trim()
      textAfter = jsonText.substring(singleMatch.end).trim()

      validation = validateAIDOMGenerationResult(jsonText)
    } else {
      // No JSON objects found, try original regex approach
      const jsonMatch = jsonText.match(/^(.*?)(\{[\s\S]*\})(.*?)$/s)
      if (jsonMatch) {
        textBefore = jsonMatch[1].trim()
        jsonText = jsonMatch[2].trim()
        textAfter = jsonMatch[3].trim()
      }

      validation = validateAIDOMGenerationResult(jsonText)
    }

    if (validation.isValid) {
      if (textBefore || textAfter) {
        let modifiedResponse = validation.result.response
        if (textBefore) {
          modifiedResponse = textBefore + '\n\n' + modifiedResponse
          console.log('📝 Prepended text before JSON:', textBefore.substring(0, 100))
        }
        if (textAfter) {
          modifiedResponse = modifiedResponse + '\n\n' + textAfter
          console.log('📝 Appended text after JSON:', textAfter.substring(0, 100))
        }
        validation.result.response = modifiedResponse
      }

      // Strip out any JSON objects that appear in the response text
      // (AI sometimes includes the JSON in its explanation, with or without code fences)
      let cleanedResponse = validation.result.response

      // Pattern 1: JSON wrapped in markdown code fences (```json ... ``` or ``` ... ```)
      const markdownJsonPattern = /```(?:json)?\s*\n?\{[\s\S]*?"domChanges"[\s\S]*?"response"[\s\S]*?"action"[\s\S]*?\}\s*\n?```/g
      cleanedResponse = cleanedResponse.replace(markdownJsonPattern, '').trim()

      // Pattern 2: Raw JSON objects (in case they're not in code fences)
      const rawJsonPattern = /(?<![`])\{[\s\S]*?"domChanges"[\s\S]*?"response"[\s\S]*?"action"[\s\S]*?\}(?![`])/g
      cleanedResponse = cleanedResponse.replace(rawJsonPattern, '').trim()

      // Clean up any extra whitespace
      cleanedResponse = cleanedResponse.replace(/\n{3,}/g, '\n\n').trim()

      if (cleanedResponse !== validation.result.response) {
        console.log('🧹 Stripped duplicate JSON from response text')
        validation.result.response = cleanedResponse
      }
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
    let systemPromptToSend = SYSTEM_PROMPT

    if (!session || !session.conversationId) {
      console.log('[Bridge] No session or no conversationId, creating new conversation')
      console.log('[Bridge] session:', session)
      console.log('[Bridge] session.conversationId:', session?.conversationId)
      const sessionId = crypto.randomUUID()

      if (!html) {
        throw new Error('HTML is required for creating new bridge conversation')
      }
      systemPromptToSend += `\n\nHTML Content:\n\`\`\`html\n${html.slice(0, 50000)}\n\`\`\``
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
        'allow'
      )
      conversationId = result.conversationId

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

    const responseText = await new Promise<string>((resolve, reject) => {
      let fullResponse = ''

      console.log('[Bridge] Starting stream for conversation:', conversationId)
      const eventSource = bridgeClient.streamResponses(
        conversationId,
        (event) => {
          console.log('[Bridge] Received event:', event.type, event.data?.substring(0, 100))
          if (event.type === 'text') {
            fullResponse += event.data
          } else if (event.type === 'done') {
            console.log('[Bridge] Stream done, full response length:', fullResponse.length)
            eventSource.close()
            resolve(fullResponse)
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
          await bridgeClient.sendMessage(conversationId, userMessage, images || [], systemPromptToSend)
          console.log('[Bridge] Message sent successfully')
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

    let cleanedResponse = responseText.trim()
    let textBefore = ''
    let textAfter = ''
    let jsonText = cleanedResponse

    if (cleanedResponse.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    // Find ALL JSON objects in the response (to handle duplicate JSON)
    // Use balanced brace matching instead of regex to handle nested objects
    const allJsonMatches: Array<{ json: string; start: number; end: number }> = []
    let pos = 0
    while (pos < jsonText.length) {
      const startPos = jsonText.indexOf('{', pos)
      if (startPos === -1) break

      // Find matching closing brace by tracking depth
      let depth = 1
      let endPos = startPos + 1
      while (endPos < jsonText.length && depth > 0) {
        if (jsonText[endPos] === '{') depth++
        if (jsonText[endPos] === '}') depth--
        endPos++
      }

      if (depth === 0) {
        const potentialJson = jsonText.substring(startPos, endPos)
        // Quick validation - does it look like our response format?
        if (potentialJson.includes('"domChanges"') && potentialJson.includes('"response"') && potentialJson.includes('"action"')) {
          allJsonMatches.push({
            json: potentialJson,
            start: startPos,
            end: endPos
          })
        }
      }

      pos = endPos > startPos ? endPos : startPos + 1
    }

    console.log('[Bridge] Validating response')
    let validation: ValidationResult

    // If we found multiple JSON objects, use the LAST one (most likely the actual response)
    // and collect all text before it
    if (allJsonMatches.length > 1) {
      console.log(`[Bridge] ⚠️ Found ${allJsonMatches.length} JSON objects in response, using the LAST one`)
      const lastMatch = allJsonMatches[allJsonMatches.length - 1]
      jsonText = lastMatch.json
      textBefore = cleanedResponse.substring(0, lastMatch.start).trim()
      textAfter = cleanedResponse.substring(lastMatch.end).trim()

      validation = validateAIDOMGenerationResult(jsonText)
    } else if (allJsonMatches.length === 1) {
      // Single JSON object found
      const singleMatch = allJsonMatches[0]
      jsonText = singleMatch.json
      textBefore = cleanedResponse.substring(0, singleMatch.start).trim()
      textAfter = cleanedResponse.substring(singleMatch.end).trim()

      validation = validateAIDOMGenerationResult(jsonText)
    } else {
      // No JSON objects found, try original regex approach
      const jsonMatch = jsonText.match(/^(.*?)(\{[\s\S]*\})(.*?)$/s)
      if (jsonMatch) {
        textBefore = jsonMatch[1].trim()
        jsonText = jsonMatch[2].trim()
        textAfter = jsonMatch[3].trim()
      }

      validation = validateAIDOMGenerationResult(jsonText)
    }

    if (validation.isValid) {
      if (textBefore || textAfter) {
        let modifiedResponse = validation.result.response
        if (textBefore) {
          modifiedResponse = textBefore + '\n\n' + modifiedResponse
          console.log('[Bridge] Prepended text before JSON:', textBefore.substring(0, 100))
        }
        if (textAfter) {
          modifiedResponse = modifiedResponse + '\n\n' + textAfter
          console.log('[Bridge] Appended text after JSON:', textAfter.substring(0, 100))
        }
        validation.result.response = modifiedResponse
      }

      // Strip out any JSON objects that appear in the response text
      // (AI sometimes includes the JSON in its explanation, with or without code fences)
      let cleanedResponse = validation.result.response

      // Pattern 1: JSON wrapped in markdown code fences (```json ... ``` or ``` ... ```)
      const markdownJsonPattern = /```(?:json)?\s*\n?\{[\s\S]*?"domChanges"[\s\S]*?"response"[\s\S]*?"action"[\s\S]*?\}\s*\n?```/g
      cleanedResponse = cleanedResponse.replace(markdownJsonPattern, '').trim()

      // Pattern 2: Raw JSON objects (in case they're not in code fences)
      const rawJsonPattern = /(?<![`])\{[\s\S]*?"domChanges"[\s\S]*?"response"[\s\S]*?"action"[\s\S]*?\}(?![`])/g
      cleanedResponse = cleanedResponse.replace(rawJsonPattern, '').trim()

      // Clean up any extra whitespace
      cleanedResponse = cleanedResponse.replace(/\n{3,}/g, '\n\n').trim()

      if (cleanedResponse !== validation.result.response) {
        console.log('[Bridge] 🧹 Stripped duplicate JSON from response text')
        validation.result.response = cleanedResponse
      }

      console.log('✅ Generated', validation.result.domChanges.length, 'DOM changes via bridge with action:', validation.result.action)

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

    console.log('ℹ️ Response is not structured JSON, normalizing as conversational message')

    session.messages.push({ role: 'assistant', content: cleanedResponse })

    const returnValueConv = {
      domChanges: [],
      response: cleanedResponse,
      action: 'none',
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
