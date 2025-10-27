import { generateDOMChanges } from '../ai-dom-generator'
import Anthropic from '@anthropic-ai/sdk'
import { jest } from '@jest/globals'

jest.mock('@anthropic-ai/sdk')
jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

describe('AI DOM Generator', () => {
  const mockApiKey = 'test-api-key-123'
  const mockHtml = '<html><body><p id="test">Test content</p></body></html>'
  const mockPrompt = 'Change the text to "Hello"'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateDOMChanges', () => {
    it('should generate DOM changes from Claude API response', async () => {
      const mockChanges = [
        {
          selector: '#test',
          type: 'text',
          value: 'Hello',
          enabled: true
        }
      ]

      const mockMessage = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockChanges)
          }
        ]
      }

      const mockCreate = jest.fn().mockResolvedValue(mockMessage)
      jest.mocked(Anthropic).mockImplementation(() => ({
        messages: {
          create: mockCreate
        }
      } as any))

      const result = await generateDOMChanges(mockHtml, mockPrompt, mockApiKey)

      expect(result).toEqual(mockChanges)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(mockPrompt)
            })
          ])
        })
      )
    })

    it('should handle markdown code block formatting in response', async () => {
      const mockChanges = [
        {
          selector: '.button',
          type: 'style',
          value: { color: 'red' },
          enabled: true
        }
      ]

      const mockMessage = {
        content: [
          {
            type: 'text',
            text: '```json\n' + JSON.stringify(mockChanges) + '\n```'
          }
        ]
      }

      const mockCreate = jest.fn().mockResolvedValue(mockMessage)
      jest.mocked(Anthropic).mockImplementation(() => ({
        messages: {
          create: mockCreate
        }
      } as any))

      const result = await generateDOMChanges(mockHtml, mockPrompt, mockApiKey)

      expect(result).toEqual(mockChanges)
    })

    it('should throw error when API key is missing', async () => {
      await expect(generateDOMChanges(mockHtml, mockPrompt, '')).rejects.toThrow(
        'Anthropic API key is required'
      )
    })

    it('should throw error when API key is null', async () => {
      await expect(generateDOMChanges(mockHtml, mockPrompt, null as any)).rejects.toThrow(
        'Anthropic API key is required'
      )
    })

    it('should handle non-text response type', async () => {
      const mockMessage = {
        content: [
          {
            type: 'image',
            text: 'some image'
          }
        ]
      }

      const mockCreate = jest.fn().mockResolvedValue(mockMessage)
      jest.mocked(Anthropic).mockImplementation(() => ({
        messages: {
          create: mockCreate
        }
      } as any))

      await expect(generateDOMChanges(mockHtml, mockPrompt, mockApiKey)).rejects.toThrow(
        'Unexpected response type from Claude'
      )
    })

    it('should throw error when response is not an array', async () => {
      const mockMessage = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ selector: '#test', type: 'text' })
          }
        ]
      }

      const mockCreate = jest.fn().mockResolvedValue(mockMessage)
      jest.mocked(Anthropic).mockImplementation(() => ({
        messages: {
          create: mockCreate
        }
      } as any))

      await expect(generateDOMChanges(mockHtml, mockPrompt, mockApiKey)).rejects.toThrow(
        'AI response is not an array'
      )
    })

    it('should handle JSON parsing errors', async () => {
      const mockMessage = {
        content: [
          {
            type: 'text',
            text: 'Invalid JSON {'
          }
        ]
      }

      const mockCreate = jest.fn().mockResolvedValue(mockMessage)
      jest.mocked(Anthropic).mockImplementation(() => ({
        messages: {
          create: mockCreate
        }
      } as any))

      await expect(generateDOMChanges(mockHtml, mockPrompt, mockApiKey)).rejects.toThrow()
    })

    it('should generate multiple DOM changes', async () => {
      const mockChanges = [
        {
          selector: '#title',
          type: 'text',
          value: 'New Title',
          enabled: true
        },
        {
          selector: '.button',
          type: 'style',
          value: { backgroundColor: '#ff0000' },
          enabled: true
        },
        {
          selector: '.hidden',
          type: 'class',
          add: ['hidden'],
          enabled: true
        }
      ]

      const mockMessage = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockChanges)
          }
        ]
      }

      const mockCreate = jest.fn().mockResolvedValue(mockMessage)
      jest.mocked(Anthropic).mockImplementation(() => ({
        messages: {
          create: mockCreate
        }
      } as any))

      const result = await generateDOMChanges(mockHtml, mockPrompt, mockApiKey)

      expect(result).toHaveLength(3)
      expect(result).toEqual(mockChanges)
    })

    it('should handle API errors from Claude', async () => {
      const mockError = new Error('API Error: Rate limit exceeded')

      const mockCreate = jest.fn().mockRejectedValue(mockError)
      jest.mocked(Anthropic).mockImplementation(() => ({
        messages: {
          create: mockCreate
        }
      } as any))

      await expect(generateDOMChanges(mockHtml, mockPrompt, mockApiKey)).rejects.toThrow(
        'API Error: Rate limit exceeded'
      )
    })

    it('should initialize Anthropic client with dangerouslyAllowBrowser flag', async () => {
      const mockChanges = []
      const mockMessage = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockChanges)
          }
        ]
      }

      const mockCreate = jest.fn().mockResolvedValue(mockMessage)
      jest.mocked(Anthropic).mockImplementation(() => ({
        messages: {
          create: mockCreate
        }
      } as any))

      await generateDOMChanges(mockHtml, mockPrompt, mockApiKey)

      expect(jest.mocked(Anthropic)).toHaveBeenCalledWith({
        apiKey: mockApiKey,
        dangerouslyAllowBrowser: true
      })
    })

    it('should handle empty HTML gracefully', async () => {
      const mockChanges = []

      const mockMessage = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockChanges)
          }
        ]
      }

      const mockCreate = jest.fn().mockResolvedValue(mockMessage)
      jest.mocked(Anthropic).mockImplementation(() => ({
        messages: {
          create: mockCreate
        }
      } as any))

      const result = await generateDOMChanges('', mockPrompt, mockApiKey)

      expect(result).toEqual([])
    })

    it('should handle empty prompt gracefully', async () => {
      const mockChanges = []

      const mockMessage = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockChanges)
          }
        ]
      }

      const mockCreate = jest.fn().mockResolvedValue(mockMessage)
      jest.mocked(Anthropic).mockImplementation(() => ({
        messages: {
          create: mockCreate
        }
      } as any))

      const result = await generateDOMChanges(mockHtml, '', mockApiKey)

      expect(result).toEqual([])
    })
  })
})
