import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { AudienceEditor } from "~src/components/AudienceEditor"

describe("AudienceEditor", () => {
  it("renders the audience JSON in the textarea", () => {
    render(
      <AudienceEditor
        value='{"filter":[{"and":[]}]}'
        strict={false}
        onChange={jest.fn()}
        onStrictChange={jest.fn()}
      />
    )
    expect(screen.getByTestId("audience-editor-textarea")).toHaveValue(
      '{"filter":[{"and":[]}]}'
    )
    expect(screen.getByTestId("audience-editor-strict")).not.toBeChecked()
  })

  it("calls onChange with the new value when valid JSON is typed", () => {
    const onChange = jest.fn()
    render(
      <AudienceEditor
        value="{}"
        strict={false}
        onChange={onChange}
        onStrictChange={jest.fn()}
      />
    )
    const ta = screen.getByTestId("audience-editor-textarea")
    fireEvent.change(ta, { target: { value: '{"filter":[{"or":[]}]}' } })
    expect(onChange).toHaveBeenLastCalledWith('{"filter":[{"or":[]}]}')
    expect(screen.queryByTestId("audience-editor-error")).not.toBeInTheDocument()
  })

  it("shows an error when the JSON is invalid but still calls onChange so the user can fix it", () => {
    const onChange = jest.fn()
    render(
      <AudienceEditor
        value="{}"
        strict={false}
        onChange={onChange}
        onStrictChange={jest.fn()}
      />
    )
    fireEvent.change(screen.getByTestId("audience-editor-textarea"), {
      target: { value: "{not json" }
    })
    expect(onChange).toHaveBeenLastCalledWith("{not json")
    expect(screen.getByTestId("audience-editor-error")).toHaveTextContent(
      /invalid/i
    )
  })

  it("toggles strict mode", () => {
    const onStrictChange = jest.fn()
    render(
      <AudienceEditor
        value="{}"
        strict={false}
        onChange={jest.fn()}
        onStrictChange={onStrictChange}
      />
    )
    fireEvent.click(screen.getByTestId("audience-editor-strict"))
    expect(onStrictChange).toHaveBeenCalledWith(true)
  })
})
