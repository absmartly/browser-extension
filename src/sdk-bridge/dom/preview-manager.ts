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
  inheritOldValue,
  recordAttributeOrder,
  recordMutations,
  restoreAttributeOrder,
  sameSlot,
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

type ChildListEntry = Extract<JournalEntry, { kind: "childList" }>

// Everything one experiment's preview did to the page, in application order.
interface PreviewJournal {
  entries: JournalEntry[]
  attributeOrder: Map<Element, string[]>
  marked: Set<Element>
  // Every element a change was applied to, including ones it detached.
  targets: Set<Element>
  formWrites: FormPropertyWrite[]
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
  // Global application order of every journaled entry, across experiments.
  private entrySeq = new WeakMap<JournalEntry, number>()
  private nextSeq = 0

  private append(journal: PreviewJournal, entries: JournalEntry[]): void {
    for (const entry of entries) {
      this.entrySeq.set(entry, this.nextSeq++)
      journal.entries.push(entry)
    }
  }

  // The earliest entry of a live preview applied after `entry` that
  // matches `test`, with the journal holding it.
  private laterLiveEntry<T extends JournalEntry>(
    entry: JournalEntry,
    test: (candidate: JournalEntry) => candidate is T
  ): { entry: T; journal: PreviewJournal } | null {
    const seq = this.entrySeq.get(entry) ?? -1
    let found: { entry: T; journal: PreviewJournal } | null = null
    let foundSeq = Infinity
    for (const journal of this.journals.values()) {
      for (const candidate of journal.entries) {
        const candidateSeq = this.entrySeq.get(candidate) ?? -1
        if (candidateSeq > seq && candidateSeq < foundSeq && test(candidate)) {
          found = { entry: candidate, journal }
          foundSeq = candidateSeq
        }
      }
    }
    return found
  }

  // Removing a preview whose write a later live preview overwrote leaves
  // that write's result in place, but the later entry still records it as
  // the state to restore. Hand the later entry this preview's own prior
  // state instead, so removing the later preview restores the page.
  private spliceIntoLaterOwner(skipped: JournalEntry): void {
    if (skipped.kind === "childList") return
    const found = this.laterLiveEntry(
      skipped,
      (candidate): candidate is typeof skipped => sameSlot(candidate, skipped)
    )
    if (found) inheritOldValue(found.entry, skipped)
  }

  // `taken` are nodes `skipped` added that a later live preview moved out
  // of the parent. That preview's undo must put back what `skipped`
  // removed in their place, so it becomes responsible for those nodes.
  private handOver(
    skipped: ChildListEntry,
    removedEntries: JournalEntry[],
    takenNodes: Node[]
  ): boolean {
    const added = new Set(takenNodes)
    const found = this.laterLiveEntry(
      skipped,
      (candidate): candidate is ChildListEntry =>
        candidate.kind === "childList" &&
        candidate.target === skipped.target &&
        takenNodes.every((node) => candidate.removed.includes(node))
    )
    if (!found) return false
    const owner = found.entry
    const taken = owner.removed.filter((node) => added.has(node))
    const at = owner.removed.findIndex((node) => added.has(node))
    const kept = owner.removed.filter((node) => !added.has(node))
    const before = owner.removed.slice(0, at).filter((node) => !added.has(node))
    owner.removed = [
      ...before,
      ...skipped.removed,
      ...kept.slice(before.length)
    ]
    // A node this preview moved here and the later one moved on: the later
    // preview's undo now returns it to where this preview found it, and
    // this preview's own reinsert there is dropped.
    const index = removedEntries.indexOf(skipped)
    for (const node of taken) {
      for (let i = index - 1; i >= 0; i--) {
        const source = removedEntries[i]
        if (source.kind !== "childList" || !source.removed.includes(node))
          continue
        source.removed = source.removed.filter((other) => other !== node)
        const moved: ChildListEntry = {
          kind: "childList",
          target: source.target,
          added: [],
          removed: [node],
          previousSibling: source.previousSibling,
          nextSibling: source.nextSibling
        }
        this.entrySeq.set(moved, this.entrySeq.get(owner) ?? -1)
        const entries = found.journal.entries
        entries.splice(entries.indexOf(owner), 0, moved)
        break
      }
    }
    return true
  }

  // Undoing `entry` moves `node` away from where a later live preview saw
  // it. That preview's entries that use `node` as a sibling anchor are
  // re-anchored on the node's current neighbour, which names the same slot
  // once `node` has gone.
  private rebaseAnchors(entry: JournalEntry, node: Node): void {
    const seq = this.entrySeq.get(entry) ?? -1
    for (const journal of this.journals.values()) {
      for (const later of journal.entries) {
        if (later.kind !== "childList") continue
        if ((this.entrySeq.get(later) ?? -1) <= seq) continue
        if (later.target !== node.parentNode) continue
        if (later.nextSibling === node) later.nextSibling = node.nextSibling
        if (later.previousSibling === node)
          later.previousSibling = node.previousSibling
      }
    }
  }

  // A reinsert whose siblings a later live entry removed belongs next to
  // them in that entry's removed list: they come back together when the
  // later preview is removed, and stay out while it is applied.
  private adoptUnanchored(entry: ChildListEntry): boolean {
    const { previousSibling, nextSibling } = entry
    const owner = this.laterLiveEntry(
      entry,
      (candidate): candidate is ChildListEntry =>
        candidate.kind === "childList" &&
        candidate.target === entry.target &&
        candidate.removed.some(
          (node) => node === previousSibling || node === nextSibling
        )
    )
    if (!owner) return false
    const { removed } = owner.entry
    const afterPrevious =
      previousSibling !== null ? removed.indexOf(previousSibling) : -1
    const at =
      afterPrevious !== -1
        ? afterPrevious + 1
        : removed.indexOf(nextSibling as Node)
    removed.splice(at, 0, ...entry.removed)
    return true
  }

  private getJournal(experimentName: string): PreviewJournal {
    let journal = this.journals.get(experimentName)
    if (!journal) {
      journal = {
        entries: [],
        attributeOrder: new Map(),
        marked: new Set(),
        targets: new Set(),
        formWrites: []
      }
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
      (partial) => this.append(journal, partial)
    )
    this.append(journal, entries)
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
      if (owner !== null && !this.journals.has(owner)) {
        element.removeAttribute("data-absmartly-experiment")
        element.removeAttribute("data-absmartly-modified")
      }
    }
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
      undoMutations(journal.entries, {
        onSkip: (skipped) => this.spliceIntoLaterOwner(skipped),
        handOver: (entry, taken) =>
          this.handOver(entry, journal.entries, taken),
        adoptUnanchored: (entry) => this.adoptUnanchored(entry),
        beforeDetach: (entry, node) => this.rebaseAnchors(entry, node)
      })
      restoreAttributeOrder(journal.attributeOrder)
      this.undoFormWrites(journal.formWrites)
      restoredCount += journal.entries.length
      this.clearEditorMarkers(journal.targets)
    }

    // Markers written outside the journal (visual-editor selection, or
    // targets of an earlier session) are stripped by name. The selection
    // sidecar is never replayed: it serializes whatever was on the page when
    // the element was selected, previewed content included, and the journal
    // has already restored everything a preview wrote.
    const markedElements = document.querySelectorAll(
      `[data-absmartly-experiment="${experimentName}"], [data-absmartly-experiment="__preview__"]`
    )
    for (const element of markedElements) {
      element.removeAttribute("data-absmartly-original")
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
