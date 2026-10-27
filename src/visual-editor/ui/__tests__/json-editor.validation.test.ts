import { diagnosticCount, forceLinting } from "@codemirror/lint"
import { waitFor } from "@testing-library/react"

import { JSONEditor } from "../json-editor"

describe("JSONEditor save validation (FT-2251)", () => {
  let editor: JSONEditor

  const NOT_AN_OBJECT = "✕ Variant config must be a JSON object"
  const nonObjects = [
    ['[{"selector":"#main-title","type":"text","value":"x"}]'],
    ["42"],
    ["null"],
    ['"text"']
  ]

  const openWith = async (text: string) => {
    editor.show("Edit DOM Changes - Variant 1", text)
    await waitFor(() => expect((editor as any).editorView).toBeTruthy())
    return (editor as any).editorView
  }

  const replaceDoc = (text: string) => {
    const view = (editor as any).editorView
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text }
    })
    return view
  }

  const status = () => document.getElementById("json-editor-status")!

  const saveWith = async (text: string) => {
    await waitFor(() => expect((editor as any).editorView).toBeTruthy())
    const host = document.getElementById("absmartly-json-editor-host")!
    replaceDoc(text)
    ;(host.querySelector(".json-editor-button-save") as HTMLElement).click()
    return host
  }

  const format = () =>
    document.getElementById("json-editor-format-button")!.click()

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

  it.each(nonObjects)(
    "keeps the dialog open and explains why %s cannot be saved",
    async (text) => {
      const onResult = jest.fn()
      editor.show("Edit DOM Changes - Variant 1", '{"a":1}').then(onResult)

      const host = await saveWith(text)
      // Let any resolution reach the handler before asserting it never fired.
      await Promise.resolve()
      await Promise.resolve()

      expect(document.body.contains(host)).toBe(true)
      expect(status().textContent).toBe(
        "✕ Cannot save: variant config must be a JSON object"
      )
      expect(onResult).not.toHaveBeenCalled()
    }
  )

  it("keeps the dialog open with the syntax error for invalid JSON", async () => {
    const onResult = jest.fn()
    editor.show("Edit DOM Changes - Variant 1", '{"a":1}').then(onResult)

    const host = await saveWith('{"a":')
    await Promise.resolve()
    await Promise.resolve()

    expect(document.body.contains(host)).toBe(true)
    expect(status().textContent).toMatch(/^✕ Cannot save invalid JSON: .+/)
    expect(onResult).not.toHaveBeenCalled()
  })

  it("saves a JSON object", async () => {
    const result = editor.show("Edit DOM Changes - Variant 1", '{"a":1}')
    await saveWith('{"a":2}')
    await expect(result).resolves.toBe('{"a":2}')
    expect(document.getElementById("absmartly-json-editor-host")).toBeNull()
  })

  it.each(["__dom_changes", "custom_dom"])(
    "keeps invalid entries visible through initial, Format, lint and Save for %s",
    async (field) => {
      const onResult = jest.fn()
      const result = editor.show(
        "Edit Variant Config - Variant 1",
        JSON.stringify({ [field]: [null] }),
        field
      )
      result.then(onResult)
      await waitFor(() => expect((editor as any).editorView).toBeTruthy())
      expect(status().textContent).toContain("contain invalid data")
      format()
      expect(status().textContent).toContain("contain invalid data")
      const view = replaceDoc(JSON.stringify({ [field]: { changes: [null] } }))
      forceLinting(view)
      await waitFor(() => expect(diagnosticCount(view.state)).toBe(1))
      expect(status().textContent).toContain("contain invalid data")
      document.getElementById("json-editor-save-button")!.click()
      await Promise.resolve()
      await Promise.resolve()
      expect(status().textContent).toContain("Cannot save:")
      expect(onResult).not.toHaveBeenCalled()
      expect(
        document.getElementById("absmartly-json-editor-host")
      ).not.toBeNull()
      const corrected = JSON.stringify({
        color: "green",
        [field]: {
          changes: [{ selector: "#heading", type: "text", value: "Updated" }],
          urlFilter: "/products/*"
        }
      })
      await saveWith(corrected)
      await expect(result).resolves.toBe(corrected)
    }
  )

  it("rejects malformed custom-field structure before saving", async () => {
    editor.show(
      "Edit Variant Config - Variant 1",
      '{"custom_dom":{"changes":"invalid"}}',
      "custom_dom"
    )
    await waitFor(() => expect((editor as any).editorView).toBeTruthy())
    expect(status().textContent).toContain(
      "Variant DOM changes (custom_dom) must be an array"
    )
    document.getElementById("json-editor-save-button")!.click()
    expect(status().textContent).toContain("Cannot save:")
    expect(document.getElementById("absmartly-json-editor-host")).not.toBeNull()
  })

  it.each([
    { urlFilter: "/products/*" },
    { changes: "invalid" },
    "invalid",
    null
  ])(
    "keeps invalid nested DOM changes open until corrected: %p",
    async (value) => {
      const result = editor.show(
        "Edit Variant Config - Variant 1",
        JSON.stringify({ color: "blue", __dom_changes: value })
      )
      await waitFor(() => expect((editor as any).editorView).toBeTruthy())
      expect(status().textContent).toBe(
        "✕ Variant DOM changes must be an array or an object with a changes array"
      )
      format()
      expect(status().textContent).toBe(
        "✕ Variant DOM changes must be an array or an object with a changes array"
      )
      document.getElementById("json-editor-save-button")!.click()
      expect(
        document.getElementById("absmartly-json-editor-host")
      ).not.toBeNull()
      expect(status().textContent).toBe(
        "✕ Cannot save: variant DOM changes must be an array or an object with a changes array"
      )

      const corrected = JSON.stringify({
        color: "green",
        __dom_changes: { changes: [], urlFilter: "/products/*" }
      })
      await saveWith(corrected)
      await expect(result).resolves.toBe(corrected)
    }
  )

  describe("status before save", () => {
    it.each(nonObjects)(
      "flags %s as not a variant config on open",
      async (text) => {
        await openWith(text)
        expect(status().textContent).toBe(NOT_AN_OBJECT)
      }
    )

    it("reports a valid object on open", async () => {
      await openWith('{"a":1}')
      expect(status().textContent).toBe("✓ Valid JSON")
    })

    it("reports the syntax error on open", async () => {
      await openWith('{"a":')
      expect(status().textContent).toMatch(/^✕ .+/)
      expect(status().textContent).not.toBe(NOT_AN_OBJECT)
    })

    it.each(nonObjects)(
      "lints %s as not a variant config while editing",
      async (text) => {
        await openWith('{"a":1}')
        const view = replaceDoc(text)
        forceLinting(view)

        expect(status().textContent).toBe(NOT_AN_OBJECT)
        await waitFor(() => expect(diagnosticCount(view.state)).toBe(1))
      }
    )

    it("lints a valid object while editing", async () => {
      const view = await openWith("[]")
      replaceDoc('{"b":2}')
      forceLinting(view)

      expect(status().textContent).toBe("✓ Valid JSON")
      await waitFor(() => expect(diagnosticCount(view.state)).toBe(0))
    })

    it("lints a syntax error while editing", async () => {
      const view = await openWith('{"a":1}')
      replaceDoc('{"a":')
      forceLinting(view)

      expect(status().textContent).toMatch(/^✕ .+/)
      expect(status().textContent).not.toBe(NOT_AN_OBJECT)
    })

    it.each(nonObjects)("formats %s but keeps it flagged", async (text) => {
      const view = await openWith(text)
      format()

      expect(view.state.doc.toString()).toBe(
        JSON.stringify(JSON.parse(text), null, 2)
      )
      expect(status().textContent).toBe(NOT_AN_OBJECT)
    })

    it("formats a valid object", async () => {
      const view = await openWith('{"a":1,"b":[1,2]}')
      format()

      expect(view.state.doc.toString()).toBe(
        JSON.stringify({ a: 1, b: [1, 2] }, null, 2)
      )
      expect(status().textContent).toBe("✓ Valid JSON")
    })

    it("leaves invalid syntax unformatted with the syntax error", async () => {
      const view = await openWith('{"a":')
      format()

      expect(view.state.doc.toString()).toBe('{"a":')
      expect(status().textContent).toMatch(/^✕ .+/)
      expect(status().textContent).not.toBe(NOT_AN_OBJECT)
    })
  })
})
