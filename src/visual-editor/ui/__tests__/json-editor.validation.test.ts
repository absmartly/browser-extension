import { waitFor } from "@testing-library/react"

import { JSONEditor } from "../json-editor"

describe("JSONEditor save validation (FT-2251)", () => {
  let editor: JSONEditor

  const saveWith = async (text: string) => {
    await waitFor(() => expect((editor as any).editorView).toBeTruthy())
    const host = document.getElementById("absmartly-json-editor-host")!
    const view = (editor as any).editorView
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text }
    })
    ;(host.querySelector(".json-editor-button-save") as HTMLElement).click()
    return host
  }

  beforeAll(() => {
    const rects = () => ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: [][Symbol.iterator]
    })
    Range.prototype.getClientRects = rects as any
    Range.prototype.getBoundingClientRect = () => new DOMRect()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
    editor = new JSONEditor()
  })

  afterEach(() => {
    document.getElementById("absmartly-json-editor-host")?.remove()
  })

  it.each([
    ['[{"selector":"#main-title","type":"text","value":"x"}]'],
    ["42"],
    ["null"],
    ['"text"']
  ])(
    "keeps the dialog open and explains why %s cannot be saved",
    async (text) => {
      const onResult = jest.fn()
      editor.show("Edit DOM Changes - Variant 1", '{"a":1}').then(onResult)

      const host = await saveWith(text)

      expect(document.body.contains(host)).toBe(true)
      expect(document.getElementById("json-editor-status")!.textContent).toBe(
        "✕ Cannot save: variant config must be a JSON object"
      )
      expect(onResult).not.toHaveBeenCalled()
    }
  )

  it("saves a JSON object", async () => {
    const result = editor.show("Edit DOM Changes - Variant 1", '{"a":1}')
    await saveWith('{"a":2}')
    await expect(result).resolves.toBe('{"a":2}')
    expect(document.getElementById("absmartly-json-editor-host")).toBeNull()
  })
})
