/**
 * Bug 3 (FT-1905): the MetricsSelector picker must let users select metrics
 * regardless of whether the API surface uses `id` (the real OpenAPI shape)
 * or `metric_id` (the older internal extension type and test fixtures).
 *
 * Bug also covered: secondary picker excludes the chosen primary so the
 * user can't double-pick the same metric.
 */
import { fireEvent, render } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import { MetricsSelector } from "../MetricsSelector"

const idShapeMetrics = [
  { id: 1, name: "Conversion Rate" },
  { id: 2, name: "Revenue per User" },
  { id: 3, name: "Bounce Rate" }
] as any

const metricIdShapeMetrics = [
  { metric_id: 10, name: "Signups" },
  { metric_id: 20, name: "Activations" },
  { metric_id: 30, name: "Retention" }
] as any

function renderSelector(metrics: any, props: Partial<any> = {}) {
  const onPrimaryChange = jest.fn()
  const onSecondaryChange = jest.fn()
  const result = render(
    <MetricsSelector
      metrics={metrics}
      primaryMetricId={null}
      secondaryMetricIds={[]}
      onPrimaryChange={onPrimaryChange}
      onSecondaryChange={onSecondaryChange}
      {...props}
    />
  )
  return { ...result, onPrimaryChange, onSecondaryChange }
}

describe("MetricsSelector", () => {
  it("opens the primary picker and lists every metric (id-shape)", () => {
    const { container, getByText } = renderSelector(idShapeMetrics)
    fireEvent.click(getByText("Select a primary metric"))
    expect(
      container.querySelector("#metrics-selector-primary-picker")
    ).toBeInTheDocument()
    expect(
      container.querySelector("#metrics-selector-primary-picker-option-1")
    ).toBeInTheDocument()
    expect(
      container.querySelector("#metrics-selector-primary-picker-option-2")
    ).toBeInTheDocument()
    expect(
      container.querySelector("#metrics-selector-primary-picker-option-3")
    ).toBeInTheDocument()
  })

  it("opens the primary picker and lists every metric (metric_id-shape)", () => {
    const { container, getByText } = renderSelector(metricIdShapeMetrics)
    fireEvent.click(getByText("Select a primary metric"))
    expect(
      container.querySelector("#metrics-selector-primary-picker-option-10")
    ).toBeInTheDocument()
    expect(
      container.querySelector("#metrics-selector-primary-picker-option-20")
    ).toBeInTheDocument()
    expect(
      container.querySelector("#metrics-selector-primary-picker-option-30")
    ).toBeInTheDocument()
  })

  it("calls onPrimaryChange with the selected metric id", () => {
    const { container, getByText, onPrimaryChange } =
      renderSelector(idShapeMetrics)
    fireEvent.click(getByText("Select a primary metric"))
    const option = container.querySelector(
      "#metrics-selector-primary-picker-option-2"
    ) as HTMLElement
    expect(option).not.toBeNull()
    fireEvent.click(option)
    expect(onPrimaryChange).toHaveBeenCalledWith(2)
  })

  it("secondary picker excludes the metric already chosen as primary", () => {
    const { container, getByText } = renderSelector(idShapeMetrics, {
      primaryMetricId: 2
    })
    fireEvent.click(getByText("Add secondary metric"))
    expect(
      container.querySelector("#metrics-selector-secondary-picker-option-1")
    ).toBeInTheDocument()
    expect(
      container.querySelector("#metrics-selector-secondary-picker-option-2")
    ).toBeNull()
    expect(
      container.querySelector("#metrics-selector-secondary-picker-option-3")
    ).toBeInTheDocument()
  })

  it("secondary picker shows every metric when none are selected", () => {
    const { container, getByText } = renderSelector(idShapeMetrics)
    fireEvent.click(getByText("Add secondary metric"))
    expect(
      container.querySelector("#metrics-selector-secondary-picker-option-1")
    ).toBeInTheDocument()
    expect(
      container.querySelector("#metrics-selector-secondary-picker-option-2")
    ).toBeInTheDocument()
    expect(
      container.querySelector("#metrics-selector-secondary-picker-option-3")
    ).toBeInTheDocument()
  })

  it("primary picker excludes metrics already in the secondary list", () => {
    const { container, getByText } = renderSelector(idShapeMetrics, {
      secondaryMetricIds: [1]
    })
    fireEvent.click(getByText("Select a primary metric"))
    expect(
      container.querySelector("#metrics-selector-primary-picker-option-1")
    ).toBeNull()
    expect(
      container.querySelector("#metrics-selector-primary-picker-option-2")
    ).toBeInTheDocument()
  })
})
