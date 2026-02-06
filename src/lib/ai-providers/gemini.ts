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
import { getSystemPrompt, buildUserMessage, buildSystemPromptWithDOMStructure, createSession } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'
import { validateAIDOMGenerationResult, type ValidationResult, type ValidationError } from './validation'
import { handleCssQuery, handleXPathQuery, type ToolCallResult } from './tool-handlers'
import { API_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'
import { MAX_TOOL_ITERATIONS, AI_REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_ERROR } from './constants'
import { debugLog } from '~src/utils/debug'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

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
    debugLog('[Gemini] generateWithGemini() called with agentic loop')

    if (!this.config.llmModel) {
      throw new Error('Model is required for Gemini provider')
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
        'Gemini'
      )
      session.htmlSent = true
    }

    debugLog('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    debugLog('[Gemini] 🔍 COMPLETE SYSTEM PROMPT BEING SENT TO GEMINI:')
    debugLog('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    debugLog(systemPrompt)
    debugLog('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    debugLog(`[Gemini] 📊 System prompt length: ${systemPrompt.length} characters`)
    debugLog('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

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
      debugLog(`[Gemini] 🔄 Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      const requestBody: GeminiGenerateContentRequest = {
        contents: contents,
        tools: [tools],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7
        }
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(AI_REQUEST_TIMEOUT_ERROR)), AI_REQUEST_TIMEOUT_MS)
      })

      const modelName = this.config.llmModel.includes('models/')
        ? this.config.llmModel
        : `models/${this.config.llmModel}`

      let response: Response
      try {
        response = await Promise.race([
          fetch(`${GEMINI_API_BASE}/${modelName}:generateContent?key=${this.config.apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          }),
          timeoutPromise
        ])
      } catch (error) {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }
        throw error
      }

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }

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
      debugLog('[Gemini] Received response from Gemini')

      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('No candidates in Gemini response')
      }

      const candidate = result.candidates[0]
      const parts = candidate.content.parts

      const functionCalls = parts.filter(p => p.functionCall)
      const textParts = parts.filter(p => p.text)

      if (functionCalls.length === 0) {
        debugLog('[Gemini] ℹ️ No function calls - conversational response')

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
        debugLog(`[Gemini] 🔧 Function call: ${functionCall.name}`)

        if (functionCall.name === 'dom_changes_generator') {
          debugLog('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          debugLog('[Gemini] 📦 RAW STRUCTURED OUTPUT FROM GEMINI (function call args):')
          debugLog(JSON.stringify(functionCall.args, null, 2))
          debugLog('[Gemini] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

          const validation = validateAIDOMGenerationResult(JSON.stringify(functionCall.args))

          if (!validation.isValid) {
            const errorValidation = validation as ValidationError
            console.error('[Gemini] ❌ Function call validation failed:', errorValidation.errors)
            throw new Error(`Function call validation failed: ${errorValidation.errors.join(', ')}`)
          }

          debugLog('[Gemini] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)
          session.messages.push({ role: 'assistant', content: validation.result.response })

          return {
            ...validation.result,
            session
          }
        } else if (functionCall.name === 'css_query') {
          const selectors = functionCall.args.selectors as string[]
          const result = await handleCssQuery(selectors)

          functionResponses.push({
            functionResponse: {
              name: 'css_query',
              response: result.error ? { error: result.error } : { result: result.result }
            }
          })
        } else if (functionCall.name === 'xpath_query') {
          const xpath = functionCall.args.xpath as string
          const maxResults = (functionCall.args.maxResults as number) || 10
          const result = await handleXPathQuery(xpath, maxResults)

          functionResponses.push({
            functionResponse: {
              name: 'xpath_query',
              response: result.error ? { error: result.error } : { result: result.result }
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
        debugLog(`[Gemini] ✅ Processed ${functionResponses.length} function results, continuing loop...`)
      }
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
