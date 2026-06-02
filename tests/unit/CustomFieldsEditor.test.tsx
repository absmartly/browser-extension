import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { CustomFieldsEditor } from "~src/components/CustomFieldsEditor"
import type { ExperimentCustomSectionField } from "~src/types/absmartly"

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
    expect(screen.getByTestId("cfe-input-1")).toHaveAttribute("type", "text")
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
      (screen.getByTestId("cfe-input-1") as HTMLInputElement).value
    ).toBe("existing hypothesis")
  })
})
