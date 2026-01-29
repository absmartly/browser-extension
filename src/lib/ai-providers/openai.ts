import OpenAI from 'openai'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import { getSystemPrompt, buildUserMessage, buildSystemPromptWithDOMStructure, createSession } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'
import { validateAIDOMGenerationResult, type ValidationResult, type ValidationError } from './validation'
import { handleCssQuery, handleXPathQuery, type ToolCallResult } from './tool-handlers'
import { API_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'
import { MAX_TOOL_ITERATIONS, AI_REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_ERROR } from './constants'

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
        description: 'Generates DOM change objects for A/B tests. Each change targets elements via CSS selectors.',
        parameters: SHARED_TOOL_SCHEMA as any
      }
    }
  }

  getCssQueryTool(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'css_query',
        description: 'Retrieves the HTML content of page sections by CSS selector(s). Use this to inspect elements before making changes. You can request multiple selectors at once for efficiency.',
        parameters: {
          type: 'object',
          properties: {
            selectors: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of CSS selectors for elements to retrieve (e.g., ["#main-content", ".hero-section", "header"])'
            }
          },
          required: ['selectors']
        }
      }
    }
  }

  getXPathQueryTool(): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: 'xpath_query',
        description: 'Executes an XPath query on the page DOM. Use this for complex element selection that CSS selectors cannot handle, such as selecting by text content, parent/ancestor traversal, or complex conditions. Returns matching nodes with their HTML and generated CSS selectors.',
        parameters: {
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
        }
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
    console.log('[OpenAI] generateWithOpenAI() called with agentic loop')

    const openai = new OpenAI({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true
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

    console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[OpenAI] 🔍 COMPLETE SYSTEM PROMPT BEING SENT TO OPENAI:')
    console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(systemPrompt)
    console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`[OpenAI] 📊 System prompt length: ${systemPrompt.length} characters`)
    console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

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
      console.log('[OpenAI] ⚠️ Note: Image support not yet implemented for OpenAI')
    }

    session.messages.push({ role: 'user', content: userMessageText })

    const tools = [this.getToolDefinition(), this.getCssQueryTool(), this.getXPathQueryTool()]

    // Agentic loop - process tool calls until we get the final result
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      console.log(`[OpenAI] 🔄 Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(AI_REQUEST_TIMEOUT_ERROR)), AI_REQUEST_TIMEOUT_MS)
      })

      let completion: OpenAI.ChatCompletion
      try {
        completion = await Promise.race([
          openai.chat.completions.create({
            model: 'gpt-4-turbo',
            messages: messages,
            tools: tools
          }),
          timeoutPromise
        ])
      } catch (error: any) {
        // Extract clean error message from OpenAI SDK error
        let errorMessage = 'OpenAI API error'
        if (error.message) {
          errorMessage = error.message
        } else if (error.error?.message) {
          errorMessage = error.error.message
        }
        throw new Error(errorMessage)
      }

      console.log('[OpenAI] Received response from OpenAI')
      const message = completion.choices[0]?.message

      if (!message) {
        throw new Error('No message in OpenAI response')
      }

      // Check if we have tool calls
      if (!message.tool_calls || message.tool_calls.length === 0) {
        // No tool calls - this is a conversational response
        console.log('[OpenAI] ℹ️ No tool calls - conversational response')

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
          console.log(`[OpenAI] ⚠️ Skipping non-function tool call type: ${toolCall.type}`)
          continue
        }

        const fn = toolCall.function
        console.log(`[OpenAI] 🔧 Tool call: ${fn.name}`)

        if (fn.name === 'dom_changes_generator') {
          // This is the final result tool - validate and return
          console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('[OpenAI] 📦 RAW STRUCTURED OUTPUT FROM OPENAI (tool call arguments):')
          console.log(fn.arguments)
          console.log('[OpenAI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const toolInput = JSON.parse(fn.arguments)
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
        console.log(`[OpenAI] ✅ Processed ${toolResultMessages.length} tool results, continuing loop...`)
      }
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
