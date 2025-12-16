import { OpenAIProvider } from '../openai'
import OpenAI from 'openai'
import type { AIProviderConfig } from '../base'
import * as utils from '../utils'

jest.mock('openai')
jest.mock('../utils', () => ({
  sanitizeHtml: jest.fn((html) => html),
  getSystemPrompt: jest.fn(),
  buildUserMessage: jest.fn()
}))

describe('OpenAIProvider', () => {
  let mockOpenAIInstance: jest.Mocked<OpenAI>
  let mockChatCompletions: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()

    mockChatCompletions = {
      create: jest.fn()
    }

    mockOpenAIInstance = {
      chat: {
        completions: mockChatCompletions
      }
    } as any

    ;(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAIInstance)

    jest.mocked(utils.getSystemPrompt).mockResolvedValue('System prompt for testing')
    jest.mocked(utils.buildUserMessage).mockReturnValue('User message: test prompt')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with API key', () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      expect(provider).toBeInstanceOf(OpenAIProvider)
    })
  })

  describe('getToolDefinition', () => {
    it('should return OpenAI function tool definition', () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })
      const toolDef = provider.getToolDefinition()

      expect(toolDef).toHaveProperty('type', 'function')
      expect(toolDef).toHaveProperty('function')
      const funcDef = (toolDef as any).function
      expect(funcDef).toHaveProperty('name', 'dom_changes_generator')
      expect(funcDef).toHaveProperty('description')
      expect(funcDef).toHaveProperty('parameters')
    })

    it('should use shared schema for parameters', () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })
      const toolDef = provider.getToolDefinition()

      const funcDef = (toolDef as any).function
      expect(funcDef.parameters).toBeDefined()
      expect(funcDef.parameters).toHaveProperty('type')
      expect(funcDef.parameters).toHaveProperty('properties')
    })
  })

  describe('generate', () => {
    it('should create OpenAI client with API key', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  domChanges: [],
                  response: 'Test response',
                  action: 'none'
                })
              }
            }]
          }
        }]
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(OpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-openai-test-key',
          dangerouslyAllowBrowser: true
        })
      )
    })

    it('should include HTML in system message for new session', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  domChanges: [],
                  response: 'Test response',
                  action: 'none'
                })
              }
            }]
          }
        }]
      })

      await provider.generate('<html><body>Test</body></html>', 'test prompt', [], undefined, {})

      expect(mockChatCompletions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('<html><body>Test</body></html>')
            })
          ])
        })
      )
    })

    it('should not include HTML for existing session with htmlSent=true', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  domChanges: [],
                  response: 'Test response',
                  action: 'none'
                })
              }
            }]
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
            id: 'session-123',
            htmlSent: true,
            messages: []
          }
        }
      )

      expect(mockChatCompletions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.not.stringContaining('<html>')
            })
          ])
        })
      )
    })

    it('should use gpt-4-turbo model', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  domChanges: [],
                  response: 'Test response',
                  action: 'none'
                })
              }
            }]
          }
        }]
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockChatCompletions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo'
        })
      )
    })

    it('should force function tool_choice', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  domChanges: [],
                  response: 'Test response',
                  action: 'none'
                })
              }
            }]
          }
        }]
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockChatCompletions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_choice: { type: 'function', function: { name: 'dom_changes_generator' } }
        })
      )
    })

    it('should return result from tool_calls response', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      const mockDomChanges = [
        { selector: '.button', type: 'style', value: { color: 'blue' } }
      ]

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  domChanges: mockDomChanges,
                  response: 'Changed button color to blue',
                  action: 'append'
                })
              }
            }]
          }
        }]
      })

      const result = await provider.generate('<html></html>', 'Change button color', [], undefined, {})

      expect(result.domChanges).toEqual(mockDomChanges)
      expect(result.response).toBe('Changed button color to blue')
      expect(result.action).toBe('append')
      expect(result.session).toBeDefined()
    })

    it('should create new session when not provided', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  domChanges: [],
                  response: 'Test response',
                  action: 'none'
                })
              }
            }]
          }
        }]
      })

      const result = await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(result.session).toBeDefined()
      expect(result.session.id).toBeDefined()
      expect(result.session.htmlSent).toBe(true)
    })

    it('should preserve existing session messages', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  domChanges: [],
                  response: 'Second response',
                  action: 'none'
                })
              }
            }]
          }
        }]
      })

      const existingSession = {
        id: 'session-123',
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
    })

    it('should throw error when no message in response', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: []
      })

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('No message in OpenAI response')
    })

    it('should throw error when no tool_calls in response', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Plain text response without tool calls'
          }
        }]
      })

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('OpenAI did not return a tool call')
    })

    it('should log warning about image support not yet implemented', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  domChanges: [],
                  response: 'Test response',
                  action: 'none'
                })
              }
            }]
          }
        }]
      })

      const images = ['data:image/png;base64,abc123']

      await provider.generate('<html></html>', 'test prompt', [], images, {})

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Image support not yet implemented')
      )
    })

    it('should include current changes in user message', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  domChanges: [],
                  response: 'Test response',
                  action: 'none'
                })
              }
            }]
          }
        }]
      })

      const currentChanges = [
        { selector: '.existing', type: 'text' as const, value: 'Old text' }
      ]

      await provider.generate('<html></html>', 'Add more', currentChanges, undefined, {})

      expect(utils.buildUserMessage).toHaveBeenCalledWith('Add more', currentChanges)
    })

    it('should throw error for invalid tool_call response', async () => {
      const provider = new OpenAIProvider({ apiKey: 'sk-openai-test-key', aiProvider: 'openai-api' })

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            tool_calls: [{
              type: 'function',
              function: {
                name: 'dom_changes_generator',
                arguments: JSON.stringify({
                  response: 'Missing domChanges and action'
                })
              }
            }]
          }
        }]
      })

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('Tool call validation failed')
    })
  })
})
