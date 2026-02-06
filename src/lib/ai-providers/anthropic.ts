import Anthropic from '@anthropic-ai/sdk'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import { sanitizeHtml, getSystemPrompt, buildUserMessage, buildSystemPromptWithDOMStructure, createSession } from './utils'
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
import { MAX_TOOL_ITERATIONS, withTimeout, parseAPIError } from './constants'
import { debugLog } from '~src/utils/debug'

function isTextBlock(block: Anthropic.ContentBlock): block is Anthropic.TextBlock {
  return block.type === 'text'
}

function isToolUseBlock(block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock {
  return block.type === 'tool_use'
}

export class AnthropicProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  getChunkRetrievalPrompt(): string {
    return API_CHUNK_RETRIEVAL_PROMPT
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

    if (this.config.useOAuth && this.config.oauthToken) {
      debugLog('🔐 Using OAuth token for authentication')
      authConfig.apiKey = 'oauth-placeholder'
      authConfig.defaultHeaders = {
        'Authorization': `Bearer ${this.config.oauthToken}`
      }
    } else if (this.config.apiKey) {
      debugLog('🔑 Using API key for authentication')
      authConfig.apiKey = this.config.apiKey
    } else {
      throw new Error('Either API key or OAuth token is required')
    }

    if (this.config.customEndpoint) {
      authConfig.baseURL = this.config.customEndpoint
    }

    const anthropic = new Anthropic(authConfig)

    let session = createSession(options.conversationSession)

    let systemPrompt = sanitizeHtml(await getSystemPrompt(this.getChunkRetrievalPrompt()))
    debugLog('[Anthropic] Base system prompt length:', systemPrompt.length)

    if (!session.htmlSent) {
      if (!html && !options.domStructure) {
        throw new Error('HTML or DOM structure is required for first message in conversation')
      }

      systemPrompt = buildSystemPromptWithDOMStructure(
        systemPrompt,
        options.domStructure,
        'Anthropic'
      )
      session.htmlSent = true
    }

    systemPrompt = sanitizeHtml(systemPrompt)
    debugLog('[Anthropic] System prompt length:', systemPrompt.length)

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

    // Build messages array for the agentic loop
    const messages: Anthropic.MessageParam[] = [
      ...session.messages.slice(0, -1).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: sanitizeHtml(m.content)
      })),
      newUserMessage
    ]

    const tools = [this.getToolDefinition(), this.getCssQueryTool(), this.getXPathQueryTool()]

    // Agentic loop - process tool calls until we get the final result
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      debugLog(`[Anthropic] 🔄 Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      const requestBody = {
        model: this.config.llmModel || 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages,
        tools: tools
      }

      let message: Anthropic.Message
      try {
        message = await withTimeout(anthropic.messages.create(requestBody))
      } catch (error: unknown) {
        throw new Error(parseAPIError(error, 'Anthropic API error'))
      }

      const toolUseBlocks = message.content.filter(isToolUseBlock)
      const textBlocks = message.content.filter(isTextBlock)

      if (toolUseBlocks.length === 0) {
        debugLog('[Anthropic] ℹ️ No tool calls - conversational response')

        const responseText = textBlocks.map(block => block.text).join('\n').trim()
        session.messages.push({ role: 'assistant', content: responseText })

        return {
          domChanges: [],
          response: responseText,
          action: 'none' as const,
          session
        }
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const tool of toolUseBlocks) {
        debugLog(`[Anthropic] 🔧 Tool call: ${tool.name}`)

        if (tool.name === 'dom_changes_generator') {
          debugLog('[Anthropic] Received dom_changes_generator result')

          const validation = validateAIDOMGenerationResult(JSON.stringify(tool.input))

          if (!validation.isValid) {
            const errorValidation = validation as ValidationError
            console.error('❌ Tool use validation failed:', errorValidation.errors)
            throw new Error(`Tool use validation failed: ${errorValidation.errors.join(', ')}`)
          }

          debugLog('✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)

          session.messages.push({ role: 'assistant', content: validation.result.response })

          return {
            ...validation.result,
            session
          }
        } else if (tool.name === 'css_query') {
          const selectors = tool.input.selectors as string[]
          const result = await handleCssQuery(selectors)

          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: result.error || result.result || ''
          })
        } else if (tool.name === 'xpath_query') {
          const xpath = tool.input.xpath as string
          const maxResults = (tool.input.maxResults as number) || 10
          const result = await handleXPathQuery(xpath, maxResults)

          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: result.error || result.result || ''
          })
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: `Error: Unknown tool "${tool.name}"`
          })
        }
      }

      // If we processed get_html_chunk calls, add the assistant message and tool results
      if (toolResults.length > 0) {
        // Add assistant message with tool use
        messages.push({
          role: 'assistant',
          content: message.content
        })

        // Add tool results
        messages.push({
          role: 'user',
          content: toolResults
        })

        debugLog(`[Anthropic] ✅ Processed ${toolResults.length} tool results, continuing loop...`)
      }
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
