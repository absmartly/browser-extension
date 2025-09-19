/**
 * EditorCoordinator - Handles module coordination and integration logic
 * Extracted from visual-editor.ts to separate concerns
 */

import { generateRobustSelector } from '../utils/selector-generator'
import StateManager, { VisualEditorState } from './state-manager'
import EventHandlers from './event-handlers'
import ContextMenu from './context-menu'
import ChangeTracker from './change-tracker'
import UIComponents from '../ui/components'
import EditModes from './edit-modes'
import Cleanup from './cleanup'
// Removed toolbar import - using UIComponents banner instead
import { Notifications } from '../ui/notifications'
import HtmlEditor from '../ui/html-editor'
import type { DOMChange } from '../types/visual-editor'

export interface EditorCoordinatorCallbacks {
  onChangesUpdate: (changes: DOMChange[]) => void
  removeStyles: () => void
  addChange: (change: DOMChange) => void
  getSelector: (element: HTMLElement) => string
  hideElement: () => void
  deleteElement: () => void
  copyElement: () => void
  copySelectorPath: () => void
  moveElement: (direction: 'up' | 'down') => void
  insertNewBlock: () => void
  showRelativeElementSelector: () => void
  undoLastChange: () => void
  redoChange: () => void
  clearAllChanges: () => void
  saveChanges: () => void
  stop: () => void
}

export class EditorCoordinator {
  private stateManager: StateManager
  private eventHandlers: EventHandlers
  private contextMenu: ContextMenu
  private changeTracker: ChangeTracker
  private uiComponents: UIComponents
  private editModes: EditModes
  private cleanup: Cleanup
  // Removed toolbar - using UIComponents banner instead
  private notifications: Notifications
  private htmlEditor: HtmlEditor
  private callbacks: EditorCoordinatorCallbacks

  // State for event handling
  private selectedElement: HTMLElement | null = null
  private hoveredElement: HTMLElement | null = null
  private changes: DOMChange[] = []
  private mutationObserver: MutationObserver | null = null
  private isInternalChange = false

  constructor(
    stateManager: StateManager,
    eventHandlers: EventHandlers,
    contextMenu: ContextMenu,
    changeTracker: ChangeTracker,
    uiComponents: UIComponents,
    editModes: EditModes,
    cleanup: Cleanup,
    toolbar: any, // toolbar removed - using UIComponents banner
    notifications: Notifications,
    callbacks: EditorCoordinatorCallbacks
  ) {
    this.stateManager = stateManager
    this.eventHandlers = eventHandlers
    this.contextMenu = contextMenu
    this.changeTracker = changeTracker
    this.uiComponents = uiComponents
    this.editModes = editModes
    this.cleanup = cleanup
    // this.toolbar = toolbar // removed - using UIComponents banner
    this.notifications = notifications
    this.htmlEditor = new HtmlEditor(stateManager)
    this.callbacks = callbacks
  }

  setupModuleIntegrations(): void {
    // Connect event handlers to context menu
    this.eventHandlers.showContextMenu = (x: number, y: number, element: Element) => {
      this.contextMenu.show(x, y, element)
    }

    // Connect context menu to action handlers
    this.contextMenu.handleAction = (action: string, element: Element) => {
      this.handleMenuAction(action, element)
    }

    // Connect UI components to change tracker
    this.uiComponents.onUndo = () => this.changeTracker.performUndo()
    this.uiComponents.onRedo = () => this.changeTracker.performRedo()

    // Connect UI components banner actions
    this.uiComponents.onUndo = () => this.callbacks.undoLastChange()
    this.uiComponents.onRedo = () => this.callbacks.redoChange()
    this.uiComponents.onClear = () => this.callbacks.clearAllChanges()
    this.uiComponents.onSave = () => this.callbacks.saveChanges()
    this.uiComponents.onExit = () => this.callbacks.stop()

    // Register cleanup handlers
    this.cleanup.registerEventHandler(() => this.eventHandlers.detachEventListeners())
    this.cleanup.registerEventHandler(() => this.removeEventListeners())
    this.cleanup.registerEventHandler(() => this.stopMutationObserver())
    this.cleanup.registerEventHandler(() => this.makeElementsNonEditable())
    this.cleanup.registerEventHandler(() => this.callbacks.removeStyles())
    // this.cleanup.registerEventHandler(() => this.toolbar.remove()) // removed toolbar
    this.cleanup.registerEventHandler(() => this.uiComponents.removeBanner())
  }

