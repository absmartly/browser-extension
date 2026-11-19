/**
 * Cleanup Module for Visual Editor
 * Handles cleanup of DOM modifications, event listeners, and visual editor state
 */

import { debugLog, debugWarn } from "~src/utils/debug"

import StateManager from "./state-manager"

export class Cleanup {
  private stateManager: StateManager
  private eventHandlers: any[] = []

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  registerEventHandler(handler: () => void): void {
    this.eventHandlers.push(handler)
  }

  cleanupVisualEditor(restoreOriginalValues: boolean = true): void {
    debugLog("[ABSmartly] Starting visual editor cleanup...", {
      restoreOriginalValues
    })

    // 1. Remove visual editor CSS classes from all elements
    this.removeVisualEditorClasses()

    // 2. Remove visual editor DOM elements
    this.removeVisualEditorElements()

    // 3. Restore original values where possible (only if requested)
    // When preview mode is active, we want to keep the changes applied
    if (restoreOriginalValues) {
      this.restoreOriginalValues()
    } else {
      // Just remove the data attributes without reverting changes
      this.removeDataAttributesOnly()
    }

    // 4. Remove event listeners
    this.removeEventListeners()

    // 5. Clear state
    this.clearState()

    // 6. Show preview header if it was hidden
    this.showPreviewHeader()

    // 7. Clear global markers
    this.clearGlobalMarkers()

    debugLog("[ABSmartly] Visual editor cleanup complete")
  }

  private removeVisualEditorClasses(): void {
    // Remove our CSS classes from all elements
    const classesToRemove = [
      "absmartly-hover",
      "absmartly-selected",
      "absmartly-editing",
      "absmartly-draggable",
      "absmartly-drop-target",
      "absmartly-resize-active"
    ]

    classesToRemove.forEach((className) => {
      const elements = document.querySelectorAll(`.${className}`)
      elements.forEach((el) => el.classList.remove(className))
    })
  }

  private removeVisualEditorElements(): void {
    // Remove all visual editor UI elements
    const elementsToRemove = [
      "absmartly-visual-editor-banner-host",
      "absmartly-menu-host",
      "absmartly-html-editor-host",
      "absmartly-hover-tooltip",
      "absmartly-notification",
      "absmartly-relative-selector-host",
      "absmartly-insert-dialog-host"
    ]

    elementsToRemove.forEach((id) => {
      const element = document.getElementById(id)
      if (element) {
        element.remove()
      }
    })

    // Remove any drag placeholders
    const placeholders = document.querySelectorAll(
      "[data-absmartly-placeholder]"
    )
    placeholders.forEach((placeholder) => placeholder.remove())

    // Remove resize handles
    const resizeHandles = document.querySelectorAll(
      "[data-absmartly-resize-handle]"
    )
    resizeHandles.forEach((handle) => handle.remove())
  }

  private removeDataAttributesOnly(): void {
    // When preview mode is active, DON'T remove any data attributes!
    // The SDK plugin owns these attributes and needs them to revert changes when preview is disabled:
    // - data-absmartly-original: stores original values for restoration
    // - data-absmartly-modified: marks elements as modified (SDK uses this to find elements to clean)
    // - data-absmartly-experiment: identifies which experiment modified the element
    //
    // We only remove VE UI elements and classes, but leave all data attributes intact.
    debugLog(
      "[Cleanup] Preview mode active - preserving all data attributes for SDK plugin"
    )
  }

  // PreviewManager's journal restores everything the visual editor's
  // preview wrote (clearChangesViaSDK). The selection sidecar serializes
  // whatever was on the page at selection time, previewed content
  // included, so it is stripped and never written back.
  private restoreOriginalValues(): void {
    document
      .querySelectorAll("[data-absmartly-original]")
      .forEach((element) => {
        const dataset = (element as HTMLElement).dataset
        delete dataset.absmartlyOriginal
        delete dataset.absmartlyModified
        delete dataset.absmartlyExperiment
      })
  }

  private removeEventListeners(): void {
    // Remove all registered event handlers
    this.eventHandlers.forEach((handler) => {
      try {
        handler()
      } catch (e) {
        debugWarn("[ABSmartly] Failed to remove event handler:", e)
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
    const previewHeader = document.getElementById("absmartly-preview-header")
    if (previewHeader) {
      previewHeader.style.display = ""
    }
  }

  private clearGlobalMarkers(): void {
    // Remove any global styles we may have added
    const globalStyles = document.querySelectorAll("style[data-absmartly]")
    globalStyles.forEach((style) => style.remove())
  }
}

export default Cleanup
