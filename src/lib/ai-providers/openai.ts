import OpenAI from "openai"

import {
  classifyAIError,
  formatClassifiedError
} from "~src/lib/ai-error-classifier"
import type { ConversationSession } from "~src/types/absmartly"
import type { AIDOMGenerationResult, DOMChange } from "~src/types/dom-changes"
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
  ModelConfig,
  ModelInfo
} from "./base"
import { withTimeout } from "./constants"
import {
  CSS_QUERY_DESCRIPTION,
  CSS_QUERY_SCHEMA,
  DOM_CHANGES_TOOL_DESCRIPTION,
  SHARED_TOOL_SCHEMA,
  XPATH_QUERY_DESCRIPTION,
  XPATH_QUERY_SCHEMA
} from "./shared-schema"
import { parseToolArguments } from "./utils"

export class OpenAIProvider implements AIProvider {
  static modelConfig: ModelConfig = {
    defaultEndpoint: "https://api.openai.com/v1",
    modelsPath: "/models",
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    parseModels: (data) => {
      const nameMap: Record<string, string> = {
        "gpt-4-turbo": "GPT-4 Turbo",
        "gpt-4-turbo-preview": "GPT-4 Turbo Preview",
        "gpt-4": "GPT-4",
        "gpt-4-32k": "GPT-4 32K",
        "gpt-3.5-turbo": "GPT-3.5 Turbo",
        "gpt-3.5-turbo-16k": "GPT-3.5 Turbo 16K"
      }
      return (data.data || [])
        .filter((m: any) => m.id.includes("gpt"))
        .map(
          (m: any): ModelInfo => ({
            id: m.id,
            name: nameMap[m.id] || m.id,
            provider: "OpenAI"
          })
        )
        .sort((a: ModelInfo, b: ModelInfo) => b.id.localeCompare(a.id))
    },
    staticModels: () => [
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI" },
      { id: "gpt-4", name: "GPT-4", provider: "OpenAI" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OpenAI" }
    ]
  }

  constructor(private config: AIProviderConfig) {}

  getChunkRetrievalPrompt(): string {
    return ""
  }

  getToolDefinition(): OpenAI.ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "dom_changes_generator",
        description: DOM_CHANGES_TOOL_DESCRIPTION,
        parameters: SHARED_TOOL_SCHEMA
      }
    }
  }

  getCssQueryTool(): OpenAI.ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "css_query",
        description: CSS_QUERY_DESCRIPTION,
        parameters: CSS_QUERY_SCHEMA
      }
    }
  }

  getXPathQueryTool(): OpenAI.ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "xpath_query",
        description: XPATH_QUERY_DESCRIPTION,
        parameters: XPATH_QUERY_SCHEMA
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
    debugLog("[OpenAI] generateWithOpenAI() called with agentic loop")

    const openai = new OpenAI({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true,
      ...(this.config.customEndpoint && { baseURL: this.config.customEndpoint })
    })

    const { session, systemPrompt, userMessageText } = await prepareSession(
      html,
      prompt,
      currentChanges,
      options,
      "OpenAI"
    )

    debugLog("[OpenAI] System prompt length:", systemPrompt.length)

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...session.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content
      })),
      { role: "user", content: userMessageText }
    ]

    if (images && images.length > 0) {
      debugLog("[OpenAI] Note: Image support not yet implemented for OpenAI")
    }

    session.messages.push({ role: "user", content: userMessageText })

    const tools = [
      this.getToolDefinition(),
      this.getCssQueryTool(),
      this.getXPathQueryTool()
    ]

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      debugLog(`[OpenAI] Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS}`)

      let completion: OpenAI.ChatCompletion
      try {
        completion = await withTimeout(
          openai.chat.completions.create({
            model: this.config.llmModel || "gpt-4-turbo",
            messages,
            tools
          })
        )
      } catch (error: any) {
        const errorMessage =
          error.message || error.error?.message || "OpenAI API error"
        const baseError = new Error(errorMessage)
        const classified = classifyAIError(baseError)
        throw new Error(formatClassifiedError(classified))
      }

      debugLog("[OpenAI] Received response from OpenAI")
      const message = completion.choices[0]?.message

      if (!message) {
        throw new Error("No message in OpenAI response")
      }

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return makeConversationalResponse(message.content || "", session)
      }

      messages.push({
        role: "assistant",
        content: message.content,
        tool_calls: message.tool_calls
      })

      const toolCalls: ToolCall[] = []
      for (const tc of message.tool_calls) {
        if (tc.type !== "function") continue
        toolCalls.push({
          name: tc.function.name,
          id: tc.id,
          input: tc.function.arguments
        })
      }

      const outcome = await processToolCalls(toolCalls, "OpenAI", (raw) =>
        parseToolArguments(raw, "tool", "OpenAI")
      )

      if (outcome.type === "final") {
        return makeFinalResponse(outcome.result, session)
      }

      for (const r of outcome.results) {
        messages.push({ role: "tool", tool_call_id: r.id, content: r.content })
      }

      debugLog(
        `[OpenAI] Processed ${outcome.results.length} tool results, continuing loop...`
      )
    }

    throw new Error(
      `Agentic loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS})`
    )
  }
}
