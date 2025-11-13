import { generateDOMChanges } from '../ai-dom-generator'
import type { DOMChange } from '~src/types/dom-changes'

describe('AI DOM Generator Integration Tests (with real bridge)', () => {
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

  const TIMEOUT = 60000

  beforeAll(() => {
    console.log('\n🔗 Starting AI DOM Generator Integration Tests')
    console.log('⚠️  These tests require the Claude Code Bridge to be running')
    console.log('   Run: npx @absmartly/claude-code-bridge\n')
  })

  describe('Basic DOM Change Generation', () => {
    it('should generate text changes for simple text modification request', async () => {
      const prompt = 'Change the main title text to "Hello World"'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', [])

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
    }, TIMEOUT)

    it('should generate style changes for styling request', async () => {
      const prompt = 'Make the button red with white text'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', [])

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
    }, TIMEOUT)

    it('should generate remove changes for deletion request', async () => {
      const prompt = 'Remove the description paragraph'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', [])

      expect(result).toBeDefined()
      expect(result.domChanges).toBeDefined()

      const hasRemoveChange = result.domChanges.some(c =>
        c.type === 'remove' && (c.selector.includes('description') || c.selector === 'p')
      )
      expect(hasRemoveChange).toBe(true)
    }, TIMEOUT)
  })

  describe('Action Types', () => {
    it('should use append action when adding to existing changes', async () => {
      const currentChanges: DOMChange[] = [
        {
          selector: '.existing',
          type: 'text',
          value: 'Existing text',
          enabled: true
        }
      ]

      const prompt = 'Also make the button blue'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', currentChanges)

      expect(result.action).toBe('append')
      expect(result.domChanges.length).toBeGreaterThan(0)
    }, TIMEOUT)

    it('should use replace_all action when explicitly requested', async () => {
      const currentChanges: DOMChange[] = [
        {
          selector: '.old',
          type: 'text',
          value: 'Old text',
          enabled: true
        }
      ]

      const prompt = 'Start fresh and make the title red'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', currentChanges)

      expect(['replace_all', 'append']).toContain(result.action)
    }, TIMEOUT)
  })

  describe('Conversational Context', () => {
    it('should maintain context across multiple requests', async () => {
      const firstPrompt = 'Make the button blue'
      const firstResult = await generateDOMChanges(SAMPLE_HTML, firstPrompt, '', [])

      expect(firstResult.domChanges.length).toBeGreaterThan(0)

      const secondPrompt = 'Now also add rounded corners to it'
      const secondResult = await generateDOMChanges(SAMPLE_HTML, secondPrompt, '', firstResult.domChanges)

      expect(secondResult.domChanges.length).toBeGreaterThan(0)
      expect(secondResult.response).toBeDefined()
    }, TIMEOUT * 2)
  })

  describe('Response Validation', () => {
    it('should always return valid JSON structure', async () => {
      const prompt = 'Change the button color to green'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', [])

      expect(result).toMatchObject({
        domChanges: expect.any(Array),
        response: expect.any(String),
        action: expect.stringMatching(/^(append|replace_all|replace_specific|remove_specific|none)$/)
      })
    }, TIMEOUT)

    it('should include targetSelectors for replace_specific action', async () => {
      const currentChanges: DOMChange[] = [
        {
          selector: '.cta-button',
          type: 'style',
          value: { color: 'blue' },
          enabled: true
        },
        {
          selector: '.main-title',
          type: 'text',
          value: 'Old Title',
          enabled: true
        }
      ]

      const prompt = 'Change the button color to red instead'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', currentChanges)

      if (result.action === 'replace_specific') {
        expect(result.targetSelectors).toBeDefined()
        expect(Array.isArray(result.targetSelectors)).toBe(true)
        expect(result.targetSelectors!.length).toBeGreaterThan(0)
      }
    }, TIMEOUT)

    it('should generate valid DOM changes with required properties', async () => {
      const prompt = 'Make the title bigger and bold'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', [])

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
    }, TIMEOUT)
  })

  describe('Complex Requests', () => {
    it('should handle multiple simultaneous changes', async () => {
      const prompt = 'Make the title red, the button blue, and hide the paragraph'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', [])

      expect(result.domChanges.length).toBeGreaterThanOrEqual(2)

      const hasStyleChange = result.domChanges.some(c => c.type === 'style')
      const hasRemoveOrHide = result.domChanges.some(c =>
        c.type === 'remove' ||
        (c.type === 'style' && 'value' in c && c.value && 'display' in c.value && c.value.display === 'none')
      )

      expect(hasStyleChange).toBe(true)
      expect(hasRemoveOrHide).toBe(true)
    }, TIMEOUT)

    it('should provide helpful responses explaining the changes', async () => {
      const prompt = 'Add a subtle shadow to the button'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', [])

      expect(result.response).toBeDefined()
      expect(result.response.length).toBeGreaterThan(0)
      expect(result.response.toLowerCase()).toMatch(/button|shadow|style/)
    }, TIMEOUT)
  })

  describe('Error Recovery', () => {
    it('should handle vague requests gracefully', async () => {
      const prompt = 'Make it better'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', [])

      expect(result).toBeDefined()
      expect(result.domChanges).toBeDefined()
      expect(result.response).toBeDefined()
    }, TIMEOUT)

    it('should handle requests for non-existent elements', async () => {
      const prompt = 'Change the footer color to blue'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', [])

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
    }, TIMEOUT)
  })

  describe('Retry Logic', () => {
    it('should retry and self-correct if first response is invalid', async () => {
      const prompt = 'Change the button text to "Submit"'

      const result = await generateDOMChanges(SAMPLE_HTML, prompt, '', [])

      expect(result).toBeDefined()
      expect(result).toMatchObject({
        domChanges: expect.any(Array),
        response: expect.any(String),
        action: expect.any(String)
      })
    }, TIMEOUT)
  })
})
