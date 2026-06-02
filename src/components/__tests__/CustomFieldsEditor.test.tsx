/**
 * Bug 2 (FT-1905): Custom fields should never render twice in the modal,
 * even when the API returns the same field id more than once (one per
 * workspace section it belongs to).
 */
import { render } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import { CustomFieldsEditor } from "../CustomFieldsEditor"

jest.mock("../ui/RichTextEditor", () => ({
  RichTextEditor: ({ id, value }: { id: string; value: string }) => (
    <div data-testid={id}>{value}</div>
  )
}))

const baseField = {
  archived: false,
  required: false,
  order_index: 0,
  default_value: "",
  help_text: "",
  placeholder: ""
}

describe("CustomFieldsEditor", () => {
  it("renders each field exactly once when given three unique fields", () => {
    const fields = [
      { ...baseField, id: 1, title: "Field A", type: "string" },
      { ...baseField, id: 2, title: "Field B", type: "string" },
      { ...baseField, id: 3, title: "Field C", type: "string" }
    ] as any
    const { container } = render(
      <CustomFieldsEditor fields={fields} values={{}} onChange={() => {}} />
    )
    expect(container.querySelectorAll("#cfe-input-1")).toHaveLength(1)
    expect(container.querySelectorAll("#cfe-input-2")).toHaveLength(1)
    expect(container.querySelectorAll("#cfe-input-3")).toHaveLength(1)
  })

  it("deduplicates fields that the API returned more than once", () => {
    const duplicated = [
      { ...baseField, id: 7, title: "Hypothesis", type: "string" },
      { ...baseField, id: 7, title: "Hypothesis", type: "string" },
      { ...baseField, id: 8, title: "Other", type: "string" }
    ] as any
    const { container } = render(
      <CustomFieldsEditor fields={duplicated} values={{}} onChange={() => {}} />
    )
    expect(container.querySelectorAll("#cfe-input-7")).toHaveLength(1)
    expect(container.querySelectorAll("#cfe-input-8")).toHaveLength(1)
  })

  it("skips archived fields", () => {
    const fields = [
      { ...baseField, id: 1, title: "Active", type: "string" },
      { ...baseField, id: 2, archived: true, title: "Archived", type: "string" }
    ] as any
    const { container } = render(
      <CustomFieldsEditor fields={fields} values={{}} onChange={() => {}} />
    )
    expect(container.querySelectorAll("#cfe-input-1")).toHaveLength(1)
    expect(container.querySelectorAll("#cfe-input-2")).toHaveLength(0)
  })
})
