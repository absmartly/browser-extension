/**
 * Read-only Event Viewer
 * Displays SDK event data in a modal with syntax highlighting
 */

import { json } from "@codemirror/lang-json"
import {
  defaultHighlightStyle,
  foldGutter,
  syntaxHighlighting
} from "@codemirror/language"
import { searchKeymap } from "@codemirror/search"
import { EditorState } from "@codemirror/state"
import { oneDark } from "@codemirror/theme-one-dark"
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from "@codemirror/view"

export class EventViewer {
  private viewerHost: HTMLElement | null = null
  private shadowRoot: ShadowRoot | null = null
  private editorView: EditorView | null = null
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null
  private previousFocus: HTMLElement | null = null
  private initTimer: ReturnType<typeof setTimeout> | null = null

  show(eventName: string, timestamp: string, jsonData: string): void {
    if (this.viewerHost) {
      this.teardown()
    }

    // Create viewer host with Shadow DOM to avoid CSP issues
    this.viewerHost = document.createElement("div")
    this.viewerHost.id = "absmartly-event-viewer-host"
    this.viewerHost.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483648;
      pointer-events: auto;
    `

    // Create Shadow DOM to isolate from page's CSP
    this.shadowRoot = this.viewerHost.attachShadow({ mode: "open" })

    // Add styles directly to Shadow DOM (no CSP issues)
    const viewerStyle = document.createElement("style")
    viewerStyle.textContent = this.getViewerStyles()
    this.shadowRoot.appendChild(viewerStyle)

    // Create viewer elements
    const backdrop = document.createElement("div")
    backdrop.className = "event-viewer-backdrop"

    const container = document.createElement("div")
    container.className = "event-viewer-container"
    container.setAttribute("role", "dialog")
    container.setAttribute("aria-modal", "true")
    container.setAttribute("aria-labelledby", "event-viewer-title")
    container.tabIndex = -1

    const header = document.createElement("div")
    header.className = "event-viewer-header"

    const titleEl = document.createElement("h3")
    titleEl.className = "event-viewer-title"
    titleEl.id = "event-viewer-title"
    titleEl.textContent = "Event Details"

    header.appendChild(titleEl)

    // Create metadata section
    const metadataSection = document.createElement("div")
    metadataSection.className = "event-viewer-metadata"

    // Event Type
    const eventTypeContainer = document.createElement("div")
    eventTypeContainer.className = "event-viewer-field"
    const eventTypeLabel = document.createElement("label")
    eventTypeLabel.textContent = "Event Type"
    eventTypeLabel.className = "event-viewer-label"
    const eventTypeValue = document.createElement("div")
    eventTypeValue.textContent = eventName
    eventTypeValue.className = "event-viewer-value"
    eventTypeContainer.appendChild(eventTypeLabel)
    eventTypeContainer.appendChild(eventTypeValue)

    // Timestamp
    const timestampContainer = document.createElement("div")
    timestampContainer.className = "event-viewer-field"
    const timestampLabel = document.createElement("label")
    timestampLabel.textContent = "Timestamp"
    timestampLabel.className = "event-viewer-label"
    const timestampValue = document.createElement("div")
    timestampValue.textContent = timestamp
    timestampValue.className = "event-viewer-value"
    timestampContainer.appendChild(timestampLabel)
    timestampContainer.appendChild(timestampValue)

    metadataSection.appendChild(eventTypeContainer)
    metadataSection.appendChild(timestampContainer)

    // Event Data Label
    const dataLabelContainer = document.createElement("div")
    dataLabelContainer.className = "event-viewer-data-label"
    const dataLabel = document.createElement("label")
    dataLabel.textContent = "Event Data"
    dataLabel.className = "event-viewer-label"
    dataLabelContainer.appendChild(dataLabel)

    // Create viewer container
    const viewerContainer = document.createElement("div")
    viewerContainer.id = "event-codemirror-container"
    viewerContainer.className = "event-viewer-codemirror-container"

    // Create buttons
    const buttonContainer = document.createElement("div")
    buttonContainer.className = "event-viewer-buttons"

    const copyBtn = document.createElement("button")
    copyBtn.className = "event-viewer-button event-viewer-button-copy"
    copyBtn.innerHTML = "<span>📋</span> Copy"

    const closeBtn = document.createElement("button")
    closeBtn.className = "event-viewer-button event-viewer-button-close"
    closeBtn.innerHTML = "<span>✕</span> Close"

    buttonContainer.appendChild(copyBtn)
    buttonContainer.appendChild(closeBtn)

    // Assemble container
    container.appendChild(header)
    container.appendChild(metadataSection)
    container.appendChild(dataLabelContainer)
    container.appendChild(viewerContainer)
    container.appendChild(buttonContainer)
    backdrop.appendChild(container)

    // Append to shadow root for CSP isolation
    this.shadowRoot.appendChild(backdrop)
    document.body.appendChild(this.viewerHost)

    // The viewer is usually opened from the sidebar iframe, which keeps
    // keyboard focus. Move focus into the dialog so Escape reaches this
    // document, and remember where focus was so it can be restored on close.
    const active = document.activeElement
    this.previousFocus =
      active instanceof HTMLElement && active !== document.body ? active : null
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.close()
      } else if (e.key === "Tab") {
        this.keepTabInside(e, container)
      }
    }
    document.addEventListener("keydown", this.keydownHandler)
    container.focus({ preventScroll: true })

    // Create CodeMirror viewer (read-only)
    this.initTimer = setTimeout(() => {
      this.initTimer = null
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
          EditorState.readOnly.of(true) // Read-only state
        ]
      })

      this.editorView = new EditorView({
        state: startState,
        parent: viewerContainer
      })

      // Set up copy handler
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(jsonData)
          const originalHTML = copyBtn.innerHTML
          copyBtn.innerHTML = "<span>✓</span> Copied!"
          copyBtn.classList.add("event-viewer-button-success")

          setTimeout(() => {
            copyBtn.innerHTML = originalHTML
            copyBtn.classList.remove("event-viewer-button-success")
          }, 2000)
        } catch (err) {
          console.error("Failed to copy:", err)
          const originalHTML = copyBtn.innerHTML
          copyBtn.innerHTML = "<span>✗</span> Failed"

          setTimeout(() => {
            copyBtn.innerHTML = originalHTML
          }, 2000)
        }
      })

      // Set up close handlers
      closeBtn.addEventListener("click", () => {
        this.close()
      })

      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          this.close()
        }
      })
    }, 0)
  }

  // aria-modal: keep keyboard focus out of the page behind the dialog.
  private keepTabInside(e: KeyboardEvent, container: HTMLElement): void {
    if (!this.shadowRoot) return
    const focusable = Array.from(
      this.shadowRoot.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    )
    e.preventDefault()
    if (focusable.length === 0) {
      container.focus({ preventScroll: true })
      return
    }
    const active = this.shadowRoot.activeElement as HTMLElement | null
    const index = active ? focusable.indexOf(active) : -1
    const next = e.shiftKey
      ? index <= 0
        ? focusable.length - 1
        : index - 1
      : index === -1 || index === focusable.length - 1
        ? 0
        : index + 1
    focusable[next].focus({ preventScroll: true })
  }

  close(): void {
    this.teardown()
    // Notify extension that viewer was closed
    chrome.runtime.sendMessage({ type: "EVENT_VIEWER_CLOSE" })
  }

  private teardown(): void {
    // Closing before the deferred editor setup runs must not build an editor
    // into the removed dialog.
    if (this.initTimer !== null) {
      clearTimeout(this.initTimer)
      this.initTimer = null
    }

    if (this.editorView) {
      this.editorView.destroy()
      this.editorView = null
    }

    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler)
      this.keydownHandler = null
    }

    if (this.viewerHost) {
      const hadFocus = this.viewerHost.contains(document.activeElement)
      this.viewerHost.remove()
      this.viewerHost = null
      this.shadowRoot = null // Clear shadow root reference

      if (hadFocus && this.previousFocus?.isConnected) {
        this.previousFocus.focus({ preventScroll: true })
      }
    }
    this.previousFocus = null
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
        outline: none;
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

      .event-viewer-button-copy {
        background: #3a3a3a;
        color: #e0e0e0;
      }

      .event-viewer-button-copy:hover {
        background: #4a4a4a;
      }

      .event-viewer-button-success {
        background: #16825d !important;
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
