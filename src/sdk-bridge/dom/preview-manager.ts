/**
 * Preview Manager
 *
 * Handles applying and removing preview changes with state tracking
 *
 * @module PreviewManager
 */

import { DOMManipulatorLite } from "@absmartly/sdk-plugins/core/dom-manipulator"
import { PendingChangeManager } from "@absmartly/sdk-plugins/core/pending-change-manager"
import { StyleSheetManager } from "@absmartly/sdk-plugins/core/style-sheet-manager"

import type { DOMChange } from "~src/types/dom-changes"

import { sanitizeHTML } from "../utils/html-sanitizer"
import { Logger } from "../utils/logger"
import {
  ElementStateManager,
  type ChildRestore,
  type ElementState
} from "./element-state"

interface PreviewState {
  experimentName: string
  originalState: ElementState
  selector: string
  changeType: string
}

type OwnedApplication = (
  element: Element,
  change: DOMChange,
  apply: () => boolean
) => boolean

// The SDK declares its per-element pending callback private; this is the
// method its own PendingChangeManager callback invokes.
interface SpecificElementApplier {
  applyChangeToSpecificElement(
    change: DOMChange,
    experimentName: string,
    element: Element
  ): boolean
}

// One SDK manipulator per preview session: destroying it disconnects that
// experiment's observers and drops its pending work without touching other
// previews. Late matches are routed through applyOwned so they are captured
// for restoration and rejected once the session is no longer current.
// Depends on two SDK internals pinned by the ~1.3.2 range; if an upgrade
// renames either, late SPA matches are no longer captured or restorable.
let reportedMissingInternals = false

class PreviewDOMManipulator extends DOMManipulatorLite {
  constructor(plugin: Record<string, any>, applyOwned: OwnedApplication) {
    super(true, plugin)
    const applier = this as unknown as SpecificElementApplier
    const missing = [
      typeof applier.applyChangeToSpecificElement !== "function" &&
        "DOMManipulatorLite.prototype.applyChangeToSpecificElement",
      !("pendingManager" in this) && "DOMManipulatorLite#pendingManager"
    ].filter(Boolean)
    if (missing.length > 0 && !reportedMissingInternals) {
      reportedMissingInternals = true
      // Always reported, not behind Logger's debug flag.
      console.error(
        "[ABsmartly Extension] @absmartly/sdk-plugins no longer exposes",
        missing.join(", "),
        "- late SPA preview changes cannot be captured or restored"
      )
    }
    this.pendingManager = new PendingChangeManager(
      (change, experimentName, element) => {
        if (!element) return this.applyChange(change, experimentName)
        return applyOwned(element, change, () =>
          applier.applyChangeToSpecificElement(change, experimentName, element)
        )
      },
      true
    )
  }
}

// text/html replace children, leaving the originals detached and intact.
// JavaScript can mutate the original descendants in place, so only a
// serialized copy taken before it ran is a faithful restore source.
function childRestoreFor(change: DOMChange): ChildRestore {
  if (change.type === "javascript") return "serialized"
  if (change.type === "text" || change.type === "html") return "live"
  return "none"
}

export class PreviewManager {
  private previewStateMap: Map<Element, PreviewState>
  private sessions: Map<string, PreviewDOMManipulator> = new Map()
  private styleManagers: Map<string, StyleSheetManager> = new Map()
  // Elements created by 'create' changes, keyed by experiment. The SDK's
  // createElement doesn't expose the new nodes, so mutation records around
  // the call identify them for removal.
  private createdElementsMap: Map<string, Set<Element>> = new Map()

  constructor() {
    this.previewStateMap = new Map()
  }

  private getSession(experimentName: string): PreviewDOMManipulator {
    const existing = this.sessions.get(experimentName)
    if (existing) return existing

    const plugin = {
      config: { spa: true },
      reapplyingElements: new Set(),
      getStyleManager: (name: string) => {
        if (!this.styleManagers.has(name)) {
          this.styleManagers.set(
            name,
            new StyleSheetManager(`absmartly-styles-${name}`, true)
          )
        }
        return this.styleManagers.get(name)
      },
      buildStateRules: this.buildStateRules.bind(this),
      watchElement: () => {}
    }
    const session: PreviewDOMManipulator = new PreviewDOMManipulator(
      plugin,
      (element, change, apply) => {
        if (
          this.sessions.get(experimentName) !== session ||
          this.isExtensionElement(element)
        ) {
          return false
        }
        this.captureOriginalState(element, change, experimentName)
        const success = apply()
        if (success) this.markElement(element, experimentName)
        return success
      }
    )
    this.sessions.set(experimentName, session)
    return session
  }

  private buildStateRules(
    selector: string,
    states: any,
    important = true
  ): string {
    const rules: string[] = []
    if (states.normal)
      rules.push(this.buildCssRule(selector, states.normal, important))
    if (states.hover)
      rules.push(
        this.buildCssRule(`${selector}:hover`, states.hover, important)
      )
    if (states.active)
      rules.push(
        this.buildCssRule(`${selector}:active`, states.active, important)
      )
    if (states.focus)
      rules.push(
        this.buildCssRule(`${selector}:focus`, states.focus, important)
      )
    return rules.join("\n\n")
  }

