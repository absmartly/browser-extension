import type { OpenRouterModel, OpenRouterModelsResponse } from '~src/types/openrouter'
import type { GeminiModelsResponse } from '~src/types/gemini'

export interface ModelInfo {
  id: string
  name: string
  provider?: string
  contextWindow?: number
  pricing?: {
    input: number
    output: number
  }
  description?: string
}

export interface GroupedModels {
  [provider: string]: ModelInfo[]
}

class ModelFetcherClass {
  private cache: Map<string, ModelInfo[]> = new Map()
  private fetchingPromises: Map<string, Promise<ModelInfo[]>> = new Map()

  async fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
    const cacheKey = 'openai'

    if (this.cache.has(cacheKey)) {
      console.log('[ModelFetcher] Returning cached OpenAI models')
      return this.cache.get(cacheKey)!
    }

    if (this.fetchingPromises.has(cacheKey)) {
      console.log('[ModelFetcher] Already fetching OpenAI models, returning existing promise')
      return this.fetchingPromises.get(cacheKey)!
    }

    const fetchPromise = this.doFetchOpenAIModels(apiKey)
    this.fetchingPromises.set(cacheKey, fetchPromise)

    try {
      const models = await fetchPromise
      this.cache.set(cacheKey, models)
      return models
    } finally {
      this.fetchingPromises.delete(cacheKey)
    }
  }

  private async doFetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      console.log('[ModelFetcher] Fetching OpenAI models...')
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = await response.json()
      const chatModels = data.data
        .filter((m: any) => m.id.includes('gpt'))
        .map((m: any) => ({
          id: m.id,
          name: this.formatOpenAIModelName(m.id),
          provider: 'OpenAI'
        }))
        .sort((a: ModelInfo, b: ModelInfo) => b.id.localeCompare(a.id))

      console.log(`[ModelFetcher] Fetched ${chatModels.length} OpenAI models`)
      return chatModels
    } catch (error) {
      console.error('[ModelFetcher] Error fetching OpenAI models:', error)
      return this.getStaticOpenAIModels()
    }
  }

  private formatOpenAIModelName(id: string): string {
    const nameMap: Record<string, string> = {
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
      'gpt-4': 'GPT-4',
      'gpt-4-32k': 'GPT-4 32K',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K'
    }
    return nameMap[id] || id
  }

  private getStaticOpenAIModels(): ModelInfo[] {
    return [
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
      { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' }
    ]
  }

  async fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
    const cacheKey = 'gemini'

    if (this.cache.has(cacheKey)) {
      console.log('[ModelFetcher] Returning cached Gemini models')
      return this.cache.get(cacheKey)!
    }

    if (this.fetchingPromises.has(cacheKey)) {
      console.log('[ModelFetcher] Already fetching Gemini models, returning existing promise')
      return this.fetchingPromises.get(cacheKey)!
    }

    const fetchPromise = this.doFetchGeminiModels(apiKey)
    this.fetchingPromises.set(cacheKey, fetchPromise)

    try {
      const models = await fetchPromise
      this.cache.set(cacheKey, models)
      return models
    } finally {
      this.fetchingPromises.delete(cacheKey)
    }
  }

  private async doFetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      console.log('[ModelFetcher] Fetching Gemini models...')
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      )

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`)
      }

      const data: GeminiModelsResponse = await response.json()
      const chatModels = data.models
        .filter(m => m.supportedGenerationMethods.includes('generateContent'))
        .map(m => ({
          id: m.name.replace('models/', ''),
          name: m.displayName,
          provider: 'Google',
          contextWindow: m.inputTokenLimit,
          description: m.description
        }))

      console.log(`[ModelFetcher] Fetched ${chatModels.length} Gemini models`)
      return chatModels
    } catch (error) {
      console.error('[ModelFetcher] Error fetching Gemini models:', error)
      return this.getStaticGeminiModels()
    }
  }

  private getStaticGeminiModels(): ModelInfo[] {
    return [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', contextWindow: 2097152 },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', contextWindow: 1048576 },
      { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', contextWindow: 32768 }
    ]
  }

  async fetchOpenRouterModels(apiKey: string): Promise<GroupedModels> {
    const cacheKey = 'openrouter'

    if (this.cache.has(cacheKey)) {
      console.log('[ModelFetcher] Returning cached OpenRouter models')
      return this.groupModelsByProvider(this.cache.get(cacheKey)!)
    }

    if (this.fetchingPromises.has(cacheKey)) {
      console.log('[ModelFetcher] Already fetching OpenRouter models, returning existing promise')
      const models = await this.fetchingPromises.get(cacheKey)!
      return this.groupModelsByProvider(models)
    }

    const fetchPromise = this.doFetchOpenRouterModels(apiKey)
    this.fetchingPromises.set(cacheKey, fetchPromise)

    try {
      const models = await fetchPromise
      this.cache.set(cacheKey, models)
      return this.groupModelsByProvider(models)
    } finally {
      this.fetchingPromises.delete(cacheKey)
    }
  }

  private async doFetchOpenRouterModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      console.log('[ModelFetcher] Fetching OpenRouter models...')
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`)
      }

      const data: OpenRouterModelsResponse = await response.json()
      const models = data.data.map((m: OpenRouterModel) => ({
        id: m.id,
        name: m.name,
        provider: this.extractProviderFromModelId(m.id),
        contextWindow: m.context_length,
        pricing: {
          input: parseFloat(m.pricing.prompt) * 1000000,
          output: parseFloat(m.pricing.completion) * 1000000
        },
        description: m.description
      }))

      console.log(`[ModelFetcher] Fetched ${models.length} OpenRouter models`)
      return models
    } catch (error) {
      console.error('[ModelFetcher] Error fetching OpenRouter models:', error)
      return this.getStaticOpenRouterModels()
    }
  }

  private extractProviderFromModelId(id: string): string {
    const parts = id.split('/')
    if (parts.length >= 2) {
      const provider = parts[0]
      return provider.charAt(0).toUpperCase() + provider.slice(1)
    }
    return 'Unknown'
  }

  private groupModelsByProvider(models: ModelInfo[]): GroupedModels {
    const grouped: GroupedModels = {}

    for (const model of models) {
      const provider = model.provider || 'Other'
      if (!grouped[provider]) {
        grouped[provider] = []
      }
      grouped[provider].push(model)
    }

    return grouped
  }

  private getStaticOpenRouterModels(): ModelInfo[] {
    return [
      { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
      { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
      { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
      { id: 'google/gemini-pro', name: 'Gemini Pro', provider: 'Google' }
    ]
  }

  getStaticAnthropicModels(): ModelInfo[] {
    return [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest)', provider: 'Anthropic', contextWindow: 200000 },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic', contextWindow: 200000 },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'Anthropic', contextWindow: 200000 },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'Anthropic', contextWindow: 200000 }
    ]
  }

  clearCache(provider?: string): void {
    if (provider) {
      this.cache.delete(provider)
      console.log(`[ModelFetcher] Cleared cache for ${provider}`)
    } else {
      this.cache.clear()
      console.log('[ModelFetcher] Cleared all model cache')
    }
  }
}

export const ModelFetcher = new ModelFetcherClass()
