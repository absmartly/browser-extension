import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'

export type AIProviderType =
  | 'claude-subscription'
  | 'anthropic-api'
  | 'openai-api'
  | 'openrouter-api'
  | 'gemini-api'
  | 'claude-code-bridge'
  | 'codex'

export type AIProviderConfig =
  | {
      aiProvider: 'anthropic-api'
      apiKey: string
      llmModel?: string
      customEndpoint?: string
      useOAuth?: never
      oauthToken?: never
    }
  | {
      aiProvider: 'claude-subscription'
      useOAuth: true
      oauthToken: string
      llmModel?: string
      apiKey?: never
      customEndpoint?: never
    }
  | {
      aiProvider: 'openai-api'
      apiKey: string
      llmModel?: string
      customEndpoint?: string
      useOAuth?: never
      oauthToken?: never
    }
  | {
      aiProvider: 'openrouter-api'
      apiKey: string
      llmModel: string
      customEndpoint?: string
      useOAuth?: never
      oauthToken?: never
    }
  | {
      aiProvider: 'gemini-api'
      apiKey: string
      llmModel?: string
      customEndpoint?: string
      useOAuth?: never
      oauthToken?: never
    }
  | {
      aiProvider: 'claude-code-bridge'
      customEndpoint?: string
      apiKey?: never
      llmModel?: string
      useOAuth?: never
      oauthToken?: never
    }
  | {
      aiProvider: 'codex'
      customEndpoint?: string
      apiKey?: never
      llmModel?: string
      useOAuth?: never
      oauthToken?: never
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

export function isClaudeCodeBridgeConfig(
  config: AIProviderConfig
): config is Extract<AIProviderConfig, { aiProvider: 'claude-code-bridge' }> {
  return config.aiProvider === 'claude-code-bridge'
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
