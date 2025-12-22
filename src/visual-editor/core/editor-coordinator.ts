/**
 * EditorCoordinator - Handles module coordination and integration logic
 * Extracted from visual-editor.ts to separate concerns
 */

import { generateRobustSelector } from '../utils/selector-generator'
import StateManager from './state-manager'
import type { VisualEditorState } from './state-manager'
import EventHandlers from './event-handlers'
import ContextMenu from './context-menu'
import UndoRedoManager from './undo-redo-manager'
import UIComponents from '../ui/components'
import EditModes from './edit-modes'
import Cleanup from './cleanup'
// Removed toolbar import - using UIComponents banner instead
import { Notifications } from '../ui/notifications'
import HtmlEditor from '../ui/html-editor'
import ImageSourceDialog from '../ui/image-source-dialog'
import type { DOMChange } from '../types/visual-editor'
import DOMPurify from 'dompurify'

export interface EditorCoordinatorCallbacks {
  onChangesUpdate: (changes: DOMChange[]) => void
  removeStyles: () => void
  getSelector: (element: HTMLElement) => string
  hideElement: () => void
  deleteElement: () => void
  copyElement: () => void
  copySelectorPath: () => void
  moveElement: (direction: 'up' | 'down') => void
  insertNewBlock: () => void
  showRelativeElementSelector: () => void
  changeImageSource: () => void
  undoLastChange: () => void
  redoChange: () => void
  undo: () => void
  redo: () => void
  clearAllChanges: () => void
  saveChanges: () => void
  stop: () => void
}