  setupStateListeners(): void {
    // Listen to state changes and sync with local state
    this.stateManager.onStateChange((state: VisualEditorState) => {
      this.selectedElement = state.selectedElement as HTMLElement | null
      this.hoveredElement = state.hoveredElement as HTMLElement | null
      this.changes = state.changes || []

      console.log('[EditorCoordinator] State changed - total changes:', this.changes.length)
      console.log('[EditorCoordinator] Session changes (undo stack):', state.undoStack.length)
      console.log('[EditorCoordinator] Redo stack length:', state.redoStack.length)

      // Update banner - changes counter shows session changes (undo stack)
      this.uiComponents.updateBanner({
        changesCount: state.undoStack.length,  // Session changes, not total
        canUndo: state.undoStack.length > 0,
        canRedo: state.redoStack.length > 0
      })
    })
  }

  setupEventListeners(): void {
    // Use the event handlers module for main event handling
    this.eventHandlers.attachEventListeners()

    // Add coordinator-specific event listeners
    document.addEventListener('contextmenu', this.handleContextMenu, true)
    document.addEventListener('keydown', this.handleKeyDown, true)
    document.addEventListener('mousedown', this.handleMouseDown, true)
    document.addEventListener('mouseup', this.handleMouseUp, true)
  }

  removeEventListeners(): void {
    // Detach event handlers module listeners
    this.eventHandlers.detachEventListeners()

    // Remove coordinator-specific event listeners
    document.removeEventListener('contextmenu', this.handleContextMenu, true)
    document.removeEventListener('keydown', this.handleKeyDown, true)
    document.removeEventListener('mousedown', this.handleMouseDown, true)
    document.removeEventListener('mouseup', this.handleMouseUp, true)
    this.removeHoverTooltip()
  }

