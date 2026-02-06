import Anthropic from '@anthropic-ai/sdk'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import { sanitizeHtml, getSystemPrompt, buildUserMessage, buildSystemPromptWithDOMStructure, createSession } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'
import { validateAIDOMGenerationResult, type ValidationResult, type ValidationError } from './validation'
import { handleCssQuery, handleXPathQuery, type ToolCallResult } from './tool-handlers'
import { API_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'
import { MAX_TOOL_ITERATIONS, AI_REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_ERROR } from './constants'

export class AnthropicProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  getChunkRetrievalPrompt(): string {
    return API_CHUNK_RETRIEVAL_PROMPT
  }

  getToolDefinition(): Anthropic.Tool {
    return {
      name: 'dom_changes_generator',
      description: 'Generates DOM change objects for A/B tests. Each change targets elements via CSS selectors.',
      input_schema: SHARED_TOOL_SCHEMA as any
    }
  }

  getCssQueryTool(): Anthropic.Tool {
    return {
      name: 'css_query',
      description: 'Retrieves the HTML content of page sections by CSS selector(s). Use this to inspect elements before making changes. You can request multiple selectors at once for efficiency.',
      input_schema: {
        type: 'object',
        properties: {
          selectors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of CSS selectors for elements to retrieve (e.g., ["#main-content", ".hero-section", "header"])'
          }
        },
        required: ['selectors']
      } as any
    }
  }

  getXPathQueryTool(): Anthropic.Tool {
    return {
      name: 'xpath_query',
      description: 'Executes an XPath query on the page DOM. Use this for complex element selection that CSS selectors cannot handle, such as selecting by text content, parent/ancestor traversal, or complex conditions. Returns matching nodes with their HTML and generated CSS selectors.',
      input_schema: {
        type: 'object',
        properties: {
          xpath: {
            type: 'string',
            description: 'XPath expression to evaluate. Examples: "//button[contains(text(), \'Submit\')]", "//div[@class=\'card\']//h2", "//a[starts-with(@href, \'https\')]", "//*[contains(@class, \'hero\') and contains(text(), \'Welcome\')]"'
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)'
          }
        },
        required: ['xpath']
      } as any
    }
  }

  async generate(
    html: string,
    prompt: string,
    currentChanges: DOMChange[] = [],
    images: string[] | undefined,
    options: GenerateOptions
  ): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
    console.log('[Anthropic] Using Anthropic API with agentic loop')
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

    let session = createSession(options.conversationSession)

    let systemPrompt = sanitizeHtml(await getSystemPrompt(this.getChunkRetrievalPrompt()))
    console.log('[Anthropic] Base system prompt length:', systemPrompt.length)

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
      console.log(`[Anthropic] 🔄 Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      const requestBody = {
        model: this.config.llmModel || 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages,
        tools: tools
      }

      try {
        JSON.stringify(requestBody)
        console.log('[Anthropic] ✅ Request body is valid JSON')
      } catch (jsonError) {
        console.error('[Anthropic] ❌ Request body contains invalid JSON:', jsonError)
        throw new Error(`Invalid JSON in request body: ${jsonError.message}`)
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(AI_REQUEST_TIMEOUT_ERROR)), AI_REQUEST_TIMEOUT_MS)
      })

      let message: Anthropic.Message
      try {
        message = await Promise.race([
          anthropic.messages.create(requestBody as any),
          timeoutPromise
        ])
      } catch (error: any) {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }
        // Extract clean error message from Anthropic API error
        let errorMessage = 'Anthropic API error'
        if (error.message) {
          try {
            const parsed = JSON.parse(error.message)
            if (parsed.error?.message) {
              errorMessage = parsed.error.message
            } else if (parsed.message) {
              errorMessage = parsed.message
            } else {
              errorMessage = error.message
            }
          } catch {
            errorMessage = error.message
          }
        }
        throw new Error(errorMessage)
      }

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }

      // Check if we got tool use or final response
      const toolUseBlocks = message.content.filter(block => block.type === 'tool_use')
      const textBlocks = message.content.filter(block => block.type === 'text')

      if (toolUseBlocks.length === 0) {
        // No tool calls - this is a conversational response
        console.log('[Anthropic] ℹ️ No tool calls - conversational response')

        const responseText = textBlocks.map(block => (block as any).text).join('\n').trim()
        session.messages.push({ role: 'assistant', content: responseText })

        return {
          domChanges: [],
          response: responseText,
          action: 'none' as const,
          session
        }
      }

      // Process tool calls
      const toolResults: Anthropic.MessageParam['content'] = []

      for (const toolBlock of toolUseBlocks) {
        const tool = toolBlock as any
        console.log(`[Anthropic] 🔧 Tool call: ${tool.name}`)

        if (tool.name === 'dom_changes_generator') {
          // This is the final result tool - validate and return
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('📦 RAW STRUCTURED OUTPUT FROM ANTHROPIC (tool call arguments):')
          console.log(JSON.stringify(tool.input, null, 2))
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const validation = validateAIDOMGenerationResult(JSON.stringify(tool.input))

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
        } else if (tool.name === 'css_query') {
          const selectors = tool.input.selectors as string[]
          const result = await handleCssQuery(selectors)

          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: result.error || result.result || ''
          } as any)
        } else if (tool.name === 'xpath_query') {
          const xpath = tool.input.xpath as string
          const maxResults = (tool.input.maxResults as number) || 10
          const result = await handleXPathQuery(xpath, maxResults)

          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: result.error || result.result || ''
          } as any)
        } else {
          // Unknown tool
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: `Error: Unknown tool "${tool.name}"`
          } as any)
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

        console.log(`[Anthropic] ✅ Processed ${toolResults.length} tool results, continuing loop...`)
      }
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
