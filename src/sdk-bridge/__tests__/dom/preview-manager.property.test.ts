/**
 * Property test: for any sequence of preview changes, removing the preview
 * returns the page to exactly its original DOM, by node identity.
 *
 * Runs the real PreviewManager against the real @absmartly/sdk-plugins
 * manipulator. Cases are generated from a fixed seed so every failure is
 * reproducible; a failing case prints its seed and change list.
 */

import type { DOMChange } from "~src/types/dom-changes"

import { PreviewManager } from "../../dom/preview-manager"

const BASE_SEED = 0x5eed1234
const CASES = 300
const CYCLES = 3

const FIXTURE = `<main id="app" class="app">
  <section id="s1" class="panel">
    <h2 id="t1" class="title">Title</h2>
    <div id="c1" class="card"><span class="label">L1</span> loose <button id="b1" class="btn" type="button">Buy</button></div>
    <div id="c2" class="card" data-k="orig"><span class="label">L2</span><input id="i1" name="q" value="v"></div>
  </section>
  <section id="s2" class="panel">
    <ul id="l1" class="list"><li id="li1" class="item">A</li><li id="li2" class="item">B<em id="em1">!</em></li></ul>
    tail
    <p id="p1" title="para">Para <a id="a1" href="/x">link</a></p>
  </section>
</main>`

const EXISTING = [
  "#app",
  "#s1",
  "#s2",
  "#t1",
  "#c1",
  "#c2",
  ".card",
  ".label",
  "#b1",
  "#i1",
  "#l1",
  "#li1",
  "#li2",
  "#em1",
  "#p1",
  "#a1"
]

const POSITIONS = ["before", "after", "firstChild", "lastChild"] as const

// mulberry32: small, deterministic, good enough for case generation.
function prng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (n: number) => Math.floor(next() * n)
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]
  return { next, int, pick }
}

type Rng = ReturnType<typeof prng>

const JS_SNIPPETS = [
  () => "const d = element.querySelector('*'); if (d) d.textContent = 'JS'",
  () =>
    "element.querySelectorAll('*').forEach((e) => e.setAttribute('data-js', '1'))",
  () =>
    "element.querySelectorAll('*').forEach((e) => { e.style.color = 'green' })",
  (k: string) =>
    `const s = document.createElement('span'); s.id = 'j${k}'; element.appendChild(s)`,
  () => "element.removeAttribute('class'); element.title = 'js'",
  () =>
    "element.querySelectorAll('[class]').forEach((e) => e.removeAttribute('class'))",
  () => "if (element.firstChild) element.firstChild.remove()",
  () => "const t = element.firstChild; if (t && t.nodeType === 3) t.data = 'D'",
  () => "element.innerHTML = element.innerHTML + '<b>re</b>'",
  () =>
    "const c = element.firstElementChild; if (c) document.getElementById('s2').appendChild(c)"
]

