import {
  ArrowTrendingUpIcon,
  PlusIcon,
  UserGroupIcon,
  XMarkIcon
} from "@heroicons/react/24/outline"
import React, { useMemo, useState } from "react"

import type {
  Metric,
  MetricCategoryRef,
  MetricOwnerRef,
  MetricTeamRef
} from "~src/types/absmartly"

import { Button } from "./ui/Button"

export interface MetricsSelectorProps {
  metrics: readonly Metric[]
  primaryMetricId: number | null
  secondaryMetricIds: number[]
  onPrimaryChange: (next: number | null) => void
  onSecondaryChange: (next: number[]) => void
}

/**
 * The ABsmartly API returns metric objects with their primary identifier
 * under `id` (per the OpenAPI schema). Older fixtures and internal types
 * sometimes use `metric_id` instead — accept either so the picker works in
 * both production and the existing test fixtures.
 */
function metricId(m: Metric): number {
  const raw = (m as unknown as { metric_id?: unknown; id?: unknown }).metric_id
  if (typeof raw === "number") return raw
  const fallback = (m as unknown as { id?: unknown }).id
  if (typeof fallback === "number") return fallback
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw)
  if (typeof fallback === "string" && /^\d+$/.test(fallback)) {
    return Number(fallback)
  }
  return Number.NaN
}

/**
 * Build the comma-separated owners label used on metric cards. Mirrors the
 * web app's `getOwnersText` (Experiments/Create/Metrics/MetricCard.tsx) —
 * team names come first, followed by `first_name + " " + last_name`.
 */
function getOwnersText(
  owners: readonly MetricOwnerRef[] | undefined,
  teams: readonly MetricTeamRef[] | undefined
): string {
  const teamNames = (teams ?? [])
    .map((t) => t.team?.name)
    .filter((n): n is string => !!n)
  const ownerNames = (owners ?? [])
    .map((o) => {
      const first = o.user?.first_name ?? ""
      const last = o.user?.last_name ?? ""
      return `${first} ${last}`.trim()
    })
    .filter((n) => n.length > 0)
  return [...teamNames, ...ownerNames].join(", ")
}

/**
 * The API surface for a metric category is unstable: some endpoints embed
 * it as `metric_category`, others (after the web app's mapping step) under
 * `metricCategory`. Accept either so callers don't have to normalize.
 */
function getCategory(metric: Metric): MetricCategoryRef | null | undefined {
  return metric.metricCategory ?? metric.metric_category ?? null
}

/**
 * Per-card metadata row (owners + usage + category) — mirrors the web app's
 * MetricCard layout. Each piece is hidden gracefully when the underlying
 * data is missing, so empty cards stay compact.
 */
function MetricMetadata({
  metric,
  idPrefix
}: {
  metric: Metric
  idPrefix: string
}) {
  const ownersText = getOwnersText(metric.owners, metric.teams)
  const usage = metric.usage?.last_6_months?.total
  const category = getCategory(metric)

  if (!ownersText && usage === undefined && !category) return null

  return (
    <div
      data-testid={`${idPrefix}-metadata`}
      className="mt-1 flex flex-row items-center gap-2 text-xs text-gray-500">
      {ownersText && (
        <div
          data-testid={`${idPrefix}-owners`}
          title={ownersText}
          className="flex flex-1 min-w-0 items-center gap-1 overflow-hidden">
          <UserGroupIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{ownersText}</span>
        </div>
      )}
      {usage !== undefined && (
        <div
          data-testid={`${idPrefix}-usage`}
          className="flex shrink-0 items-center gap-1"
          title={`Used ${usage} times in the last 6 months`}>
          <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
          <span>Used {usage} times</span>
        </div>
      )}
      {category && (
        <span
          data-testid={`${idPrefix}-category`}
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-4 text-white"
          style={{
            backgroundColor: category.color ?? "#6b7280"
          }}>
          {category.name}
        </span>
      )}
    </div>
  )
}

/**
 * Compact metrics picker for the fullscreen experiment modal.
 *
 * Exposes two sections — Primary metric (single) and Secondary metrics
 * (multi) — mirroring the web app's `MetricsSelect`. We omit Guardrail and
 * Exploratory because the extension doesn't currently send those fields to
 * the API; they can be added later by extending `MetricsSelectorProps`
 * symmetrically.
 *
 * The picker uses a native search box + filtered list — keeps the visual
 * weight low and avoids dragging in the SearchableSelect's open/close state
 * for a flow that's usually one-and-done.
 */
