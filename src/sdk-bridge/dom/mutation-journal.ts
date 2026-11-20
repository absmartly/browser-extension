/**
 * Records the DOM mutations a preview change makes and inverts them.
 *
 * Undo model: everything a change does synchronously (SDK apply, user
 * javascript, created nodes) is captured as MutationRecords with old values.
 * Removing a preview inverts the records of all its changes newest-first.
 * Each inverse therefore runs against the DOM state its own record produced,
 * so overlapping changes (an ancestor's html or javascript after a
 * descendant's style, a move into a changed container, a create followed by
 * a change on the created node) unwind without ordering rules, and every
 * original node is put back by identity rather than re-parsed.
 *
 * @module MutationJournal
 */

import { Logger } from "../utils/logger"

export type JournalEntry =
  | {
      kind: "attributes"
      target: Element
      name: string
      namespace: string | null
      oldValue: string | null
      newValue: string | null
    }
  | {
      kind: "characterData"
      target: CharacterData
      oldValue: string
      newValue: string
    }
  | {
      kind: "childList"
      target: Node
      added: Node[]
      removed: Node[]
      previousSibling: Node | null
      nextSibling: Node | null
    }

const OBSERVE_ALL: MutationObserverInit = {
  subtree: true,
  childList: true,
  attributes: true,
  attributeOldValue: true,
  characterData: true,
  characterDataOldValue: true
}

function toEntry(record: MutationRecord): JournalEntry {
  if (record.type === "attributes") {
    return {
      kind: "attributes",
      target: record.target as Element,
      name: record.attributeName as string,
      namespace: record.attributeNamespace,
      oldValue: record.oldValue,
      newValue: null
    }
  }
  if (record.type === "characterData") {
    return {
      kind: "characterData",
      target: record.target as CharacterData,
      oldValue: record.oldValue ?? "",
      newValue: ""
    }
  }
  return {
    kind: "childList",
    target: record.target,
    added: Array.from(record.addedNodes),
    removed: Array.from(record.removedNodes),
    previousSibling: record.previousSibling,
    nextSibling: record.nextSibling
  }
}

function attributeValue(
  target: Element,
  namespace: string | null,
  name: string
): string | null {
  return target.getAttributeNodeNS(namespace, name)?.value ?? null
}

// Null-namespace colon names and ordinary HTML xmlns cannot be recreated
// with setAttributeNS. Use the ordinary attribute operation for these names;
// other names keep setAttributeNS to preserve case such as SVG viewBox.
function writeAttribute(
  target: Element,
  namespace: string | null,
  name: string,
  value: string | null
): void {
  if (value === null) {
    target.removeAttributeNS(namespace, name)
    return
  }
  const attr = target.getAttributeNodeNS(namespace, name)
  if (attr) attr.value = value
  else if (namespace === null && (name.includes(":") || name === "xmlns"))
    target.setAttribute(name, value)
  else target.setAttributeNS(namespace, name, value)
}

type AttributeState = Extract<JournalEntry, { kind: "attributes" }>
type CharacterDataState = Extract<JournalEntry, { kind: "characterData" }>
type ValueEntry = AttributeState | CharacterDataState

type Declaration = { value: string; priority: string }

function isInlineStyle(entry: ValueEntry): entry is AttributeState {
  return (
    entry.kind === "attributes" &&
    entry.name === "style" &&
    entry.namespace === null &&
    "style" in entry.target
  )
}

function declarations(
  doc: Document,
  cssText: string | null
): Map<string, Declaration> {
  const map = new Map<string, Declaration>()
  if (!cssText) return map
  const scratch = doc.createElement("div")
  scratch.setAttribute("style", cssText)
  const style = scratch.style
  for (let i = 0; i < style.length; i++) {
    const name = style.item(i)
    map.set(name, {
      value: style.getPropertyValue(name),
      priority: style.getPropertyPriority(name)
    })
  }
  return map
}

const sameDeclaration = (a?: Declaration, b?: Declaration) =>
  a?.value === b?.value && a?.priority === b?.priority

