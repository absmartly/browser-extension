import { AnthropicProvider } from '../anthropic'
import Anthropic from '@anthropic-ai/sdk'
import type { AIProviderConfig } from '../base'
import * as utils from '../utils'
import { unsafeSessionId } from '~src/types/branded'

jest.mock('@anthropic-ai/sdk')
jest.mock('../utils', () => ({
  sanitizeHtml: jest.fn((html) => html),
  getSystemPrompt: jest.fn(),
  buildUserMessage: jest.fn(),
  buildSystemPromptWithDOMStructure: jest.fn((prompt, domStructure) =>
    domStructure ? prompt + '\n\n## Page DOM Structure\n' + domStructure : prompt
  ),
  createSession: jest.fn((session) => {
    const { unsafeSessionId } = require('~src/types/branded')
    return session || {
      id: unsafeSessionId('test-session-id'),
      htmlSent: false,
      messages: []
    }
  })
}))

const createConfig = (overrides?: {
  apiKey?: string
  llmModel?: string
  customEndpoint?: string
}): AIProviderConfig => ({
  apiKey: overrides?.apiKey ?? 'sk-ant-test-key',
  aiProvider: 'anthropic-api',
  llmModel: overrides?.llmModel,
  customEndpoint: overrides?.customEndpoint
})

