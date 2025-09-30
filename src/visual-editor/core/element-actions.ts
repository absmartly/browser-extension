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

    // Store element's HTML and position info for undo
    const elementHTML = this.selectedElement.outerHTML
    const parent = this.selectedElement.parentElement
    const nextSibling = this.selectedElement.nextElementSibling

    // Generate selectors for parent and next sibling for restoration
    let parentSelector = null
    let nextSiblingSelector = null

    if (parent) {
      parentSelector = this.getSelector(parent)
      if (nextSibling) {
        nextSiblingSelector = this.getSelector(nextSibling as HTMLElement)
      }
    }

    // Now remove the element
    this.selectedElement.remove()

    this.addChange({
      selector: selector,
      type: 'delete',
      value: {
        html: elementHTML,
        parentSelector: parentSelector,
        nextSiblingSelector: nextSiblingSelector
      },
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

  // Helper to revert a DOM change
  private revertDOMChange(change: DOMChange): void {
    console.log('[ElementActions] Reverting DOM change:', change)

    try {
      const elements = document.querySelectorAll(change.selector)

      elements.forEach(element => {
        const htmlElement = element as HTMLElement

        switch (change.type) {
          case 'move':
            // Revert move by moving element back to original position
            if (change.value?.originalTargetSelector && change.value?.originalPosition) {
              const originalTarget = document.querySelector(change.value.originalTargetSelector)
              if (originalTarget) {
                const parent = originalTarget.parentElement
                if (parent) {
                  if (change.value.originalPosition === 'before') {
                    parent.insertBefore(htmlElement, originalTarget)
                  } else if (change.value.originalPosition === 'after') {
                    parent.insertBefore(htmlElement, originalTarget.nextSibling)
                  } else if (change.value.originalPosition === 'firstChild') {
                    originalTarget.insertBefore(htmlElement, originalTarget.firstChild)
                  } else if (change.value.originalPosition === 'lastChild') {
                    originalTarget.appendChild(htmlElement)
                  }
                  console.log('[ElementActions] Moved element back to original position')
                }
              }
            }
            break

          case 'text':
            // Check for original text in dataset
            const originalData = htmlElement.dataset.absmartlyOriginal ?
              JSON.parse(htmlElement.dataset.absmartlyOriginal) : null
            if (originalData?.text !== undefined) {
              htmlElement.textContent = originalData.text
              console.log('[ElementActions] Reverted text content')
            }
            break

          case 'style':
            // Revert to original styles
            const styleOrigData = htmlElement.dataset.absmartlyOriginal ?
              JSON.parse(htmlElement.dataset.absmartlyOriginal) : null
            if (styleOrigData?.styles && change.value && typeof change.value === 'object') {
              // Restore original values for changed properties
              for (const prop in change.value) {
                if (styleOrigData.styles[prop] !== undefined) {
                  (htmlElement.style as any)[prop] = styleOrigData.styles[prop] || ''
                } else {
                  // If no original value was stored, clear the property
                  (htmlElement.style as any)[prop] = ''
                }
              }
              console.log('[ElementActions] Reverted style changes to original values')
            } else if (change.value && typeof change.value === 'object') {
              // Fallback: just remove the styles if no original data
              for (const prop in change.value) {
                (htmlElement.style as any)[prop] = ''
              }
              console.log('[ElementActions] Removed style changes (no original data)')
            }
            break

          case 'html':
            // Revert HTML content
            const origData = htmlElement.dataset.absmartlyOriginal ?
              JSON.parse(htmlElement.dataset.absmartlyOriginal) : null
            if (origData?.html !== undefined) {
              htmlElement.innerHTML = origData.html
              console.log('[ElementActions] Reverted HTML content')
            }
            break

          case 'delete':
            // Can't revert delete on existing element since it was removed
            // This case is handled separately below
            break
        }
      })

      // Special handling for delete - need to restore the element
      if (change.type === 'delete' && change.value) {
        const { html, parentSelector, nextSiblingSelector } = change.value

        if (html && parentSelector) {
          const parent = document.querySelector(parentSelector) as HTMLElement

          if (parent) {
            // Create a temporary div to parse the HTML
            const temp = document.createElement('div')
            temp.innerHTML = html
            const elementToRestore = temp.firstElementChild as HTMLElement

            if (elementToRestore) {
              if (nextSiblingSelector) {
                const nextSibling = document.querySelector(nextSiblingSelector)
                if (nextSibling && nextSibling.parentElement === parent) {
                  parent.insertBefore(elementToRestore, nextSibling)
                } else {
                  parent.appendChild(elementToRestore)
                }
              } else {
                parent.appendChild(elementToRestore)
              }
              console.log('[ElementActions] Restored deleted element')
            }
          }
        }
      }
    } catch (error) {
      console.error('[ElementActions] Error reverting DOM change:', error)
    }
  }

  // Change management methods
  public undoLastChange(): void {
    console.log('[ElementActions] undoLastChange called')

    // Get the current changes from state manager (source of truth)
    const currentChanges = [...this.stateManager.getState().changes || []]
    const undoItem = this.stateManager.popUndo()

    if (!undoItem) {
      console.log('[ElementActions] No undo items available')
      this.notifications.show('Nothing to undo', '', 'info')
      return
    }

    console.log('[ElementActions] Performing undo:', undoItem)
    console.log('[ElementActions] Current changes before undo:', currentChanges.length)

    if (undoItem.type === 'add') {
      // Revert the DOM change that was added
      const changeToRevert = undoItem.change
      this.revertDOMChange(changeToRevert)

      // Remove the added change from array
      currentChanges.splice(undoItem.index, 1)
      // Push to redo stack
      this.stateManager.pushRedo(undoItem)
    } else if (undoItem.type === 'update') {
      // TODO: Handle update undo (revert to previous version of change)
      const currentChange = currentChanges[undoItem.index]
      currentChanges[undoItem.index] = undoItem.change
      // Push current state to redo with swapped change
      this.stateManager.pushRedo({
        ...undoItem,
        change: currentChange
      })
    } else if (undoItem.type === 'remove') {
      // Re-add the removed change
      currentChanges.splice(undoItem.index, 0, undoItem.change)
      // Push to redo stack
      this.stateManager.pushRedo(undoItem)
    }

    console.log('[ElementActions] Changes after undo:', currentChanges.length)

    // Update both local and state manager changes
    this.changes = currentChanges
    this.stateManager.setChanges(currentChanges)

    // Don't call onChangesUpdate here - that would save to sidebar
    // The visual editor will handle updating the UI

    this.notifications.show('Change undone', '', 'success')
  }

  // Helper to apply a DOM change
  private applyDOMChange(change: DOMChange): void {
    console.log('[ElementActions] Applying DOM change:', change)

    try {
      const elements = document.querySelectorAll(change.selector)

      elements.forEach(element => {
        const htmlElement = element as HTMLElement

        switch (change.type) {
          case 'move':
            // Apply move to target position
            if (change.value?.targetSelector && change.value?.position) {
              const target = document.querySelector(change.value.targetSelector)
              if (target) {
                const parent = target.parentElement
                if (parent) {
                  if (change.value.position === 'before') {
                    parent.insertBefore(htmlElement, target)
                  } else if (change.value.position === 'after') {
                    parent.insertBefore(htmlElement, target.nextSibling)
                  } else if (change.value.position === 'firstChild') {
                    target.insertBefore(htmlElement, target.firstChild)
                  } else if (change.value.position === 'lastChild') {
                    target.appendChild(htmlElement)
                  }
                  console.log('[ElementActions] Moved element to target position')
                }
              }
            }
            break

          case 'text':
            if (change.value !== undefined) {
              htmlElement.textContent = change.value
              console.log('[ElementActions] Applied text content')
            }
            break

          case 'style':
            // Apply styles
            if (change.value && typeof change.value === 'object') {
              for (const prop in change.value) {
                (htmlElement.style as any)[prop] = change.value[prop]
              }
              console.log('[ElementActions] Applied style changes')
            }
            break

          case 'html':
            if (change.value !== undefined) {
              htmlElement.innerHTML = change.value
              console.log('[ElementActions] Applied HTML content')
            }
            break

          case 'delete':
            // Delete the element
            htmlElement.remove()
            console.log('[ElementActions] Deleted element')
            break

        }
      })
    } catch (error) {
      console.error('[ElementActions] Error applying DOM change:', error)
    }
  }

  public redoChange(): void {
    console.log('[ElementActions] redoChange called')

    // Get the current changes from state manager (source of truth)
    const currentChanges = [...this.stateManager.getState().changes || []]
    const redoItem = this.stateManager.popRedo()

    if (!redoItem) {
      console.log('[ElementActions] No redo items available')
      this.notifications.show('Nothing to redo', '', 'info')
      return
    }

    console.log('[ElementActions] Performing redo:', redoItem)
    console.log('[ElementActions] Current changes before redo:', currentChanges.length)

    if (redoItem.type === 'add') {
      // Re-apply the DOM change
      this.applyDOMChange(redoItem.change)

      // Re-add the change to array
      currentChanges.splice(redoItem.index, 0, redoItem.change)
      // Push to undo stack
      this.stateManager.pushUndo(redoItem)
    } else if (redoItem.type === 'update') {
      // TODO: Handle update redo
      const currentChange = currentChanges[redoItem.index]
      currentChanges[redoItem.index] = redoItem.change
      // Push current state to undo with swapped change
      this.stateManager.pushUndo({
        ...redoItem,
        change: currentChange
      })
    } else if (redoItem.type === 'remove') {
      // Remove the change again
      currentChanges.splice(redoItem.index, 1)
      // Push to undo stack
      this.stateManager.pushUndo(redoItem)
    }

    console.log('[ElementActions] Changes after redo:', currentChanges.length)

    // Update both local and state manager changes
    this.changes = currentChanges
    this.stateManager.setChanges(currentChanges)

    // Don't call onChangesUpdate here - that would save to sidebar
    // The visual editor will handle updating the UI

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