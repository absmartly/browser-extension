import OpenAI from 'openai'
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

export class OpenAIProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  getToolDefinition(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'dom_changes_generator',
        description: 'Generates DOM change objects for A/B tests. Each change targets elements via CSS selectors.',
        parameters: SHARED_TOOL_SCHEMA as any
      }
    }
  }

  async generate(
    html: string,
    prompt: string,
    currentChanges: DOMChange[] = [],
    images: string[] | undefined,
    options: GenerateOptions
  ): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
    console.log('[OpenAI] generateWithOpenAI() called')

    const openai = new OpenAI({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true
    })

    let session = options.conversationSession
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        htmlSent: false,
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

    const userMessageText = buildUserMessage(prompt, currentChanges)

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
      tools: [this.getToolDefinition()],
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

      if (toolCall.type === 'function' && toolCall.function.name === 'dom_changes_generator') {
        console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('[OpenAI] 📦 RAW STRUCTURED OUTPUT FROM OPENAI (tool call arguments):')
        console.log(toolCall.function.arguments)
        console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        const toolInput = JSON.parse(toolCall.function.arguments)
        const validation = validateAIDOMGenerationResult(JSON.stringify(toolInput))

        if (!validation.isValid) {
          const errorValidation = validation as ValidationError
          console.error('[OpenAI] ❌ Tool call validation failed:', errorValidation.errors)
          throw new Error(`Tool call validation failed: ${errorValidation.errors.join(', ')}`)
        }

        console.log('[OpenAI] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)
        session.messages.push({ role: 'assistant', content: validation.result.response })

        return {
          ...validation.result,
          session
        }
      }
    }

    throw new Error('OpenAI did not return a tool call')
  }
}