export function MetricsSelector({
  metrics,
  primaryMetricId,
  secondaryMetricIds,
  onPrimaryChange,
  onSecondaryChange
}: MetricsSelectorProps) {
  const [showAddPrimary, setShowAddPrimary] = useState(false)
  const [showAddSecondary, setShowAddSecondary] = useState(false)

  const metricsById = useMemo(() => {
    const m = new Map<number, Metric>()
    for (const metric of metrics) {
      const id = metricId(metric)
      if (Number.isFinite(id)) m.set(id, metric)
    }
    return m
  }, [metrics])

  const primaryMetric = primaryMetricId
    ? metricsById.get(primaryMetricId)
    : undefined

  const secondaryMetrics = useMemo(
    () =>
      secondaryMetricIds
        .map((id) => metricsById.get(id))
        .filter((m): m is Metric => !!m),
    [secondaryMetricIds, metricsById]
  )

  return (
    <div
      id="metrics-selector"
      data-testid="metrics-selector"
      className="space-y-4">
      <div>
        <label
          id="metrics-selector-primary-label"
          className="block text-sm font-medium text-gray-700 mb-1">
          Primary metric
        </label>
        {primaryMetric ? (
          <div
            data-testid="metrics-selector-primary-card"
            id={`metrics-selector-primary-${metricId(primaryMetric)}`}
            className="flex items-start justify-between border border-gray-200 rounded p-2 bg-white">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {primaryMetric.name}
              </div>
              {primaryMetric.description && (
                <div className="text-xs text-gray-500 truncate">
                  {primaryMetric.description}
                </div>
              )}
              <MetricMetadata
                metric={primaryMetric}
                idPrefix="metrics-selector-primary-card"
              />
            </div>
            <button
              type="button"
              id="metrics-selector-primary-remove"
              data-testid="metrics-selector-primary-remove"
              aria-label="Remove primary metric"
              onClick={() => onPrimaryChange(null)}
              className="ml-2 p-1 text-gray-400 hover:text-red-600">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ) : showAddPrimary ? (
          <MetricPicker
            id="metrics-selector-primary-picker"
            metrics={metrics}
            excludeIds={new Set(secondaryMetricIds)}
            onCancel={() => setShowAddPrimary(false)}
            onSelect={(id) => {
              onPrimaryChange(id)
              setShowAddPrimary(false)
            }}
          />
        ) : (
          <Button
            id="metrics-selector-primary-add"
            data-testid="metrics-selector-primary-add"
            type="button"
            variant="secondary"
            onClick={() => setShowAddPrimary(true)}>
            <PlusIcon className="h-4 w-4 mr-1 inline" />
            Select a primary metric
          </Button>
        )}
      </div>

      <div>
        <label
          id="metrics-selector-secondary-label"
          className="block text-sm font-medium text-gray-700 mb-1">
          Secondary metrics
        </label>
        <div
          className="space-y-1"
          data-testid="metrics-selector-secondary-list">
          {secondaryMetrics.map((metric) => {
            const mid = metricId(metric)
            return (
              <div
                key={mid}
                data-testid={`metrics-selector-secondary-${mid}`}
                id={`metrics-selector-secondary-${mid}`}
                className="flex items-start justify-between border border-gray-200 rounded p-2 bg-white">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {metric.name}
                  </div>
                  {metric.description && (
                    <div className="text-xs text-gray-500 truncate">
                      {metric.description}
                    </div>
                  )}
                  <MetricMetadata
                    metric={metric}
                    idPrefix={`metrics-selector-secondary-${mid}`}
                  />
                </div>
                <button
                  type="button"
                  id={`metrics-selector-secondary-remove-${mid}`}
                  data-testid={`metrics-selector-secondary-remove-${mid}`}
                  aria-label={`Remove ${metric.name}`}
                  onClick={() =>
                    onSecondaryChange(
                      secondaryMetricIds.filter((id) => id !== mid)
                    )
                  }
                  className="ml-2 p-1 text-gray-400 hover:text-red-600">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
        {showAddSecondary ? (
          <div className="mt-2">
            <MetricPicker
              id="metrics-selector-secondary-picker"
              metrics={metrics}
              excludeIds={
                new Set([
                  ...secondaryMetricIds,
                  ...(primaryMetricId !== null ? [primaryMetricId] : [])
                ])
              }
              onCancel={() => setShowAddSecondary(false)}
              onSelect={(id) => {
                onSecondaryChange([...secondaryMetricIds, id])
                setShowAddSecondary(false)
              }}
            />
          </div>
        ) : (
          <Button
            id="metrics-selector-secondary-add"
            data-testid="metrics-selector-secondary-add"
            type="button"
            variant="secondary"
            className="mt-2"
            onClick={() => setShowAddSecondary(true)}>
            <PlusIcon className="h-4 w-4 mr-1 inline" />
            Add secondary metric
          </Button>
        )}
      </div>
    </div>
  )
}

interface MetricPickerProps {
  id: string
  metrics: readonly Metric[]
  excludeIds: Set<number>
  onCancel: () => void
  onSelect: (id: number) => void
}

function MetricPicker({
  id,
  metrics,
  excludeIds,
  onCancel,
  onSelect
}: MetricPickerProps) {
  const [search, setSearch] = useState("")
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return metrics
      .map((m) => ({ metric: m, id: metricId(m) }))
      .filter(({ id }) => Number.isFinite(id) && !excludeIds.has(id))
      .filter(({ metric }) =>
        q ? metric.name.toLowerCase().includes(q) : true
      )
      .slice(0, 50)
  }, [metrics, excludeIds, search])

  return (
    <div
      id={id}
      data-testid={id}
      className="border border-gray-300 rounded p-2 bg-white space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          id={`${id}-search`}
          data-testid={`${id}-search`}
          placeholder="Search metrics..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
          autoFocus
        />
        <button
          type="button"
          id={`${id}-cancel`}
          data-testid={`${id}-cancel`}
          aria-label="Cancel"
          onClick={onCancel}
          className="p-1 text-gray-400 hover:text-gray-700">
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-48 overflow-auto divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <div
            data-testid={`${id}-empty`}
            className="text-xs text-gray-500 italic p-2">
            No metrics match.
          </div>
        ) : (
          filtered.map(({ metric, id: mid }) => (
            <button
              key={mid}
              type="button"
              data-testid={`${id}-option-${mid}`}
              id={`${id}-option-${mid}`}
              onClick={() => onSelect(mid)}
              className="w-full text-left px-2 py-1 hover:bg-blue-50 text-sm">
              <div className="font-medium text-gray-900 truncate">
                {metric.name}
              </div>
              {metric.description && (
                <div className="text-xs text-gray-500 truncate">
                  {metric.description}
                </div>
              )}
              <MetricMetadata
                metric={metric}
                idPrefix={`${id}-option-${mid}`}
              />
            </button>
          ))
        )}
      </div>
    </div>
  )
}
