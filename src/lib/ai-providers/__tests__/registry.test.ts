import { PROVIDER_REGISTRY, getProviderOrigins } from '../registry'
import type { AIProviderType } from '../base'
import { AnthropicProvider } from '../anthropic'
import { OpenAIProvider } from '../openai'
import { OpenRouterProvider } from '../openrouter'
import { GeminiProvider } from '../gemini'

describe('Provider Registry', () => {
  describe('PROVIDER_REGISTRY', () => {
    const ALL_PROVIDER_IDS: AIProviderType[] = [
      'claude-subscription',
      'codex',
      'anthropic-api',
      'openai-api',
      'openrouter-api',
      'gemini-api'
    ]

    const API_PROVIDERS: AIProviderType[] = [
      'anthropic-api',
      'openai-api',
      'openrouter-api',
      'gemini-api'
    ]

    const BRIDGE_PROVIDERS: AIProviderType[] = [
      'claude-subscription',
      'codex'
    ]

    it('should have entries for all 6 provider types', () => {
      const registryKeys = Object.keys(PROVIDER_REGISTRY)
      expect(registryKeys).toHaveLength(6)
      for (const id of ALL_PROVIDER_IDS) {
        expect(PROVIDER_REGISTRY[id]).toBeDefined()
      }
    })

    it('should have correct id field matching the key for every provider', () => {
      for (const id of ALL_PROVIDER_IDS) {
        expect(PROVIDER_REGISTRY[id].id).toBe(id)
      }
    })

    describe('API providers', () => {
      it.each(API_PROVIDERS)('%s should have fetchModels function', (id) => {
        expect(typeof PROVIDER_REGISTRY[id].fetchModels).toBe('function')
      })

      it.each(API_PROVIDERS)('%s should have isBridge=false', (id) => {
        expect(PROVIDER_REGISTRY[id].isBridge).toBe(false)
      })

      it.each(API_PROVIDERS)('%s should have a non-empty defaultEndpoint', (id) => {
        expect(PROVIDER_REGISTRY[id].defaultEndpoint).toBeTruthy()
      })
    })

    describe('bridge providers', () => {
      it.each(BRIDGE_PROVIDERS)('%s should have isBridge=true', (id) => {
        expect(PROVIDER_REGISTRY[id].isBridge).toBe(true)
      })

      it.each(BRIDGE_PROVIDERS)('%s should not have fetchModels', (id) => {
        expect(PROVIDER_REGISTRY[id].fetchModels).toBeUndefined()
      })
    })

    describe('single source of truth - defaultEndpoint matches provider class modelConfig', () => {
      it('anthropic-api defaultEndpoint matches AnthropicProvider.modelConfig.defaultEndpoint', () => {
        expect(PROVIDER_REGISTRY['anthropic-api'].defaultEndpoint).toBe(
          AnthropicProvider.modelConfig.defaultEndpoint
        )
      })

      it('openai-api defaultEndpoint matches OpenAIProvider.modelConfig.defaultEndpoint', () => {
        expect(PROVIDER_REGISTRY['openai-api'].defaultEndpoint).toBe(
          OpenAIProvider.modelConfig.defaultEndpoint
        )
      })

      it('openrouter-api defaultEndpoint matches OpenRouterProvider.modelConfig.defaultEndpoint', () => {
        expect(PROVIDER_REGISTRY['openrouter-api'].defaultEndpoint).toBe(
          OpenRouterProvider.modelConfig.defaultEndpoint
        )
      })

      it('gemini-api defaultEndpoint matches GeminiProvider.modelConfig.defaultEndpoint', () => {
        expect(PROVIDER_REGISTRY['gemini-api'].defaultEndpoint).toBe(
          GeminiProvider.modelConfig.defaultEndpoint
        )
      })
    })
  })

  describe('getProviderOrigins()', () => {
    it('should return empty array for bridge provider claude-subscription', () => {
      expect(getProviderOrigins('claude-subscription')).toEqual([])
    })

    it('should return empty array for bridge provider codex', () => {
      expect(getProviderOrigins('codex')).toEqual([])
    })

    it('should return default endpoint origin for API provider with no custom endpoint', () => {
      const origins = getProviderOrigins('anthropic-api')
      expect(origins).toEqual(['https://api.anthropic.com/*'])
    })

    it('should return default endpoint origin for openai-api with no custom endpoint', () => {
      const origins = getProviderOrigins('openai-api')
      expect(origins).toEqual(['https://api.openai.com/*'])
    })

    it('should return default endpoint origin for openrouter-api with no custom endpoint', () => {
      const origins = getProviderOrigins('openrouter-api')
      expect(origins).toEqual(['https://openrouter.ai/*'])
    })

    it('should return default endpoint origin for gemini-api with no custom endpoint', () => {
      const origins = getProviderOrigins('gemini-api')
      expect(origins).toEqual(['https://generativelanguage.googleapis.com/*'])
    })

    it('should return both custom and default endpoint origins when custom endpoint is set', () => {
      const origins = getProviderOrigins('anthropic-api', 'https://my-proxy.example.com/v1')
      expect(origins).toHaveLength(2)
      expect(origins).toContain('https://my-proxy.example.com/*')
      expect(origins).toContain('https://api.anthropic.com/*')
    })

    it('should handle invalid custom URL gracefully', () => {
      const origins = getProviderOrigins('anthropic-api', 'not-a-valid-url')
      // Invalid URL is skipped, only default endpoint is returned
      expect(origins).toEqual(['https://api.anthropic.com/*'])
    })

    it('should deduplicate when custom endpoint matches default', () => {
      const origins = getProviderOrigins('anthropic-api', 'https://api.anthropic.com/v1/messages')
      expect(origins).toEqual(['https://api.anthropic.com/*'])
    })

    it('should return empty array when custom endpoint is undefined and provider has no default', () => {
      // claude-subscription has empty defaultEndpoint and isBridge=true
      const origins = getProviderOrigins('claude-subscription', undefined)
      expect(origins).toEqual([])
    })
  })

  describe('Provider modelConfig', () => {
    describe('AnthropicProvider', () => {
      it('should have a static modelConfig', () => {
        expect(AnthropicProvider.modelConfig).toBeDefined()
        expect(AnthropicProvider.modelConfig.defaultEndpoint).toBe('https://api.anthropic.com')
      })

      it('staticModels() should return non-empty array', () => {
        const models = AnthropicProvider.modelConfig.staticModels()
        expect(models.length).toBeGreaterThan(0)
        for (const model of models) {
          expect(model.id).toBeTruthy()
          expect(model.name).toBeTruthy()
          expect(model.provider).toBe('Anthropic')
        }
      })

      it('headers() should return correct auth headers', () => {
        const headers = AnthropicProvider.modelConfig.headers('test-key')
        expect(headers).toEqual({
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01'
        })
      })

      it('parseModels should handle empty data gracefully', () => {
        expect(AnthropicProvider.modelConfig.parseModels({})).toEqual([])
        expect(AnthropicProvider.modelConfig.parseModels({ data: [] })).toEqual([])
        expect(AnthropicProvider.modelConfig.parseModels({ data: null })).toEqual([])
      })
    })

    describe('OpenAIProvider', () => {
      it('should have a static modelConfig', () => {
        expect(OpenAIProvider.modelConfig).toBeDefined()
        expect(OpenAIProvider.modelConfig.defaultEndpoint).toBe('https://api.openai.com/v1')
      })

      it('staticModels() should return non-empty array', () => {
        const models = OpenAIProvider.modelConfig.staticModels()
        expect(models.length).toBeGreaterThan(0)
        for (const model of models) {
          expect(model.id).toBeTruthy()
          expect(model.name).toBeTruthy()
          expect(model.provider).toBe('OpenAI')
        }
      })

      it('headers() should return correct auth headers', () => {
        const headers = OpenAIProvider.modelConfig.headers('test-key')
        expect(headers).toEqual({ 'Authorization': 'Bearer test-key' })
      })

      it('parseModels should handle empty data gracefully', () => {
        expect(OpenAIProvider.modelConfig.parseModels({})).toEqual([])
        expect(OpenAIProvider.modelConfig.parseModels({ data: [] })).toEqual([])
        expect(OpenAIProvider.modelConfig.parseModels({ data: null })).toEqual([])
      })
    })

    describe('OpenRouterProvider', () => {
      it('should have a static modelConfig', () => {
        expect(OpenRouterProvider.modelConfig).toBeDefined()
        expect(OpenRouterProvider.modelConfig.defaultEndpoint).toBe('https://openrouter.ai/api/v1')
      })

      it('staticModels() should return non-empty array', () => {
        const models = OpenRouterProvider.modelConfig.staticModels()
        expect(models.length).toBeGreaterThan(0)
        for (const model of models) {
          expect(model.id).toBeTruthy()
          expect(model.name).toBeTruthy()
          expect(model.provider).toBeTruthy()
        }
      })

      it('headers() should return correct auth headers', () => {
        const headers = OpenRouterProvider.modelConfig.headers('test-key')
        expect(headers).toEqual({ 'Authorization': 'Bearer test-key' })
      })

      it('parseModels should handle empty data gracefully', () => {
        expect(OpenRouterProvider.modelConfig.parseModels({})).toEqual([])
        expect(OpenRouterProvider.modelConfig.parseModels({ data: [] })).toEqual([])
        expect(OpenRouterProvider.modelConfig.parseModels({ data: null })).toEqual([])
      })
    })

    describe('GeminiProvider', () => {
      it('should have a static modelConfig', () => {
        expect(GeminiProvider.modelConfig).toBeDefined()
        expect(GeminiProvider.modelConfig.defaultEndpoint).toBe(
          'https://generativelanguage.googleapis.com/v1beta'
        )
      })

      it('staticModels() should return non-empty array', () => {
        const models = GeminiProvider.modelConfig.staticModels()
        expect(models.length).toBeGreaterThan(0)
        for (const model of models) {
          expect(model.id).toBeTruthy()
          expect(model.name).toBeTruthy()
          expect(model.provider).toBe('Google')
        }
      })

      it('headers() should return empty object (Gemini uses key in URL)', () => {
        const headers = GeminiProvider.modelConfig.headers('test-key')
        expect(headers).toEqual({})
      })

      it('parseModels should handle empty data gracefully', () => {
        expect(GeminiProvider.modelConfig.parseModels({})).toEqual([])
        expect(GeminiProvider.modelConfig.parseModels({ models: [] })).toEqual([])
        expect(GeminiProvider.modelConfig.parseModels({ models: null })).toEqual([])
      })
    })
  })
})
