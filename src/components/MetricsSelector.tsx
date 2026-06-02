import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline"
import React, { useMemo, useState } from "react"

import type { Metric } from "~src/types/absmartly"

import { Button } from "./ui/Button"

export interface MetricsSelectorProps {
  metrics: readonly Metric[]
  primaryMetricId: number | null
  secondaryMetricIds: number[]
  onPrimaryChange: (next: number | null) => void
  onSecondaryChange: (next: number[]) => void
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
    for (const metric of metrics) m.set(metric.metric_id, metric)
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
            id={`metrics-selector-primary-${primaryMetric.metric_id}`}
            className="flex items-center justify-between border border-gray-200 rounded p-2 bg-white">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {primaryMetric.name}
              </div>
              {primaryMetric.description && (
                <div className="text-xs text-gray-500 truncate">
                  {primaryMetric.description}
                </div>
              )}
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
          {secondaryMetrics.map((metric) => (
            <div
              key={metric.metric_id}
              data-testid={`metrics-selector-secondary-${metric.metric_id}`}
              id={`metrics-selector-secondary-${metric.metric_id}`}
              className="flex items-center justify-between border border-gray-200 rounded p-2 bg-white">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {metric.name}
                </div>
                {metric.description && (
                  <div className="text-xs text-gray-500 truncate">
                    {metric.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                id={`metrics-selector-secondary-remove-${metric.metric_id}`}
                data-testid={`metrics-selector-secondary-remove-${metric.metric_id}`}
                aria-label={`Remove ${metric.name}`}
                onClick={() =>
                  onSecondaryChange(
                    secondaryMetricIds.filter((id) => id !== metric.metric_id)
                  )
                }
                className="ml-2 p-1 text-gray-400 hover:text-red-600">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
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
      .filter((m) => !excludeIds.has(m.metric_id))
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true))
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
          filtered.map((metric) => (
            <button
              key={metric.metric_id}
              type="button"
              data-testid={`${id}-option-${metric.metric_id}`}
              id={`${id}-option-${metric.metric_id}`}
              onClick={() => onSelect(metric.metric_id)}
              className="w-full text-left px-2 py-1 hover:bg-blue-50 text-sm">
              <div className="font-medium text-gray-900 truncate">
                {metric.name}
              </div>
              {metric.description && (
                <div className="text-xs text-gray-500 truncate">
                  {metric.description}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
