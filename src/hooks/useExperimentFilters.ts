import { useCallback, useEffect, useRef, useState } from "react"

import type { ABsmartlyConfig } from "~src/types/absmartly"
import type { ExperimentFilters } from "~src/types/storage-state"
import { debugLog } from "~src/utils/debug"
import { localAreaStorage } from "~src/utils/storage"

import { useDebounce } from "./useDebounce"

const DEBOUNCE_DELAY_MS = 250

export function useExperimentFilters(config: ABsmartlyConfig | null) {
  const [filters, setFilters] = useState<ExperimentFilters | null>(null)
  const [filtersLoaded, setFiltersLoaded] = useState(false)
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAY_MS)
  const onFiltersChangeRef = useRef<
    ((filters: ExperimentFilters) => void) | null
  >(null)
  const lastFiredFiltersRef = useRef<string | null>(null)

  useEffect(() => {
    const storage = localAreaStorage

    Promise.all([
      storage.get<ExperimentFilters>("experimentFilters"),
      storage.get<ABsmartlyConfig>("absmartly-config")
    ]).then(([savedFilters, savedConfig]) => {
      debugLog("Loading saved filters:", savedFilters)
      debugLog("Loading config for app filter:", savedConfig)

      const defaultFilters = {
        state: ["created", "ready"]
      }

      if (savedConfig?.applicationName) {
        storage.set("pendingApplicationFilter", savedConfig.applicationName)
      }

      if (savedFilters) {
        setFilters(savedFilters)
        lastFiredFiltersRef.current = JSON.stringify(savedFilters)
      } else {
        setFilters(defaultFilters)
        lastFiredFiltersRef.current = JSON.stringify(defaultFilters)
      }
      setFiltersLoaded(true)
    })
  }, [])

  const handleFilterChange = useCallback(
    (
      filterState: ExperimentFilters,
      onFiltersChange: (filters: ExperimentFilters) => void
    ) => {
      debugLog("handleFilterChange called with:", filterState)
      debugLog("Current filters:", filters)

      onFiltersChangeRef.current = onFiltersChange

      const hasActualChange =
        JSON.stringify(filterState) !== JSON.stringify(filters)
      debugLog("Has actual change:", hasActualChange)

      if (hasActualChange) {
        if (!filtersInitialized) {
          setFiltersInitialized(true)
        }
        setFilters(filterState)
        const storage = localAreaStorage
        storage.set("experimentFilters", filterState)
        debugLog("Filter changed, will notify parent after debounce")
      } else {
        debugLog("No actual change detected, not reloading")
      }
    },
    [filters, filtersInitialized]
  )

  useEffect(() => {
    if (
      !debouncedFilters ||
      !filtersInitialized ||
      !onFiltersChangeRef.current
    ) {
      return
    }
    const snapshot = JSON.stringify(debouncedFilters)
    if (lastFiredFiltersRef.current === snapshot) {
      return
    }
    lastFiredFiltersRef.current = snapshot
    debugLog("Debounced filters changed, triggering reload")
    onFiltersChangeRef.current(debouncedFilters)
  }, [debouncedFilters, filtersInitialized])

  return {
    filters,
    filtersLoaded,
    filtersInitialized,
    debouncedFilters,
    handleFilterChange,
    setFilters
  }
}

const filterParamsCache = new Map<string, Record<string, unknown>>()

export function buildStateFilterParams(states: string[]) {
  const apiStates = [
    ...new Set(
      states.map((state) =>
        state === "full_on" || state === "running_not_full_on"
          ? "running"
          : state
      )
    )
  ]
  // Full On is an experiment running category. The API's state=on instead
  // means feature_state=on and must not be used for experiment full-on status.
  const fullOn = states.includes("full_on")
  const nonFullOn = states.includes("running_not_full_on")
  const runningType =
    states.every(
      (state) => state === "full_on" || state === "running_not_full_on"
    ) && fullOn !== nonFullOn
      ? fullOn
        ? "full_on"
        : "experiment"
      : undefined
  return {
    state: apiStates.join(","),
    ...(runningType ? { running_type: runningType } : {})
  }
}

