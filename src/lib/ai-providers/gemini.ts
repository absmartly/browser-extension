import {
  classifyAIError,
  formatClassifiedError
} from "~src/lib/ai-error-classifier"
import type { ConversationSession } from "~src/types/absmartly"
import type { AIDOMGenerationResult, DOMChange } from "~src/types/dom-changes"
import type {
  GeminiContent,
  GeminiFunctionDeclaration,
  GeminiGenerateContentRequest,
  GeminiGenerateContentResponse,
  GeminiTool
} from "~src/types/gemini"
import { debugLog } from "~src/utils/debug"

import {
  makeConversationalResponse,
  makeFinalResponse,
  MAX_TOOL_ITERATIONS,
  prepareSession,
  processToolCalls,
  type ToolCall
} from "./agentic-loop"
import type {
  AIProvider,
  AIProviderConfig,
  GenerateOptions,
  GenerateStructuredOptions,
  ModelConfig,
  ModelInfo
} from "./base"
import { parseAPIError, withTimeout } from "./constants"
import {
  CSS_QUERY_DESCRIPTION,
  CSS_QUERY_SCHEMA,
  DOM_CHANGES_TOOL_DESCRIPTION,
  SHARED_TOOL_SCHEMA,
  XPATH_QUERY_DESCRIPTION,
  XPATH_QUERY_SCHEMA
} from "./shared-schema"

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

