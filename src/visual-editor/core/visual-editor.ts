import StateManager from './state-manager'
import type { VisualEditorConfig } from './state-manager'
import EventHandlers from './event-handlers'
import ContextMenu from './context-menu'
import UndoRedoManager from './undo-redo-manager'
import UIComponents from '../ui/components'
import EditModes from './edit-modes'
import Cleanup from './cleanup'
import { Notifications } from '../ui/notifications'
import { ElementActions } from './element-actions'
import { EditorCoordinator } from './editor-coordinator'
import type { EditorCoordinatorCallbacks } from './editor-coordinator'
import type { DOMChange } from '../types/visual-editor'

import DOMPurify from 'dompurify'
import { debugLog, debugWarn } from '~src/utils/debug'
export interface VisualEditorOptions {
  variantName: string
  experimentName: string
  logoUrl: string
  onChangesUpdate: (changes: DOMChange[]) => void
  initialChanges?: DOMChange[]
  useShadowDOM?: boolean  // Use shadow DOM for context menu (default: true)
}

export class VisualEditor {
  private readonly VERSION = '3.0-UNIFIED'
  private _isActive = false
  private hasUnsavedChanges = false  // Track if there are unsaved changes since last save
  private lastSavedChangesCount = 0  // Track the number of changes at last save

  // Core modules
  private stateManager: StateManager
  private eventHandlers: EventHandlers
  private contextMenu: ContextMenu
  private undoRedoManager: UndoRedoManager
  private uiComponents: UIComponents
  private editModes: EditModes
  private cleanup: Cleanup
  private notifications: Notifications
  private elementActions: ElementActions
  private coordinator: EditorCoordinator

  // Configuration
  private options: VisualEditorOptions

  constructor(options: VisualEditorOptions) {
    debugLog('[VisualEditor] Constructor called with options:', options)
    debugLog('[VisualEditor] Experiment name from options:', options.experimentName)
    this.options = options

    this.lastSavedChangesCount = options.initialChanges?.length || 0
    this.hasUnsavedChanges = false

    const config: VisualEditorConfig = {
      variantName: options.variantName,
      experimentName: options.experimentName,
      logoUrl: options.logoUrl,
      initialChanges: options.initialChanges || []
    }
    this.stateManager = new StateManager(config)

    this.eventHandlers = new EventHandlers(this.stateManager)
    this.contextMenu = new ContextMenu(this.stateManager, options.useShadowDOM)
    this.undoRedoManager = new UndoRedoManager()

    this.undoRedoManager.setOnChangeAdded(() => {
      this.hasUnsavedChanges = true
    })

    if (options.initialChanges && options.initialChanges.length > 0) {
      options.initialChanges.forEach(change => {
        this.undoRedoManager.addChange(change, null)
      })
      this.hasUnsavedChanges = false
    }

    this.uiComponents = new UIComponents(this.stateManager)
    this.editModes = new EditModes(this.stateManager)
    this.cleanup = new Cleanup(this.stateManager)
    this.notifications = new Notifications()

    this.editModes.setAddChangeCallback((change) => {
      debugLog('[VisualEditor] EditModes addChange callback triggered with:', change)
      this.undoRedoManager.addChange(change, null)
    })

    // Initialize element actions
    this.elementActions = new ElementActions(
      this.stateManager,
      this.undoRedoManager,
      this.notifications,
      {
        onChangesUpdate: (changes: DOMChange[]) => {
          this.options.onChangesUpdate(changes)
        },
        setHoverEnabled: (enabled: boolean) => {
          this.eventHandlers.setHoverEnabled(enabled)
        }
      }
    )

    // Setup coordinator callbacks
    const callbacks: EditorCoordinatorCallbacks = {
      onChangesUpdate: this.options.onChangesUpdate,
      removeStyles: () => this.removeStyles(),
      getSelector: (element: HTMLElement) => this.elementActions.getSelector(element),
      hideElement: () => this.elementActions.hideElement(),
      deleteElement: () => this.elementActions.deleteElement(),
      copyElement: () => this.elementActions.copyElement(),
      copySelectorPath: () => this.elementActions.copySelectorPath(),
      moveElement: (direction: 'up' | 'down') => this.elementActions.moveElement(direction),
      insertNewBlock: () => this.elementActions.insertNewBlock(),
      showRelativeElementSelector: () => this.elementActions.showRelativeElementSelector(),
      changeImageSource: () => this.elementActions.changeImageSource(),
      undoLastChange: () => this.undoLastChange(),
      redoChange: () => this.redoChange(),
      undo: () => this.undoLastChange(),
      redo: () => this.redoChange(),
      clearAllChanges: () => this.elementActions.clearAllChanges(),
      saveChanges: () => this.saveChanges(),
      stop: () => this.stop()
    }

    this.coordinator = new EditorCoordinator(
      this.stateManager,
      this.eventHandlers,
      this.contextMenu,
      this.undoRedoManager,
      this.uiComponents,
      this.editModes,
      this.cleanup,
      null, // toolbar removed - using UIComponents banner
      this.notifications,
      callbacks
    )
  }