  private buildCssRule(
    selector: string,
    properties: Record<string, any>,
    important = true
  ): string {
    const declarations = Object.entries(properties)
      .map(([prop, value]) => {
        const cssProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase()
        const bang = important ? " !important" : ""
        return `  ${cssProp}: ${value}${bang};`
      })
      .join("\n")
    return `${selector} {\n${declarations}\n}`
  }

  /**
   * Apply a single preview change and track it for reversion
   */
  applyPreviewChange(change: DOMChange, experimentName: string): boolean {
    // Skip disabled changes
    if (
      ("disabled" in change && change.disabled) ||
      ("enabled" in change && change.enabled === false)
    ) {
      Logger.log("Skipping disabled change:", change.selector)
      return false
    }

    const session = this.getSession(experimentName)
    if (change.type === "create") {
      return this.applyCreateChange(change, experimentName, session)
    }

    // Capture original state BEFORE applying (for undo functionality)
    if (change.type !== "styleRules") {
      for (const element of this.findPreviewTargets(change.selector)) {
        this.captureOriginalState(element, change, experimentName)
      }
    }

    // The session's SDK manipulator applies current matches and registers
    // waitForElement/SPA selectors with its pending manager, whose late
    // matches go through applyOwned (see getSession).
    const success = session.applyChange(change, experimentName)

    // Mark applied elements AFTER for undo tracking. Late SPA matches are
    // captured and marked by the session's pending callback instead.
    if (success && change.type !== "styleRules") {
      for (const element of this.findPreviewTargets(change.selector)) {
        if (
          this.previewStateMap.get(element)?.experimentName === experimentName
        ) {
          this.markElement(element, experimentName)
        }
      }
    }

    return success
  }

