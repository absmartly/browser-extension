/**
 * Monaco-based HTML Editor for Visual Editor
 * Provides syntax highlighting, autocomplete, and full code editing features
 */

import StateManager from '../core/state-manager'

export class HtmlEditor {
  private stateManager: StateManager
  private editorHost: HTMLElement | null = null
  private monacoEditor: any = null
  private editorLoaded: boolean = false

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
    // Don't load Monaco on construction - only load when needed
  }

  private async loadMonacoIfNeeded(): Promise<void> {
    // Check if Monaco loader is already available
    if ((window as any).monaco) {
      this.editorLoaded = true
      return
    }

    // For now, use a simple textarea fallback instead of Monaco
    // Monaco requires loading from CDN which violates CSP
    // TODO: Bundle Monaco locally or use alternative code editor
    console.log('[HtmlEditor] Using fallback editor (Monaco CDN blocked by CSP)')
    this.editorLoaded = true
    return
  }

  private configureMonaco(): void {
    const monaco = (window as any).monaco

    // Register HTML completions
    monaco.languages.registerCompletionItemProvider('html', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        }

        const suggestions = [
          // Common HTML tags
          ...['div', 'span', 'p', 'a', 'button', 'input', 'form', 'img', 'video', 'audio',
              'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'nav', 'main',
              'section', 'article', 'aside', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'].map(tag => ({
            label: tag,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: `<${tag}>$0</${tag}>`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: `HTML <${tag}> element`,
            range: range
          })),

          // Common attributes
          ...['class', 'id', 'style', 'href', 'src', 'alt', 'title', 'type', 'value',
              'placeholder', 'name', 'for', 'data-', 'aria-label', 'role'].map(attr => ({
            label: attr,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: `${attr}="$0"`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: `HTML ${attr} attribute`,
            range: range
          }))
        ]

        return { suggestions }
      }
    })
  }

  async show(element: Element, currentHtml: string): Promise<string | null> {
    // Load editor on-demand when show() is called
    if (!this.editorLoaded) {
      await this.loadMonacoIfNeeded()
    }

    return new Promise((resolve) => {
      // Create editor host with Shadow DOM
      this.editorHost = document.createElement('div')
      this.editorHost.id = 'absmartly-monaco-editor-host'
      this.editorHost.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483648;
        pointer-events: none;
      `

      const editorShadow = this.editorHost.attachShadow({ mode: 'closed' })

      const editorStyle = document.createElement('style')
      editorStyle.textContent = this.getEditorStyles()

      // Create editor elements
      const backdrop = document.createElement('div')
      backdrop.className = 'editor-backdrop'

      const container = document.createElement('div')
      container.className = 'editor-container'

      const header = document.createElement('div')
      header.className = 'editor-header'

      const title = document.createElement('h3')
      title.className = 'editor-title'
      title.textContent = 'Edit HTML'

      const tagInfo = document.createElement('span')
      tagInfo.className = 'editor-tag-info'
      tagInfo.textContent = `<${element.tagName.toLowerCase()}${element.className ? `.${element.className.split(' ').join('.')}` : ''}>`

      header.appendChild(title)
      header.appendChild(tagInfo)

      // Create editor container
      const editorContainer = document.createElement('div')
      editorContainer.id = 'monaco-container'
      editorContainer.className = 'editor-monaco-container'

      // Create toolbar
      const toolbar = document.createElement('div')
      toolbar.className = 'editor-toolbar'

      const formatBtn = document.createElement('button')
      formatBtn.className = 'toolbar-button'
      formatBtn.innerHTML = '⚡ Format'
      formatBtn.title = 'Format HTML (Shift+Alt+F)'

      const wrapBtn = document.createElement('button')
      wrapBtn.className = 'toolbar-button'
      wrapBtn.innerHTML = '📦 Wrap Selection'
      wrapBtn.title = 'Wrap selection with tags'

      const previewBtn = document.createElement('button')
      previewBtn.className = 'toolbar-button'
      previewBtn.innerHTML = '👁 Preview'
      previewBtn.title = 'Preview changes'

      toolbar.appendChild(formatBtn)
      toolbar.appendChild(wrapBtn)
      toolbar.appendChild(previewBtn)

      // Create buttons
      const buttons = document.createElement('div')
      buttons.className = 'editor-buttons'

      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'editor-button editor-button-cancel'
      cancelBtn.innerHTML = '<span>✕</span> Cancel'

      const saveBtn = document.createElement('button')
      saveBtn.className = 'editor-button editor-button-save'
      saveBtn.innerHTML = '<span>✓</span> Apply Changes'

      buttons.appendChild(cancelBtn)
      buttons.appendChild(saveBtn)

      // Assemble container
      container.appendChild(header)
      container.appendChild(toolbar)
      container.appendChild(editorContainer)
      container.appendChild(buttons)
      backdrop.appendChild(container)

      editorShadow.appendChild(editorStyle)
      editorShadow.appendChild(backdrop)

      document.body.appendChild(this.editorHost)

      // Use fallback textarea editor instead of Monaco
      setTimeout(() => {
        // Create a textarea-based editor as fallback
        const tempContainer = document.createElement('div')
        tempContainer.id = 'absmartly-monaco-temp'
        tempContainer.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80%;
          max-width: 800px;
          height: 500px;
          z-index: 2147483649;
          background: #1e1e1e;
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          padding: 20px;
          display: flex;
          flex-direction: column;
        `

        const textarea = document.createElement('textarea')
        textarea.id = 'absmartly-html-textarea'
        textarea.value = this.formatHtml(currentHtml)
        textarea.style.cssText = `
          width: 100%;
          height: 100%;
          background: #1e1e1e;
          color: #d4d4d4;
          border: 1px solid #3e3e42;
          border-radius: 4px;
          padding: 10px;
          font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
          font-size: 14px;
          line-height: 1.5;
          resize: none;
          outline: none;
        `

        tempContainer.appendChild(textarea)
        document.body.appendChild(tempContainer)

        // Store reference to textarea as our "editor"
        this.monacoEditor = {
          getValue: () => textarea.value,
          getSelection: () => ({
            startLineNumber: 0,
            startColumn: textarea.selectionStart,
            endLineNumber: 0,
            endColumn: textarea.selectionEnd
          }),
          getModel: () => ({
            getValueInRange: () => textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
          }),
          executeEdits: (_: any, edits: any[]) => {
            edits.forEach(edit => {
              const start = textarea.selectionStart
              const end = textarea.selectionEnd
              const before = textarea.value.substring(0, start)
              const after = textarea.value.substring(end)
              textarea.value = before + edit.text + after
            })
          },
          getAction: () => null,
          dispose: () => {}
        }

        // Focus the textarea
        textarea.focus()
      }, 10)

      // Handle button clicks
      formatBtn.addEventListener('click', () => {
        // Format HTML in the textarea
        const textarea = document.getElementById('absmartly-html-textarea') as HTMLTextAreaElement
        if (textarea) {
          textarea.value = this.formatHtml(textarea.value)
        }
      })

      wrapBtn.addEventListener('click', () => {
        const selection = this.monacoEditor?.getSelection()
        if (selection) {
          const selectedText = this.monacoEditor.getModel().getValueInRange(selection)
          const wrappedText = `<div>\n  ${selectedText}\n</div>`
          this.monacoEditor.executeEdits('', [{
            range: selection,
            text: wrappedText,
            forceMoveMarkers: true
          }])
        }
      })

      previewBtn.addEventListener('click', () => {
        const newHtml = this.monacoEditor?.getValue() || ''
        // Temporarily update the element to show preview
        const originalHtml = element.innerHTML
        element.innerHTML = newHtml

        setTimeout(() => {
          const shouldKeep = confirm('Keep these changes?')
          if (!shouldKeep) {
            element.innerHTML = originalHtml
          }
        }, 100)
      })

      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        this.cleanup()
        resolve(null)
      })

      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        const newHtml = this.monacoEditor?.getValue() || ''
        this.cleanup()
        resolve(newHtml)
      })

      // Handle ESC key
      const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.editorHost) {
          document.removeEventListener('keydown', escapeHandler)
          this.cleanup()
          resolve(null)
        }
      }
      document.addEventListener('keydown', escapeHandler)

      // Prevent backdrop clicks from closing (only click outside container)
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.cleanup()
          resolve(null)
        }
      })

      // Prevent all clicks from propagating to prevent context menu
      container.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
      }, true)

      // Prevent clicks in editor from triggering visual editor selection
      container.addEventListener('mousedown', (e) => {
        e.stopPropagation()
        e.preventDefault()
      }, true)

      editorContainer.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
      }, true)

      editorContainer.addEventListener('mousedown', (e) => {
        e.stopPropagation()
        e.preventDefault()
      }, true)
    })
  }

  private formatHtml(html: string): string {
    // Basic HTML formatting
    let formatted = html
      .replace(/></g, '>\n<')
      .replace(/(\r\n|\n|\r)/gm, '\n')

    // Add indentation
    const lines = formatted.split('\n')
    let indentLevel = 0
    const indentSize = 2

    return lines.map(line => {
      const trimmedLine = line.trim()

      // Decrease indent for closing tags
      if (trimmedLine.startsWith('</')) {
        indentLevel = Math.max(0, indentLevel - 1)
      }

      const indentedLine = ' '.repeat(indentLevel * indentSize) + trimmedLine

      // Increase indent for opening tags (not self-closing)
      if (trimmedLine.startsWith('<') && !trimmedLine.startsWith('</') &&
          !trimmedLine.endsWith('/>') && !trimmedLine.includes('</')) {
        indentLevel++
      }

      return indentedLine
    }).join('\n')
  }

  private cleanup(): void {
    if (this.monacoEditor) {
      this.monacoEditor.dispose()
      this.monacoEditor = null
    }

    // Remove temporary Monaco container
    const tempContainer = document.getElementById('absmartly-monaco-temp')
    if (tempContainer) {
      tempContainer.remove()
    }

    if (this.editorHost) {
      this.editorHost.remove()
      this.editorHost = null
    }
  }

  private getEditorStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .editor-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        animation: fadeIn 0.2s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .editor-container {
        background: #2d2d30;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        width: 80%;
        max-width: 800px;
        height: 600px;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .editor-header {
        padding: 16px 20px;
        border-bottom: 1px solid #3e3e42;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .editor-title {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 16px;
        font-weight: 600;
        color: #cccccc;
        margin: 0;
      }

      .editor-tag-info {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
        color: #9cdcfe;
        background: #1e1e1e;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .editor-toolbar {
        padding: 8px 20px;
        background: #252526;
        border-bottom: 1px solid #3e3e42;
        display: flex;
        gap: 8px;
      }

      .toolbar-button {
        padding: 6px 12px;
        background: #3c3c3c;
        border: 1px solid #555;
        border-radius: 4px;
        color: #cccccc;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .toolbar-button:hover {
        background: #484848;
        border-color: #007acc;
      }

      .editor-monaco-container {
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      .editor-buttons {
        padding: 16px 20px;
        border-top: 1px solid #3e3e42;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #252526;
      }

      .editor-button {
        padding: 8px 20px;
        border-radius: 4px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 6px;
        border: none;
        outline: none;
      }

      .editor-button span {
        font-size: 16px;
      }

      .editor-button-cancel {
        background: #3c3c3c;
        color: #cccccc;
        border: 1px solid #555;
      }

      .editor-button-cancel:hover {
        background: #484848;
        border-color: #666;
      }

      .editor-button-save {
        background: #007acc;
        color: white;
        border: 1px solid #007acc;
      }

      .editor-button-save:hover {
        background: #0084db;
        border-color: #0084db;
        box-shadow: 0 2px 8px rgba(0, 122, 204, 0.3);
      }
    `
  }
}

export default HtmlEditor