import type { AIProvider, AIProviderConfig } from './base'
import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'
import { BridgeProvider } from './bridge'

export function createAIProvider(config: AIProviderConfig): AIProvider {
  console.log('[Factory] Creating AI provider:', config.aiProvider)

  switch (config.aiProvider) {
    case 'anthropic-api':
      return new AnthropicProvider(config)

    case 'openai-api':
      return new OpenAIProvider(config)

    case 'claude-subscription':
      return new BridgeProvider(config)

    default:
      console.warn('[Factory] Unknown provider, defaulting to BridgeProvider:', config.aiProvider)
      return new BridgeProvider(config)
  }
}

export { AnthropicProvider, OpenAIProvider, BridgeProvider }
export type { AIProvider, AIProviderConfig }
