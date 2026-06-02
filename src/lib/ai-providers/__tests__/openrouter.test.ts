import type { AIProviderConfig } from "../base"
import { OpenRouterProvider } from "../openrouter"
import * as utils from "../utils"

jest.mock("../utils", () => ({
  getSystemPrompt: jest.fn(),
  buildUserMessage: jest.fn(),
  buildSystemPromptWithDOMStructure: jest.fn((prompt, domStructure) =>
    domStructure
      ? prompt + "\n\n## Page DOM Structure\n" + domStructure
      : prompt
  ),
  parseToolArguments: jest.fn((raw, toolName, provider) => JSON.parse(raw)),
  createSession: jest.fn(
    (session) =>
      session || {
        id: "test-session-id",
        htmlSent: false,
        messages: []
      }
  )
}))

global.fetch = jest.fn()
global.chrome = {
  runtime: {
    getURL: jest.fn(() => "chrome-extension://test/")
  }
} as any

describe("OpenRouterProvider", () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "log").mockImplementation()
    jest.spyOn(console, "error").mockImplementation()

    jest
      .mocked(utils.getSystemPrompt)
      .mockResolvedValue("System prompt for testing")
    jest
      .mocked(utils.buildUserMessage)
      .mockReturnValue("User message: test prompt")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("constructor", () => {
    it("should initialize with API key and model", () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)

      expect(provider).toBeInstanceOf(OpenRouterProvider)
    })
  })

  describe("getToolDefinition", () => {
    it("should return OpenAI-compatible function tool definition", () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)
      const toolDef = provider.getToolDefinition()

      expect(toolDef).toHaveProperty("type", "function")
      expect(toolDef).toHaveProperty("function")
      const funcDef = (toolDef as any).function
      expect(funcDef).toHaveProperty("name", "dom_changes_generator")
      expect(funcDef).toHaveProperty("description")
      expect(funcDef).toHaveProperty("parameters")
    })
  })

  describe("generate", () => {
    it("should throw error when model is not provided", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)

      provider["config"].llmModel = ""

      await expect(
        provider.generate("<html></html>", "test prompt", [], undefined, {})
      ).rejects.toThrow("Model is required for OpenRouter provider")
    })

    it("should call OpenRouter API with correct headers", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "anthropic/claude-3-sonnet"
      }
      const provider = new OpenRouterProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: "function",
                    id: "call-123",
                    function: {
                      name: "dom_changes_generator",
                      arguments: JSON.stringify({
                        domChanges: [],
                        response: "Test response",
                        action: "none"
                      })
                    }
                  }
                ]
              }
            }
          ]
        })
      } as Response)

      await provider.generate("<html></html>", "test prompt", [], undefined, {})

      expect(mockFetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer sk-or-test-key",
            "Content-Type": "application/json",
            "HTTP-Referer": "chrome-extension://test/",
            "X-Title": "ABsmartly Browser Extension"
          })
        })
      )
    })

    it("should use specified model in API call", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "google/gemini-pro"
      }
      const provider = new OpenRouterProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: "function",
                    id: "call-123",
                    function: {
                      name: "dom_changes_generator",
                      arguments: JSON.stringify({
                        domChanges: [],
                        response: "Test response",
                        action: "none"
                      })
                    }
                  }
                ]
              }
            }
          ]
        })
      } as Response)

      await provider.generate("<html></html>", "test prompt", [], undefined, {})

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)
      expect(requestBody.model).toBe("google/gemini-pro")
    })

    it("should include DOM structure in system prompt for new session", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: "function",
                    id: "call-123",
                    function: {
                      name: "dom_changes_generator",
                      arguments: JSON.stringify({
                        domChanges: [],
                        response: "Test response",
                        action: "none"
                      })
                    }
                  }
                ]
              }
            }
          ]
        })
      } as Response)

      await provider.generate(
        "<html><body>Test</body></html>",
        "test prompt",
        [],
        undefined,
        {
          domStructure: "<html>\n  <body>Test</body>\n</html>"
        }
      )

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)
      const systemMessage = requestBody.messages.find(
        (m: any) => m.role === "system"
      )
      expect(systemMessage.content).toContain("Page DOM Structure")
    })

    it("should return result from tool_calls response", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)

      const mockDomChanges = [
        { selector: ".button", type: "style", value: { color: "blue" } }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: "function",
                    id: "call-123",
                    function: {
                      name: "dom_changes_generator",
                      arguments: JSON.stringify({
                        domChanges: mockDomChanges,
                        response: "Changed button color to blue",
                        action: "append"
                      })
                    }
                  }
                ]
              }
            }
          ]
        })
      } as Response)

      const result = await provider.generate(
        "<html></html>",
        "Change button color",
        [],
        undefined,
        {}
      )

      expect(result.domChanges).toEqual(mockDomChanges)
      expect(result.response).toBe("Changed button color to blue")
      expect(result.action).toBe("append")
      expect(result.session).toBeDefined()
    })

    it("should create new session when not provided", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: "function",
                    id: "call-123",
                    function: {
                      name: "dom_changes_generator",
                      arguments: JSON.stringify({
                        domChanges: [],
                        response: "Test response",
                        action: "none"
                      })
                    }
                  }
                ]
              }
            }
          ]
        })
      } as Response)

      const result = await provider.generate(
        "<html></html>",
        "test prompt",
        [],
        undefined,
        {}
      )

      expect(result.session).toBeDefined()
      expect(result.session.id).toBeDefined()
      expect(result.session.htmlSent).toBe(true)
    })

    it("should handle conversational response without tool calls", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)

      const conversationalText =
        "I can help you with that. What specific changes would you like to make?"
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: conversationalText
              }
            }
          ]
        })
      } as Response)

      const result = await provider.generate(
        "<html></html>",
        "test prompt",
        [],
        undefined,
        {}
      )

      expect(result.domChanges).toEqual([])
      expect(result.response).toBe(conversationalText)
      expect(result.action).toBe("none")
    })

    it("should throw error when API returns non-ok status", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Invalid API key"
      } as Response)

      await expect(
        provider.generate("<html></html>", "test prompt", [], undefined, {})
      ).rejects.toThrow("Authentication failed. Check your API key in Settings")
    })

    it("should throw error when no message in response", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: []
        })
      } as Response)

      await expect(
        provider.generate("<html></html>", "test prompt", [], undefined, {})
      ).rejects.toThrow("No message in OpenRouter response")
    })

    it("should throw error for invalid tool_call response", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: "function",
                    id: "call-123",
                    function: {
                      name: "dom_changes_generator",
                      arguments: JSON.stringify({
                        response: "Missing domChanges and action"
                      })
                    }
                  }
                ]
              }
            }
          ]
        })
      } as Response)

      await expect(
        provider.generate("<html></html>", "test prompt", [], undefined, {})
      ).rejects.toThrow("Tool call validation failed")
    })

    it("should include max_tokens in request body", async () => {
      const config: AIProviderConfig = {
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4-turbo"
      }
      const provider = new OpenRouterProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: "function",
                    id: "call-123",
                    function: {
                      name: "dom_changes_generator",
                      arguments: JSON.stringify({
                        domChanges: [],
                        response: "Test response",
                        action: "none"
                      })
                    }
                  }
                ]
              }
            }
          ]
        })
      } as Response)

      await provider.generate("<html></html>", "test prompt", [], undefined, {})

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)
      expect(requestBody.max_tokens).toBe(4096)
    })
  })

  describe("generateStructured", () => {
    const schema = {
      name: "fill_experiment_fields",
      description: "Test fill",
      input_schema: {
        type: "object" as const,
        properties: { display_name: { type: "string" } },
        required: ["display_name"]
      }
    }

    const makeOkResponse = (toolName: string, args: Record<string, unknown>) =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: "function",
                    id: "call-123",
                    function: {
                      name: toolName,
                      arguments: JSON.stringify(args)
                    }
                  }
                ]
              }
            }
          ]
        })
      }) as Response

    it("returns parsed tool arguments and posts the right body", async () => {
      const provider = new OpenRouterProvider({
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4o"
      })
      mockFetch.mockResolvedValueOnce(
        makeOkResponse("fill_experiment_fields", { display_name: "Hero CTA" })
      )

      const result = await provider.generateStructured!({
        systemPrompt: "system",
        userMessage: "user",
        schema
      })

      expect(result).toEqual({ display_name: "Hero CTA" })
      expect(mockFetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer sk-or-test-key",
            "HTTP-Referer": "chrome-extension://test/",
            "X-Title": "ABsmartly Browser Extension"
          })
        })
      )
      const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string)
      expect(body.model).toBe("openai/gpt-4o")
      // No tool_choice — relying on system prompt + single tool for proxy compat.
      expect(body).not.toHaveProperty("tool_choice")
      expect(body.tools[0].function.name).toBe("fill_experiment_fields")
      expect(body.messages[0]).toEqual({ role: "system", content: "system" })
    })

    it("attaches images as image_url content parts", async () => {
      const provider = new OpenRouterProvider({
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4o"
      })
      mockFetch.mockResolvedValueOnce(
        makeOkResponse("fill_experiment_fields", { display_name: "X" })
      )

      await provider.generateStructured!({
        systemPrompt: "s",
        userMessage: "u",
        schema,
        images: ["data:image/png;base64,ABC"]
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string)
      expect(body.messages[1].content).toEqual(
        expect.arrayContaining([
          { type: "text", text: "u" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,ABC" }
          }
        ])
      )
    })

    it("uses customEndpoint when provided", async () => {
      const provider = new OpenRouterProvider({
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4o",
        customEndpoint: "https://custom.openrouter/v1"
      })
      mockFetch.mockResolvedValueOnce(
        makeOkResponse("fill_experiment_fields", { display_name: "X" })
      )

      await provider.generateStructured!({
        systemPrompt: "s",
        userMessage: "u",
        schema
      })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.openrouter/v1/chat/completions",
        expect.any(Object)
      )
    })

    it("throws when no matching tool call is returned", async () => {
      const provider = new OpenRouterProvider({
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4o"
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            { finish_reason: "stop", message: { content: "no tool call" } }
          ]
        })
      } as Response)

      await expect(
        provider.generateStructured!({
          systemPrompt: "s",
          userMessage: "u",
          schema
        })
      ).rejects.toThrow(/no 'fill_experiment_fields' tool call/)
    })

    it("throws on HTTP 5xx", async () => {
      const provider = new OpenRouterProvider({
        apiKey: "sk-or-test-key",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4o"
      })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "internal error"
      } as Response)

      await expect(
        provider.generateStructured!({
          systemPrompt: "s",
          userMessage: "u",
          schema
        })
      ).rejects.toThrow(/OpenRouter API error: 500/)
    })

    it("throws when API key is missing", async () => {
      const provider = new OpenRouterProvider({
        apiKey: "",
        aiProvider: "openrouter-api",
        llmModel: "openai/gpt-4o"
      })

      await expect(
        provider.generateStructured!({
          systemPrompt: "s",
          userMessage: "u",
          schema
        })
      ).rejects.toThrow(/API key is required/)
    })
  })
})
