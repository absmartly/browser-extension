/**
 * Block Inserter - CodeMirror-based HTML inserter with live preview
 * Allows inserting new HTML blocks before/after selected elements
 */

import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { html } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup } from 'codemirror'
import { defaultKeymap } from '@codemirror/commands'
import DOMPurify from 'dompurify'

export interface InsertBlockOptions {
  html: string
  position: 'before' | 'after'
}

export class BlockInserter {
  private dialogHost: HTMLElement | null = null
  private editorView: EditorView | null = null
  private previewContainer: HTMLElement | null = null
  private previewElement: HTMLElement | null = null
  private resolveCallback: ((value: InsertBlockOptions | null) => void) | null = null

  async show(element: Element): Promise<InsertBlockOptions | null> {
    // Clean up any previous instance first
    this.cleanup()

    return new Promise((resolve) => {
      // Set resolve callback AFTER cleanup so it doesn't get cleared
      this.resolveCallback = resolve
      this.createDialog(element)
    })
  }

  private createDialog(element: Element): void {
    // Cleanup is now called in show() before creating the promise

    this.dialogHost = document.createElement('div')
    this.dialogHost.id = 'absmartly-block-inserter-host'
    this.dialogHost.setAttribute('data-absmartly-ignore', 'true')
    this.dialogHost.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483648;
      pointer-events: auto;
    `

    const styleEl = document.createElement('style')
    styleEl.id = 'absmartly-block-inserter-styles'
    styleEl.textContent = this.getStyles()
    document.head.appendChild(styleEl)

    const backdrop = document.createElement('div')
    backdrop.className = 'inserter-backdrop'

    const container = document.createElement('div')
    container.className = 'inserter-container'

    const header = document.createElement('div')
    header.className = 'inserter-header'

    const title = document.createElement('h3')
    title.className = 'inserter-title'
    title.textContent = 'Insert HTML Block (Live Preview)'

    const subtitle = document.createElement('div')
    subtitle.className = 'inserter-subtitle'
    subtitle.textContent = `Insert relative to <${element.tagName.toLowerCase()}>`

    header.appendChild(title)
    header.appendChild(subtitle)

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

    const content = document.createElement('div')
    content.className = 'inserter-content'

    const editorPanel = document.createElement('div')
    editorPanel.className = 'inserter-panel inserter-panel-editor'

    const editorLabel = document.createElement('div')
    editorLabel.className = 'inserter-label'
    editorLabel.innerHTML = '<span class="icon">📝</span> HTML Code'

    const editorContainer = document.createElement('div')
    editorContainer.id = 'block-inserter-codemirror'
    editorContainer.className = 'inserter-editor'

    const errorContainer = document.createElement('div')
    errorContainer.id = 'inserter-error'
    errorContainer.className = 'inserter-error'
    errorContainer.style.display = 'none'

    editorPanel.appendChild(editorLabel)
    editorPanel.appendChild(editorContainer)
    editorPanel.appendChild(errorContainer)

    content.appendChild(editorPanel)

    const positionGroup = document.createElement('div')
    positionGroup.className = 'inserter-position-group'

    const positionLabel = document.createElement('div')
    positionLabel.className = 'inserter-position-label'
    positionLabel.textContent = 'Insert Position:'

    const positionOptions = document.createElement('div')
    positionOptions.className = 'inserter-position-options'

    let selectedPosition: 'before' | 'after' = 'after'

    const beforeBtn = document.createElement('button')
    beforeBtn.className = 'position-btn'
    beforeBtn.innerHTML = '<span class="icon">⬆️</span> Before'
    beforeBtn.dataset.position = 'before'

    const afterBtn = document.createElement('button')
    afterBtn.className = 'position-btn position-btn-selected'
    afterBtn.innerHTML = '<span class="icon">⬇️</span> After'
    afterBtn.dataset.position = 'after'

    const updatePosition = (btn: HTMLElement) => {
      positionOptions.querySelectorAll('.position-btn').forEach(b => b.classList.remove('position-btn-selected'))
      btn.classList.add('position-btn-selected')
      selectedPosition = btn.dataset.position as 'before' | 'after'
      // Update preview position when position changes
      if (this.editorView && this.previewElement) {
        this.updateLivePreview(this.editorView.state.doc.toString(), element, selectedPosition)
      }
    }

    beforeBtn.addEventListener('click', () => updatePosition(beforeBtn))
    afterBtn.addEventListener('click', () => updatePosition(afterBtn))

    positionOptions.appendChild(beforeBtn)
    positionOptions.appendChild(afterBtn)

    positionGroup.appendChild(positionLabel)
    positionGroup.appendChild(positionOptions)

    const buttons = document.createElement('div')
    buttons.className = 'inserter-buttons'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'inserter-button inserter-button-cancel'
    cancelBtn.innerHTML = '<span>✕</span> Cancel'

    const insertBtn = document.createElement('button')
    insertBtn.className = 'inserter-button inserter-button-insert'
    insertBtn.innerHTML = '<span>✓</span> Insert Block'

    buttons.appendChild(cancelBtn)
    buttons.appendChild(insertBtn)

    container.appendChild(header)
    container.appendChild(content)
    container.appendChild(positionGroup)
    container.appendChild(buttons)
    backdrop.appendChild(container)

    this.dialogHost.appendChild(backdrop)
    document.body.appendChild(this.dialogHost)

    const defaultHtml = '<div class="new-block">\n  <!-- Your content here -->\n  <p>New content</p>\n</div>'

    // Create preview element on the page
    this.previewElement = document.createElement('div')
    this.previewElement.id = 'absmartly-block-inserter-preview'
    this.previewElement.style.cssText = `
      outline: 2px dashed #10b981;
      outline-offset: 4px;
      background: rgba(16, 185, 129, 0.1);
      min-height: 20px;
    `

    setTimeout(() => {
      const startState = EditorState.create({
        doc: defaultHtml,
        extensions: [
          basicSetup,
          html(),
          oneDark,
          EditorView.lineWrapping,
          keymap.of(defaultKeymap),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.updateLivePreview(update.state.doc.toString(), element, selectedPosition)
            }
          })
        ]
      })

      this.editorView = new EditorView({
        state: startState,
        parent: editorContainer
      })

      // Insert initial preview element
      this.updateLivePreview(defaultHtml, element, selectedPosition)
      this.editorView.focus()
    }, 10)

    const handleInsert = () => {
      if (!this.editorView) {
        console.error('[BlockInserter] No editor view!')
        return
      }

      const html = this.editorView.state.doc.toString().trim()
      if (!html) {
        this.showError('Please enter some HTML')
        return
      }

      const validationResult = this.validateHTML(html)
      if (!validationResult.valid) {
        this.showError(validationResult.error || 'Invalid HTML')
        return
      }

      if (this.resolveCallback) {
        const callback = this.resolveCallback
        this.resolveCallback = null
        callback({
          html,
          position: selectedPosition
        })
      }
      this.cleanup()
    }

    const handleCancel = () => {
      if (this.resolveCallback) {
        const callback = this.resolveCallback
        this.resolveCallback = null
        callback(null)
      }
      this.cleanup()
    }

    cancelBtn.addEventListener('click', handleCancel)
    insertBtn.addEventListener('click', handleInsert)

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        handleCancel()
      }
    })

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.dialogHost) {
        document.removeEventListener('keydown', escHandler)
        handleCancel()
      }
    }
    document.addEventListener('keydown', escHandler)
  }

  private updateLivePreview(html: string, element: Element, position: 'before' | 'after'): void {
    if (!this.previewElement) return

    this.hideError()

    // Remove preview element if already inserted
    if (this.previewElement.parentElement) {
      this.previewElement.remove()
    }

    if (!html.trim()) {
      this.previewElement.innerHTML = '<div style="padding: 8px; color: #666; font-style: italic;">Type HTML to see preview...</div>'
    } else {
      const validationResult = this.validateHTML(html)
      if (!validationResult.valid) {
        this.showError(validationResult.error || 'Invalid HTML')
        this.previewElement.innerHTML = '<div style="padding: 8px; color: #c33; background: #fee; border-radius: 4px;">Invalid HTML - see error below</div>'
      } else {
        try {
          const sanitized = DOMPurify.sanitize(html)
          this.previewElement.innerHTML = sanitized
        } catch (error) {
          this.showError(error instanceof Error ? error.message : 'Unknown error')
          this.previewElement.innerHTML = '<div style="padding: 8px; color: #c33;">Preview error</div>'
        }
      }
    }

    // Insert preview element at the correct position
    if (position === 'before') {
      element.parentElement?.insertBefore(this.previewElement, element)
    } else {
      element.parentElement?.insertBefore(this.previewElement, element.nextSibling)
    }
  }

  private validateHTML(html: string): { valid: boolean; error?: string } {
    if (!html.trim()) {
      return { valid: false, error: 'HTML cannot be empty' }
    }

    const tagPattern = /<(\w+)(?:\s[^>]*)?>|<\/(\w+)>/g
    const stack: string[] = []
    const selfClosingTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ])

    let match: RegExpExecArray | null
    while ((match = tagPattern.exec(html)) !== null) {
      const openTag = match[1]
      const closeTag = match[2]

      if (openTag) {
        if (!selfClosingTags.has(openTag.toLowerCase()) && !match[0].endsWith('/>')) {
          stack.push(openTag)
        }
      } else if (closeTag) {
        if (stack.length === 0) {
          return { valid: false, error: `Unexpected closing tag </${closeTag}>` }
        }
        const expectedTag = stack.pop()
        if (expectedTag?.toLowerCase() !== closeTag.toLowerCase()) {
          return { valid: false, error: `Mismatched tags: expected </${expectedTag}>, found </${closeTag}>` }
        }
      }
    }

    if (stack.length > 0) {
      return { valid: false, error: `Unclosed tag: <${stack[stack.length - 1]}>` }
    }

    return { valid: true }
  }

  private showError(message: string): void {
    const errorEl = document.getElementById('inserter-error')
    if (errorEl) {
      errorEl.textContent = `⚠️ ${message}`
      errorEl.style.display = 'block'
    }
  }

  private hideError(): void {
    const errorEl = document.getElementById('inserter-error')
    if (errorEl) {
      errorEl.style.display = 'none'
    }
  }

  private cleanup(): void {
    if (this.editorView) {
      this.editorView.destroy()
      this.editorView = null
    }

    const styleEl = document.getElementById('absmartly-block-inserter-styles')
    if (styleEl) {
      styleEl.remove()
    }

    if (this.dialogHost) {
      this.dialogHost.remove()
      this.dialogHost = null
    }

    // Remove preview element from the page
    if (this.previewElement && this.previewElement.parentElement) {
      this.previewElement.remove()
    }
    this.previewElement = null

    this.previewContainer = null
    // Don't call resolveCallback here - it should already be null
    // The caller is responsible for calling it before cleanup
    this.resolveCallback = null
  }

  remove(): void {
    this.cleanup()
  }

  private getStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .inserter-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.7);
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

      .inserter-container {
        background: #1e1e1e;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        width: 700px;
        max-width: 90%;
        height: 600px;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        animation: slideUp 0.3s ease-out;
        overflow: hidden;
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

      .inserter-header {
        padding: 20px 24px;
        border-bottom: 1px solid #3e3e42;
        background: #252526;
      }

      .inserter-title {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 18px;
        font-weight: 600;
        color: #cccccc;
        margin: 0 0 4px 0;
      }

      .inserter-subtitle {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
        color: #858585;
      }

      .inserter-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-height: 0;
      }

      .inserter-panel {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .inserter-panel-editor {
        flex: 1;
        background: #1e1e1e;
      }

      .inserter-label {
        padding: 12px 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 600;
        color: #cccccc;
        background: #2d2d30;
        border-bottom: 1px solid #3e3e42;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .inserter-label .icon {
        font-size: 16px;
      }

      .inserter-editor {
        flex: 1;
        overflow: hidden;
        position: relative;
      }

      .inserter-editor .cm-editor {
        height: 100%;
      }

      .inserter-editor .cm-scroller {
        overflow: auto;
      }

      .inserter-error {
        padding: 12px 16px;
        background: #fee;
        color: #c33;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        border-top: 1px solid #fcc;
      }

      .inserter-position-group {
        padding: 16px 24px;
        border-top: 1px solid #3e3e42;
        background: #252526;
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .inserter-position-label {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        color: #cccccc;
      }

      .inserter-position-options {
        display: flex;
        gap: 12px;
      }

      .position-btn {
        padding: 8px 16px;
        background: #3c3c3c;
        border: 2px solid #555;
        border-radius: 6px;
        color: #cccccc;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .position-btn .icon {
        font-size: 14px;
      }

      .position-btn:hover {
        background: #484848;
        border-color: #666;
      }

      .position-btn-selected {
        background: #007acc;
        border-color: #007acc;
        color: white;
      }

      .position-btn-selected:hover {
        background: #0084db;
        border-color: #0084db;
      }

      .inserter-buttons {
        padding: 16px 24px;
        border-top: 1px solid #3e3e42;
        background: #252526;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      .inserter-button {
        padding: 10px 24px;
        border-radius: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        gap: 6px;
        border: none;
        outline: none;
      }

      .inserter-button span {
        font-size: 16px;
      }

      .inserter-button-cancel {
        background: #3c3c3c;
        color: #cccccc;
        border: 1px solid #555;
      }

      .inserter-button-cancel:hover {
        background: #484848;
        border-color: #666;
      }

      .inserter-button-insert {
        background: #10b981;
        color: white;
        border: 1px solid #10b981;
      }

      .inserter-button-insert:hover {
        background: #059669;
        border-color: #059669;
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
      }
    `
  }
}

export default BlockInserter
