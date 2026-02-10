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
        aiProvider: 'claude-subscription'
      }

      createAIProvider(config)

      expect(BridgeProvider).toHaveBeenCalledWith(config)
      expect(BridgeProvider).toHaveBeenCalledTimes(1)
      expect(AnthropicProvider).not.toHaveBeenCalled()
      expect(OpenAIProvider).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('[Factory] Creating AI provider:', 'claude-subscription')
    })

    it('should create BridgeProvider for codex', () => {
      const config: AIProviderConfig = {
        aiProvider: 'codex'
      }

      createAIProvider(config)

      expect(BridgeProvider).toHaveBeenCalledWith(config)
      expect(BridgeProvider).toHaveBeenCalledTimes(1)
      expect(AnthropicProvider).not.toHaveBeenCalled()
      expect(OpenAIProvider).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('[Factory] Creating AI provider:', 'codex')
    })

    it('should preserve all config properties when creating provider', () => {
      const config: AIProviderConfig = {
        apiKey: 'test-key',
        aiProvider: 'anthropic-api',
        llmModel: 'claude-sonnet-4-5-20250929'
      }

      createAIProvider(config)

      expect(AnthropicProvider).toHaveBeenCalledWith(config)
      expect(AnthropicProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-key',
          aiProvider: 'anthropic-api',
          llmModel: 'claude-sonnet-4-5-20250929'
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
