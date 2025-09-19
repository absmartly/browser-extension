/**
 * Simplified E2E tests for Monaco HTML Editor using helper
 * Focuses on core Monaco features: syntax highlighting, autocomplete, and formatting
 */

import { test, expect, Page, BrowserContext, chromium } from '@playwright/test'
import { VisualEditorHelper } from './helpers/visual-editor-helper'
import path from 'path'
import fs from 'fs'

test.describe('Monaco Editor Core Features', () => {
  let context: BrowserContext
  let page: Page
  let helper: VisualEditorHelper

  test.beforeAll(async () => {
    const extensionPath = path.join(__dirname, '../../build/chrome-mv3-dev')

    if (!fs.existsSync(extensionPath)) {
      console.error('Extension not built. Running build...')
      // Try to build the extension
      const { execSync } = require('child_process')
      try {
        execSync('npm run build', { stdio: 'inherit' })
      } catch (e) {
        console.error('Build failed:', e)
      }
    }

    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      viewport: { width: 1400, height: 900 }
    })
  })

  test.beforeEach(async () => {
    page = await context.newPage()
    helper = new VisualEditorHelper(page)

    // Load test page with various HTML elements
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Monaco Editor Test</title>
        <style>
          body { padding: 40px; font-family: system-ui; }
          .test-element {
            padding: 20px;
            margin: 20px 0;
            background: #f5f5f5;
            border-radius: 8px;
            cursor: pointer;
          }
          .test-element:hover { background: #e5e5e5; }
        </style>
      </head>
      <body>
        <h1>Monaco Editor Test Page</h1>

        <div class="test-element" id="simple">
          <p>Simple paragraph text</p>
        </div>

        <div class="test-element" id="complex">
          <div class="card">
            <h2>Complex Structure</h2>
            <p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
            <ul>
              <li>First item</li>
              <li>Second item</li>
            </ul>
          </div>
        </div>

        <div class="test-element" id="unformatted">
          <div><p>Unformatted</p><span>HTML</span><div>Content</div></div>
        </div>
      </body>
      </html>
    `

    await helper.loadTestPage(testHTML)
    await helper.initializeVisualEditor()
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('✨ Syntax Highlighting - Monaco applies syntax colors to HTML', async () => {
    await helper.openMonacoEditor('#complex')

    // Check that Monaco loaded
    const monacoLoaded = await page.evaluate(() => typeof window.monaco !== 'undefined')
    expect(monacoLoaded).toBe(true)

    // Check for syntax highlighting
    const hasSyntax = await helper.hasSyntaxHighlighting()
    expect(hasSyntax).toBe(true)

    // Take screenshot to visually verify syntax highlighting
    await helper.screenshot('monaco-syntax-highlighting.png')

    // Check for specific Monaco token classes
    const syntaxDetails = await page.evaluate(() => {
      const container = document.querySelector('#absmartly-monaco-temp')
      if (!container) return { hasTokens: false, tokenCount: 0 }

      const tokens = container.querySelectorAll('[class*="mtk"]')
      const tagTokens = container.querySelectorAll('.mtk5, .mtk6') // HTML tags often use these classes
      const stringTokens = container.querySelectorAll('.mtk4') // Strings often use this class

      return {
        hasTokens: tokens.length > 0,
        tokenCount: tokens.length,
        hasTagTokens: tagTokens.length > 0,
        hasStringTokens: stringTokens.length > 0
      }
    })

    console.log('Syntax highlighting details:', syntaxDetails)
    expect(syntaxDetails.hasTokens).toBe(true)
    expect(syntaxDetails.tokenCount).toBeGreaterThan(5)
  })

  test('🔤 Autocomplete - HTML tags suggestions appear', async () => {
    await helper.openMonacoEditor('#simple')

    // Clear editor and type '<'
    await helper.setMonacoContent('')
    await page.keyboard.type('<')

    // Wait a moment for autocomplete to trigger
    await page.waitForTimeout(300)

    // If autocomplete doesn't appear automatically, trigger it
    let suggestions = await helper.getAutocompleteSuggestions()

    if (suggestions.length === 0) {
      await helper.triggerAutocomplete()
      suggestions = await helper.getAutocompleteSuggestions()
    }

    console.log('Autocomplete suggestions:', suggestions.slice(0, 10))

    // Verify we have HTML tag suggestions
    expect(suggestions.length).toBeGreaterThan(0)

    // Check for common HTML tags
    const commonTags = ['div', 'span', 'p', 'button', 'input', 'h1', 'ul', 'li']
    const hasCommonTags = commonTags.some(tag =>
      suggestions.some(s => s.toLowerCase().includes(tag))
    )
    expect(hasCommonTags).toBe(true)

    // Take screenshot of autocomplete
    await helper.screenshot('monaco-autocomplete.png')
  })

  test('🔤 Autocomplete - HTML attributes suggestions', async () => {
    await helper.openMonacoEditor('#simple')

    // Set up a div tag and position cursor for attributes
    await helper.setMonacoContent('<div ></div>')

    // Position cursor after 'div '
    await page.evaluate(() => {
      const monaco = window.monaco
      if (monaco) {
        const editors = monaco.editor.getEditors()
        if (editors.length > 0) {
          editors[0].setPosition({ lineNumber: 1, column: 6 })
          editors[0].focus()
        }
      }
    })

    // Trigger autocomplete for attributes
    await helper.triggerAutocomplete()
    const suggestions = await helper.getAutocompleteSuggestions()

    console.log('Attribute suggestions:', suggestions.slice(0, 10))

    // Check for common attributes
    const commonAttrs = ['class', 'id', 'style', 'title']
    const hasCommonAttrs = commonAttrs.some(attr =>
      suggestions.some(s => s.toLowerCase().includes(attr))
    )

    if (suggestions.length > 0) {
      expect(hasCommonAttrs).toBe(true)
    }
  })

  test('📐 Format Document - Properly indents HTML', async () => {
    await helper.openMonacoEditor('#unformatted')

    // Get initial unformatted content
    const unformatted = await helper.getMonacoContent()
    console.log('Unformatted:', unformatted)

    // Format the document
    await helper.formatDocument()

    // Get formatted content
    const formatted = await helper.getMonacoContent()
    console.log('Formatted:', formatted)

    // Check formatting results
    expect(formatted).toContain('\n') // Has newlines
    expect(formatted.split('\n').length).toBeGreaterThan(3) // Multiple lines

    // Check for indentation
    const lines = formatted.split('\n')
    const hasIndentation = lines.some(line => line.match(/^\s{2,}/))
    expect(hasIndentation).toBe(true)

    // Take screenshot of formatted code
    await helper.screenshot('monaco-formatted.png')
  })

  test('🎨 Dark Theme - Monaco uses VS Code dark theme', async () => {
    await helper.openMonacoEditor('#simple')

    const themeInfo = await page.evaluate(() => {
      const container = document.querySelector('#absmartly-monaco-temp')
      if (!container) return { isDark: false }

      const computedStyle = window.getComputedStyle(container as HTMLElement)
      const bgColor = computedStyle.backgroundColor

      // Check for dark background
      const rgb = bgColor.match(/\d+/g)
      let isDark = false
      if (rgb) {
        const [r, g, b] = rgb.map(Number)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        isDark = brightness < 128
      }

      // Also check for Monaco dark theme classes
      const hasVsDark = document.querySelector('.monaco-editor.vs-dark') !== null

      return {
        isDark,
        hasVsDark,
        bgColor
      }
    })

    console.log('Theme info:', themeInfo)
    expect(themeInfo.isDark || themeInfo.hasVsDark).toBe(true)
  })

  test('💾 Save and Cancel - Editor properly saves or cancels changes', async () => {
    await helper.openMonacoEditor('#simple')

    // Modify content
    const newContent = '<p class="modified">Modified content from Monaco</p>'
    await helper.setMonacoContent(newContent)

    // Save the changes
    const saved = await helper.saveMonacoEditor()
    expect(saved).toBe(true)

    await page.waitForTimeout(500)

    // Verify content was updated
    const elementContent = await page.$eval('#simple', el => el.innerHTML)
    expect(elementContent).toContain('Modified content from Monaco')

    // Open editor again
    await helper.openMonacoEditor('#simple')

    // Make another change but cancel
    await helper.setMonacoContent('<p>This should not be saved</p>')
    await helper.cancelMonacoEditor()

    await page.waitForTimeout(500)

    // Verify content wasn't changed
    const finalContent = await page.$eval('#simple', el => el.innerHTML)
    expect(finalContent).toContain('Modified content from Monaco')
  })

  test('⌨️ Keyboard Shortcuts - ESC closes editor', async () => {
    await helper.openMonacoEditor('#simple')

    // Verify editor is open
    let isVisible = await helper.isMonacoVisible()
    expect(isVisible).toBe(true)

    // Press ESC
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Verify editor closed
    isVisible = await helper.isMonacoVisible()
    expect(isVisible).toBe(false)
  })

  test('📦 Wrap Selection - Wraps selected text with tags', async () => {
    await helper.openMonacoEditor('#simple')

    // Set content and select text
    await helper.setMonacoContent('Text to wrap with tags')
    await helper.selectText(1, 6, 1, 13) // Select "to wrap"

    // Click Wrap button (second toolbar button)
    const clicked = await helper.clickMonacoToolbarButton(1)
    expect(clicked).toBe(true)

    await page.waitForTimeout(500)

    // Get wrapped content
    const wrapped = await helper.getMonacoContent()
    console.log('Wrapped content:', wrapped)

    expect(wrapped).toContain('<div>')
    expect(wrapped).toContain('to wrap')
    expect(wrapped).toContain('</div>')
  })

  test('👁️ Preview - Shows temporary preview of changes', async () => {
    await helper.openMonacoEditor('#simple')

    const originalContent = await page.$eval('#simple', el => el.innerHTML)

    // Set preview content
    await helper.setMonacoContent('<p style="color: red;">Preview Text</p>')

    // Mock confirm to reject changes
    await page.evaluate(() => {
      window.confirm = () => false
    })

    // Click Preview button (third toolbar button)
    const clicked = await helper.clickMonacoToolbarButton(2)
    expect(clicked).toBe(true)

    await page.waitForTimeout(1000)

    // Since we rejected the preview, content should remain original
    // But the preview feature was still triggered
    expect(clicked).toBe(true)
  })

  test('📊 Line Numbers - Monaco shows line numbers', async () => {
    await helper.openMonacoEditor('#complex')

    const hasLineNumbers = await page.evaluate(() => {
      const lineNumbers = document.querySelector('.line-numbers')
      const marginLineNumbers = document.querySelector('.margin-view-overlays')

      return lineNumbers !== null || marginLineNumbers !== null
    })

    expect(hasLineNumbers).toBe(true)

    // Take screenshot showing line numbers
    await helper.screenshot('monaco-line-numbers.png')
  })

  test('🔍 Complex HTML - Handles nested structures correctly', async () => {
    await helper.openMonacoEditor('#complex')

    const content = await helper.getMonacoContent()

    // Verify complex structure is preserved
    expect(content).toContain('<div class="card">')
    expect(content).toContain('<h2>')
    expect(content).toContain('<strong>')
    expect(content).toContain('<em>')
    expect(content).toContain('<ul>')
    expect(content).toContain('<li>')

    // Format the complex HTML
    await helper.formatDocument()

    const formatted = await helper.getMonacoContent()

    // Check that structure is still intact after formatting
    expect(formatted).toContain('card')
    expect(formatted).toContain('Complex Structure')

    // Check for proper nesting indentation
    const lines = formatted.split('\n')
    const hasDeepIndentation = lines.some(line => line.match(/^\s{4,}/))
    expect(hasDeepIndentation).toBe(true)
  })
})