function writeDeclaration(
  style: CSSStyleDeclaration,
  name: string,
  declaration: Declaration | undefined
): void {
  if (declaration)
    style.setProperty(name, declaration.value, declaration.priority)
  else style.removeProperty(name)
}

// The inline style has changed since the entry was recorded: restore each
// declaration whose value differs between the entry's old and new style,
// only where it still holds the entry's value, leaving declarations
// written by others in place.
function undoStyleDeclarations(entry: AttributeState): void {
  const element = entry.target as Element & ElementCSSInlineStyle
  const doc = element.ownerDocument
  const current = declarations(doc, element.getAttribute("style"))
  const before = declarations(doc, entry.oldValue)
  const after = declarations(doc, entry.newValue)
  let reverted = false
  for (const name of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(name)
    const written = after.get(name)
    if (sameDeclaration(old, written)) continue
    if (sameDeclaration(current.get(name), written)) {
      writeDeclaration(element.style, name, old)
      reverted = true
    }
  }
  if (reverted && element.style.length === 0 && before.size === 0) {
    if (entry.oldValue === null) element.removeAttribute("style")
    else element.setAttribute("style", entry.oldValue)
  }
}

export type MutationJournalDiagnostics = {
  records: number
  detachedSubtreeVisits: number
}

function isWithinRetiredSubtree(node: Node, retiredRoots: Set<Node>): boolean {
  let current: Node | null = node
  while (current) {
    if (retiredRoots.has(current)) return true
    current = current.parentNode
  }
  return false
}

// Latest value entry per attribute (keyed by namespace and name) and per
// text node. Entries under a detached subtree are kept apart in a retired
// state so a reattached node gets its entries back.
type JournalState = {
  attributes: Map<Element, Map<string, AttributeState>>
  characterData: Map<CharacterData, CharacterDataState>
}

const emptyState = (): JournalState => ({
  attributes: new Map(),
  characterData: new Map()
})

function settle(state: ValueEntry): void {
  if (state.kind === "attributes")
    state.newValue = attributeValue(state.target, state.namespace, state.name)
  else state.newValue = state.target.data
}

function settleAll(journal: JournalState): void {
  for (const states of journal.attributes.values()) {
    for (const state of states.values()) settle(state)
  }
  for (const state of journal.characterData.values()) settle(state)
}

// Moves `node`'s entries from one state to the other, settling their
// values first when `settleValues` is set.
function transfer(
  node: Node,
  from: JournalState,
  to: JournalState,
  settleValues: boolean
): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    const states = from.attributes.get(element)
    if (!states) return
    if (settleValues) for (const state of states.values()) settle(state)
    from.attributes.delete(element)
    to.attributes.set(element, states)
  } else if (
    node.nodeType === Node.TEXT_NODE ||
    node.nodeType === Node.CDATA_SECTION_NODE
  ) {
    const character = node as CharacterData
    const state = from.characterData.get(character)
    if (!state) return
    if (settleValues) settle(state)
    from.characterData.delete(character)
    to.characterData.set(character, state)
  }
}

function restoreAttachedSubtree(
  node: Node,
  retiredRoots: Set<Node>,
  active: JournalState,
  retired: JournalState
): void {
  const visit = (current: Node) => {
    retiredRoots.delete(current)
    transfer(current, retired, active, false)
    for (const child of current.childNodes) visit(child)
  }
  visit(node)
}

function markDetached(
  node: Node,
  retiredRoots: Set<Node>,
  active: JournalState,
  retired: JournalState,
  diagnostics?: MutationJournalDiagnostics
): void {
  if (isWithinRetiredSubtree(node, retiredRoots)) return
  retiredRoots.add(node)
  const visit = (current: Node) => {
    diagnostics && (diagnostics.detachedSubtreeVisits += 1)
    transfer(current, active, retired, true)
    for (const child of current.childNodes) visit(child)
  }
  visit(node)
}

