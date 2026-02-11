import { GeminiProvider } from '../gemini'
import type { AIProviderConfig } from '../base'
import * as utils from '../utils'

jest.mock('../utils', () => ({
  getSystemPrompt: jest.fn(),
  buildUserMessage: jest.fn(),
  sanitizeHtml: jest.fn((html) => html),
  buildSystemPromptWithDOMStructure: jest.fn((prompt, domStructure) =>
    domStructure ? prompt + '\n\n## Page DOM Structure\n' + domStructure : prompt
  ),
  createSession: jest.fn((session) => session || {
    id: 'test-session-id',
    htmlSent: false,
    messages: []
  })
}))

global.fetch = jest.fn()

describe('GeminiProvider', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()

    jest.mocked(utils.getSystemPrompt).mockResolvedValue('System prompt for testing')
    jest.mocked(utils.buildUserMessage).mockReturnValue('User message: test prompt')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with API key and model', () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      expect(provider).toBeInstanceOf(GeminiProvider)
    })
  })

  describe('getToolDefinition', () => {
    it('should return Gemini function declaration', () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)
      const funcDef = provider.getToolDefinition()

      expect(funcDef).toHaveProperty('name', 'dom_changes_generator')
      expect(funcDef).toHaveProperty('description')
      expect(funcDef).toHaveProperty('parameters')
      expect(funcDef.parameters).toHaveProperty('type', 'object')
      expect(funcDef.parameters).toHaveProperty('properties')
    })
  })

  describe('generate', () => {
    it('should throw error when model is not provided', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api'
      }
      const provider = new GeminiProvider(config)

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('Model is required for Gemini provider')
    })

    it('should call Gemini API with correct URL format', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'dom_changes_generator',
                  args: {
                    domChanges: [],
                    response: 'Test response',
                    action: 'none'
                  }
                }
              }]
            }
          }]
        })
      } as Response)

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent'),
        expect.any(Object)
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('?key=AIza-test-key'),
        expect.any(Object)
      )
    })

    it('should handle model name with models/ prefix', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'models/gemini-pro'
      }
      const provider = new GeminiProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'dom_changes_generator',
                  args: {
                    domChanges: [],
                    response: 'Test response',
                    action: 'none'
                  }
                }
              }]
            }
          }]
        })
      } as Response)

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('models/gemini-pro:generateContent'),
        expect.any(Object)
      )
    })

    it('should include system prompt as first user message with model response', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'dom_changes_generator',
                  args: {
                    domChanges: [],
                    response: 'Test response',
                    action: 'none'
                  }
                }
              }]
            }
          }]
        })
      } as Response)

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody.contents[0].role).toBe('user')
      expect(requestBody.contents[0].parts[0].text).toContain('System prompt for testing')
      expect(requestBody.contents[1].role).toBe('model')
      expect(requestBody.contents[1].parts[0].text).toContain('I will help you generate DOM changes')
    })

    it('should include function declarations in tools', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'dom_changes_generator',
                  args: {
                    domChanges: [],
                    response: 'Test response',
                    action: 'none'
                  }
                }
              }]
            }
          }]
        })
      } as Response)

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody.tools).toHaveLength(1)
      expect(requestBody.tools[0].functionDeclarations).toBeDefined()
      const funcNames = requestBody.tools[0].functionDeclarations.map((f: any) => f.name)
      expect(funcNames).toContain('dom_changes_generator')
      expect(funcNames).toContain('css_query')
      expect(funcNames).toContain('xpath_query')
    })

    it('should return result from functionCall response', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      const mockDomChanges = [
        { selector: '.button', type: 'style', value: { color: 'blue' } }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'dom_changes_generator',
                  args: {
                    domChanges: mockDomChanges,
                    response: 'Changed button color to blue',
                    action: 'append'
                  }
                }
              }]
            }
          }]
        })
      } as Response)

      const result = await provider.generate('<html></html>', 'Change button color', [], undefined, {})

      expect(result.domChanges).toEqual(mockDomChanges)
      expect(result.response).toBe('Changed button color to blue')
      expect(result.action).toBe('append')
      expect(result.session).toBeDefined()
    })

    it('should create new session when not provided', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'dom_changes_generator',
                  args: {
                    domChanges: [],
                    response: 'Test response',
                    action: 'none'
                  }
                }
              }]
            }
          }]
        })
      } as Response)

      const result = await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(result.session).toBeDefined()
      expect(result.session.id).toBeDefined()
      expect(result.session.htmlSent).toBe(true)
    })

    it('should handle conversational response without function calls', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      const conversationalText = 'I can help you with that. What specific changes would you like to make?'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: conversationalText
              }]
            }
          }]
        })
      } as Response)

      const result = await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(result.domChanges).toEqual([])
      expect(result.response).toBe(conversationalText)
      expect(result.action).toBe('none')
    })

    it('should throw error when API returns non-ok status', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key'
      } as Response)

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('Authentication failed. Check your API key in Settings')
    })

    it('should throw error when no candidates in response', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: []
        })
      } as Response)

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('No candidates in Gemini response')
    })

    it('should throw error for invalid functionCall response', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'dom_changes_generator',
                  args: {
                    response: 'Missing domChanges and action'
                  }
                }
              }]
            }
          }]
        })
      } as Response)

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('Tool call validation failed')
    })

    it('should include generationConfig in request body', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'dom_changes_generator',
                  args: {
                    domChanges: [],
                    response: 'Test response',
                    action: 'none'
                  }
                }
              }]
            }
          }]
        })
      } as Response)

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)
      expect(requestBody.generationConfig).toBeDefined()
      expect(requestBody.generationConfig.maxOutputTokens).toBe(4096)
      expect(requestBody.generationConfig.temperature).toBe(0.7)
    })

    it('should include DOM structure in system prompt for new session', async () => {
      const config: AIProviderConfig = {
        apiKey: 'AIza-test-key',
        aiProvider: 'gemini-api',
        llmModel: 'gemini-1.5-pro'
      }
      const provider = new GeminiProvider(config)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'dom_changes_generator',
                  args: {
                    domChanges: [],
                    response: 'Test response',
                    action: 'none'
                  }
                }
              }]
            }
          }]
        })
      } as Response)

      await provider.generate('<html><body>Test</body></html>', 'test prompt', [], undefined, {
        domStructure: '<html>\n  <body>Test</body>\n</html>'
      })

      const callArgs = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)
      const firstUserMessage = requestBody.contents[0]
      expect(firstUserMessage.parts[0].text).toContain('Page DOM Structure')
    })
  })
})
