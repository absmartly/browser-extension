/**
 * CodeMirror-based HTML Editor for Visual Editor
 * Provides syntax highlighting, autocomplete, and full code editing features
 */

import StateManager from '../core/state-manager'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { html } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import DOMPurify from 'dompurify'

export class HtmlEditor {
  private stateManager: StateManager
  private editorHost: HTMLElement | null = null
  private editorView: EditorView | null = null

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  async show(element: Element, currentHtml: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Store original HTML for cancellation
      const originalHtml = element.innerHTML

      // Create editor host in regular DOM
      this.editorHost = document.createElement('div')
      this.editorHost.id = 'absmartly-html-editor-host'
      this.editorHost.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 2147483648;
        pointer-events: auto;
      `

      const editorStyle = document.createElement('style')
      editorStyle.id = 'absmartly-html-editor-styles'
      editorStyle.textContent = this.getEditorStyles()
      document.head.appendChild(editorStyle)

      // Create editor elements
      const backdrop = document.createElement('div')
      backdrop.className = 'editor-backdrop'

      const container = document.createElement('div')
      container.id = 'html-editor-dialog'
      container.className = 'editor-container'

      const header = document.createElement('div')
      header.className = 'editor-header'

      const title = document.createElement('h3')
      title.className = 'editor-title'
      title.textContent = 'Edit HTML (Live Preview)'

      const tagInfo = document.createElement('span')
      tagInfo.className = 'editor-tag-info'
      tagInfo.textContent = `<${element.tagName.toLowerCase()}${element.className ? `.${element.className.split(' ').join('.')}` : ''}>`

      header.appendChild(title)
      header.appendChild(tagInfo)

      // Make header draggable
      let isDragging = false
      let currentX = 0
      let currentY = 0
      let initialX = 0
      let initialY = 0

      header.style.cursor = 'move'

      header.addEventListener('mousedown', (e) => {
        isDragging = true
        initialX = e.clientX - currentX
        initialY = e.clientY - currentY
      })

      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          e.preventDefault()
          currentX = e.clientX - initialX
          currentY = e.clientY - initialY
          container.style.transform = `translate(${currentX}px, ${currentY}px)`
        }
      })

      document.addEventListener('mouseup', () => {
        isDragging = false
      })

      // Create editor container
      const editorContainer = document.createElement('div')
      editorContainer.id = 'codemirror-container'
      editorContainer.className = 'editor-codemirror-container'

      // Create toolbar
      const toolbar = document.createElement('div')
      toolbar.className = 'editor-toolbar'

      const formatBtn = document.createElement('button')
      formatBtn.className = 'toolbar-button'
      formatBtn.innerHTML = '⚡ Format'
      formatBtn.title = 'Format HTML'

      toolbar.appendChild(formatBtn)

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

      this.editorHost.appendChild(backdrop)
      document.body.appendChild(this.editorHost)

      // Create CodeMirror editor
      setTimeout(() => {
        const startState = EditorState.create({
          doc: this.formatHtml(currentHtml),
          extensions: [
            basicSetup,
            html(),
            oneDark,
            EditorView.lineWrapping,
            // Add real-time preview on change
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                const newValue = update.state.doc.toString()
                // Apply changes directly to the element for live preview
                try {
                  element.innerHTML = DOMPurify.sanitize(newValue)
                } catch (err) {
                  // Ignore errors during typing
                }
              }
            })
          ]
        })

        this.editorView = new EditorView({
          state: startState,
          parent: editorContainer
        })

        // Store reference on container for testing
        ;(editorContainer as any).editorView = this.editorView

        // Focus the editor
        this.editorView.focus()
      }, 10)

      // Handle button clicks
      formatBtn.addEventListener('click', (e) => {
        console.log('[HtmlEditor] Format button clicked')
        e.stopPropagation()
        if (this.editorView) {
          const currentValue = this.editorView.state.doc.toString()
          const formatted = this.formatHtml(currentValue)
          this.editorView.dispatch({
            changes: {
              from: 0,
              to: this.editorView.state.doc.length,
              insert: formatted
            }
          })
        }
      })

      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        // Restore original HTML
        element.innerHTML = originalHtml
        this.cleanup()
        resolve(null)
      })

      saveBtn.addEventListener('click', (e) => {
        console.log('[HtmlEditor] Save button clicked!')
        e.stopPropagation()
        e.preventDefault()
        const newHtml = this.editorView?.state.doc.toString() || ''
        console.log('[HtmlEditor] New HTML:', newHtml)
        this.cleanup()
        console.log('[HtmlEditor] Cleanup done, resolving...')
        resolve(newHtml)
      })

      // Handle ESC key
      const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.editorHost) {
          document.removeEventListener('keydown', escapeHandler)
          // Restore original HTML
          element.innerHTML = originalHtml
          this.cleanup()
          resolve(null)
        }
      }
      document.addEventListener('keydown', escapeHandler)

      // Prevent backdrop clicks from closing (only click outside container)
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          // Restore original HTML
          element.innerHTML = originalHtml
          this.cleanup()
          resolve(null)
        }
      })

      // Prevent clicks from propagating to the page
      container.addEventListener('click', (e) => {
        e.stopPropagation()
      })

      container.addEventListener('mousedown', (e) => {
        e.stopPropagation()
      })
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
    if (this.editorView) {
      this.editorView.destroy()
      this.editorView = null
    }

    // Remove styles from document head
    const styleEl = document.getElementById('absmartly-html-editor-styles')
    if (styleEl) {
      styleEl.remove()
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

      .editor-codemirror-container {
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      .editor-codemirror-container .cm-editor {
        height: 100%;
      }

      .editor-codemirror-container .cm-scroller {
        overflow: auto;
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
