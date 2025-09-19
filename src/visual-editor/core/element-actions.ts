import { generateRobustSelector } from '../utils/selector-generator'
import StateManager from './state-manager'
import ChangeTracker from './change-tracker'
import { Notifications } from '../ui/notifications'
import type { DOMChange } from '../types/visual-editor'

export interface ElementActionsOptions {
  onChangesUpdate: (changes: DOMChange[]) => void
  addChange?: (change: DOMChange) => void
}

/**
 * ElementActions handles all element manipulation operations in the visual editor.
 * This includes selection, hiding, deleting, copying, moving elements and more.
 */
export class ElementActions {
  private stateManager: StateManager
  private changeTracker: ChangeTracker
  private notifications: Notifications
  private options: ElementActionsOptions
  private changes: DOMChange[] = []

  // UI state
  private selectedElement: HTMLElement | null = null
  private hoveredElement: HTMLElement | null = null
  private hoverTooltip: HTMLElement | null = null

  constructor(
    stateManager: StateManager,
    changeTracker: ChangeTracker,
    notifications: Notifications,
    options: ElementActionsOptions
  ) {
    this.stateManager = stateManager
    this.changeTracker = changeTracker
    this.notifications = notifications
    this.options = options

    // Initialize changes from state
    this.changes = stateManager.getState().changes || []

    // Listen to state changes to keep local state in sync
    this.stateManager.onStateChange((state) => {
      this.selectedElement = state.selectedElement as HTMLElement | null
      this.hoveredElement = state.hoveredElement as HTMLElement | null
      this.changes = state.changes || []
    })
  }

  // Element selection methods
  public selectElement(element: HTMLElement): void {
    if (this.selectedElement) {
      this.selectedElement.classList.remove('absmartly-selected')
    }

    this.selectedElement = element
    element.classList.add('absmartly-selected')
    this.stateManager.setSelectedElement(element)
  }

  public deselectElement(): void {
    if (this.selectedElement) {
      this.selectedElement.classList.remove('absmartly-selected')
      this.selectedElement = null
    }
    this.stateManager.setSelectedElement(null)
  }

  // Hover tooltip methods
  public showHoverTooltip(element: HTMLElement, x: number, y: number): void {
    this.removeHoverTooltip()

    this.hoverTooltip = document.createElement('div')
    this.hoverTooltip.className = 'absmartly-hover-tooltip'
    this.hoverTooltip.textContent = this.getSelector(element)

    const tooltipX = Math.min(x + 10, window.innerWidth - 200)
    const tooltipY = y - 30

    this.hoverTooltip.style.left = `${tooltipX}px`
    this.hoverTooltip.style.top = `${tooltipY}px`

    document.body.appendChild(this.hoverTooltip)
  }

  public removeHoverTooltip(): void {
    if (this.hoverTooltip) {
      this.hoverTooltip.remove()
      this.hoverTooltip = null
    }
  }

  // Element manipulation methods
  public hideElement(): void {
    if (!this.selectedElement) return

    try {
      this.selectedElement.style.display = 'none'
      this.addChange({
        selector: this.getSelector(this.selectedElement),
        type: 'style',
        value: { display: 'none' },
        enabled: true
      })
      this.deselectElement()
    } catch (error) {
      console.error('Failed to hide element:', error)
      this.notifications.show('Failed to hide element', '', 'error')
    }
  }

  public deleteElement(): void {
    if (!this.selectedElement) return

    const selector = this.getSelector(this.selectedElement)
    this.selectedElement.remove()

    this.addChange({
      selector: selector,
      type: 'delete',
      value: null,
      enabled: true
    })

    this.deselectElement()
  }

