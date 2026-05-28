/**
 * Edit Modes for Visual Editor
 * Handles rearrange mode (drag & drop) and resize mode functionality
 */

import { debugLog, debugWarn } from "~src/utils/debug"

import type { DOMChange } from "../types/visual-editor"
import { generateRobustSelector } from "../utils/selector-generator"
import StateManager from "./state-manager"

export class EditModes {
  private stateManager: StateManager
  private addChange: ((change: DOMChange) => void) | null = null

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  setAddChangeCallback(callback: (change: DOMChange) => void): void {
    this.addChange = callback
  }

  enableRearrangeMode(element: Element): void {
    debugLog("[ABSmartly] Enabling rearrange mode for element:", element)

    const smartElement = this.getSmartDraggableElement(element)
    if (!smartElement) return

    this.stateManager.setRearranging(true)
    smartElement.classList.add("absmartly-draggable")

    // Capture the LIVE pre-drag position as the rollback anchor.
    // trackMoveChange reverts the drop to this position before generating
    // selectors so PreviewManager (which runs removePreviewChanges on every
    // replace-mode replay) sees the same DOM the selectors describe. For a
    // repeat drag this is the *post-previous-drop* position, not the
    // pristine document position — that's intentional: undo works against
    // the most recent committed state, not the historical original.
    const originalParent: Element | null = smartElement.parentElement
    const originalNextSibling: Element | null = smartElement.nextElementSibling

    // Make element draggable
    ;(smartElement as HTMLElement).draggable = true

    // Inline elements (text spans etc.) default to free / nested placement
    // — that's the natural inline-flow expectation. Block elements default
    // to sibling-only placement so dropping over an inner child of a
    // sibling card lands the dragged element *next to* the card, not
    // nested inside it. Alt swaps the two modes either way.
    const draggedDisplay = window.getComputedStyle(smartElement).display
    const draggedIsInline = draggedDisplay === "inline"

    const isBlockLevel = (el: Element): boolean => {
      const d = window.getComputedStyle(el).display
      return d !== "inline" && d !== "contents" && d !== "none"
    }

    type DropAnchor =
      | { kind: "sibling"; element: Element; position: "before" | "after" }
      | { kind: "nested"; element: Element }

    const findDropAnchor = (e: DragEvent): DropAnchor | null => {
      const cursor = e.target as Element | null
      if (!cursor) return null
      if (cursor === smartElement || smartElement.contains(cursor)) return null

      // Alt SWAPS strategy. block default = sibling, inline default = nested.
      const useFreeMode = draggedIsInline !== e.altKey

      if (useFreeMode) {
        // Free / nested: nest the dragged element directly into the
        // cursor's element. This is what makes "drop a span inside
        // another span" actually nest one inline element inside the
        // other. For block+Alt the cursor's element will typically be
        // a block container and behaviour is the same as before.
        return { kind: "nested", element: cursor }
      }

      // Sibling-only mode. Two-pass walk up from the cursor:
      //   1. PREFERRED: an ancestor whose parent IS smartElement's parent
      //      — that is, a true sibling of the dragged element. We don't
      //      require block-level here because inline-on-Alt should still
      //      find inline siblings (e.g., span next to span inside a <p>).
      //   2. FALLBACK: any block-level ancestor whose parent is also
      //      block-level. This handles "drag to a different container":
      //      the dragged element re-parents and lands as a sibling at
      //      the new container's level instead of nesting into the
      //      cursor's deepest element. Block-level is required here so
      //      the fallback never picks an inner text wrapper.
      // Without the fallback, dropping outside the original parent would
      // be a silent no-op, which the user explicitly didn't want.
      let preferredFallback: {
        element: Element
        position: "before" | "after"
      } | null = null
      let candidate: Element | null = cursor
      while (candidate && candidate !== document.documentElement) {
        if (candidate === smartElement || smartElement.contains(candidate)) {
          candidate = candidate.parentElement
          continue
        }
        const candParent = candidate.parentElement
        if (!candParent || candidate === document.body) {
          candidate = candidate.parentElement
          continue
        }

        const rect = candidate.getBoundingClientRect()
        const position: "before" | "after" =
          e.clientY < rect.top + rect.height / 2 ? "before" : "after"

        // Pass-1 hit: candidate is a sibling of the dragged element.
        // Same-parent check works for both block and inline siblings.
        if (candParent === smartElement.parentElement) {
          return { kind: "sibling", element: candidate, position }
        }

        // Pass-2 candidate: remember the *innermost* block whose parent
        // is also block-level (skipping html). First write wins so we
        // stay at the deepest "card-like" level the cursor traversed.
        if (
          !preferredFallback &&
          candParent !== document.documentElement &&
          isBlockLevel(candidate) &&
          isBlockLevel(candParent)
        ) {
          preferredFallback = { element: candidate, position }
        }
        candidate = candidate.parentElement
      }

      if (preferredFallback) {
        return {
          kind: "sibling",
          element: preferredFallback.element,
          position: preferredFallback.position
        }
      }

      // Fallback: cursor is over body / html with no block candidate.
      // Append to the dragged element's own parent so the user always
      // sees *some* outcome — beats a silent no-op.
      const parent = smartElement.parentElement
      if (parent) {
        const lastSibling = Array.from(parent.children)
          .filter((c) => c !== smartElement)
          .pop()
        if (lastSibling) {
          return { kind: "sibling", element: lastSibling, position: "after" }
        }
      }
      return null
    }

    const clearDropIndicators = () => {
      document
        .querySelectorAll(
          ".absmartly-drop-target, .absmartly-drop-before, .absmartly-drop-after, .absmartly-drop-nested"
        )
        .forEach((el) => {
          el.classList.remove(
            "absmartly-drop-target",
            "absmartly-drop-before",
            "absmartly-drop-after",
            "absmartly-drop-nested"
          )
        })
    }

    const applyDropIndicator = (anchor: DropAnchor) => {
      anchor.element.classList.add("absmartly-drop-target")
      if (anchor.kind === "sibling") {
        anchor.element.classList.add(
          anchor.position === "before"
            ? "absmartly-drop-before"
            : "absmartly-drop-after"
        )
      } else {
        anchor.element.classList.add("absmartly-drop-nested")
      }
    }

    const handleDragStart = (e: DragEvent) => {
      debugLog("[ABSmartly] Drag start")
      this.stateManager.setDraggedElement(smartElement)
      smartElement.classList.add("absmartly-dragging")

      // Set drag data
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/html", smartElement.outerHTML)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move"
      }
      clearDropIndicators()
      const anchor = findDropAnchor(e)
      if (anchor) applyDropIndicator(anchor)
    }

