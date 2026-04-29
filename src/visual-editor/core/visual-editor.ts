import DOMPurify from "dompurify"

import { debugLog, debugWarn } from "~src/utils/debug"

import type { DOMChange } from "../types/visual-editor"
import UIComponents from "../ui/components"
import { Notifications } from "../ui/notifications"
import Cleanup from "./cleanup"
import ContextMenu from "./context-menu"
import EditModes from "./edit-modes"
import { EditorCoordinator } from "./editor-coordinator"
import type { EditorCoordinatorCallbacks } from "./editor-coordinator"
import { ElementActions } from "./element-actions"
import EventHandlers from "./event-handlers"
import {
  applyChangesViaSDK,
  clearChangesViaSDK,
  isProductionPreviewActive,
  VISUAL_EDITOR_EXPERIMENT_NAME
} from "./sdk-applier"
import StateManager from "./state-manager"
import type { VisualEditorConfig } from "./state-manager"
import UndoRedoManager from "./undo-redo-manager"

export interface VisualEditorOptions {
  variantName: string
  experimentName: string
  logoUrl: string
  onChangesUpdate: (changes: DOMChange[]) => void
  initialChanges?: DOMChange[]
  useShadowDOM?: boolean // Use shadow DOM for context menu (default: true)
}

export class VisualEditor {
  private readonly VERSION = "3.0-UNIFIED"
  private _isActive = false
  private hasUnsavedChanges = false // Track if there are unsaved changes since last save
  private lastSavedChangesCount = 0 // Track the number of changes at last save
  // Last persisted change list — used to re-establish production preview on
  // VE exit if it was active when VE started.
  private lastSavedChanges: DOMChange[] = []
  // Whether the active-experiment preview header was on when VE started, so
  // we can put it back on stop().
  private wasProductionPreviewActive = false

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
    debugLog("[VisualEditor] Constructor called with options:", options)
    debugLog(
      "[VisualEditor] Experiment name from options:",
      options.experimentName
    )
    this.options = options

    this.lastSavedChangesCount = options.initialChanges?.length || 0
    this.lastSavedChanges = options.initialChanges || []
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

    // Every committed change reapplies the full list through the SDK plugin
    // (replace mode). This is the SAME apply codepath production preview uses,
    // so a regression in the SDK surfaces immediately during editing rather
    // than silently after save.
    this.undoRedoManager.setOnChangeAdded(() => {
      this.hasUnsavedChanges = true
      if (!this._isActive) return // suppress during constructor seeding
      applyChangesViaSDK(
        this.undoRedoManager.squashChanges(),
        VISUAL_EDITOR_EXPERIMENT_NAME,
        this.options.variantName
      )
    })

    if (options.initialChanges && options.initialChanges.length > 0) {
      options.initialChanges.forEach((change) => {
        this.undoRedoManager.addChange(change, null)
      })
      this.hasUnsavedChanges = false
    }

    this.uiComponents = new UIComponents(this.stateManager)
    this.editModes = new EditModes(this.stateManager)
    this.cleanup = new Cleanup(this.stateManager)
    this.notifications = new Notifications()

