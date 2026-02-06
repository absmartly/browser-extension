import type { AIProvider, AIProviderConfig } from './base'
import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'
import { BridgeProvider } from './bridge'
import { OpenRouterProvider } from './openrouter'
import { GeminiProvider } from './gemini'
import { debugLog } from '~src/utils/debug'

export function createAIProvider(config: AIProviderConfig): AIProvider {
  debugLog('[Factory] Creating AI provider:', config.aiProvider)

  switch (config.aiProvider) {
    case 'anthropic-api':
      return new AnthropicProvider(config)

    case 'openai-api':
      return new OpenAIProvider(config)

    case 'openrouter-api':
      return new OpenRouterProvider(config)

    case 'gemini-api':
      return new GeminiProvider(config)

    case 'claude-subscription':
      return new BridgeProvider(config)

    default:
      debugLog('[Factory] Unknown provider, defaulting to BridgeProvider:', config.aiProvider)
      return new BridgeProvider(config)
  }
}

export { AnthropicProvider, OpenAIProvider, BridgeProvider, OpenRouterProvider, GeminiProvider }
export type { AIProvider, AIProviderConfig }