function toEntries(
  records: MutationRecord[],
  diagnostics?: MutationJournalDiagnostics
): JournalEntry[] {
  const entries: JournalEntry[] = []
  const active = emptyState()
  const retired = emptyState()
  const retiredRoots = new Set<Node>()

  for (const record of records) {
    diagnostics && (diagnostics.records += 1)
    const entry = toEntry(record)
    entries.push(entry)
    if (entry.kind === "childList") {
      for (const added of record.addedNodes)
        restoreAttachedSubtree(added, retiredRoots, active, retired)
      for (const removed of record.removedNodes)
        markDetached(removed, retiredRoots, active, retired, diagnostics)
      continue
    }

    if (entry.kind === "attributes") {
      const key = `${entry.namespace ?? ""}\u0000${entry.name ?? ""}`
      const journal =
        retired.attributes.get(entry.target)?.has(key) ||
        isWithinRetiredSubtree(entry.target, retiredRoots)
          ? retired
          : active
      let states = journal.attributes.get(entry.target)
      if (!states) {
        states = new Map()
        journal.attributes.set(entry.target, states)
      }
      const previous = states.get(key)
      if (previous) previous.newValue = entry.oldValue
      states.set(key, entry)
      continue
    }

    const journal = isWithinRetiredSubtree(entry.target, retiredRoots)
      ? retired
      : active
    const previous = journal.characterData.get(entry.target)
    if (previous) previous.newValue = entry.oldValue
    journal.characterData.set(entry.target, entry)
  }

  settleAll(active)
  settleAll(retired)
  return entries
}

/**
 * Run `apply` and return every mutation it made under `roots`, in order.
 * Records are taken synchronously, so other code cannot interleave.
 * Observing a node directly keeps recording it after it is detached, which
 * observing only an ancestor does not guarantee.
 *
 * If `apply` throws, the mutations it made before throwing are passed to
 * `onThrow` and the error is rethrown, so the caller can still undo them.
 */
export function recordMutations<T>(
  roots: Iterable<Node>,
  apply: () => T,
  diagnostics?: MutationJournalDiagnostics,
  onThrow?: (entries: JournalEntry[]) => void
): { result: T; entries: JournalEntry[] } {
  const observer = new MutationObserver(() => {})
  for (const root of new Set(roots)) observer.observe(root, OBSERVE_ALL)
  let result: T
  try {
    result = apply()
  } catch (error) {
    const records = observer.takeRecords()
    observer.disconnect()
    onThrow?.(toEntries(records, diagnostics))
    throw error
  }
  const records = observer.takeRecords()
  observer.disconnect()
  return { result, entries: toEntries(records, diagnostics) }
}

/**
 * Start recording every mutation under `root` until the returned function
 * is called; it stops recording and returns the entries. For edits that
 * span user interaction (contenteditable, live HTML preview), so they can
 * be undone by node identity instead of re-parsing a serialized copy.
 */
export function watchMutations(root: Node): () => JournalEntry[] {
  const records: MutationRecord[] = []
  const observer = new MutationObserver((batch) => records.push(...batch))
  observer.observe(root, OBSERVE_ALL)
  return () => {
    records.push(...observer.takeRecords())
    observer.disconnect()
    return toEntries(records)
  }
}

type ChildListEntry = Extract<JournalEntry, { kind: "childList" }>

function undoChildList(
  entry: ChildListEntry,
  reinsertedLater: (node: Node) => boolean
): void {
  const { target, added, removed, previousSibling, nextSibling } = entry

  // A pure addition owns only the added nodes still in `target`; one that
  // page code moved elsewhere is the page's.
  if (removed.length === 0) {
    for (const node of added) {
      if (node.parentNode === target && !reinsertedLater(node))
        target.removeChild(node)
    }
    return
  }

  // Once something else has taken any node this entry added out of
  // `target` (page code re-rendering the subtree), that code owns the
  // children: putting the removed nodes back would delete its content.
  if (!added.every((node) => node.parentNode === target)) return

  // A node that an older entry puts back (the source half of a move) is
  // left in place here: the older insertBefore moves it in one step, and
  // if that destination has become invalid the node stays attached where
  // it is instead of being dropped.
  for (const node of added) {
    if (!reinsertedLater(node)) target.removeChild(node)
  }

  const anchor = slotAnchor(target, previousSibling, nextSibling)
  for (const node of removed) {
    // Page code may since have put `target` inside `node`; inserting would
    // throw HierarchyRequestError.
    if (node.contains(target)) continue
    target.insertBefore(node, anchor)
  }
}

