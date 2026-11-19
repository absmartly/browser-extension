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
import {
  PREVIEW_UNWIND_EVENT,
  VISUAL_EDITOR_EXPERIMENT_NAME
} from "./preview-events"

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

// Everything one segment did to the page, in application order.
interface PreviewJournal {
  entries: JournalEntry[]
  attributeOrder: Map<Element, string[]>
  marked: Set<Element>
  // Every element a change was applied to, including ones it detached.
  targets: Set<Element>
  formWrites: FormPropertyWrite[]
  // Every form property of a javascript change's targets as the apply left
  // it, written or not; a later value differing from it is the user's.
  formSeen: Array<Omit<FormPropertyWrite, "before">>
}

// One write in a segment: a change applied by selector, or a pending
// change the SDK applied to `element` after it mounted (a late match).
// `matchedLate` marks a selector write whose pending work later matched;
// replay re-applies it at its late match instead.
interface Write {
  change: DOMChange
  element?: Element
  matchedLate?: boolean
}

// One contiguous run of one experiment's writes. An experiment gets a new
// segment whenever it writes while another experiment's segment is on top:
// its first apply, a later apply, or a late SPA match. `writes`, in order,
// are what replay re-applies; `journal` is what applying them did; the
// session holds the pending SPA work the writes registered.
interface Segment {
  name: string
  writes: Write[]
  journal: PreviewJournal
  session?: PreviewDOMManipulator
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

// One SDK manipulator per segment: destroying it disconnects that segment's
// observers and drops its pending work without touching other segments.
// Late matches are routed through applyOwned so they are captured for
// restoration and rejected once the segment is no longer live.
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
          this.applyToElement(change, experimentName, element)
        )
      },
      true
    )
  }

  applyToElement(
    change: DOMChange,
    experimentName: string,
    element: Element
  ): boolean {
    return (
      this as unknown as SpecificElementApplier
    ).applyChangeToSpecificElement(change, experimentName, element)
  }
}

function newSegment(name: string): Segment {
  return {
    name,
    writes: [],
    journal: {
      entries: [],
      attributeOrder: new Map(),
      marked: new Set(),
      targets: new Set(),
      formWrites: [],
      formSeen: []
    }
  }
}

function matches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector)
  } catch {
    return false
  }
}

const isDisabled = (change: DOMChange) =>
  ("disabled" in change && change.disabled) ||
  ("enabled" in change && change.enabled === false)

type FormSnapshot = Array<{
  control: FormControl
  property: string
  value: string | boolean
}>

export class PreviewManager {
  // Live segments in application order, oldest first. A journal is only
  // ever inverted against the DOM its own records produced: a write by an
  // experiment that is not on top opens a new segment on top instead of
  // reaching under newer ones, and removing or replacing an experiment
  // first unwinds every segment from its lowest one up, newest first, then
  // re-applies the other experiments' unwound segments in order.
  private stack: Segment[] = []
  private styleManagers: Map<string, StyleSheetManager> = new Map()

  private isLive(experimentName: string): boolean {
    return this.stack.some((segment) => segment.name === experimentName)
  }

  // The segment `experimentName`'s next write goes into.
  private topFor(experimentName: string): Segment {
    const top = this.stack[this.stack.length - 1]
    if (top?.name === experimentName) return top
    const segment = newSegment(experimentName)
    this.stack.push(segment)
    return segment
  }

  // Takes every segment from `experimentName`'s lowest one up off the
  // stack and inverts them newest first. Pending SPA work of each is
  // cancelled before any DOM is inverted, so no late mount re-applies.
  private unwindFrom(index: number): Segment[] {
    const unwound = this.stack.splice(index)
    if (unwound.some((s) => s.name === VISUAL_EDITOR_EXPERIMENT_NAME)) {
      window.dispatchEvent(
        new CustomEvent(PREVIEW_UNWIND_EVENT, {
          detail: {
            experiments: Array.from(new Set(unwound.map((s) => s.name)))
          }
        })
      )
    }
    for (const segment of unwound) {
      segment.session?.destroy()
      segment.session = undefined
    }
    for (let i = unwound.length - 1; i >= 0; i--) this.undo(unwound[i])
    return unwound
  }

