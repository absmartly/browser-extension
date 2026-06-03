import type {
  Metric,
  MetricCategory,
  MetricCategoryRef,
  MetricUsage,
  MetricUsageRecord
} from "~src/types/absmartly"

/**
 * Strip a `MetricCategory` (raw API row) down to the `MetricCategoryRef` the
 * metric cards consume. Mirrors the projection inside the web app's
 * `mapMetricUsage` (Experiments/Create/Metrics/MetricsSelect.tsx) which only
 * carries `{id, name, color}` onto the metric.
 */
function toCategoryRef(category: MetricCategory): MetricCategoryRef {
  return { id: category.id, name: category.name, color: category.color }
}

/**
 * Merge per-metric usage rollups and category metadata onto a flat metric
 * list, matching the projection performed by the web app's `mapMetricUsage`
 * (Experiments/Create/Metrics/MetricsSelect.tsx, line 104):
 *
 * ```ts
 * const getMetricCategory = (metric, metricCategories) =>
 *   metric.metric_category_id
 *     ? metricCategories.find(mc => mc.id === metric.metric_category_id)
 *     : undefined;
 * export const mapMetricUsage = (metricUsage, metricCategories) => ({
 *   ...metricUsage,
 *   metricCategory: getMetricCategory(metricUsage, metricCategories)
 * });
 * ```
 *
 * Rules:
 * - Usage is matched by `metric.id === usage.id` (or `metric.metric_id` for
 *   the extension's older snake-case fixtures).
 * - Category is matched by `metric.metric_category_id === category.id`.
 *   The usage record's `metric_category_id` is used as a fallback when the
 *   metric row itself doesn't carry one.
 * - If the metric already has `usage` / `metricCategory` from the metrics
 *   endpoint we leave them in place — the merge never clobbers existing
 *   values.
 * - Tolerant of empty / missing inputs: a metric with no matching usage or
 *   category passes through untouched.
 */
export function mergeMetricMetadata(
  metrics: readonly Metric[],
  usages: readonly MetricUsageRecord[],
  categories: readonly MetricCategory[]
): Metric[] {
  const usageById = new Map<number, MetricUsageRecord>()
  for (const usage of usages) {
    if (typeof usage?.id === "number") usageById.set(usage.id, usage)
  }
  const categoryById = new Map<number, MetricCategory>()
  for (const category of categories) {
    if (typeof category?.id === "number") {
      categoryById.set(category.id, category)
    }
  }

  return metrics.map((metric) => {
    const id =
      typeof metric.metric_id === "number"
        ? metric.metric_id
        : typeof (metric as { id?: unknown }).id === "number"
          ? ((metric as { id?: number }).id as number)
          : null
    const usageRow = id !== null ? usageById.get(id) : undefined
    const categoryId =
      typeof metric.metric_category_id === "number"
        ? metric.metric_category_id
        : typeof usageRow?.metric_category_id === "number"
          ? usageRow.metric_category_id
          : null
    const category =
      categoryId !== null ? categoryById.get(categoryId) : undefined

    const enriched: Metric & {
      usage?: MetricUsage | null
      metricCategory?: MetricCategoryRef | null
    } = { ...metric }

    if (
      (enriched.usage === undefined || enriched.usage === null) &&
      usageRow?.usage
    ) {
      enriched.usage = usageRow.usage
    }
    if (
      enriched.metricCategory === undefined ||
      enriched.metricCategory === null
    ) {
      if (category) {
        enriched.metricCategory = toCategoryRef(category)
      }
    }

    return enriched
  })
}
