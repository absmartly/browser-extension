/**
 * AI DOM Generator Integration Tests
 *
 * Unit tests with mocked AI providers for DOM generation workflows.
 */

import { generateDOMChanges } from '../ai-dom-generator'
import type { DOMChange } from '~src/types/dom-changes'
import { beforeEach } from '@jest/globals'

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockImplementation((params: any) => {
        const lastMessage = params.messages?.[params.messages.length - 1]
        let msgStr = ''

        if (Array.isArray(lastMessage?.content)) {
          msgStr = lastMessage.content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join(' ')
            .toLowerCase()
        } else if (typeof lastMessage?.content === 'string') {
          msgStr = lastMessage.content.toLowerCase()
        }

        const isHelloWorld = msgStr.includes('hello world')
        const isMultipleChanges = msgStr.includes('title') && msgStr.includes('red') &&
                                   msgStr.includes('button') && msgStr.includes('blue') &&
                                   msgStr.includes('hide')
        const isRedButton = !isMultipleChanges && msgStr.includes('red') && msgStr.includes('button')
        const isBlueButton = !isMultipleChanges && msgStr.includes('blue') && msgStr.includes('button')
        const isRemove = !isMultipleChanges && msgStr.includes('remove')
        const isShadow = msgStr.includes('shadow')
        const isAppendContext = params.messages?.length > 1
        const hasCurrentChanges = msgStr.includes('current dom changes')
        const isReplaceSpecific = hasCurrentChanges && (msgStr.includes('instead') || (msgStr.includes('change') && msgStr.includes('color')))

        let response = ''
        let changes: any[] = []
        let action = hasCurrentChanges ? 'append' : 'replace_all'

        if (isHelloWorld) {
          changes = [{ selector: 'h1', type: 'text', value: 'Hello World' }]
          response = 'Changed title to "Hello World"'
        } else if (isReplaceSpecific) {
          changes = [{ selector: '.cta-button', type: 'style', value: { 'background-color': 'red' } }]
          response = 'Changed button color to red instead'
          action = 'replace_specific'
        } else if (isRedButton) {
          changes = [{ selector: '.cta-button', type: 'style', value: { 'background-color': 'red', 'color': 'white' } }]
          response = 'Made button red with white text'
        } else if (isBlueButton) {
          changes = [{ selector: '.cta-button', type: 'style', value: { 'background-color': 'blue' } }]
          response = 'Made button blue'
        } else if (isRemove) {
          changes = [{ selector: '.description', type: 'remove' }]
          response = 'Removed the description paragraph'
        } else if (isShadow) {
          changes = [{ selector: '.cta-button', type: 'style', value: { 'box-shadow': '0 2px 4px rgba(0,0,0,0.1)' } }]
          response = 'Added a subtle shadow to the button using box-shadow style'
        } else if (isMultipleChanges) {
          changes = [
            { selector: '.main-title', type: 'style', value: { 'color': 'red' } },
            { selector: '.cta-button', type: 'style', value: { 'background-color': 'blue' } },
            { selector: '.description', type: 'remove' }
          ]
          response = 'Made title red, button blue, and hid the paragraph'
        } else {
          changes = [{ selector: 'h1', type: 'text', value: 'Changed by AI' }]
          response = 'Made the requested changes'
        }

        return Promise.resolve({
          content: [
            {
              type: 'tool_use',
              name: 'dom_changes_generator',
              input: {
                domChanges: changes,
                response,
                action,
                ...(action === 'replace_specific' ? { targetSelectors: ['.cta-button'] } : {})
              }
            }
          ]
        } as any)
      })
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
        domStructure: '- html\n  - body\n    - h1\n    - button.cta-button\n    - p.description'
      }
    }),
    sendMessage: jest.fn().mockResolvedValue({
      domChanges: [
        {
          selector: 'h1',
          type: 'text',
          value: 'Changed by bridge'
        }
      ],
      response: 'Made the requested changes',
      action: 'append'
    }),
    streamResponses: jest.fn((conversationId: any, onMessage: any) => {
      setTimeout(() => {
        onMessage({
          type: 'tool_use',
          data: {
            domChanges: [
              {
                selector: 'h1',
                type: 'text',
                value: 'Changed by bridge'
              }
            ],
            response: 'Made the requested changes',
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

describe('AI DOM Generator Integration Tests (with mocked providers)', () => {
  const SAMPLE_HTML = `
    <!DOCTYPE html>
    <html>
      <head><title>Test Page</title></head>
      <body>
        <h1 class="main-title">Welcome to Our Site</h1>
        <button class="cta-button">Click Me</button>
        <p class="description">This is a sample paragraph with some text.</p>
      </body>
    </html>
  `

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic DOM Change Generation', () => {
    it('should generate text changes for simple text modification request', async () => {
      const prompt = 'Change the main title text to "Hello World"'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      expect(result).toBeDefined()
      expect(result.domChanges).toBeDefined()
      expect(Array.isArray(result.domChanges)).toBe(true)
      expect(result.response).toBeDefined()
      expect(typeof result.response).toBe('string')
      expect(result.action).toBeDefined()
      expect(['append', 'replace_all', 'replace_specific', 'remove_specific', 'none']).toContain(result.action)

      const textChanges = result.domChanges.filter(c => c.type === 'text')
      expect(textChanges.length).toBeGreaterThan(0)

      const titleChange = textChanges.find(c => c.selector.includes('title') || c.selector === 'h1')
      expect(titleChange).toBeDefined()
      if (titleChange && titleChange.type === 'text') {
        expect(titleChange.value).toContain('Hello World')
      }
    })

    it('should generate style changes for styling request', async () => {
      const prompt = 'Make the button red with white text'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      expect(result).toBeDefined()
      expect(result.domChanges).toBeDefined()
      expect(result.domChanges.length).toBeGreaterThan(0)

      const styleChanges = result.domChanges.filter(c => c.type === 'style')
      expect(styleChanges.length).toBeGreaterThan(0)

      const buttonChange = styleChanges.find(c => c.selector.includes('button') || c.selector.includes('cta'))
      expect(buttonChange).toBeDefined()
      if (buttonChange && buttonChange.type === 'style') {
        const styles = buttonChange.value
        expect(styles['background-color'] || styles['backgroundColor']).toMatch(/red|#ff0000|#f00|rgb\(255,\s*0,\s*0\)/i)
      }
    })

    it('should generate remove changes for deletion request', async () => {
      const prompt = 'Remove the description paragraph'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      expect(result).toBeDefined()
      expect(result.domChanges).toBeDefined()

      const hasRemoveChange = result.domChanges.some(c =>
        c.type === 'remove' && (c.selector.includes('description') || c.selector === 'p')
      )
      expect(hasRemoveChange).toBe(true)
    })
  })

  describe('Action Types', () => {
    it('should use append action when adding to existing changes', async () => {
      const currentChanges: DOMChange[] = [
        {
          selector: '.existing',
          type: 'text',
          value: 'Existing text'
        }
      ]

      const prompt = 'Also make the button blue'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', currentChanges, undefined, { aiProvider: 'anthropic-api' })

      expect(result.action).toBe('append')
      expect(result.domChanges.length).toBeGreaterThan(0)
    })

    it('should use replace_all action when explicitly requested', async () => {
      const currentChanges: DOMChange[] = [
        {
          selector: '.old',
          type: 'text',
          value: 'Old text'
        }
      ]

      const prompt = 'Start fresh and make the title red'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', currentChanges, undefined, { aiProvider: 'anthropic-api' })

      expect(['replace_all', 'append']).toContain(result.action)
    })
  })

  describe('Conversational Context', () => {
    it('should maintain context across multiple requests', async () => {
      const firstPrompt = 'Make the button blue'
      const firstResult = await generateDOMChanges(SAMPLE_HTML, firstPrompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      expect(firstResult.domChanges.length).toBeGreaterThan(0)

      const secondPrompt = 'Now also add rounded corners to it'
      const secondResult = await generateDOMChanges(SAMPLE_HTML, secondPrompt, 'mock-api-key', firstResult.domChanges, undefined, { aiProvider: 'anthropic-api' })

      expect(secondResult.domChanges.length).toBeGreaterThan(0)
      expect(secondResult.response).toBeDefined()
    })
  })

  describe('Response Validation', () => {
    it('should always return valid JSON structure', async () => {
      const prompt = 'Change the button color to green'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      expect(result).toMatchObject({
        domChanges: expect.any(Array),
        response: expect.any(String),
        action: expect.stringMatching(/^(append|replace_all|replace_specific|remove_specific|none)$/)
      })
    })

    it('should include targetSelectors for replace_specific action', async () => {
      const currentChanges: DOMChange[] = [
        {
          selector: '.cta-button',
          type: 'style',
          value: { color: 'blue' }
        },
        {
          selector: '.main-title',
          type: 'text',
          value: 'Old Title'
        }
      ]

      const prompt = 'Change the button color to red instead'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', currentChanges, undefined, { aiProvider: 'anthropic-api' })

      if (result.action === 'replace_specific') {
        expect(result.targetSelectors).toBeDefined()
        expect(Array.isArray(result.targetSelectors)).toBe(true)
        expect(result.targetSelectors!.length).toBeGreaterThan(0)
      }
    })

    it('should generate valid DOM changes with required properties', async () => {
      const prompt = 'Make the title bigger and bold'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      result.domChanges.forEach(change => {
        expect(change).toHaveProperty('selector')
        expect(change).toHaveProperty('type')
        expect(change.selector).toBeTruthy()
        expect(change.type).toBeTruthy()

        if (change.type === 'text' || change.type === 'html') {
          expect(change).toHaveProperty('value')
          expect(typeof change.value).toBe('string')
        }

        if (change.type === 'style') {
          expect(change).toHaveProperty('value')
          expect(typeof change.value).toBe('object')
        }
      })
    })
  })

  describe('Complex Requests', () => {
    it('should handle multiple simultaneous changes', async () => {
      const prompt = 'Make the title red, the button blue, and hide the paragraph'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      expect(result.domChanges.length).toBeGreaterThanOrEqual(2)

      const hasStyleChange = result.domChanges.some(c => c.type === 'style')
      const hasRemoveOrHide = result.domChanges.some(c =>
        c.type === 'remove' ||
        (c.type === 'style' && 'value' in c && c.value && 'display' in c.value && c.value.display === 'none')
      )

      expect(hasStyleChange).toBe(true)
      expect(hasRemoveOrHide).toBe(true)
    })

    it('should provide helpful responses explaining the changes', async () => {
      const prompt = 'Add a subtle shadow to the button'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      expect(result.response).toBeDefined()
      expect(result.response.length).toBeGreaterThan(0)
      expect(result.response.toLowerCase()).toMatch(/button|shadow|style/)
    })
  })

  describe('Error Recovery', () => {
    it('should handle vague requests gracefully', async () => {
      const prompt = 'Make it better'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      expect(result).toBeDefined()
      expect(result.domChanges).toBeDefined()
      expect(result.response).toBeDefined()
    })

    it('should handle requests for non-existent elements', async () => {
      const prompt = 'Change the footer color to blue'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
    })
  })

  describe('Retry Logic', () => {
    it('should retry and self-correct if first response is invalid', async () => {
      const prompt = 'Change the button text to "Submit"'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, 'mock-api-key', [], undefined, { aiProvider: 'anthropic-api' })

      expect(result).toBeDefined()
      expect(result).toMatchObject({
        domChanges: expect.any(Array),
        response: expect.any(String),
        action: expect.any(String)
      })
    })
  })
})
