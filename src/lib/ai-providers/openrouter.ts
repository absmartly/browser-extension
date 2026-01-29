import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import type { OpenRouterChatMessage, OpenRouterChatCompletionRequest } from '~src/types/openrouter'
import { getSystemPrompt, buildUserMessage } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'
import { captureHTMLChunks, queryXPath } from '~src/utils/html-capture'
import { validateXPath } from '~src/utils/xpath-validator'
import { API_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'

const MAX_TOOL_ITERATIONS = 10
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'

/**
 * Remove emojis and other problematic Unicode characters that some providers can't handle
 */
function stripEmojis(text: string): string {
  // Remove emojis and other non-BMP characters
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1FFFF}]/gu, '')
    // Remove other decorative Unicode symbols
    .replace(/[━─│┌┐└┘├┤┬┴┼]/g, '-')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

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

    let session = options.conversationSession
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        htmlSent: false,
        messages: []
      }
    }

    let systemPrompt = await getSystemPrompt(this.getChunkRetrievalPrompt())
    // Strip emojis for providers that can't handle them (Arcee AI, etc.)
    systemPrompt = stripEmojis(systemPrompt)

    if (!session.htmlSent) {
      if (!html && !options.domStructure) {
        throw new Error('HTML or DOM structure is required for first message in conversation')
      }

      const structureText = options.domStructure || '(DOM structure not available)'
      console.log('[OpenRouter] Using pre-generated DOM structure:', structureText.substring(0, 100) + '...')

      systemPrompt += `\n\n## Page DOM Structure

The following is a tree representation of the page structure. Use the \`css_query\` function to retrieve specific HTML sections when needed.

\`\`\`
${structureText}
\`\`\`

To inspect sections, call \`css_query\` with selectors FROM THE STRUCTURE ABOVE:
- \`css_query({ selectors: ["section", "header", "nav"] })\`

IMPORTANT: Only use selectors you see in the structure above. Never invent or guess selectors.
`
      session.htmlSent = true
      console.log(`[OpenRouter] 📄 Including DOM structure in system prompt (${structureText.length} chars)`)
    }

    console.log('[OpenRouter] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[OpenRouter] 🔍 COMPLETE SYSTEM PROMPT BEING SENT TO OPENROUTER:')
    console.log('[OpenRouter] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(systemPrompt)
    console.log('[OpenRouter] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`[OpenRouter] 📊 System prompt length: ${systemPrompt.length} characters`)
    console.log('[OpenRouter] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

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

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI request timed out after 60 seconds')), 60000)
      })

      const response = await Promise.race([
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
          console.log(`[OpenRouter] 📄 CSS query for ${selectors.length} selector(s):`, selectors)

          const chunkResults = await captureHTMLChunks(selectors)

          const resultParts: string[] = []
          for (const chunkResult of chunkResults) {
            if (chunkResult.found) {
              resultParts.push(`## ${chunkResult.selector}\n\`\`\`html\n${chunkResult.html}\n\`\`\``)
            } else {
              resultParts.push(`## ${chunkResult.selector}\nError: ${chunkResult.error || 'Element not found'}`)
            }
          }

          const resultContent = resultParts.join('\n\n')

          toolResultMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultContent
          })
        } else if (fn.name === 'xpath_query') {
          const args = JSON.parse(fn.arguments)
          const xpath = args.xpath as string
          const maxResults = (args.maxResults as number) || 10

          if (!validateXPath(xpath)) {
            const errorContent = `Invalid XPath expression: "${xpath}". XPath must use safe patterns only.`
            console.log(`[OpenRouter] ⚠️  ${errorContent}`)
            toolResultMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: errorContent
            })
            continue
          }
          console.log(`[OpenRouter] 🔍 Executing XPath: "${xpath}" (max ${maxResults} results)`)

          const xpathResult = await queryXPath(xpath, maxResults)

          let resultContent: string
          if (xpathResult.found) {
            const parts: string[] = [`Found ${xpathResult.matches.length} node(s) matching XPath "${xpath}":\n`]
            for (const match of xpathResult.matches) {
              const selectorInfo = match.selector ? `Selector: \`${match.selector}\`` : '(No CSS selector available)'
              parts.push(`## ${selectorInfo}\nNode type: ${match.nodeType}\nText preview: ${match.textContent}\n\`\`\`html\n${match.html}\n\`\`\``)
            }
            resultContent = parts.join('\n\n')
          } else {
            resultContent = xpathResult.error || `No nodes found matching XPath: "${xpath}"`
          }

          toolResultMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultContent
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
