/**
 * Unified Visual Editor
 * Merges the modular architecture from injected/visual-editor-main.ts
 * with the rich UI components from content/visual-editor.ts
 */

import { generateRobustSelector } from '../utils/selector-generator'
import StateManager, { VisualEditorConfig, VisualEditorState } from './state-manager'
import EventHandlers from './event-handlers'
import ContextMenu from './context-menu'
import ChangeTracker from './change-tracker'
import UIComponents from '../ui/components'
import EditModes from './edit-modes'
import Cleanup from './cleanup'
import { Toolbar } from '../ui/toolbar'
import { Notifications } from '../ui/notifications'
import type { DOMChange } from '../types/visual-editor'

export interface VisualEditorOptions {
  variantName: string
  experimentName: string
  logoUrl: string
  onChangesUpdate: (changes: DOMChange[]) => void
  initialChanges?: DOMChange[]
}

export class VisualEditor {
  private readonly VERSION = '3.0-UNIFIED'
  private isActive = false

  // Core modules from injected architecture
  private stateManager: StateManager
  private eventHandlers: EventHandlers
  private contextMenu: ContextMenu
  private changeTracker: ChangeTracker
  private uiComponents: UIComponents
  private editModes: EditModes
  private cleanup: Cleanup

  // Rich UI from content architecture
  private toolbar: Toolbar
  private notifications: Notifications
  private selectedElement: HTMLElement | null = null
  private hoveredElement: HTMLElement | null = null
  private hoverTooltip: HTMLElement | null = null
  private mutationObserver: MutationObserver | null = null
  private isInternalChange = false
  private originalValues = new Map<HTMLElement, any>()

  // Configuration
  private options: VisualEditorOptions
  private changes: DOMChange[] = []

  constructor(options: VisualEditorOptions) {
    this.options = options
    this.changes = options.initialChanges || []

    // Initialize state manager with converted config
    const config: VisualEditorConfig = {
      variantName: options.variantName,
      experimentName: options.experimentName,
      logoUrl: options.logoUrl,
      initialChanges: options.initialChanges || []
    }
    this.stateManager = new StateManager(config)

    // Initialize core modules
    this.eventHandlers = new EventHandlers(this.stateManager)
    this.contextMenu = new ContextMenu(this.stateManager)
    this.changeTracker = new ChangeTracker(this.stateManager)
    this.uiComponents = new UIComponents(this.stateManager)
    this.editModes = new EditModes(this.stateManager)
    this.cleanup = new Cleanup(this.stateManager)

    // Initialize rich UI modules
    this.toolbar = new Toolbar(this.stateManager)
    this.notifications = new Notifications()

    // Setup integrations between modules
    this.setupModuleIntegrations()
    this.setupStateListeners()
  }

  private setupModuleIntegrations(): void {
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

    // Connect toolbar to actions
    this.toolbar.onUndo = () => this.undoLastChange()
    this.toolbar.onRedo = () => this.redoChange()
    this.toolbar.onClear = () => this.clearAllChanges()
    this.toolbar.onSave = () => this.saveChanges()
    this.toolbar.onExit = () => this.stop()

    // Register cleanup handlers
    this.cleanup.registerEventHandler(() => this.eventHandlers.detachEventListeners())
    this.cleanup.registerEventHandler(() => this.removeEventListeners())
    this.cleanup.registerEventHandler(() => this.stopMutationObserver())
    this.cleanup.registerEventHandler(() => this.makeElementsNonEditable())
    this.cleanup.registerEventHandler(() => this.removeStyles())
    this.cleanup.registerEventHandler(() => this.toolbar.remove())
    this.cleanup.registerEventHandler(() => this.uiComponents.removeBanner())
  }

