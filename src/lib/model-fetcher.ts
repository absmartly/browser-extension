import type { ModelConfig, ModelInfo } from "~src/lib/ai-providers/base"
import { debugLog } from "~src/utils/debug"
import { notifyUser } from "~src/utils/notifications"

export type { ModelInfo } from "~src/lib/ai-providers/base"

export interface GroupedModels {
  [provider: string]: ModelInfo[]
}

class ModelFetcherClass {
  private cache: Map<string, ModelInfo[]> = new Map()
  private fetchingPromises: Map<string, Promise<ModelInfo[]>> = new Map()

  async fetchModels(
    providerKey: string,
    apiKey: string,
    config: ModelConfig,
    customEndpoint?: string
  ): Promise<ModelInfo[]> {
    if (this.cache.has(providerKey)) {
      debugLog(`[ModelFetcher] Returning cached ${providerKey} models`)
      return this.cache.get(providerKey)!
    }

    if (this.fetchingPromises.has(providerKey)) {
      debugLog(
        `[ModelFetcher] Already fetching ${providerKey} models, returning existing promise`
      )
      return this.fetchingPromises.get(providerKey)!
    }

    const fetchPromise = this.doFetch(
      providerKey,
      apiKey,
      config,
      customEndpoint
    )
    this.fetchingPromises.set(providerKey, fetchPromise)

    try {
      const models = await fetchPromise
      this.cache.set(providerKey, models)
      return models
    } finally {
      this.fetchingPromises.delete(providerKey)
    }
  }

  async fetchGroupedModels(
    providerKey: string,
    apiKey: string,
    config: ModelConfig,
    customEndpoint?: string
  ): Promise<GroupedModels> {
    const models = await this.fetchModels(
      providerKey,
      apiKey,
      config,
      customEndpoint
    )
    return this.groupModelsByProvider(models)
  }

  private async doFetch(
    providerKey: string,
    apiKey: string,
    config: ModelConfig,
    customEndpoint?: string
  ): Promise<ModelInfo[]> {
    try {
      debugLog(`[ModelFetcher] Fetching ${providerKey} models...`)
      const baseURL = customEndpoint || config.defaultEndpoint
      const url = config.buildUrl
        ? config.buildUrl(baseURL, apiKey)
        : `${baseURL}${config.modelsPath}`
      const headers = config.headers(apiKey)

      const response = await fetch(url, {
        headers: Object.keys(headers).length > 0 ? headers : undefined
      })

      if (!response.ok) {
        throw new Error(`${providerKey} API error: ${response.statusText}`)
      }

      const data = await response.json()
      const models = config.parseModels(data)

      debugLog(`[ModelFetcher] Fetched ${models.length} ${providerKey} models`)
      return models.length > 0 ? models : config.staticModels()
    } catch (error) {
      console.error(
        `[ModelFetcher] Error fetching ${providerKey} models:`,
        error
      )

      let userMessage = `Failed to fetch latest models from ${providerKey}. `
      if (
        error?.message?.includes("401") ||
        error?.message?.includes("403") ||
        error?.message?.includes("unauthorized")
      ) {
        userMessage += "Please check your API key in settings."
      } else if (error?.message?.includes("429")) {
        userMessage += "Rate limit exceeded. Try again in a moment."
      } else if (
        error?.message?.includes("network") ||
        error?.message?.includes("fetch")
      ) {
        userMessage += "Network connection failed."
      } else {
        userMessage += "Using cached model list."
      }

      notifyUser(userMessage, "warning")
      return config.staticModels()
    }
  }

  private groupModelsByProvider(models: ModelInfo[]): GroupedModels {
    const grouped: GroupedModels = {}
    for (const model of models) {
      const provider = model.provider || "Other"
      if (!grouped[provider]) {
        grouped[provider] = []
      }
      grouped[provider].push(model)
    }
    return grouped
  }

  clearCache(provider?: string): void {
    if (provider) {
      this.cache.delete(provider)
      debugLog(`[ModelFetcher] Cleared cache for ${provider}`)
    } else {
      this.cache.clear()
      debugLog("[ModelFetcher] Cleared all model cache")
    }
  }
}

export const ModelFetcher = new ModelFetcherClass()
