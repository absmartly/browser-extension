/**
 * Read-only Event Viewer
 * Displays SDK event data in a modal with syntax highlighting
 */

import { EditorView, keymap, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { foldGutter, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { searchKeymap } from '@codemirror/search'

export class EventViewer {
  private viewerHost: HTMLElement | null = null
  private editorView: EditorView | null = null

  show(eventName: string, timestamp: string, jsonData: string): void {
    // Create viewer host in regular DOM
    this.viewerHost = document.createElement('div')
    this.viewerHost.id = 'absmartly-event-viewer-host'
    this.viewerHost.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483648;
      pointer-events: auto;
    `

    const viewerStyle = document.createElement('style')
    viewerStyle.id = 'absmartly-event-viewer-styles'
    viewerStyle.textContent = this.getViewerStyles()
    document.head.appendChild(viewerStyle)

    // Create viewer elements
    const backdrop = document.createElement('div')
    backdrop.className = 'event-viewer-backdrop'

    const container = document.createElement('div')
    container.className = 'event-viewer-container'

    const header = document.createElement('div')
    header.className = 'event-viewer-header'

    const titleEl = document.createElement('h3')
    titleEl.className = 'event-viewer-title'
    titleEl.textContent = 'Event Details'

    header.appendChild(titleEl)

    // Create metadata section
    const metadataSection = document.createElement('div')
    metadataSection.className = 'event-viewer-metadata'

    // Event Type
    const eventTypeContainer = document.createElement('div')
    eventTypeContainer.className = 'event-viewer-field'
    const eventTypeLabel = document.createElement('label')
    eventTypeLabel.textContent = 'Event Type'
    eventTypeLabel.className = 'event-viewer-label'
    const eventTypeValue = document.createElement('div')
    eventTypeValue.textContent = eventName
    eventTypeValue.className = 'event-viewer-value'
    eventTypeContainer.appendChild(eventTypeLabel)
    eventTypeContainer.appendChild(eventTypeValue)

    // Timestamp
    const timestampContainer = document.createElement('div')
    timestampContainer.className = 'event-viewer-field'
    const timestampLabel = document.createElement('label')
    timestampLabel.textContent = 'Timestamp'
    timestampLabel.className = 'event-viewer-label'
    const timestampValue = document.createElement('div')
    timestampValue.textContent = timestamp
    timestampValue.className = 'event-viewer-value'
    timestampContainer.appendChild(timestampLabel)
    timestampContainer.appendChild(timestampValue)

    metadataSection.appendChild(eventTypeContainer)
    metadataSection.appendChild(timestampContainer)

    // Event Data Label
    const dataLabelContainer = document.createElement('div')
    dataLabelContainer.className = 'event-viewer-data-label'
    const dataLabel = document.createElement('label')
    dataLabel.textContent = 'Event Data'
    dataLabel.className = 'event-viewer-label'
    dataLabelContainer.appendChild(dataLabel)

    // Create viewer container
    const viewerContainer = document.createElement('div')
    viewerContainer.id = 'event-codemirror-container'
    viewerContainer.className = 'event-viewer-codemirror-container'

    // Create close button
    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'event-viewer-buttons'

    const closeBtn = document.createElement('button')
    closeBtn.className = 'event-viewer-button event-viewer-button-close'
    closeBtn.innerHTML = '<span>✕</span> Close'

    buttonContainer.appendChild(closeBtn)

    // Assemble container
    container.appendChild(header)
    container.appendChild(metadataSection)
    container.appendChild(dataLabelContainer)
    container.appendChild(viewerContainer)
    container.appendChild(buttonContainer)
    backdrop.appendChild(container)

    this.viewerHost.appendChild(backdrop)
    document.body.appendChild(this.viewerHost)

    // Create CodeMirror viewer (read-only)
    setTimeout(() => {
      const startState = EditorState.create({
        doc: jsonData,
        extensions: [
          // Minimal viewer setup - no editing features
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          foldGutter(),
          syntaxHighlighting(defaultHighlightStyle),
          keymap.of(searchKeymap),
          json(),
          oneDark,
          EditorView.lineWrapping,
          EditorView.editable.of(false), // Read-only mode
          EditorState.readOnly.of(true)  // Read-only state
        ]
      })

      this.editorView = new EditorView({
        state: startState,
        parent: viewerContainer
      })

      // Set up close handlers
      closeBtn.addEventListener('click', () => {
        this.close()
      })

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.close()
        }
      })

      // Escape key to close
      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.close()
        }
      }
      document.addEventListener('keydown', handleKeydown)

      // Store handler for cleanup
      ;(this.viewerHost as any)._keydownHandler = handleKeydown
    }, 0)
  }

  close(): void {
    if (this.editorView) {
      this.editorView.destroy()
      this.editorView = null
    }

    if (this.viewerHost) {
      // Remove keydown handler
      const handler = (this.viewerHost as any)._keydownHandler
      if (handler) {
        document.removeEventListener('keydown', handler)
      }

      this.viewerHost.remove()
      this.viewerHost = null
    }

    const style = document.getElementById('absmartly-event-viewer-styles')
    if (style) {
      style.remove()
    }

    // Notify extension that viewer was closed
    chrome.runtime.sendMessage({ type: 'EVENT_VIEWER_CLOSE' })
  }

  private getViewerStyles(): string {
    return `
      .event-viewer-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
      }

      .event-viewer-container {
        background: #1e1e1e;
        border-radius: 8px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 1000px;
        height: 85vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .event-viewer-header {
        padding: 12px 16px;
        border-bottom: 1px solid #333;
        background: #252526;
        flex-shrink: 0;
      }

      .event-viewer-title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: #e0e0e0;
      }

      .event-viewer-metadata {
        padding: 12px 16px;
        background: #2d2d30;
        border-bottom: 1px solid #3e3e42;
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex-shrink: 0;
      }

      .event-viewer-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .event-viewer-label {
        font-size: 11px;
        font-weight: 600;
        color: #cccccc;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .event-viewer-value {
        padding: 8px 10px;
        background: #1e1e1e;
        border: 1px solid #3e3e42;
        border-radius: 3px;
        color: #ffffff;
        font-size: 13px;
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
        line-height: 1.3;
      }

      .event-viewer-data-label {
        padding: 10px 16px 6px 16px;
        background: #2d2d30;
        flex-shrink: 0;
      }

      .event-viewer-data-label .event-viewer-label {
        color: #cccccc;
      }

      .event-viewer-codemirror-container {
        flex: 1;
        overflow: auto;
        background: #1e1e1e;
        min-height: 0;
      }

      .event-viewer-codemirror-container .cm-editor {
        height: 100%;
        font-size: 13px;
      }

      .event-viewer-codemirror-container .cm-scroller {
        overflow: auto;
      }

      .event-viewer-buttons {
        padding: 12px 16px;
        border-top: 1px solid #333;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        background: #252526;
      }

      .event-viewer-button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .event-viewer-button-close {
        background: #3a3a3a;
        color: #e0e0e0;
      }

      .event-viewer-button-close:hover {
        background: #4a4a4a;
      }

      .event-viewer-button span {
        font-size: 14px;
      }
    `
  }
}
