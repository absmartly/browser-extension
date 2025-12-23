import { createAIProvider } from '../factory'
import { AnthropicProvider } from '../anthropic'
import { OpenAIProvider } from '../openai'
import { BridgeProvider } from '../bridge'
import type { AIProviderConfig } from '../base'

jest.mock('../anthropic')
jest.mock('../openai')
jest.mock('../bridge')

describe('AI Provider Factory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('createAIProvider', () => {
    it('should create AnthropicProvider for anthropic-api', () => {
      const config: AIProviderConfig = {
        apiKey: 'sk-ant-test-key',
        aiProvider: 'anthropic-api'
      }

      createAIProvider(config)

      expect(AnthropicProvider).toHaveBeenCalledWith(config)
      expect(AnthropicProvider).toHaveBeenCalledTimes(1)
      expect(OpenAIProvider).not.toHaveBeenCalled()
      expect(BridgeProvider).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('[Factory] Creating AI provider:', 'anthropic-api')
    })

    it('should create OpenAIProvider for openai-api', () => {
      const config: AIProviderConfig = {
        apiKey: 'sk-openai-test-key',
        aiProvider: 'openai-api'
      }

      createAIProvider(config)

      expect(OpenAIProvider).toHaveBeenCalledWith(config)
      expect(OpenAIProvider).toHaveBeenCalledTimes(1)
      expect(AnthropicProvider).not.toHaveBeenCalled()
      expect(BridgeProvider).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('[Factory] Creating AI provider:', 'openai-api')
    })

    it('should create BridgeProvider for claude-subscription', () => {
      const config: AIProviderConfig = {
        apiKey: '',
        aiProvider: 'claude-subscription'
      }

      createAIProvider(config)

      expect(BridgeProvider).toHaveBeenCalledWith(config)
      expect(BridgeProvider).toHaveBeenCalledTimes(1)
      expect(AnthropicProvider).not.toHaveBeenCalled()
      expect(OpenAIProvider).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('[Factory] Creating AI provider:', 'claude-subscription')
    })

    it('should pass config with OAuth settings to AnthropicProvider', () => {
      const config: AIProviderConfig = {
        apiKey: 'sk-ant-test-key',
        aiProvider: 'anthropic-api',
        useOAuth: true,
        oauthToken: 'oauth-token-123'
      }

      createAIProvider(config)

      expect(AnthropicProvider).toHaveBeenCalledWith(config)
      expect(AnthropicProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-ant-test-key',
          useOAuth: true,
          oauthToken: 'oauth-token-123'
        })
      )
    })

    it('should default to BridgeProvider for unknown provider type', () => {
      const config: AIProviderConfig = {
        apiKey: 'test-key',
        aiProvider: 'unknown-provider' as any
      }

      createAIProvider(config)

      expect(BridgeProvider).toHaveBeenCalledWith(config)
      expect(BridgeProvider).toHaveBeenCalledTimes(1)
      expect(console.warn).toHaveBeenCalledWith(
        '[Factory] Unknown provider, defaulting to BridgeProvider:',
        'unknown-provider'
      )
    })

    it('should default to BridgeProvider for null provider type', () => {
      const config: AIProviderConfig = {
        apiKey: 'test-key',
        aiProvider: null as any
      }

      createAIProvider(config)

      expect(BridgeProvider).toHaveBeenCalledWith(config)
      expect(console.warn).toHaveBeenCalledWith(
        '[Factory] Unknown provider, defaulting to BridgeProvider:',
        null
      )
    })

    it('should default to BridgeProvider for undefined provider type', () => {
      const config: AIProviderConfig = {
        apiKey: 'test-key',
        aiProvider: undefined as any
      }

      createAIProvider(config)

      expect(BridgeProvider).toHaveBeenCalledWith(config)
      expect(console.warn).toHaveBeenCalledWith(
        '[Factory] Unknown provider, defaulting to BridgeProvider:',
        undefined
      )
    })

    it('should handle empty API key for bridge provider', () => {
      const config: AIProviderConfig = {
        apiKey: '',
        aiProvider: 'claude-subscription'
      }

      createAIProvider(config)

      expect(BridgeProvider).toHaveBeenCalledWith(config)
      expect(BridgeProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: ''
        })
      )
    })

    it('should preserve all config properties when creating provider', () => {
      const config: AIProviderConfig = {
        apiKey: 'test-key',
        aiProvider: 'anthropic-api',
        useOAuth: false,
        oauthToken: undefined
      }

      createAIProvider(config)

      expect(AnthropicProvider).toHaveBeenCalledWith(config)
      expect(AnthropicProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-key',
          aiProvider: 'anthropic-api',
          useOAuth: false,
          oauthToken: undefined
        })
      )
    })

    it('should create different providers for different calls', () => {
      const config1: AIProviderConfig = {
        apiKey: 'key1',
        aiProvider: 'anthropic-api'
      }

      const config2: AIProviderConfig = {
        apiKey: 'key2',
        aiProvider: 'openai-api'
      }

      createAIProvider(config1)
      createAIProvider(config2)

      expect(AnthropicProvider).toHaveBeenCalledTimes(1)
      expect(OpenAIProvider).toHaveBeenCalledTimes(1)
      expect(AnthropicProvider).toHaveBeenCalledWith(config1)
      expect(OpenAIProvider).toHaveBeenCalledWith(config2)
    })

    it('should handle rapid successive calls', () => {
      const config: AIProviderConfig = {
        apiKey: 'test-key',
        aiProvider: 'anthropic-api'
      }

      createAIProvider(config)
      createAIProvider(config)
      createAIProvider(config)

      expect(AnthropicProvider).toHaveBeenCalledTimes(3)
      expect(console.log).toHaveBeenCalledTimes(3)
    })
  })

  describe('Provider exports', () => {
    it('should export AnthropicProvider class', () => {
      expect(AnthropicProvider).toBeDefined()
    })

    it('should export OpenAIProvider class', () => {
      expect(OpenAIProvider).toBeDefined()
    })

    it('should export BridgeProvider class', () => {
      expect(BridgeProvider).toBeDefined()
    })
  })
})
