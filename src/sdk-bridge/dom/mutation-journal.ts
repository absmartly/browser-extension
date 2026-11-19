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

type AttributeState = Extract<JournalEntry, { kind: "attributes" }>
type CharacterDataState = Extract<JournalEntry, { kind: "characterData" }>
export type ValueEntry = AttributeState | CharacterDataState

/** Whether both entries record writes to the same attribute or text node. */
export function sameSlot(a: JournalEntry, b: ValueEntry): boolean {
  if (a.kind !== b.kind || a.target !== b.target) return false
  if (a.kind === "attributes" && b.kind === "attributes")
    return a.name === b.name && a.namespace === b.namespace
  return true
}

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

// Declarations whose value differs between the entry's old and new style.
function changedDeclarations(entry: AttributeState) {
  const doc = entry.target.ownerDocument
  const before = declarations(doc, entry.oldValue)
  const after = declarations(doc, entry.newValue)
  const names = new Set([...before.keys(), ...after.keys()])
  return Array.from(names)
    .filter((name) => !sameDeclaration(before.get(name), after.get(name)))
    .map((name) => ({ name, before: before.get(name), after: after.get(name) }))
}

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
// declaration the entry changed only where it still holds the entry's
// value, leaving declarations written by others in place.
function undoStyleDeclarations(entry: AttributeState): void {
  const element = entry.target as Element & ElementCSSInlineStyle
  const current = declarations(
    element.ownerDocument,
    element.getAttribute("style")
  )
  for (const { name, before, after } of changedDeclarations(entry)) {
    if (sameDeclaration(current.get(name), after))
      writeDeclaration(element.style, name, before)
  }
  const originallyEmpty =
    declarations(element.ownerDocument, entry.oldValue).size === 0
  if (element.style.length === 0 && originallyEmpty) {
    if (entry.oldValue === null) element.removeAttribute("style")
    else element.setAttribute("style", entry.oldValue)
  }
}

/**
 * `skipped` was not undone because `later` (the next write to the same
 * slot, still live) overwrote it. Rewrite `later` to restore what `skipped`
 * found, so removing `later` does not bring back `skipped`'s value. For an
 * inline style this is done per declaration `skipped` changed.
 */
export function inheritOldValue(later: ValueEntry, skipped: ValueEntry): void {
  if (isInlineStyle(skipped) && later.kind === "attributes") {
    const doc = skipped.target.ownerDocument
    const scratch = doc.createElement("div")
    if (later.oldValue !== null) scratch.setAttribute("style", later.oldValue)
    const inherited = declarations(doc, later.oldValue)
    for (const { name, before, after } of changedDeclarations(skipped)) {
      if (sameDeclaration(inherited.get(name), after))
        writeDeclaration(scratch.style, name, before)
    }
    later.oldValue =
      scratch.style.length === 0 &&
      declarations(doc, skipped.oldValue).size === 0
        ? skipped.oldValue
        : scratch.getAttribute("style")
    return
  }
  if (later.oldValue === skipped.newValue) later.oldValue = skipped.oldValue
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

function restoreAttachedSubtree(
  node: Node,
  retiredRoots: Set<Node>,
  attributes: Map<Element, Map<string, AttributeState>>,
  characterData: Map<CharacterData, CharacterDataState>,
  retiredAttributes: Map<Element, Map<string, AttributeState>>,
  retiredCharacterData: Map<CharacterData, CharacterDataState>
): void {
  const visit = (current: Node) => {
    retiredRoots.delete(current)
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element
      const states = retiredAttributes.get(element)
      if (states) {
        attributes.set(element, states)
        retiredAttributes.delete(element)
      }
    } else if (
      current.nodeType === Node.TEXT_NODE ||
      current.nodeType === Node.CDATA_SECTION_NODE
    ) {
      const character = current as CharacterData
      const state = retiredCharacterData.get(character)
      if (state) {
        characterData.set(character, state)
        retiredCharacterData.delete(character)
      }
    }
    for (const child of current.childNodes) visit(child)
  }
  visit(node)
}

function markDetached(
  node: Node,
  retiredRoots: Set<Node>,
  attributes: Map<Element, Map<string, AttributeState>>,
  characterData: Map<CharacterData, CharacterDataState>,
  retiredAttributes: Map<Element, Map<string, AttributeState>>,
  retiredCharacterData: Map<CharacterData, CharacterDataState>,
  diagnostics?: MutationJournalDiagnostics
): void {
  if (isWithinRetiredSubtree(node, retiredRoots)) return
  retiredRoots.add(node)
  const visit = (current: Node) => {
    diagnostics && (diagnostics.detachedSubtreeVisits += 1)
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element
      const states = attributes.get(element)
      if (states) {
        for (const state of states.values()) {
          state.newValue = attributeValue(
            state.target,
            state.namespace,
            state.name
          )
        }
        attributes.delete(element)
        retiredAttributes.set(element, states)
      }
    } else if (
      current.nodeType === Node.TEXT_NODE ||
      current.nodeType === Node.CDATA_SECTION_NODE
    ) {
      const character = current as CharacterData
      const state = characterData.get(character)
      if (state) {
        state.newValue = character.data
        characterData.delete(character)
        retiredCharacterData.set(character, state)
      }
    }
    for (const child of current.childNodes) visit(child)
  }
  visit(node)
}

