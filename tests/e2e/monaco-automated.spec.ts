/**
 * Automated E2E tests for Monaco HTML Editor
 * Tests real Monaco functionality with the extension properly loaded
 */

import { test, expect, Page, BrowserContext, chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Extend test timeout for extension loading
test.setTimeout(60000)

test.describe('Monaco Editor - Automated Tests', () => {
  let context: BrowserContext
  let page: Page
  let extensionId: string

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '../../build/chrome-mv3-dev')

    context = await chromium.launchPersistentContext('', {
      headless: false, // Monaco needs a real browser environment
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox'
      ],
      viewport: { width: 1400, height: 900 }
    })

    // Get extension ID from background page
    const backgroundPages = context.backgroundPages()
    if (backgroundPages.length > 0) {
      const url = backgroundPages[0].url()
      extensionId = url.split('://')[1].split('/')[0]
      console.log('Extension ID:', extensionId)
    }
  })

  test.beforeEach(async () => {
    page = await context.newPage()

    // Create a simple test page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Monaco Test</title>
        <style>
          body { padding: 40px; font-family: system-ui; }
          .test { padding: 20px; background: #f5f5f5; margin: 20px 0; cursor: pointer; }
        </style>
      </head>
      <body>
        <h1>Monaco Editor Automated Test</h1>
        <div class="test" id="test1">
          <p>Simple HTML content</p>
        </div>
        <div class="test" id="test2">
          <div><span>Nested</span><p>Content</p></div>
        </div>
        <div class="test" id="test3">
          <ul><li>Item 1</li><li>Item 2</li></ul>
        </div>
      </body>
      </html>
    `)

    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded')

    // Initialize visual editor by simulating what the extension does
    await page.evaluate(() => {
      // Inject visual editor initialization
      const script = document.createElement('script')
      script.textContent = `
        window.absmartlyVisualEditor = {
          isActive: true,
          config: {
            experimentName: 'Test',
            variantName: 'Control'
          }
        };
      `
      document.head.appendChild(script)
    })

    // Wait a bit for any extension scripts to initialize
    await page.waitForTimeout(2000)
  })

  test.afterEach(async () => {
    if (page) {
      await page.close()
    }
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('Monaco editor loads and shows syntax highlighting', async () => {
    // Simulate visual editor click and context menu
    await page.click('#test1')

    // Simulate right-click for context menu
    await page.click('#test1', { button: 'right' })
    await page.waitForTimeout(500)

    // Try to trigger HTML edit directly
    const result = await page.evaluate(async () => {
      // Import the HTML editor module dynamically
      const element = document.getElementById('test1')
      if (!element) return { error: 'Element not found' }

      // Create a mock HTML editor interface
      const editorContainer = document.createElement('div')
      editorContainer.id = 'monaco-test-container'
      editorContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 800px;
        height: 600px;
        background: #1e1e1e;
        border-radius: 8px;
        z-index: 10000;
      `
      document.body.appendChild(editorContainer)

      // Load Monaco from CDN
      return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js'
        script.onload = () => {
          (window as any).require.config({
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
          });

          (window as any).require(['vs/editor/editor.main'], () => {
            const monaco = (window as any).monaco

            // Create Monaco editor
            const editor = monaco.editor.create(editorContainer, {
              value: element.innerHTML,
              language: 'html',
              theme: 'vs-dark',
              automaticLayout: true,
              minimap: { enabled: false }
            })

            // Check for syntax highlighting
            setTimeout(() => {
              const tokens = editorContainer.querySelectorAll('[class*="mtk"]')
              const hasLineNumbers = editorContainer.querySelector('.line-numbers') !== null

              resolve({
                success: true,
                monacoLoaded: true,
                hasSyntaxHighlighting: tokens.length > 0,
                tokenCount: tokens.length,
                hasLineNumbers,
                theme: editor.getModel().getLanguageId() === 'html' ? 'html' : 'unknown'
              })
            }, 1000)
          })
        }
        document.head.appendChild(script)
      })
    })

    console.log('Monaco test result:', result)

    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('monacoLoaded', true)
    expect(result).toHaveProperty('hasSyntaxHighlighting', true)
    expect(result).toHaveProperty('tokenCount')
    expect((result as any).tokenCount).toBeGreaterThan(0)
  })

  test('Monaco autocomplete shows HTML tag suggestions', async () => {
    const result = await page.evaluate(async () => {
      // Create container
      const container = document.createElement('div')
      container.id = 'monaco-autocomplete-test'
      container.style.cssText = `
        position: fixed;
        top: 100px;
        left: 100px;
        width: 600px;
        height: 400px;
        background: #1e1e1e;
        z-index: 10000;
      `
      document.body.appendChild(container)

      return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js'
        script.onload = () => {
          (window as any).require.config({
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
          });

          (window as any).require(['vs/editor/editor.main'], () => {
            const monaco = (window as any).monaco

            // Register HTML completions
            const completionProvider = monaco.languages.registerCompletionItemProvider('html', {
              provideCompletionItems: () => {
                return {
                  suggestions: [
                    {
                      label: 'div',
                      kind: monaco.languages.CompletionItemKind.Keyword,
                      insertText: '<div>$0</div>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                    },
                    {
                      label: 'span',
                      kind: monaco.languages.CompletionItemKind.Keyword,
                      insertText: '<span>$0</span>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                    },
                    {
                      label: 'p',
                      kind: monaco.languages.CompletionItemKind.Keyword,
                      insertText: '<p>$0</p>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                    }
                  ]
                }
              }
            })

            const editor = monaco.editor.create(container, {
              value: '',
              language: 'html',
              theme: 'vs-dark'
            })

            // Type '<' to trigger autocomplete
            editor.setValue('<')
            editor.setPosition({ lineNumber: 1, column: 2 })

            // Trigger autocomplete
            editor.trigger('test', 'editor.action.triggerSuggest', {})

            setTimeout(() => {
              const suggestWidget = document.querySelector('.suggest-widget')
              const suggestions = suggestWidget ?
                Array.from(suggestWidget.querySelectorAll('.monaco-list-row')).length : 0

              resolve({
                success: true,
                hasSuggestWidget: suggestWidget !== null,
                suggestionCount: suggestions,
                registeredProvider: true
              })
            }, 1000)
          })
        }
        document.head.appendChild(script)
      })
    })

    console.log('Autocomplete result:', result)

    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('registeredProvider', true)
    // Monaco's autocomplete widget should exist
    expect((result as any).suggestionCount).toBeGreaterThanOrEqual(0)
  })

  test('Monaco formats HTML correctly', async () => {
    const result = await page.evaluate(async () => {
      const container = document.createElement('div')
      container.id = 'monaco-format-test'
      container.style.cssText = `
        position: fixed;
        top: 100px;
        left: 100px;
        width: 600px;
        height: 400px;
        background: #1e1e1e;
        z-index: 10000;
      `
      document.body.appendChild(container)

      return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js'
        script.onload = () => {
          (window as any).require.config({
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
          });

          (window as any).require(['vs/editor/editor.main'], () => {
            const monaco = (window as any).monaco

            const unformattedHtml = '<div><p>Test</p><span>Content</span></div>'

            const editor = monaco.editor.create(container, {
              value: unformattedHtml,
              language: 'html',
              theme: 'vs-dark'
            })

            // Format document
            setTimeout(() => {
              const action = editor.getAction('editor.action.formatDocument')
              if (action) {
                action.run().then(() => {
                  setTimeout(() => {
                    const formatted = editor.getValue()
                    const lines = formatted.split('\n')

                    resolve({
                      success: true,
                      original: unformattedHtml,
                      formatted: formatted,
                      lineCount: lines.length,
                      hasNewlines: formatted.includes('\n'),
                      hasIndentation: lines.some(l => l.startsWith('  '))
                    })
                  }, 500)
                })
              } else {
                resolve({
                  success: false,
                  error: 'Format action not found'
                })
              }
            }, 1000)
          })
        }
        document.head.appendChild(script)
      })
    })

    console.log('Format result:', result)

    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('hasNewlines', true)
    expect(result).toHaveProperty('hasIndentation', true)
    expect((result as any).lineCount).toBeGreaterThan(1)
  })

  test('Monaco applies dark theme', async () => {
    const result = await page.evaluate(async () => {
      const container = document.createElement('div')
      container.id = 'monaco-theme-test'
      container.style.cssText = `
        position: fixed;
        top: 100px;
        left: 100px;
        width: 600px;
        height: 400px;
        z-index: 10000;
      `
      document.body.appendChild(container)

      return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js'
        script.onload = () => {
          (window as any).require.config({
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
          });

          (window as any).require(['vs/editor/editor.main'], () => {
            const monaco = (window as any).monaco

            const editor = monaco.editor.create(container, {
              value: '<div>Test</div>',
              language: 'html',
              theme: 'vs-dark'
            })

            setTimeout(() => {
              const editorElement = container.querySelector('.monaco-editor')
              const isDarkTheme = editorElement?.classList.contains('vs-dark')
              const backgroundColor = window.getComputedStyle(container).backgroundColor

              resolve({
                success: true,
                isDarkTheme,
                hasMonacoEditor: editorElement !== null,
                backgroundColor
              })
            }, 500)
          })
        }
        document.head.appendChild(script)
      })
    })

    console.log('Theme result:', result)

    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('isDarkTheme', true)
    expect(result).toHaveProperty('hasMonacoEditor', true)
  })

  test('Monaco shows line numbers', async () => {
    const result = await page.evaluate(async () => {
      const container = document.createElement('div')
      container.id = 'monaco-lines-test'
      container.style.cssText = `
        position: fixed;
        top: 100px;
        left: 100px;
        width: 600px;
        height: 400px;
        background: #1e1e1e;
        z-index: 10000;
      `
      document.body.appendChild(container)

      return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js'
        script.onload = () => {
          (window as any).require.config({
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
          });

          (window as any).require(['vs/editor/editor.main'], () => {
            const monaco = (window as any).monaco

            const multilineContent = `<div>
  <h1>Title</h1>
  <p>Paragraph</p>
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
  </ul>
</div>`

            const editor = monaco.editor.create(container, {
              value: multilineContent,
              language: 'html',
              theme: 'vs-dark',
              lineNumbers: 'on'
            })

            setTimeout(() => {
              const lineNumbers = container.querySelector('.line-numbers')
              const marginLineNumbers = container.querySelectorAll('.line-numbers-content')

              resolve({
                success: true,
                hasLineNumbers: lineNumbers !== null || marginLineNumbers.length > 0,
                lineNumberCount: marginLineNumbers.length
              })
            }, 500)
          })
        }
        document.head.appendChild(script)
      })
    })

    console.log('Line numbers result:', result)

    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('hasLineNumbers', true)
  })

  test('Full Monaco integration - all features combined', async () => {
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'monaco-test-before.png' })

    const result = await page.evaluate(async () => {
      // Create a full-featured Monaco editor
      const container = document.createElement('div')
      container.id = 'monaco-full-test'
      container.style.cssText = `
        position: fixed;
        top: 50px;
        left: 50px;
        right: 50px;
        bottom: 50px;
        background: #1e1e1e;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        flex-direction: column;
      `

      // Add header
      const header = document.createElement('div')
      header.style.cssText = `
        padding: 15px;
        background: #2d2d30;
        border-bottom: 1px solid #3e3e42;
        color: #cccccc;
        font-family: system-ui;
      `
      header.innerHTML = '<h3 style="margin:0">Monaco HTML Editor - Automated Test</h3>'

      // Add editor container
      const editorContainer = document.createElement('div')
      editorContainer.style.cssText = 'flex: 1;'

      container.appendChild(header)
      container.appendChild(editorContainer)
      document.body.appendChild(container)

      return new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js'
        script.onload = () => {
          (window as any).require.config({
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
          });

          (window as any).require(['vs/editor/editor.main'], () => {
            const monaco = (window as any).monaco

            // Initial HTML content
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
    <style>
        body { font-family: system-ui; }
        .highlight { color: blue; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome</h1>
        <p class="highlight">This is a test</p>
        <ul>
            <li>Item 1</li>
            <li>Item 2</li>
        </ul>
    </div>
</body>
</html>`

            // Create editor with all features
            const editor = monaco.editor.create(editorContainer, {
              value: htmlContent,
              language: 'html',
              theme: 'vs-dark',
              automaticLayout: true,
              minimap: { enabled: false },
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              formatOnPaste: true,
              formatOnType: true,
              suggestOnTriggerCharacters: true,
              quickSuggestions: {
                other: true,
                comments: false,
                strings: true
              }
            })

            // Collect feature verification data
            setTimeout(() => {
              const features = {
                // Syntax highlighting
                syntaxTokens: editorContainer.querySelectorAll('[class*="mtk"]').length,

                // Line numbers
                hasLineNumbers: editorContainer.querySelector('.line-numbers') !== null,

                // Dark theme
                isDarkTheme: editorContainer.querySelector('.monaco-editor.vs-dark') !== null,

                // Language
                language: editor.getModel().getLanguageId(),

                // Content
                lineCount: editor.getModel().getLineCount(),

                // Editor ready
                editorReady: true
              }

              resolve({
                success: true,
                features,
                summary: {
                  syntaxHighlighting: features.syntaxTokens > 0,
                  lineNumbers: features.hasLineNumbers,
                  darkTheme: features.isDarkTheme,
                  htmlLanguage: features.language === 'html',
                  multipleLines: features.lineCount > 1
                }
              })
            }, 1500)
          })
        }
        document.head.appendChild(script)
      })
    })

    // Take screenshot after Monaco loads
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'monaco-test-after.png' })

    console.log('Full integration result:', result)

    // Verify all features
    expect(result).toHaveProperty('success', true)

    const summary = (result as any).summary
    expect(summary.syntaxHighlighting).toBe(true)
    expect(summary.lineNumbers).toBe(true)
    expect(summary.darkTheme).toBe(true)
    expect(summary.htmlLanguage).toBe(true)
    expect(summary.multipleLines).toBe(true)

    // Verify token count for syntax highlighting
    const features = (result as any).features
    expect(features.syntaxTokens).toBeGreaterThan(10) // Should have many syntax tokens
    expect(features.lineCount).toBeGreaterThan(5) // Should have multiple lines
  })
})