  private setupStateListeners(): void {
    // Listen to state changes and sync with local state
    this.stateManager.onStateChange((state: VisualEditorState) => {
      this.selectedElement = state.selectedElement as HTMLElement | null
      this.hoveredElement = state.hoveredElement as HTMLElement | null
      this.changes = state.changes || []

      // Update toolbar
      this.toolbar.updateChangesCount(this.changes.length)
      this.toolbar.updateUndoRedoButtons(
        state.undoStack.length > 0,
        state.redoStack.length > 0
      )
    })
  }

  start(): { success: boolean; already?: boolean } {
    console.log('[ABSmartly] Starting unified visual editor - Version:', this.VERSION)
    console.log('[ABSmartly] Build timestamp:', new Date().toISOString())

    // Check if we already have the editor
    if ((window as any).__absmartlyVisualEditorActive) {
      console.log('[ABSmartly] Visual editor already active')
      return { success: true, already: true }
    }

    if (this.isActive) {
      console.log('[ABSmartly] Already active, returning')
      return { success: true, already: true }
    }

    console.log('[ABSmartly] Starting visual editor')

    // Mark as active
    this.isActive = true
    ;(window as any).__absmartlyVisualEditorActive = true

    // Hide preview header when visual editor starts
    const previewHeader = document.getElementById('absmartly-preview-header')
    if (previewHeader) {
      previewHeader.style.display = 'none'
    }

    // Create UI
    this.injectStyles()
    this.uiComponents.createBanner()
    this.toolbar.create()
    this.addGlobalStyles() // From injected architecture

    // Setup event handling
    this.setupEventListeners() // Rich UI event handling
    this.eventHandlers.attachEventListeners() // Core event handling
    this.setupKeyboardHandlers()
    this.setupMessageHandlers()

    // Start mutation observer and make elements editable
    this.startMutationObserver()
    this.makeElementsEditable()

    // Show notification
    this.notifications.show('Visual Editor Active', 'Click any element to edit', 'success')
    console.log('[ABSmartly] Visual editor is now active!')

    return { success: true }
  }

  stop(): void {
    if (!this.isActive) return

    console.log('[ABSmartly] Stopping unified visual editor')

    this.isActive = false
    ;(window as any).__absmartlyVisualEditorActive = false

    // Save final changes
    this.options.onChangesUpdate(this.changes)

    // Clean up everything
    this.cleanup.cleanupVisualEditor()

    // Send message to disable preview mode
    chrome.runtime.sendMessage({
      type: 'DISABLE_PREVIEW'
    })
  }

  destroy(): void {
    this.stop()
  }

  getChanges(): DOMChange[] {
    return this.changes
  }

  // Rich UI event handling (from content architecture)
  private setupEventListeners(): void {
    document.addEventListener('click', this.handleElementClick, true)
    document.addEventListener('contextmenu', this.handleContextMenu, true)
    document.addEventListener('keydown', this.handleKeyDown, true)
    document.addEventListener('mousedown', this.handleMouseDown, true)
    document.addEventListener('mouseup', this.handleMouseUp, true)
    document.addEventListener('mouseover', this.handleMouseOver, true)
    document.addEventListener('mouseout', this.handleMouseOut, true)
  }

  private removeEventListeners(): void {
    document.removeEventListener('click', this.handleElementClick, true)
    document.removeEventListener('contextmenu', this.handleContextMenu, true)
    document.removeEventListener('keydown', this.handleKeyDown, true)
    document.removeEventListener('mousedown', this.handleMouseDown, true)
    document.removeEventListener('mouseup', this.handleMouseUp, true)
    document.removeEventListener('mouseover', this.handleMouseOver, true)
    document.removeEventListener('mouseout', this.handleMouseOut, true)
    this.removeHoverTooltip()
  }