  start(): { success: boolean; already?: boolean } {
    debugLog('[ABSmartly] Starting unified visual editor - Version:', this.VERSION)
    debugLog('[ABSmartly] Build timestamp:', new Date().toISOString())

    // Check if already active (single source of truth: this._isActive)
    if (this._isActive) {
      debugLog('[ABSmartly] Already active, returning')
      return { success: true, already: true }
    }

    debugLog('[ABSmartly] Starting visual editor')

    // Mark as active
    this._isActive = true

    // Keep preview header visible when visual editor starts
    // Users should see both the preview header and visual editor UI
    const previewHeader = document.getElementById('absmartly-preview-header')
    if (previewHeader) {
      debugLog('[ABSmartly] Preview header found, keeping it visible')
    }

    // Create UI and setup everything
    this.injectStyles()
    this.addGlobalStyles()

    // Use coordinator to setup all modules and integrations
    this.coordinator.setupAll()

    // Create the visual editor banner/header
    this.uiComponents.createBanner()
    debugLog('[ABSmartly] Visual editor banner created')

    // Show notification
    this.notifications.show('Visual Editor Active', 'Click any element to edit', 'success')
    debugLog('[ABSmartly] Visual editor is now active!')

    return { success: true }
  }

  stop(): void {
    if (!this._isActive) return

    // Check for unsaved changes
    if (this.hasUnsavedChanges) {
      const confirmExit = window.confirm(
        'You have unsaved changes. Are you sure you want to exit?\n\n' +
        'Click "Cancel" to go back and save your changes.'
      )
      if (!confirmExit) {
        debugLog('[ABSmartly] User cancelled exit due to unsaved changes')
        return
      }
    }

    debugLog('[ABSmartly] Stopping unified visual editor')
    console.trace('[ABSmartly] Stop called from:')

    this._isActive = false

    // Only send changes if they haven't been saved already
    const finalChanges = this.stateManager.getState().changes || []
    debugLog('[ABSmartly] Final changes on exit:', finalChanges.length)

    // Only send changes if we have unsaved changes (user chose to discard)
    // If changes were saved, they've already been sent
    if (this.hasUnsavedChanges) {
      debugLog('[ABSmartly] Discarding unsaved changes on exit')
      // Don't send the unsaved changes - user chose to discard them
    } else {
      // Changes were already saved and sent
      debugLog('[ABSmartly] Changes were already saved')
    }

    // Use coordinator to teardown all modules
    // If changes were saved, DON'T restore original values (preview mode will re-apply with markers)
    // If changes were discarded, DO restore original values
    const shouldRestoreOriginalValues = this.hasUnsavedChanges
    debugLog('[ABSmartly] Teardown with restoreOriginalValues:', shouldRestoreOriginalValues)
    this.coordinator.teardownAll(shouldRestoreOriginalValues)

    // Remove styles
    this.removeStyles()

    // Send message to content script to stop visual editor
    const targetOrigin =
      window.location.origin === 'null' || window.location.protocol === 'file:'
        ? '*'
        : window.location.origin
    window.postMessage({
      source: 'absmartly-visual-editor',
      type: 'ABSMARTLY_VISUAL_EDITOR_EXIT',
      changes: finalChanges
    }, targetOrigin)
  }

