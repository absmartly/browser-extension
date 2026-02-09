import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import type { OpenRouterChatMessage, OpenRouterChatCompletionRequest } from '~src/types/openrouter'
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

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'

/**
 * Remove emojis and other problematic Unicode characters that some providers can't handle
 * CRITICAL: Must remove ALL surrogates to prevent UTF-8 encoding errors
 */
function stripEmojis(text: string): string {
  return text
    // FIRST: Remove ALL surrogate pairs (emojis stored as 2-char sequences)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    // SECOND: Remove any orphaned surrogates
    .replace(/[\uD800-\uDFFF]/g, '')
    // Remove variation selectors
    .replace(/[\uFE00-\uFE0F]/g, '')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

export class OpenRouterProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  getChunkRetrievalPrompt(): string {
    return API_CHUNK_RETRIEVAL_PROMPT
  }

  getToolDefinition() {
    return {
      type: 'function' as const,
      function: {
        name: 'dom_changes_generator',
        description: DOM_CHANGES_TOOL_DESCRIPTION,
        parameters: SHARED_TOOL_SCHEMA
      }
    }
  }

  getCssQueryTool() {
    return {
      type: 'function' as const,
      function: {
        name: 'css_query',
        description: CSS_QUERY_DESCRIPTION,
        parameters: CSS_QUERY_SCHEMA
      }
    }
  }

  getXPathQueryTool() {
    return {
      type: 'function' as const,
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
    debugLog('[OpenRouter] generateWithOpenRouter() called with agentic loop')

    if (!this.config.llmModel) {
      throw new Error('Model is required for OpenRouter provider')
    }

    let session = createSession(options.conversationSession)

    let systemPrompt = await getSystemPrompt(this.getChunkRetrievalPrompt())

    if (!session.htmlSent) {
      if (!html && !options.domStructure) {
        throw new Error('HTML or DOM structure is required for first message in conversation')
      }

      systemPrompt = buildSystemPromptWithDOMStructure(
        systemPrompt,
        options.domStructure,
        'OpenRouter'
      )
      session.htmlSent = true
    }

    systemPrompt = stripEmojis(systemPrompt)
    debugLog('[OpenRouter] System prompt length after emoji stripping:', systemPrompt.length)

    const userMessageText = stripEmojis(buildUserMessage(prompt, currentChanges))

    const messages: OpenRouterChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...session.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: stripEmojis(m.content)
      })),
      { role: 'user', content: userMessageText }
    ]

    if (images && images.length > 0) {
      debugLog('[OpenRouter] ⚠️ Note: Image support depends on the selected model')
    }

    session.messages.push({ role: 'user', content: userMessageText })

    const tools = [this.getToolDefinition(), this.getCssQueryTool(), this.getXPathQueryTool()]

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      debugLog(`[OpenRouter] 🔄 Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      const requestBody: OpenRouterChatCompletionRequest = {
        model: this.config.llmModel,
        messages: messages,
        tools: tools,
        max_tokens: 4096
      }

      let response
      try {
        response = await withTimeout(
          fetch(`${this.config.customEndpoint || OPENROUTER_API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': chrome.runtime.getURL(''),
              'X-Title': 'ABsmartly Browser Extension'
            },
            body: JSON.stringify(requestBody)
          })
        )
      } catch (fetchError: any) {
        const baseError = new Error(`Network error: ${fetchError?.message || 'Failed to fetch'}`)
        const classified = classifyAIError(baseError)
        throw new Error(formatClassifiedError(classified))
      }

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `OpenRouter API error (${response.status})`

        try {
          const parsed = JSON.parse(errorText)
          if (parsed.error?.message) {
            errorMessage = parsed.error.message

            if (parsed.error.metadata?.raw) {
              try {
                const nestedError = JSON.parse(parsed.error.metadata.raw)
                if (nestedError.error?.message) {
                  errorMessage = `${parsed.error.metadata.provider_name || 'Provider'}: ${nestedError.error.message}`
                }
              } catch {
                // nested error not parseable, use outer error
              }
            }
          } else if (parsed.message) {
            errorMessage = parsed.message
          } else {
            errorMessage = errorText
          }
        } catch {
          errorMessage = errorText
        }

        const baseError = new Error(errorMessage)
        const classified = classifyAIError(baseError)
        throw new Error(formatClassifiedError(classified))
      }

      const completion = await response.json()
      debugLog('[OpenRouter] Received response from OpenRouter')
      const message = completion.choices[0]?.message

      if (!message) {
        throw new Error('No message in OpenRouter response')
      }

      if (!message.tool_calls || message.tool_calls.length === 0) {
        debugLog('[OpenRouter] ℹ️ No tool calls - conversational response')

        const responseText = message.content || ''
        session.messages.push({ role: 'assistant', content: responseText })

        return {
          domChanges: [],
          response: responseText,
          action: 'none' as const,
          session
        }
      }

      const toolResultMessages: OpenRouterChatMessage[] = []

      messages.push({
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls
      })

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') {
          debugLog(`[OpenRouter] ⚠️ Skipping non-function tool call type: ${toolCall.type}`)
          continue
        }

        const fn = toolCall.function
        debugLog(`[OpenRouter] 🔧 Tool call: ${fn.name}`)

        if (fn.name === 'dom_changes_generator') {
          debugLog('[OpenRouter] Received dom_changes_generator result')

          const toolInput = JSON.parse(fn.arguments)
          const validation = validateAIDOMGenerationResult(JSON.stringify(toolInput))

          if (!validation.isValid) {
            const errorValidation = validation as ValidationError
            console.error('[OpenRouter] ❌ Tool call validation failed:', errorValidation.errors)
            throw new Error(`Tool call validation failed: ${errorValidation.errors.join(', ')}`)
          }

          debugLog('[OpenRouter] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)
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
          toolResultMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Error: Unknown tool "${fn.name}"`
          })
        }
      }

      if (toolResultMessages.length > 0) {
        messages.push(...toolResultMessages)
        debugLog(`[OpenRouter] ✅ Processed ${toolResultMessages.length} tool results, continuing loop...`)
      }
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
