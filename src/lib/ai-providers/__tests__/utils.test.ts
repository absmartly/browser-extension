import { sanitizeHtml, compressHtml, getSystemPrompt, buildUserMessage } from '../utils'
import type { DOMChange } from '~src/types/dom-changes'
import * as SystemPromptEditor from '~src/components/SystemPromptEditor'

jest.mock('~src/components/SystemPromptEditor')
jest.mock('~src/prompts/ai-dom-generation-system-prompt', () => ({
  AI_DOM_GENERATION_SYSTEM_PROMPT: 'Default system prompt for AI DOM generation'
}))

describe('AI Provider Utils', () => {
  describe('sanitizeHtml', () => {
    it('should preserve valid ASCII characters', () => {
      const input = 'Hello World 123'
      expect(sanitizeHtml(input)).toBe('Hello World 123')
    })

    it('should preserve valid Unicode characters', () => {
      const input = 'Hello 世界 🌍'
      expect(sanitizeHtml(input)).toBe('Hello 世界 🌍')
    })

    it('should preserve valid surrogate pairs', () => {
      const emoji = '😀'
      const result = sanitizeHtml(emoji)
      expect(result).toBe(emoji)
    })

    it('should remove unpaired high surrogate', () => {
      const invalidHigh = '\uD800'
      const result = sanitizeHtml(invalidHigh)
      expect(result).toBe('')
    })

    it('should remove unpaired low surrogate', () => {
      const invalidLow = '\uDC00'
      const result = sanitizeHtml(invalidLow)
      expect(result).toBe('')
    })

    it('should preserve high surrogate followed by valid low surrogate', () => {
      const validPair = '\uD83D\uDE00'
      const result = sanitizeHtml(validPair)
      expect(result).toBe(validPair)
    })

    it('should remove high surrogate not followed by low surrogate', () => {
      const invalidSequence = '\uD800A'
      const result = sanitizeHtml(invalidSequence)
      expect(result).toBe('A')
    })

    it('should remove NULL character (U+0000)', () => {
      const input = 'Hello\x00World'
      expect(sanitizeHtml(input)).toBe('HelloWorld')
    })

    it('should remove control characters (U+0001 to U+0008)', () => {
      const input = 'Hello\x01\x02\x03\x04\x05\x06\x07\x08World'
      expect(sanitizeHtml(input)).toBe('HelloWorld')
    })

    it('should preserve TAB (U+0009) and LF (U+000A)', () => {
      const input = 'Hello\t\nWorld'
      expect(sanitizeHtml(input)).toBe('Hello\t\nWorld')
    })

    it('should remove vertical tab (U+000B) and form feed (U+000C)', () => {
      const input = 'Hello\x0B\x0CWorld'
      expect(sanitizeHtml(input)).toBe('HelloWorld')
    })

    it('should preserve CR (U+000D)', () => {
      const input = 'Hello\rWorld'
      expect(sanitizeHtml(input)).toBe('Hello\rWorld')
    })

    it('should remove control characters (U+000E to U+001F)', () => {
      const input = 'Hello\x0E\x0F\x10\x1FWorld'
      expect(sanitizeHtml(input)).toBe('HelloWorld')
    })

    it('should remove replacement character (U+FFFD)', () => {
      const input = 'Hello\uFFFDWorld'
      expect(sanitizeHtml(input)).toBe('HelloWorld')
    })

    it('should handle empty string', () => {
      expect(sanitizeHtml('')).toBe('')
    })

    it('should handle complex HTML with mixed invalid characters', () => {
      const input = '<div\x00 class="test\uFFFD">\x01Text\x0B</div>'
      const result = sanitizeHtml(input)
      expect(result).toBe('<div class="test">Text</div>')
    })
  })

  describe('compressHtml', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation()
      jest.spyOn(console, 'error').mockImplementation()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should return empty string for undefined input', () => {
      expect(compressHtml(undefined as any)).toBe('')
      expect(console.error).toHaveBeenCalledWith('[Compress] ❌ HTML is undefined or empty!')
    })

    it('should return empty string for empty input', () => {
      expect(compressHtml('')).toBe('')
      expect(console.error).toHaveBeenCalledWith('[Compress] ❌ HTML is undefined or empty!')
    })

    it('should remove Plasmo loading div', () => {
      const html = '<div><div id="__plasmo-loading__"><div>Loading...</div></div><p>Content</p></div>'
      const result = compressHtml(html)
      expect(result).not.toContain('__plasmo-loading__')
      expect(result).toContain('Content')
    })

    it('should remove Plasmo elements by id', () => {
      const html = '<div id="__plasmo">Plasmo content</div><p>Real content</p>'
      const result = compressHtml(html)
      expect(result).not.toContain('__plasmo')
      expect(result).toContain('Real content')
    })

    it('should remove plasmo-csui elements', () => {
      const html = '<plasmo-csui>Extension UI</plasmo-csui><p>Page content</p>'
      const result = compressHtml(html)
      expect(result).not.toContain('plasmo-csui')
      expect(result).toContain('Page content')
    })

    it('should remove elements with data-plasmo attributes', () => {
      const html = '<div data-plasmo-something="true">Extension</div><p>Content</p>'
      const result = compressHtml(html)
      expect(result).not.toContain('data-plasmo')
      expect(result).toContain('Content')
    })

    it('should remove absmartly debug elements', () => {
      const html = '<div id="absmartly-debug-panel">Debug</div><p>Content</p>'
      const result = compressHtml(html)
      expect(result).not.toContain('absmartly-debug')
      expect(result).toContain('Content')
    })

    it('should remove absmartly sidebar iframe', () => {
      const html = '<iframe id="absmartly-sidebar-iframe">Sidebar</iframe><p>Content</p>'
      const result = compressHtml(html)
      expect(result).not.toContain('absmartly-sidebar-iframe')
      expect(result).toContain('Content')
    })

    it('should remove chrome-extension iframes', () => {
      const html = '<iframe src="chrome-extension://abc123">Extension</iframe><p>Content</p>'
      const result = compressHtml(html)
      expect(result).not.toContain('chrome-extension')
      expect(result).toContain('Content')
    })

    it('should remove absmartly preview header', () => {
      const html = '<div id="absmartly-preview-header-host">Header</div><p>Content</p>'
      const result = compressHtml(html)
      expect(result).not.toContain('absmartly-preview-header-host')
      expect(result).toContain('Content')
    })

    it('should remove data-absmartly-preview attributes', () => {
      const html = '<div data-absmartly-preview-mode="true" data-absmartly-preview-variant="A">Content</div>'
      const result = compressHtml(html)
      expect(result).not.toContain('data-absmartly-preview')
      expect(result).toContain('Content')
    })

    it('should remove data-absmartly-original attributes', () => {
      const html = '<div data-absmartly-original-text="old" data-absmartly-modified="true">Content</div>'
      const result = compressHtml(html)
      expect(result).not.toContain('data-absmartly-original')
      expect(result).not.toContain('data-absmartly-modified')
      expect(result).toContain('Content')
    })

    it('should remove Framer framework attributes', () => {
      const html = '<div data-framer-hydrate-v2="true" data-framer-appear-id="abc" data-framer-name="Component">Content</div>'
      const result = compressHtml(html)
      expect(result).not.toContain('data-framer-hydrate-v2')
      expect(result).not.toContain('data-framer-appear-id')
      expect(result).toContain('data-framer-name')
      expect(result).toContain('Content')
    })

    it('should preserve essential style tags in head', () => {
      const html = '<html><head><style>body { color: red; }</style></head><body>Content</body></html>'
      const result = compressHtml(html)
      expect(result).toContain('<style>body { color: red; }</style>')
      expect(result).toContain('Content')
    })

    it('should remove @font-face rules from styles', () => {
      const html = '<html><head><style>@font-face { font-family: "Test"; } body { color: red; }</style></head><body>Content</body></html>'
      const result = compressHtml(html)
      expect(result).not.toContain('@font-face')
      expect(result).toContain('body { color: red; }')
    })

    it('should remove @import rules from styles', () => {
      const html = '<html><head><style>@import url("test.css"); body { color: red; }</style></head><body>Content</body></html>'
      const result = compressHtml(html)
      expect(result).not.toContain('@import')
      expect(result).toContain('body { color: red; }')
    })

    it('should remove script tags', () => {
      const html = '<script>console.log("test")</script><p>Content</p>'
      const result = compressHtml(html)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('console.log')
      expect(result).toContain('Content')
    })

    it('should remove noscript tags', () => {
      const html = '<noscript>No JavaScript</noscript><p>Content</p>'
      const result = compressHtml(html)
      expect(result).not.toContain('<noscript>')
      expect(result).not.toContain('No JavaScript')
      expect(result).toContain('Content')
    })

    it('should remove HTML comments', () => {
      const html = '<!-- This is a comment --><p>Content</p>'
      const result = compressHtml(html)
      expect(result).not.toContain('<!--')
      expect(result).not.toContain('This is a comment')
      expect(result).toContain('Content')
    })

    it('should remove inline style attributes', () => {
      const html = '<div style="color: red; font-size: 16px;">Content</div>'
      const result = compressHtml(html)
      expect(result).not.toContain('style=')
      expect(result).toContain('Content')
    })

    it('should remove event handler attributes', () => {
      const html = '<button onclick="alert()" onmouseover="hover()">Click</button>'
      const result = compressHtml(html)
      expect(result).not.toContain('onclick')
      expect(result).not.toContain('onmouseover')
      expect(result).toContain('Click')
    })

    it('should collapse whitespace', () => {
      const html = '<div>   \n\n  Content   with    spaces   \n\n  </div>'
      const result = compressHtml(html)
      expect(result).toBe('<div>Content with spaces</div>')
    })

    it('should remove whitespace between tags', () => {
      const html = '<div>  \n  <p>  \n  Content  \n  </p>  \n  </div>'
      const result = compressHtml(html)
      expect(result).toBe('<div><p>Content</p></div>')
    })

    it('should handle complex real-world HTML', () => {
      const html = `
        <html>
          <head>
            <style>@font-face { font-family: "Test"; } body { color: red; }</style>
            <script>console.log("test")</script>
          </head>
          <body>
            <div id="__plasmo">Plasmo</div>
            <iframe id="absmartly-sidebar-iframe">Sidebar</iframe>
            <div data-framer-hydrate-v2="true">
              <p style="color: blue;" onclick="alert()">Content</p>
            </div>
            <!-- Comment -->
            <noscript>No JS</noscript>
          </body>
        </html>
      `
      const result = compressHtml(html)

      expect(result).not.toContain('__plasmo')
      expect(result).not.toContain('absmartly-sidebar-iframe')
      expect(result).not.toContain('data-framer-hydrate-v2')
      expect(result).not.toContain('@font-face')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('<!--')
      expect(result).not.toContain('<noscript>')
      expect(result).not.toContain('style=')
      expect(result).not.toContain('onclick')
      expect(result).toContain('body { color: red; }')
      expect(result).toContain('<p>Content</p>')
    })
  })

  describe('getSystemPrompt', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should return default system prompt when no override exists', async () => {
      jest.spyOn(SystemPromptEditor, 'getSystemPromptOverride').mockResolvedValue(null)

      const result = await getSystemPrompt()

      expect(result).toBe('Default system prompt for AI DOM generation')
      expect(SystemPromptEditor.getSystemPromptOverride).toHaveBeenCalledTimes(1)
    })

    it('should return override system prompt when one exists', async () => {
      const customPrompt = 'Custom AI system prompt for testing'
      jest.spyOn(SystemPromptEditor, 'getSystemPromptOverride').mockResolvedValue(customPrompt)

      const result = await getSystemPrompt()

      expect(result).toBe(customPrompt)
      expect(SystemPromptEditor.getSystemPromptOverride).toHaveBeenCalledTimes(1)
    })

    it('should return default when override is empty string', async () => {
      jest.spyOn(SystemPromptEditor, 'getSystemPromptOverride').mockResolvedValue('')

      const result = await getSystemPrompt()

      expect(result).toBe('Default system prompt for AI DOM generation')
    })

    it('should handle undefined override', async () => {
      jest.spyOn(SystemPromptEditor, 'getSystemPromptOverride').mockResolvedValue(undefined as any)

      const result = await getSystemPrompt()

      expect(result).toBe('Default system prompt for AI DOM generation')
    })
  })

  describe('buildUserMessage', () => {
    it('should build message with prompt only when no changes exist', () => {
      const prompt = 'Change the button color to red'
      const currentChanges: DOMChange[] = []

      const result = buildUserMessage(prompt, currentChanges)

      expect(result).toBe('User Request: Change the button color to red')
      expect(result).not.toContain('Current DOM Changes')
    })

    it('should include current changes when they exist', () => {
      const prompt = 'Add another change'
      const currentChanges: DOMChange[] = [
        {
          selector: '.button',
          type: 'style',
          value: { color: 'red' }
        }
      ]

      const result = buildUserMessage(prompt, currentChanges)

      expect(result).toContain('Current DOM Changes')
      expect(result).toContain('```json')
      expect(result).toContain('.button')
      expect(result).toContain('style')
      expect(result).toContain('User Request: Add another change')
    })

    it('should sanitize HTML in prompt', () => {
      const prompt = 'Change <div\x00>test\uFFFD</div>'
      const currentChanges: DOMChange[] = []

      const result = buildUserMessage(prompt, currentChanges)

      expect(result).toBe('User Request: Change <div>test</div>')
      expect(result).not.toContain('\x00')
      expect(result).not.toContain('\uFFFD')
    })

    it('should sanitize HTML in current changes JSON', () => {
      const prompt = 'Test'
      const currentChanges: DOMChange[] = [
        {
          selector: '.test\x00',
          type: 'text',
          value: 'Invalid\uFFFD'
        }
      ]

      const result = buildUserMessage(prompt, currentChanges)

      expect(result).toContain('.test')
      expect(result).toContain('Invalid')
      expect(result).not.toContain('\x00')
      expect(result).not.toContain('\uFFFD')
    })

    it('should format current changes as JSON with proper indentation', () => {
      const prompt = 'Test'
      const currentChanges: DOMChange[] = [
        {
          selector: '.button',
          type: 'style',
          value: { color: 'red', fontSize: '16px' }
        }
      ]

      const result = buildUserMessage(prompt, currentChanges)

      expect(result).toContain('```json')
      expect(result).toContain('{\n')
      expect(result).toContain('  "selector"')
      expect(result).toContain('```')
    })

    it('should handle multiple current changes', () => {
      const prompt = 'Add more'
      const currentChanges: DOMChange[] = [
        { selector: '.btn1', type: 'text', value: 'Click' },
        { selector: '.btn2', type: 'style', value: { color: 'blue' } },
        { selector: '.btn3', type: 'class', add: ['active'], remove: ['inactive'] }
      ]

      const result = buildUserMessage(prompt, currentChanges)

      expect(result).toContain('.btn1')
      expect(result).toContain('.btn2')
      expect(result).toContain('.btn3')
      expect(result).toContain('User Request: Add more')
    })

    it('should handle empty prompt', () => {
      const prompt = ''
      const currentChanges: DOMChange[] = []

      const result = buildUserMessage(prompt, currentChanges)

      expect(result).toBe('User Request: ')
    })

    it('should handle complex DOM change with all fields', () => {
      const prompt = 'Update'
      const currentChanges: DOMChange[] = [
        {
          selector: '.complex',
          type: 'create',
          element: '<div>New</div>',
          targetSelector: '.parent',
          position: 'before',
          waitForElement: true
        }
      ]

      const result = buildUserMessage(prompt, currentChanges)

      expect(result).toContain('create')
      expect(result).toContain('.complex')
      expect(result).toContain('.parent')
      expect(result).toContain('before')
      expect(result).toContain('true')
    })
  })
})