export class GeminiProvider implements AIProvider {
  static modelConfig: ModelConfig = {
    defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta",
    modelsPath: "/models",
    headers: () => ({}),
    buildUrl: (baseURL, apiKey) => `${baseURL}/models?key=${apiKey}`,
    parseModels: (data) =>
      (data.models || [])
        .filter((m: any) =>
          m.supportedGenerationMethods?.includes("generateContent")
        )
        .map(
          (m: any): ModelInfo => ({
            id: (m.name || "").replace("models/", ""),
            name: m.displayName || m.name,
            provider: "Google",
            contextWindow: m.inputTokenLimit,
            description: m.description
          })
        ),
    staticModels: () => [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        provider: "Google",
        contextWindow: 2097152
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        provider: "Google",
        contextWindow: 1048576
      },
      {
        id: "gemini-pro",
        name: "Gemini Pro",
        provider: "Google",
        contextWindow: 32768
      }
    ]
  }

  constructor(private config: AIProviderConfig) {}

  getChunkRetrievalPrompt(): string {
    return ""
  }

  getToolDefinition(): GeminiFunctionDeclaration {
    return {
      name: "dom_changes_generator",
      description: DOM_CHANGES_TOOL_DESCRIPTION,
      parameters: SHARED_TOOL_SCHEMA as GeminiFunctionDeclaration["parameters"]
    }
  }

  getCssQueryTool(): GeminiFunctionDeclaration {
    return {
      name: "css_query",
      description: CSS_QUERY_DESCRIPTION,
      parameters: CSS_QUERY_SCHEMA as GeminiFunctionDeclaration["parameters"]
    }
  }

  getXPathQueryTool(): GeminiFunctionDeclaration {
    return {
      name: "xpath_query",
      description: XPATH_QUERY_DESCRIPTION,
      parameters: XPATH_QUERY_SCHEMA as GeminiFunctionDeclaration["parameters"]
    }
  }

  async generate(
    html: string,
    prompt: string,
    currentChanges: DOMChange[] = [],
    images: string[] | undefined,
    options: GenerateOptions
  ): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
    debugLog("[Gemini] generateWithGemini() called with agentic loop")

    if (!this.config.llmModel) {
      throw new Error("Model is required for Gemini provider")
    }

    const { session, systemPrompt, userMessageText } = await prepareSession(
      html,
      prompt,
      currentChanges,
      options,
      "Gemini"
    )

    debugLog("[Gemini] System prompt length:", systemPrompt.length)

    const contents: GeminiContent[] = [
      { role: "user", parts: [{ text: systemPrompt }] },
      {
        role: "model",
        parts: [
          {
            text: "I understand. I will help you generate DOM changes for your A/B test."
          }
        ]
      }
    ]

    for (const msg of session.messages) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      })
    }

    contents.push({ role: "user", parts: [{ text: userMessageText }] })
    session.messages.push({ role: "user", content: userMessageText })

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

      const modelName = this.config.llmModel.includes("models/")
        ? this.config.llmModel
        : `models/${this.config.llmModel}`

      const response = await withTimeout(
        fetch(
          `${this.config.customEndpoint || GEMINI_API_BASE}/${modelName}:generateContent?key=${this.config.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
          }
        )
      )

      if (!response.ok) {
        const errorText = await response.text()
        const baseError = new Error(
          parseAPIError(
            { message: errorText },
            `Gemini API error (${response.status})`
          )
        )
        const classified = classifyAIError(baseError)
        throw new Error(formatClassifiedError(classified))
      }

      const result: GeminiGenerateContentResponse = await response.json()
      debugLog("[Gemini] Received response from Gemini")

      if (!result.candidates || result.candidates.length === 0) {
        throw new Error("No candidates in Gemini response")
      }

      const candidate = result.candidates[0]
      const parts = candidate.content.parts

      const functionCalls = parts.filter((p) => p.functionCall)
      const textParts = parts.filter((p) => p.text)

      if (functionCalls.length === 0) {
        const responseText = textParts
          .map((p) => p.text)
          .join("\n")
          .trim()
        return makeConversationalResponse(responseText, session)
      }

      contents.push({ role: "model", parts: candidate.content.parts })

      const toolCalls: ToolCall[] = functionCalls.map((part, idx) => ({
        name: part.functionCall!.name,
        id: `gemini-${iteration}-${idx}`,
        input: part.functionCall!.args
      }))

      const outcome = await processToolCalls(toolCalls, "Gemini")

      if (outcome.type === "final") {
        return makeFinalResponse(outcome.result, session)
      }

      const functionResponses = outcome.results.map((r) => {
        const name = toolCalls.find((tc) => tc.id === r.id)?.name || "unknown"
        const contentObj = r.content.startsWith("Error:")
          ? { error: r.content }
          : { result: r.content }
        return { functionResponse: { name, response: contentObj } }
      })

      contents.push({ role: "user", parts: functionResponses })
      debugLog(
        `[Gemini] Processed ${functionResponses.length} function results, continuing loop...`
      )
    }

    throw new Error(
      `Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`
    )
  }

  async generateStructured<TResult = unknown>(
    opts: GenerateStructuredOptions
  ): Promise<TResult> {
    if (!this.config.apiKey) {
      throw new Error("Gemini API key is required")
    }

    const model = this.config.llmModel || "gemini-1.5-pro"
    const modelName = model.includes("models/") ? model : `models/${model}`
    const endpoint =
      `${this.config.customEndpoint || GEMINI_API_BASE}/${modelName}:generateContent` +
      `?key=${this.config.apiKey}`

    const parts: any[] = [{ text: opts.userMessage }]
    for (const img of opts.images || []) {
      const match = img.match(/^data:(image\/\w+);base64,(.+)$/)
      if (match) {
        const [, mimeType, data] = match
        parts.push({ inline_data: { mime_type: mimeType, data } })
      }
    }

    const body = {
      contents: [{ role: "user", parts }],
      system_instruction: { parts: [{ text: opts.systemPrompt }] },
      tools: [
        {
          function_declarations: [
            {
              name: opts.schema.name,
              description: opts.schema.description || "",
              parameters: stripJsonSchemaForGemini(opts.schema.input_schema)
            }
          ]
        }
      ],
      tool_config: {
        function_calling_config: {
          mode: "ANY",
          allowed_function_names: [opts.schema.name]
        }
      }
    }

    let response: Response
    try {
      response = await withTimeout(
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      )
    } catch (fetchError: any) {
      const baseError = new Error(
        `Network error: ${fetchError?.message || "Failed to fetch"}`
      )
      const classified = classifyAIError(baseError)
      throw new Error(formatClassifiedError(classified))
    }

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(
        `Gemini API error: ${response.status} ${errBody.slice(0, 500)}`
      )
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    const fnCall = candidate?.content?.parts?.find(
      (p: any) => p.functionCall?.name === opts.schema.name
    )?.functionCall
    if (!fnCall) {
      throw new Error(
        `Gemini returned no '${opts.schema.name}' function call. finish_reason=${candidate?.finishReason}`
      )
    }
    return fnCall.args as TResult
  }
}

function stripJsonSchemaForGemini(schema: unknown): unknown {
  // Gemini rejects a handful of JSON Schema extensions (notably
  // `additionalProperties` and `pattern`). Walk the schema and drop them so
  // the function declaration passes Gemini's strict validation.
  if (Array.isArray(schema)) return schema.map(stripJsonSchemaForGemini)
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
      if (k === "additionalProperties" || k === "$schema" || k === "pattern") {
        continue
      }
      out[k] = stripJsonSchemaForGemini(v)
    }
    return out
  }
  return schema
}