    const handleDragLeave = (_e: DragEvent) => {
      // Indicator state is rebuilt on every dragover, so a leave from any
      // single child doesn't need to do anything here.
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      const anchor = findDropAnchor(e)
      clearDropIndicators()
      if (!anchor) return

      try {
        if (anchor.kind === "sibling") {
          const parent = anchor.element.parentElement
          if (!parent) return
          if (anchor.position === "before") {
            parent.insertBefore(smartElement, anchor.element)
          } else {
            const next = anchor.element.nextElementSibling
            if (next) {
              parent.insertBefore(smartElement, next)
            } else {
              parent.appendChild(smartElement)
            }
          }
        } else {
          // Nested / free mode: append to the cursor's nearest block.
          anchor.element.appendChild(smartElement)
        }

        this.trackMoveChange(smartElement, originalParent, originalNextSibling)
        debugLog("[ABSmartly] Element moved successfully")
      } catch (error) {
        debugWarn("[ABSmartly] Move failed:", error)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Cancel: tear down drag mode without recording a move.
        // Native dragend fires from browsers on Escape too, but we run
        // this proactively so behaviour is identical when tests dispatch
        // synthetic events (where dragend would not auto-fire).
        debugLog("[ABSmartly] Escape pressed — cancelling drag")
        e.preventDefault()
        e.stopPropagation()
        handleDragEnd(new DragEvent("dragend"))
      }
    }

