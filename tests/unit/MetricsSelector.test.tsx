import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { MetricsSelector } from "~src/components/MetricsSelector"
import type { Metric } from "~src/types/absmartly"

const metrics: Metric[] = [
  { metric_id: 1, name: "Conversion Rate", description: "Signups / sessions" },
  { metric_id: 2, name: "Revenue per User" },
  { metric_id: 3, name: "Bounce Rate", description: "Single-page sessions" }
]

describe("MetricsSelector", () => {
  it("renders empty state with add buttons when no metrics are selected", () => {
    render(
      <MetricsSelector
        metrics={metrics}
        primaryMetricId={null}
        secondaryMetricIds={[]}
        onPrimaryChange={jest.fn()}
        onSecondaryChange={jest.fn()}
      />
    )
    expect(screen.getByTestId("metrics-selector")).toBeInTheDocument()
    expect(
      screen.getByTestId("metrics-selector-primary-add")
    ).toBeInTheDocument()
    expect(
      screen.getByTestId("metrics-selector-secondary-add")
    ).toBeInTheDocument()
  })

  it("renders the primary metric card when one is selected", () => {
    render(
      <MetricsSelector
        metrics={metrics}
        primaryMetricId={1}
        secondaryMetricIds={[]}
        onPrimaryChange={jest.fn()}
        onSecondaryChange={jest.fn()}
      />
    )
    expect(
      screen.getByTestId("metrics-selector-primary-card")
    ).toHaveTextContent("Conversion Rate")
    expect(
      screen.queryByTestId("metrics-selector-primary-add")
    ).not.toBeInTheDocument()
  })

  it("opens the picker and selects a primary metric", () => {
    const onPrimaryChange = jest.fn()
    render(
      <MetricsSelector
        metrics={metrics}
        primaryMetricId={null}
        secondaryMetricIds={[]}
        onPrimaryChange={onPrimaryChange}
        onSecondaryChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("metrics-selector-primary-add"))
    expect(
      screen.getByTestId("metrics-selector-primary-picker")
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByTestId("metrics-selector-primary-picker-option-2")
    )
    expect(onPrimaryChange).toHaveBeenCalledWith(2)
  })

  it("filters metrics in the picker by search term", () => {
    render(
      <MetricsSelector
        metrics={metrics}
        primaryMetricId={null}
        secondaryMetricIds={[]}
        onPrimaryChange={jest.fn()}
        onSecondaryChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("metrics-selector-primary-add"))
    fireEvent.change(
      screen.getByTestId("metrics-selector-primary-picker-search"),
      { target: { value: "bounce" } }
    )
    expect(
      screen.getByTestId("metrics-selector-primary-picker-option-3")
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId("metrics-selector-primary-picker-option-1")
    ).not.toBeInTheDocument()
  })

  it("removes the primary metric when the X is clicked", () => {
    const onPrimaryChange = jest.fn()
    render(
      <MetricsSelector
        metrics={metrics}
        primaryMetricId={1}
        secondaryMetricIds={[]}
        onPrimaryChange={onPrimaryChange}
        onSecondaryChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("metrics-selector-primary-remove"))
    expect(onPrimaryChange).toHaveBeenCalledWith(null)
  })

  it("adds a secondary metric", () => {
    const onSecondaryChange = jest.fn()
    render(
      <MetricsSelector
        metrics={metrics}
        primaryMetricId={1}
        secondaryMetricIds={[]}
        onPrimaryChange={jest.fn()}
        onSecondaryChange={onSecondaryChange}
      />
    )
    fireEvent.click(screen.getByTestId("metrics-selector-secondary-add"))
    fireEvent.click(
      screen.getByTestId("metrics-selector-secondary-picker-option-2")
    )
    expect(onSecondaryChange).toHaveBeenCalledWith([2])
  })

  it("excludes the primary and already-selected secondaries from the secondary picker", () => {
    render(
      <MetricsSelector
        metrics={metrics}
        primaryMetricId={1}
        secondaryMetricIds={[2]}
        onPrimaryChange={jest.fn()}
        onSecondaryChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("metrics-selector-secondary-add"))
    // 1 = primary, 2 = already secondary → only 3 should remain.
    expect(
      screen.getByTestId("metrics-selector-secondary-picker-option-3")
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId("metrics-selector-secondary-picker-option-1")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId("metrics-selector-secondary-picker-option-2")
    ).not.toBeInTheDocument()
  })

  it("removes a secondary metric by id", () => {
    const onSecondaryChange = jest.fn()
    render(
      <MetricsSelector
        metrics={metrics}
        primaryMetricId={null}
        secondaryMetricIds={[2, 3]}
        onPrimaryChange={jest.fn()}
        onSecondaryChange={onSecondaryChange}
      />
    )
    fireEvent.click(
      screen.getByTestId("metrics-selector-secondary-remove-2")
    )
    expect(onSecondaryChange).toHaveBeenCalledWith([3])
  })

  it("shows an empty message when the search returns no matches", () => {
    render(
      <MetricsSelector
        metrics={metrics}
        primaryMetricId={null}
        secondaryMetricIds={[]}
        onPrimaryChange={jest.fn()}
        onSecondaryChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("metrics-selector-primary-add"))
    fireEvent.change(
      screen.getByTestId("metrics-selector-primary-picker-search"),
      { target: { value: "xxx" } }
    )
    expect(
      screen.getByTestId("metrics-selector-primary-picker-empty")
    ).toBeInTheDocument()
  })
})
