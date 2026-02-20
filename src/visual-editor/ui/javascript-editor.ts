/**
 * CodeMirror-based JavaScript Editor
 * Provides syntax highlighting, validation, and full code editing features for JavaScript
 * Displays as a true fullscreen overlay on the page
 */

import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'

export class JavaScriptEditor {
  private editorHost: HTMLElement | null = null
  private editorView: EditorView | null = null

  async show(title: string, currentCode: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Create editor host in regular DOM (page body, not sidebar)
      this.editorHost = document.createElement('div')
      this.editorHost.id = 'absmartly-javascript-editor-host'
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
      editorStyle.id = 'absmartly-javascript-editor-styles'
      editorStyle.textContent = this.getEditorStyles()
      document.head.appendChild(editorStyle)

      // Create editor elements
      const backdrop = document.createElement('div')
      backdrop.className = 'js-editor-backdrop'

      const container = document.createElement('div')
      container.className = 'js-editor-container'

      const header = document.createElement('div')
      header.className = 'js-editor-header'

      const titleEl = document.createElement('h3')
      titleEl.className = 'js-editor-title'
      titleEl.textContent = title

      const statusEl = document.createElement('span')
      statusEl.className = 'js-editor-status'
      statusEl.id = 'js-editor-status'
      statusEl.textContent = '✓ Ready'

      header.appendChild(titleEl)
      header.appendChild(statusEl)

      // Create editor container
      const editorContainer = document.createElement('div')
      editorContainer.id = 'js-codemirror-container'
      editorContainer.className = 'js-editor-codemirror-container'

      const toolbar = document.createElement('div')
      toolbar.className = 'js-editor-toolbar'

      const tipsEl = document.createElement('div')
      tipsEl.className = 'js-editor-tips'
      tipsEl.innerHTML = `
        <div style="font-size: 11px; color: #858585;">
          <strong>Available context:</strong>
          <code>element</code> (selected element) •
          <code>document</code> (page document) •
          <code>window</code> (page window) •
          <code>console</code> (for logging) •
          <code>experimentName</code> (experiment identifier)
        </div>
      `

      toolbar.appendChild(tipsEl)

      const buttons = document.createElement('div')
      buttons.className = 'js-editor-buttons'

      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'js-editor-button js-editor-button-cancel'
      cancelBtn.innerHTML = '<span>✕</span> Cancel'

      const saveBtn = document.createElement('button')
      saveBtn.className = 'js-editor-button js-editor-button-save'
      saveBtn.innerHTML = '<span>✓</span> Save Code'

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

      // Create CodeMirror editor with setTimeout to ensure DOM is ready
      setTimeout(() => {
        const startState = EditorState.create({
          doc: currentCode,
          extensions: [
            basicSetup,
            javascript(),
            oneDark,
            EditorView.lineWrapping
          ]
        })

        this.editorView = new EditorView({
          state: startState,
          parent: editorContainer
        })

        // Focus the editor
        this.editorView.focus()
      }, 10)

      // Handle button clicks
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        this.cleanup()
        resolve(null)
      })

      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()

        const newCode = this.editorView?.state.doc.toString() || ''
        this.cleanup()
        resolve(newCode)
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
          document.removeEventListener('keydown', escapeHandler)
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

    if (this.editorHost) {
      this.editorHost.remove()
      this.editorHost = null
    }

    const styleEl = document.getElementById('absmartly-javascript-editor-styles')
    if (styleEl) {
      styleEl.remove()
    }
  }

  private getEditorStyles(): string {
    return `
      .js-editor-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
      }

      .js-editor-container {
        display: flex;
        flex-direction: column;
        width: 90%;
        height: 90vh;
        max-width: 1200px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;
      }

      .js-editor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(to right, #f9fafb, #f3f4f6);
      }

      .js-editor-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #111827;
      }

      .js-editor-status {
        font-size: 13px;
        color: #059669;
        font-weight: 500;
      }

      .js-editor-toolbar {
        padding: 12px 20px;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
      }

      .js-editor-tips {
        font-size: 12px;
        color: #6b7280;
        line-height: 1.5;
      }

      .js-editor-tips code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: "Monaco", "Menlo", "Consolas", monospace;
        color: #1f2937;
        font-weight: 500;
      }

      .js-editor-codemirror-container {
        flex: 1;
        overflow: hidden;
        background: #1e1e1e;
      }

      .js-editor-codemirror-container .cm-editor {
        height: 100% !important;
        font-size: 13px;
        font-family: "Monaco", "Menlo", "Consolas", "Courier New", monospace;
      }

      .js-editor-buttons {
        display: flex;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
        justify-content: flex-end;
      }

      .js-editor-button {
        padding: 8px 16px;
        border: 1px solid transparent;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;
      }

      .js-editor-button-save {
        background: #10b981;
        color: white;
        border-color: #059669;
      }

      .js-editor-button-save:hover {
        background: #059669;
        box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
      }

      .js-editor-button-cancel {
        background: white;
        color: #6b7280;
        border-color: #d1d5db;
      }

      .js-editor-button-cancel:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .js-editor-button span {
        font-weight: 600;
      }
    `
  }
}
