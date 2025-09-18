/**
 * Toolbar UI Component
 * Provides a floating toolbar with actions and information
 */

import StateManager from '../core/state-manager'

export class Toolbar {
  private stateManager: StateManager
  private toolbar: HTMLElement | null = null
  private changesCounter: HTMLElement | null = null
  private undoButton: HTMLElement | null = null
  private redoButton: HTMLElement | null = null

  // Callback functions to be set by the main visual editor
  onUndo: () => void = () => console.log('[Toolbar] Undo callback not set')
  onRedo: () => void = () => console.log('[Toolbar] Redo callback not set')
  onClear: () => void = () => console.log('[Toolbar] Clear callback not set')
  onSave: () => void = () => console.log('[Toolbar] Save callback not set')
  onExit: () => void = () => console.log('[Toolbar] Exit callback not set')

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  create(): void {
    if (this.toolbar) return

    this.toolbar = document.createElement('div')
    this.toolbar.className = 'absmartly-toolbar'
    this.toolbar.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: white !important;
      border: 2px solid #3b82f6 !important;
      border-radius: 12px !important;
      padding: 12px !important;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
      z-index: 2147483646 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      font-size: 14px !important;
      max-width: 320px !important;
      pointer-events: auto !important;
      user-select: none !important;
    `

    const config = this.stateManager.getConfig()

    this.toolbar.innerHTML = `
      <div class="absmartly-toolbar-header" style="
        font-weight: 600 !important;
        padding: 4px 8px !important;
        border-bottom: 1px solid #e5e7eb !important;
        margin-bottom: 4px !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
      ">
        <span>Visual Editor</span>
        <span class="absmartly-changes-count" style="
          background: #3b82f6 !important;
          color: white !important;
          padding: 2px 8px !important;
          border-radius: 12px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
        ">0</span>
      </div>
      <div class="absmartly-toolbar-instructions" style="
        background: #eff6ff !important;
        padding: 10px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        line-height: 1.6 !important;
        color: #1e40af !important;
        border: 1px solid #93c5fd !important;
      ">
        <strong style="color: #1e3a8a !important; font-weight: 600 !important;">How to use:</strong><br>
        • <strong style="color: #1e3a8a !important; font-weight: 600 !important;">Click</strong> any element to select & edit<br>
        • Menu opens automatically on selection<br>
        • Selected elements have blue outline<br>
        • Press <strong style="color: #1e3a8a !important; font-weight: 600 !important;">ESC</strong> to deselect
      </div>
      <button class="absmartly-toolbar-button" data-action="undo" style="
        padding: 8px 12px !important;
        background: #f3f4f6 !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        text-align: center !important;
        transition: all 0.15s !important;
        color: #1f2937 !important;
      ">↶ Undo Last Change</button>
      <button class="absmartly-toolbar-button" data-action="redo" style="
        padding: 8px 12px !important;
        background: #f3f4f6 !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        text-align: center !important;
        transition: all 0.15s !important;
        color: #1f2937 !important;
      ">↷ Redo Change</button>
      <button class="absmartly-toolbar-button" data-action="clear" style="
        padding: 8px 12px !important;
        background: #f3f4f6 !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        text-align: center !important;
        transition: all 0.15s !important;
        color: #1f2937 !important;
      ">Clear All Changes</button>
      <button class="absmartly-toolbar-button primary" data-action="save" style="
        padding: 8px 12px !important;
        background: #3b82f6 !important;
        color: white !important;
        border: 1px solid #3b82f6 !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        text-align: center !important;
        transition: all 0.15s !important;
      ">Save Changes</button>
      <button class="absmartly-toolbar-button danger" data-action="exit" style="
        padding: 8px 12px !important;
        background: #ef4444 !important;
        color: white !important;
        border: 1px solid #ef4444 !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        text-align: center !important;
        transition: all 0.15s !important;
      ">Exit Editor</button>
    `

    // Store references to key elements
    this.changesCounter = this.toolbar.querySelector('.absmartly-changes-count')
    this.undoButton = this.toolbar.querySelector('[data-action="undo"]')
    this.redoButton = this.toolbar.querySelector('[data-action="redo"]')

    // Add hover effects via CSS
    const style = document.createElement('style')
    style.textContent = `
      .absmartly-toolbar-button:hover {
        background: #e5e7eb !important;
      }
      .absmartly-toolbar-button.primary:hover {
        background: #2563eb !important;
      }
      .absmartly-toolbar-button.danger:hover {
        background: #dc2626 !important;
      }
    `
    document.head.appendChild(style)

    document.body.appendChild(this.toolbar)

    // Add event listeners
    this.toolbar.addEventListener('click', this.handleToolbarClick)
  }

  remove(): void {
    if (this.toolbar) {
      this.toolbar.remove()
      this.toolbar = null
      this.changesCounter = null
      this.undoButton = null
      this.redoButton = null
    }
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
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    const target = e.target as HTMLElement
    const action = target.getAttribute('data-action')

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