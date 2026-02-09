/**
 * Toolbar UI Component
 * Provides a floating toolbar with actions and information
 */

import StateManager from '../core/state-manager'

import { debugLog, debugWarn } from '~src/utils/debug'
export class Toolbar {
  private stateManager: StateManager
  private toolbar: HTMLElement | null = null
  private changesCounter: HTMLElement | null = null
  private undoButton: HTMLElement | null = null
  private redoButton: HTMLElement | null = null

  // Callback functions to be set by the main visual editor
  onUndo: () => void = () => debugLog('[Toolbar] Undo callback not set')
  onRedo: () => void = () => debugLog('[Toolbar] Redo callback not set')
  onClear: () => void = () => debugLog('[Toolbar] Clear callback not set')
  onSave: () => void = () => debugLog('[Toolbar] Save callback not set')
  onExit: () => void = () => debugLog('[Toolbar] Exit callback not set')

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  private shadowHost: HTMLElement | null = null
  private shadowRoot: ShadowRoot | null = null

  create(): void {
    debugLog('[Toolbar] Creating toolbar')
    console.error('[Toolbar] Create called - this should appear in console')
    console.trace('[Toolbar] Create called from:')

    // Also add a visual indicator that this code ran
    const debugMarker = document.createElement('div')
    debugMarker.id = 'absmartly-toolbar-debug-marker'
    debugMarker.textContent = 'Toolbar create() was called at ' + new Date().toISOString()
    debugMarker.style.display = 'none'
    document.body.appendChild(debugMarker)

    if (this.toolbar) {
      debugLog('[Toolbar] Toolbar already exists, removing old one')
      this.remove()
    }

    // Create Shadow DOM host for complete isolation from page styles
    this.shadowHost = document.createElement('div')
    this.shadowHost.id = 'absmartly-visual-editor-toolbar-host'
    this.shadowHost.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;'

    // Attach shadow root (closed mode for better encapsulation)
    this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' })

    this.toolbar = document.createElement('div')
    this.toolbar.className = 'absmartly-toolbar'
    this.toolbar.id = 'absmartly-visual-editor-toolbar'
    this.toolbar.setAttribute('data-absmartly', 'toolbar')

    // Apply styles directly without !important
    this.toolbar.style.position = 'fixed'
    this.toolbar.style.top = '20px'
    this.toolbar.style.right = '20px'
    this.toolbar.style.background = 'white'
    this.toolbar.style.border = '2px solid #3b82f6'
    this.toolbar.style.borderRadius = '12px'
    this.toolbar.style.padding = '12px'
    this.toolbar.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'
    this.toolbar.style.display = 'flex'
    this.toolbar.style.flexDirection = 'column'
    this.toolbar.style.gap = '8px'
    this.toolbar.style.fontFamily = 'system-ui, -apple-system, sans-serif'
    this.toolbar.style.fontSize = '14px'
    this.toolbar.style.maxWidth = '320px'
    this.toolbar.style.minWidth = '280px'
    this.toolbar.style.pointerEvents = 'auto'
    this.toolbar.style.userSelect = 'none'
    this.toolbar.style.zIndex = '2147483647'

    const config = this.stateManager.getConfig()

    this.toolbar.innerHTML = `
      <div class="absmartly-toolbar-header" style="
        font-weight: 600;
        padding: 4px 8px;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span>Visual Editor</span>
        <span class="absmartly-changes-count" style="
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        ">0</span>
      </div>
      <div class="absmartly-toolbar-instructions" style="
        background: #eff6ff;
        padding: 10px;
        border-radius: 6px;
        font-size: 12px;
        line-height: 1.6;
        color: #1e40af;
        border: 1px solid #93c5fd;
      ">
        <strong style="color: #1e3a8a; font-weight: 600;">How to use:</strong><br>
        • <strong style="color: #1e3a8a; font-weight: 600;">Click</strong> any element to select & edit<br>
        • Menu opens automatically on selection<br>
        • Selected elements have blue outline<br>
        • Press <strong style="color: #1e3a8a; font-weight: 600;">ESC</strong> to deselect
      </div>
      <button class="absmartly-toolbar-button" data-action="undo" style="
        padding: 8px 12px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s;
        color: #1f2937;
      ">↶ Undo Last Change</button>
      <button class="absmartly-toolbar-button" data-action="redo" style="
        padding: 8px 12px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s;
        color: #1f2937;
      ">↷ Redo Change</button>
      <button class="absmartly-toolbar-button" data-action="clear" style="
        padding: 8px 12px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s;
        color: #1f2937;
      ">Clear All Changes</button>
      <button class="absmartly-toolbar-button primary" data-action="save" style="
        padding: 8px 12px;
        background: #3b82f6;
        color: white;
        border: 1px solid #3b82f6;
        border-radius: 6px;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s;
      ">Save Changes</button>
      <button class="absmartly-toolbar-button danger" data-action="exit" style="
        padding: 8px 12px;
        background: #ef4444;
        color: white;
        border: 1px solid #ef4444;
        border-radius: 6px;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s;
      ">Exit Editor</button>
    `

    // Store references to key elements
    this.changesCounter = this.toolbar.querySelector('.absmartly-changes-count')
    this.undoButton = this.toolbar.querySelector('[data-action="undo"]')
    this.redoButton = this.toolbar.querySelector('[data-action="redo"]')

    // Add hover effects via CSS inside shadow root
    const style = document.createElement('style')
    style.id = 'absmartly-toolbar-styles'
    style.textContent = `
      .absmartly-toolbar-button:hover {
        background: #e5e7eb;
      }
      .absmartly-toolbar-button.primary:hover {
        background: #2563eb;
      }
      .absmartly-toolbar-button.danger:hover {
        background: #dc2626;
      }
    `
    this.shadowRoot!.appendChild(style)

    // Append toolbar to shadow root (not to main DOM)
    this.shadowRoot!.appendChild(this.toolbar)

    // Append shadow host to document body
    document.body.appendChild(this.shadowHost!)
    debugLog('[Toolbar] Toolbar added to Shadow DOM')

    // Verify shadow host is in DOM
    const verifyShadowHost = document.getElementById('absmartly-visual-editor-toolbar-host')
    if (verifyShadowHost) {
      debugLog('[Toolbar] Verified: Shadow host found in DOM')
      debugLog('[Toolbar] Toolbar is now isolated in Shadow DOM, protected from page styles')
    } else {
      console.error('[Toolbar] ERROR: Shadow host not found in DOM after appendChild!')
    }

    // Add event listeners
    this.toolbar.addEventListener('click', this.handleToolbarClick)
    debugLog('[Toolbar] Event listeners attached')
  }

