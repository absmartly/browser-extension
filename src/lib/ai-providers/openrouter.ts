import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import type { OpenRouterChatMessage, OpenRouterChatCompletionRequest } from '~src/types/openrouter'
import { parseToolArguments } from './utils'
import {
  SHARED_TOOL_SCHEMA,
  CSS_QUERY_SCHEMA,
  CSS_QUERY_DESCRIPTION,
  XPATH_QUERY_SCHEMA,
  XPATH_QUERY_DESCRIPTION,
  DOM_CHANGES_TOOL_DESCRIPTION
} from './shared-schema'
import {
  processToolCalls,
  prepareSession,
  makeConversationalResponse,
  makeFinalResponse,
  MAX_TOOL_ITERATIONS,
  type ToolCall
} from './agentic-loop'
import { withTimeout } from './constants'
import { debugLog } from '~src/utils/debug'
import { classifyAIError, formatClassifiedError } from '~src/lib/ai-error-classifier'

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'

function stripEmojis(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\uFE00-\uFE0F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export class OpenRouterProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  getChunkRetrievalPrompt(): string {
    return ''
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

    const { session, systemPrompt, userMessageText } = await prepareSession(
      html, prompt, currentChanges, options, 'OpenRouter', stripEmojis
    )

    debugLog('[OpenRouter] System prompt length after emoji stripping:', systemPrompt.length)

    const messages: OpenRouterChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...session.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: stripEmojis(m.content)
      })),
      { role: 'user', content: userMessageText }
    ]

    if (images && images.length > 0) {
      debugLog('[OpenRouter] Note: Image support depends on the selected model')
    }

    session.messages.push({ role: 'user', content: userMessageText })

    const tools = [this.getToolDefinition(), this.getCssQueryTool(), this.getXPathQueryTool()]

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      debugLog(`[OpenRouter] Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      const requestBody: OpenRouterChatCompletionRequest = {
        model: this.config.llmModel,
        messages,
        tools,
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
                // nested error not parseable
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
        return makeConversationalResponse(message.content || '', session)
      }

      messages.push({
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls
      })

      const toolCalls: ToolCall[] = message.tool_calls
        .filter((tc: any) => tc.type === 'function')
        .map((tc: any) => ({
          name: tc.function.name,
          id: tc.id,
          input: tc.function.arguments
        }))

      const outcome = await processToolCalls(
        toolCalls,
        'OpenRouter',
        (raw) => parseToolArguments(raw, 'tool', 'OpenRouter')
      )

      if (outcome.type === 'final') {
        return makeFinalResponse(outcome.result, session)
      }

      for (const r of outcome.results) {
        messages.push({ role: 'tool', tool_call_id: r.id, content: r.content })
      }

      debugLog(`[OpenRouter] Processed ${outcome.results.length} tool results, continuing loop...`)
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
