import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import type { OpenRouterChatMessage, OpenRouterChatCompletionRequest } from '~src/types/openrouter'
import { getSystemPrompt, buildUserMessage, buildSystemPromptWithDOMStructure, createSession } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'
import { validateAIDOMGenerationResult, type ValidationResult, type ValidationError } from './validation'
import { handleCssQuery, handleXPathQuery, type ToolCallResult } from './tool-handlers'
import { API_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'
import { MAX_TOOL_ITERATIONS, AI_REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_ERROR } from './constants'
import emojiRegex from 'emoji-regex'
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

  getToolDefinition(): any {
    return {
      type: 'function',
      function: {
        name: 'dom_changes_generator',
        description: 'Generates DOM change objects for A/B tests. Each change targets elements via CSS selectors.',
        parameters: SHARED_TOOL_SCHEMA as any
      }
    }
  }

  getCssQueryTool(): any {
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

  getXPathQueryTool(): any {
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
    console.log('[OpenRouter] generateWithOpenRouter() called with agentic loop')

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

    console.log('[OpenRouter] System prompt BEFORE stripping, length:', systemPrompt.length)
    console.log('[OpenRouter] Char at position 75:', systemPrompt.charCodeAt(75), systemPrompt.charAt(75))

    // Strip emojis AFTER building complete system prompt
    systemPrompt = stripEmojis(systemPrompt)

    console.log('[OpenRouter] System prompt AFTER stripping, length:', systemPrompt.length)

    // Check for any remaining surrogates
    const surrogateTest = /[\uD800-\uDFFF]/
    if (surrogateTest.test(systemPrompt)) {
      console.error('[OpenRouter] WARNING: System prompt still contains surrogate characters!')
      const match = systemPrompt.match(surrogateTest)
      if (match) {
        const pos = systemPrompt.indexOf(match[0])
        console.error('[OpenRouter] First surrogate at position:', pos, 'char code:', systemPrompt.charCodeAt(pos))
        console.error('[OpenRouter] Context:', systemPrompt.substring(Math.max(0, pos - 20), pos + 20))
      }
    }

    console.log('[OpenRouter] Char at position 75 after strip:', systemPrompt.charCodeAt(75), systemPrompt.charAt(75))
    console.log('[OpenRouter] System prompt length:', systemPrompt.length, 'characters')

    console.log('================================================================')
    console.log('COMPLETE SYSTEM PROMPT:')
    console.log('================================================================')
    console.log(systemPrompt)
    console.log('================================================================')

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
      console.log('[OpenRouter] ⚠️ Note: Image support depends on the selected model')
    }

    session.messages.push({ role: 'user', content: userMessageText })

    const tools = [this.getToolDefinition(), this.getCssQueryTool(), this.getXPathQueryTool()]

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      console.log(`[OpenRouter] 🔄 Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      const requestBody: OpenRouterChatCompletionRequest = {
        model: this.config.llmModel,
        messages: messages,
        tools: tools,
        max_tokens: 4096
      }

      console.log('[OpenRouter] Request includes', tools.length, 'tools:', tools.map(t => t.function?.name || t.name))

      // Verify no surrogates in request body
      const bodyStr = JSON.stringify(requestBody)
      const surrogateCheck = /[\uD800-\uDFFF]/
      if (surrogateCheck.test(bodyStr)) {
        console.error('[OpenRouter] ❌ REQUEST BODY CONTAINS SURROGATES!')
        const match = bodyStr.match(surrogateCheck)
        if (match) {
          const pos = bodyStr.indexOf(match[0])
          console.error('[OpenRouter] Surrogate at position:', pos)
          console.error('[OpenRouter] Context:', bodyStr.substring(Math.max(0, pos - 50), pos + 50))
        }
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(AI_REQUEST_TIMEOUT_ERROR)), AI_REQUEST_TIMEOUT_MS)
      })

      let response
      try {
        response = await Promise.race([
          fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': chrome.runtime.getURL(''),
              'X-Title': 'ABsmartly Browser Extension'
            },
            body: JSON.stringify(requestBody)
          }),
          timeoutPromise
        ])
      } catch (fetchError: any) {
        console.error('[OpenRouter] ❌ Fetch failed:', fetchError)
        console.error('[OpenRouter] Error name:', fetchError?.name)
        console.error('[OpenRouter] Error message:', fetchError?.message)
        throw new Error(`Network error: ${fetchError?.message || 'Failed to fetch'}`)
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[OpenRouter] ❌ API error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })

        let errorMessage = `OpenRouter API error (${response.status})`
        try {
          const parsed = JSON.parse(errorText)
          console.error('[OpenRouter] Parsed error:', parsed)

          if (parsed.error?.message) {
            errorMessage = parsed.error.message

            // Check for nested error in metadata.raw
            if (parsed.error.metadata?.raw) {
              try {
                const nestedError = JSON.parse(parsed.error.metadata.raw)
                console.error('[OpenRouter] Nested provider error:', nestedError)
                if (nestedError.error?.message) {
                  errorMessage = `${parsed.error.metadata.provider_name || 'Provider'}: ${nestedError.error.message}`
                }
              } catch (e) {
                console.error('[OpenRouter] Could not parse nested error')
              }
            }
          } else if (parsed.message) {
            errorMessage = parsed.message
          } else {
            errorMessage = errorText
          }
        } catch {
          console.error('[OpenRouter] Could not parse error response as JSON')
          errorMessage = errorText
        }

        console.error('[OpenRouter] Final error message:', errorMessage)
        throw new Error(errorMessage)
      }

      const completion = await response.json()
      console.log('[OpenRouter] Received response from OpenRouter')
      const message = completion.choices[0]?.message

      if (!message) {
        throw new Error('No message in OpenRouter response')
      }

      if (!message.tool_calls || message.tool_calls.length === 0) {
        console.log('[OpenRouter] ℹ️ No tool calls - conversational response')

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
          console.log(`[OpenRouter] ⚠️ Skipping non-function tool call type: ${toolCall.type}`)
          continue
        }

        const fn = toolCall.function
        console.log(`[OpenRouter] 🔧 Tool call: ${fn.name}`)

        if (fn.name === 'dom_changes_generator') {
          console.log('[OpenRouter] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('[OpenRouter] 📦 RAW STRUCTURED OUTPUT FROM OPENROUTER (tool call arguments):')
          console.log(fn.arguments)
          console.log('[OpenRouter] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const toolInput = JSON.parse(fn.arguments)
          const validation = validateAIDOMGenerationResult(JSON.stringify(toolInput))

          if (!validation.isValid) {
            const errorValidation = validation as ValidationError
            console.error('[OpenRouter] ❌ Tool call validation failed:', errorValidation.errors)
            throw new Error(`Tool call validation failed: ${errorValidation.errors.join(', ')}`)
          }

          console.log('[OpenRouter] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)
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
        console.log(`[OpenRouter] ✅ Processed ${toolResultMessages.length} tool results, continuing loop...`)
      }
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
