/**
 * Change Tracking for Visual Editor
 * Handles change tracking, undo/redo functionality, and DOM change persistence
 */

import StateManager from './state-manager'

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

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  trackChange(type: ChangeAction['type'], element: Element | null, data: any): void {
    const change: ChangeAction = {
      type,
      element,
      data,
      timestamp: Date.now(),
      id: this.generateChangeId()
    }

    // Add to changes list
    this.stateManager.addChange(change)

    // Create undo action
    const undoAction = this.createUndoAction(type, element, data)
    this.stateManager.pushUndo(undoAction)

    // Update UI counters
    this.updateChangesCounter()
    this.updateUndoRedoButtons()

    // Send change to extension background for persistence
    this.sendChangeToExtension(change)
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
        data,
        timestamp: Date.now(),
        id: this.generateChangeId()
      },
      undoData
    }
  }

  private createRedoAction(undoAction: UndoRedoAction): UndoRedoAction {
    return {
      type: 'redo',
      originalAction: undoAction.originalAction,
      undoData: undoAction.originalAction.data
    }
  }

  performUndo(): void {
    const undoAction = this.stateManager.popUndo()
    if (!undoAction) {
      return
    }

    const { originalAction, undoData } = undoAction

    switch (originalAction.type) {
      case 'edit':
        // Handle DOMChange-based undo (from visual-editor.ts addChange)
        if (undoData.selector) {
          const elements = document.querySelectorAll(undoData.selector)
          elements.forEach(element => {
            const htmlElement = element as HTMLElement
            if (undoData.type === 'text' && undoData.oldValue !== null) {
              htmlElement.textContent = undoData.oldValue
            } else if (undoData.type === 'html' && undoData.oldValue !== null) {
              htmlElement.innerHTML = undoData.oldValue
            } else if (undoData.type === 'style' && undoData.oldValue) {
              Object.assign(htmlElement.style, undoData.oldValue)
            }
          })
        }
        // Legacy: Handle element-based undo (for backwards compatibility)
        else if (undoData.element && undoData.restoreText !== undefined) {
          ;(undoData.element as HTMLElement).textContent = undoData.restoreText
        }
        break

      case 'editHtml':
        if (undoData.element && undoData.restoreHtml) {
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = undoData.restoreHtml
          const restoredElement = tempDiv.firstElementChild
          if (restoredElement) {
            undoData.element.replaceWith(restoredElement)
          }
        }
        break

      case 'hide':
        if (undoData.element) {
          ;(undoData.element as HTMLElement).style.display = undoData.restoreDisplay
        }
        break

      case 'delete':
        if (undoData.restoreHtml && undoData.parentElement) {
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = undoData.restoreHtml
          const restoredElement = tempDiv.firstElementChild
          if (restoredElement) {
            if (undoData.nextSibling) {
              undoData.parentElement.insertBefore(restoredElement, undoData.nextSibling)
            } else {
              undoData.parentElement.appendChild(restoredElement)
            }
          }
        }
        break

      case 'move':
        if (undoData.element && undoData.originalParent) {
          if (undoData.originalNextSibling) {
            undoData.originalParent.insertBefore(undoData.element, undoData.originalNextSibling)
          } else {
            undoData.originalParent.appendChild(undoData.element)
          }
        }
        break

      case 'resize':
        if (undoData.element && undoData.originalStyles) {
          Object.assign((undoData.element as HTMLElement).style, undoData.originalStyles)
        }
        break

      case 'insert':
        if (undoData.insertedElement) {
          undoData.insertedElement.remove()
        }
        break
    }

    // Push to redo stack
    const redoAction = this.createRedoAction(undoAction)
    this.stateManager.pushRedo(redoAction)

    this.updateUndoRedoButtons()
  }

  performRedo(): void {
    const redoAction = this.stateManager.popRedo()
    if (!redoAction) {
      return
    }

    const { originalAction, undoData } = redoAction

    // DEBUG: Log what we're about to redo
    document.body.setAttribute('data-redo-newvalue', String(originalAction.data.newValue || 'undefined'))

    // Re-apply the change from originalAction.data (which contains the NEW values)
    if (originalAction.type === 'edit' && originalAction.data.selector) {
      const elements = document.querySelectorAll(originalAction.data.selector)
      elements.forEach(element => {
        const htmlElement = element as HTMLElement
        if (originalAction.data.type === 'text' && originalAction.data.newValue !== undefined) {
          htmlElement.textContent = originalAction.data.newValue
        } else if (originalAction.data.type === 'html' && originalAction.data.newValue !== undefined) {
          htmlElement.innerHTML = originalAction.data.newValue
        } else if (originalAction.data.type === 'style' && originalAction.data.newValue) {
          Object.assign(htmlElement.style, originalAction.data.newValue)
        }
      })
    }
    // Legacy: Re-apply the original action for element-based redo
    else {
      this.reapplyAction(originalAction)
    }

    // Push back to undo stack
    const undoAction = this.createUndoAction(originalAction.type, originalAction.element, originalAction.data)
    this.stateManager.pushUndo(undoAction)

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
    const state = this.stateManager.getState()

    // Find undo/redo buttons in the banner
    const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
    if (!bannerHost?.shadowRoot) return

    const undoBtn = bannerHost.shadowRoot.querySelector('[data-action="undo"]') as HTMLButtonElement
    const redoBtn = bannerHost.shadowRoot.querySelector('[data-action="redo"]') as HTMLButtonElement

    if (undoBtn) {
      undoBtn.disabled = state.undoStack.length === 0
    }
    if (redoBtn) {
      redoBtn.disabled = state.redoStack.length === 0
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