describe('AnthropicProvider', () => {
  let mockAnthropicInstance: jest.Mocked<Anthropic>
  let mockMessages: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()

    mockMessages = {
      create: jest.fn()
    }

    mockAnthropicInstance = {
      messages: mockMessages
    } as any

    ;(Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropicInstance)

    jest.mocked(utils.getSystemPrompt).mockResolvedValue('System prompt for testing')
    jest.mocked(utils.buildUserMessage).mockReturnValue('User message: test prompt')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with API key only', () => {
      const config = createConfig()
      const provider = new AnthropicProvider(config)

      expect(provider).toBeInstanceOf(AnthropicProvider)
    })

    it('should initialize with custom endpoint', () => {
      const config = createConfig({
        customEndpoint: 'https://custom.anthropic.com/v1'
      })

      const provider = new AnthropicProvider(config)

      expect(provider).toBeInstanceOf(AnthropicProvider)
    })

    it('should initialize with default config', () => {
      const config = createConfig()
      const provider = new AnthropicProvider(config)

      expect(provider).toBeInstanceOf(AnthropicProvider)
    })
  })

  describe('getToolDefinition', () => {
    it('should return Anthropic tool definition with correct structure', () => {
      const provider = new AnthropicProvider(createConfig())
      const toolDef = provider.getToolDefinition()

      expect(toolDef).toHaveProperty('name')
      expect(toolDef).toHaveProperty('description')
      expect(toolDef).toHaveProperty('input_schema')
    })

    it('should have correct tool name', () => {
      const provider = new AnthropicProvider(createConfig())
      const toolDef = provider.getToolDefinition()

      expect(toolDef.name).toBe('dom_changes_generator')
    })

    it('should have meaningful description', () => {
      const provider = new AnthropicProvider(createConfig())
      const toolDef = provider.getToolDefinition()

      expect(toolDef.description).toContain('DOM change')
      expect(toolDef.description).toContain('A/B test')
    })

    it('should reference shared schema', () => {
      const provider = new AnthropicProvider(createConfig())
      const toolDef = provider.getToolDefinition()

      expect(toolDef.input_schema).toBeDefined()
      expect(toolDef.input_schema).toHaveProperty('type')
      expect(toolDef.input_schema).toHaveProperty('properties')
    })
  })

  describe('generate', () => {
    it('should create Anthropic client with API key', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(Anthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-ant-test-key',
          dangerouslyAllowBrowser: true
        })
      )
    })

    it('should use custom endpoint when provided', async () => {
      const provider = new AnthropicProvider(createConfig({
        apiKey: 'sk-ant-test-key',
        customEndpoint: 'https://custom.anthropic.com/v1'
      }))

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(Anthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-ant-test-key',
          baseURL: 'https://custom.anthropic.com/v1'
        })
      )
    })

    it('should throw error when API key is not provided', async () => {
      const provider = new AnthropicProvider(createConfig({ apiKey: '' }))

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('API key is required')
    })

    it('should include DOM structure in system prompt for new session', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      await provider.generate('<html><body>Test</body></html>', 'test prompt', [], undefined, {
        domStructure: 'html\n  body\n    test content'
      })

      expect(mockMessages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Page DOM Structure')
        })
      )
    })

    it('should not include HTML in system prompt for existing session with htmlSent=true', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      await provider.generate(
        '',
        'test prompt',
        [],
        undefined,
        {
          conversationSession: {
            id: unsafeSessionId('session-123'),
            htmlSent: true,
            messages: []
          }
        }
      )

      expect(mockMessages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.not.stringContaining('<html>')
        })
      )
    })

    it('should throw error when HTML is required but not provided', async () => {
      const provider = new AnthropicProvider(createConfig())

      await expect(
        provider.generate('', 'test prompt', [], undefined, {})
      ).rejects.toThrow('HTML or DOM structure is required for first message in conversation')
    })

    it('should sanitize system prompt', async () => {
      const provider = new AnthropicProvider(createConfig())

      jest.mocked(utils.sanitizeHtml).mockImplementation((html) => html.replace(/\x00/g, ''))

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(utils.sanitizeHtml).toHaveBeenCalled()
    })

    it('should include images in message content', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      const images = ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==']

      await provider.generate('<html></html>', 'test prompt', [], images, {})

      expect(mockMessages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'image',
                  source: expect.objectContaining({
                    type: 'base64',
                    media_type: 'image/png'
                  })
                })
              ])
            })
          ])
        })
      )
    })

    it('should use claude-sonnet-4-5-20250929 model', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockMessages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929'
        })
      )
    })

    it('should include tools in the API call', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockMessages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({ name: 'dom_changes_generator' })
          ])
        })
      )
    })

    it('should return result with domChanges from tool_use response', async () => {
      const provider = new AnthropicProvider(createConfig())

      const mockDomChanges = [
        { selector: '.button', type: 'style', value: { color: 'red' } }
      ]

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: mockDomChanges,
            response: 'Changed button color to red',
            action: 'append'
          }
        }]
      })

      const result = await provider.generate('<html></html>', 'Change button color', [], undefined, {})

      expect(result.domChanges).toEqual(mockDomChanges)
      expect(result.response).toBe('Changed button color to red')
      expect(result.action).toBe('append')
      expect(result.session).toBeDefined()
    })

    it('should create new session when not provided', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      const result = await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(result.session).toBeDefined()
      expect(result.session.id).toBeDefined()
      expect(result.session.htmlSent).toBe(true)
      expect(result.session.messages).toEqual([
        { role: 'user', content: 'User message: test prompt' },
        { role: 'assistant', content: 'Test response' }
      ])
    })

    it('should preserve existing session messages', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Second response',
            action: 'none'
          }
        }]
      })

      const existingSession = {
        id: unsafeSessionId('session-123'),
        htmlSent: true,
        messages: [
          { role: 'user' as const, content: 'First message' },
          { role: 'assistant' as const, content: 'First response' }
        ]
      }

      const result = await provider.generate('', 'Second message', [], undefined, {
        conversationSession: existingSession
      })

      expect(result.session.messages).toHaveLength(4)
      expect(result.session.messages[0].content).toBe('First message')
      expect(result.session.messages[3].content).toBe('Second response')
    })

    it('should handle text response as conversational when tool_use is not used', async () => {
      const provider = new AnthropicProvider(createConfig())

      const conversationalText = 'I can help you with that. What specific changes would you like to make?'
      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: conversationalText
        }]
      })

      const result = await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(result.domChanges).toEqual([])
      expect(result.response).toBe(conversationalText)
      expect(result.action).toBe('none')
    })

    it('should return raw text when model provides text instead of tool use', async () => {
      const provider = new AnthropicProvider(createConfig())

      const textWithJson = '```json\n{"domChanges": [], "response": "Wrapped response", "action": "none"}\n```'
      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: textWithJson
        }]
      })

      const result = await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(result.domChanges).toEqual([])
      expect(result.response).toBe(textWithJson)
      expect(result.action).toBe('none')
    })

    it('should handle conversational response when no JSON is present', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'This is just a conversational message without JSON'
        }]
      })

      const result = await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(result.domChanges).toEqual([])
      expect(result.response).toBe('This is just a conversational message without JSON')
      expect(result.action).toBe('none')
    })

    it('should throw error for invalid tool_use response', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            response: 'Missing domChanges and action'
          }
        }]
      })

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('Tool use validation failed')
    })

    it('should include current changes in user message when provided', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      const currentChanges = [
        { selector: '.existing', type: 'text' as const, value: 'Old text' }
      ]

      await provider.generate('<html></html>', 'Add more changes', currentChanges, undefined, {})

      expect(utils.buildUserMessage).toHaveBeenCalledWith('Add more changes', currentChanges)
    })

    it('should set max_tokens to 4096', async () => {
      const provider = new AnthropicProvider(createConfig())

      mockMessages.create.mockResolvedValue({
        content: [{
          type: 'tool_use',
          name: 'dom_changes_generator',
          input: {
            domChanges: [],
            response: 'Test response',
            action: 'none'
          }
        }]
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockMessages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 4096
        })
      )
    })
  })
})