// Generates 1-6 changes. Later changes may target nodes introduced by
// earlier ones (created, html-introduced or javascript-appended ids).
// `prefix` keeps ids introduced by different experiments distinct.
function generateCase(rng: Rng, prefix = ""): DOMChange[] {
  const pool = [...EXISTING]
  const count = 1 + rng.int(6)
  const changes: DOMChange[] = []
  for (let n = 0; n < count; n++) {
    const k = `${prefix}${n}`
    const selector = rng.pick(pool)
    const kind = rng.pick([
      "style",
      "class",
      "attribute",
      "text",
      "html",
      "javascript",
      "move",
      "delete",
      "create"
    ] as const)
    switch (kind) {
      case "style":
        changes.push({
          selector,
          type: "style",
          value: rng.pick([{ color: "red" }, { backgroundColor: "blue" }])
        })
        break
      case "class":
        changes.push({
          selector,
          type: "class",
          add: rng.next() < 0.5 ? ["x"] : [],
          remove: rng.pick([["card"], ["label"], ["item"], []])
        } as DOMChange)
        break
      case "attribute":
        changes.push({
          selector,
          type: "attribute",
          value: rng.pick([
            { title: "T", "data-k": "v" },
            { href: null, type: null, name: null },
            { title: null }
          ])
        } as DOMChange)
        break
      case "text":
        changes.push({ selector, type: "text", value: "TXT" })
        break
      case "html":
        changes.push({
          selector,
          type: "html",
          value: `<b id="h${k}" class="hb">H<i id="h${k}c">c</i></b>`
        })
        pool.push(`#h${k}`, `#h${k}c`)
        break
      case "javascript": {
        const parts = [rng.pick(JS_SNIPPETS), rng.pick(JS_SNIPPETS)]
        changes.push({
          selector,
          type: "javascript",
          value: parts.map((part) => `{ ${part(k)} }`).join("\n")
        })
        pool.push(`#j${k}`)
        break
      }
      case "move":
        changes.push({
          selector,
          type: "move",
          targetSelector: rng.pick(pool),
          position: rng.pick(POSITIONS)
        } as DOMChange)
        break
      case "delete":
        changes.push({ selector, type: "delete" })
        break
      case "create":
        changes.push({
          selector: "",
          type: "create",
          element: `<i id="n${k}" class="new">N</i>`,
          targetSelector: selector,
          position: rng.pick(POSITIONS)
        })
        pool.push(`#n${k}`)
        break
    }
  }
  return changes
}

type OperationReport = {
  kind: DOMChange["type"]
  result: boolean
  sourceTargets: number
  targetTargets: number
  expectedNoOp: boolean
}

function targetCounts(change: DOMChange): { source: number; target: number } {
  try {
    if (change.type === "create") {
      return {
        source: 0,
        target: document.querySelectorAll(change.targetSelector).length
      }
    }
    const source = document.querySelectorAll(change.selector).length
    if (change.type === "move") {
      return {
        source,
        target: document.querySelectorAll(change.targetSelector).length
      }
    }
    return { source, target: source }
  } catch {
    return { source: 0, target: 0 }
  }
}

function moveHasInvalidRelationship(
  change: Extract<DOMChange, { type: "move" }>
): boolean {
  try {
    const sources = Array.from(document.querySelectorAll(change.selector))
    const targets = Array.from(document.querySelectorAll(change.targetSelector))
    return sources.some((source) =>
      targets.some(
        (target) =>
          source === target ||
          source.contains(target) ||
          target.contains(source)
      )
    )
  } catch {
    return true
  }
}
const cases = Array.from({ length: CASES }, (_, i) => {
  const seed = BASE_SEED + i
  return { seed, changes: generateCase(prng(seed)) }
})