  private handleElementClick = (e: MouseEvent) => {
    if (!this.isActive) return

    const target = e.target as HTMLElement
    if (this.isExtensionElement(target)) return

    if (this.selectedElement && this.selectedElement.contentEditable === 'true') {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    this.selectElement(target)
    this.stateManager.setSelectedElement(target)

    // Show context menu on selection using rich UI
    this.showContextMenu(e.clientX, e.clientY)
  }

  private handleContextMenu = (e: MouseEvent) => {
    if (!this.isActive) return

    const target = e.target as HTMLElement
    if (this.isExtensionElement(target)) return

    e.preventDefault()
    e.stopPropagation()

    this.selectElement(target)
    this.showContextMenu(e.clientX, e.clientY)
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isActive) return

    if (e.key === 'Escape') {
      if (this.contextMenu) {
        this.removeContextMenu()
      } else if (this.selectedElement) {
        this.deselectElement()
      } else {
        this.stop()
      }
    }
  }

  private handleMouseDown = (e: MouseEvent) => {
    if (!this.isActive) return
    const target = e.target as HTMLElement
    if (this.isExtensionElement(target)) return
    e.preventDefault()
    e.stopPropagation()
  }

  private handleMouseUp = (e: MouseEvent) => {
    if (!this.isActive) return
    const target = e.target as HTMLElement
    if (this.isExtensionElement(target)) return
    e.preventDefault()
    e.stopPropagation()
  }

  private handleMouseOver = (e: MouseEvent) => {
    if (!this.isActive) return
    const target = e.target as HTMLElement
    if (this.isExtensionElement(target) || target === this.selectedElement) return

    if (this.hoveredElement && this.hoveredElement !== target) {
      this.removeHoverTooltip()
    }

    this.hoveredElement = target
    this.showHoverTooltip(target, e.clientX, e.clientY)
  }

  private handleMouseOut = (e: MouseEvent) => {
    if (!this.isActive) return
    const target = e.target as HTMLElement
    if (target === this.hoveredElement) {
      this.removeHoverTooltip()
      this.hoveredElement = null
    }
  }

