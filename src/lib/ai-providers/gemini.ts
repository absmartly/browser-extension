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

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export class GeminiProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  getChunkRetrievalPrompt(): string {
    return ''
  }

  getToolDefinition(): GeminiFunctionDeclaration {
    return {
      name: 'dom_changes_generator',
      description: DOM_CHANGES_TOOL_DESCRIPTION,
      parameters: SHARED_TOOL_SCHEMA as GeminiFunctionDeclaration['parameters']
    }
  }

  getCssQueryTool(): GeminiFunctionDeclaration {
    return {
      name: 'css_query',
      description: CSS_QUERY_DESCRIPTION,
      parameters: CSS_QUERY_SCHEMA as GeminiFunctionDeclaration['parameters']
    }
  }

  getXPathQueryTool(): GeminiFunctionDeclaration {
    return {
      name: 'xpath_query',
      description: XPATH_QUERY_DESCRIPTION,
      parameters: XPATH_QUERY_SCHEMA as GeminiFunctionDeclaration['parameters']
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

    const { session, systemPrompt, userMessageText } = await prepareSession(
      html, prompt, currentChanges, options, 'Gemini'
    )

    debugLog('[Gemini] System prompt length:', systemPrompt.length)

    const contents: GeminiContent[] = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'I understand. I will help you generate DOM changes for your A/B test.' }] }
    ]

    for (const msg of session.messages) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })
    }

    contents.push({ role: 'user', parts: [{ text: userMessageText }] })
    session.messages.push({ role: 'user', content: userMessageText })

    const tools: GeminiTool = {
      functionDeclarations: [
        this.getToolDefinition(),
        this.getCssQueryTool(),
        this.getXPathQueryTool()
      ]
    }

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      debugLog(`[Gemini] Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      const requestBody: GeminiGenerateContentRequest = {
        contents,
        tools: [tools],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7
        }
      }

      const modelName = this.config.llmModel.includes('models/')
        ? this.config.llmModel
        : `models/${this.config.llmModel}`

      const response = await withTimeout(
        fetch(`${this.config.customEndpoint || GEMINI_API_BASE}/${modelName}:generateContent?key=${this.config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      )

      if (!response.ok) {
        const errorText = await response.text()
        const baseError = new Error(parseAPIError({ message: errorText }, `Gemini API error (${response.status})`))
        const classified = classifyAIError(baseError)
        throw new Error(formatClassifiedError(classified))
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
        const responseText = textParts.map(p => p.text).join('\n').trim()
        return makeConversationalResponse(responseText, session)
      }

      contents.push({ role: 'model', parts: candidate.content.parts })

      const toolCalls: ToolCall[] = functionCalls.map((part, idx) => ({
        name: part.functionCall!.name,
        id: `gemini-${iteration}-${idx}`,
        input: part.functionCall!.args
      }))

      const outcome = await processToolCalls(toolCalls, 'Gemini')

      if (outcome.type === 'final') {
        return makeFinalResponse(outcome.result, session)
      }

      const functionResponses = outcome.results.map(r => {
        const name = toolCalls.find(tc => tc.id === r.id)?.name || 'unknown'
        const contentObj = r.content.startsWith('Error:')
          ? { error: r.content }
          : { result: r.content }
        return { functionResponse: { name, response: contentObj } }
      })

      contents.push({ role: 'user', parts: functionResponses })
      debugLog(`[Gemini] Processed ${functionResponses.length} function results, continuing loop...`)
    }

    throw new Error(`Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`)
  }
}
