import { mergeMetricMetadata } from "../metrics"

describe("mergeMetricMetadata", () => {
  it("attaches the usage row and category ref keyed by id (mirrors mapMetricUsage)", () => {
    const metrics = [
      {
        id: 1,
        metric_id: 1,
        name: "Conversion",
        metric_category_id: 7
      }
    ] as any
    const usages = [
      {
        id: 1,
        metric_category_id: 7,
        usage: {
          all_time: { total: 12, primary: 3, secondary: 2, guardrail: 1 },
          last_6_months: { total: 8, primary: 2, secondary: 2, guardrail: 1 }
        }
      }
    ] as any
    const categories = [
      { id: 7, name: "Growth", color: "#ff8800" },
      { id: 8, name: "Retention", color: "#00aa00" }
    ] as any

    const [enriched] = mergeMetricMetadata(metrics, usages, categories)

    expect(enriched.usage).toEqual(usages[0].usage)
    expect(enriched.metricCategory).toEqual({
      id: 7,
      name: "Growth",
      color: "#ff8800"
    })
  })

  it("falls back to the snake_case `metric_id` for fixtures that lack `id`", () => {
    const metrics = [{ metric_id: 42, name: "Signups" }] as any
    const usages = [{ id: 42, usage: { last_6_months: { total: 5 } } }] as any
    const [enriched] = mergeMetricMetadata(metrics, usages, [])
    expect(enriched.usage?.last_6_months?.total).toBe(5)
  })

  it("falls back to the usage row's metric_category_id when the metric row lacks one", () => {
    const metrics = [{ id: 11, name: "Bounce" }] as any
    const usages = [
      {
        id: 11,
        metric_category_id: 3,
        usage: { last_6_months: { total: 1 } }
      }
    ] as any
    const categories = [{ id: 3, name: "Quality", color: "#0099ff" }] as any
    const [enriched] = mergeMetricMetadata(metrics, usages, categories)
    expect(enriched.metricCategory).toEqual({
      id: 3,
      name: "Quality",
      color: "#0099ff"
    })
  })

  it("never clobbers an existing usage / metricCategory already on the metric row", () => {
    const presetUsage = { last_6_months: { total: 99 } }
    const presetCategory = { id: 99, name: "Locked", color: "#000000" }
    const metrics = [
      {
        id: 1,
        name: "Preset",
        usage: presetUsage,
        metricCategory: presetCategory,
        metric_category_id: 5
      }
    ] as any
    const usages = [
      {
        id: 1,
        usage: { last_6_months: { total: 1 } }
      }
    ] as any
    const categories = [{ id: 5, name: "Other", color: "#ffffff" }] as any
    const [enriched] = mergeMetricMetadata(metrics, usages, categories)
    expect(enriched.usage).toBe(presetUsage)
    expect(enriched.metricCategory).toBe(presetCategory)
  })

  it("returns metrics unchanged when usage and category lookups don't match", () => {
    const metrics = [{ id: 1, name: "Lone" }] as any
    const result = mergeMetricMetadata(metrics, [], [])
    expect(result[0].usage).toBeUndefined()
    expect(result[0].metricCategory).toBeUndefined()
  })

  it("tolerates rows where the metric id is missing", () => {
    const metrics = [{ name: "No id" }] as any
    expect(() => mergeMetricMetadata(metrics, [], [])).not.toThrow()
  })
})