  // Menu action handling (merged from both architectures)
  private handleMenuAction(action: string, element: Element): void {
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
        this.hideElement()
        break

      case 'delete':
        this.deleteElement()
        break

      case 'copy':
        this.copyElement()
        break

      case 'copy-selector':
      case 'copySelector':
        this.copySelectorPath()
        break

      case 'move-up':
        this.moveElement('up')
        break

      case 'move-down':
        this.moveElement('down')
        break

      case 'insert-block':
        this.insertNewBlock()
        break

      case 'select-relative':
        this.showRelativeElementSelector()
        break

      default:
        console.log('[ABSmartly] Action not yet implemented:', action)
        this.notifications.show(`${action}: Coming soon!`, '', 'info')
    }
  }

  // Implementation methods (mix of both architectures)
  private handleEditAction(element: Element, originalState: any): void {
    this.removeContextMenu()

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

      this.addChange({
        selector: this.getSelector(element as HTMLElement),
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

  private async handleEditHtmlAction(element: Element, originalState: any): Promise<void> {
    const currentHtml = element.outerHTML
    const newHtml = await this.uiComponents.createHtmlEditor(element, currentHtml)

    if (newHtml && newHtml !== currentHtml) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = newHtml
      const newElement = tempDiv.firstElementChild
      if (newElement) {
        element.replaceWith(newElement)
        this.addChange({
          selector: this.getSelector(newElement as HTMLElement),
          type: 'html',
          value: newHtml,
          originalHtml: currentHtml,
          enabled: true
        })
      }
    }
  }

  private handleInlineEditAction(element: Element, originalState: any): void {
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
      this.addChange({
        selector: this.getSelector(element as HTMLElement),
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

  // UI methods from content architecture
  private injectStyles(): void {
    const style = document.createElement('style')
    style.id = 'absmartly-visual-editor-styles'
    style.textContent = `
      .absmartly-editable {
        outline: 2px dashed transparent !important;
        transition: outline 0.2s !important;
        cursor: pointer !important;
      }

      .absmartly-editable:hover {
        outline-color: #3b82f6 !important;
      }

      .absmartly-selected {
        outline: 2px solid #3b82f6 !important;
        position: relative !important;
      }

      .absmartly-editing {
        outline: 2px solid #10b981 !important;
        overflow: visible !important;
        text-overflow: clip !important;
        white-space: normal !important;
        word-wrap: break-word !important;
        min-height: auto !important;
      }

      .absmartly-hover-tooltip {
        position: fixed !important;
        background: #1f2937 !important;
        color: white !important;
        padding: 6px 10px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        font-family: monospace !important;
        z-index: 2147483645 !important;
        pointer-events: none !important;
        white-space: nowrap !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        opacity: 0.95 !important;
      }
    `
    document.head.appendChild(style)
  }

  private removeStyles(): void {
    document.getElementById('absmartly-visual-editor-styles')?.remove()
  }

  // Core styles from injected architecture
  private addGlobalStyles(): void {
    const style = document.createElement('style')
    style.dataset.absmartly = 'true'
    style.textContent = `
      .absmartly-hover {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 2px !important;
      }
      .absmartly-selected {
        outline: 3px solid #10b981 !important;
        outline-offset: 2px !important;
      }
      .absmartly-editing {
        outline: 3px solid #f59e0b !important;
        outline-offset: 2px !important;
        background: rgba(245, 158, 11, 0.1) !important;
      }
      .absmartly-draggable {
        cursor: move !important;
        opacity: 0.8 !important;
      }
      .absmartly-dragging {
        opacity: 0.5 !important;
      }
      .absmartly-drop-target {
        outline: 2px dashed #10b981 !important;
        outline-offset: 4px !important;
        background: rgba(16, 185, 129, 0.1) !important;
      }
      .absmartly-resize-active {
        outline: 3px solid #8b5cf6 !important;
        outline-offset: 2px !important;
      }
    `
    document.head.appendChild(style)
  }

  // Keyboard handlers from injected architecture
  private setupKeyboardHandlers(): void {
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
          this.addChange({
            selector: this.getSelector(selectedElement as HTMLElement),
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

  private setupMessageHandlers(): void {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return

      switch (event.data.type) {
        case 'ABSMARTLY_VISUAL_EDITOR_EXIT':
          this.stop()
          break
      }
    }

    window.addEventListener('message', handleMessage)
    this.cleanup.registerEventHandler(() => {
      window.removeEventListener('message', handleMessage)
    })
  }

  // Helper methods
  private selectElement(element: HTMLElement): void {
    if (this.selectedElement) {
      this.selectedElement.classList.remove('absmartly-selected')
    }

    this.selectedElement = element
    element.classList.add('absmartly-selected')
  }

  private deselectElement(): void {
    if (this.selectedElement) {
      this.selectedElement.classList.remove('absmartly-selected')
      this.selectedElement = null
    }
    this.removeContextMenu()
  }

  private showHoverTooltip(element: HTMLElement, x: number, y: number): void {
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

  private removeHoverTooltip(): void {
    if (this.hoverTooltip) {
      this.hoverTooltip.remove()
      this.hoverTooltip = null
    }
  }

  private getSelector(element: HTMLElement): string {
    return generateRobustSelector(element, {
      preferDataAttributes: false,
      avoidAutoGenerated: true,
      includeParentContext: true,
      maxParentLevels: 3
    })
  }

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

  private startMutationObserver(): void {
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

  private stopMutationObserver(): void {
    this.mutationObserver?.disconnect()
    this.mutationObserver = null
  }

  private makeElementsEditable(): void {
    document.querySelectorAll('*').forEach(el => {
      const element = el as HTMLElement
      if (!this.isExtensionElement(element)) {
        element.classList.add('absmartly-editable')
      }
    })
  }

  private makeElementsNonEditable(): void {
    document.querySelectorAll('.absmartly-editable').forEach(el => {
      el.classList.remove('absmartly-editable')
      el.classList.remove('absmartly-selected')
      el.classList.remove('absmartly-editing')
    })
  }

  private addChange(change: DOMChange): void {
    const existingIndex = this.changes.findIndex(c =>
      c.selector === change.selector && c.type === change.type
    )

    if (existingIndex >= 0) {
      if (change.type === 'style' && this.changes[existingIndex].type === 'style') {
        this.changes[existingIndex].value = {
          ...this.changes[existingIndex].value,
          ...change.value
        }
      } else {
        this.changes[existingIndex] = change
      }
    } else {
      this.changes.push(change)
    }

    this.stateManager.setChanges(this.changes)
    this.options.onChangesUpdate(this.changes)
  }

  // Action methods (placeholder implementations)
  private showContextMenu(x: number, y: number): void {
    // This will be implemented to show rich context menu
    // For now, delegate to the injected context menu
    if (this.selectedElement) {
      this.contextMenu.show(x, y, this.selectedElement)
    }
  }

  private removeContextMenu(): void {
    // Remove any context menu
    document.getElementById('absmartly-menu-overlay')?.remove()
    document.getElementById('absmartly-menu-container')?.remove()
  }

  private hideElement(): void {
    if (!this.selectedElement) return

    this.selectedElement.style.display = 'none'
    this.addChange({
      selector: this.getSelector(this.selectedElement),
      type: 'style',
      value: { display: 'none' },
      enabled: true
    })
    this.deselectElement()
  }

  private deleteElement(): void {
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

  private copyElement(): void {
    if (!this.selectedElement) return

    const html = this.selectedElement.outerHTML
    navigator.clipboard.writeText(html).then(() => {
      this.notifications.show('Element HTML copied to clipboard!', '', 'success')
    })
  }

  private copySelectorPath(): void {
    if (!this.selectedElement) return

    const selector = this.getSelector(this.selectedElement)
    navigator.clipboard.writeText(selector).then(() => {
      this.notifications.show(`Selector copied: ${selector}`, '', 'success')
    })
  }

  private moveElement(direction: 'up' | 'down'): void {
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

  private insertNewBlock(): void {
    // Placeholder - will implement comprehensive insert dialog
    this.notifications.show('Insert new block: Coming soon!', '', 'info')
  }

  private showRelativeElementSelector(): void {
    // Placeholder - will implement relative element highlighting
    this.notifications.show('Select relative elements: Coming soon!', '', 'info')
  }

  private undoLastChange(): void {
    if (this.changes.length === 0) return
    this.changes.pop()
    this.stateManager.setChanges(this.changes)
    this.options.onChangesUpdate(this.changes)
    this.notifications.show('Last change undone', '', 'success')
  }

  private redoChange(): void {
    // Placeholder for redo functionality
    this.notifications.show('Redo: Coming soon!', '', 'info')
  }

  private clearAllChanges(): void {
    if (confirm('Are you sure you want to clear all changes?')) {
      this.changes = []
      this.stateManager.setChanges(this.changes)
      this.options.onChangesUpdate(this.changes)
      this.notifications.show('All changes cleared', '', 'success')
    }
  }

  private saveChanges(): void {
    this.options.onChangesUpdate(this.changes)
    this.notifications.show(`${this.changes.length} changes saved`, '', 'success')

    chrome.runtime.sendMessage({
      type: 'DISABLE_PREVIEW'
    })
  }
}

// Main entry point function for compatibility
export function initVisualEditor(
  variantName: string,
  experimentName: string,
  logoUrl: string,
  initialChanges: any[]
): { success: boolean; already?: boolean } {
  console.log('[ABSmartly] Initializing unified visual editor')

  const options: VisualEditorOptions = {
    variantName,
    experimentName,
    logoUrl,
    initialChanges,
    onChangesUpdate: (changes) => {
      // Send changes to extension background
      window.postMessage({
        type: 'ABSMARTLY_VISUAL_EDITOR_SAVE',
        changes,
        experimentName,
        variantName
      }, '*')
    }
  }

  const editor = new VisualEditor(options)
  const result = editor.start()

  // Store editor instance globally for potential external access
  ;(window as any).__absmartlyVisualEditor = editor

  return result
}

// Make it available globally for injection
;(window as any).initVisualEditor = initVisualEditor