  private undo(segment: Segment): void {
    const { journal } = segment
    undoMutations(journal.entries)
    restoreAttributeOrder(journal.attributeOrder)
    this.undoFormWrites(journal.formWrites)
    for (const element of journal.marked) {
      if (element.getAttribute("data-absmartly-experiment") !== segment.name)
        continue
      element.removeAttribute("data-absmartly-experiment")
      element.removeAttribute("data-absmartly-modified")
    }
  }

  // Drops the experiment's stylesheet; returns 1 if one was on the page.
  private releaseStyles(experimentName: string): number {
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

  // Values the user or page entered into form controls after a preview's
  // javascript last ran over them. `unwound` is every segment about to be
  // unwound, oldest first; only controls inside `replayed` targets are
  // considered, since replaying those segments is what would overwrite the
  // value.
  private snapshotForm(unwound: Segment[], replayed: Segment[]): FormSnapshot {
    const lastSeen = new Map<FormControl, Map<string, string | boolean>>()
    for (const { journal } of unwound) {
      for (const { element, property, after } of journal.formSeen) {
        const control = element as FormControl
        if (!lastSeen.has(control)) lastSeen.set(control, new Map())
        lastSeen.get(control).set(property, after)
      }
    }
    const targets = new Set<Element>()
    for (const { journal } of replayed)
      for (const target of journal.targets) targets.add(target)
    const snapshot: FormSnapshot = []
    for (const control of formControlsIn(Array.from(targets))) {
      const seen = lastSeen.get(control)
      if (!seen) continue
      const live = formProperties(control) as Record<string, string | boolean>
      for (const [property, after] of seen) {
        if (property in live && live[property] !== after)
          snapshot.push({ control, property, value: live[property] })
      }
    }
    return snapshot
  }

  private restoreForm(snapshot: FormSnapshot): void {
    for (const { control, property, value } of snapshot) {
      const live = control as unknown as Record<string, string | boolean>
      if (live[property] !== value) live[property] = value
    }
  }

  // Re-applies unwound segments' writes in their original order with fresh
  // journals and sessions, so their pending SPA work is registered again.
  // A change that was pending when applied and matched an element later is
  // replayed where its late match was: to that element if it is still on
  // the page and matches, otherwise by selector (pending again if nothing
  // matches). A change that throws is logged; the rest still apply.
  private replay(segments: Segment[]): void {
    for (const { name, writes } of segments) {
      // Separate SDK sessions must retain their pending-selector dedup boundaries.
      const segment = newSegment(name)
      this.stack.push(segment)
      for (const { change, element, matchedLate } of writes) {
        if (matchedLate) continue
        try {
          if (element?.isConnected && matches(element, change.selector)) {
            const session = this.sessionFor(segment)
            if (
              this.applyJournaled(segment, change, [element], () =>
                session.applyToElement(change, name, element)
              )
            )
              segment.writes.push({ change, element })
          } else {
            segment.writes.push({ change })
            this.applyChange(segment, change)
          }
        } catch (error) {
          Logger.error("[PreviewManager] Re-applying preview failed:", error)
        }
      }
    }
  }

  // Marks the selector write whose pending work produced a late match.
  private resolvePending(experimentName: string, change: DOMChange): void {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const { name, writes } = this.stack[i]
      if (name !== experimentName) continue
      const write = writes.find(
        (w) => w.change === change && !w.element && !w.matchedLate
      )
      if (write) {
        write.matchedLate = true
        return
      }
    }
  }