    const handleDragEnd = (_e: DragEvent) => {
      debugLog("[ABSmartly] Drag end")

      // Clean up drag state
      smartElement.classList.remove("absmartly-dragging")
      ;(smartElement as HTMLElement).draggable = false
      this.stateManager.setDraggedElement(null)
      this.stateManager.setRearranging(false)

      // Remove all drop target indicators
      clearDropIndicators()

      // Remove event listeners
      smartElement.removeEventListener("dragstart", handleDragStart)
      document.removeEventListener("dragover", handleDragOver)
      document.removeEventListener("dragleave", handleDragLeave)
      document.removeEventListener("drop", handleDrop)
      smartElement.removeEventListener("dragend", handleDragEnd)
      document.removeEventListener("keydown", handleKeyDown, true)

      smartElement.classList.remove("absmartly-draggable")
    }

    // Add event listeners
    smartElement.addEventListener("dragstart", handleDragStart)
    document.addEventListener("dragover", handleDragOver)
    document.addEventListener("dragleave", handleDragLeave)
    document.addEventListener("drop", handleDrop)
    smartElement.addEventListener("dragend", handleDragEnd)
    // Capture-phase keydown so Escape always reaches us before any
    // page-level handler that might consume it.
    document.addEventListener("keydown", handleKeyDown, true)
  }

  enableResizeMode(element: Element): void {
    debugLog("[ABSmartly] Enabling resize mode for element:", element)
    const htmlElement = element as HTMLElement

    // Debug: Check current styles
    debugLog("[ABSmartly] Current element styles:", {
      width: htmlElement.style.width,
      height: htmlElement.style.height,
      computedWidth: window.getComputedStyle(htmlElement).width,
      computedHeight: window.getComputedStyle(htmlElement).height
    })

    this.stateManager.setResizing(true)
    element.classList.add("absmartly-resize-active")

    // Set global flag to prevent DOM changes from being reapplied during resize
    ;(window as any).__absmartlyVisualEditorModifying = true
    debugLog(
      "[ABSmartly] Set visual editor modifying flag to prevent DOM changes reapplication"
    )

    // Store original styles locally for tracking
    const originalStyles = {
      width: htmlElement.style.width,
      height: htmlElement.style.height,
      position: htmlElement.style.position,
      top: htmlElement.style.top,
      left: htmlElement.style.left
    }

    // Also store original styles in DOM for undo/redo
    if (!htmlElement.dataset.absmartlyOriginal) {
      htmlElement.dataset.absmartlyOriginal = JSON.stringify({})
    }

    const existingData = JSON.parse(htmlElement.dataset.absmartlyOriginal)
    if (!existingData.styles) {
      // Store current styles before any resize happens
      const computedStyle = window.getComputedStyle(htmlElement)
      existingData.styles = {
        width: htmlElement.style.width || computedStyle.width || "",
        height: htmlElement.style.height || computedStyle.height || ""
      }
      htmlElement.dataset.absmartlyOriginal = JSON.stringify(existingData)
      debugLog(
        "[ABSmartly] Stored original dimensions in DOM:",
        existingData.styles
      )
    }

    // Create resize handles
    const handles = this.createResizeHandles(element as HTMLElement)

    const handleMouseDown = (e: MouseEvent, direction: string) => {
      debugLog("[ABSmartly] Resize handle mousedown:", direction)
      e.preventDefault()
      e.stopPropagation()

      // Set global flag to prevent DOM changes from being reapplied during resize
      ;(window as any).__absmartlyVisualEditorModifying = true
      debugLog(
        "[ABSmartly] MOUSEDOWN: Set visual editor modifying flag to prevent DOM changes reapplication",
        {
          flagValue: (window as any).__absmartlyVisualEditorModifying,
          timestamp: Date.now(),
          direction
        }
      )

      const startX = e.clientX
      const startY = e.clientY
      const startRect = element.getBoundingClientRect()
      debugLog("[ABSmartly] Start rect:", startRect)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY

        this.applyResize(
          element as HTMLElement,
          direction,
          deltaX,
          deltaY,
          startRect
        )
      }

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)

        // Clear global flag to allow DOM changes to be reapplied again
        ;(window as any).__absmartlyVisualEditorModifying = false
        debugLog(
          "[ABSmartly] MOUSEUP: Cleared visual editor modifying flag, DOM changes can be reapplied",
          {
            flagValue: (window as any).__absmartlyVisualEditorModifying,
            timestamp: Date.now()
          }
        )

        // Track the change
        this.trackResizeChange(element, originalStyles)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    // Attach handlers to resize handles
    handles.forEach((handle) => {
      const direction = handle.dataset.direction!
      debugLog("[ABSmartly] Attaching mousedown handler to handle:", direction)
      handle.addEventListener("mousedown", (e) => {
        debugLog("[ABSmartly] Handle clicked:", direction)
        handleMouseDown(e, direction)
      })
    })
    debugLog("[ABSmartly] Created", handles.length, "resize handles")

    // Exit resize mode on Escape or click outside
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.exitResizeMode(element as HTMLElement, handles)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element
      if (
        !element.contains(target) &&
        !target.closest("[data-absmartly-resize-handle]")
      ) {
        this.exitResizeMode(element as HTMLElement, handles)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("click", handleClickOutside, true)

    // Store cleanup functions
    ;(element as any).__absmartlyResizeCleanup = () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("click", handleClickOutside, true)
    }
  }

  private getSmartDraggableElement(element: Element): Element | null {
    // Logic to find the best draggable element. Walk up from the user's
    // click target and return the first element that's a meaningful drag
    // unit — either a named inline interactive element (a / button /
    // span) or a block-level container. Accepting named inline elements
    // directly is what makes "drag a <span> with text and drop it inside
    // anything" work; without that, the walk skips past spans and the
    // user ends up dragging the whole containing card.
    let current: Element | null = element

    while (current && current !== document.body) {
      const tagName = current.tagName.toLowerCase()
      const computedStyle = window.getComputedStyle(current)

      if (computedStyle.display === "inline") {
        if (["a", "button", "span"].includes(tagName)) {
          return current
        }
        current = current.parentElement
        continue
      }

      // Prefer block-level containers
      if (
        [
          "div",
          "section",
          "article",
          "header",
          "footer",
          "main",
          "aside"
        ].includes(tagName)
      ) {
        return current
      }

      // Also good candidates
      if (["li", "tr", "td", "th", "figure", "blockquote"].includes(tagName)) {
        return current
      }

      current = current.parentElement
    }

    return element // Fallback to original element
  }

  private createResizeHandles(element: HTMLElement): HTMLElement[] {
    const handles: HTMLElement[] = []
    const directions = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

    directions.forEach((direction) => {
      const handle = document.createElement("div")
      handle.dataset.absmartlyResizeHandle = "true"
      handle.dataset.direction = direction
      handle.style.cssText = `
        position: absolute;
        background: #3b82f6;
        border: 2px solid white;
        border-radius: 50%;
        width: 10px;
        height: 10px;
        cursor: ${this.getResizeCursor(direction)};
        z-index: 2147483647;
        pointer-events: auto;
      `

      this.positionResizeHandle(handle, direction, element)
      handles.push(handle)
      document.body.appendChild(handle)
    })

    return handles
  }

  private positionResizeHandle(
    handle: HTMLElement,
    direction: string,
    element: HTMLElement
  ): void {
    const rect = element.getBoundingClientRect()
    const scrollX = window.scrollX
    const scrollY = window.scrollY

    const positions: { [key: string]: { left: number; top: number } } = {
      nw: { left: rect.left - 5, top: rect.top - 5 },
      n: { left: rect.left + rect.width / 2 - 5, top: rect.top - 5 },
      ne: { left: rect.right - 5, top: rect.top - 5 },
      e: { left: rect.right - 5, top: rect.top + rect.height / 2 - 5 },
      se: { left: rect.right - 5, top: rect.bottom - 5 },
      s: { left: rect.left + rect.width / 2 - 5, top: rect.bottom - 5 },
      sw: { left: rect.left - 5, top: rect.bottom - 5 },
      w: { left: rect.left - 5, top: rect.top + rect.height / 2 - 5 }
    }

    const pos = positions[direction]
    handle.style.left = pos.left + scrollX + "px"
    handle.style.top = pos.top + scrollY + "px"
    handle.style.position = "absolute"
  }

  private getResizeCursor(direction: string): string {
    const cursors: { [key: string]: string } = {
      nw: "nw-resize",
      n: "n-resize",
      ne: "ne-resize",
      e: "e-resize",
      se: "se-resize",
      s: "s-resize",
      sw: "sw-resize",
      w: "w-resize"
    }
    return cursors[direction] || "move"
  }

  private applyResize(
    element: HTMLElement,
    direction: string,
    deltaX: number,
    deltaY: number,
    startRect: DOMRect
  ): void {
    debugLog("[ABSmartly] RESIZE: Applying resize", {
      direction,
      deltaX,
      deltaY,
      flagValue: (window as any).__absmartlyVisualEditorModifying,
      timestamp: Date.now(),
      currentStyles: {
        width: element.style.width,
        height: element.style.height
      }
    })
    const style = element.style

    switch (direction) {
      case "se": // Southeast - resize both width and height
        style.width = Math.max(50, startRect.width + deltaX) + "px"
        style.height = Math.max(20, startRect.height + deltaY) + "px"
        break

      case "e": // East - resize width only
        style.width = Math.max(50, startRect.width + deltaX) + "px"
        break

      case "s": // South - resize height only
        style.height = Math.max(20, startRect.height + deltaY) + "px"
        break

      case "sw": // Southwest
        style.width = Math.max(50, startRect.width - deltaX) + "px"
        style.height = Math.max(20, startRect.height + deltaY) + "px"
        break

      case "w": // West
        style.width = Math.max(50, startRect.width - deltaX) + "px"
        break

      case "nw": // Northwest
        style.width = Math.max(50, startRect.width - deltaX) + "px"
        style.height = Math.max(20, startRect.height - deltaY) + "px"
        break

      case "n": // North
        style.height = Math.max(20, startRect.height - deltaY) + "px"
        break

      case "ne": // Northeast
        style.width = Math.max(50, startRect.width + deltaX) + "px"
        style.height = Math.max(20, startRect.height - deltaY) + "px"
        break
    }
  }

  private exitResizeMode(element: HTMLElement, handles: HTMLElement[]): void {
    element.classList.remove("absmartly-resize-active")
    this.stateManager.setResizing(false)

    // Clear global flag to allow DOM changes to be reapplied again
    ;(window as any).__absmartlyVisualEditorModifying = false
    debugLog(
      "[ABSmartly] Cleared visual editor modifying flag, DOM changes can be reapplied"
    )

    // Remove handles
    handles.forEach((handle) => handle.remove())

    // Clean up event listeners
    if ((element as any).__absmartlyResizeCleanup) {
      ;(element as any).__absmartlyResizeCleanup()
      delete (element as any).__absmartlyResizeCleanup
    }
  }

  private trackMoveChange(
    element: Element,
    originalParent: Element | null,
    originalNextSibling: Element | null
  ): void {
    debugLog("[ABSmartly] Tracking move change for element:", element)

    if (!this.addChange) {
      debugWarn("[ABSmartly] No addChange callback set for EditModes")
      return
    }

    // Capture the anchor that defines the move's destination from the LIVE
    // post-drop position — but as Element references, not selectors.
    // Selectors generated against the post-drop DOM would tie the change to
    // siblings/positions that no longer apply once PreviewManager replays
    // from the pre-VE state. We hold the references, revert the drop, and
    // regenerate selectors against the reverted DOM below. Without this,
    // a path like `#zone > div:nth-of-type(1)` generated for the dragged
    // element at its post-drop position resolves to a *different* sibling
    // after revert, and the SDK either moves the wrong element or none at
    // all — the user-visible symptom is the dragged element snapping back.
    const currentParent = element.parentElement
    if (!currentParent) {
      debugWarn("[ABSmartly] Could not determine move target")
      return
    }
    const anchorElement: Element | null =
      element.nextElementSibling ?? element.previousElementSibling ?? null
    // Position semantic for the move. The element-sibling checks above
    // disambiguate the common cases. The only-child case is ambiguous —
    // the element is both firstElementChild and lastElementChild — but
    // in that case the drop ran appendChild (free / nested mode always
    // appends), so prefer "lastChild" to faithfully reproduce that on
    // SDK replay. Picking "firstChild" here would cause the SDK to call
    // insertBefore(target.firstChild) and land the element *before* any
    // pre-existing text content of the container, which doesn't match
    // what the user just saw.
    const position: "before" | "after" | "firstChild" | "lastChild" =
      element.nextElementSibling
        ? "before"
        : element.previousElementSibling
          ? "after"
          : currentParent.lastElementChild === element
            ? "lastChild"
            : "firstChild"

    // Revert the live drop BEFORE selector generation. PreviewManager runs
    // removePreviewChanges in replace mode at the start of every replay, so
    // it observes the reverted DOM — the selectors we emit have to match
    // there.
    if (originalParent) {
      try {
        if (
          originalNextSibling &&
          originalNextSibling.parentNode === originalParent
        ) {
          originalParent.insertBefore(element, originalNextSibling)
        } else {
          originalParent.appendChild(element)
        }
      } catch (err) {
        debugWarn("[ABSmartly] Failed to revert drop pre-replay:", err)
        // Abort: selectors generated from the post-drop tree would persist a
        // corrupted move change that the SDK replay can't reproduce.
        return
      }
    }

    // Now generate selectors against the reverted (original) DOM. The
    // dragged element identifies WHAT to move; the anchor identifies WHERE.
    const elementSelector = generateRobustSelector(element, {
      preferDataAttributes: false,
      avoidAutoGenerated: true,
      includeParentContext: true,
      maxParentLevels: 3
    })

    const targetSelector = generateRobustSelector(
      anchorElement ?? currentParent,
      {
        preferDataAttributes: false,
        avoidAutoGenerated: true,
        includeParentContext: true,
        maxParentLevels: 3
      }
    )

    const moveChange: DOMChange = {
      selector: elementSelector,
      type: "move",
      targetSelector,
      position
    }

    debugLog(
      "[ABSmartly] Creating move change with original position:",
      moveChange
    )

    this.addChange(moveChange)
  }

  private trackResizeChange(element: Element, originalStyles: any): void {
    debugLog("[ABSmartly] Tracking resize change for element:", element)

    if (!this.addChange) {
      debugWarn("[ABSmartly] No addChange callback set for EditModes")
      return
    }

    const htmlElement = element as HTMLElement
    const currentStyles = {
      width: htmlElement.style.width,
      height: htmlElement.style.height
    }

    // Only track if styles actually changed
    if (
      currentStyles.width !== originalStyles.width ||
      currentStyles.height !== originalStyles.height
    ) {
      const elementSelector = generateRobustSelector(element, {
        preferDataAttributes: false,
        avoidAutoGenerated: true,
        includeParentContext: true,
        maxParentLevels: 3
      })

      // Discard the live width/height we wrote during the drag and let the
      // SDK reapply via PreviewManager. Without this revert, PreviewManager
      // would capture the post-drag state as the canonical original and
      // undo would no longer return the element to its true original size.
      htmlElement.style.width = originalStyles.width
      htmlElement.style.height = originalStyles.height

      const styleChange: DOMChange = {
        selector: elementSelector,
        type: "style",
        value: currentStyles
      }

      debugLog("[ABSmartly] Creating resize/style change:", styleChange)
      this.addChange(styleChange)
    }
  }
}

export default EditModes
