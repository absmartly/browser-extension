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

import { Logger } from "../utils/logger"
import {
  recordAttributeOrder,
  recordMutations,
  restoreAttributeOrder,
  undoMutations,
  type JournalEntry
} from "./mutation-journal"

// A live form property (value, checked, selectedness) that javascript can
// change without writing an attribute, so no MutationRecord sees it.
interface FormPropertyWrite {
  element: Element
  property: "value" | "checked" | "selected"
  before: string | boolean
  after: string | boolean
}

type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLOptionElement

function formControlsIn(roots: Element[]): FormControl[] {
  const controls = new Set<FormControl>()
  const consider = (element: Element) => {
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLOptionElement
    )
      controls.add(element)
  }
  for (const root of roots) {
    consider(root)
    root.querySelectorAll("input, textarea, option").forEach(consider)
  }
  return Array.from(controls)
}

function formProperties(control: FormControl) {
  if (control instanceof HTMLOptionElement)
    return { selected: control.selected }
  if (
    control instanceof HTMLInputElement &&
    (control.type === "checkbox" || control.type === "radio")
  )
    return { checked: control.checked }
  return { value: control.value }
}

// Everything one experiment's preview did to the page, in application order.
interface PreviewJournal {
  entries: JournalEntry[]
  attributeOrder: Map<Element, string[]>
  marked: Set<Element>
  // Every element a change was applied to, including ones it detached.
  targets: Set<Element>
  formWrites: FormPropertyWrite[]
}

// One live preview: the changes it was given, so it can be re-applied, and
// the journal of what applying them did.
interface PreviewLayer {
  name: string
  changes: DOMChange[]
  journal: PreviewJournal
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

function newLayer(name: string, changes: DOMChange[]): PreviewLayer {
  return {
    name,
    changes,
    journal: {
      entries: [],
      attributeOrder: new Map(),
      marked: new Set(),
      targets: new Set(),
      formWrites: []
    }
  }
}

const isDisabled = (change: DOMChange) =>
  ("disabled" in change && change.disabled) ||
  ("enabled" in change && change.enabled === false)

export class PreviewManager {
  // Live previews in application order, oldest first. A journal is only
  // ever inverted against the DOM its own records produced: removing or
  // changing a layer first unwinds every layer above it, newest first, and
  // re-applies those layers from their change lists afterwards.
  private stack: PreviewLayer[] = []
  private sessions: Map<string, PreviewDOMManipulator> = new Map()
  private styleManagers: Map<string, StyleSheetManager> = new Map()

  private layer(experimentName: string): PreviewLayer | undefined {
    return this.stack.find((layer) => layer.name === experimentName)
  }

  private getLayer(experimentName: string): PreviewLayer {
    let layer = this.layer(experimentName)
    if (!layer) {
      layer = newLayer(experimentName, [])
      this.stack.push(layer)
    }
    return layer
  }

  // Takes `experimentName`'s layer and every newer one off the stack and
  // unwinds them newest first. Returns the newer layers, oldest first, for
  // replay, and how much of `experimentName`'s preview was undone.
  private unwindFrom(experimentName: string): {
    removed?: PreviewLayer
    above: PreviewLayer[]
    undone: number
  } {
    const index = this.stack.findIndex((l) => l.name === experimentName)
    if (index === -1) return { above: [], undone: this.release(experimentName) }
    const [removed, ...above] = this.stack.splice(index)
    for (let i = above.length - 1; i >= 0; i--) this.unwind(above[i])
    return { removed, above, undone: this.unwind(removed) }
  }

  // Runs `run` while `experimentName` is the newest layer.
  private onTop<T>(experimentName: string, run: () => T): T {
    const index = this.stack.findIndex((l) => l.name === experimentName)
    if (index === -1 || index === this.stack.length - 1) return run()
    const above = this.stack.splice(index + 1)
    for (let i = above.length - 1; i >= 0; i--) this.unwind(above[i])
    try {
      return run()
    } finally {
      this.replay(above)
    }
  }

