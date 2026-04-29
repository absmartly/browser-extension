import DOMPurify from "dompurify"

import { debugLog, debugWarn } from "~src/utils/debug"

import type { DOMChange } from "../types/visual-editor"
import BlockInserter from "../ui/block-inserter"
import ImageSourceDialog from "../ui/image-source-dialog"
import { Notifications } from "../ui/notifications"
import { generateRobustSelector } from "../utils/selector-generator"
import {
  applyChangesViaSDK,
  VISUAL_EDITOR_EXPERIMENT_NAME
} from "./sdk-applier"
import StateManager from "./state-manager"
import UndoRedoManager from "./undo-redo-manager"

export interface ElementActionsOptions {
  onChangesUpdate: (changes: DOMChange[]) => void
  setHoverEnabled?: (enabled: boolean) => void
}

/**
 * ElementActions handles all element manipulation operations in the visual editor.
 * This includes selection, hiding, deleting, copying, moving elements and more.
 */
export class ElementActions {
  private stateManager: StateManager
  private undoRedoManager: UndoRedoManager
  private notifications: Notifications
  private imageSourceDialog: ImageSourceDialog
  private blockInserter: BlockInserter
  private options: ElementActionsOptions

  // UI state
  private selectedElement: HTMLElement | null = null
  private hoveredElement: HTMLElement | null = null
  private hoverTooltip: HTMLElement | null = null

  constructor(
    stateManager: StateManager,
    undoRedoManager: UndoRedoManager,
    notifications: Notifications,
    options: ElementActionsOptions
  ) {
    this.stateManager = stateManager
    this.undoRedoManager = undoRedoManager
    this.notifications = notifications
    this.imageSourceDialog = new ImageSourceDialog()
    this.blockInserter = new BlockInserter()
    this.options = options

    // Listen to state changes to keep local state in sync
    this.stateManager.onStateChange((state) => {
      this.selectedElement = state.selectedElement as HTMLElement | null
      this.hoveredElement = state.hoveredElement as HTMLElement | null
    })
  }

  // Element selection methods
  public selectElement(element: HTMLElement): void {
    if (this.selectedElement) {
      this.selectedElement.classList.remove("absmartly-selected")
    }

    this.selectedElement = element
    element.classList.add("absmartly-selected")
    this.stateManager.setSelectedElement(element)
  }

  public deselectElement(): void {
    if (this.selectedElement) {
      this.selectedElement.classList.remove("absmartly-selected")
      this.selectedElement = null
    }
    this.stateManager.setSelectedElement(null)
  }

