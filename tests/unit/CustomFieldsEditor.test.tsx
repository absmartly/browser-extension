import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { CustomFieldsEditor } from "~src/components/CustomFieldsEditor"
import type { ExperimentCustomSectionField } from "~src/types/absmartly"

// Mock the Lexical-based RichTextEditor with a textarea stub so this test
// focuses on the wiring inside CustomFieldsEditor (Lexical itself is covered
// separately). The stub forwards id/data-testid and emits onChange with the
// raw string — identical to what the rich editor produces for plain text
// since `$convertToMarkdownString` of a single text node round-trips
// verbatim.
jest.mock("~src/components/ui/RichTextEditor", () => ({
  RichTextEditor: ({
    id,
    value,
    onChange,
    placeholder,
    "data-testid": testid
  }: {
    id?: string
    value: string
    onChange: (next: string) => void
    placeholder?: string
    "data-testid"?: string
  }) => (
    <textarea
      id={id}
      data-testid={testid}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}))

const fields: ExperimentCustomSectionField[] = [
  {
    id: 1,
    custom_section_field_id: 1,
    title: "Hypothesis",
    type: "text",
    required: true,
    help_text: "What do you expect to learn?"
  },
  {
    id: 2,
    custom_section_field_id: 2,
    title: "Category",
    type: "select",
    required: false,
    options: ["Promo", "UX", "Pricing"]
  },
  {
    id: 3,
    custom_section_field_id: 3,
    title: "Go live",
    type: "boolean",
    required: false
  },
  {
    id: 4,
    custom_section_field_id: 4,
    title: "Short Name",
    type: "string",
    required: false
  }
]

describe("CustomFieldsEditor", () => {
  it("renders an input per field by type", () => {
    render(
      <CustomFieldsEditor
        fields={fields}
        values={{}}
        onChange={jest.fn()}
      />
    )
    // type: "text" renders via the Lexical-based RichTextEditor (mocked here
    // as a textarea stub — see the jest.mock at the top of this file).
    const richEditor = screen.getByTestId("cfe-input-1")
    expect(richEditor.tagName).toBe("TEXTAREA")
    // type: "string" remains a single-line input.
    const stringInput = screen.getByTestId("cfe-input-4")
    expect(stringInput.tagName).toBe("INPUT")
    expect(stringInput).toHaveAttribute("type", "text")
    expect(screen.getByTestId("cfe-select-2")).toBeInTheDocument()
    expect(screen.getByTestId("cfe-checkbox-3")).toHaveAttribute(
      "type",
      "checkbox"
    )
  })

  it("emits onChange with the numeric field id and new value", () => {
    const onChange = jest.fn()
    render(
      <CustomFieldsEditor
        fields={fields}
        values={{}}
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByTestId("cfe-input-1"), {
      target: { value: "We believe..." }
    })
    expect(onChange).toHaveBeenLastCalledWith(1, "We believe...")

    fireEvent.click(screen.getByTestId("cfe-checkbox-3"))
    expect(onChange).toHaveBeenLastCalledWith(3, true)
  })

  it("renders the help text and a required marker", () => {
    render(
      <CustomFieldsEditor
        fields={fields}
        values={{}}
        onChange={jest.fn()}
      />
    )
    expect(screen.getByText("What do you expect to learn?")).toBeInTheDocument()
    expect(screen.getByTestId("cfe-required-1")).toBeInTheDocument()
  })

  it("reads values keyed by String(field.id)", () => {
    render(
      <CustomFieldsEditor
        fields={fields}
        values={{ "1": "existing hypothesis" }}
        onChange={jest.fn()}
      />
    )
    expect(
      (screen.getByTestId("cfe-input-1") as HTMLTextAreaElement).value
    ).toBe("existing hypothesis")
  })

  it("treats single_select and multi_select as aliases for select / multiselect", () => {
    render(
      <CustomFieldsEditor
        fields={[
          {
            id: 10,
            custom_section_field_id: 10,
            title: "Phase",
            type: "single_select",
            required: false,
            options: ["alpha", "beta"]
          },
          {
            id: 11,
            custom_section_field_id: 11,
            title: "Channels",
            type: "multi_select",
            required: false,
            options: ["email", "push"]
          }
        ]}
        values={{}}
        onChange={jest.fn()}
      />
    )
    expect(screen.getByTestId("cfe-select-10")).toBeInTheDocument()
    expect(screen.getByTestId("cfe-multiselect-11")).toBeInTheDocument()
  })
})
