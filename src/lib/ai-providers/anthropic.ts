import Anthropic from '@anthropic-ai/sdk'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import { sanitizeHtml, getSystemPrompt, buildUserMessage } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'

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

export class AnthropicProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  getToolDefinition(): Anthropic.Tool {
    return {
      name: 'dom_changes_generator',
      description: 'Generates DOM change objects for A/B tests. Each change targets elements via CSS selectors.',
      input_schema: SHARED_TOOL_SCHEMA as any
    }
  }

  async generate(
    html: string,
    prompt: string,
    currentChanges: DOMChange[] = [],
    images: string[] | undefined,
    options: GenerateOptions
  ): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
    console.log('[Anthropic] Using Anthropic API')
    let authConfig: any = { dangerouslyAllowBrowser: true }

    if (this.config.useOAuth && this.config.oauthToken) {
      console.log('🔐 Using OAuth token for authentication')
      authConfig.apiKey = this.config.oauthToken
      authConfig.defaultHeaders = {
        'Authorization': `Bearer ${this.config.oauthToken}`
      }
    } else if (this.config.apiKey) {
      console.log('🔑 Using API key for authentication')
      authConfig.apiKey = this.config.apiKey
    } else {
      throw new Error('Either API key or OAuth token is required')
    }

    const anthropic = new Anthropic(authConfig)

    let session = options.conversationSession
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        htmlSent: true,
        messages: []
      }
    }

    let systemPrompt = sanitizeHtml(await getSystemPrompt())
    console.log('[Anthropic] Base system prompt length:', systemPrompt.length)

    if (!session.htmlSent) {
      if (!html) {
        throw new Error('HTML is required for first message in conversation')
      }

      systemPrompt += `\n\nHTML Content:\n\`\`\`html\n${html}\n\`\`\``
      session.htmlSent = true
      console.log('📄 Including HTML in system prompt (initializing conversation)')
    }

    systemPrompt = sanitizeHtml(systemPrompt)
    console.log('[Anthropic] Final system prompt length after sanitization:', systemPrompt.length)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 COMPLETE SYSTEM PROMPT BEING SENT TO CLAUDE:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(systemPrompt)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📊 System prompt length: ${systemPrompt.length} characters`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const userMessageText = buildUserMessage(prompt, currentChanges)

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
        content: sanitizeHtml(m.content)
      })), newUserMessage] as Anthropic.MessageParam[],
      tools: [this.getToolDefinition()],
      tool_choice: { type: 'tool', name: 'dom_changes_generator' }
    }

    try {
      JSON.stringify(requestBody)
      console.log('[Anthropic] ✅ Request body is valid JSON')
    } catch (jsonError) {
      console.error('[Anthropic] ❌ Request body contains invalid JSON:', jsonError)
      throw new Error(`Invalid JSON in request body: ${jsonError.message}`)
    }

    const message = await anthropic.messages.create(requestBody as any)

    const content = message.content[0]

    if (content.type === 'tool_use') {
      console.log('🔧 Received tool_use response from Claude')
      const toolInput = content.input as any

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📦 RAW STRUCTURED OUTPUT FROM ANTHROPIC (tool call arguments):')
      console.log(JSON.stringify(toolInput, null, 2))
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      const validation = validateAIDOMGenerationResult(JSON.stringify(toolInput))

      if (!validation.isValid) {
        const errorValidation = validation as ValidationError
        console.error('❌ Tool use validation failed:', errorValidation.errors)
        throw new Error(`Tool use validation failed: ${errorValidation.errors.join(', ')}`)
      }

      console.log('✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)

      session.messages.push({ role: 'assistant', content: validation.result.response })

      return {
        ...validation.result,
        session
      }
    }

    console.warn('⚠️ Tool calling not used - falling back to text parsing')

    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    let responseText = content.text.trim()
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📝 FULL TEXT RESPONSE FROM ANTHROPIC:')
    console.log(responseText)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    let jsonText = responseText
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }

    const validation = validateAIDOMGenerationResult(jsonText)

    if (!validation.isValid) {
      console.log('ℹ️ Response is not structured JSON, normalizing as conversational message')

      session.messages.push({ role: 'assistant', content: responseText })

      const returnValue = {
        domChanges: [],
        response: responseText,
        action: 'none' as const,
        session
      }

      console.log('[Anthropic] Returning conversational message:', {
        domChanges: returnValue.domChanges.length,
        response: returnValue.response.substring(0, 50),
        action: returnValue.action,
        session: returnValue.session?.id
      })

      return returnValue
    }

    console.log('✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)

    if (!validation.result.domChanges || !Array.isArray(validation.result.domChanges)) {
      console.error('⚠️ validation.result.domChanges is invalid:', validation.result.domChanges)
      throw new Error('Validation result missing domChanges array')
    }

    session.messages.push({ role: 'assistant', content: validation.result.response })

    const returnValue = {
      ...validation.result,
      session
    }

    console.log('[Anthropic] Returning from Anthropic API:', {
      domChanges: returnValue.domChanges?.length,
      response: returnValue.response?.substring(0, 50),
      action: returnValue.action,
      session: returnValue.session?.id
    })

    return returnValue
  }
}