// The backend ANDs running_type with the complete state expression. Preserve
// the UI's OR selection by querying ordinary states separately from a narrow
// running category. Broad Running (or both categories) needs only one query.
export function buildFilterRequests(
  filters: ExperimentFilters | null,
  page: number,
  size: number
) {
  const states = filters?.state || []
  const narrow = states.filter(
    (state) => state === "full_on" || state === "running_not_full_on"
  )
  const ordinary = states.filter(
    (state) => state !== "full_on" && state !== "running_not_full_on"
  )
  if (narrow.length === 1 && ordinary.length && !ordinary.includes("running")) {
    return [ordinary, narrow].map((state) =>
      buildFilterParams({ ...filters, state }, page, size)
    )
  }
  return [buildFilterParams(filters, page, size)]
}

type FilterResult<T> = { experiments: T[]; total?: number; hasMore?: boolean }

export async function getFilteredExperiments<
  T extends { id: number; created_at?: string }
>(
  getExperiments: (params: Record<string, unknown>) => Promise<FilterResult<T>>,
  filters: ExperimentFilters | null,
  page: number,
  size: number
): Promise<FilterResult<T>> {
  const requests = buildFilterRequests(filters, page, size)
  if (requests.length === 1) return getExperiments(requests[0])

  // Each sorted partition contributes at most the first page*size+1 rows to
  // this page and its next-page indicator. Do not fetch an entire workspace.
  const needed = page * size + 1
  const partitions: Array<{ rows: T[]; exhausted: boolean }> = []
  for (const params of requests) {
    const rows: T[] = []
    let exhausted = false
    for (let sourcePage = 1; rows.length < needed && !exhausted; sourcePage++) {
      const response = await getExperiments({
        ...params,
        page: sourcePage,
        items: size
      })
      rows.push(...response.experiments)
      exhausted =
        response.experiments.length < size ||
        (response.total !== undefined && rows.length >= response.total) ||
        response.hasMore === false
    }
    partitions.push({ rows, exhausted })
  }
  const unique = [
    ...new Map(
      partitions
        .flatMap((partition) => partition.rows)
        .map((row) => [row.id, row])
    ).values()
  ]
  // Match the endpoint's default created_at descending comparator.
  unique.sort(
    (a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || "")
  )
  const exhausted = partitions.every((partition) => partition.exhausted)
  return {
    experiments: unique.slice((page - 1) * size, page * size),
    // Partition totals may overlap (e.g. Scheduled). Only publish an exact
    // union total when both bounded prefixes exhaust their result sets.
    total: exhausted ? unique.length : undefined,
    hasMore: unique.length > page * size || !exhausted
  }
}

export function buildFilterParams(
  filterState: ExperimentFilters | null,
  page: number,
  size: number
) {
  const cacheKey = JSON.stringify({ filterState, page, size })
  const cached = filterParamsCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const params: Record<string, unknown> = {
    page,
    items: size,
    iterations: 1,
    previews: 1,
    type: "test"
  }

  if (!filterState) {
    filterParamsCache.set(cacheKey, params)
    return params
  }

  if (filterState.search?.trim()) {
    params.search = filterState.search.trim()
  }

  if (filterState.state?.length > 0) {
    Object.assign(params, buildStateFilterParams(filterState.state))
  }
  if (filterState.significance?.length > 0) {
    params.significance = filterState.significance.join(",")
  }
  if (filterState.owners?.length > 0) {
    params.owners = filterState.owners.join(",")
  }
  if (filterState.teams?.length > 0) {
    params.teams = filterState.teams.join(",")
  }
  if (filterState.tags?.length > 0) {
    params.tags = filterState.tags.join(",")
  }
  if (filterState.applications?.length > 0) {
    params.applications = filterState.applications.join(",")
  }

  if (filterState.sample_ratio_mismatch === true)
    params.sample_ratio_mismatch = true
  if (filterState.cleanup_needed === true) params.cleanup_needed = true
  if (filterState.audience_mismatch === true) params.audience_mismatch = true
  if (filterState.sample_size_reached === true)
    params.sample_size_reached = true
  if (filterState.experiments_interact === true)
    params.experiments_interact = true
  if (filterState.assignment_conflict === true)
    params.assignment_conflict = true

  filterParamsCache.set(cacheKey, params)
  if (filterParamsCache.size > 50) {
    const firstKey = filterParamsCache.keys().next().value
    filterParamsCache.delete(firstKey)
  }

  return params
}
