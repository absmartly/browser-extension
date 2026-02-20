import { ModelFetcher } from '../model-fetcher'

global.fetch = jest.fn()

describe('ModelFetcher', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    ModelFetcher.clearCache()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('fetchOpenAIModels', () => {
    it('should fetch OpenAI models from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4-turbo', object: 'model' },
            { id: 'gpt-4', object: 'model' },
            { id: 'gpt-3.5-turbo', object: 'model' }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchOpenAIModels('sk-test-key')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer sk-test-key'
          }
        })
      )
      expect(models).toHaveLength(3)
      expect(models[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        provider: 'OpenAI'
      })
    })

    it('should filter for GPT models only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4-turbo', object: 'model' },
            { id: 'text-embedding-ada-002', object: 'model' },
            { id: 'gpt-3.5-turbo', object: 'model' },
            { id: 'whisper-1', object: 'model' }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchOpenAIModels('sk-test-key')

      expect(models).toHaveLength(2)
      expect(models.every(m => m.id.includes('gpt'))).toBe(true)
    })

    it('should format model names correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4-turbo', object: 'model' },
            { id: 'gpt-4', object: 'model' }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchOpenAIModels('sk-test-key')

      expect(models[0].name).toMatch(/GPT/)
      expect(models[1].name).toMatch(/GPT/)
    })

    it('should cache models after first fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4', object: 'model' }
          ]
        })
      } as Response)

      await ModelFetcher.fetchOpenAIModels('sk-test-key')
      const cachedModels = await ModelFetcher.fetchOpenAIModels('sk-test-key')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(cachedModels).toHaveLength(1)
    })

    it('should return static models on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response)

      const models = await ModelFetcher.fetchOpenAIModels('invalid-key')

      expect(models.length).toBeGreaterThan(0)
      expect(models[0]).toHaveProperty('id')
      expect(models[0]).toHaveProperty('name')
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const models = await ModelFetcher.fetchOpenAIModels('sk-test-key')

      expect(models.length).toBeGreaterThan(0)
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('fetchGeminiModels', () => {
    it('should fetch Gemini models from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-1.5-pro',
              displayName: 'Gemini 1.5 Pro',
              description: 'Test model',
              supportedGenerationMethods: ['generateContent'],
              inputTokenLimit: 1048576,
              outputTokenLimit: 8192
            }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchGeminiModels('AIza-test-key')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models?key=AIza-test-key'
      )
      expect(models).toHaveLength(1)
      expect(models[0]).toMatchObject({
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'Google',
        contextWindow: 1048576
      })
    })

    it('should filter for generateContent models only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-pro',
              displayName: 'Gemini Pro',
              description: 'Chat model',
              supportedGenerationMethods: ['generateContent'],
              inputTokenLimit: 32768,
              outputTokenLimit: 2048
            },
            {
              name: 'models/embedding-001',
              displayName: 'Embedding Model',
              description: 'Embedding model',
              supportedGenerationMethods: ['embedContent'],
              inputTokenLimit: 2048,
              outputTokenLimit: 768
            }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchGeminiModels('AIza-test-key')

      expect(models).toHaveLength(1)
      expect(models[0].id).toBe('gemini-pro')
    })

    it('should cache models after first fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-pro',
              displayName: 'Gemini Pro',
              supportedGenerationMethods: ['generateContent'],
              inputTokenLimit: 32768,
              outputTokenLimit: 2048
            }
          ]
        })
      } as Response)

      await ModelFetcher.fetchGeminiModels('AIza-test-key')
      const cachedModels = await ModelFetcher.fetchGeminiModels('AIza-test-key')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(cachedModels).toHaveLength(1)
    })

    it('should return static models on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response)

      const models = await ModelFetcher.fetchGeminiModels('invalid-key')

      expect(models.length).toBeGreaterThan(0)
      expect(models[0]).toHaveProperty('id')
      expect(models[0]).toHaveProperty('name')
    })
  })

  describe('fetchOpenRouterModels', () => {
    it('should fetch OpenRouter models from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openai/gpt-4-turbo',
              name: 'GPT-4 Turbo',
              pricing: {
                prompt: '0.00001',
                completion: '0.00003'
              },
              context_length: 128000
            },
            {
              id: 'anthropic/claude-3-opus',
              name: 'Claude 3 Opus',
              pricing: {
                prompt: '0.000015',
                completion: '0.000075'
              },
              context_length: 200000
            }
          ]
        })
      } as Response)

      const groupedModels = await ModelFetcher.fetchOpenRouterModels('sk-or-test-key')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer sk-or-test-key'
          }
        })
      )
      expect(Object.keys(groupedModels)).toContain('Openai')
      expect(Object.keys(groupedModels)).toContain('Anthropic')
    })

    it('should group models by provider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openai/gpt-4',
              name: 'GPT-4',
              pricing: { prompt: '0.00003', completion: '0.00006' },
              context_length: 8192
            },
            {
              id: 'openai/gpt-3.5-turbo',
              name: 'GPT-3.5 Turbo',
              pricing: { prompt: '0.0000005', completion: '0.0000015' },
              context_length: 16385
            },
            {
              id: 'google/gemini-pro',
              name: 'Gemini Pro',
              pricing: { prompt: '0.000000125', completion: '0.000000375' },
              context_length: 32768
            }
          ]
        })
      } as Response)

      const groupedModels = await ModelFetcher.fetchOpenRouterModels('sk-or-test-key')

      expect(groupedModels['Openai']).toHaveLength(2)
      expect(groupedModels['Google']).toHaveLength(1)
    })

    it('should convert pricing to per 1M tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openai/gpt-4',
              name: 'GPT-4',
              pricing: {
                prompt: '0.00003',
                completion: '0.00006'
              },
              context_length: 8192
            }
          ]
        })
      } as Response)

      const groupedModels = await ModelFetcher.fetchOpenRouterModels('sk-or-test-key')
      const model = groupedModels['Openai'][0]

      expect(model.pricing).toBeDefined()
      expect(model.pricing!.input).toBe(30)
      expect(model.pricing!.output).toBe(60)
    })

    it('should cache models after first fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openai/gpt-4',
              name: 'GPT-4',
              pricing: { prompt: '0.00003', completion: '0.00006' },
              context_length: 8192
            }
          ]
        })
      } as Response)

      await ModelFetcher.fetchOpenRouterModels('sk-or-test-key')
      const cachedModels = await ModelFetcher.fetchOpenRouterModels('sk-or-test-key')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(Object.keys(cachedModels).length).toBeGreaterThan(0)
    })

    it('should return static models on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      } as Response)

      const groupedModels = await ModelFetcher.fetchOpenRouterModels('invalid-key')

      expect(Object.keys(groupedModels).length).toBeGreaterThan(0)
    })
  })

  describe('getStaticAnthropicModels', () => {
    it('should return static Anthropic models', () => {
      const models = ModelFetcher.getStaticAnthropicModels()

      expect(models.length).toBeGreaterThan(0)
      expect(models.every(m => m.provider === 'Anthropic')).toBe(true)
      expect(models.some(m => m.name.includes('Sonnet'))).toBe(true)
      expect(models.some(m => m.name.includes('Opus'))).toBe(true)
      expect(models.some(m => m.name.includes('Haiku'))).toBe(true)
    })

    it('should include context window information', () => {
      const models = ModelFetcher.getStaticAnthropicModels()

      expect(models.every(m => m.contextWindow)).toBe(true)
      expect(models[0].contextWindow).toBe(200000)
    })
  })

  describe('clearCache', () => {
    it('should clear cache for specific provider', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4', object: 'model' }]
        })
      } as Response)

      await ModelFetcher.fetchOpenAIModels('sk-test-key')
      ModelFetcher.clearCache('openai')

      await ModelFetcher.fetchOpenAIModels('sk-test-key')

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should clear all cache when no provider specified', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: 'gpt-4', object: 'model' }]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [
              {
                name: 'models/gemini-pro',
                displayName: 'Gemini Pro',
                supportedGenerationMethods: ['generateContent'],
                inputTokenLimit: 32768,
                outputTokenLimit: 2048
              }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: 'gpt-4', object: 'model' }]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [
              {
                name: 'models/gemini-pro',
                displayName: 'Gemini Pro',
                supportedGenerationMethods: ['generateContent'],
                inputTokenLimit: 32768,
                outputTokenLimit: 2048
              }
            ]
          })
        } as Response)

      await ModelFetcher.fetchOpenAIModels('sk-test-key')
      await ModelFetcher.fetchGeminiModels('AIza-test-key')

      ModelFetcher.clearCache()

      await ModelFetcher.fetchOpenAIModels('sk-test-key')
      await ModelFetcher.fetchGeminiModels('AIza-test-key')

      expect(mockFetch).toHaveBeenCalledTimes(4)
    })
  })

  describe('concurrent fetches', () => {
    it('should not make duplicate requests for concurrent fetches', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  data: [{ id: 'gpt-4', object: 'model' }]
                })
              } as Response),
            100
          )
        )
      )

      const promise1 = ModelFetcher.fetchOpenAIModels('sk-test-key')
      const promise2 = ModelFetcher.fetchOpenAIModels('sk-test-key')

      const [models1, models2] = await Promise.all([promise1, promise2])

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(models1).toEqual(models2)
    })
  })
})
