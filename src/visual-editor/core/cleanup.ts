/**
 * Cleanup Module for Visual Editor
 * Handles cleanup of DOM modifications, event listeners, and visual editor state
 */

import StateManager from './state-manager'

export class Cleanup {
  private stateManager: StateManager
  private eventHandlers: any[] = []

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  registerEventHandler(handler: () => void): void {
    this.eventHandlers.push(handler)
  }

  cleanupVisualEditor(): void {
    console.log('[ABSmartly] Starting visual editor cleanup...')

    // 1. Remove visual editor CSS classes from all elements
    this.removeVisualEditorClasses()

    // 2. Remove visual editor DOM elements
    this.removeVisualEditorElements()

    // 3. Restore original values where possible
    this.restoreOriginalValues()

    // 4. Remove event listeners
    this.removeEventListeners()

    // 5. Clear state
    this.clearState()

    // 6. Show preview header if it was hidden
    this.showPreviewHeader()

    // 7. Clear global markers
    this.clearGlobalMarkers()

    console.log('[ABSmartly] Visual editor cleanup complete')
  }

  private removeVisualEditorClasses(): void {
    // Remove our CSS classes from all elements
    const classesToRemove = [
      'absmartly-hover',
      'absmartly-selected',
      'absmartly-editing',
      'absmartly-draggable',
      'absmartly-drop-target',
      'absmartly-resize-active'
    ]

    classesToRemove.forEach(className => {
      const elements = document.querySelectorAll(`.${className}`)
      elements.forEach(el => el.classList.remove(className))
    })
  }

  private removeVisualEditorElements(): void {
    // Remove all visual editor UI elements
    const elementsToRemove = [
      'absmartly-visual-editor-banner-host',
      'absmartly-menu-host',
      'absmartly-html-editor-host',
      'absmartly-hover-tooltip',
      'absmartly-notification',
      'absmartly-relative-selector-host',
      'absmartly-insert-dialog-host'
    ]

    elementsToRemove.forEach(id => {
      const element = document.getElementById(id)
      if (element) {
        element.remove()
      }
    })

    // Remove any drag placeholders
    const placeholders = document.querySelectorAll('[data-absmartly-placeholder]')
    placeholders.forEach(placeholder => placeholder.remove())

    // Remove resize handles
    const resizeHandles = document.querySelectorAll('[data-absmartly-resize-handle]')
    resizeHandles.forEach(handle => handle.remove())
  }

  private restoreOriginalValues(): void {
    // Find all elements with original values stored
    const modifiedElements = document.querySelectorAll('[data-absmartly-original]')

    modifiedElements.forEach(element => {
      try {
        const originalData = JSON.parse((element as HTMLElement).dataset.absmartlyOriginal || '{}')

        // Restore text content if it was changed
        if (originalData.textContent !== undefined &&
            element.textContent !== originalData.textContent) {
          element.textContent = originalData.textContent
        }

        // Remove our data attributes
        delete (element as HTMLElement).dataset.absmartlyOriginal
        delete (element as HTMLElement).dataset.absmartlyModified
        delete (element as HTMLElement).dataset.absmartlyExperiment
      } catch (e) {
        console.warn('[ABSmartly] Failed to restore original values for element:', element, e)
      }
    })
  }

  private removeEventListeners(): void {
    // Remove all registered event handlers
    this.eventHandlers.forEach(handler => {
      try {
        handler()
      } catch (e) {
        console.warn('[ABSmartly] Failed to remove event handler:', e)
      }
    })
    this.eventHandlers = []
  }

  private clearState(): void {
    // Clear the state manager
    this.stateManager.deactivate()
  }

  private showPreviewHeader(): void {
    // Show preview header if it was hidden
    const previewHeader = document.getElementById('absmartly-preview-header')
    if (previewHeader) {
      previewHeader.style.display = ''
    }
  }

  private clearGlobalMarkers(): void {
    // Clear global window markers
    delete (window as any).__absmartlyVisualEditorActive

    // Remove any global styles we may have added
    const globalStyles = document.querySelectorAll('style[data-absmartly]')
    globalStyles.forEach(style => style.remove())
  }

  // Method to restore a specific element to its original state
  restoreElement(element: Element): void {
    try {
      const originalData = JSON.parse((element as HTMLElement).dataset.absmartlyOriginal || '{}')

      if (originalData.textContent !== undefined) {
        element.textContent = originalData.textContent
      }

      if (originalData.innerHTML !== undefined) {
        element.innerHTML = originalData.innerHTML
      }

      // Remove modifications
      ;(element as HTMLElement).style.display = ''
      element.classList.remove('absmartly-selected', 'absmartly-hover', 'absmartly-editing')

      // Clear data attributes
      delete (element as HTMLElement).dataset.absmartlyOriginal
      delete (element as HTMLElement).dataset.absmartlyModified
      delete (element as HTMLElement).dataset.absmartlyExperiment
    } catch (e) {
      console.warn('[ABSmartly] Failed to restore element:', element, e)
    }
  }

  // Method to save current state before cleanup (for potential restoration)
  saveStateBeforeCleanup(): any {
    const state = this.stateManager.getState()
    const modifiedElements: any[] = []

    // Collect all modified elements and their states
    const elements = document.querySelectorAll('[data-absmartly-modified]')
    elements.forEach(element => {
      try {
        modifiedElements.push({
          selector: this.generateElementSelector(element),
          original: (element as HTMLElement).dataset.absmartlyOriginal,
          current: {
            textContent: element.textContent,
            innerHTML: element.innerHTML,
            display: (element as HTMLElement).style.display
          }
        })
      } catch (e) {
        console.warn('[ABSmartly] Failed to save element state:', element, e)
      }
    })

    return {
      changes: state.changes,
      modifiedElements,
      timestamp: Date.now()
    }
  }

  private generateElementSelector(element: Element): string {
    // Generate a simple selector for the element
    if (element.id) return `#${element.id}`

    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim() && !c.startsWith('absmartly-'))
      if (classes.length > 0) {
        return `.${classes.slice(0, 2).join('.')}`
      }
    }

    // Fallback to tag name with nth-child
    const parent = element.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName)
      const index = siblings.indexOf(element)
      return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`
    }

    return element.tagName.toLowerCase()
  }
}

export default Cleanup