    this.editModes.setAddChangeCallback((change) => {
      debugLog(
        "[VisualEditor] EditModes addChange callback triggered with:",
        change
      )
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
      getSelector: (element: HTMLElement) =>
        this.elementActions.getSelector(element),
      hideElement: () => this.elementActions.hideElement(),
      deleteElement: () => this.elementActions.deleteElement(),
      copyElement: () => this.elementActions.copyElement(),
      copySelectorPath: () => this.elementActions.copySelectorPath(),
      moveElement: (direction: "up" | "down") =>
        this.elementActions.moveElement(direction),
      insertNewBlock: () => this.elementActions.insertNewBlock(),
      showRelativeElementSelector: () =>
        this.elementActions.showRelativeElementSelector(),
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
    debugLog(
      "[ABSmartly] Starting unified visual editor - Version:",
      this.VERSION
    )
    debugLog("[ABSmartly] Build timestamp:", new Date().toISOString())

    // Check if already active (single source of truth: this._isActive)
    if (this._isActive) {
      debugLog("[ABSmartly] Already active, returning")
      return { success: true, already: true }
    }

    debugLog("[ABSmartly] Starting visual editor")

    // Mark as active
    this._isActive = true

    // Snapshot whether production preview was on, then tear it down so we
    // start with a clean SDK state. The VE owns the page during editing
    // under a dedicated experiment name; on stop() we put production
    // preview back if it was on.
    this.wasProductionPreviewActive = isProductionPreviewActive()
    if (this.wasProductionPreviewActive) {
      debugLog(
        "[ABSmartly] Production preview was active — clearing before VE takes over",
        { experimentName: this.options.experimentName }
      )
      clearChangesViaSDK(this.options.experimentName)
    }

    // Apply the current change set under the dedicated VE experiment name.
    // Every subsequent VE commit will replay the full list under the same
    // name with updateMode: "replace", keeping PreviewManager state coherent.
    if (this.lastSavedChanges.length > 0) {
      applyChangesViaSDK(
        this.lastSavedChanges,
        VISUAL_EDITOR_EXPERIMENT_NAME,
        this.options.variantName
      )
    }

    // Keep preview header visible when visual editor starts
    // Users should see both the preview header and visual editor UI
    const previewHeader = document.getElementById("absmartly-preview-header")
    if (previewHeader) {
      debugLog("[ABSmartly] Preview header found, keeping it visible")
    }

    // Create UI and setup everything
    this.injectStyles()
    this.addGlobalStyles()

    // Use coordinator to setup all modules and integrations
    this.coordinator.setupAll()

    // Create the visual editor banner/header
    this.uiComponents.createBanner()
    debugLog("[ABSmartly] Visual editor banner created")

    // Show notification
    this.notifications.show(
      "Visual Editor Active",
      "Click any element to edit",
      "success"
    )
    debugLog("[ABSmartly] Visual editor is now active!")

    return { success: true }
  }

  stop(): void {
    if (!this._isActive) return

    // Check for unsaved changes
    if (this.hasUnsavedChanges) {
      const confirmExit = window.confirm(
        "You have unsaved changes. Are you sure you want to exit?\n\n" +
          'Click "Cancel" to go back and save your changes.'
      )
      if (!confirmExit) {
        debugLog("[ABSmartly] User cancelled exit due to unsaved changes")
        return
      }
    }

    debugLog("[ABSmartly] Stopping unified visual editor")
    console.trace("[ABSmartly] Stop called from:")

    this._isActive = false

    // Tear down VE-owned preview state. PreviewManager restores all elements
    // it touched under __visual_editor__ back to their pre-VE state.
    clearChangesViaSDK(VISUAL_EDITOR_EXPERIMENT_NAME)

    // If production preview was on when we started, put it back. We use
    // lastSavedChanges (updated by saveChanges) so the user sees the latest
    // persisted state, not the pre-VE state.
    if (this.wasProductionPreviewActive && this.lastSavedChanges.length > 0) {
      debugLog("[ABSmartly] Restoring production preview after VE exit", {
        experimentName: this.options.experimentName
      })
      applyChangesViaSDK(
        this.lastSavedChanges,
        this.options.experimentName,
        this.options.variantName
      )
    }
    this.wasProductionPreviewActive = false

    // Only send changes if they haven't been saved already
    const finalChanges = this.stateManager.getState().changes || []
    debugLog("[ABSmartly] Final changes on exit:", finalChanges.length)

    // Only send changes if we have unsaved changes (user chose to discard)
    // If changes were saved, they've already been sent
    if (this.hasUnsavedChanges) {
      debugLog("[ABSmartly] Discarding unsaved changes on exit")
      // Don't send the unsaved changes - user chose to discard them
    } else {
      // Changes were already saved and sent
      debugLog("[ABSmartly] Changes were already saved")
    }

    // Use coordinator to teardown all modules
    // If changes were saved, DON'T restore original values (preview mode will re-apply with markers)
    // If changes were discarded, DO restore original values
    const shouldRestoreOriginalValues = this.hasUnsavedChanges
    debugLog(
      "[ABSmartly] Teardown with restoreOriginalValues:",
      shouldRestoreOriginalValues
    )
    this.coordinator.teardownAll(shouldRestoreOriginalValues)

    // Remove styles
    this.removeStyles()

    // Send message to content script to stop visual editor
    const targetOrigin =
      window.location.origin === "null" || window.location.protocol === "file:"
        ? "*"
        : window.location.origin
    window.postMessage(
      {
        source: "absmartly-visual-editor",
        type: "ABSMARTLY_VISUAL_EDITOR_EXIT",
        changes: finalChanges
      },
      targetOrigin
    )
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
    const style = document.createElement("style")
    style.id = "absmartly-visual-editor-styles"
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
    document.getElementById("absmartly-visual-editor-styles")?.remove()
  }

  private addGlobalStyles(): void {
    const style = document.createElement("style")
    style.dataset.absmartly = "true"
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
    debugLog(
      "[ABSmartly] Squashing changes from",
      changes.length,
      "to consolidated list"
    )

    // Group changes by selector and type
    const changeMap = new Map<string, DOMChange>()

    changes.forEach((change, i) => {
      // Each 'create' adds a distinct new element, so they must not collapse
      // onto each other — give every one a unique key.
      const key =
        change.type === "create"
          ? `create-${i}`
          : `${change.selector}-${change.type}`
      const existing = changeMap.get(key)

      if (existing) {
        // Merge changes of the same type for the same element
        if (change.type === "style" && existing.type === "style") {
          // Merge style changes
          existing.value = {
            ...existing.value,
            ...change.value
          }
        } else if (change.type === "move" && existing.type === "move") {
          // For moves, replace with the latest change (final position)
          changeMap.set(key, change)
        } else {
          // For other types, replace with the latest change
          changeMap.set(key, change)
        }
      } else {
        changeMap.set(key, change)
      }
    })

    const squashed = Array.from(changeMap.values())
    debugLog("[ABSmartly] Squashed to", squashed.length, "changes")

    // Log move changes to debug missing targetSelector
    squashed.forEach((change) => {
      if (change.type === "move") {
        debugLog("[ABSmartly] Move change after squashing:", {
          selector: change.selector,
          targetSelector: change.targetSelector,
          position: change.position
        })
      }
    })

    return squashed
  }

  private saveChanges(): void {
    // Get the latest changes from undo/redo manager
    const currentChanges = this.undoRedoManager.squashChanges()
    debugLog("[ABSmartly] Saving changes - raw count:", currentChanges.length)

    // Squash changes to consolidate multiple operations on same elements
    const squashedChanges = this.squashChanges(currentChanges)
    debugLog("[ABSmartly] Squashed changes count:", squashedChanges.length)

    // Original element state is captured by PreviewManager.previewStateMap
    // when changes are applied via the SDK path; no need for the legacy
    // data-absmartly-original sidecar.

    // Log what we're sending to sidebar
    debugLog("[ABSmartly] Sending squashed changes to sidebar:")
    squashedChanges.forEach((change, index) => {
      if (change.type === "move") {
        debugLog(
          `[ABSmartly] Move change ${index}:`,
          JSON.stringify(change, null, 2)
        )
      }
    })

    try {
      // Send squashed changes to sidebar
      this.options.onChangesUpdate(squashedChanges)
    } catch (error) {
      console.error("Error in onChangesUpdate callback:", error)
    }

    // Mark changes as saved
    this.hasUnsavedChanges = false
    this.lastSavedChangesCount = squashedChanges.length
    this.lastSavedChanges = squashedChanges

    this.notifications.show(
      `${squashedChanges.length} changes saved`,
      "",
      "success"
    )

    // Exit the visual editor after saving
    setTimeout(() => {
      this.stop()
    }, 500) // Small delay to show success message
  }

  private undoLastChange(): void {
    const record = this.undoRedoManager.undo()
    if (!record) {
      this.notifications.show("Nothing to undo", "", "info")
      return
    }

    // With every commit going through the SDK in replace mode, undo is
    // simply: pop the change list, replay the remainder. PreviewManager
    // does the heavy lifting of reverting any element it touched (including
    // re-attaching deleted elements via the captured parent/nextSibling and
    // removing 'create'-inserted nodes from createdElementsMap).
    const variantName = this.options.variantName
    const remaining = this.undoRedoManager.squashChanges()
    applyChangesViaSDK(remaining, VISUAL_EDITOR_EXPERIMENT_NAME, variantName)

    this.updateBannerState()
    this.notifications.show("Change undone", "", "success")
  }

  private redoChange(): void {
    const record = this.undoRedoManager.redo()
    if (!record) {
      this.notifications.show("Nothing to redo", "", "info")
      return
    }

    const variantName = this.options.variantName
    const next = this.undoRedoManager.squashChanges()
    applyChangesViaSDK(next, VISUAL_EDITOR_EXPERIMENT_NAME, variantName)

    this.updateBannerState()
    this.notifications.show("Change redone", "", "success")
  }

  private updateBannerState(): void {
    this.uiComponents.updateBanner({
      changesCount: this.undoRedoManager.getUndoCount(),
      canUndo: this.undoRedoManager.canUndo(),
      canRedo: this.undoRedoManager.canRedo()
    })
  }

  public disable(): void {
    debugLog("[VisualEditor] Disabling visual editor")
    this._isActive = false
    this.eventHandlers.setHoverEnabled(false)
  }

  public enable(): void {
    debugLog("[VisualEditor] Enabling visual editor")
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
  debugLog("[ABSmartly] Initializing unified visual editor")

  const options: VisualEditorOptions = {
    variantName,
    experimentName,
    logoUrl,
    initialChanges,
    onChangesUpdate: (changes) => {
      // Send changes to extension background
      const targetOrigin =
        window.location.origin === "null" ||
        window.location.protocol === "file:"
          ? "*"
          : window.location.origin
      window.postMessage(
        {
          source: "absmartly-visual-editor",
          type: "ABSMARTLY_VISUAL_EDITOR_SAVE",
          changes,
          experimentName,
          variantName
        },
        targetOrigin
      )
    }
  }

  const editor = new VisualEditor(options)
  const result = editor.start()

  // Store editor instance globally for potential external access
  ;(window as any).__absmartlyVisualEditor = editor

  return result
}
