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
  recordAttributeOrder,
  recordMutations,
  restoreAttributeOrder,
  undoMutations,
  type JournalEntry
} from "./mutation-journal"

// Everything one experiment's preview did to the page, in application order.
interface PreviewJournal {
  entries: JournalEntry[]
  attributeOrder: Map<Element, string[]>
  marked: Set<Element>
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

export class PreviewManager {
  private journals: Map<string, PreviewJournal> = new Map()
  private sessions: Map<string, PreviewDOMManipulator> = new Map()
  private styleManagers: Map<string, StyleSheetManager> = new Map()

  private getJournal(experimentName: string): PreviewJournal {
    let journal = this.journals.get(experimentName)
    if (!journal) {
      journal = { entries: [], attributeOrder: new Map(), marked: new Set() }
      this.journals.set(experimentName, journal)
    }
    return journal
  }

  // Applies one change to `targets` and journals every DOM mutation it
  // makes so removal can invert it. Tracking markers are written outside the
  // journal (the marker sweep in removePreviewChanges clears them): another
  // experiment may re-mark the same element, and undoing a marker write
  // would resurrect a stale experiment name.
  private applyJournaled(
    experimentName: string,
    change: DOMChange,
    targets: Element[],
    apply: () => boolean
  ): boolean {
    const journal = this.getJournal(experimentName)
    recordAttributeOrder(journal.attributeOrder, targets)
    if (change.type === "javascript") {
      for (const target of targets) {
        recordAttributeOrder(
          journal.attributeOrder,
          target.querySelectorAll("*")
        )
      }
    }
    // A change matching nested targets detaches an inner target (text or
    // html on the outer one) before applying to it; observing each target
    // directly keeps those writes in the journal.
    const { result, entries } = recordMutations([document, ...targets], apply)
    journal.entries.push(...entries)
    if (result) {
      for (const element of targets) {
        if (element.isConnected) {
          this.markElement(element, experimentName)
          journal.marked.add(element)
        }
      }
    }
    return result
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
        return this.applyJournaled(experimentName, change, [element], apply)
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
    // styleRules only write the experiment's stylesheet, which removal
    // destroys as a whole.
    if (change.type === "styleRules") {
      return session.applyChange(change, experimentName)
    }

    // The session's SDK manipulator applies current matches and registers
    // waitForElement/SPA selectors with its pending manager, whose late
    // matches are journaled through applyOwned (see getSession).
    const targets =
      change.type === "create" ? [] : this.findPreviewTargets(change.selector)
    return this.applyJournaled(experimentName, change, targets, () =>
      session.applyChange(change, experimentName)
    )
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

    const journal = this.journals.get(experimentName)
    if (journal) {
      this.journals.delete(experimentName)
      undoMutations(journal.entries)
      restoreAttributeOrder(journal.attributeOrder)
      restoredCount += journal.entries.length
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
      ...this.journals.keys(),
      ...this.styleManagers.keys()
    ])

    for (const name of experimentNames) {
      this.removePreviewChanges(name)
    }
  }

  /**
   * Get count of tracked preview elements
   */
  getPreviewCount(): number {
    let count = 0
    for (const journal of this.journals.values()) count += journal.marked.size
    return count
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