  public copyElement(): void {
    if (!this.selectedElement) return

    try {
      const html = this.selectedElement.outerHTML
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(html).then(() => {
          this.notifications.show('Element HTML copied to clipboard!', '', 'success')
        }).catch((error) => {
          console.error('Failed to copy to clipboard:', error)
          this.notifications.show('Failed to copy to clipboard', '', 'error')
        })
      } else {
        this.notifications.show('Clipboard not available', '', 'error')
      }
    } catch (error) {
      console.error('Failed to copy element:', error)
      this.notifications.show('Failed to copy element', '', 'error')
    }
  }

  public copySelectorPath(): void {
    if (!this.selectedElement) return

    try {
      const selector = this.getSelector(this.selectedElement)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(selector).then(() => {
          this.notifications.show(`Selector copied: ${selector}`, '', 'success')
        }).catch((error) => {
          console.error('Failed to copy selector to clipboard:', error)
          this.notifications.show('Failed to copy selector to clipboard', '', 'error')
        })
      } else {
        this.notifications.show('Clipboard not available', '', 'error')
      }
    } catch (error) {
      console.error('Failed to copy selector:', error)
      this.notifications.show('Failed to copy selector', '', 'error')
    }
  }

  public moveElement(direction: 'up' | 'down'): void {
    if (!this.selectedElement) return

    const parent = this.selectedElement.parentElement
    if (!parent) return

    if (direction === 'up' && this.selectedElement.previousElementSibling) {
      parent.insertBefore(this.selectedElement, this.selectedElement.previousElementSibling)
    } else if (direction === 'down' && this.selectedElement.nextElementSibling) {
      parent.insertBefore(this.selectedElement.nextElementSibling, this.selectedElement)
    }

    this.addChange({
      selector: this.getSelector(this.selectedElement),
      type: 'move',
      value: direction,
      enabled: true
    })
  }

  public insertNewBlock(): void {
    // Placeholder - will implement comprehensive insert dialog
    this.notifications.show('Insert new block: Coming soon!', '', 'info')
  }

  public showRelativeElementSelector(): void {
    // Placeholder - will implement relative element highlighting
    this.notifications.show('Select relative elements: Coming soon!', '', 'info')
  }

  // Change management methods
  public undoLastChange(): void {
    console.log('[ElementActions] undoLastChange called')
    const undoItem = this.stateManager.popUndo()
    if (!undoItem) {
      console.log('[ElementActions] No undo items available')
      return
    }

    console.log('[ElementActions] Performing undo:', undoItem)

    if (undoItem.type === 'add') {
      // Remove the added change
      this.changes.splice(undoItem.index, 1)
    } else if (undoItem.type === 'update') {
      // Restore the old change
      this.changes[undoItem.index] = undoItem.change
    } else if (undoItem.type === 'remove') {
      // Re-add the removed change
      this.changes.splice(undoItem.index, 0, undoItem.change)
    }

    console.log('[ElementActions] Changes after undo:', this.changes.length)
    this.stateManager.setChanges(this.changes)
    this.options.onChangesUpdate(this.changes)
    this.notifications.show('Change undone', '', 'success')
  }

  public redoChange(): void {
    console.log('[ElementActions] redoChange called')
    const redoItem = this.stateManager.popRedo()
    if (!redoItem) {
      console.log('[ElementActions] No redo items available')
      return
    }

    console.log('[ElementActions] Performing redo:', redoItem)

    if (redoItem.type === 'add') {
      // Re-add the change
      this.changes.splice(redoItem.index, 0, redoItem.change)
    } else if (redoItem.type === 'update') {
      // Apply the new change
      const oldChange = { ...this.changes[redoItem.index] }
      this.changes[redoItem.index] = redoItem.change
      redoItem.change = oldChange // Swap for next undo
    } else if (redoItem.type === 'remove') {
      // Remove the change again
      this.changes.splice(redoItem.index, 1)
    }

    // Push back to undo stack
    this.stateManager.pushUndo(redoItem)

    console.log('[ElementActions] Changes after redo:', this.changes.length)
    this.stateManager.setChanges(this.changes)
    this.options.onChangesUpdate(this.changes)
    this.notifications.show('Change redone', '', 'success')
  }

  public clearAllChanges(): void {
    if (confirm('Are you sure you want to clear all changes?')) {
      this.changes = []
      this.stateManager.setChanges(this.changes)
      this.options.onChangesUpdate(this.changes)
      this.notifications.show('All changes cleared', '', 'success')
    }
  }

  // Utility methods
  public getSelector(element: HTMLElement): string {
    return generateRobustSelector(element, {
      preferDataAttributes: false,
      avoidAutoGenerated: true,
      includeParentContext: true,
      maxParentLevels: 3
    })
  }

  public isExtensionElement(element: HTMLElement): boolean {
    let current: HTMLElement | null = element
    while (current) {
      const id = current.id || ''
      const className = typeof current.className === 'string'
        ? current.className
        : (current.className as any)?.baseVal || ''

      if (id.includes('absmartly') || className.includes('absmartly')) {
        return true
      }

      current = current.parentElement
    }
    return false
  }

  // Private methods
  private addChange(change: DOMChange): void {
    console.log('[ElementActions] addChange called with:', change)

    // If we have an addChange callback from visual editor, use it
    // This ensures proper undo/redo stack management
    if (this.options.addChange) {
      console.log('[ElementActions] Delegating to visual editor addChange')
      this.options.addChange(change)
    } else {
      // Fallback: manage changes locally (for standalone use)
      console.log('[ElementActions] Managing change locally')
      console.log('[ElementActions] Current changes count:', this.changes.length)

      const existingIndex = this.changes.findIndex(c =>
        c.selector === change.selector && c.type === change.type
      )

      if (existingIndex >= 0) {
        // Store old change for undo
        const oldChange = { ...this.changes[existingIndex] }

        if (change.type === 'style' && this.changes[existingIndex].type === 'style') {
          this.changes[existingIndex].value = {
            ...this.changes[existingIndex].value,
            ...change.value
          }
        } else {
          this.changes[existingIndex] = change
        }

        // Add to undo stack
        this.stateManager.pushUndo({
          type: 'update',
          change: oldChange,
          index: existingIndex
        })
      } else {
        this.changes.push(change)

        // Add to undo stack
        this.stateManager.pushUndo({
          type: 'add',
          change: change,
          index: this.changes.length - 1
        })
      }

      console.log('[ElementActions] New changes count:', this.changes.length)
      console.log('[ElementActions] Setting changes in state manager')
      this.stateManager.setChanges(this.changes)

      console.log('[ElementActions] Calling onChangesUpdate callback')
      this.options.onChangesUpdate(this.changes)
    }
  }
}