  remove(): void {
    debugLog('[Toolbar] Remove called')
    console.trace('[Toolbar] Remove stack trace:')

    if (this.shadowHost) {
      this.shadowHost.remove()
      this.shadowHost = null
      this.shadowRoot = null
      this.toolbar = null
      this.changesCounter = null
      this.undoButton = null
      this.redoButton = null
    }

    // Note: Styles are inside shadow root and removed automatically with shadowHost
  }

  updateChangesCount(count: number): void {
    if (this.changesCounter) {
      this.changesCounter.textContent = String(count)
    }
  }

  updateUndoRedoButtons(canUndo: boolean, canRedo: boolean): void {
    if (this.undoButton) {
      this.undoButton.style.opacity = canUndo ? '1' : '0.5'
      ;(this.undoButton as HTMLButtonElement).disabled = !canUndo
    }
    if (this.redoButton) {
      this.redoButton.style.opacity = canRedo ? '1' : '0.5'
      ;(this.redoButton as HTMLButtonElement).disabled = !canRedo
    }
  }

  private handleToolbarClick = (e: MouseEvent) => {
    debugLog('[Toolbar] Click detected on:', e.target)
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    const target = e.target as HTMLElement
    const action = target.getAttribute('data-action')
    debugLog('[Toolbar] Action:', action)

    switch (action) {
      case 'undo':
        this.onUndo()
        break
      case 'redo':
        this.onRedo()
        break
      case 'clear':
        this.onClear()
        break
      case 'save':
        this.onSave()
        break
      case 'exit':
        this.onExit()
        break
    }
  }
}