/**
 * Unified Visual Editor
 * Refactored to use ElementActions and EditorCoordinator for better separation of concerns
 */

import StateManager, { VisualEditorConfig } from './state-manager'
import EventHandlers from './event-handlers'
import ContextMenu from './context-menu'
import ChangeTracker from './change-tracker'
import UIComponents from '../ui/components'
import EditModes from './edit-modes'
import Cleanup from './cleanup'
// Removed toolbar import - using UIComponents banner instead
import { Notifications } from '../ui/notifications'
import { ElementActions } from './element-actions'
import { EditorCoordinator, EditorCoordinatorCallbacks } from './editor-coordinator'
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

  // Core modules
  private stateManager: StateManager
  private eventHandlers: EventHandlers
  private contextMenu: ContextMenu
  private changeTracker: ChangeTracker
  private uiComponents: UIComponents
  private editModes: EditModes
  private cleanup: Cleanup
  // Removed toolbar - using UIComponents banner instead
  private notifications: Notifications
  private elementActions: ElementActions
  private coordinator: EditorCoordinator

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

    // Initialize all core modules (required by EditorCoordinator)
    this.eventHandlers = new EventHandlers(this.stateManager)
    this.contextMenu = new ContextMenu(this.stateManager)
    this.changeTracker = new ChangeTracker(this.stateManager)
    this.uiComponents = new UIComponents(this.stateManager)
    this.editModes = new EditModes(this.stateManager)
    this.cleanup = new Cleanup(this.stateManager)
    // Removed toolbar - using UIComponents banner instead
    this.notifications = new Notifications()

    // Initialize element actions
    this.elementActions = new ElementActions(
      this.stateManager,
      this.changeTracker,
      this.notifications,
      {
        onChangesUpdate: (changes: DOMChange[]) => {
          // Sync changes with visual editor's internal state
          this.changes = changes
          this.options.onChangesUpdate(changes)
        },
        addChange: (change: DOMChange) => {
          // Delegate to visual editor's addChange for proper undo/redo management
          console.log('[VisualEditor] ElementActions delegating addChange')
          this.addChange(change)
        }
      }
    )

    // Setup coordinator callbacks
    const callbacks: EditorCoordinatorCallbacks = {
      onChangesUpdate: this.options.onChangesUpdate,
      removeStyles: () => this.removeStyles(),
      addChange: (change: DOMChange) => {
        console.log('[VisualEditor] addChange callback called with:', change)
        this.addChange(change)
      },
      getSelector: (element: HTMLElement) => this.elementActions.getSelector(element),
      hideElement: () => this.elementActions.hideElement(),
      deleteElement: () => this.elementActions.deleteElement(),
      copyElement: () => this.elementActions.copyElement(),
      copySelectorPath: () => this.elementActions.copySelectorPath(),
      moveElement: (direction: 'up' | 'down') => this.elementActions.moveElement(direction),
      insertNewBlock: () => this.elementActions.insertNewBlock(),
      showRelativeElementSelector: () => this.elementActions.showRelativeElementSelector(),
      undoLastChange: () => this.elementActions.undoLastChange(),
      redoChange: () => this.elementActions.redoChange(),
      clearAllChanges: () => this.elementActions.clearAllChanges(),
      saveChanges: () => this.saveChanges(),
      stop: () => this.stop()
    }

    // Initialize coordinator with all required modules
    this.coordinator = new EditorCoordinator(
      this.stateManager,
      this.eventHandlers,
      this.contextMenu,
      this.changeTracker,
      this.uiComponents,
      this.editModes,
      this.cleanup,
      null, // toolbar removed - using UIComponents banner
      this.notifications,
      callbacks
    )
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

    // Keep preview header visible when visual editor starts
    // Users should see both the preview header and visual editor UI
    const previewHeader = document.getElementById('absmartly-preview-header')
    if (previewHeader) {
      console.log('[ABSmartly] Preview header found, keeping it visible')
    }

    // Create UI and setup everything
    this.injectStyles()
    this.addGlobalStyles()

    // Use coordinator to setup all modules and integrations
    this.coordinator.setupAll()

    // Create the visual editor banner/header
    this.uiComponents.createBanner()
    console.log('[ABSmartly] Visual editor banner created')

    // Show notification
    this.notifications.show('Visual Editor Active', 'Click any element to edit', 'success')
    console.log('[ABSmartly] Visual editor is now active!')

    return { success: true }
  }

  stop(): void {
    if (!this.isActive) return

    console.log('[ABSmartly] Stopping unified visual editor')
    console.trace('[ABSmartly] Stop called from:')

    this.isActive = false
    ;(window as any).__absmartlyVisualEditorActive = false

    // Save final changes from state manager
    const finalChanges = this.stateManager.getState().changes || []
    console.log('[ABSmartly] Final changes on exit:', finalChanges.length)
    this.options.onChangesUpdate(finalChanges)

    // Use coordinator to teardown all modules
    this.coordinator.teardownAll()

    // Remove styles
    this.removeStyles()

    // Send message to content script to stop visual editor
    window.postMessage({
      type: 'ABSMARTLY_VISUAL_EDITOR_EXIT',
      changes: finalChanges
    }, '*')
  }

  destroy(): void {
    this.stop()
  }

  getChanges(): DOMChange[] {
    return this.changes
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
  private addChange(change: DOMChange): void {
    console.log('[VisualEditor] addChange called with:', change)
    console.log('[VisualEditor] Current changes count before:', this.changes.length)

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

    console.log('[VisualEditor] New changes count:', this.changes.length)
    console.log('[VisualEditor] Updating state manager with changes')

    // Update state manager with new changes array
    this.stateManager.setChanges(this.changes)

    // Auto-save changes to the sidebar
    try {
      console.log('[VisualEditor] Calling onChangesUpdate callback with', this.changes.length, 'changes')
      this.options.onChangesUpdate(this.changes)
    } catch (error) {
      console.error('Error in onChangesUpdate callback:', error)
    }
  }

  private saveChanges(): void {
    // Get the latest changes from the state manager
    const currentChanges = this.stateManager.getState().changes || []
    console.log('[ABSmartly] Saving changes:', currentChanges.length, 'changes')

    try {
      this.options.onChangesUpdate(currentChanges)
    } catch (error) {
      console.error('Error in onChangesUpdate callback:', error)
    }
    this.notifications.show(`${currentChanges.length} changes saved`, '', 'success')

    // Exit the visual editor after saving (but keep preview active)
    setTimeout(() => {
      this.stop()
    }, 500) // Small delay to show success message
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