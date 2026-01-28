import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import type {
  GeminiContent,
  GeminiGenerateContentRequest,
  GeminiGenerateContentResponse,
  GeminiFunctionDeclaration,
  GeminiTool
} from '~src/types/gemini'
import { getSystemPrompt, buildUserMessage } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'
import { captureHTMLChunks, queryXPath } from '~src/utils/html-capture'
import { validateXPath } from '~src/utils/xpath-validator'
import { API_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'

const MAX_TOOL_ITERATIONS = 10
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface ValidationError {
  isValid: false
  errors: string[]
}

interface ValidationSuccess {
  isValid: true
  result: AIDOMGenerationResult
}

type ValidationResult = ValidationError | ValidationSuccess

function validateAIDOMGenerationResult(result: any): ValidationResult {
  const errors: string[] = []

  if (!result.domChanges) {
    errors.push('Missing required field: "domChanges" (must be an array of DOM change objects)')
  } else if (!Array.isArray(result.domChanges)) {
    errors.push('"domChanges" must be an array, got: ' + typeof result.domChanges)
  }

  if (!result.response) {
    errors.push('Missing required field: "response" (must be a string with your conversational message)')
  } else if (typeof result.response !== 'string') {
    errors.push('"response" must be a string, got: ' + typeof result.response)
  }

  if (!result.action) {
    errors.push('Missing required field: "action" (must be one of: append, replace_all, replace_specific, remove_specific, none)')
  } else if (!['append', 'replace_all', 'replace_specific', 'remove_specific', 'none'].includes(result.action)) {
    errors.push(`"action" must be one of: append, replace_all, replace_specific, remove_specific, none. Got: "${result.action}"`)
  }

  if ((result.action === 'replace_specific' || result.action === 'remove_specific') &&
      (!result.targetSelectors || !Array.isArray(result.targetSelectors) || result.targetSelectors.length === 0)) {
    errors.push(`Action "${result.action}" requires a non-empty "targetSelectors" array`)
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    result: result as AIDOMGenerationResult
  }
}

export class GeminiProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  getChunkRetrievalPrompt(): string {
    return API_CHUNK_RETRIEVAL_PROMPT
  }

  getToolDefinition(): GeminiFunctionDeclaration {
    return {
      name: 'dom_changes_generator',
      description: 'Generates DOM change objects for A/B tests. Each change targets elements via CSS selectors.',
      parameters: SHARED_TOOL_SCHEMA as any
    }
  }

  getCssQueryTool(): GeminiFunctionDeclaration {
    return {
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

  getXPathQueryTool(): GeminiFunctionDeclaration {
    return {
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

  async generate(
    html: string,
    prompt: string,
    currentChanges: DOMChange[] = [],
    images: string[] | undefined,
    options: GenerateOptions
  ): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
    console.log('[Gemini] generateWithGemini() called with agentic loop')

    if (!this.config.llmModel) {
      throw new Error('Model is required for Gemini provider')
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

    if (!session.htmlSent) {
      if (!html && !options.domStructure) {
        throw new Error('HTML or DOM structure is required for first message in conversation')
      }

      const structureText = options.domStructure || '(DOM structure not available)'
      console.log('[Gemini] Using pre-generated DOM structure:', structureText.substring(0, 100) + '...')

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
      console.log(`[Gemini] 📄 Including DOM structure in system prompt (${structureText.length} chars)`)
    }

    console.log('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[Gemini] 🔍 COMPLETE SYSTEM PROMPT BEING SENT TO GEMINI:')
    console.log('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(systemPrompt)
    console.log('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`[Gemini] 📊 System prompt length: ${systemPrompt.length} characters`)
    console.log('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    const userMessageText = buildUserMessage(prompt, currentChanges)

    const contents: GeminiContent[] = []

    contents.push({
      role: 'user',
      parts: [{ text: systemPrompt }]
    })

    contents.push({
      role: 'model',
      parts: [{ text: 'I understand. I will help you generate DOM changes for your A/B test.' }]
    })

    for (const msg of session.messages) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })
    }

    contents.push({
      role: 'user',
      parts: [{ text: userMessageText }]
    })

    session.messages.push({ role: 'user', content: userMessageText })

    const tools: GeminiTool = {
      functionDeclarations: [
        this.getToolDefinition(),
        this.getCssQueryTool(),
        this.getXPathQueryTool()
      ]
    }

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      console.log(`[Gemini] 🔄 Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      const requestBody: GeminiGenerateContentRequest = {
        contents: contents,
        tools: [tools],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7
        }
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI request timed out after 60 seconds')), 60000)
      })

      const modelName = this.config.llmModel.includes('models/')
        ? this.config.llmModel
        : `models/${this.config.llmModel}`

      const response = await Promise.race([
        fetch(`${GEMINI_API_BASE}/${modelName}:generateContent?key=${this.config.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }),
        timeoutPromise
      ])

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Gemini API error (${response.status})`
        try {
          const parsed = JSON.parse(errorText)
          if (parsed.error?.message) {
            errorMessage = parsed.error.message
          } else if (parsed.message) {
            errorMessage = parsed.message
          } else {
            errorMessage = errorText
          }
        } catch {
          errorMessage = errorText
        }
        throw new Error(errorMessage)
      }

      const result: GeminiGenerateContentResponse = await response.json()
      console.log('[Gemini] Received response from Gemini')

      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('No candidates in Gemini response')
      }

      const candidate = result.candidates[0]
      const parts = candidate.content.parts

      const functionCalls = parts.filter(p => p.functionCall)
      const textParts = parts.filter(p => p.text)

      if (functionCalls.length === 0) {
        console.log('[Gemini] ℹ️ No function calls - conversational response')

        const responseText = textParts.map(p => p.text).join('\n').trim()
        session.messages.push({ role: 'assistant', content: responseText })

        return {
          domChanges: [],
          response: responseText,
          action: 'none' as const,
          session
        }
      }

      contents.push({
        role: 'model',
        parts: candidate.content.parts
      })

      const functionResponses: any[] = []

      for (const part of functionCalls) {
        const functionCall = part.functionCall!
        console.log(`[Gemini] 🔧 Function call: ${functionCall.name}`)

        if (functionCall.name === 'dom_changes_generator') {
          console.log('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('[Gemini] 📦 RAW STRUCTURED OUTPUT FROM GEMINI (function call args):')
          console.log(JSON.stringify(functionCall.args, null, 2))
          console.log('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const validation = validateAIDOMGenerationResult(functionCall.args)

          if (!validation.isValid) {
            const errorValidation = validation as ValidationError
            console.error('[Gemini] ❌ Function call validation failed:', errorValidation.errors)
            throw new Error(`Function call validation failed: ${errorValidation.errors.join(', ')}`)
          }

          console.log('[Gemini] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)
          session.messages.push({ role: 'assistant', content: validation.result.response })

          return {
            ...validation.result,
            session
          }
        } else if (functionCall.name === 'css_query') {
          const selectors = functionCall.args.selectors as string[]
          console.log(`[Gemini] 📄 CSS query for ${selectors.length} selector(s):`, selectors)

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

          functionResponses.push({
            functionResponse: {
              name: 'css_query',
              response: {
                result: resultContent
              }
            }
          })
        } else if (functionCall.name === 'xpath_query') {
          const xpath = functionCall.args.xpath as string
          const maxResults = (functionCall.args.maxResults as number) || 10

          if (!validateXPath(xpath)) {
            const errorContent = `Invalid XPath expression: "${xpath}". XPath must use safe patterns only.`
            console.log(`[Gemini] ⚠️  ${errorContent}`)
            functionResponses.push({
              functionResponse: {
                name: 'xpath_query',
                response: {
                  error: errorContent
                }
              }
            })
            continue
          }
          console.log(`[Gemini] 🔍 Executing XPath: "${xpath}" (max ${maxResults} results)`)

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

          functionResponses.push({
            functionResponse: {
              name: 'xpath_query',
              response: {
                result: resultContent
              }
            }
          })
        } else {
          functionResponses.push({
            functionResponse: {
              name: functionCall.name,
              response: {
                error: `Unknown function "${functionCall.name}"`
              }
            }
          })
        }
      }

      if (functionResponses.length > 0) {
        contents.push({
          role: 'user',
          parts: functionResponses
        })
        console.log(`[Gemini] ✅ Processed ${functionResponses.length} function results, continuing loop...`)
      }
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