describe("PreviewManager restore property", () => {
  let manager: PreviewManager

  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = FIXTURE
    manager = new PreviewManager()
    jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    manager.clearAll()
    jest.restoreAllMocks()
  })

  it.each(cases)(
    "seed $seed: removing the preview restores the original DOM",
    ({ seed, changes }) => {
      const original = document.body.innerHTML
      const originalNodes = Array.from(document.body.querySelectorAll("*"))
      const input = document.getElementById("i1") as HTMLInputElement
      input.value = "typed"
      const button = document.getElementById("b1")
      const clicks = jest.fn()
      button.addEventListener("click", clicks)

      const fail = (cycle: number, reason: string) =>
        new Error(
          `seed ${seed} (cycle ${cycle}): ${reason}\n` +
            `changes: ${JSON.stringify(changes, null, 2)}\n` +
            `body: ${document.body.innerHTML}`
        )

      for (let cycle = 1; cycle <= CYCLES; cycle++) {
        const operations: OperationReport[] = []
        for (const change of changes) {
          const counts = targetCounts(change)
          const result = manager.applyPreviewChange(change, "exp")
          const expectedNoOp =
            result === false &&
            ((change.type === "move" &&
              (counts.source === 0 ||
                counts.target === 0 ||
                moveHasInvalidRelationship(change))) ||
              (change.type === "delete" && counts.source === 0) ||
              (change.type === "create" && counts.target === 0))
          operations.push({
            kind: change.type,
            result,
            sourceTargets: counts.source,
            targetTargets: counts.target,
            expectedNoOp
          })
          if (!result && !expectedNoOp) {
            throw fail(
              cycle,
              `unexpected ${change.type} no-op: ${JSON.stringify(operations)}`
            )
          }
        }
        const successfulKinds = new Set(
          operations
            .filter((operation) => operation.result)
            .map((operation) => operation.kind)
        )
        if (
          successfulKinds.size === 0 &&
          operations.some((operation) => operation.expectedNoOp)
        ) {
          // This case exercised only a modeled no-op; keep it in coverage counts.
        } else if (successfulKinds.size === 0) {
          throw fail(
            cycle,
            `no successful operation coverage: ${JSON.stringify(operations)}`
          )
        }

        manager.removePreviewChanges("exp")

        if (document.body.innerHTML !== original) {
          throw fail(cycle, `markup differs from the original:\n${original}`)
        }
        const ids = Array.from(document.querySelectorAll("[id]"), (e) => e.id)
        const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
        if (duplicates.length > 0) {
          throw fail(cycle, `duplicate ids ${duplicates.join(", ")}`)
        }
        const nodes = Array.from(document.body.querySelectorAll("*"))
        const replaced = originalNodes.findIndex((node, i) => nodes[i] !== node)
        if (nodes.length !== originalNodes.length || replaced !== -1) {
          throw fail(cycle, `original element #${replaced} was replaced`)
        }
        if (input.value !== "typed") {
          throw fail(cycle, `input value lost: ${input.value}`)
        }
        document.getElementById("b1").click()
        if (clicks.mock.calls.length !== cycle) {
          throw fail(cycle, "click listener on #b1 did not fire")
        }
      }
    }
  )
})

// Interleaved page writes and overlapping experiments.
//
// Two or three experiments apply changes drawn from the same selector
// pool, so their targets overlap. Between applies and removals "page code"
// writes outside any journal: attributes, inline style declarations, text
// data, and (in some cases) replaces an element's children. One experiment
// may be replaced in place (replace-mode update), then the previews are
// removed in a given order or by clearAll.
//
// Invariant without child replacement: the page equals the original page
// with only the page's writes applied (same element objects, in order;
// attributes compared as sets, inline style as a declaration map). With
// child replacement the page owns that subtree, so the check is weaker:
// the page's node is still in the element it was put in, and every page
// attribute, declaration and text write survives. Always: no errors and
// no duplicate ids. In runs without page writes, the page after each
// removal must also equal a fresh application of the previews still live,
// in their order, to the original page.

const INTERLEAVED_BASE_SEED = 0x1a7e0000
const INTERLEAVED_CASES = 3000
const STACKED_BASE_SEED = 0x3e000000
const STACKED_CASES = 500

type PageWrite =
  | { kind: "attribute"; element: Element; name: string; value: string | null }
  | { kind: "style"; element: HTMLElement; property: string; value: string }
  | { kind: "text"; node: Text; value: string }
  | { kind: "children"; element: Element; child: Element }

function pageWrite(
  rng: Rng,
  elements: Element[],
  texts: Text[],
  serial: string,
  allowChildren: boolean
): PageWrite {
  const roll = rng.int(allowChildren ? 5 : 4)
  const element = rng.pick(elements)
  if (roll === 0) {
    return {
      kind: "attribute",
      element,
      name: rng.pick(["title", "data-k", "class", "data-page"]),
      value: `P${serial}`
    }
  }
  if (roll === 1) {
    return {
      kind: "attribute",
      element,
      name: rng.pick(["title", "data-k"]),
      value: null
    }
  }
  if (roll === 2) {
    const n = Number(serial.replace(/\D/g, "")) % 250
    return {
      kind: "style",
      element: element as HTMLElement,
      property: rng.pick(["color", "background-color", "outline-color"]),
      value: `rgb(${n}, ${rng.int(250)}, ${rng.int(250)})`
    }
  }
  if (roll === 3)
    return { kind: "text", node: rng.pick(texts), value: `P${serial}` }
  const child = document.createElement("span")
  child.id = `pg${serial}`
  return { kind: "children", element, child }
}

