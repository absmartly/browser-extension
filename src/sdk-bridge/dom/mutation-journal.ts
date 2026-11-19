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
 */
export function recordMutations<T>(
  roots: Iterable<Node>,
  apply: () => T,
  diagnostics?: MutationJournalDiagnostics
): { result: T; entries: JournalEntry[] } {
  const observer = new MutationObserver(() => {})
  for (const root of new Set(roots)) observer.observe(root, OBSERVE_ALL)
  let result: T
  let records: MutationRecord[] = []
  try {
    result = apply()
  } finally {
    records = observer.takeRecords()
    observer.disconnect()
  }
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
  entry: Extract<JournalEntry, { kind: "childList" }>
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
    !isStructural(target)
  ) {
    target.replaceChildren(...removed)
    return
  }

  for (const node of added) {
    if (node.parentNode === target) target.removeChild(node)
  }
  if (removed.length === 0) return

  let anchor: Node | null = null
  if (nextSibling && nextSibling.parentNode === target) {
    anchor = nextSibling
  } else if (previousSibling && previousSibling.parentNode === target) {
    anchor = previousSibling.nextSibling
  } else if (previousSibling === null) {
    anchor = target.firstChild
  }
  for (const node of removed) target.insertBefore(node, anchor)
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

/** Invert entries newest-first, restoring the DOM they were recorded on. */
export function undoMutations(entries: JournalEntry[]): void {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (entry.kind === "attributes") {
      const { target, name, namespace, oldValue, newValue } = entry
      const current = target.getAttributeNodeNS(namespace, name)?.value ?? null
      if (current !== newValue) continue
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
    } else {
      undoChildList(entry)
    }
  }
}