  private applyCreateChange(
    change: DOMChange,
    experimentName: string,
    session: PreviewDOMManipulator
  ): boolean {
    let target: Element | null = null
    try {
      const targetSelector =
        "targetSelector" in change ? change.targetSelector : undefined
      target = targetSelector ? document.querySelector(targetSelector) : null
    } catch {
      // Invalid selector: the SDK reports its own failure.
    }
    const root = target?.parentNode || target
    if (!root) return session.applyChange(change, experimentName)

    // Observe the anchor's parent subtree so before/after and
    // firstChild/lastChild insertions are all attributed to this change.
    const observer = new MutationObserver(() => {})
    observer.observe(root, { childList: true, subtree: true })
    let success = false
    let records: MutationRecord[] = []
    try {
      success = session.applyChange(change, experimentName)
    } finally {
      records = observer.takeRecords()
      observer.disconnect()
    }
    if (!success) return false

    let bucket = this.createdElementsMap.get(experimentName)
    if (!bucket) {
      bucket = new Set()
      this.createdElementsMap.set(experimentName, bucket)
    }
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (node instanceof Element && node.isConnected) {
          bucket.add(node)
          this.markElement(node, experimentName)
        }
      }
    }
    return true
  }

  private findPreviewTargets(selector: string): Element[] {
    try {
      return Array.from(document.querySelectorAll(selector)).filter(
        (element) => !this.isExtensionElement(element)
      )
    } catch {
      // Invalid selector: the SDK reports its own failure.
      return []
    }
  }

  private captureOriginalState(
    element: Element,
    change: DOMChange,
    experimentName: string
  ): void {
    const childRestore = childRestoreFor(change)
    const existing = this.previewStateMap.get(element)
    if (existing?.experimentName === experimentName) {
      // The first snapshot already holds the original children and markup.
      // Once a text/html change detached the originals, later changes cannot
      // reach them, so only a "none" snapshot needs upgrading.
      if (existing.originalState.childRestore === "none") {
        existing.originalState.childRestore = childRestore
      }
      return
    }
    this.previewStateMap.set(element, {
      experimentName,
      originalState: ElementStateManager.captureElementState(
        element,
        childRestore
      ),
      selector: change.selector,
      changeType: change.type
    })
  }

  private markElement(element: Element, experimentName: string): void {
    element.setAttribute("data-absmartly-experiment", experimentName)
    element.setAttribute("data-absmartly-modified", "true")
  }

  /**
   * Remove all preview changes for an experiment
   */
  removePreviewChanges(experimentName: string): boolean {
    Logger.log("Removing preview changes for experiment:", experimentName)

    // Cancel pending SPA work before restoring, so no late mount re-applies.
    const session = this.sessions.get(experimentName)
    if (session) {
      this.sessions.delete(experimentName)
      session.destroy()
    }

    let restoredCount = 0

    // Undo snapshots newest-first. A snapshot taken inside content introduced
    // by an earlier ancestor change is unwound before that ancestor restores
    // its original children, so the descendant is not reinserted.
    const tracked = Array.from(this.previewStateMap).filter(
      ([, data]) => data.experimentName === experimentName
    )
    for (const [element, data] of tracked.reverse()) {
      ElementStateManager.restoreElementState(element, data.originalState)
      this.previewStateMap.delete(element)
      restoredCount++
    }

    // Remove created nodes after the snapshots: a snapshot of a created node
    // (a later change targeted it) or of its parent reinserts it on restore.
    const created = this.createdElementsMap.get(experimentName)
    if (created) {
      for (const el of created) {
        el.remove()
        restoredCount++
      }
      this.createdElementsMap.delete(experimentName)
    }

    // Also remove markers from any elements with this experiment (e.g., from visual editor)
    // Try both the actual experiment name and __preview__ (visual editor default)
    const markedElements = document.querySelectorAll(
      `[data-absmartly-experiment="${experimentName}"], [data-absmartly-experiment="__preview__"]`
    )
    for (const element of markedElements) {
      if (element.hasAttribute("data-absmartly-original")) {
        try {
          const originalData = JSON.parse(
            element.getAttribute("data-absmartly-original") || "{}"
          )
          Logger.log("Original data for element:", {
            tagName: element.tagName,
            id: element.id,
            textContent: originalData.textContent?.substring(0, 100),
            innerHTML: originalData.innerHTML?.substring(0, 100),
            hasStyles: !!originalData.styles
          })

          // Restore innerHTML (which also restores textContent)
          if (originalData.innerHTML !== undefined) {
            element.innerHTML = sanitizeHTML(originalData.innerHTML)
            Logger.log("Restored innerHTML from VE original")
          } else if (originalData.textContent !== undefined) {
            // Fallback to textContent if innerHTML not available
            element.textContent = originalData.textContent
            Logger.log("Restored text content from VE original")
          }

          // Restore styles
          if (originalData.styles) {
            const htmlElement = element as HTMLElement
            for (const prop of Object.keys(originalData.styles)) {
              htmlElement.style[prop as any] = originalData.styles[prop]
            }
            Logger.log("Restored styles from VE original")
          }

          // Restore attributes
          if (originalData.attributes) {
            for (const attr of Object.keys(originalData.attributes)) {
              if (originalData.attributes[attr] !== null) {
                element.setAttribute(attr, originalData.attributes[attr])
              } else {
                element.removeAttribute(attr)
              }
            }
            Logger.log("Restored attributes from VE original")
          }
        } catch (e) {
          Logger.warn(
            "Failed to restore element from data-absmartly-original:",
            e
          )
        }

        // Remove the original data attribute - we're back at original state now
        element.removeAttribute("data-absmartly-original")
      }

      element.removeAttribute("data-absmartly-experiment")
      element.removeAttribute("data-absmartly-modified")
      restoredCount++
    }

    // Remove styleRules for this experiment via StyleSheetManager
    const styleManager = this.styleManagers.get(experimentName)
    if (styleManager) {
      styleManager.destroy()
      this.styleManagers.delete(experimentName)
      Logger.log(
        `[PreviewManager] Destroyed stylesheet for experiment:`,
        experimentName
      )
    }

    // Remove the style element for this experiment (same ID format as SDK plugin)
    const styleId = `absmartly-styles-${experimentName}`
    const styleElement = document.getElementById(styleId)
    if (styleElement) {
      styleElement.remove()
      Logger.log("[PreviewManager] Destroyed stylesheet:", styleId)
      restoredCount++
    }

    Logger.log(`Removed preview changes, cleaned ${restoredCount} elements`)
    return restoredCount > 0
  }

  /**
   * Clear all preview changes
   */
  clearAll(): void {
    const experimentNames = new Set<string>([
      ...this.sessions.keys(),
      ...this.createdElementsMap.keys(),
      ...this.styleManagers.keys()
    ])
    for (const data of this.previewStateMap.values()) {
      experimentNames.add(data.experimentName)
    }

    for (const name of experimentNames) {
      this.removePreviewChanges(name)
    }
  }

  /**
   * Get count of tracked preview elements
   */
  getPreviewCount(): number {
    return this.previewStateMap.size
  }

  /**
   * Check if an element is part of the extension UI
   * Extension UI elements (including shadow hosts) should never be modified by preview changes
   */
  private isExtensionElement(element: Element): boolean {
    const extensionIds = [
      "absmartly-sidebar-root",
      "absmartly-sidebar-iframe",
      "absmartly-preview-header-host", // Shadow host for preview toolbar
      "absmartly-visual-editor-toolbar-host" // Shadow host for VE toolbar
    ]

    // Check if this element IS an extension container
    if (element.id && extensionIds.includes(element.id)) {
      return true
    }

    // Check if this element is INSIDE an extension container
    for (const id of extensionIds) {
      const container = document.getElementById(id)
      if (container && container.contains(element)) {
        return true
      }
    }

    return false
  }
}
