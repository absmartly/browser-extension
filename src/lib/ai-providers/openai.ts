import OpenAI from 'openai'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import { getSystemPrompt, buildUserMessage } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'
import { captureHTMLChunks, queryXPath } from '~src/utils/html-capture'
import { validateXPath } from '~src/utils/xpath-validator'
import { API_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'

const MAX_TOOL_ITERATIONS = 10

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

    let session = options.conversationSession
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        htmlSent: false,
        messages: []
      }
    }

    let systemPrompt = await getSystemPrompt(this.getChunkRetrievalPrompt())

    if (!session.htmlSent) {
      if (!html && !options.domStructure) {
        throw new Error('HTML or DOM structure is required for first message in conversation')
      }

      const structureText = options.domStructure || '(DOM structure not available)'
      console.log('[OpenAI] Using pre-generated DOM structure:', structureText.substring(0, 100) + '...')

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
      console.log(`[OpenAI] 📄 Including DOM structure in system prompt (${structureText.length} chars)`)
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
        setTimeout(() => reject(new Error('AI request timed out after 60 seconds')), 60000)
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
          console.log(`[OpenAI] 📄 CSS query for ${selectors.length} selector(s):`, selectors)

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

          // Validate XPath expression before execution
          if (!validateXPath(xpath)) {
            const errorContent = `Invalid XPath expression: "${xpath}". XPath must use safe patterns only.`
            console.log(`[OpenAI] ⚠️  ${errorContent}`)
            toolResultMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: errorContent
            })
            continue
          }
          console.log(`[OpenAI] 🔍 Executing XPath: "${xpath}" (max ${maxResults} results)`)

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