  destroy(): void {
    this.stop()
  }

  getChanges(): DOMChange[] {
    return this.undoRedoManager.squashChanges()
  }

  get experimentName(): string {
    return this.options.experimentName
  }

  get variantName(): string {
    return this.options.variantName
  }

  // Style injection methods
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

  // Change management methods
  private squashChanges(changes: DOMChange[]): DOMChange[] {
    debugLog('[ABSmartly] Squashing changes from', changes.length, 'to consolidated list')

    // Group changes by selector and type
    const changeMap = new Map<string, DOMChange>()

    for (const change of changes) {
      const key = `${change.selector}-${change.type}`
      const existing = changeMap.get(key)

      if (existing) {
        // Merge changes of the same type for the same element
        if (change.type === 'style' && existing.type === 'style') {
          // Merge style changes
          existing.value = {
            ...existing.value,
            ...change.value
          }
        } else if (change.type === 'move' && existing.type === 'move') {
          // For moves, replace with the latest change (final position)
          changeMap.set(key, change)
        } else {
          // For other types, replace with the latest change
          changeMap.set(key, change)
        }
      } else {
        changeMap.set(key, change)
      }
    }

    const squashed = Array.from(changeMap.values())
    debugLog('[ABSmartly] Squashed to', squashed.length, 'changes')

    // Log move changes to debug missing targetSelector
    squashed.forEach(change => {
      if (change.type === 'move') {
        debugLog('[ABSmartly] Move change after squashing:', {
          selector: change.selector,
          targetSelector: change.targetSelector,
          position: change.position
        })
      }
    })

    return squashed
  }

  private storeOriginalValuesInDOM(changes: DOMChange[]): void {
    debugLog('[ABSmartly] Storing original values in DOM for', changes.length, 'changes')

    for (const change of changes) {
      try {
        const elements = document.querySelectorAll(change.selector)

        elements.forEach(element => {
          const htmlElement = element as HTMLElement

          // Initialize or get existing original data
          if (!htmlElement.dataset.absmartlyOriginal) {
            htmlElement.dataset.absmartlyOriginal = JSON.stringify({})
          }

          let originalData: any = {}
          try {
            originalData = JSON.parse(htmlElement.dataset.absmartlyOriginal)
          } catch (e) {
            console.error('[ABSmartly] Failed to parse original data:', e)
          }

          // Store original values based on change type
          if (change.type === 'text' && !originalData.text) {
            originalData.text = htmlElement.textContent || ''
          } else if (change.type === 'html' && !originalData.html) {
            originalData.html = htmlElement.innerHTML
          } else if (change.type === 'style' && !originalData.styles) {
            // Store original styles
            const computedStyle = window.getComputedStyle(htmlElement)
            originalData.styles = {}
            if (change.value && typeof change.value === 'object') {
              for (const prop in change.value) {
                originalData.styles[prop] = htmlElement.style[prop] || computedStyle[prop as any] || ''
              }
            }
          } else if (change.type === 'move' && !originalData.move) {
            // Store original position for move - capture current position before it's moved
            const parent = htmlElement.parentElement
            const nextSibling = htmlElement.nextElementSibling
            if (parent) {
              originalData.move = {
                parentId: parent.id || '',
                parentClass: parent.className || '',
                nextSiblingId: nextSibling?.id || '',
                nextSiblingClass: nextSibling?.className || ''
              }
            }
          } else if (change.type === 'attribute' && !originalData.attributes) {
            originalData.attributes = {}
            if (change.value && typeof change.value === 'object') {
              for (const attrName in change.value) {
                originalData.attributes[attrName] = htmlElement.getAttribute(attrName) || ''
              }
            }
          } else if (change.type === 'class') {
            if (!originalData.className) {
              originalData.className = htmlElement.className || ''
            }
          }

          // Mark element as modified and store experiment info
          htmlElement.dataset.absmartlyModified = 'true'
          htmlElement.dataset.absmartlyExperiment = this.options.experimentName || '__preview__'
          htmlElement.dataset.absmartlyOriginal = JSON.stringify(originalData)

          debugLog('[ABSmartly] Stored original data for', change.selector, ':', originalData)
        })
      } catch (error) {
        console.error('[ABSmartly] Error storing original values for', change.selector, error)
      }
    }
  }

