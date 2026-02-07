import { generateDOMChanges } from '../ai-dom-generator'
import { createAIProvider } from '~src/lib/ai-providers'
import { jest } from '@jest/globals'
import type { AIProvider } from '~src/lib/ai-providers/base'
import type { AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'

jest.mock('~src/lib/ai-providers', () => ({
  createAIProvider: jest.fn(),
  compressHtml: jest.fn((html: string) => html),
  sanitizeHtml: jest.fn((html: string) => html)
}))

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

const mockFn = jest.fn as any

describe('AI DOM Generator', () => {
  const mockApiKey = 'test-api-key-123'
  const mockHtml = '<html><body><p id="test">Test content</p></body></html>'
  const mockPrompt = 'Change the text to "Hello"'

  let mockProvider: jest.Mocked<AIProvider>

  beforeEach(() => {
    jest.clearAllMocks()

    mockProvider = {
      generate: mockFn()
    } as any

    jest.mocked(createAIProvider).mockReturnValue(mockProvider)
  })

  describe('generateDOMChanges', () => {
    it('should generate DOM changes using provider factory', async () => {
      const mockResult: AIDOMGenerationResult & { session: ConversationSession } = {
        domChanges: [
          {
            selector: '#test',
            type: 'text',
            value: 'Hello'
          }
        ],
        response: 'Changed the text',
        action: 'append',
        session: {
          id: 'test-session',
          htmlSent: true,
          messages: []
        }
      }

      mockProvider.generate.mockResolvedValue(mockResult)

      const result = await generateDOMChanges(mockHtml, mockPrompt, mockApiKey)

      expect(result).toEqual(mockResult)
      expect(createAIProvider).toHaveBeenCalledWith({
        apiKey: mockApiKey,
        aiProvider: 'claude-subscription',
        useOAuth: undefined,
        oauthToken: undefined
      })
      expect(mockProvider.generate).toHaveBeenCalledWith(
        mockHtml,
        mockPrompt,
        [],
        undefined,
        { conversationSession: undefined }
      )
    })

    it('should use OAuth token when provided', async () => {
      const mockOAuthToken = 'oauth-token-xyz'
      const mockResult: AIDOMGenerationResult & { session: ConversationSession } = {
        domChanges: [],
        response: 'Done',
        action: 'none',
        session: {
          id: 'test-session',
          htmlSent: true,
          messages: []
        }
      }

      mockProvider.generate.mockResolvedValue(mockResult)

      await generateDOMChanges(mockHtml, mockPrompt, '', [], undefined, {
        useOAuth: true,
        oauthToken: mockOAuthToken
      })

      expect(createAIProvider).toHaveBeenCalledWith({
        aiProvider: 'claude-subscription',
        useOAuth: true,
        oauthToken: mockOAuthToken,
        llmModel: undefined
      })
    })

    it('should use specified AI provider', async () => {
      const mockResult: AIDOMGenerationResult & { session: ConversationSession } = {
        domChanges: [],
        response: 'Done',
        action: 'none',
        session: {
          id: 'test-session',
          htmlSent: true,
          messages: []
        }
      }

      mockProvider.generate.mockResolvedValue(mockResult)

      await generateDOMChanges(mockHtml, mockPrompt, mockApiKey, [], undefined, {
        aiProvider: 'openai-api'
      })

      expect(createAIProvider).toHaveBeenCalledWith({
        apiKey: mockApiKey,
        aiProvider: 'openai-api',
        useOAuth: undefined,
        oauthToken: undefined
      })
    })

    it('should throw error when HTML is required but not provided', async () => {
      await expect(
        generateDOMChanges('', mockPrompt, mockApiKey)
      ).rejects.toThrow('HTML is required for the first message in a conversation')
    })

    it('should allow empty HTML when session has htmlSent=true', async () => {
      const mockSession: ConversationSession = {
        id: 'existing-session',
        htmlSent: true,
        messages: []
      }

      const mockResult: AIDOMGenerationResult & { session: ConversationSession } = {
        domChanges: [],
        response: 'Done',
        action: 'none',
        session: mockSession
      }

      mockProvider.generate.mockResolvedValue(mockResult)

      await generateDOMChanges('', mockPrompt, mockApiKey, [], undefined, {
        conversationSession: mockSession
      })

      expect(mockProvider.generate).toHaveBeenCalledWith(
        '',
        mockPrompt,
        [],
        undefined,
        { conversationSession: mockSession }
      )
    })

    it('should pass currentChanges and images to provider', async () => {
      const mockCurrentChanges = [
        { selector: '.test', type: 'text' as const, value: 'Test' }
      ]
      const mockImages = ['data:image/png;base64,abc123']

      const mockResult: AIDOMGenerationResult & { session: ConversationSession } = {
        domChanges: [],
        response: 'Done',
        action: 'append',
        session: {
          id: 'test-session',
          htmlSent: true,
          messages: []
        }
      }

      mockProvider.generate.mockResolvedValue(mockResult)

      await generateDOMChanges(
        mockHtml,
        mockPrompt,
        mockApiKey,
        mockCurrentChanges,
        mockImages
      )

      expect(mockProvider.generate).toHaveBeenCalledWith(
        mockHtml,
        mockPrompt,
        mockCurrentChanges,
        mockImages,
        { conversationSession: undefined }
      )
    })

    it('should handle provider errors', async () => {
      const mockError = new Error('Provider error: Rate limit exceeded')
      mockProvider.generate.mockRejectedValue(mockError)

      await expect(
        generateDOMChanges(mockHtml, mockPrompt, mockApiKey)
      ).rejects.toThrow('Provider error: Rate limit exceeded')
    })

    it('should handle multiple DOM changes', async () => {
      const mockResult: AIDOMGenerationResult & { session: ConversationSession } = {
        domChanges: [
          {
            selector: '#title',
            type: 'text',
            value: 'New Title'
          },
          {
            selector: '.button',
            type: 'style',
            value: { backgroundColor: '#ff0000' }
          },
          {
            selector: '.hidden',
            type: 'class',
            add: ['hidden']
          }
        ],
        response: 'Applied multiple changes',
        action: 'append',
        session: {
          id: 'test-session',
          htmlSent: true,
          messages: []
        }
      }

      mockProvider.generate.mockResolvedValue(mockResult)

      const result = await generateDOMChanges(mockHtml, mockPrompt, mockApiKey)

      expect(result.domChanges).toHaveLength(3)
      expect(result.domChanges[0].selector).toBe('#title')
      expect(result.domChanges[1].selector).toBe('.button')
      expect(result.domChanges[2].selector).toBe('.hidden')
    })
  })
})
