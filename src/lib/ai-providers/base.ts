import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'

export type AIProviderType = 'claude-subscription' | 'anthropic-api' | 'openai-api' | 'openrouter-api' | 'gemini-api'

export interface AIProviderConfig {
  apiKey: string
  aiProvider: AIProviderType
  useOAuth?: boolean
  oauthToken?: string
  llmModel?: string  // Model for LLM provider (e.g., 'sonnet', 'opus', 'haiku' for Claude)
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
