import { render, screen } from "@testing-library/react"
import React from "react"

import { DOMChangeOptions } from "../DOMChangeOptions"

describe("DOMChangeOptions", () => {
  it("shows the observerRoot tracking warning when waitForElement is enabled", () => {
    const { container } = render(
      <DOMChangeOptions
        waitForElement
        observerRoot=""
        onWaitForElementChange={jest.fn()}
        onObserverRootChange={jest.fn()}
      />
    )

    expect(
      screen.getByText(
        /`waitForElement` only delays when the change is applied/i
      )
    ).toBeInTheDocument()
    expect(container.querySelector(".border-amber-200")?.textContent).toContain(
      "`Observer Root` is used as the immediate exposure trigger anchor, and if it is empty exposure falls back to `body`, so all variants track immediately."
    )
  })

  it("hides the observerRoot tracking warning when triggerOnView is enabled", () => {
    render(
      <DOMChangeOptions
        waitForElement
        triggerOnView
        observerRoot=""
        onWaitForElementChange={jest.fn()}
        onTriggerOnViewChange={jest.fn()}
        onObserverRootChange={jest.fn()}
      />
    )

    expect(
      screen.queryByText(
        /`waitForElement` only delays when the change is applied/i
      )
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Observer Root \(optional\)/i)).toBeInTheDocument()
  })

  it("hides the observerRoot tracking warning when waitForElement is disabled", () => {
    render(
      <DOMChangeOptions
        waitForElement={false}
        observerRoot=""
        onWaitForElementChange={jest.fn()}
        onObserverRootChange={jest.fn()}
      />
    )

    expect(
      screen.queryByText(
        /`waitForElement` only delays when the change is applied/i
      )
    ).not.toBeInTheDocument()
  })
})
