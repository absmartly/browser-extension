import { createAIProvider } from "~src/lib/ai-providers"
import type { AIProviderConfig, AIProviderType } from "~src/lib/ai-providers"
import type { GenerateStructuredOptions } from "~src/lib/ai-providers/base"
import { EXPERIMENT_FILL_TOOL_SCHEMA } from "~src/lib/ai-providers/experiment-fill-schema"
import { AI_EXPERIMENT_FILL_SYSTEM_PROMPT } from "~src/prompts/ai-experiment-fill-system-prompt"
import type { AIFillRequest, AIFillResponse } from "~src/types/ai-fill"
import { debugLog } from "~src/utils/debug"

interface FillerOptions {
  aiProvider: AIProviderType
  apiKey?: string
  llmModel?: string
  customEndpoint?: string
}

export async function fillExperimentFromAI(
  request: AIFillRequest,
  options: FillerOptions
): Promise<AIFillResponse> {
  debugLog("[AI Fill] starting", {
    provider: options.aiProvider,
    variantsWithChanges: request.variantDomChanges.length,
    variantsWithScreenshots: request.variantScreenshots.length,
    customFieldCount: request.customFields.length,
    hasUserPrompt: !!request.userPrompt
  })

  const config = buildProviderConfig(options)
  const provider = createAIProvider(config)

  if (typeof provider.generateStructured !== "function") {
    throw new Error(
      `Provider "${options.aiProvider}" does not implement structured generation. ` +
        `AI fill currently requires the Claude Subscription bridge provider.`
    )
  }

  const userMessage = buildUserMessage(request)
  const images = request.variantScreenshots.flatMap((s) => [
    s.beforeDataUrl,
    s.afterDataUrl
  ])

  const opts: GenerateStructuredOptions = {
    systemPrompt: AI_EXPERIMENT_FILL_SYSTEM_PROMPT,
    userMessage,
    schema: EXPERIMENT_FILL_TOOL_SCHEMA,
    images,
    pageUrl: request.pageUrl
  }

  const result = await provider.generateStructured!<AIFillResponse>(opts)
  debugLog("[AI Fill] response keys:", Object.keys(result))
  return result
}

function buildProviderConfig(options: FillerOptions): AIProviderConfig {
  if (
    options.aiProvider === "claude-subscription" ||
    options.aiProvider === "codex"
  ) {
    return {
      aiProvider: options.aiProvider,
      customEndpoint: options.customEndpoint,
      llmModel: options.llmModel
    }
  }
  if (options.aiProvider === "openrouter-api") {
    return {
      aiProvider: "openrouter-api",
      apiKey: options.apiKey ?? "",
      llmModel: options.llmModel || "openai/gpt-4o",
      customEndpoint: options.customEndpoint
    }
  }
  return {
    aiProvider: options.aiProvider as
      | "anthropic-api"
      | "openai-api"
      | "gemini-api",
    apiKey: options.apiKey ?? "",
    llmModel: options.llmModel,
    customEndpoint: options.customEndpoint
  }
}

function buildUserMessage(req: AIFillRequest): string {
  const parts: string[] = []

  parts.push("# Page context")
  parts.push(`URL: ${req.pageUrl}`)
  parts.push(`Title: ${req.pageTitle}`)
  parts.push("")
  parts.push("## Visible text (truncated)")
  parts.push(req.pageVisibleText.slice(0, 4000))
  parts.push("")

  parts.push("# User's current draft")
  parts.push("```json")
  parts.push(JSON.stringify(req.draft, null, 2))
  parts.push("```")
  parts.push("")

  parts.push("# Custom field definitions")
  parts.push("```json")
  parts.push(JSON.stringify(req.customFields, null, 2))
  parts.push("```")
  parts.push("")

  if (req.applications && req.applications.length > 0) {
    parts.push("# Application definitions")
    parts.push("```json")
    parts.push(JSON.stringify(req.applications, null, 2))
    parts.push("```")
    parts.push("")
  }

  if (req.tags && req.tags.length > 0) {
    parts.push("# Tag definitions")
    parts.push("```json")
    parts.push(JSON.stringify(req.tags, null, 2))
    parts.push("```")
    parts.push("")
  }

  if (req.metrics && req.metrics.length > 0) {
    parts.push("# Metric definitions (metricDefinitions)")
    parts.push(
      "Reference these by their exact `name` in primary_metrics and secondary_metrics."
    )
    parts.push("```json")
    parts.push(JSON.stringify(req.metrics, null, 2))
    parts.push("```")
    parts.push("")
  }

  if (req.variantDomChanges.length > 0) {
    parts.push("# Variants with DOM changes already authored")
    for (const v of req.variantDomChanges) {
      parts.push(`## ${v.variantName} (variant index ${v.variantIndex})`)
      parts.push("```json")
      parts.push(JSON.stringify(v.changes, null, 2))
      parts.push("```")
    }
    parts.push("")
  }

  if (req.variantScreenshots.length > 0) {
    parts.push("# Screenshots attached")
    parts.push(
      "Pairs of images are attached in the order: (before, after) for each " +
        "of the variants below. Use them to ground the hypothesis/prediction/description."
    )
    for (const s of req.variantScreenshots) {
      parts.push(
        `- ${s.variantName} (index ${s.variantIndex}): before then after, ${s.width}x${s.height}`
      )
    }
    parts.push("")
  }

  if (req.userPrompt) {
    parts.push("# Extra instructions from the user")
    parts.push(req.userPrompt)
    parts.push("")
  }

  parts.push("Now call `fill_experiment_fields` with your suggested values.")
  return parts.join("\n")
}