function toEntries(
  records: MutationRecord[],
  diagnostics?: MutationJournalDiagnostics
): JournalEntry[] {
  const entries: JournalEntry[] = []
  const attributes = new Map<Element, Map<string, AttributeState>>()
  const characterData = new Map<CharacterData, CharacterDataState>()
  const retiredRoots = new Set<Node>()
  const retiredAttributes = new Map<Element, Map<string, AttributeState>>()
  const retiredCharacterData = new Map<CharacterData, CharacterDataState>()

  for (const record of records) {
    diagnostics && (diagnostics.records += 1)
    if (record.type === "childList") {
      for (const added of record.addedNodes)
        restoreAttachedSubtree(
          added,
          retiredRoots,
          attributes,
          characterData,
          retiredAttributes,
          retiredCharacterData
        )
      for (const removed of record.removedNodes)
        markDetached(
          removed,
          retiredRoots,
          attributes,
          characterData,
          retiredAttributes,
          retiredCharacterData,
          diagnostics
        )
      entries.push(toEntry(record))
      continue
    }

    if (record.type === "attributes") {
      const entry = toEntry(record) as Extract<
        JournalEntry,
        { kind: "attributes" }
      >
      const key = `${record.attributeNamespace ?? ""}\u0000${record.attributeName ?? ""}`
      const retired = retiredAttributes.get(entry.target)?.get(key)
      if (retired || isWithinRetiredSubtree(entry.target, retiredRoots)) {
        if (retired) retired.newValue = entry.oldValue
        let states = retiredAttributes.get(entry.target)
        if (!states) {
          states = new Map()
          retiredAttributes.set(entry.target, states)
        }
        states.set(key, entry)
      } else {
        let states = attributes.get(entry.target)
        if (!states) {
          states = new Map()
          attributes.set(entry.target, states)
        }
        const previous = states.get(key)
        if (previous) previous.newValue = entry.oldValue
        states.set(key, entry)
      }
      entries.push(entry)
      continue
    }

    const entry = toEntry(record) as Extract<
      JournalEntry,
      { kind: "characterData" }
    >
    if (isWithinRetiredSubtree(entry.target, retiredRoots)) {
      const previous = retiredCharacterData.get(entry.target)
      if (previous) previous.newValue = entry.oldValue
      retiredCharacterData.set(entry.target, entry)
    } else {
      const previous = characterData.get(entry.target)
      if (previous) previous.newValue = entry.oldValue
      characterData.set(entry.target, entry)
    }
    entries.push(entry)
  }

  for (const states of attributes.values()) {
    for (const state of states.values()) {
      state.newValue = attributeValue(state.target, state.namespace, state.name)
    }
  }
  for (const state of characterData.values()) {
    state.newValue = state.target.data
  }
  for (const states of retiredAttributes.values()) {
    for (const state of states.values()) {
      state.newValue = attributeValue(state.target, state.namespace, state.name)
    }
  }
  for (const state of retiredCharacterData.values()) {
    state.newValue = state.target.data
  }
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

function isStructural(node: Node): boolean {
  return (
    node.nodeName === "BODY" ||
    node.nodeName === "HTML" ||
    node.nodeName === "HEAD"
  )
}

function undoChildList(
  entry: Extract<JournalEntry, { kind: "childList" }>,
  reinsertedLater: (node: Node) => boolean
): void {
  const { target, added, removed, previousSibling, nextSibling } = entry
  const addedStillHere = added.every((node) => node.parentNode === target)

  // The record replaced the whole child list (text/html, textContent or
  // innerHTML in javascript) and something outside the journal has since
  // rewritten those children (for example the visual editor discarding a
  // contenteditable session). Reinstating the original list is the only
  // faithful inverse. Body/html/head are excluded so extension UI mounted
  // there is never swept away.
  if (
    !addedStillHere &&
    removed.length > 0 &&
    previousSibling === null &&
    nextSibling === null &&
    target instanceof Element &&
    !isStructural(target) &&
    removed.every((node) => !node.contains(target))
  ) {
    target.replaceChildren(...removed)
    return
  }

  // A node that an older entry puts back (the source half of a move) is
  // left in place here: the older insertBefore moves it in one step, and
  // if that destination has become invalid the node stays attached where
  // it is instead of being dropped.
  for (const node of added) {
    if (node.parentNode === target && !reinsertedLater(node))
      target.removeChild(node)
  }
  if (removed.length === 0) return

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
 * An attribute or text entry whose value something else has since
 * overwritten is left alone (an inline style is undone per declaration
 * instead) and passed to `onSkip`.
 */
export function undoMutations(
  entries: JournalEntry[],
  onSkip?: (entry: ValueEntry) => void
): void {
  // How many not-yet-undone entries put each node back.
  const pendingReinserts = new Map<Node, number>()
  const countReinserts = (entry: JournalEntry, delta: number) => {
    if (entry.kind !== "childList") return
    for (const node of entry.removed)
      pendingReinserts.set(node, (pendingReinserts.get(node) ?? 0) + delta)
  }
  for (const entry of entries) countReinserts(entry, 1)

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    countReinserts(entry, -1)
    if (entry.kind === "attributes") {
      const { target, name, namespace, oldValue, newValue } = entry
      const current = target.getAttributeNodeNS(namespace, name)?.value ?? null
      if (current !== newValue) {
        if (isInlineStyle(entry)) undoStyleDeclarations(entry)
        onSkip?.(entry)
        continue
      }
      if (oldValue === null) {
        target.removeAttributeNS(namespace, name)
      } else {
        const attr = target.getAttributeNodeNS(namespace, name)
        if (attr) attr.value = oldValue
        else target.setAttributeNS(namespace, name, oldValue)
      }
    } else if (entry.kind === "characterData") {
      if (entry.target.data === entry.newValue)
        entry.target.data = entry.oldValue
      else onSkip?.(entry)
    } else {
      undoChildList(entry, (node) => (pendingReinserts.get(node) ?? 0) > 0)
    }
  }
}
