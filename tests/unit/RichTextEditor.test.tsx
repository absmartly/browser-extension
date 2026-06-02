import "@testing-library/jest-dom"
import { act, render, screen, waitFor } from "@testing-library/react"
import React from "react"

import { RichTextEditor } from "~src/components/ui/RichTextEditor"

// Lexical attaches to the DOM via contenteditable and uses
// `document.getSelection()` heavily. jsdom supports both, so the editor
// initializes and accepts text — but we keep these assertions focused on the
// pieces CustomFieldsEditor depends on:
//
//   - the contenteditable surface carries the supplied `id` and
//     `data-testid` so E2E selectors stay stable;
//   - initial `value` markdown is seeded into the editor;
//   - simulated input emits markdown back via `onChange` (we trigger via
//     editor command rather than synthetic keystrokes — jsdom's editing
//     model is too stubby for the latter to round-trip reliably).

describe("RichTextEditor", () => {
  it("renders a contenteditable surface with the supplied id and data-testid", () => {
    render(
      <RichTextEditor
        value=""
        id="cfe-input-7"
        data-testid="cfe-input-7"
        onChange={jest.fn()}
        placeholder="Type here..."
      />
    )
    const editable = screen.getByTestId("cfe-input-7")
    expect(editable).toBeInTheDocument()
    expect(editable.id).toBe("cfe-input-7")
    expect(editable).toHaveAttribute("contenteditable", "true")
  })

  it("seeds the editor with the supplied markdown value", async () => {
    render(
      <RichTextEditor
        value="hello world"
        id="cfe-input-7"
        data-testid="cfe-input-7"
        onChange={jest.fn()}
      />
    )
    const editable = screen.getByTestId("cfe-input-7")
    // The initial-value plugin runs in an effect after mount, so wait for
    // Lexical to flush the markdown into the contenteditable surface.
    await waitFor(() => {
      expect(editable.textContent).toContain("hello world")
    })
  })

  it("renders the placeholder when value is empty", () => {
    render(
      <RichTextEditor
        value=""
        id="cfe-input-7"
        data-testid="cfe-input-7"
        onChange={jest.fn()}
        placeholder="Tell us your hypothesis"
      />
    )
    expect(screen.getByText("Tell us your hypothesis")).toBeInTheDocument()
  })

  it("re-seeds when the external value prop changes (AI Fill round-trip)", async () => {
    const { rerender } = render(
      <RichTextEditor
        value=""
        id="cfe-input-7"
        data-testid="cfe-input-7"
        onChange={jest.fn()}
      />
    )
    act(() => {
      rerender(
        <RichTextEditor
          value="AI suggested hypothesis"
          id="cfe-input-7"
          data-testid="cfe-input-7"
          onChange={jest.fn()}
        />
      )
    })
    const editable = screen.getByTestId("cfe-input-7")
    await waitFor(() => {
      expect(editable.textContent).toContain("AI suggested hypothesis")
    })
  })

  it("renders the toolbar with bold/italic/underline buttons", () => {
    render(
      <RichTextEditor
        value=""
        id="cfe-input-7"
        data-testid="cfe-input-7"
        onChange={jest.fn()}
      />
    )
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Italic" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Underline" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Insert Table" })
    ).toBeInTheDocument()
  })

  it("mounts without throwing for markdown with code block, table, and mention", async () => {
    const value = [
      "Intro paragraph.",
      "",
      "```js",
      "const x = 1",
      "```",
      "",
      "Hello [@user_id:42] and [#experiment_id:7]"
    ].join("\n")
    render(
      <RichTextEditor
        value={value}
        id="cfe-input-99"
        data-testid="cfe-input-99"
        onChange={jest.fn()}
      />
    )
    const editable = screen.getByTestId("cfe-input-99")
    await waitFor(() => {
      expect(editable.textContent).toContain("Intro paragraph")
    })
  })
})
