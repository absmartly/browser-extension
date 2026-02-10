import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'

export type AIProviderType =
  | 'claude-subscription'
  | 'codex'
  | 'anthropic-api'
  | 'openai-api'
  | 'openrouter-api'
  | 'gemini-api'

export type AIProviderConfig =
  | {
      aiProvider: 'anthropic-api'
      apiKey: string
      llmModel?: string
      customEndpoint?: string
    }
  | {
      aiProvider: 'claude-subscription'
      customEndpoint?: string
      apiKey?: never
      llmModel?: string
    }
  | {
      aiProvider: 'openai-api'
      apiKey: string
      llmModel?: string
      customEndpoint?: string
    }
  | {
      aiProvider: 'openrouter-api'
      apiKey: string
      llmModel: string
      customEndpoint?: string
    }
  | {
      aiProvider: 'gemini-api'
      apiKey: string
      llmModel?: string
      customEndpoint?: string
    }
  | {
      aiProvider: 'codex'
      customEndpoint?: string
      apiKey?: never
      llmModel?: string
    }

export interface GenerateOptions {
  conversationSession?: ConversationSession
  pageUrl?: string
  domStructure?: string
}

export interface AIProvider {
  generate(
    html: string,
    prompt: string,
    currentChanges: DOMChange[],
    images: string[] | undefined,
    options: GenerateOptions
  ): Promise<AIDOMGenerationResult & { session: ConversationSession }>

  getToolDefinition(): any

  getChunkRetrievalPrompt(): string
}

export function isAnthropicConfig(
  config: AIProviderConfig
): config is Extract<AIProviderConfig, { aiProvider: 'anthropic-api' }> {
  return config.aiProvider === 'anthropic-api'
}

export function isClaudeSubscriptionConfig(
  config: AIProviderConfig
): config is Extract<AIProviderConfig, { aiProvider: 'claude-subscription' }> {
  return config.aiProvider === 'claude-subscription'
}

export function isOpenAIConfig(
  config: AIProviderConfig
): config is Extract<AIProviderConfig, { aiProvider: 'openai-api' }> {
  return config.aiProvider === 'openai-api'
}

export function isOpenRouterConfig(
  config: AIProviderConfig
): config is Extract<AIProviderConfig, { aiProvider: 'openrouter-api' }> {
  return config.aiProvider === 'openrouter-api'
}

export function isGeminiConfig(
  config: AIProviderConfig
): config is Extract<AIProviderConfig, { aiProvider: 'gemini-api' }> {
  return config.aiProvider === 'gemini-api'
}

export function isCodexConfig(
  config: AIProviderConfig
): config is Extract<AIProviderConfig, { aiProvider: 'codex' }> {
  return config.aiProvider === 'codex'
}

export type BridgeProviderName = 'claude' | 'codex'

export function getBridgeProviderName(aiProvider: AIProviderType): BridgeProviderName {
  if (aiProvider === 'codex') return 'codex'
  return 'claude'
}
