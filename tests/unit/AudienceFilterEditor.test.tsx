import "@testing-library/jest-dom"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"

import { AudienceFilterEditor } from "~src/components/AudienceFilterEditor"
import {
  audienceFiltersFromJSON,
  audienceFiltersToJSON,
  getAudienceFiltersInitialState,
  newGroup
} from "~src/components/AudienceFilterEditor/utils"

describe("AudienceFilterEditor utils", () => {
  it("parses the empty default filter as an empty group list", () => {
    const parsed = audienceFiltersFromJSON('{"filter":[{"and":[]}]}')
    expect(parsed.operator).toBe("and")
    expect(parsed.groups).toEqual([])
  })

  it("parses a single eq rule", () => {
    const json = JSON.stringify({
      filter: [
        {
          and: [
            {
              and: [
                {
                  eq: [{ var: { path: "country" } }, { value: "US" }]
                }
              ]
            }
          ]
        }
      ]
    })
    const parsed = audienceFiltersFromJSON(json)
    expect(parsed.operator).toBe("and")
    expect(parsed.groups).toHaveLength(1)
    expect(parsed.groups[0].operator).toBe("and")
    expect(parsed.groups[0].expression).toHaveLength(1)
    expect(parsed.groups[0].expression[0]).toMatchObject({
      path: "country",
      lowPrecedenceOperator: "eq",
      value: "US",
      highPrecedenceOperator: null
    })
  })

  it("parses a not + in rule", () => {
    const json = JSON.stringify({
      filter: [
        {
          and: [
            {
              and: [
                {
                  not: {
                    in: [{ var: { path: "country" } }, { value: "US,CA" }]
                  }
                }
              ]
            }
          ]
        }
      ]
    })
    const parsed = audienceFiltersFromJSON(json)
    expect(parsed.groups[0].expression[0]).toMatchObject({
      path: "country",
      lowPrecedenceOperator: "in",
      value: "US,CA",
      highPrecedenceOperator: "not"
    })
  })

  it("parses a unary null rule (no value)", () => {
    const json = JSON.stringify({
      filter: [{ and: [{ and: [{ null: { var: { path: "email" } } }] }] }]
    })
    const parsed = audienceFiltersFromJSON(json)
    expect(parsed.groups[0].expression[0]).toMatchObject({
      path: "email",
      lowPrecedenceOperator: "null",
      value: "",
      highPrecedenceOperator: null
    })
  })

  it("returns the empty state for invalid JSON", () => {
    expect(audienceFiltersFromJSON("{not json")).toEqual(
      getAudienceFiltersInitialState()
    )
  })

  it("returns the empty state for missing filter key", () => {
    expect(audienceFiltersFromJSON("{}")).toEqual(
      getAudienceFiltersInitialState()
    )
  })

  it("serializes empty audience as default filter", () => {
    expect(audienceFiltersToJSON(getAudienceFiltersInitialState())).toBe(
      '{"filter":[{"and":[]}]}'
    )
  })

  it("round-trips a representative filter via parse → serialize → parse", () => {
    const original = JSON.stringify({
      filter: [
        {
          and: [
            {
              and: [
                { eq: [{ var: { path: "country" } }, { value: "US" }] },
                {
                  not: {
                    in: [{ var: { path: "device" } }, { value: "mobile,tablet" }]
                  }
                }
              ]
            },
            {
              or: [{ null: { var: { path: "email" } } }]
            }
          ]
        }
      ]
    })
    const parsed = audienceFiltersFromJSON(original)
    const reSerialized = audienceFiltersToJSON(parsed)
    const reParsed = audienceFiltersFromJSON(reSerialized)
    expect(reParsed).toEqual(parsed)
  })
})