function runPageWrite(write: PageWrite, map: (node: Node) => Node): void {
  switch (write.kind) {
    case "attribute": {
      const element = map(write.element) as Element
      if (write.value === null) element.removeAttribute(write.name)
      else element.setAttribute(write.name, write.value)
      break
    }
    case "style":
      ;(map(write.element) as HTMLElement).style.setProperty(
        write.property,
        write.value
      )
      break
    case "text":
      ;(map(write.node) as Text).data = write.value
      break
    case "children":
      ;(map(write.element) as Element).replaceChildren(write.child)
      break
  }
}

function styleMap(element: Element): string {
  if (!element.hasAttribute("style")) return "<absent>"
  const style = (element as HTMLElement).style
  const declarations: string[] = []
  for (let i = 0; i < style.length; i++) {
    const name = style.item(i)
    declarations.push(`${name}:${style.getPropertyValue(name)}`)
  }
  return declarations.sort().join(";")
}

function canonical(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE)
    return JSON.stringify((node as Text).data)
  if (node.nodeType !== Node.ELEMENT_NODE) return ""
  const element = node as Element
  const attributes = element
    .getAttributeNames()
    .filter((name) => name !== "style")
    .sort()
    .map((name) => `${name}=${JSON.stringify(element.getAttribute(name))}`)
  attributes.push(`style=${styleMap(element)}`)
  const children = Array.from(element.childNodes, canonical).join(",")
  return `<${element.localName} ${attributes.join(" ")}>[${children}]`
}

function allNodes(root: Node): Node[] {
  const nodes: Node[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL)
  while (walker.nextNode()) nodes.push(walker.currentNode)
  return nodes
}

function slotValue(write: PageWrite): string | null {
  switch (write.kind) {
    case "attribute":
      return write.element.getAttribute(write.name)
    case "style":
      return write.element.getAttribute("style")
    case "text":
      return write.node.data
    case "children":
      return null
  }
}

function unmarkedCanonical(): string {
  const body = document.body.cloneNode(true) as HTMLElement
  for (const element of body.querySelectorAll("*")) {
    element.removeAttribute("data-absmartly-experiment")
    element.removeAttribute("data-absmartly-modified")
  }
  return canonical(body)
}

type Experiment = { name: string; changes: DOMChange[] }

type StackRun = {
  seed: number
  experiments: Experiment[]
  // Experiment index to replace and its new change list.
  replace: { index: number; changes: DOMChange[] } | null
  removal: string[] | "clearAll"
  childReplacement: boolean
}

