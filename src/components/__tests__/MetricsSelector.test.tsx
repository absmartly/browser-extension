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

describe("MetricsSelector metric metadata", () => {
  const enrichedMetric = {
    id: 100,
    name: "Activations",
    description: "Active users",
    owners: [
      {
        user: { id: 11, first_name: "Ada", last_name: "Lovelace" }
      },
      {
        user: { id: 12, first_name: "Grace", last_name: "Hopper" }
      }
    ],
    teams: [{ team: { id: 1, name: "Growth" } }],
    usage: { last_6_months: { total: 42 } },
    metricCategory: {
      id: 7,
      name: "Engagement",
      color: "#ff8800"
    }
  } as any

  it("renders owners, usage and category badge on the primary card", () => {
    const { container } = renderSelector([enrichedMetric], {
      primaryMetricId: 100
    })
    const card = container.querySelector(
      '[data-testid="metrics-selector-primary-card"]'
    ) as HTMLElement
    expect(card).not.toBeNull()
    const owners = card.querySelector(
      '[data-testid="metrics-selector-primary-card-owners"]'
    )
    expect(owners).not.toBeNull()
    expect(owners!.textContent).toContain("Growth")
    expect(owners!.textContent).toContain("Ada Lovelace")
    expect(owners!.textContent).toContain("Grace Hopper")

    const usage = card.querySelector(
      '[data-testid="metrics-selector-primary-card-usage"]'
    )
    expect(usage).not.toBeNull()
    expect(usage!.textContent).toContain("Used 42 times")

    const category = card.querySelector(
      '[data-testid="metrics-selector-primary-card-category"]'
    ) as HTMLElement
    expect(category).not.toBeNull()
    expect(category!.textContent).toBe("Engagement")
    expect(category!.style.backgroundColor).toBe("rgb(255, 136, 0)")
  })

  it("renders owners, usage and category badge on secondary cards", () => {
    const { container } = renderSelector([enrichedMetric], {
      secondaryMetricIds: [100]
    })
    const card = container.querySelector(
      '[data-testid="metrics-selector-secondary-100"]'
    ) as HTMLElement
    expect(card).not.toBeNull()
    expect(
      card.querySelector(
        '[data-testid="metrics-selector-secondary-100-owners"]'
      )
    ).not.toBeNull()
    expect(
      card.querySelector('[data-testid="metrics-selector-secondary-100-usage"]')
    ).not.toBeNull()
    expect(
      card.querySelector(
        '[data-testid="metrics-selector-secondary-100-category"]'
      )
    ).not.toBeNull()
  })

  it("renders metric metadata inside the picker so users can identify what they're picking", () => {
    const { container, getByText } = renderSelector([enrichedMetric])
    fireEvent.click(getByText("Select a primary metric"))
    const option = container.querySelector(
      "#metrics-selector-primary-picker-option-100"
    ) as HTMLElement
    expect(option).not.toBeNull()
    expect(
      option.querySelector(
        '[data-testid="metrics-selector-primary-picker-option-100-owners"]'
      )
    ).not.toBeNull()
    expect(
      option.querySelector(
        '[data-testid="metrics-selector-primary-picker-option-100-usage"]'
      )
    ).not.toBeNull()
    expect(
      option.querySelector(
        '[data-testid="metrics-selector-primary-picker-option-100-category"]'
      )
    ).not.toBeNull()
  })

  it("omits owners row when owners and teams are both missing", () => {
    const metric = {
      id: 200,
      name: "Bare metric",
      usage: { last_6_months: { total: 3 } }
    } as any
    const { container } = renderSelector([metric], { primaryMetricId: 200 })
    const card = container.querySelector(
      '[data-testid="metrics-selector-primary-card"]'
    )!
    expect(
      card.querySelector('[data-testid="metrics-selector-primary-card-owners"]')
    ).toBeNull()
    // Usage still shows
    expect(
      card.querySelector('[data-testid="metrics-selector-primary-card-usage"]')
    ).not.toBeNull()
  })

  it("omits usage badge when usage data is missing", () => {
    const metric = {
      id: 201,
      name: "No usage",
      owners: [{ user: { first_name: "A", last_name: "B" } }]
    } as any
    const { container } = renderSelector([metric], { primaryMetricId: 201 })
    const card = container.querySelector(
      '[data-testid="metrics-selector-primary-card"]'
    )!
    expect(
      card.querySelector('[data-testid="metrics-selector-primary-card-usage"]')
    ).toBeNull()
    expect(
      card.querySelector('[data-testid="metrics-selector-primary-card-owners"]')
    ).not.toBeNull()
  })

  it("omits category badge when no category", () => {
    const metric = {
      id: 202,
      name: "No category",
      usage: { last_6_months: { total: 1 } }
    } as any
    const { container } = renderSelector([metric], { primaryMetricId: 202 })
    const card = container.querySelector(
      '[data-testid="metrics-selector-primary-card"]'
    )!
    expect(
      card.querySelector(
        '[data-testid="metrics-selector-primary-card-category"]'
      )
    ).toBeNull()
  })

  it("accepts category via `metric_category` (snake_case alias)", () => {
    const metric = {
      id: 203,
      name: "Snake category",
      metric_category: { name: "Quality", color: "#00aa00" }
    } as any
    const { container } = renderSelector([metric], { primaryMetricId: 203 })
    const card = container.querySelector(
      '[data-testid="metrics-selector-primary-card"]'
    )!
    const category = card.querySelector(
      '[data-testid="metrics-selector-primary-card-category"]'
    ) as HTMLElement
    expect(category).not.toBeNull()
    expect(category.textContent).toBe("Quality")
  })
})
