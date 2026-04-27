import { AnthropicProvider } from "~src/lib/ai-providers/anthropic"
import { GeminiProvider } from "~src/lib/ai-providers/gemini"
import { OpenAIProvider } from "~src/lib/ai-providers/openai"
import { OpenRouterProvider } from "~src/lib/ai-providers/openrouter"

import { ModelFetcher } from "../model-fetcher"

global.fetch = jest.fn()

describe("ModelFetcher", () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "log").mockImplementation()
    jest.spyOn(console, "error").mockImplementation()
    ModelFetcher.clearCache()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("fetchModels - generic behavior", () => {
    const config = OpenAIProvider.modelConfig

    it("should fetch models using defaultEndpoint + modelsPath", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "gpt-4-turbo", object: "model" },
            { id: "gpt-4", object: "model" }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchModels(
        "openai",
        "sk-test-key",
        config
      )

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models",
        expect.objectContaining({
          headers: { Authorization: "Bearer sk-test-key" }
        })
      )
      expect(models).toHaveLength(2)
      expect(models[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        provider: "OpenAI"
      })
    })

    it("should use buildUrl when provided (Gemini)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              name: "models/gemini-pro",
              displayName: "Gemini Pro",
              supportedGenerationMethods: ["generateContent"],
              inputTokenLimit: 32768,
              outputTokenLimit: 2048
            }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchModels(
        "gemini",
        "AIza-test-key",
        GeminiProvider.modelConfig
      )

      expect(mockFetch).toHaveBeenCalledWith(
        "https://generativelanguage.googleapis.com/v1beta/models?key=AIza-test-key",
        expect.any(Object)
      )
      expect(models).toHaveLength(1)
      expect(models[0]).toMatchObject({
        id: "gemini-pro",
        name: "Gemini Pro",
        provider: "Google"
      })
    })

    it("should use custom endpoint when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "claude-sonnet-4-5-20250514",
              type: "model",
              display_name: "Claude Sonnet 4.5",
              context_window: 200000
            }
          ]
        })
      } as Response)

      await ModelFetcher.fetchModels(
        "anthropic",
        "sk-ant-test-key",
        AnthropicProvider.modelConfig,
        "https://custom.endpoint.com"
      )

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.endpoint.com/v1/models",
        expect.any(Object)
      )
    })

    it("should cache models after first fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "gpt-4", object: "model" }]
        })
      } as Response)

      await ModelFetcher.fetchModels("openai", "sk-test-key", config)
      const cachedModels = await ModelFetcher.fetchModels(
        "openai",
        "sk-test-key",
        config
      )

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(cachedModels).toHaveLength(1)
    })

    it("should return staticModels on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized"
      } as Response)

      const models = await ModelFetcher.fetchModels(
        "openai",
        "invalid-key",
        config
      )

      expect(models.length).toBeGreaterThan(0)
      expect(models[0]).toHaveProperty("id")
      expect(models[0]).toHaveProperty("name")
    })

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      const models = await ModelFetcher.fetchModels(
        "openai",
        "sk-test-key",
        config
      )

      expect(models.length).toBeGreaterThan(0)
      expect(console.error).toHaveBeenCalled()
    })

    it("should not make duplicate requests for concurrent fetches", async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    data: [{ id: "gpt-4", object: "model" }]
                  })
                } as Response),
              100
            )
          )
      )

      const promise1 = ModelFetcher.fetchModels("openai", "sk-test-key", config)
      const promise2 = ModelFetcher.fetchModels("openai", "sk-test-key", config)

      const [models1, models2] = await Promise.all([promise1, promise2])

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(models1).toEqual(models2)
    })
  })

  describe("provider-specific parsing", () => {
    it("should filter OpenAI models for GPT only", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "gpt-4-turbo", object: "model" },
            { id: "text-embedding-ada-002", object: "model" },
            { id: "gpt-3.5-turbo", object: "model" },
            { id: "whisper-1", object: "model" }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchModels(
        "openai",
        "sk-test-key",
        OpenAIProvider.modelConfig
      )

      expect(models).toHaveLength(2)
      expect(models.every((m) => m.id.includes("gpt"))).toBe(true)
    })

    it("should filter Gemini models for generateContent only", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              name: "models/gemini-pro",
              displayName: "Gemini Pro",
              supportedGenerationMethods: ["generateContent"],
              inputTokenLimit: 32768,
              outputTokenLimit: 2048
            },
            {
              name: "models/embedding-001",
              displayName: "Embedding Model",
              supportedGenerationMethods: ["embedContent"],
              inputTokenLimit: 2048,
              outputTokenLimit: 768
            }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchModels(
        "gemini",
        "AIza-test-key",
        GeminiProvider.modelConfig
      )

      expect(models).toHaveLength(1)
      expect(models[0].id).toBe("gemini-pro")
    })

    it("should filter Anthropic models by type", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "claude-sonnet-4-5-20250514",
              type: "model",
              display_name: "Claude Sonnet 4.5",
              context_window: 200000
            },
            {
              id: "some-other-thing",
              type: "not-a-model",
              display_name: "Not a model"
            }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchModels(
        "anthropic",
        "sk-ant-test-key",
        AnthropicProvider.modelConfig
      )

      expect(models).toHaveLength(1)
      expect(models[0].id).toBe("claude-sonnet-4-5-20250514")
      expect(models[0].provider).toBe("Anthropic")
    })

    it("should parse Anthropic models with correct headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "claude-haiku-3-5-20241022",
              type: "model",
              display_name: "Claude Haiku 3.5",
              context_window: 200000
            }
          ]
        })
      } as Response)

      await ModelFetcher.fetchModels(
        "anthropic",
        "sk-ant-test-key",
        AnthropicProvider.modelConfig
      )

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/models",
        expect.objectContaining({
          headers: {
            "x-api-key": "sk-ant-test-key",
            "anthropic-version": "2023-06-01"
          }
        })
      )
    })

    it("should convert OpenRouter pricing to per 1M tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "openai/gpt-4",
              name: "GPT-4",
              pricing: { prompt: "0.00003", completion: "0.00006" },
              context_length: 8192
            }
          ]
        })
      } as Response)

      const models = await ModelFetcher.fetchModels(
        "openrouter",
        "sk-or-test-key",
        OpenRouterProvider.modelConfig
      )

      expect(models[0].pricing).toBeDefined()
      expect(models[0].pricing!.input).toBe(30)
      expect(models[0].pricing!.output).toBe(60)
    })
  })

  describe("fetchGroupedModels", () => {
    it("should group OpenRouter models by provider", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "openai/gpt-4",
              name: "GPT-4",
              pricing: { prompt: "0.00003", completion: "0.00006" },
              context_length: 8192
            },
            {
              id: "openai/gpt-3.5-turbo",
              name: "GPT-3.5 Turbo",
              pricing: { prompt: "0.0000005", completion: "0.0000015" },
              context_length: 16385
            },
            {
              id: "anthropic/claude-3-opus",
              name: "Claude 3 Opus",
              pricing: { prompt: "0.000015", completion: "0.000075" },
              context_length: 200000
            },
            {
              id: "google/gemini-pro",
              name: "Gemini Pro",
              pricing: { prompt: "0.000000125", completion: "0.000000375" },
              context_length: 32768
            }
          ]
        })
      } as Response)

      const grouped = await ModelFetcher.fetchGroupedModels(
        "openrouter",
        "sk-or-test-key",
        OpenRouterProvider.modelConfig
      )

      expect(grouped["Openai"]).toHaveLength(2)
      expect(grouped["Anthropic"]).toHaveLength(1)
      expect(grouped["Google"]).toHaveLength(1)
    })

    it("should return static models grouped on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized"
      } as Response)

      const grouped = await ModelFetcher.fetchGroupedModels(
        "openrouter",
        "invalid-key",
        OpenRouterProvider.modelConfig
      )

      expect(Object.keys(grouped).length).toBeGreaterThan(0)
    })
  })

  describe("clearCache", () => {
    it("should clear cache for specific provider", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "gpt-4", object: "model" }]
        })
      } as Response)

      await ModelFetcher.fetchModels(
        "openai",
        "sk-test-key",
        OpenAIProvider.modelConfig
      )
      ModelFetcher.clearCache("openai")
      await ModelFetcher.fetchModels(
        "openai",
        "sk-test-key",
        OpenAIProvider.modelConfig
      )

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it("should clear all cache when no provider specified", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: "gpt-4", object: "model" }]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [
              {
                name: "models/gemini-pro",
                displayName: "Gemini Pro",
                supportedGenerationMethods: ["generateContent"],
                inputTokenLimit: 32768,
                outputTokenLimit: 2048
              }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: "gpt-4", object: "model" }]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            models: [
              {
                name: "models/gemini-pro",
                displayName: "Gemini Pro",
                supportedGenerationMethods: ["generateContent"],
                inputTokenLimit: 32768,
                outputTokenLimit: 2048
              }
            ]
          })
        } as Response)

      await ModelFetcher.fetchModels(
        "openai",
        "sk-test-key",
        OpenAIProvider.modelConfig
      )
      await ModelFetcher.fetchModels(
        "gemini",
        "AIza-test-key",
        GeminiProvider.modelConfig
      )

      ModelFetcher.clearCache()

      await ModelFetcher.fetchModels(
        "openai",
        "sk-test-key",
        OpenAIProvider.modelConfig
      )
      await ModelFetcher.fetchModels(
        "gemini",
        "AIza-test-key",
        GeminiProvider.modelConfig
      )

      expect(mockFetch).toHaveBeenCalledTimes(4)
    })
  })
})
