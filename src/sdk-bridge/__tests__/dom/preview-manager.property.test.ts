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
  (k: number) =>
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
function generateCase(rng: Rng): DOMChange[] {
  const pool = [...EXISTING]
  const count = 1 + rng.int(6)
  const changes: DOMChange[] = []
  for (let k = 0; k < count; k++) {
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