  // Inverts everything `layer` did, cancels its pending SPA work and drops
  // its stylesheet. Returns the number of entries and stylesheets undone.
  private unwind(layer: PreviewLayer): number {
    const count = this.release(layer.name)
    const { journal } = layer
    undoMutations(journal.entries)
    restoreAttributeOrder(journal.attributeOrder)
    this.undoFormWrites(journal.formWrites)
    for (const element of journal.marked) {
      if (element.getAttribute("data-absmartly-experiment") !== layer.name)
        continue
      element.removeAttribute("data-absmartly-experiment")
      element.removeAttribute("data-absmartly-modified")
    }
    return count + journal.entries.length
  }

  private release(experimentName: string): number {
    // Cancel pending SPA work first, so no late mount re-applies.
    const session = this.sessions.get(experimentName)
    if (session) {
      this.sessions.delete(experimentName)
      session.destroy()
    }
    const styleManager = this.styleManagers.get(experimentName)
    if (styleManager) {
      styleManager.destroy()
      this.styleManagers.delete(experimentName)
    }
    // Same id format as the SDK plugin's stylesheet.
    const styleElement = document.getElementById(
      `absmartly-styles-${experimentName}`
    )
    if (!styleElement) return 0
    styleElement.remove()
    return 1
  }

  // Re-applies unwound layers in their original order with fresh journals
  // and sessions. A change that throws is logged; the rest still apply.
  private replay(layers: PreviewLayer[]): void {
    for (const { name, changes } of layers) {
      this.stack.push(newLayer(name, changes))
      for (const change of changes) {
        try {
          this.applyChange(change, name)
        } catch (error) {
          Logger.error("[PreviewManager] Re-applying preview failed:", error)
        }
      }
    }
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
    const { journal } = this.getLayer(experimentName)
    recordAttributeOrder(journal.attributeOrder, targets)
    let formBefore: Array<[FormControl, Record<string, string | boolean>]> = []
    if (change.type === "javascript") {
      for (const target of targets) {
        recordAttributeOrder(
          journal.attributeOrder,
          target.querySelectorAll("*")
        )
      }
      formBefore = formControlsIn(targets).map((control) => [
        control,
        formProperties(control)
      ])
    }
    // A change matching nested targets detaches an inner target (text or
    // html on the outer one) before applying to it; observing each target
    // directly keeps those writes in the journal.
    for (const element of targets) journal.targets.add(element)
    const { result, entries } = recordMutations(
      [document, ...targets],
      apply,
      undefined,
      (partial) => journal.entries.push(...partial)
    )
    journal.entries.push(...entries)
    this.recordFormWrites(journal, formBefore)
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

  private recordFormWrites(
    journal: PreviewJournal,
    before: Array<[FormControl, Record<string, string | boolean>]>
  ): void {
    for (const [control, properties] of before) {
      const after = formProperties(control) as Record<string, string | boolean>
      for (const [property, value] of Object.entries(properties)) {
        if (after[property] !== value)
          journal.formWrites.push({
            element: control,
            property: property as FormPropertyWrite["property"],
            before: value,
            after: after[property]
          })
      }
    }
  }

  // Newest first, and only where the property still holds the preview's
  // value: a value the user or page has since entered is theirs.
  private undoFormWrites(writes: FormPropertyWrite[]): void {
    for (let i = writes.length - 1; i >= 0; i--) {
      const { element, property, before, after } = writes[i]
      const control = element as unknown as Record<string, string | boolean>
      if (control[property] === after) control[property] = before
    }
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
        // A late match is journaled with this preview as the newest layer,
        // so newer previews are unwound around it and re-applied on top. If
        // unwinding them detached the match, it stays pending instead.
        const connected = element.isConnected
        return this.onTop(experimentName, () =>
          connected && !element.isConnected
            ? false
            : this.applyJournaled(experimentName, change, [element], apply)
        )
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
    if (isDisabled(change)) {
      Logger.log("Skipping disabled change:", change.selector)
      return false
    }
    this.getLayer(experimentName).changes.push(change)
    return this.onTop(experimentName, () =>
      this.applyChange(change, experimentName)
    )
  }

  private applyChange(change: DOMChange, experimentName: string): boolean {
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

  // The visual editor writes data-absmartly-original (a serialization of the
  // element's current, previewed content) and data-absmartly-experiment onto
  // an element when it is selected, outside any journal. After the journal
  // restored the element both are stale: replaying the sidecar would paint
  // preview content back, and a marker naming an experiment without a live
  // preview would survive the name-based sweep. Targets detached by the
  // preview (delete) are included; they were never marked.
  private clearEditorMarkers(targets: Set<Element>): void {
    for (const element of targets) {
      element.removeAttribute("data-absmartly-original")
      const owner = element.getAttribute("data-absmartly-experiment")
      if (owner !== null && !this.layer(owner)) {
        element.removeAttribute("data-absmartly-experiment")
        element.removeAttribute("data-absmartly-modified")
      }
    }
  }

  // Markers written outside the journal (visual-editor selection, or
  // targets of an earlier session) are stripped by name. The selection
  // sidecar is never replayed: it serializes whatever was on the page when
  // the element was selected, previewed content included, and the journal
  // has already restored everything a preview wrote.
  private sweepMarkers(experimentName: string): number {
    const markedElements = document.querySelectorAll(
      `[data-absmartly-experiment="${experimentName}"], [data-absmartly-experiment="__preview__"]`
    )
    for (const element of markedElements) {
      element.removeAttribute("data-absmartly-original")
      element.removeAttribute("data-absmartly-experiment")
      element.removeAttribute("data-absmartly-modified")
    }
    return markedElements.length
  }

  /**
   * Remove all preview changes for an experiment
   */
  removePreviewChanges(experimentName: string): boolean {
    Logger.log("Removing preview changes for experiment:", experimentName)
    const { removed, above, undone } = this.unwindFrom(experimentName)
    const restoredCount = undone + this.sweepMarkers(experimentName)
    this.replay(above)
    if (removed) this.clearEditorMarkers(removed.journal.targets)
    Logger.log(`Removed preview changes, cleaned ${restoredCount} elements`)
    return restoredCount > 0
  }

  /**
   * Replace an experiment's preview with `changes`, keeping its place among
   * the other live previews. Returns how many changes applied.
   * `beforeApply` runs before each change, against the page it will see.
   */
  replacePreviewChanges(
    experimentName: string,
    changes: DOMChange[],
    beforeApply?: (change: DOMChange) => void
  ): number {
    const { removed: replaced, above } = this.unwindFrom(experimentName)
    this.sweepMarkers(experimentName)
    let applied = 0
    try {
      for (const change of changes) {
        beforeApply?.(change)
        if (this.applyPreviewChange(change, experimentName)) applied++
      }
    } finally {
      this.replay(above)
      if (replaced) this.clearEditorMarkers(replaced.journal.targets)
    }
    return applied
  }

  /**
   * Clear all preview changes
   */
  clearAll(): void {
    const layers = this.stack.splice(0)
    for (let i = layers.length - 1; i >= 0; i--) this.unwind(layers[i])
    const experimentNames = new Set<string>([
      ...layers.map((layer) => layer.name),
      ...this.sessions.keys(),
      ...this.styleManagers.keys()
    ])
    for (const name of experimentNames) {
      this.release(name)
      this.sweepMarkers(name)
    }
    for (const layer of layers) this.clearEditorMarkers(layer.journal.targets)
  }

  /**
   * Get count of tracked preview elements
   */
  getPreviewCount(): number {
    let count = 0
    for (const { journal } of this.stack) count += journal.marked.size
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
