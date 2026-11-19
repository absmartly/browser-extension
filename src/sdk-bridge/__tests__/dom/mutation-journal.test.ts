import {
  recordMutations,
  undoMutations,
  type JournalEntry,
  type MutationJournalDiagnostics
} from "../../dom/mutation-journal"

describe("recordMutations when apply throws", () => {
  it("hands the partial entries to onThrow and rethrows", () => {
    document.body.innerHTML = '<p id="p" title="orig">P</p>'
    const p = document.getElementById("p")
    let partial: JournalEntry[] = []

    expect(() =>
      recordMutations(
        [document],
        () => {
          p.setAttribute("title", "half")
          throw new Error("boom")
        },
        undefined,
        (entries) => (partial = entries)
      )
    ).toThrow("boom")

    expect(partial).toHaveLength(1)
    undoMutations(partial)
    expect(p.getAttribute("title")).toBe("orig")
  })
})

describe("undoing a removal after the page moved its siblings", () => {
  // The preview removes one child of #r; the page then rearranges #r's other
  // children outside the journal; undo must put the child back in its slot.
  it.each([
    [
      "next sibling still present: insert before it",
      "y",
      (r: Element) =>
        r.insertBefore(document.createElement("w"), r.children[1]),
      ["x", "w", "y", "z"]
    ],
    [
      "next sibling gone: insert after the previous sibling",
      "y",
      (r: Element) => {
        document.body.append(r.querySelector("#z"))
        r.append(document.createElement("w"))
      },
      ["x", "y", "w"]
    ],
    [
      "first child whose next sibling is gone: insert at the front",
      "x",
      (r: Element) => document.body.append(r.querySelector("#y")),
      ["x", "z"]
    ]
  ])("%s", (_name, removedId, pageEdit, expected) => {
    document.body.innerHTML =
      '<div id="r"><b id="x"></b><i id="y"></i><u id="z"></u></div>'
    const r = document.getElementById("r")
    const removed = document.getElementById(removedId)
    const { entries } = recordMutations([document], () => removed.remove())
    pageEdit(r)
    undoMutations(entries)
    expect(
      Array.from(r.children, (child) => child.id || child.localName)
    ).toEqual(expected)
  })
})

describe("undoing a child-list replacement whose old child now contains the parent", () => {
  it("skips that inverse without throwing and still undoes older entries", () => {
    document.body.innerHTML =
      '<div id="p" title="t"><section id="c"></section></div>'
    const p = document.getElementById("p")
    const c = document.getElementById("c")
    const { entries } = recordMutations([document], () => {
      p.setAttribute("title", "preview")
      p.innerHTML = "<i>preview</i>"
    })
    // Page code moves the container into its former child.
    c.appendChild(p)
    p.innerHTML = "<u>page</u>"

    expect(() => undoMutations(entries)).not.toThrow()
    expect(p.parentElement).toBe(c)
    expect(p.getAttribute("title")).toBe("t")
  })
})

describe("mutation journal detached subtree retirement", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("retires an outer removal once while retaining ordered descendant records", () => {
    const outer = document.createElement("div")
    const middle = document.createElement("section")
    const leaf = document.createElement("span")
    outer.append(middle)
    middle.append(leaf)
    document.body.append(outer)

    const diagnostics: MutationJournalDiagnostics = {
      records: 0,
      detachedSubtreeVisits: 0
    }
    const { entries } = recordMutations(
      [document.body],
      () => {
        middle.removeChild(leaf)
        document.body.removeChild(outer)
      },
      diagnostics
    )

    const kinds = entries.map((entry) => entry.kind)
    expect(kinds).toEqual(["childList", "childList"])
    expect(diagnostics.records).toBe(2)
    expect(diagnostics.detachedSubtreeVisits).toBe(3)
  })
})
