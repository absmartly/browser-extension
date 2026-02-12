/**
 * CodeMirror-based JSON Editor
 * Provides syntax highlighting, validation, and full code editing features for JSON
 */

import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import { linter, type Diagnostic } from '@codemirror/lint'

export class JSONEditor {
  private editorHost: HTMLElement | null = null
  private editorView: EditorView | null = null

  async show(title: string, currentJSON: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Create editor host in regular DOM
      this.editorHost = document.createElement('div')
      this.editorHost.id = 'absmartly-json-editor-host'
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
      editorStyle.id = 'absmartly-json-editor-styles'
      editorStyle.textContent = this.getEditorStyles()
      document.head.appendChild(editorStyle)

      // Create editor elements
      const backdrop = document.createElement('div')
      backdrop.className = 'json-editor-backdrop'

      const container = document.createElement('div')
      container.className = 'json-editor-container'

      const header = document.createElement('div')
      header.className = 'json-editor-header'

      const titleEl = document.createElement('h3')
      titleEl.className = 'json-editor-title'
      titleEl.textContent = title

      const statusEl = document.createElement('span')
      statusEl.className = 'json-editor-status'
      statusEl.id = 'json-editor-status'
      statusEl.textContent = 'Valid JSON'

      header.appendChild(titleEl)
      header.appendChild(statusEl)

      // Create editor container
      const editorContainer = document.createElement('div')
      editorContainer.id = 'json-codemirror-container'
      editorContainer.className = 'json-editor-codemirror-container'

      // Create toolbar
      const toolbar = document.createElement('div')
      toolbar.className = 'json-editor-toolbar'

      const formatBtn = document.createElement('button')
      formatBtn.className = 'json-toolbar-button'
      formatBtn.innerHTML = '⚡ Format'
      formatBtn.title = 'Format JSON'

      const tipsEl = document.createElement('div')
      tipsEl.className = 'json-editor-tips'
      tipsEl.innerHTML = `
        <div style="font-size: 11px; color: #858585;">
          <strong>Tips:</strong> 
          Each change must have 'selector' and 'type' fields • 
          Use Ctrl/Cmd+F to search • 
          Code folding available in gutter
        </div>
      `

      toolbar.appendChild(formatBtn)
      toolbar.appendChild(tipsEl)

      // Create buttons
      const buttons = document.createElement('div')
      buttons.className = 'json-editor-buttons'

      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'json-editor-button json-editor-button-cancel'
      cancelBtn.id = 'json-editor-close-button'
      cancelBtn.innerHTML = '<span>✕</span> Cancel'

      const saveBtn = document.createElement('button')
      saveBtn.className = 'json-editor-button json-editor-button-save'
      saveBtn.innerHTML = '<span>✓</span> Save Changes'

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

      // JSON validator linter
      const jsonLinter = linter((view) => {
        const diagnostics: Diagnostic[] = []
        const content = view.state.doc.toString()
        
        try {
          JSON.parse(content)
          statusEl.textContent = '✓ Valid JSON'
          statusEl.style.color = '#4ade80'
        } catch (e) {
          const error = e as SyntaxError
          statusEl.textContent = `✕ ${error.message}`
          statusEl.style.color = '#f87171'
          
          // Try to find the error position
          const match = error.message.match(/position (\d+)/)
          if (match) {
            const pos = parseInt(match[1], 10)
            diagnostics.push({
              from: pos,
              to: pos + 1,
              severity: 'error',
              message: error.message
            })
          }
        }
        
        return diagnostics
      })

      // Create CodeMirror editor
      setTimeout(() => {
        const startState = EditorState.create({
          doc: currentJSON,
          extensions: [
            basicSetup,
            json(),
            oneDark,
            EditorView.lineWrapping,
            jsonLinter
          ]
        })

        this.editorView = new EditorView({
          state: startState,
          parent: editorContainer
        })

        // Focus the editor
        this.editorView.focus()
        
        // Initial validation
        try {
          JSON.parse(currentJSON)
          statusEl.textContent = '✓ Valid JSON'
          statusEl.style.color = '#4ade80'
        } catch (e) {
          statusEl.textContent = `✕ ${(e as Error).message}`
          statusEl.style.color = '#f87171'
        }
      }, 10)

      // Handle button clicks
      formatBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (this.editorView) {
          try {
            const currentValue = this.editorView.state.doc.toString()
            const parsed = JSON.parse(currentValue)
            const formatted = JSON.stringify(parsed, null, 2)
            this.editorView.dispatch({
              changes: {
                from: 0,
                to: this.editorView.state.doc.length,
                insert: formatted
              }
            })
            statusEl.textContent = '✓ Valid JSON'
            statusEl.style.color = '#4ade80'
          } catch (e) {
            statusEl.textContent = `✕ ${(e as Error).message}`
            statusEl.style.color = '#f87171'
          }
        }
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
        
        const newJSON = this.editorView?.state.doc.toString() || ''
        
        // Validate before saving
        try {
          JSON.parse(newJSON)
          this.cleanup()
          resolve(newJSON)
        } catch (e) {
          statusEl.textContent = `✕ Cannot save invalid JSON: ${(e as Error).message}`
          statusEl.style.color = '#f87171'
          // Don't resolve - keep editor open
        }
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

      // Prevent clicks from propagating to the page
      container.addEventListener('click', (e) => {
        e.stopPropagation()
      })

      container.addEventListener('mousedown', (e) => {
        e.stopPropagation()
      })
    })
  }

  private cleanup(): void {
    if (this.editorView) {
      this.editorView.destroy()
      this.editorView = null
    }

    // Remove styles from document head
    const styleEl = document.getElementById('absmartly-json-editor-styles')
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

      .json-editor-backdrop {
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

      .json-editor-container {
        background: #2d2d30;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        width: 90%;
        max-width: 1000px;
        height: 80vh;
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

      .json-editor-header {
        padding: 16px 20px;
        border-bottom: 1px solid #3e3e42;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .json-editor-title {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 16px;
        font-weight: 600;
        color: #cccccc;
        margin: 0;
      }

      .json-editor-status {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
        color: #4ade80;
        background: #1e1e1e;
        padding: 4px 12px;
        border-radius: 4px;
        transition: color 0.2s;
      }

      .json-editor-toolbar {
        padding: 8px 20px;
        background: #252526;
        border-bottom: 1px solid #3e3e42;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .json-toolbar-button {
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

      .json-toolbar-button:hover {
        background: #484848;
        border-color: #007acc;
      }

      .json-editor-tips {
        flex: 1;
        text-align: right;
      }

      .json-editor-codemirror-container {
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      .json-editor-codemirror-container .cm-editor {
        height: 100%;
      }

      .json-editor-codemirror-container .cm-scroller {
        overflow: auto;
      }

      .json-editor-buttons {
        padding: 16px 20px;
        border-top: 1px solid #3e3e42;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #252526;
        position: relative;
        z-index: 10;
      }

      .json-editor-button {
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

      .json-editor-button span {
        font-size: 16px;
      }

      .json-editor-button-cancel {
        background: #3c3c3c;
        color: #cccccc;
        border: 1px solid #555;
      }

      .json-editor-button-cancel:hover {
        background: #484848;
        border-color: #666;
      }

      .json-editor-button-save {
        background: #007acc;
        color: white;
        border: 1px solid #007acc;
      }

      .json-editor-button-save:hover {
        background: #0084db;
        border-color: #0084db;
        box-shadow: 0 2px 8px rgba(0, 122, 204, 0.3);
      }
    `
  }
}

export default JSONEditor