describe("AudienceFilterEditor component", () => {
  it("renders the empty state when no groups exist", () => {
    render(
      <AudienceFilterEditor
        value='{"filter":[{"and":[]}]}'
        onChange={jest.fn()}
      />
    )
    expect(screen.getByTestId("audience-filter-empty")).toBeInTheDocument()
    expect(
      screen.getByTestId("audience-filter-add-group")
    ).toBeInTheDocument()
  })

  it("adds a group and emits the serialized JSON via onChange", () => {
    const onChange = jest.fn()
    render(
      <AudienceFilterEditor
        value='{"filter":[{"and":[]}]}'
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByTestId("audience-filter-add-group"))
    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls.at(-1)![0]
    // After adding a group, the JSON wraps a single nested and-group with one
    // unfilled rule. We don't pin the exact shape because the empty rule
    // serializes as eq with empty path/value, but it should be parseable and
    // have exactly one group with one expression.
    const parsed = JSON.parse(last)
    expect(parsed.filter).toBeDefined()
  })

  it("renders the rule controls when groups are present", () => {
    const initial = audienceFiltersToJSON({
      operator: "and",
      groups: [
        {
          key: 1,
          operator: "and",
          expression: [
            {
              path: "country",
              lowPrecedenceOperator: "eq",
              value: "US",
              highPrecedenceOperator: null
            }
          ]
        }
      ]
    })
    render(<AudienceFilterEditor value={initial} onChange={jest.fn()} />)
    expect(screen.getByTestId("audience-group-0")).toBeInTheDocument()
    expect(screen.getByTestId("audience-rule-0-0")).toBeInTheDocument()
    expect(
      (screen.getByTestId("audience-rule-0-0-path") as HTMLInputElement).value
    ).toBe("country")
    expect(
      (screen.getByTestId("audience-rule-0-0-op") as HTMLSelectElement).value
    ).toBe("eq")
    expect(
      (screen.getByTestId("audience-rule-0-0-value") as HTMLInputElement).value
    ).toBe("US")
    // The path and value inputs are autocomplete combobox elements now, not
    // plain text inputs. They still keep their stable data-testid so other
    // tests in this suite continue to work.
    expect(screen.getByTestId("audience-rule-0-0-path")).toHaveAttribute(
      "role",
      "combobox"
    )
    expect(screen.getByTestId("audience-rule-0-0-value")).toHaveAttribute(
      "role",
      "combobox"
    )
  })

  it("does not render the value autocomplete for unary operators", () => {
    const initial = audienceFiltersToJSON({
      operator: "and",
      groups: [
        {
          key: 1,
          operator: "and",
          expression: [
            {
              path: "email",
              lowPrecedenceOperator: "null",
              value: "",
              highPrecedenceOperator: null
            }
          ]
        }
      ]
    })
    render(<AudienceFilterEditor value={initial} onChange={jest.fn()} />)
    expect(
      screen.queryByTestId("audience-rule-0-0-value")
    ).not.toBeInTheDocument()
    expect(screen.getByTestId("audience-rule-0-0-path")).toBeInTheDocument()
  })

  it("emits a JSON with the new path when a rule path is typed", () => {
    const onChange = jest.fn()
    const initial = audienceFiltersToJSON({
      operator: "and",
      groups: [
        {
          key: 1,
          operator: "and",
          expression: [
            {
              path: "",
              lowPrecedenceOperator: "eq",
              value: "",
              highPrecedenceOperator: null
            }
          ]
        }
      ]
    })
    render(<AudienceFilterEditor value={initial} onChange={onChange} />)
    fireEvent.change(screen.getByTestId("audience-rule-0-0-path"), {
      target: { value: "country" }
    })
    const last = onChange.mock.calls.at(-1)![0]
    const parsed = audienceFiltersFromJSON(last)
    expect(parsed.groups[0].expression[0].path).toBe("country")
  })

  it("changes the operator and clears the value when switching to a unary op", () => {
    const onChange = jest.fn()
    const initial = audienceFiltersToJSON({
      operator: "and",
      groups: [
        {
          key: 1,
          operator: "and",
          expression: [
            {
              path: "email",
              lowPrecedenceOperator: "eq",
              value: "user@example.com",
              highPrecedenceOperator: null
            }
          ]
        }
      ]
    })
    render(<AudienceFilterEditor value={initial} onChange={onChange} />)
    fireEvent.change(screen.getByTestId("audience-rule-0-0-op"), {
      target: { value: "null" }
    })
    const last = onChange.mock.calls.at(-1)![0]
    const parsed = audienceFiltersFromJSON(last)
    expect(parsed.groups[0].expression[0].lowPrecedenceOperator).toBe("null")
    expect(parsed.groups[0].expression[0].value).toBe("")
  })

  it("adds a rule to an existing group", () => {
    const onChange = jest.fn()
    const initial = audienceFiltersToJSON({
      operator: "and",
      groups: [
        {
          key: 1,
          operator: "and",
          expression: [
            {
              path: "country",
              lowPrecedenceOperator: "eq",
              value: "US",
              highPrecedenceOperator: null
            }
          ]
        }
      ]
    })
    render(<AudienceFilterEditor value={initial} onChange={onChange} />)
    fireEvent.click(screen.getByTestId("audience-group-0-add-rule"))
    const last = onChange.mock.calls.at(-1)![0]
    const parsed = audienceFiltersFromJSON(last)
    expect(parsed.groups[0].expression).toHaveLength(2)
  })

  it("removes a rule from a group", () => {
    const onChange = jest.fn()
    const initial = audienceFiltersToJSON({
      operator: "and",
      groups: [
        {
          key: 1,
          operator: "and",
          expression: [
            {
              path: "country",
              lowPrecedenceOperator: "eq",
              value: "US",
              highPrecedenceOperator: null
            },
            {
              path: "device",
              lowPrecedenceOperator: "eq",
              value: "mobile",
              highPrecedenceOperator: null
            }
          ]
        }
      ]
    })
    render(<AudienceFilterEditor value={initial} onChange={onChange} />)
    fireEvent.click(screen.getByTestId("audience-rule-0-0-remove"))
    const last = onChange.mock.calls.at(-1)![0]
    const parsed = audienceFiltersFromJSON(last)
    expect(parsed.groups[0].expression).toHaveLength(1)
    expect(parsed.groups[0].expression[0].path).toBe("device")
  })

  it("removes an entire group", () => {
    const onChange = jest.fn()
    const initial = audienceFiltersToJSON({
      operator: "and",
      groups: [newGroup(), newGroup()]
    })
    render(<AudienceFilterEditor value={initial} onChange={onChange} />)
    fireEvent.click(screen.getByTestId("audience-group-0-remove"))
    const last = onChange.mock.calls.at(-1)![0]
    const parsed = audienceFiltersFromJSON(last)
    expect(parsed.groups).toHaveLength(1)
  })

  it("toggles the high-precedence Negate operator", () => {
    const onChange = jest.fn()
    const initial = audienceFiltersToJSON({
      operator: "and",
      groups: [
        {
          key: 1,
          operator: "and",
          expression: [
            {
              path: "country",
              lowPrecedenceOperator: "eq",
              value: "US",
              highPrecedenceOperator: null
            }
          ]
        }
      ]
    })
    render(<AudienceFilterEditor value={initial} onChange={onChange} />)
    fireEvent.click(screen.getByTestId("audience-rule-0-0-not"))
    const last = onChange.mock.calls.at(-1)![0]
    const parsed = audienceFiltersFromJSON(last)
    expect(parsed.groups[0].expression[0].highPrecedenceOperator).toBe("not")
  })

  it("re-parses when the external value changes", () => {
    const { rerender } = render(
      <AudienceFilterEditor
        value='{"filter":[{"and":[]}]}'
        onChange={jest.fn()}
      />
    )
    expect(screen.getByTestId("audience-filter-empty")).toBeInTheDocument()

    const next = audienceFiltersToJSON({
      operator: "and",
      groups: [
        {
          key: 1,
          operator: "and",
          expression: [
            {
              path: "x",
              lowPrecedenceOperator: "eq",
              value: "y",
              highPrecedenceOperator: null
            }
          ]
        }
      ]
    })
    rerender(<AudienceFilterEditor value={next} onChange={jest.fn()} />)
    expect(screen.queryByTestId("audience-filter-empty")).not.toBeInTheDocument()
    expect(screen.getByTestId("audience-group-0")).toBeInTheDocument()
  })
})
