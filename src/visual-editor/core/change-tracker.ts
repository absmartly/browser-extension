/**
 * Change Tracking for Visual Editor
 * Handles change tracking, undo/redo functionality, and DOM change persistence
 */

import StateManager from './state-manager'
import UndoRedoManager from './undo-redo-manager'
import type { DOMChange } from '../types/visual-editor'

export interface ChangeAction {
  type: 'edit' | 'editHtml' | 'hide' | 'delete' | 'move' | 'resize' | 'insert'
  element: Element | null
  data: any
  timestamp: number
  id: string
}

export interface UndoRedoAction {
  type: 'undo' | 'redo'
  originalAction: ChangeAction
  undoData: any
}

export class ChangeTracker {
  private stateManager: StateManager
  private undoRedoManager: UndoRedoManager

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
    this.undoRedoManager = new UndoRedoManager()
  }

  trackChange(type: ChangeAction['type'], element: Element | null, data: any): void {
    // Convert the change data to DOMChange format for UndoRedoManager
    console.log('[ChangeTracker] trackChange called with data:', data)
    console.log('[ChangeTracker] Checks:', {
      hasSelector: !!data.selector,
      hasType: !!data.type,
      hasNewValue: 'newValue' in data,
      hasOldValue: 'oldValue' in data
    })

    if (data.selector && data.type && 'newValue' in data && 'oldValue' in data) {
      const domChange: DOMChange = {
        selector: data.selector,
        type: data.type,
        value: data.newValue,
        enabled: true
      }

      console.log('[ChangeTracker] Adding change to UndoRedoManager:', domChange, 'oldValue:', data.oldValue)
      // Add to UndoRedoManager with old value
      this.undoRedoManager.addChange(domChange, data.oldValue)

      // Add to changes list for tracking
      const change: ChangeAction = {
        type,
        element,
        data,
        timestamp: Date.now(),
        id: this.generateChangeId()
      }
      this.stateManager.addChange(change)

      // Update UI counters
      this.updateChangesCounter()
      this.updateUndoRedoButtons()

      // Send change to extension background for persistence
      this.sendChangeToExtension(change)
    }
  }

  private createUndoAction(type: ChangeAction['type'], element: Element | null, data: any): UndoRedoAction {
    const undoData: any = {}

    switch (type) {
      case 'edit':
        // Handle both DOMChange-based (selector + oldValue) and legacy (element + oldText) formats
        if (data.selector) {
          // DOMChange format from visual-editor.ts addChange
          undoData.selector = data.selector
          undoData.type = data.type
          undoData.oldValue = data.oldValue
        } else {
          // Legacy format
          undoData.restoreText = data.oldText
          undoData.element = element
        }
        break

      case 'editHtml':
        undoData.restoreHtml = data.oldHtml
        undoData.element = element
        break

      case 'hide':
        undoData.restoreDisplay = 'block' // Default restoration
        undoData.element = element
        break

      case 'delete':
        undoData.restoreHtml = data.deletedHtml
        undoData.parentElement = data.parent
        undoData.nextSibling = data.nextSibling
        break

      case 'move':
        undoData.originalParent = data.originalParent
        undoData.originalNextSibling = data.originalNextSibling
        undoData.element = element
        break

      case 'resize':
        undoData.originalStyles = data.originalStyles
        undoData.element = element
        break

      case 'insert':
        undoData.insertedElement = element
        break
    }

    return {
      type: 'undo',
      originalAction: {
        type,
        element,
        data: JSON.parse(JSON.stringify(data)), // Deep copy to avoid reference issues
        timestamp: Date.now(),
        id: this.generateChangeId()
      },
      undoData: JSON.parse(JSON.stringify(undoData)) // Deep copy undoData too
    }
  }

  private createRedoAction(undoAction: UndoRedoAction): UndoRedoAction {
    return {
      type: 'redo',
      originalAction: JSON.parse(JSON.stringify(undoAction.originalAction)), // Deep copy
      undoData: JSON.parse(JSON.stringify(undoAction.originalAction.data)) // Deep copy
    }
  }

  performUndo(): void {
    const record = this.undoRedoManager.undo()
    if (!record) {
      return
    }

    const { change, oldValue } = record

    // Apply the undo by reverting to old value
    const elements = document.querySelectorAll(change.selector)
    elements.forEach(element => {
      const htmlElement = element as HTMLElement
      if (change.type === 'text' && oldValue !== null) {
        htmlElement.textContent = oldValue
      } else if (change.type === 'html' && oldValue !== null) {
        htmlElement.innerHTML = oldValue
      } else if (change.type === 'style' && oldValue) {
        Object.assign(htmlElement.style, oldValue)
      }
    })

    this.updateUndoRedoButtons()
  }

  performRedo(): void {
    const record = this.undoRedoManager.redo()
    if (!record) {
      return
    }

    const { change } = record

    // Re-apply the change
    const elements = document.querySelectorAll(change.selector)
    elements.forEach(element => {
      const htmlElement = element as HTMLElement
      if (change.type === 'text' && change.value !== undefined) {
        htmlElement.textContent = change.value
      } else if (change.type === 'html' && change.value !== undefined) {
        htmlElement.innerHTML = change.value
      } else if (change.type === 'style' && change.value) {
        Object.assign(htmlElement.style, change.value)
      }
    })

    this.updateUndoRedoButtons()
  }

  private reapplyAction(action: ChangeAction): void {
    switch (action.type) {
      case 'edit':
        if (action.element && action.data.newText !== undefined) {
          ;(action.element as HTMLElement).textContent = action.data.newText
        }
        break

      case 'editHtml':
        if (action.element && action.data.newHtml) {
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = action.data.newHtml
          const newElement = tempDiv.firstElementChild
          if (newElement) {
            action.element.replaceWith(newElement)
          }
        }
        break

      case 'hide':
        if (action.element) {
          ;(action.element as HTMLElement).style.display = 'none'
        }
        break

      case 'delete':
        if (action.element) {
          action.element.remove()
        }
        break

      // Other actions would be handled similarly
    }
  }

  private updateUndoRedoButtons(): void {
    // Find undo/redo buttons in the banner
    const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
    if (!bannerHost?.shadowRoot) return

    const undoBtn = bannerHost.shadowRoot.querySelector('[data-action="undo"]') as HTMLButtonElement
    const redoBtn = bannerHost.shadowRoot.querySelector('[data-action="redo"]') as HTMLButtonElement

    if (undoBtn) {
      undoBtn.disabled = !this.undoRedoManager.canUndo()
    }
    if (redoBtn) {
      redoBtn.disabled = !this.undoRedoManager.canRedo()
    }
  }

  private updateChangesCounter(): void {
    const state = this.stateManager.getState()

    // Find changes counter in the banner
    const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
    if (!bannerHost?.shadowRoot) return

    const counter = bannerHost.shadowRoot.querySelector('.changes-counter')
    if (counter) {
      counter.textContent = `${state.changes.length} changes`
    }
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private sendChangeToExtension(change: ChangeAction): void {
    // Send change data to extension background for persistence
    window.postMessage({
      type: 'ABSMARTLY_VISUAL_EDITOR_CHANGE',
      change: {
        type: change.type,
        selector: change.element ? this.generateSelector(change.element) : null,
        data: change.data,
        timestamp: change.timestamp,
        id: change.id
      }
    }, '*')
  }

  private generateSelector(element: Element): string {
    // Use the same selector generation logic
    try {
      // For now, use a simple approach - this should use the generateRobustSelector
      if (element.id) return `#${element.id}`
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c.trim()).slice(0, 2)
        return `.${classes.join('.')}`
      }
      return element.tagName.toLowerCase()
    } catch (e) {
      return element.tagName.toLowerCase()
    }
  }

  // Export changes for persistence
  exportChanges(): ChangeAction[] {
    return this.stateManager.getState().changes
  }

  // Import changes (for restoration)
  importChanges(changes: ChangeAction[]): void {
    this.stateManager.setChanges(changes)
    this.updateChangesCounter()
  }
}

export default ChangeTracker