import { BridgeProvider } from '../bridge'
import { ClaudeCodeBridgeClient } from '~src/lib/claude-code-client'
import type { AIProviderConfig } from '../base'
import * as utils from '../utils'

jest.mock('~src/lib/claude-code-client')
jest.mock('../utils', () => ({
  sanitizeHtml: jest.fn((html) => html),
  getSystemPrompt: jest.fn(),
  buildUserMessage: jest.fn()
}))

const defaultConfig: AIProviderConfig = {
  apiKey: '',
  aiProvider: 'claude-subscription'
}

describe('BridgeProvider', () => {
  let mockBridgeClient: jest.Mocked<ClaudeCodeBridgeClient>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()

    mockBridgeClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      createConversation: jest.fn(),
      sendMessage: jest.fn(),
      streamResponses: jest.fn(),
      getConnection: jest.fn()
    } as any

    ;(ClaudeCodeBridgeClient as jest.MockedClass<typeof ClaudeCodeBridgeClient>)
      .mockImplementation(() => mockBridgeClient)

    jest.mocked(utils.getSystemPrompt).mockResolvedValue('System prompt for testing')
    jest.mocked(utils.buildUserMessage).mockReturnValue('User message: test prompt')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with ClaudeCodeBridgeClient', () => {
      const provider = new BridgeProvider(defaultConfig)

      expect(provider).toBeInstanceOf(BridgeProvider)
      expect(ClaudeCodeBridgeClient).toHaveBeenCalledTimes(1)
    })
  })

  describe('getToolDefinition', () => {
    it('should return shared schema', () => {
      const provider = new BridgeProvider(defaultConfig)
      const toolDef = provider.getToolDefinition()

      expect(toolDef).toBeDefined()
      expect(toolDef).toHaveProperty('type')
      expect(toolDef).toHaveProperty('properties')
    })

    it('should have domChanges, response, and action in schema', () => {
      const provider = new BridgeProvider(defaultConfig)
      const toolDef = provider.getToolDefinition()

      expect(toolDef.properties).toHaveProperty('domChanges')
      expect(toolDef.properties).toHaveProperty('response')
      expect(toolDef.properties).toHaveProperty('action')
    })
  })

  describe('generate', () => {
    it('should connect to bridge before generating', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'tool_use', data: { domChanges: [], response: 'Test', action: 'none' } })
        }, 10)
        return mockEventSource as any
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockBridgeClient.connect).toHaveBeenCalledTimes(1)
    })

    it('should create new conversation for new session', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'tool_use', data: { domChanges: [], response: 'Test', action: 'none' } })
        }, 10)
        return mockEventSource as any
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockBridgeClient.createConversation).toHaveBeenCalledWith(
        expect.any(String),
        '/',
        'allow',
        expect.any(Object)
      )
    })

    it('should reuse existing conversation when conversationId exists', async () => {
      const provider = new BridgeProvider(defaultConfig)

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'tool_use', data: { domChanges: [], response: 'Test', action: 'none' } })
        }, 10)
        return mockEventSource as any
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
            messages: [],
            conversationId: 'existing-conv-123'
          }
        }
      )

      expect(mockBridgeClient.createConversation).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Reusing existing conversation')
      )
    })

    it('should include HTML in system prompt for new conversation', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'tool_use', data: { domChanges: [], response: 'Test', action: 'none' } })
        }, 10)
        return mockEventSource as any
      })

      await provider.generate('<html><body>Test</body></html>', 'test prompt', [], undefined, {})

      expect(mockBridgeClient.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.stringContaining('<html><body>Test</body></html>'),
        expect.any(Object)
      )
    })

    it('should throw error when HTML is required but not provided', async () => {
      const provider = new BridgeProvider(defaultConfig)

      await expect(
        provider.generate('', 'test prompt', [], undefined, {})
      ).rejects.toThrow('HTML is required for creating new bridge conversation')
    })

    it('should send message with schema to conversation', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'tool_use', data: { domChanges: [], response: 'Test', action: 'none' } })
        }, 10)
        return mockEventSource as any
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockBridgeClient.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        'User message: test prompt',
        [],
        expect.any(String),
        expect.objectContaining({
          type: 'object',
          properties: expect.any(Object)
        })
      )
    })

    it('should handle tool_use event from stream', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockDomChanges = [
        { selector: '.button', type: 'style', value: { color: 'green' } }
      ]

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({
            type: 'tool_use',
            data: {
              domChanges: mockDomChanges,
              response: 'Changed button color to green',
              action: 'append'
            }
          })
        }, 10)
        return mockEventSource as any
      })

      const result = await provider.generate('<html></html>', 'Change button color', [], undefined, {})

      expect(result.domChanges).toEqual(mockDomChanges)
      expect(result.response).toBe('Changed button color to green')
      expect(result.action).toBe('append')
    })

    it('should accumulate text events and return as conversational response', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'text', data: 'This is ' })
          onEvent({ type: 'text', data: 'a message' })
          onEvent({ type: 'done', data: null })
        }, 10)
        return mockEventSource as any
      })

      const result = await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(result.domChanges).toEqual([])
      expect(result.response).toContain('This is a message')
      expect(result.action).toBe('none')
    })

    it('should handle error event from stream', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'error', data: 'Connection failed' })
        }, 10)
        return mockEventSource as any
      })

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('Claude error: Connection failed')
    })

    it('should timeout after 60 seconds', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        return mockEventSource as any
      })

      jest.useFakeTimers()

      const promise = provider.generate('<html></html>', 'test prompt', [], undefined, {})

      jest.advanceTimersByTime(60000)

      await expect(promise).rejects.toThrow('Bridge response timeout after 60s')

      jest.useRealTimers()
    })

    it('should disconnect after generate completes', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'tool_use', data: { domChanges: [], response: 'Test', action: 'none' } })
        }, 10)
        return mockEventSource as any
      })

      await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(mockBridgeClient.disconnect).toHaveBeenCalledTimes(1)
    })

    it('should disconnect even when generate fails', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.connect.mockRejectedValue(new Error('Connection failed'))

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('Claude Code Bridge error: Connection failed')

      expect(mockBridgeClient.disconnect).toHaveBeenCalledTimes(1)
    })

    it('should create session with conversationId', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'tool_use', data: { domChanges: [], response: 'Test', action: 'none' } })
        }, 10)
        return mockEventSource as any
      })

      const result = await provider.generate('<html></html>', 'test prompt', [], undefined, {})

      expect(result.session).toBeDefined()
      expect(result.session.conversationId).toBe('conv-123')
      expect(result.session.htmlSent).toBe(true)
    })

    it('should include images in sendMessage call', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'tool_use', data: { domChanges: [], response: 'Test', action: 'none' } })
        }, 10)
        return mockEventSource as any
      })

      const images = ['data:image/png;base64,abc123']

      await provider.generate('<html></html>', 'test prompt', [], images, {})

      expect(mockBridgeClient.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        images,
        expect.any(String),
        expect.any(Object)
      )
    })

    it('should throw error for invalid tool_use response', async () => {
      const provider = new BridgeProvider(defaultConfig)

      mockBridgeClient.createConversation.mockResolvedValue({
        conversationId: 'conv-123'
      })

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({
            type: 'tool_use',
            data: {
              response: 'Missing domChanges and action'
            }
          })
        }, 10)
        return mockEventSource as any
      })

      await expect(
        provider.generate('<html></html>', 'test prompt', [], undefined, {})
      ).rejects.toThrow('Tool use validation failed')
    })

    it('should preserve existing session messages', async () => {
      const provider = new BridgeProvider(defaultConfig)

      const mockEventSource = {
        close: jest.fn()
      }

      mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
        setTimeout(() => {
          onEvent({ type: 'tool_use', data: { domChanges: [], response: 'Second response', action: 'none' } })
        }, 10)
        return mockEventSource as any
      })

      const existingSession = {
        id: 'session-123',
        htmlSent: true,
        messages: [
          { role: 'user' as const, content: 'First message' },
          { role: 'assistant' as const, content: 'First response' }
        ],
        conversationId: 'existing-conv-123'
      }

      const result = await provider.generate('', 'Second message', [], undefined, {
        conversationSession: existingSession
      })

      expect(result.session.messages).toHaveLength(4)
      expect(result.session.messages[0].content).toBe('First message')
      expect(result.session.messages[3].content).toBe('Second response')
    })
  })
})