  // Applies one change to `targets` and journals every DOM mutation it
  // makes into `segment`, which must be on top. Tracking markers are
  // written outside the journal (the marker sweep in removePreviewChanges
  // clears them): another experiment may re-mark the same element, and
  // undoing a marker write would resurrect a stale experiment name.
  private applyJournaled(
    segment: Segment,
    change: DOMChange,
    targets: Element[],
    apply: () => boolean
  ): boolean {
    const { journal } = segment
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
          this.markElement(element, segment.name)
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
        journal.formSeen.push({
          element: control,
          property: property as FormPropertyWrite["property"],
          after: after[property]
        })
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

  private sessionFor(owner: Segment): PreviewDOMManipulator {
    if (owner.session) return owner.session
    const experimentName = owner.name
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
        // The SDK matches added nodes when their MutationRecords are
        // delivered, which can be after an unwind or replay detached them
        // again; such a match stays pending.
        if (
          owner.session !== session ||
          !element.isConnected ||
          this.isExtensionElement(element)
        )
          return false
        // Journaled on top: in the experiment's top segment if it is the
        // newest, otherwise in a new segment above the newer previews.
        const segment = this.topFor(experimentName)
        const result = this.applyJournaled(segment, change, [element], apply)
        if (result) {
          this.resolvePending(experimentName, change)
          segment.writes.push({ change, element })
        } else if (
          segment.journal.entries.length === 0 &&
          segment.writes.length === 0
        )
          this.stack.pop()
        return result
      }
    )
    owner.session = session
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
    const segment = this.topFor(experimentName)
    segment.writes.push({ change })
    return this.applyChange(segment, change)
  }

  private applyChange(segment: Segment, change: DOMChange): boolean {
    const session = this.sessionFor(segment)
    const experimentName = segment.name
    // styleRules only write the experiment's stylesheet, which removal
    // destroys as a whole.
    if (change.type === "styleRules") {
      return session.applyChange(change, experimentName)
    }

    // The segment's SDK manipulator applies current matches and registers
    // waitForElement/SPA selectors with its pending manager, whose late
    // matches are journaled through applyOwned (see sessionFor).
    const targets =
      change.type === "create" ? [] : this.findPreviewTargets(change.selector)
    return this.applyJournaled(segment, change, targets, () =>
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
      if (owner !== null && !this.isLive(owner)) {
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

  // Unwinds `experimentName`'s segments and every segment above its lowest
  // one. Returns the unwound segments of other experiments, oldest first,
  // the removed experiment's segments, and the form values to carry over.
  private takeDown(experimentName: string): {
    others: Segment[]
    own: Segment[]
    form: FormSnapshot
  } {
    const slot = this.stack.findIndex((s) => s.name === experimentName)
    if (slot === -1) return { others: [], own: [], form: [] }
    const above = this.stack.slice(slot)
    const others = above.filter((s) => s.name !== experimentName)
    const form = this.snapshotForm(above, others)
    const unwound = this.unwindFrom(slot)
    return {
      others,
      own: unwound.filter((s) => s.name === experimentName),
      form
    }
  }

  // Re-applies the other experiments' segments taken down by takeDown.
  private putBack(others: Segment[], form: FormSnapshot): void {
    this.replay(others)
    this.restoreForm(form)
  }

  /**
   * Remove all preview changes for an experiment
   */
  removePreviewChanges(experimentName: string): boolean {
    Logger.log("Removing preview changes for experiment:", experimentName)
    const { others, own, form } = this.takeDown(experimentName)
    const undone =
      own.reduce((n, s) => n + s.journal.entries.length, 0) +
      this.releaseStyles(experimentName)
    const restoredCount = undone + this.sweepMarkers(experimentName)
    this.putBack(others, form)
    for (const segment of own) this.clearEditorMarkers(segment.journal.targets)
    Logger.log(`Removed preview changes, cleaned ${restoredCount} elements`)
    return restoredCount > 0
  }

  /**
   * Replace an experiment's preview with `changes`, keeping its place among
   * the other live previews (the slot of its oldest segment). Returns how
   * many changes applied. `beforeApply` runs before each change, against
   * the page it will see.
   */
  replacePreviewChanges(
    experimentName: string,
    changes: DOMChange[],
    beforeApply?: (change: DOMChange) => void
  ): number {
    const { others, own, form } = this.takeDown(experimentName)
    this.releaseStyles(experimentName)
    this.sweepMarkers(experimentName)
    let applied = 0
    try {
      for (const change of changes) {
        beforeApply?.(change)
        if (this.applyPreviewChange(change, experimentName)) applied++
      }
    } finally {
      this.putBack(others, form)
      for (const segment of own)
        this.clearEditorMarkers(segment.journal.targets)
    }
    return applied
  }

  /**
   * Clear all preview changes
   */
  clearAll(): void {
    const segments = this.unwindFrom(0)
    const experimentNames = new Set<string>([
      ...segments.map((segment) => segment.name),
      ...this.styleManagers.keys()
    ])
    for (const name of experimentNames) {
      this.releaseStyles(name)
      this.sweepMarkers(name)
    }
    for (const segment of segments)
      this.clearEditorMarkers(segment.journal.targets)
  }

  /**
   * Get count of tracked preview elements
   */
  getPreviewCount(): number {
    const marked = new Set<Element>()
    for (const { journal } of this.stack)
      for (const element of journal.marked) marked.add(element)
    return marked.size
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
