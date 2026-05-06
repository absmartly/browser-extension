import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { CustomFieldsEditor } from "~src/components/CustomFieldsEditor"
import type { ExperimentCustomSectionField } from "~src/types/absmartly"

const fields: ExperimentCustomSectionField[] = [
  {
    id: 1,
    custom_section_field_id: 1,
    name: "hypothesis",
    title: "Hypothesis",
    type: "text",
    required: true,
    help_text: "What do you expect to learn?"
  },
  {
    id: 2,
    custom_section_field_id: 2,
    name: "category",
    title: "Category",
    type: "select",
    required: false,
    options: ["Promo", "UX", "Pricing"]
  },
  {
    id: 3,
    custom_section_field_id: 3,
    name: "go_live",
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
    expect(screen.getByTestId("cfe-input-hypothesis")).toHaveAttribute(
      "type",
      "text"
    )
    expect(screen.getByTestId("cfe-select-category")).toBeInTheDocument()
    expect(screen.getByTestId("cfe-checkbox-go_live")).toHaveAttribute(
      "type",
      "checkbox"
    )
  })

  it("emits onChange with the field name and new value", () => {
    const onChange = jest.fn()
    render(
      <CustomFieldsEditor
        fields={fields}
        values={{}}
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByTestId("cfe-input-hypothesis"), {
      target: { value: "We believe..." }
    })
    expect(onChange).toHaveBeenLastCalledWith("hypothesis", "We believe...")

    fireEvent.click(screen.getByTestId("cfe-checkbox-go_live"))
    expect(onChange).toHaveBeenLastCalledWith("go_live", true)
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
    expect(screen.getByTestId("cfe-required-hypothesis")).toBeInTheDocument()
  })
})
