import Anthropic from '@anthropic-ai/sdk'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import { sanitizeHtml } from './utils'
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
import { withTimeout, parseAPIError } from './constants'
import { debugLog } from '~src/utils/debug'
import { classifyAIError, formatClassifiedError } from '~src/lib/ai-error-classifier'

function isTextBlock(block: Anthropic.ContentBlock): block is Anthropic.TextBlock {
  return block.type === 'text'
}

function isToolUseBlock(block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock {
  return block.type === 'tool_use'
}

export class AnthropicProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  getChunkRetrievalPrompt(): string {
    return ''
  }

  getToolDefinition(): Anthropic.Tool {
    return {
      name: 'dom_changes_generator',
      description: DOM_CHANGES_TOOL_DESCRIPTION,
      input_schema: SHARED_TOOL_SCHEMA as Anthropic.Tool.InputSchema
    }
  }

  getCssQueryTool(): Anthropic.Tool {
    return {
      name: 'css_query',
      description: CSS_QUERY_DESCRIPTION,
      input_schema: CSS_QUERY_SCHEMA as Anthropic.Tool.InputSchema
    }
  }

  getXPathQueryTool(): Anthropic.Tool {
    return {
      name: 'xpath_query',
      description: XPATH_QUERY_DESCRIPTION,
      input_schema: XPATH_QUERY_SCHEMA as Anthropic.Tool.InputSchema
    }
  }

  async generate(
    html: string,
    prompt: string,
    currentChanges: DOMChange[] = [],
    images: string[] | undefined,
    options: GenerateOptions
  ): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
    debugLog('[Anthropic] Using Anthropic API with agentic loop')
    let authConfig: any = { dangerouslyAllowBrowser: true }

    if (this.config.apiKey) {
      authConfig.apiKey = this.config.apiKey
    } else {
      throw new Error('API key is required')
    }

    if (this.config.customEndpoint) {
      authConfig.baseURL = this.config.customEndpoint
    }

    const anthropic = new Anthropic(authConfig)

    const { session, systemPrompt: rawSystemPrompt, userMessageText } = await prepareSession(
      html, prompt, currentChanges, options, 'Anthropic', sanitizeHtml
    )

    const systemPrompt = sanitizeHtml(rawSystemPrompt)
    debugLog('[Anthropic] System prompt length:', systemPrompt.length)

    const contentParts: Anthropic.MessageParam['content'] = [
      { type: 'text', text: userMessageText }
    ]

    if (images && images.length > 0) {
      for (const img of images) {
        const match = img.match(/^data:(image\/\w+);base64,(.+)$/)
        if (match) {
          const [, mediaType, base64Data] = match
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

    const newUserMessage: Anthropic.MessageParam = {
      role: 'user',
      content: contentParts
    }
    session.messages.push({ role: 'user', content: userMessageText })

    const messages: Anthropic.MessageParam[] = [
      ...session.messages.slice(0, -1).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: sanitizeHtml(m.content)
      })),
      newUserMessage
    ]

    const tools = [this.getToolDefinition(), this.getCssQueryTool(), this.getXPathQueryTool()]

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      debugLog(`[Anthropic] Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      let message: Anthropic.Message
      try {
        message = await withTimeout(anthropic.messages.create({
          model: this.config.llmModel || 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
          system: systemPrompt,
          messages,
          tools
        }))
      } catch (error: unknown) {
        const baseError = new Error(parseAPIError(error, 'Anthropic API error'))
        const classified = classifyAIError(baseError)
        throw new Error(formatClassifiedError(classified))
      }

      const toolUseBlocks = message.content.filter(isToolUseBlock)
      const textBlocks = message.content.filter(isTextBlock)

      if (toolUseBlocks.length === 0) {
        const responseText = textBlocks.map(block => block.text).join('\n').trim()
        return makeConversationalResponse(responseText, session)
      }

      const toolCalls: ToolCall[] = toolUseBlocks.map(block => ({
        name: block.name,
        id: block.id,
        input: block.input
      }))

      const outcome = await processToolCalls(toolCalls, 'Anthropic')

      if (outcome.type === 'final') {
        return makeFinalResponse(outcome.result, session)
      }

      messages.push({ role: 'assistant', content: message.content })
      messages.push({
        role: 'user',
        content: outcome.results.map(r => ({
          type: 'tool_result' as const,
          tool_use_id: r.id,
          content: r.content
        }))
      })

      debugLog(`[Anthropic] Processed ${outcome.results.length} tool results, continuing loop...`)
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
