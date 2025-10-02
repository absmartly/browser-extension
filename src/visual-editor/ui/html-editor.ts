/**
 * Monaco-based HTML Editor for Visual Editor
 * Provides syntax highlighting, autocomplete, and full code editing features
 */

import StateManager from '../core/state-manager'
import * as monaco from 'monaco-editor'

export class HtmlEditor {
  private stateManager: StateManager
  private editorHost: HTMLElement | null = null
  private monacoEditor: monaco.editor.IStandaloneCodeEditor | null = null
  private editorLoaded: boolean = false
  private useShadowDOM: boolean
  private editorShadowRoot: ShadowRoot | null = null

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
    // Check query string for shadow DOM override (for testing)
    const urlParams = new URLSearchParams(window.location.search)
    const shadowDOMParam = urlParams.get('use_shadow_dom_for_visual_editor_context_menu')
    this.useShadowDOM = shadowDOMParam !== '0'
  }

  private async loadMonacoIfNeeded(): Promise<void> {
    if (this.editorLoaded) {
      return
    }

    // Monaco is now bundled, so we can use it directly
    console.log('[HtmlEditor] Monaco editor ready')
    this.editorLoaded = true
    return
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
      // Don't set pointer-events: none on the host when not using shadow DOM
      // because it would block clicks on all children
      this.editorHost.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: ${this.useShadowDOM ? '0' : '100vw'};
        height: ${this.useShadowDOM ? '0' : '100vh'};
        z-index: 2147483648;
        pointer-events: ${this.useShadowDOM ? 'none' : 'auto'};
      `

      const editorShadow = this.useShadowDOM ? this.editorHost.attachShadow({ mode: 'closed' }) : this.editorHost
      this.editorShadowRoot = this.useShadowDOM ? editorShadow as ShadowRoot : null

      const editorStyle = document.createElement('style')
      editorStyle.id = 'absmartly-html-editor-styles'
      editorStyle.textContent = this.getEditorStyles()

      // If not using shadow DOM, add styles to document head instead
      if (!this.useShadowDOM) {
        document.head.appendChild(editorStyle)
      }

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
      // Add inline styles to ensure it's clickable when not using shadow DOM
      if (!this.useShadowDOM) {
        saveBtn.style.cssText = `
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
          background: #007acc;
          color: white;
          pointer-events: auto;
        `
        cancelBtn.style.cssText = `
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
          border: 1px solid #555;
          outline: none;
          background: #3c3c3c;
          color: #cccccc;
          pointer-events: auto;
        `
        buttons.style.cssText = `
          padding: 16px 20px;
          border-top: 1px solid #3e3e42;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: #252526;
          pointer-events: auto;
        `
      }

      buttons.appendChild(cancelBtn)
      buttons.appendChild(saveBtn)

      // Assemble container
      container.appendChild(header)
      container.appendChild(toolbar)
      container.appendChild(editorContainer)
      container.appendChild(buttons)
      backdrop.appendChild(container)

      // Only append style to shadow root if using shadow DOM (already in head otherwise)
      if (this.useShadowDOM) {
        editorShadow.appendChild(editorStyle)
      }
      editorShadow.appendChild(backdrop)

      document.body.appendChild(this.editorHost)

      // IMPORTANT: When using Shadow DOM, Monaco needs to render in regular DOM
      // Move the editor container out of shadow DOM after initial setup
      if (this.useShadowDOM) {
        // Remove from shadow DOM
        editorContainer.remove()
        // Append directly to the host element (regular DOM)
        this.editorHost.appendChild(editorContainer)
        // Position it absolutely to overlay the shadow DOM placeholder
        editorContainer.style.cssText = `
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: calc(80vw - 80px);
          max-width: 720px;
          height: 400px;
          z-index: 2147483649;
          pointer-events: auto;
        `
      }

      // Create Monaco editor
      setTimeout(() => {
        // Create Monaco editor instance
        this.monacoEditor = monaco.editor.create(editorContainer, {
          value: this.formatHtml(currentHtml),
          language: 'html',
          theme: 'vs-dark',
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          formatOnPaste: true,
          formatOnType: true,
          scrollBeyondLastLine: false,
          renderLineHighlight: 'all',
          folding: true,
          glyphMargin: true,
        })

        // Focus the editor
        this.monacoEditor.focus()
      }, 10)

      // Handle button clicks
      formatBtn.addEventListener('click', () => {
        if (this.monacoEditor) {
          const currentValue = this.monacoEditor.getValue()
          const formatted = this.formatHtml(currentValue)
          this.monacoEditor.setValue(formatted)
        }
      })

      wrapBtn.addEventListener('click', () => {
        if (this.monacoEditor) {
          const selection = this.monacoEditor.getSelection()
          if (selection) {
            const model = this.monacoEditor.getModel()
            if (model) {
              const selectedText = model.getValueInRange(selection)
              const wrappedText = `<div>\n  ${selectedText}\n</div>`
              this.monacoEditor.executeEdits('', [{
                range: selection,
                text: wrappedText,
                forceMoveMarkers: true
              }])
            }
          }
        }
      })

      previewBtn.addEventListener('click', () => {
        if (this.monacoEditor) {
          const newHtml = this.monacoEditor.getValue()
          // Temporarily update the element to show preview
          const originalHtml = element.innerHTML
          element.innerHTML = newHtml

          setTimeout(() => {
            const shouldKeep = confirm('Keep these changes?')
            if (!shouldKeep) {
              element.innerHTML = originalHtml
            }
          }, 100)
        }
      })

      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        this.cleanup()
        resolve(null)
      })

      saveBtn.addEventListener('click', (e) => {
        console.log('[HtmlEditor] Save button clicked!')
        e.stopPropagation()
        e.preventDefault()
        const newHtml = this.monacoEditor?.getValue() || ''
        console.log('[HtmlEditor] New HTML:', newHtml)
        this.cleanup()
        console.log('[HtmlEditor] Cleanup done, resolving...')
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
      // BUT allow button clicks to work
      container.addEventListener('click', (e) => {
        // Don't prevent clicks on buttons
        const target = e.target as HTMLElement
        if (target.closest('.editor-button')) {
          return
        }
        e.stopPropagation()
        e.preventDefault()
      }, true)

      // Prevent clicks in editor from triggering visual editor selection
      // BUT allow button clicks to work
      container.addEventListener('mousedown', (e) => {
        // Don't prevent clicks on buttons
        const target = e.target as HTMLElement
        if (target.closest('.editor-button')) {
          return
        }
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

    // Remove styles from document head if not using shadow DOM
    if (!this.useShadowDOM) {
      const styleEl = document.getElementById('absmartly-html-editor-styles')
      if (styleEl) {
        styleEl.remove()
      }
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
        position: relative;
        z-index: 10;
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