function runStack(manager: PreviewManager, run: StackRun): void {
  const { seed, removal, childReplacement } = run
  const experiments = run.experiments.map((e) => ({ ...e }))
  const rng = prng(seed ^ 0x9e3779b9)
  const expected = document.body.cloneNode(true)
  const originalNodes = allNodes(document.body)
  const cloneNodes = allNodes(expected)
  const toClone = new Map<Node, Node>(
    originalNodes.map((node, i) => [node, cloneNodes[i]])
  )
  const elements = originalNodes.filter(
    (node): node is Element => node.nodeType === Node.ELEMENT_NODE
  )
  const texts = originalNodes.filter(
    (node): node is Text => node.nodeType === Node.TEXT_NODE
  )
  const originalElements = Array.from(document.body.querySelectorAll("*"))

  const writes: PageWrite[] = []
  const log: string[] = []
  const fail = (reason: string) =>
    new Error(
      `seed ${seed}: ${reason}\n` +
        `steps: ${log.join(" | ")}\n` +
        run.experiments
          .map((e) => `${e.name}: ${JSON.stringify(e.changes)}`)
          .join("\n") +
        (run.replace
          ? `\nreplacement: ${JSON.stringify(run.replace.changes)}`
          : "") +
        `\nbody: ${document.body.innerHTML}`
    )
  const step = (label: string, action: () => void) => {
    log.push(label)
    try {
      action()
    } catch (error) {
      throw fail(`${label} threw ${(error as Error).stack}`)
    }
  }
  const maybePage = (probability: number) => {
    if (rng.next() >= probability) return
    const write = pageWrite(
      rng,
      elements,
      texts,
      `${writes.length}`,
      childReplacement
    )
    // A write that changes nothing (removing an attribute a preview already
    // removed) produces no mutation, so no restorer can tell it happened.
    // It is left out of the expected page.
    const before = slotValue(write)
    step(`page ${write.kind}`, () => runPageWrite(write, (node) => node))
    if (write.kind === "children" || slotValue(write) !== before)
      writes.push(write)
    else log.push("(no-op)")
  }

  // Live previews after each removal, with the page they produced.
  const checkpoints: Array<{ live: Experiment[]; page: string }> = []
  const live = [...experiments]
  const checkpoint = () => {
    if (writes.length === 0)
      checkpoints.push({ live: [...live], page: unmarkedCanonical() })
  }

  for (const { name, changes } of experiments) {
    for (const change of changes) {
      step(`apply ${name} ${change.type} ${change.selector}`, () =>
        manager.applyPreviewChange(change, name)
      )
      maybePage(0.3)
    }
    for (let i = rng.int(3); i > 0; i--) maybePage(1)
  }
  if (run.replace) {
    const target = experiments[run.replace.index]
    const changes = run.replace.changes
    step(`replace ${target.name}`, () =>
      manager.replacePreviewChanges(target.name, changes)
    )
    const replaced = { name: target.name, changes }
    live[run.replace.index] = replaced
    checkpoint()
    for (let i = rng.int(3); i > 0; i--) maybePage(1)
  }
  if (removal === "clearAll") {
    step("clearAll", () => manager.clearAll())
  } else {
    for (const name of removal) {
      step(`remove ${name}`, () => manager.removePreviewChanges(name))
      live.splice(
        live.findIndex((e) => e.name === name),
        1
      )
      checkpoint()
      for (let i = rng.int(3); i > 0; i--) maybePage(1)
    }
  }

  const ids = Array.from(document.querySelectorAll("[id]"), (e) => e.id)
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (duplicates.length > 0)
    throw fail(`duplicate ids ${duplicates.join(", ")}`)

  const replaced = writes.some((write) => write.kind === "children")
  if (!replaced) {
    for (const write of writes) runPageWrite(write, (node) => toClone.get(node))
    if (canonical(document.body) !== canonical(expected)) {
      throw fail(
        `page differs from the original plus page writes\n` +
          `expected: ${canonical(expected)}\nactual:   ${canonical(document.body)}`
      )
    }
    const nodes = Array.from(document.body.querySelectorAll("*"))
    const index = originalElements.findIndex((node, i) => nodes[i] !== node)
    if (nodes.length !== originalElements.length || index !== -1)
      throw fail(`original element #${index} was replaced`)

    // The page is the original again: rebuild each checkpoint's live set
    // from scratch with a separate manager and compare. Only meaningful
    // when no page write happened at all.
    for (const { live: previews, page } of writes.length ? [] : checkpoints) {
      const fresh = new PreviewManager()
      for (const { name, changes } of previews)
        for (const change of changes) fresh.applyPreviewChange(change, name)
      const want = unmarkedCanonical()
      fresh.clearAll()
      if (want !== page) {
        throw fail(
          `page with [${previews.map((e) => e.name).join(",")}] live differs from applying them fresh\n` +
            `expected: ${want}\nactual:   ${page}`
        )
      }
    }
    return
  }

  // Last write per slot wins; check each slot against it.
  const last = new Map<string, PageWrite>()
  const slotKey = new Map<Node, number>()
  const keyOf = (node: Node) => {
    if (!slotKey.has(node)) slotKey.set(node, slotKey.size)
    return slotKey.get(node)
  }
  for (const write of writes) {
    if (write.kind === "attribute")
      last.set(`a${keyOf(write.element)}:${write.name}`, write)
    else if (write.kind === "style")
      last.set(`s${keyOf(write.element)}:${write.property}`, write)
    else if (write.kind === "text") last.set(`t${keyOf(write.node)}`, write)
    else last.set(`c${keyOf(write.element)}`, write)
  }
  for (const write of last.values()) {
    if (write.kind === "attribute") {
      const actual = write.element.getAttribute(write.name)
      if (actual !== write.value)
        throw fail(
          `page ${write.name}=${write.value} became ${actual} on <${write.element.localName} id=${write.element.id}>`
        )
    } else if (write.kind === "style") {
      const probe = document.createElement("i")
      probe.style.setProperty(write.property, write.value)
      const want = probe.style.getPropertyValue(write.property)
      const actual = write.element.style.getPropertyValue(write.property)
      if (actual !== want)
        throw fail(
          `page ${write.property}: ${want} became ${actual} on #${write.element.id}`
        )
    } else if (write.kind === "text") {
      if (write.node.data !== write.value)
        throw fail(`page text ${write.value} became ${write.node.data}`)
    } else if (write.child.parentNode !== write.element) {
      throw fail(`page child #${write.child.id} left its parent`)
    }
  }
}

