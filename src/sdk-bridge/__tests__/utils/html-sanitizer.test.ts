/**
 * HTML Sanitizer Unit Tests
 */

import { sanitizeHTML } from '../../utils/html-sanitizer'

// Mock DOM environment
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
global.document = dom.window.document as any
global.Element = dom.window.Element as any

describe('sanitizeHTML', () => {
  describe('basic functionality', () => {
    it('should return empty string for null/undefined/empty input', () => {
      expect(sanitizeHTML('')).toBe('')
      expect(sanitizeHTML(null as any)).toBe('')
      expect(sanitizeHTML(undefined as any)).toBe('')
    })

    it('should preserve safe HTML', () => {
      const safeHTML = '<div class="test">Hello <strong>World</strong></div>'
      const result = sanitizeHTML(safeHTML)

      expect(result).toContain('<div')
      expect(result).toContain('class="test"')
      expect(result).toContain('<strong>')
      expect(result).toContain('Hello')
      expect(result).toContain('World')
    })

    it('should preserve safe elements', () => {
      const html = '<p>Text</p><span>More</span><a href="https://example.com">Link</a>'
      const result = sanitizeHTML(html)

      expect(result).toContain('<p>')
      expect(result).toContain('<span>')
      expect(result).toContain('<a')
      expect(result).toContain('href="https://example.com"')
    })
  })

  describe('dangerous tag removal', () => {
    it('should remove script tags', () => {
      const maliciousHTML = '<script>alert("XSS")</script><div>Safe</div>'
      const result = sanitizeHTML(maliciousHTML)

      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
      expect(result).toContain('<div>')
      expect(result).toContain('Safe')
    })

    it('should remove iframe tags', () => {
      const html = '<iframe src="evil.com"></iframe><p>Text</p>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('<iframe>')
      expect(result).not.toContain('evil.com')
      expect(result).toContain('<p>')
    })

    it('should remove object tags', () => {
      const html = '<object data="evil.swf"></object>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('<object>')
      expect(result).not.toContain('evil.swf')
    })

    it('should remove embed tags', () => {
      const html = '<embed src="evil.swf">'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('<embed>')
    })

    it('should remove link tags', () => {
      const html = '<link rel="stylesheet" href="evil.css">'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('<link>')
    })

    it('should remove style tags', () => {
      const html = '<style>body { background: red; }</style>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('<style>')
    })

    it('should remove meta tags', () => {
      const html = '<meta http-equiv="refresh" content="0;url=evil.com">'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('<meta>')
    })

    it('should remove base tags', () => {
      const html = '<base href="http://evil.com">'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('<base>')
    })
  })

  describe('event handler removal', () => {
    it('should remove onerror attributes', () => {
      const html = '<img src=x onerror=alert(document.cookie)>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('onerror')
      expect(result).not.toContain('alert')
      expect(result).toContain('<img')
    })

    it('should remove onclick attributes', () => {
      const html = '<div onclick="alert(1)">Click</div>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('onclick')
      expect(result).not.toContain('alert')
      expect(result).toContain('Click')
    })

    it('should remove onload attributes', () => {
      const html = '<body onload="alert(1)">Content</body>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('onload')
      expect(result).not.toContain('alert')
    })

    it('should remove all on* event handlers', () => {
      const handlers = [
        'onmouseover',
        'onfocus',
        'onblur',
        'onchange',
        'onsubmit',
        'onmouseout',
        'onkeydown',
        'onkeyup'
      ]

      handlers.forEach((handler) => {
        const html = `<div ${handler}="alert(1)">Test</div>`
        const result = sanitizeHTML(html)

        expect(result).not.toContain(handler)
        expect(result).not.toContain('alert')
      })
    })

    it('should remove mixed case event handlers', () => {
      const html = '<div OnClick="alert(1)" ONERROR="alert(2)">Test</div>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('OnClick')
      expect(result).not.toContain('ONERROR')
      expect(result).not.toContain('alert')
    })
  })

  describe('dangerous URI removal', () => {
    it('should remove javascript: URIs from href', () => {
      const html = '<a href="javascript:alert(1)">Click</a>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('javascript:')
      expect(result).not.toContain('alert')
      expect(result).toContain('<a')
    })

    it('should remove javascript: URIs from src', () => {
      const html = '<img src="javascript:alert(1)">'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('javascript:')
      expect(result).not.toContain('alert')
    })

    it('should remove data: URIs from href', () => {
      const html = '<a href="data:text/html,<script>alert(1)</script>">Click</a>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('data:')
      expect(result).not.toContain('script')
    })

    it('should handle data: URIs in src', () => {
      const html = '<img src="data:image/png;base64,iVBORw0KGgo">'
      const result = sanitizeHTML(html)

      expect(result).toContain('<img')
      expect(result).toContain('data:image/png')
    })

    it('should allow safe URLs', () => {
      const html = '<a href="https://example.com">Safe Link</a>'
      const result = sanitizeHTML(html)

      expect(result).toContain('href="https://example.com"')
      expect(result).toContain('Safe Link')
    })

    it('should allow safe image sources', () => {
      const html = '<img src="https://example.com/image.png" alt="Safe">'
      const result = sanitizeHTML(html)

      expect(result).toContain('src="https://example.com/image.png"')
      expect(result).toContain('alt="Safe"')
    })
  })

  describe('complex XSS attempts', () => {
    it('should handle multiple attack vectors in one string', () => {
      const html = `
        <script>alert(1)</script>
        <img src=x onerror=alert(2)>
        <a href="javascript:alert(3)">Click</a>
        <div onclick="alert(4)">Test</div>
        <div>Safe content</div>
      `
      const result = sanitizeHTML(html)

      expect(result).not.toContain('<script>')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('javascript:')
      expect(result).not.toContain('onclick')
      expect(result).not.toContain('alert')
      expect(result).toContain('Safe content')
    })

    it('should handle nested malicious elements', () => {
      const html = '<div><script>alert(1)<div>nested</div></script></div>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
    })

    it('should handle encoded attack attempts', () => {
      const html = '<div onclick="&#97;&#108;&#101;&#114;&#116;(1)">Test</div>'
      const result = sanitizeHTML(html)

      expect(result).not.toContain('onclick')
    })
  })

  describe('edge cases', () => {
    it('should handle empty tags', () => {
      const html = '<div></div><span></span>'
      const result = sanitizeHTML(html)

      expect(result).toContain('<div>')
      expect(result).toContain('<span>')
    })

    it('should handle self-closing tags', () => {
      const html = '<br/><hr/><input type="text"/>'
      const result = sanitizeHTML(html)

      expect(result).toBeTruthy()
      // Self-closing tags should be preserved (may vary by browser)
    })

    it('should handle deeply nested safe HTML', () => {
      const html = '<div><div><div><p>Deep <strong>text</strong></p></div></div></div>'
      const result = sanitizeHTML(html)

      expect(result).toContain('<div>')
      expect(result).toContain('<p>')
      expect(result).toContain('<strong>')
      expect(result).toContain('Deep')
      expect(result).toContain('text')
    })

    it('should handle HTML with attributes', () => {
      const html = '<div class="test" id="main" data-value="123">Content</div>'
      const result = sanitizeHTML(html)

      expect(result).toContain('class="test"')
      expect(result).toContain('id="main"')
      expect(result).not.toContain('data-value')
      expect(result).toContain('Content')
    })

    it('should handle mixed safe and unsafe content', () => {
      const html = `
        <h1>Title</h1>
        <script>alert(1)</script>
        <p>Paragraph</p>
        <img src=x onerror=alert(2)>
        <strong>Bold</strong>
      `
      const result = sanitizeHTML(html)

      expect(result).toContain('<h1>')
      expect(result).toContain('Title')
      expect(result).toContain('<p>')
      expect(result).toContain('Paragraph')
      expect(result).toContain('<strong>')
      expect(result).toContain('Bold')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('alert')
    })
  })

  describe('real-world use cases', () => {
    it('should sanitize user-generated content', () => {
      const userContent = '<p>Hello!</p><script>stealData()</script>'
      const result = sanitizeHTML(userContent)

      expect(result).toContain('<p>')
      expect(result).toContain('Hello!')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('stealData')
    })

    it('should sanitize rich text editor output', () => {
      const richText = `
        <h2>Article Title</h2>
        <p>First paragraph with <strong>bold</strong> and <em>italic</em>.</p>
        <ul><li>Item 1</li><li>Item 2</li></ul>
        <a href="https://example.com">Link</a>
      `
      const result = sanitizeHTML(richText)

      expect(result).toContain('<h2>')
      expect(result).toContain('<p>')
      expect(result).toContain('<strong>')
      expect(result).toContain('<em>')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>')
      expect(result).toContain('<a')
      expect(result).toContain('href="https://example.com"')
    })

    it('should handle DOM changes from experiments', () => {
      const experimentHTML = '<div class="banner"><h3>New Feature!</h3><p>Try it now</p></div>'
      const result = sanitizeHTML(experimentHTML)

      expect(result).toContain('class="banner"')
      expect(result).toContain('<h3>')
      expect(result).toContain('New Feature!')
      expect(result).toContain('<p>')
    })
  })
})