export class EditorCoordinator {
  private stateManager: StateManager
  private eventHandlers: EventHandlers
  private contextMenu: ContextMenu
  private undoRedoManager: UndoRedoManager
  private uiComponents: UIComponents
  private editModes: EditModes
  private cleanup: Cleanup
  // Removed toolbar - using UIComponents banner instead
  private notifications: Notifications
  private htmlEditor: HtmlEditor
  private imageSourceDialog: ImageSourceDialog
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
    undoRedoManager: UndoRedoManager,
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
    this.undoRedoManager = undoRedoManager
    this.uiComponents = uiComponents
    this.editModes = editModes
    this.cleanup = cleanup
    // this.toolbar = toolbar // removed - using UIComponents banner
    this.notifications = notifications
    this.htmlEditor = new HtmlEditor(stateManager)
    this.imageSourceDialog = new ImageSourceDialog()
    this.callbacks = callbacks
  }

  setupModuleIntegrations(): void {
    // Connect event handlers to context menu
    this.eventHandlers.showContextMenu = (x: number, y: number, element: Element) => {
      this.contextMenu.show(x, y, element)
    }

    // Connect context menu to action handlers
    this.contextMenu.handleAction = (action: string, element: Element) => {
      // IMPORTANT: Always use the currently selected element from state, not the passed element
      // This ensures actions work on the element selected from the hierarchy panel
      const currentSelected = this.stateManager.getState().selectedElement || element
      this.handleMenuAction(action, currentSelected)
    }

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
    // Track previous values to detect actual changes
    let previousChangesLength = 0
    let previousUndoStackLength = 0
    let previousRedoStackLength = 0

    // Listen to state changes and sync with local state
    this.stateManager.onStateChange((state: VisualEditorState) => {
      // Always update these for internal tracking
      this.selectedElement = state.selectedElement as HTMLElement | null
      this.hoveredElement = state.hoveredElement as HTMLElement | null
      this.changes = state.changes || []

      // Only update banner and log if undo/redo/changes actually changed
      const changesLength = this.changes.length
      const undoCount = this.undoRedoManager.getUndoCount()
      const redoCount = this.undoRedoManager.getRedoCount()

      if (changesLength !== previousChangesLength ||
          undoCount !== previousUndoStackLength ||
          redoCount !== previousRedoStackLength) {

        console.log('[EditorCoordinator] Changes/Undo/Redo updated - total changes:', changesLength)
        console.log('[EditorCoordinator] Session changes (undo count):', undoCount)
        console.log('[EditorCoordinator] Redo count:', redoCount)

        // Update banner - changes counter shows session changes (undo count)
        this.uiComponents.updateBanner({
          changesCount: undoCount,
          canUndo: this.undoRedoManager.canUndo(),
          canRedo: this.undoRedoManager.canRedo()
        })

        // Update tracked values
        previousChangesLength = changesLength
        previousUndoStackLength = undoCount
        previousRedoStackLength = redoCount
      }
    })
  }

  setupEventListeners(): void {
    // Use the event handlers module for main event handling
    this.eventHandlers.attachEventListeners()

    // Note: keydown handling is done in setupKeyboardHandlers()
    // Add coordinator-specific event listeners
    document.addEventListener('mousedown', this.handleMouseDown, true)
    document.addEventListener('mouseup', this.handleMouseUp, true)
  }

  removeEventListeners(): void {
    // Detach event handlers module listeners
    this.eventHandlers.detachEventListeners()

    // Note: keydown listener is removed in setupKeyboardHandlers cleanup
    // Remove coordinator-specific event listeners
    document.removeEventListener('mousedown', this.handleMouseDown, true)
    document.removeEventListener('mouseup', this.handleMouseUp, true)
    this.removeHoverTooltip()
  }

  setupKeyboardHandlers(): void {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      // Undo: Ctrl+Z (Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        this.callbacks.undo()
      }

      // Redo: Ctrl+Y (Cmd+Y on Mac) or Ctrl+Shift+Z (Cmd+Shift+Z on Mac)
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault()
        this.callbacks.redo()
      }

      // Exit Visual Editor: Escape key
      if (e.key === 'Escape') {
        // Don't exit VE if we're editing text inline or if HTML editor is open
        if (this.eventHandlers.isEditingMode) {
          return
        }
        
        e.preventDefault()
        e.stopPropagation()
        
        // Call stop to properly exit the VE
        if (this.callbacks.stop && typeof this.callbacks.stop === 'function') {
          this.callbacks.stop()
        }
        return
      }

      // Delete: Delete key
      if (e.key === 'Delete') {
        const selectedElement = this.stateManager.getState().selectedElement
        if (selectedElement && !this.eventHandlers.isEditingMode) {
          e.preventDefault()
          selectedElement.remove()
          const selector = this.callbacks.getSelector(selectedElement as HTMLElement)
          const oldValue = selectedElement.outerHTML
          this.undoRedoManager.addChange(
            {
              selector,
              type: 'remove'
            },
            oldValue
          )
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
    console.log('[handleMenuAction] START - action:', action)
    console.log('[handleMenuAction] Received element:', element)
    console.log('[handleMenuAction] Element details - tagName:', element.tagName, 'id:', element.id, 'className:', element.className)
    console.log('[handleMenuAction] Coordinator selectedElement:', this.selectedElement)
    console.log('[handleMenuAction] State selectedElement:', this.stateManager.getState().selectedElement)

    const originalState = {
      html: element.outerHTML,
      parent: element.parentElement,
      nextSibling: element.nextElementSibling,
      textContent: element.textContent,
      innerHTML: element.innerHTML
    }

    switch (action) {
      case 'edit':
      case 'edit-element':
        console.log('[handleMenuAction] Handling edit action for:', element)
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
        console.log('[EditorCoordinator] insert-block action triggered')
        this.callbacks.insertNewBlock()
        console.log('[EditorCoordinator] insertNewBlock callback called')
        break

      case 'select-relative':
      case 'selectRelative':
        console.log('[handleMenuAction] Handling select-relative for element:', element)
        this.handleSelectRelativeElement(element)
        break

      case 'change-image-source':
        this.handleChangeImageSource(element)
        break

      default:
        console.log('[ABSmartly] Action not yet implemented:', action)
        this.notifications.show(`${action}: Coming soon!`, '', 'info')
    }
  }

  handleEditAction(element: Element, originalState: any): void {
    console.log('[handleEditAction] START for element:', element)
    console.log('[handleEditAction] Element details:', element.tagName, element.id, element.className)
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

      // Check if element has child elements (not just text nodes)
      // If it has HTML children, save as HTML to preserve structure
      const hasHtmlChildren = Array.from(element.children).length > 0

      if (hasHtmlChildren) {
        // Save as HTML to preserve inner element structure and styles
        const selector = this.callbacks.getSelector(element as HTMLElement)
        const newValue = element.innerHTML
        const oldValue = originalState.innerHTML
        this.undoRedoManager.addChange(
          {
            selector,
            type: 'html',
            value: newValue
          },
          oldValue
        )
      } else {
        // Simple text node, save as text
        const selector = this.callbacks.getSelector(element as HTMLElement)
        const newValue = element.textContent || ''
        const oldValue = originalState.textContent
        this.undoRedoManager.addChange(
          {
            selector,
            type: 'text',
            value: newValue
          },
          oldValue
        )
      }
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

    // Prevent editing body or html elements to avoid page corruption
    if (element === document.body || element === document.documentElement) {
      this.notifications.show(
        'Cannot edit page body or HTML element',
        'Editing these elements could corrupt the page',
        'warning'
      )
      // Re-enable selection
      this.eventHandlers.setEditing(false)
      return
    }

    // Set editing mode to prevent selection while HTML editor is open
    this.eventHandlers.setEditing(true)
    // Disable hover tooltips while editor is open
    this.eventHandlers.setHoverEnabled(false)

    const currentHtml = element.innerHTML
    const newHtml = await this.htmlEditor.show(element, currentHtml)

    if (newHtml !== null && newHtml !== currentHtml) {
      element.innerHTML = DOMPurify.sanitize(newHtml)

      const selector = this.callbacks.getSelector(element as HTMLElement)
      const oldValue = originalState.innerHTML
      this.undoRedoManager.addChange(
        {
          selector,
          type: 'html',
          value: newHtml
        },
        oldValue
      )

      this.notifications.show('HTML updated successfully', '', 'success')
    }

    // Clear editing mode and re-enable hover tooltips after HTML editor closes
    this.eventHandlers.setEditing(false)
    this.eventHandlers.setHoverEnabled(true)
  }

  handleSelectRelativeElement(element: Element): void {
    console.log('[handleSelectRelativeElement] Called with element:', element)
    console.log('[handleSelectRelativeElement] Element details:', element.tagName, element.id, element.className)

    // Check if we already have a selector open to prevent recursion
    if (document.getElementById('absmartly-relative-selector-host')) {
      console.log('[handleSelectRelativeElement] Selector already exists, returning')
      return
    }

    this.removeContextMenu()
    this.showRelativeElementSelector(element)
  }

  async handleChangeImageSource(element: Element): Promise<void> {
    console.log('[handleChangeImageSource] Called with element:', element)
    console.log('[handleChangeImageSource] Element details:', element.tagName, element.id, element.className)

    this.removeContextMenu()

    const isImgTag = element.tagName.toLowerCase() === 'img'
    const currentSrc = this.imageSourceDialog.getCurrentImageSource(element)

    const newSrc = await this.imageSourceDialog.show(element, currentSrc)
    if (!newSrc) {
      console.log('[handleChangeImageSource] User cancelled')
      return
    }

    console.log('[handleChangeImageSource] New source:', newSrc)

    const selector = this.callbacks.getSelector(element as HTMLElement)

    if (isImgTag) {
      const oldSrc = (element as HTMLImageElement).src
      ;(element as HTMLImageElement).src = newSrc

      this.undoRedoManager.addChange(
        {
          selector,
          type: 'attribute',
          value: { src: newSrc },
          mode: 'merge'
        },
        { src: oldSrc }
      )

      console.log('[handleChangeImageSource] Created attribute change for img element')
    } else {
      const htmlElement = element as HTMLElement
      const oldBgImage = htmlElement.style.backgroundImage ||
                         window.getComputedStyle(htmlElement).backgroundImage

      htmlElement.style.backgroundImage = `url('${newSrc}')`

      this.undoRedoManager.addChange(
        {
          selector,
          type: 'style',
          value: { 'background-image': `url('${newSrc}')` },
          mode: 'merge'
        },
        { 'background-image': oldBgImage }
      )

      console.log('[handleChangeImageSource] Created style change for background-image')
    }

    this.notifications.show('Image source updated', '', 'success')
  }

  showRelativeElementSelector(element: Element): void {
    // Remove any existing selector
    const existingSelector = document.getElementById('absmartly-relative-selector-host')
    if (existingSelector) existingSelector.remove()

    // Create host element for shadow DOM
    const selectorHost = document.createElement('div')
    selectorHost.id = 'absmartly-relative-selector-host'
    selectorHost.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483647;
      pointer-events: none;
    `

    // Attach shadow root
    const shadow = selectorHost.attachShadow({ mode: 'closed' })

    // Create styles
    const style = document.createElement('style')
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        pointer-events: auto;
      }

      .panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        padding: 20px;
        min-width: 400px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 15px;
        color: #333;
      }

      .element-tree {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .element-item {
        display: flex;
        align-items: center;
        padding: 10px;
        border: 2px solid #e0e0e0;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
      }

      .element-item:hover {
        border-color: #3b82f6;
        background: #f0f9ff;
      }

      .element-item.current {
        border-color: #10b981;
        background: #f0fdf4;
      }

      .element-info {
        flex: 1;
      }

      .element-tag {
        font-weight: 600;
        color: #1e40af;
        font-size: 14px;
      }

      .element-class {
        color: #059669;
        font-size: 12px;
        margin-top: 2px;
      }

      .element-id {
        color: #dc2626;
        font-size: 12px;
      }

      .element-level {
        font-size: 11px;
        color: #6b7280;
        margin-left: auto;
        padding: 2px 8px;
        background: #f3f4f6;
        border-radius: 4px;
      }

      .close-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        width: 30px;
        height: 30px;
        border: none;
        background: #f3f4f6;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: #6b7280;
        transition: all 0.2s;
      }

      .close-btn:hover {
        background: #e5e7eb;
        color: #374151;
      }

      .indent {
        width: 20px;
        display: inline-block;
      }
    `
    shadow.appendChild(style)

    // Create backdrop
    const backdrop = document.createElement('div')
    backdrop.className = 'backdrop'

    // Create panel
    const panel = document.createElement('div')
    panel.className = 'panel'

    // Create title
    const title = document.createElement('div')
    title.className = 'title'
    title.textContent = 'Select Element'

    // Create close button
    const closeBtn = document.createElement('button')
    closeBtn.className = 'close-btn'
    closeBtn.textContent = '✕'
    closeBtn.onclick = () => {
      // Clean up any temp highlights
      document.querySelectorAll('.absmartly-temp-highlight').forEach(elem => {
        elem.classList.remove('absmartly-temp-highlight')
      })
      // Clean up temp style
      document.getElementById('absmartly-temp-highlight-style')?.remove()
      selectorHost.remove()
    }

    // Create element tree
    const elementTree = document.createElement('div')
    elementTree.className = 'element-tree'

    // Build parent hierarchy
    const parents: Element[] = []
    let currentEl: Element | null = element
    while (currentEl && currentEl !== document.body && currentEl !== document.documentElement) {
      parents.unshift(currentEl)
      currentEl = currentEl.parentElement
    }

    // Add body and html if needed
    if (document.body && !parents.includes(document.body)) {
      parents.unshift(document.body)
    }

    // Create element items
    parents.forEach((el, index) => {
      const item = document.createElement('div')
      item.className = 'element-item'
      if (el === element) {
        item.classList.add('current')
      }

      // Add indentation based on level
      const indent = document.createElement('span')
      indent.className = 'indent'
      indent.style.width = `${index * 20}px`

      const info = document.createElement('div')
      info.className = 'element-info'
      info.style.marginLeft = `${index * 20}px`

      const tag = document.createElement('div')
      tag.className = 'element-tag'
      tag.textContent = el.tagName.toLowerCase()

      info.appendChild(tag)

      if (el.id) {
        const id = document.createElement('div')
        id.className = 'element-id'
        id.textContent = `#${el.id}`
        info.appendChild(id)
      }

      if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ').filter(c => c && !c.startsWith('absmartly'))
        if (classes.length > 0) {
          const classDiv = document.createElement('div')
          classDiv.className = 'element-class'
          classDiv.textContent = `.${classes.join('.')}`
          info.appendChild(classDiv)
        }
      }

      const level = document.createElement('div')
      level.className = 'element-level'
      level.textContent = el === element ? 'Current' : `Level ${index}`

      item.appendChild(info)
      item.appendChild(level)

      // Add hover handler to highlight element on page
      item.onmouseenter = () => {
        // Remove any existing highlights
        document.querySelectorAll('.absmartly-temp-highlight').forEach(elem => {
          elem.classList.remove('absmartly-temp-highlight')
        })
        // Add highlight to hovered element
        el.classList.add('absmartly-temp-highlight')

        // Add a temporary style if it doesn't exist
        if (!document.getElementById('absmartly-temp-highlight-style')) {
          const tempStyle = document.createElement('style')
          tempStyle.id = 'absmartly-temp-highlight-style'
          tempStyle.textContent = `
            .absmartly-temp-highlight {
              outline: 3px solid #3b82f6 !important;
              outline-offset: 2px !important;
              background-color: rgba(59, 130, 246, 0.1) !important;
            }
          `
          document.head.appendChild(tempStyle)
        }
      }

      item.onmouseleave = () => {
        // Remove highlight when not hovering
        el.classList.remove('absmartly-temp-highlight')
      }

      // Add click handler
      item.onclick = (e) => {
        e.stopPropagation()

        // Clean up any temp highlights and styles
        document.querySelectorAll('.absmartly-temp-highlight').forEach(elem => {
          elem.classList.remove('absmartly-temp-highlight')
        })
        document.getElementById('absmartly-temp-highlight-style')?.remove()

        // Remove the selector panel first
        selectorHost.remove()

        // Clear previous selection
        const currentSelected = this.stateManager.getState().selectedElement
        if (currentSelected) {
          currentSelected.classList.remove('absmartly-selected')
        }

        // Select the new element and update coordinator's state

        this.stateManager.setSelectedElement(el as HTMLElement)
        this.selectedElement = el as HTMLElement  // Important: update coordinator's selectedElement
        el.classList.add('absmartly-selected')

        // Store original values for the element (same as in event-handlers.ts)
        const config = this.stateManager.getConfig()
        if (!(el as HTMLElement).dataset.absmartlyOriginal) {
          (el as HTMLElement).dataset.absmartlyOriginal = JSON.stringify({
            textContent: el.textContent,
            innerHTML: el.innerHTML
            // Store both to support both text and HTML editing modes
          })
          ;(el as HTMLElement).dataset.absmartlyExperiment = config.experimentName || '__preview__'
        }

        // Get position near the selected element on the page (not the panel)
        const elementRect = el.getBoundingClientRect()
        // Position menu to the right of the element if there's space, otherwise to the left
        let menuX = elementRect.right + 10
        let menuY = elementRect.top + 10

        // Adjust if menu would go off screen
        if (menuX + 220 > window.innerWidth) {
          menuX = Math.max(10, elementRect.left - 230)
        }
        if (menuY + 600 > window.innerHeight) {
          menuY = Math.max(10, window.innerHeight - 610)
        }

        // Ensure menu position is within viewport
        menuX = Math.min(Math.max(10, menuX), window.innerWidth - 230)
        menuY = Math.min(Math.max(10, menuY), window.innerHeight - 610)

        // Small delay to ensure DOM cleanup and prevent event conflicts
        setTimeout(() => {
          // Show context menu for the newly selected element
          this.contextMenu.show(menuX, menuY, el)
        }, 50)
      }

      elementTree.appendChild(item)
    })

    // Assemble panel
    panel.appendChild(title)
    panel.appendChild(closeBtn)
    panel.appendChild(elementTree)

    // Add to shadow DOM
    shadow.appendChild(backdrop)
    shadow.appendChild(panel)

    // Add to document
    document.body.appendChild(selectorHost)

    // Close on backdrop click
    backdrop.onclick = () => {
      // Clean up any temp highlights
      document.querySelectorAll('.absmartly-temp-highlight').forEach(elem => {
        elem.classList.remove('absmartly-temp-highlight')
      })
      // Clean up temp style
      document.getElementById('absmartly-temp-highlight-style')?.remove()
      selectorHost.remove()
    }
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
  teardownAll(restoreOriginalValues: boolean = true): void {
    console.log('[EditorCoordinator] Starting teardownAll', { restoreOriginalValues })

    // Call all registered cleanup handlers (includes removeBanner)
    this.cleanup.cleanupVisualEditor(restoreOriginalValues)

    // Additional cleanup
    this.removeEventListeners()
    this.stopMutationObserver()
    this.makeElementsNonEditable()

    // Explicitly remove banner in case it wasn't registered
    this.uiComponents.removeBanner()

    console.log('[EditorCoordinator] teardownAll completed')
  }
}