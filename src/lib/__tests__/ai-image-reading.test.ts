/**
 * AI Image Reading Tests
 *
 * Unit tests with mocked AI providers for image reading capabilities.
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { generateDOMChanges } from '../ai-dom-generator'
import { TEST_IMAGES } from './test-images'

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            name: 'dom_changes_generator',
            input: {
              domChanges: [
                {
                  selector: 'h1',
                  type: 'text',
                  value: 'Mocked response based on image'
                }
              ],
              response: 'I see the text "HELLO" in the image.',
              action: 'append'
            }
          }
        ]
      } as any)
    }
  }))
}))

jest.mock('~src/lib/claude-code-client', () => ({
  ClaudeCodeBridgeClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined as any),
    disconnect: jest.fn(),
    getConnection: jest.fn().mockReturnValue({ url: 'http://localhost:3000', connected: true }),
    createConversation: jest.fn().mockResolvedValue({
      conversationId: 'mock-conversation-id',
      session: {
        conversationId: 'mock-conversation-id',
        htmlSent: true,
        pageUrl: 'https://example.com',
        domStructure: '- html\n  - body\n    - h1\n    - button#cta'
      }
    }),
    sendMessage: jest.fn().mockImplementation(async () => {
      return {
        domChanges: [
          {
            selector: 'button#cta',
            type: 'text',
            value: 'Submit'
          }
        ],
        response: 'I changed the button text to "Submit".',
        action: 'append'
      }
    }),
    streamResponses: jest.fn((conversationId: any, onMessage: any) => {
      setTimeout(() => {
        onMessage({
          type: 'tool_use',
          data: {
            domChanges: [
              {
                selector: 'button#cta',
                type: 'text',
                value: 'Submit'
              }
            ],
            response: 'I changed the button text to "Submit".',
            action: 'append'
          }
        })
        onMessage({ type: 'done' })
      }, 10)
      return { close: jest.fn() }
    }),
    close: jest.fn()
  }))
}))

describe('AI Image Reading', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Anthropic API Tests (with mocked responses)', () => {
    it('should read text from an image using Claude', async () => {
      const imageDataUrl = TEST_IMAGES.HELLO

      const html = '<html><body><h1>Test Page</h1></body></html>'

      const result = await generateDOMChanges(
        html,
        'What text do you see in the image I attached?',
        'mock-api-key',
        [],
        [imageDataUrl],
        { aiProvider: 'anthropic-api' }
      )

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      expect(typeof result.response).toBe('string')
      expect(result.response.length).toBeGreaterThan(0)

      const responseText = result.response.toLowerCase()
      const mentionsHello = responseText.includes('hello')

      expect(mentionsHello).toBe(true)
    })

    it('should handle multiple images with different text', async () => {
      const images = [
        TEST_IMAGES.HELLO,
        TEST_IMAGES.WORLD
      ]

      const html = '<html><body><h1>Test Page</h1></body></html>'

      const result = await generateDOMChanges(
        html,
        'I attached two images with words. What words do you see in each image?',
        'mock-api-key',
        [],
        images,
        { aiProvider: 'anthropic-api' }
      )

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      expect(typeof result.response).toBe('string')

      const responseText = result.response.toLowerCase()
      const mentionsHello = responseText.includes('hello')

      expect(mentionsHello).toBe(true)
    })

    it('should work without images (backward compatibility)', async () => {
      const html = '<html><body><h1>Test Page</h1><button id="cta">Click Me</button></body></html>'

      const result = await generateDOMChanges(
        html,
        'Change the button text to "Submit"',
        'mock-api-key',
        [],
        undefined,
        { aiProvider: 'anthropic-api' }
      )

      expect(result).toBeDefined()
      expect(result.domChanges || result.response).toBeDefined()

      const hasChanges = result.domChanges && result.domChanges.length > 0
      const hasResponse = result.response && result.response.length > 0

      expect(hasChanges || hasResponse).toBe(true)
    })

    it('should handle image with simple visual prompt', async () => {
      const blueSquareImageUrl = TEST_IMAGES.BLUE_SQUARE

      const html = '<html><body><h1>Test</h1></body></html>'

      const result = await generateDOMChanges(
        html,
        'What do you see in this image?',
        'mock-api-key',
        [],
        [blueSquareImageUrl],
        { aiProvider: 'anthropic-api' }
      )

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()

      const responseText = result.response.toLowerCase()
      const describesImage =
        responseText.includes('image')

      expect(describesImage).toBe(true)
    })
  })

  describe('Claude Code Bridge Tests (with mocked bridge)', () => {
    it('should generate DOM changes via bridge with text prompt', async () => {
      const html = '<html><body><h1>Test Page</h1><button id="cta">Click Me</button></body></html>'

      const result = await generateDOMChanges(
        html,
        'Change the button text to "Submit"',
        '',
        [],
        undefined,
        { aiProvider: 'claude-code-bridge' }
      )

      expect(result).toBeDefined()
      expect(result.domChanges || result.response).toBeDefined()

      const hasChanges = result.domChanges && result.domChanges.length > 0
      const hasResponse = result.response && result.response.length > 0

      expect(hasChanges || hasResponse).toBe(true)
    })

    it('should handle image with bridge', async () => {
      const imageDataUrl = TEST_IMAGES.BLUE_SQUARE

      const html = '<html><body><h1>Test</h1></body></html>'

      const result = await generateDOMChanges(
        html,
        'What do you see in this image?',
        '',
        [],
        [imageDataUrl],
        { aiProvider: 'claude-code-bridge' }
      )

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
    })
  })
})