  private saveChanges(): void {
    // Get the latest changes from undo/redo manager
    const currentChanges = this.undoRedoManager.squashChanges()
    debugLog('[ABSmartly] Saving changes - raw count:', currentChanges.length)

    // Squash changes to consolidate multiple operations on same elements
    const squashedChanges = this.squashChanges(currentChanges)
    debugLog('[ABSmartly] Squashed changes count:', squashedChanges.length)

    // Store original values in DOM for preview toggle functionality
    this.storeOriginalValuesInDOM(squashedChanges)

    // Log what we're sending to sidebar
    debugLog('[ABSmartly] Sending squashed changes to sidebar:')
    squashedChanges.forEach((change, index) => {
      if (change.type === 'move') {
        debugLog(`[ABSmartly] Move change ${index}:`, JSON.stringify(change, null, 2))
      }
    })

    try {
      // Send squashed changes to sidebar
      this.options.onChangesUpdate(squashedChanges)
    } catch (error) {
      console.error('Error in onChangesUpdate callback:', error)
    }

    // Mark changes as saved
    this.hasUnsavedChanges = false
    this.lastSavedChangesCount = squashedChanges.length

    this.notifications.show(`${squashedChanges.length} changes saved`, '', 'success')

    // Exit the visual editor after saving
    setTimeout(() => {
      this.stop()
    }, 500) // Small delay to show success message
  }

