import { fireEvent, render } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import { ExperimentCodeInjection } from "../ExperimentCodeInjection"

jest.mock("../CustomCodeEditor", () => ({ CustomCodeEditor: () => null }))

const element = (id: string) => document.getElementById(id)!

describe("code injection URL filters", () => {
  it("publishes edits immediately while preserving injection code", () => {
    const onChange = jest.fn()
    render(
      <ExperimentCodeInjection
        experimentId={1}
        variantIndex={0}
        canEdit={true}
        initialCode={{
          headStart: "<meta name='fixture'>",
          urlFilter: {
            include: ["/products/*"],
            mode: "simple",
            matchType: "path"
          }
        }}
        onChange={onChange}
      />
    )
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(element("custom-code-injection-button"))
    fireEvent.click(element("code-injection-url-filter-toggle"))
    expect(element("code-injection-url-filter-mode")).toHaveValue("simple")
    fireEvent.change(element("code-injection-url-match-type"), {
      target: { value: "full-url" }
    })
    expect(onChange).toHaveBeenLastCalledWith({
      headStart: "<meta name='fixture'>",
      urlFilter: {
        include: ["/products/*"],
        mode: "simple",
        matchType: "full-url"
      }
    })
  })

  it.each([
    [
      "/products/*",
      { include: ["/products/*"], mode: "simple", matchType: "path" },
      "simple"
    ],
    [
      { include: ["/products/*"], mode: "simple", matchType: "path" },
      { include: ["/products/*"], mode: "simple", matchType: "path" },
      "simple"
    ],
    [
      { include: ["^/products/"], mode: "regex", matchType: "path" },
      { include: ["^/products/"], mode: "regex", matchType: "path" },
      "advanced"
    ]
  ])(
    "copies %j without retaining previous filter settings",
    (source, expected, mode) => {
      const onChange = jest.fn()
      render(
        <ExperimentCodeInjection
          experimentId={1}
          variantIndex={0}
          canEdit={true}
          initialCode={{
            headStart: "fixture",
            urlFilter: {
              include: ["old"],
              exclude: ["old-exclude"],
              mode: "regex",
              matchType: "domain"
            }
          }}
          domChangesUrlFilter={source as any}
          onChange={onChange}
        />
      )
      fireEvent.click(element("custom-code-injection-button"))
      fireEvent.click(element("code-injection-copy-url-filter"))
      fireEvent.click(element("code-injection-url-filter-toggle"))
      expect(element("code-injection-url-filter-mode")).toHaveValue(mode)
      expect(onChange).toHaveBeenLastCalledWith({
        headStart: "fixture",
        urlFilter: expected
      })
    }
  )
})