  setupKeyboardHandlers(): void {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z (Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        this.changeTracker.performUndo()
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z (Cmd+Y or Cmd+Shift+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        this.changeTracker.performRedo()
      }

      // Copy selector: Ctrl+Shift+C (Cmd+Shift+C on Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault()
        const selectedElement = this.stateManager.getState().selectedElement
        if (selectedElement) {
          const selector = generateRobustSelector(selectedElement, {
            preferDataAttributes: false,
            avoidAutoGenerated: true,
            includeParentContext: true,
            maxParentLevels: 3
          })
          navigator.clipboard.writeText(selector).then(() => {
            this.notifications.show(`Selector copied: ${selector}`, '', 'success')
          })
        }
      }

      // Delete: Delete key
      if (e.key === 'Delete') {
        const selectedElement = this.stateManager.getState().selectedElement
        if (selectedElement && !this.eventHandlers.isEditingMode) {
          e.preventDefault()
          selectedElement.remove()
          this.callbacks.addChange({
            selector: this.callbacks.getSelector(selectedElement as HTMLElement),
            type: 'delete',
            value: null,
            originalHtml: selectedElement.outerHTML,
            enabled: true
          })
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    this.cleanup.registerEventHandler(() => {
      document.removeEventListener('keydown', handleKeyDown)
    })
  }

  setupMessageHandlers(): void {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return

      switch (event.data.type) {
        case 'ABSMARTLY_VISUAL_EDITOR_EXIT':
          this.callbacks.stop()
          break
      }
    }

    window.addEventListener('message', handleMessage)
    this.cleanup.registerEventHandler(() => {
      window.removeEventListener('message', handleMessage)
    })
  }

  handleMenuAction(action: string, element: Element): void {
    const originalState = {
      html: element.outerHTML,
      parent: element.parentElement,
      nextSibling: element.nextElementSibling,
      textContent: element.textContent
    }

    switch (action) {
      case 'edit':
      case 'edit-element':
        this.handleEditAction(element, originalState)
        break

      case 'editHtml':
      case 'edit-html':
        this.handleEditHtmlAction(element, originalState)
        break

      case 'rearrange':
        this.editModes.enableRearrangeMode(element)
        break

      case 'resize':
        this.editModes.enableResizeMode(element)
        break

      case 'inlineEdit':
        this.handleInlineEditAction(element, originalState)
        break

      case 'hide':
        this.callbacks.hideElement()
        break

      case 'delete':
        this.callbacks.deleteElement()
        break

      case 'copy':
        this.callbacks.copyElement()
        break

      case 'copy-selector':
      case 'copySelector':
        this.callbacks.copySelectorPath()
        break

      case 'move-up':
        this.callbacks.moveElement('up')
        break

      case 'move-down':
        this.callbacks.moveElement('down')
        break

      case 'insert-block':
        this.callbacks.insertNewBlock()
        break

      case 'select-relative':
        this.callbacks.showRelativeElementSelector()
        break

      default:
        console.log('[ABSmartly] Action not yet implemented:', action)
        this.notifications.show(`${action}: Coming soon!`, '', 'info')
    }
  }

  handleEditAction(element: Element, originalState: any): void {
    this.removeContextMenu()

    // Set editing mode to prevent selection while editing text
    this.eventHandlers.setEditing(true)

    ;(element as HTMLElement).dataset.absmartlyModified = 'true'

    const preventDefault = (e: Event) => {
      if (this.eventHandlers.isEditingMode) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    element.addEventListener('click', preventDefault, true)

    element.classList.remove('absmartly-selected')
    element.classList.add('absmartly-editing')
    ;(element as HTMLElement).contentEditable = 'true'
    ;(element as HTMLElement).focus()

    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    this.eventHandlers.setEditing(true)

    const handleBlur = () => {
      ;(element as HTMLElement).contentEditable = 'false'
      element.classList.remove('absmartly-editing')
      element.classList.add('absmartly-selected')
      this.eventHandlers.setEditing(false)
      element.removeEventListener('blur', handleBlur)
      element.removeEventListener('keydown', handleKeyPress)
      element.removeEventListener('click', preventDefault, true)

      this.callbacks.addChange({
        selector: this.callbacks.getSelector(element as HTMLElement),
        type: 'text',
        value: element.textContent || '',
        originalText: originalState.textContent,
        enabled: true
      })
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        ;(element as HTMLElement).blur()
      }
      if (e.key === 'Escape') {
        element.textContent = originalState.textContent
        ;(element as HTMLElement).blur()
      }
    }

    element.addEventListener('blur', handleBlur)
    element.addEventListener('keydown', handleKeyPress)
  }

  async handleEditHtmlAction(element: Element, originalState: any): Promise<void> {
    this.removeContextMenu()

    // Set editing mode to prevent selection while HTML editor is open
    this.eventHandlers.setEditing(true)

    const currentHtml = element.innerHTML
    const newHtml = await this.htmlEditor.show(element, currentHtml)

    if (newHtml !== null && newHtml !== currentHtml) {
      element.innerHTML = newHtml

      this.callbacks.addChange({
        selector: this.callbacks.getSelector(element as HTMLElement),
        type: 'html',
        value: newHtml,
        originalHtml: originalState.innerHTML,
        enabled: true
      })

      this.notifications.show('HTML updated successfully', '', 'success')
    }

    // Clear editing mode after HTML editor closes
    this.eventHandlers.setEditing(false)
  }

  handleInlineEditAction(element: Element, originalState: any): void {
    this.removeContextMenu()

    // Set editing mode to prevent selection while inline editing
    this.eventHandlers.setEditing(true)

    element.classList.add('absmartly-editing')
    ;(element as HTMLElement).contentEditable = 'true'
    ;(element as HTMLElement).focus()

    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    this.eventHandlers.setEditing(true)

    const finishInlineEdit = () => {
      ;(element as HTMLElement).contentEditable = 'false'
      element.classList.remove('absmartly-editing')
      this.eventHandlers.setEditing(false)
      this.callbacks.addChange({
        selector: this.callbacks.getSelector(element as HTMLElement),
        type: 'text',
        value: element.textContent || '',
        originalText: originalState.textContent,
        enabled: true
      })
    }

    element.addEventListener('blur', finishInlineEdit, { once: true })
    element.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        ;(element as HTMLElement).blur()
      }
    })
  }

  showContextMenu(x: number, y: number): void {
    // This will be implemented to show rich context menu
    // For now, delegate to the injected context menu
    if (this.selectedElement) {
      this.contextMenu.show(x, y, this.selectedElement)
    }
  }

  removeContextMenu(): void {
    // Remove any context menu
    document.getElementById('absmartly-menu-overlay')?.remove()
    document.getElementById('absmartly-menu-container')?.remove()
  }

  startMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.isInternalChange) return
      // TODO: Track external changes
    })

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true
    })
  }

  stopMutationObserver(): void {
    this.mutationObserver?.disconnect()
    this.mutationObserver = null
  }

  makeElementsEditable(): void {
    document.querySelectorAll('*').forEach(el => {
      const element = el as HTMLElement
      if (!this.isExtensionElement(element)) {
        element.classList.add('absmartly-editable')
      }
    })
  }

  makeElementsNonEditable(): void {
    document.querySelectorAll('.absmartly-editable').forEach(el => {
      el.classList.remove('absmartly-editable')
      el.classList.remove('absmartly-selected')
      el.classList.remove('absmartly-editing')
    })
  }

  // Event handlers bound to this class
  private handleContextMenu = (e: Event) => {
    // Context menu handling - for now, prevent default
    e.preventDefault()
    e.stopPropagation()
  }

  private handleKeyDown = (e: Event) => {
    // Key handling is done in setupKeyboardHandlers, this is just a placeholder
    // for consistency with event listener setup
  }

  private handleMouseDown = (e: Event) => {
    // Mouse down handling - placeholder for future implementation
  }

  private handleMouseUp = (e: Event) => {
    // Mouse up handling - placeholder for future implementation
  }

  // Helper methods
  private isExtensionElement(element: HTMLElement): boolean {
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

  private removeHoverTooltip(): void {
    // This would remove any hover tooltip if implemented
    // For now, this is a placeholder
  }

  // Setup all integrations and handlers
  setupAll(): void {
    console.log('[EditorCoordinator] setupAll called')
    this.setupModuleIntegrations()
    this.setupStateListeners()
    this.setupEventListeners()
    this.setupKeyboardHandlers()
    this.setupMessageHandlers()
    this.startMutationObserver()
    this.makeElementsEditable()

    // Banner is created in visual-editor.ts start() method
    console.log('[EditorCoordinator] setupAll completed')
  }

  // Teardown all integrations and handlers
  teardownAll(): void {
    console.log('[EditorCoordinator] Starting teardownAll')

    // Call all registered cleanup handlers (includes removeBanner)
    this.cleanup.cleanupVisualEditor()

    // Additional cleanup
    this.removeEventListeners()
    this.stopMutationObserver()
    this.makeElementsNonEditable()

    // Explicitly remove banner in case it wasn't registered
    this.uiComponents.removeBanner()

    console.log('[EditorCoordinator] teardownAll completed')
  }
}