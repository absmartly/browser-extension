import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { AudienceEditor } from "~src/components/AudienceEditor"

describe("AudienceEditor", () => {
  it("renders the visual filter editor by default", () => {
    render(
      <AudienceEditor
        value='{"filter":[{"and":[]}]}'
        strict={false}
        onChange={jest.fn()}
        onStrictChange={jest.fn()}
      />
    )
    expect(screen.getByTestId("audience-filter-editor")).toBeInTheDocument()
    expect(screen.getByTestId("audience-filter-empty")).toBeInTheDocument()
    expect(screen.getByTestId("audience-editor-strict")).not.toBeChecked()
    // Raw textarea is hidden until Advanced is toggled.
    expect(
      screen.queryByTestId("audience-editor-textarea")
    ).not.toBeInTheDocument()
  })

  it("exposes the raw textarea when Advanced toggle is enabled", () => {
    render(
      <AudienceEditor
        value='{"filter":[{"and":[]}]}'
        strict={false}
        onChange={jest.fn()}
        onStrictChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("audience-editor-advanced-toggle"))
    expect(screen.getByTestId("audience-editor-textarea")).toHaveValue(
      '{"filter":[{"and":[]}]}'
    )
  })

  it("calls onChange with the new value when valid JSON is typed in advanced mode", () => {
    const onChange = jest.fn()
    render(
      <AudienceEditor
        value="{}"
        strict={false}
        onChange={onChange}
        onStrictChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("audience-editor-advanced-toggle"))
    const ta = screen.getByTestId("audience-editor-textarea")
    fireEvent.change(ta, { target: { value: '{"filter":[{"or":[]}]}' } })
    expect(onChange).toHaveBeenLastCalledWith('{"filter":[{"or":[]}]}')
    expect(screen.queryByTestId("audience-editor-error")).not.toBeInTheDocument()
  })

  it("shows an error when the JSON is invalid in advanced mode but still calls onChange so the user can fix it", () => {
    const onChange = jest.fn()
    render(
      <AudienceEditor
        value="{}"
        strict={false}
        onChange={onChange}
        onStrictChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("audience-editor-advanced-toggle"))
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

  it("adds a group via the visual editor and emits serialized JSON", () => {
    const onChange = jest.fn()
    render(
      <AudienceEditor
        value='{"filter":[{"and":[]}]}'
        strict={false}
        onChange={onChange}
        onStrictChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("audience-filter-add-group"))
    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls.at(-1)![0]
    expect(typeof last).toBe("string")
    // Should still be parseable
    expect(() => JSON.parse(last)).not.toThrow()
  })
})