  // Hover tooltip methods
  public showHoverTooltip(element: HTMLElement, x: number, y: number): void {
    this.removeHoverTooltip()

    this.hoverTooltip = document.createElement("div")
    this.hoverTooltip.className = "absmartly-hover-tooltip"
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
      const selector = this.getSelector(this.selectedElement)
      const change: DOMChange = {
        selector,
        type: "style",
        value: { display: "none" },
        mode: "merge"
      } as DOMChange

      this.undoRedoManager.addChange(change, null)
      this.applyCurrentChangesViaSDK()
      this.deselectElement()
    } catch (error) {
      console.error("Failed to hide element:", error)
      this.notifications.show("Failed to hide element", "", "error")
    }
  }

  /**
   * Build the current change list and route it through the SDK plugin's
   * PreviewManager (same path as production preview). PreviewManager runs
   * removePreviewChanges first (replace mode), so undo / reorder / toggle all
   * naturally fall out of pushing a new full list.
   */
  private applyCurrentChangesViaSDK(): void {
    const variantName = this.stateManager.getConfig().variantName
    const changes = this.undoRedoManager.squashChanges()
    applyChangesViaSDK(changes, VISUAL_EDITOR_EXPERIMENT_NAME, variantName)
  }

  public async changeImageSource(): Promise<void> {
    if (!this.selectedElement) return

    try {
      const isImgTag = this.selectedElement.tagName.toLowerCase() === "img"
      const currentSrc = this.imageSourceDialog.getCurrentImageSource(
        this.selectedElement
      )

      const newSrc = await this.imageSourceDialog.show(
        this.selectedElement,
        currentSrc
      )
      if (!newSrc) {
        return
      }

      const selector = this.getSelector(this.selectedElement)

      if (isImgTag) {
        const change: DOMChange = {
          selector,
          type: "attribute",
          value: { src: newSrc },
          mode: "merge"
        }
        this.undoRedoManager.addChange(change, null)
      } else {
        const change: DOMChange = {
          selector,
          type: "style",
          value: { "background-image": `url('${newSrc}')` },
          mode: "merge"
        } as DOMChange
        this.undoRedoManager.addChange(change, null)
      }

      this.applyCurrentChangesViaSDK()
      this.notifications.show("Image source updated", "", "success")
    } catch (error) {
      console.error("Failed to change image source:", error)
      this.notifications.show("Failed to change image source", "", "error")
    }
  }

  public deleteElement(): void {
    if (!this.selectedElement) return

    const selector = this.getSelector(this.selectedElement)
    const change: DOMChange = { selector, type: "delete" }
    this.undoRedoManager.addChange(change, null)
    this.applyCurrentChangesViaSDK()
    this.deselectElement()
  }

  public copyElement(): void {
    if (!this.selectedElement) return

    try {
      const html = this.selectedElement.outerHTML
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(html)
          .then(() => {
            this.notifications.show(
              "Element HTML copied to clipboard!",
              "",
              "success"
            )
          })
          .catch((error) => {
            console.error("Failed to copy to clipboard:", error)
            this.notifications.show("Failed to copy to clipboard", "", "error")
          })
      } else {
        this.notifications.show("Clipboard not available", "", "error")
      }
    } catch (error) {
      console.error("Failed to copy element:", error)
      this.notifications.show("Failed to copy element", "", "error")
    }
  }

  public copySelectorPath(): void {
    if (!this.selectedElement) return

    try {
      const selector = this.getSelector(this.selectedElement)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(selector)
          .then(() => {
            this.notifications.show(
              `Selector copied: ${selector}`,
              "",
              "success"
            )
          })
          .catch((error) => {
            console.error("Failed to copy selector to clipboard:", error)
            this.notifications.show(
              "Failed to copy selector to clipboard",
              "",
              "error"
            )
          })
      } else {
        this.notifications.show("Clipboard not available", "", "error")
      }
    } catch (error) {
      console.error("Failed to copy selector:", error)
      this.notifications.show("Failed to copy selector", "", "error")
    }
  }

  public moveElement(direction: "up" | "down"): void {
    if (!this.selectedElement) return

    const parent = this.selectedElement.parentElement
    if (!parent) return

    // Build a 'move' change anchored to the sibling we're swapping with.
    // SDK applies it via insertBefore — same semantics as the old direct path.
    const selector = this.getSelector(this.selectedElement)
    let targetEl: Element | null = null
    let position: "before" | "after" | null = null
    if (direction === "up" && this.selectedElement.previousElementSibling) {
      targetEl = this.selectedElement.previousElementSibling
      position = "before"
    } else if (
      direction === "down" &&
      this.selectedElement.nextElementSibling
    ) {
      targetEl = this.selectedElement.nextElementSibling
      position = "after"
    }
    if (!targetEl || !position) return

    const targetSelector = this.getSelector(targetEl as HTMLElement)
    const change: DOMChange = {
      selector,
      type: "move",
      targetSelector,
      position
    }
    this.undoRedoManager.addChange(change, null)
    this.applyCurrentChangesViaSDK()
  }

  public async insertNewBlock(): Promise<void> {
    if (!this.selectedElement) {
      return
    }

    try {
      // Disable hover tooltips while block inserter is open
      this.options.setHoverEnabled?.(false)

      const options = await this.blockInserter.show(this.selectedElement)

      // Re-enable hover tooltips after block inserter closes
      this.options.setHoverEnabled?.(true)

      if (!options) {
        return
      }

      const sanitizedHtml = DOMPurify.sanitize(options.html)
      const referenceElement = this.selectedElement
      const referenceSelector = this.getSelector(referenceElement)

      const change: DOMChange = {
        selector: referenceSelector,
        type: "create",
        element: sanitizedHtml,
        targetSelector: referenceSelector,
        position: options.position
      }

      this.undoRedoManager.addChange(change, null)
      this.applyCurrentChangesViaSDK()

      // After the round-trip, find the freshly-inserted element so we can
      // select it. PreviewManager tagged it with data-absmartly-experiment
      // (set inside applyPreviewChange's create branch), but the marker is
      // applied asynchronously via postMessage — we look it up by sibling
      // relationship instead.
      const insertedElement =
        options.position === "before"
          ? referenceElement.previousElementSibling
          : referenceElement.nextElementSibling

      this.notifications.show(
        `HTML block inserted ${options.position} selected element`,
        "",
        "success"
      )

      if (insertedElement) {
        this.selectElement(insertedElement as HTMLElement)
      }
    } catch (error) {
      console.error("[ElementActions] Failed to insert new block:", error)
      this.notifications.show("Failed to insert element", "", "error")
    }
  }

  public showRelativeElementSelector(): void {
    // Placeholder - will implement relative element highlighting
    this.notifications.show(
      "Select relative elements: Coming soon!",
      "",
      "info"
    )
  }

  public clearAllChanges(): void {
    if (confirm("Are you sure you want to clear all changes?")) {
      this.undoRedoManager.clear()
      this.stateManager.setChanges([])
      this.applyCurrentChangesViaSDK()
      this.options.onChangesUpdate([])
      this.notifications.show("All changes cleared", "", "success")
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
      const id = current.id || ""
      const className =
        typeof current.className === "string"
          ? current.className
          : (current.className as any)?.baseVal || ""

      if (id.includes("absmartly") || className.includes("absmartly")) {
        return true
      }

      current = current.parentElement
    }
    return false
  }
}
