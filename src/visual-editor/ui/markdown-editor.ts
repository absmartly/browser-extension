/**
 * CodeMirror-based Markdown Editor
 * Provides syntax highlighting and full code editing features for Markdown
 */

import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'

export class MarkdownEditor {
  private editorHost: HTMLElement | null = null
  private editorView: EditorView | null = null

  async show(title: string, currentMarkdown: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.editorHost = document.createElement('div')
      this.editorHost.id = 'absmartly-markdown-editor-host'
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
      editorStyle.id = 'absmartly-markdown-editor-styles'
      editorStyle.textContent = this.getEditorStyles()
      document.head.appendChild(editorStyle)

      const backdrop = document.createElement('div')
      backdrop.className = 'markdown-editor-backdrop'

      const container = document.createElement('div')
      container.className = 'markdown-editor-container'

      const header = document.createElement('div')
      header.className = 'markdown-editor-header'

      const titleEl = document.createElement('h3')
      titleEl.className = 'markdown-editor-title'
      titleEl.textContent = title

      const charCountEl = document.createElement('span')
      charCountEl.className = 'markdown-editor-char-count'
      charCountEl.id = 'markdown-editor-char-count'
      charCountEl.textContent = `${currentMarkdown.length} characters`

      header.appendChild(titleEl)
      header.appendChild(charCountEl)

      const editorContainer = document.createElement('div')
      editorContainer.id = 'markdown-codemirror-container'
      editorContainer.className = 'markdown-editor-codemirror-container'

      const toolbar = document.createElement('div')
      toolbar.className = 'markdown-editor-toolbar'

      const tipsEl = document.createElement('div')
      tipsEl.className = 'markdown-editor-tips'
      tipsEl.innerHTML = `
        <div style="font-size: 11px; color: #858585;">
          <strong>Tips:</strong>
          Use Ctrl/Cmd+F to search •
          This will override the default AI chat system prompt
        </div>
      `

      toolbar.appendChild(tipsEl)

      const buttons = document.createElement('div')
      buttons.className = 'markdown-editor-buttons'

      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'markdown-editor-button markdown-editor-button-cancel'
      cancelBtn.innerHTML = '<span>✕</span> Cancel'

      const saveBtn = document.createElement('button')
      saveBtn.className = 'markdown-editor-button markdown-editor-button-save'
      saveBtn.innerHTML = '<span>✓</span> Save Changes'

      buttons.appendChild(cancelBtn)
      buttons.appendChild(saveBtn)

      container.appendChild(header)
      container.appendChild(toolbar)
      container.appendChild(editorContainer)
      container.appendChild(buttons)
      backdrop.appendChild(container)

      this.editorHost.appendChild(backdrop)
      document.body.appendChild(this.editorHost)

      setTimeout(() => {
        const startState = EditorState.create({
          doc: currentMarkdown,
          extensions: [
            basicSetup,
            markdown(),
            oneDark,
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                const charCount = update.state.doc.toString().length
                charCountEl.textContent = `${charCount} characters`
              }
            })
          ]
        })

        this.editorView = new EditorView({
          state: startState,
          parent: editorContainer
        })

        this.editorView.focus()
      }, 10)

      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        this.cleanup()
        resolve(null)
      })

      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()

        const newMarkdown = this.editorView?.state.doc.toString() || ''
        this.cleanup()
        resolve(newMarkdown)
      })

      const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.editorHost) {
          document.removeEventListener('keydown', escapeHandler)
          this.cleanup()
          resolve(null)
        }
      }
      document.addEventListener('keydown', escapeHandler)

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.cleanup()
          resolve(null)
        }
      })

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

    const styleEl = document.getElementById('absmartly-markdown-editor-styles')
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

      .markdown-editor-backdrop {
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

      .markdown-editor-container {
        background: #2d2d30;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        width: 90%;
        max-width: 1200px;
        height: 85vh;
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

      .markdown-editor-header {
        padding: 16px 20px;
        border-bottom: 1px solid #3e3e42;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .markdown-editor-title {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 16px;
        font-weight: 600;
        color: #cccccc;
        margin: 0;
      }

      .markdown-editor-char-count {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
        color: #858585;
        background: #1e1e1e;
        padding: 4px 12px;
        border-radius: 4px;
      }

      .markdown-editor-toolbar {
        padding: 8px 20px;
        background: #252526;
        border-bottom: 1px solid #3e3e42;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .markdown-editor-tips {
        flex: 1;
        text-align: left;
      }

      .markdown-editor-codemirror-container {
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      .markdown-editor-codemirror-container .cm-editor {
        height: 100%;
      }

      .markdown-editor-codemirror-container .cm-scroller {
        overflow: auto;
      }

      .markdown-editor-buttons {
        padding: 16px 20px;
        border-top: 1px solid #3e3e42;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #252526;
        position: relative;
        z-index: 10;
      }

      .markdown-editor-button {
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

      .markdown-editor-button span {
        font-size: 16px;
      }

      .markdown-editor-button-cancel {
        background: #3c3c3c;
        color: #cccccc;
        border: 1px solid #555;
      }

      .markdown-editor-button-cancel:hover {
        background: #484848;
        border-color: #666;
      }

      .markdown-editor-button-save {
        background: #007acc;
        color: white;
        border: 1px solid #007acc;
      }

      .markdown-editor-button-save:hover {
        background: #0084db;
        border-color: #0084db;
        box-shadow: 0 2px 8px rgba(0, 122, 204, 0.3);
      }
    `
  }
}

export default MarkdownEditor
