import {
  recordMutations,
  type MutationJournalDiagnostics
} from "../../dom/mutation-journal"

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