/**
 * The node to insert before so inserted nodes land between the recorded raw
 * siblings: the next sibling if it is still in `parent`, else whatever
 * follows the previous sibling, else the front when the slot was first.
 * The visual editor reverts drops with the same rule, so its positional
 * selectors describe the order the journal restores.
 */
export function slotAnchor(
  parent: Node,
  previousSibling: Node | null,
  nextSibling: Node | null
): Node | null {
  if (nextSibling && nextSibling.parentNode === parent) return nextSibling
  if (previousSibling && previousSibling.parentNode === parent)
    return previousSibling.nextSibling
  if (previousSibling === null) return parent.firstChild
  return null
}

// Re-adding a removed attribute appends it, so the attribute list (and the
// element's serialization) would come back reordered. Elements that can lose
// an attribute have their original attribute order recorded before the
// change and reinstated after the undo.
export function recordAttributeOrder(
  into: Map<Element, string[]>,
  elements: Iterable<Element>
): void {
  for (const element of elements) {
    if (!into.has(element)) into.set(element, element.getAttributeNames())
  }
}

export function restoreAttributeOrder(order: Map<Element, string[]>): void {
  for (const [element, names] of order) {
    const current = element.getAttributeNames()
    const wanted = names.filter((name) => current.includes(name))
    const rest = current.filter((name) => !names.includes(name))
    const target = [...wanted, ...rest]
    if (target.every((name, i) => name === current[i])) continue
    const attrs = target.map((name) => element.getAttributeNode(name) as Attr)
    for (const attr of attrs) element.removeAttributeNode(attr)
    for (const attr of attrs) element.setAttributeNode(attr)
  }
}

/**
 * Invert entries newest-first, restoring the DOM they were recorded on.
 * An entry whose result something else has since overwritten (attribute
 * or text value, or a node it added) is left alone; an inline style is
 * then undone per declaration the page left alone. An entry whose inverse
 * throws does not stop the older ones; the first error is rethrown after
 * all of them have run.
 */
export function undoMutations(entries: JournalEntry[]): void {
  // How many not-yet-undone entries put each node back.
  const pendingReinserts = new Map<Node, number>()
  const countReinserts = (entry: JournalEntry, delta: number) => {
    if (entry.kind !== "childList") return
    for (const node of entry.removed)
      pendingReinserts.set(node, (pendingReinserts.get(node) ?? 0) + delta)
  }
  for (const entry of entries) countReinserts(entry, 1)

  let firstError: unknown
  let hasError = false
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    countReinserts(entry, -1)
    try {
      undoEntry(entry, (node) => (pendingReinserts.get(node) ?? 0) > 0)
    } catch (error) {
      Logger.error("[MutationJournal] Undoing an entry failed:", error)
      if (!hasError) {
        firstError = error
        hasError = true
      }
    }
  }
  if (hasError) throw firstError
}

function undoEntry(
  entry: JournalEntry,
  reinsertedLater: (node: Node) => boolean
): void {
  if (entry.kind === "attributes") {
    const { target, name, namespace, oldValue, newValue } = entry
    const current = attributeValue(target, namespace, name)
    if (current !== newValue) {
      // A style attribute the page removed outright is the page's; the
      // per-declaration fallback would re-create it.
      if (isInlineStyle(entry) && current !== null) undoStyleDeclarations(entry)
      return
    }
    writeAttribute(target, namespace, name, oldValue)
  } else if (entry.kind === "characterData") {
    if (entry.target.data === entry.newValue) entry.target.data = entry.oldValue
  } else {
    undoChildList(entry, reinsertedLater)
  }
}
