import OpenAI from 'openai'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import { getSystemPrompt, buildUserMessage, buildSystemPromptWithDOMStructure, createSession } from './utils'
import {
  SHARED_TOOL_SCHEMA,
  CSS_QUERY_SCHEMA,
  CSS_QUERY_DESCRIPTION,
  XPATH_QUERY_SCHEMA,
  XPATH_QUERY_DESCRIPTION,
  DOM_CHANGES_TOOL_DESCRIPTION
} from './shared-schema'
import { validateAIDOMGenerationResult, type ValidationResult, type ValidationError } from './validation'
import { handleCssQuery, handleXPathQuery, type ToolCallResult } from './tool-handlers'
import { API_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'
import { MAX_TOOL_ITERATIONS, withTimeout } from './constants'
import { debugLog } from '~src/utils/debug'
import { classifyAIError, formatClassifiedError } from '~src/lib/ai-error-classifier'

export class OpenAIProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  getChunkRetrievalPrompt(): string {
    return API_CHUNK_RETRIEVAL_PROMPT
  }

  getToolDefinition(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'dom_changes_generator',
        description: DOM_CHANGES_TOOL_DESCRIPTION,
        parameters: SHARED_TOOL_SCHEMA
      }
    }
  }

  getCssQueryTool(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'css_query',
        description: CSS_QUERY_DESCRIPTION,
        parameters: CSS_QUERY_SCHEMA
      }
    }
  }

  getXPathQueryTool(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'xpath_query',
        description: XPATH_QUERY_DESCRIPTION,
        parameters: XPATH_QUERY_SCHEMA
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
    debugLog('[OpenAI] generateWithOpenAI() called with agentic loop')

    const openai = new OpenAI({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true,
      ...(this.config.customEndpoint && { baseURL: this.config.customEndpoint })
    })

    let session = createSession(options.conversationSession)

    let systemPrompt = await getSystemPrompt(this.getChunkRetrievalPrompt())

    if (!session.htmlSent) {
      if (!html && !options.domStructure) {
        throw new Error('HTML or DOM structure is required for first message in conversation')
      }

      systemPrompt = buildSystemPromptWithDOMStructure(
        systemPrompt,
        options.domStructure,
        'OpenAI'
      )
      session.htmlSent = true
    }

    debugLog('[OpenAI] System prompt length:', systemPrompt.length)

    const userMessageText = buildUserMessage(prompt, currentChanges)

    // Build messages array for the agentic loop
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...session.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: userMessageText }
    ]

    if (images && images.length > 0) {
      debugLog('[OpenAI] ⚠️ Note: Image support not yet implemented for OpenAI')
    }

    session.messages.push({ role: 'user', content: userMessageText })

    const tools = [this.getToolDefinition(), this.getCssQueryTool(), this.getXPathQueryTool()]

    // Agentic loop - process tool calls until we get the final result
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      debugLog(`[OpenAI] 🔄 Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      let completion: OpenAI.ChatCompletion
      try {
        completion = await withTimeout(
          openai.chat.completions.create({
            model: this.config.llmModel || 'gpt-4-turbo',
            messages: messages,
            tools: tools
          })
        )
      } catch (error: any) {
        const errorMessage = error.message || error.error?.message || 'OpenAI API error'
        const baseError = new Error(errorMessage)
        const classified = classifyAIError(baseError)
        throw new Error(formatClassifiedError(classified))
      }

      debugLog('[OpenAI] Received response from OpenAI')
      const message = completion.choices[0]?.message

      if (!message) {
        throw new Error('No message in OpenAI response')
      }

      // Check if we have tool calls
      if (!message.tool_calls || message.tool_calls.length === 0) {
        // No tool calls - this is a conversational response
        debugLog('[OpenAI] ℹ️ No tool calls - conversational response')

        const responseText = message.content || ''
        session.messages.push({ role: 'assistant', content: responseText })

        return {
          domChanges: [],
          response: responseText,
          action: 'none' as const,
          session
        }
      }

      // Process tool calls
      const toolResultMessages: OpenAI.ChatCompletionMessageParam[] = []

      // First, add the assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls
      })

      for (const toolCall of message.tool_calls) {
        // Type guard for function tool calls
        if (toolCall.type !== 'function') {
          debugLog(`[OpenAI] ⚠️ Skipping non-function tool call type: ${toolCall.type}`)
          continue
        }

        const fn = toolCall.function
        debugLog(`[OpenAI] 🔧 Tool call: ${fn.name}`)

        if (fn.name === 'dom_changes_generator') {
          debugLog('[OpenAI] Received dom_changes_generator result')

          const toolInput = JSON.parse(fn.arguments)
          const validation = validateAIDOMGenerationResult(JSON.stringify(toolInput))

          if (!validation.isValid) {
            const errorValidation = validation as ValidationError
            console.error('[OpenAI] ❌ Tool call validation failed:', errorValidation.errors)
            throw new Error(`Tool call validation failed: ${errorValidation.errors.join(', ')}`)
          }

          debugLog('[OpenAI] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)
          session.messages.push({ role: 'assistant', content: validation.result.response })

          return {
            ...validation.result,
            session
          }
        } else if (fn.name === 'css_query') {
          const args = JSON.parse(fn.arguments)
          const selectors = args.selectors as string[]
          const result = await handleCssQuery(selectors)

          toolResultMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.error || result.result || ''
          })
        } else if (fn.name === 'xpath_query') {
          const args = JSON.parse(fn.arguments)
          const xpath = args.xpath as string
          const maxResults = (args.maxResults as number) || 10
          const result = await handleXPathQuery(xpath, maxResults)

          toolResultMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.error || result.result || ''
          })
        } else {
          // Unknown tool
          toolResultMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Error: Unknown tool "${fn.name}"`
          })
        }
      }

      // If we processed get_html_chunk calls, add the tool results
      if (toolResultMessages.length > 0) {
        messages.push(...toolResultMessages)
        debugLog(`[OpenAI] ✅ Processed ${toolResultMessages.length} tool results, continuing loop...`)
      }
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