  private undoLastChange(): void {
    const record = this.undoRedoManager.undo()
    if (!record) {
      this.notifications.show('Nothing to undo', '', 'info')
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
        htmlElement.innerHTML = DOMPurify.sanitize(oldValue)
      } else if (change.type === 'style' && oldValue) {
        Object.assign(htmlElement.style, oldValue)
      } else if (change.type === 'remove') {
        // Undo remove: show the element again (it was hidden with display: none)
        // The element was not actually removed, just hidden
        if (element && htmlElement.style.display === 'none') {
          // Restore the original display value from stored data
          const storedData = htmlElement.dataset.absmartlyOriginal
          if (storedData) {
            try {
              const originalData = JSON.parse(storedData)
              const originalDisplay = originalData.styles?.display || ''
              htmlElement.style.display = originalDisplay
            } catch (e) {
              // If parsing fails, just show the element
              htmlElement.style.display = ''
            }
          } else {
            htmlElement.style.display = ''
          }
        }
      } else if (change.type === 'insert') {
        // Undo insert: remove the inserted element
        if (oldValue && oldValue.insertedSelector) {
          const insertedElements = document.querySelectorAll(oldValue.insertedSelector)
          insertedElements.forEach(el => el.remove())
        }
      } else if (change.type === 'move') {
        // Undo move: restore to original position
        if (oldValue && oldValue.parent && element) {
          const parent = document.querySelector(oldValue.parent)
          if (parent) {
            if (oldValue.nextSibling) {
              const nextSibling = parent.querySelector(`:scope > *:nth-child(${oldValue.nextSibling})`)
              parent.insertBefore(element, nextSibling)
            } else {
              parent.appendChild(element)
            }
          }
        }
      } else if (change.type === 'class' && oldValue) {
        // Restore original classes
        htmlElement.className = oldValue
      } else if (change.type === 'attribute' && oldValue) {
        // Restore original attributes
        Object.keys(oldValue).forEach(attr => {
          if (oldValue[attr] === null) {
            htmlElement.removeAttribute(attr)
          } else {
            htmlElement.setAttribute(attr, oldValue[attr])
          }
        })
      }
    })

    // Update UI
    this.updateBannerState()
    this.notifications.show('Change undone', '', 'success')
  }

  private redoChange(): void {
    const record = this.undoRedoManager.redo()
    if (!record) {
      this.notifications.show('Nothing to redo', '', 'info')
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
        htmlElement.innerHTML = DOMPurify.sanitize(change.value)
      } else if (change.type === 'style' && change.value) {
        Object.assign(htmlElement.style, change.value)
      } else if (change.type === 'remove') {
        // Redo remove: hide the element again (set display: none)
        if (element && htmlElement) {
          htmlElement.style.display = 'none'
        }
      } else if (change.type === 'insert') {
        // Redo insert: insert the element again
        const insertChange = change as any
        if (insertChange.html && insertChange.position) {
          const tempContainer = document.createElement('div')
          tempContainer.innerHTML = DOMPurify.sanitize(insertChange.html)
          const newElement = tempContainer.firstElementChild
          if (newElement && element) {
            if (insertChange.position === 'before') {
              element.parentElement?.insertBefore(newElement, element)
            } else if (insertChange.position === 'after') {
              element.parentElement?.insertBefore(newElement, element.nextSibling)
            } else if (insertChange.position === 'firstChild') {
              element.insertBefore(newElement, element.firstChild)
            } else if (insertChange.position === 'lastChild') {
              element.appendChild(newElement)
            }
          }
        }
      } else if (change.type === 'move') {
        // Redo move: move to new position
        const moveChange = change as any
        if (moveChange.targetSelector && moveChange.position && element) {
          const target = document.querySelector(moveChange.targetSelector)
          if (target) {
            if (moveChange.position === 'before') {
              target.parentElement?.insertBefore(element, target)
            } else if (moveChange.position === 'after') {
              target.parentElement?.insertBefore(element, target.nextSibling)
            } else if (moveChange.position === 'firstChild') {
              target.insertBefore(element, target.firstChild)
            } else if (moveChange.position === 'lastChild') {
              target.appendChild(element)
            }
          }
        }
      } else if (change.type === 'class') {
        // Redo class change
        const classChange = change as any
        if (classChange.add) {
          classChange.add.forEach((cls: string) => htmlElement.classList.add(cls))
        }
        if (classChange.remove) {
          classChange.remove.forEach((cls: string) => htmlElement.classList.remove(cls))
        }
      } else if (change.type === 'attribute' && change.value) {
        // Redo attribute change
        Object.keys(change.value).forEach(attr => {
          htmlElement.setAttribute(attr, (change.value as any)[attr])
        })
      }
    })

    // Update UI
    this.updateBannerState()
    this.notifications.show('Change redone', '', 'success')
  }

  private updateBannerState(): void {
    this.uiComponents.updateBanner({
      changesCount: this.undoRedoManager.getUndoCount(),
      canUndo: this.undoRedoManager.canUndo(),
      canRedo: this.undoRedoManager.canRedo()
    })
  }

  public disable(): void {
    debugLog('[VisualEditor] Disabling visual editor')
    this._isActive = false
    this.eventHandlers.setHoverEnabled(false)
  }

  public enable(): void {
    debugLog('[VisualEditor] Enabling visual editor')
    this._isActive = true
    this.eventHandlers.setHoverEnabled(true)
  }

  public get isActive(): boolean {
    return this._isActive
  }
}

// Main entry point function for compatibility
export function initVisualEditor(
  variantName: string,
  experimentName: string,
  logoUrl: string,
  initialChanges: any[]
): { success: boolean; already?: boolean } {
  debugLog('[ABSmartly] Initializing unified visual editor')

  const options: VisualEditorOptions = {
    variantName,
    experimentName,
    logoUrl,
    initialChanges,
    onChangesUpdate: (changes) => {
      // Send changes to extension background
      const targetOrigin =
        window.location.origin === 'null' || window.location.protocol === 'file:'
          ? '*'
          : window.location.origin
      window.postMessage({
        source: 'absmartly-visual-editor',
        type: 'ABSMARTLY_VISUAL_EDITOR_SAVE',
        changes,
        experimentName,
        variantName
      }, targetOrigin)
    }
  }

  const editor = new VisualEditor(options)
  const result = editor.start()

  // Store editor instance globally for potential external access
  ;(window as any).__absmartlyVisualEditor = editor

  return result
}
