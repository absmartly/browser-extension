import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'

export interface AIProviderConfig {
  apiKey: string
  aiProvider: 'claude-subscription' | 'anthropic-api' | 'openai-api'
  useOAuth?: boolean
  oauthToken?: string
  llmModel?: string  // Model for LLM provider (e.g., 'sonnet', 'opus', 'haiku' for Claude)
}

export interface GenerateOptions {
  conversationSession?: ConversationSession
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
