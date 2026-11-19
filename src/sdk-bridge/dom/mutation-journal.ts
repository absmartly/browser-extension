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
    }
  | { kind: "characterData"; target: CharacterData; oldValue: string }
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
      oldValue: record.oldValue
    }
  }
  if (record.type === "characterData") {
    return {
      kind: "characterData",
      target: record.target as CharacterData,
      oldValue: record.oldValue ?? ""
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

/**
 * Run `apply` and return every mutation it made under `roots`, in order.
 * Records are taken synchronously, so other code cannot interleave.
 * Observing a node directly keeps recording it after it is detached, which
 * observing only an ancestor does not guarantee.
 */
export function recordMutations<T>(
  roots: Iterable<Node>,
  apply: () => T
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
  return { result, entries: records.map(toEntry) }
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
      const { target, name, namespace, oldValue } = entry
      if (oldValue === null) {
        target.removeAttributeNS(namespace, name)
      } else {
        const attr = target.getAttributeNodeNS(namespace, name)
        if (attr) attr.value = oldValue
        else target.setAttributeNS(namespace, name, oldValue)
      }
    } else if (entry.kind === "characterData") {
      entry.target.data = entry.oldValue
    } else {
      undoChildList(entry)
    }
  }
}