function useFixture(): () => PreviewManager {
  let manager: PreviewManager
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = FIXTURE
    manager = new PreviewManager()
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    manager.clearAll()
    jest.restoreAllMocks()
  })
  return () => manager
}

const interleavedCases = Array.from({ length: INTERLEAVED_CASES }, (_, i) => {
  const seed = INTERLEAVED_BASE_SEED + i
  const rng = prng(seed)
  const experiments = [
    { name: "a", changes: generateCase(rng, "a") },
    { name: "b", changes: generateCase(rng, "b") }
  ]
  const childReplacement = rng.next() < 0.25
  const removal: StackRun["removal"] =
    rng.next() < 0.2 ? "clearAll" : rng.next() < 0.5 ? ["a", "b"] : ["b", "a"]
  return { seed, experiments, childReplacement, removal, replace: null }
})

describe("PreviewManager restore property with page writes and overlapping experiments", () => {
  const manager = useFixture()

  it.each(interleavedCases)(
    "seed $seed: page writes survive and only preview writes are undone",
    (run) => runStack(manager(), run)
  )
})

const REMOVALS: StackRun["removal"][] = [
  ["a", "b", "c"],
  ["a", "c", "b"],
  ["b", "a", "c"],
  ["b", "c", "a"],
  ["c", "a", "b"],
  ["c", "b", "a"],
  "clearAll"
]

const stackedCases = Array.from({ length: STACKED_CASES }, (_, i) => {
  const seed = STACKED_BASE_SEED + i
  const rng = prng(seed)
  const experiments = ["a", "b", "c"].map((name) => ({
    name,
    changes: generateCase(rng, name)
  }))
  const childReplacement = rng.next() < 0.25
  let replace: StackRun["replace"] = null
  if (rng.next() < 0.5) {
    const index = rng.int(3)
    const name = experiments[index].name
    replace = {
      index,
      changes:
        rng.next() < 0.5
          ? experiments[index].changes
          : generateCase(rng, `${name}r`)
    }
  }
  return { seed, experiments, childReplacement, replace }
})

describe("PreviewManager restore property with three stacked experiments", () => {
  const manager = useFixture()

  it.each(stackedCases)(
    "seed $seed: every removal order and clearAll restore the page",
    (run) => {
      for (const removal of REMOVALS) {
        document.body.innerHTML = FIXTURE
        try {
          runStack(manager(), { ...run, removal })
        } finally {
          manager().clearAll()
        }
      }
    }
  )
})
