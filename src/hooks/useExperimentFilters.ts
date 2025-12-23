import { useState, useEffect, useCallback } from 'react'
import { debugLog } from '~src/utils/debug'
import { localAreaStorage } from '~src/utils/storage'
import { useDebounce } from './useDebounce'
import type { ExperimentFilters } from '~src/types/storage-state'
import type { ABsmartlyConfig } from '~src/types/absmartly'

const DEBOUNCE_DELAY_MS = 250

export function useExperimentFilters(config: ABsmartlyConfig | null) {
  const [filters, setFilters] = useState<ExperimentFilters | null>(null)
  const [filtersLoaded, setFiltersLoaded] = useState(false)
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAY_MS)

  useEffect(() => {
    const storage = localAreaStorage

    Promise.all([
      storage.get<ExperimentFilters>('experimentFilters'),
      storage.get<ABsmartlyConfig>('absmartly-config')
    ]).then(([savedFilters, savedConfig]) => {
      debugLog('Loading saved filters:', savedFilters)
      debugLog('Loading config for app filter:', savedConfig)

      const defaultFilters = {
        state: ['created', 'ready']
      }

      if (savedConfig?.applicationName) {
        storage.set('pendingApplicationFilter', savedConfig.applicationName)
      }

      if (savedFilters) {
        setFilters(savedFilters)
      } else {
        setFilters(defaultFilters)
      }
      setFiltersLoaded(true)
    })
  }, [])

  const handleFilterChange = useCallback((
    filterState: ExperimentFilters,
    onFiltersChange: (filters: ExperimentFilters) => void
  ) => {
    debugLog('handleFilterChange called with:', filterState)
    debugLog('Current filters:', filters)

    if (!filtersInitialized) {
      setFiltersInitialized(true)
    }

    const hasActualChange = JSON.stringify(filterState) !== JSON.stringify(filters)
    debugLog('Has actual change:', hasActualChange)

    if (hasActualChange) {
      setFilters(filterState)
      const storage = localAreaStorage
      storage.set('experimentFilters', filterState)
      debugLog('Filter changed, will notify parent after debounce')
    } else {
      debugLog('No actual change detected, not reloading')
    }
  }, [filters, filtersInitialized])

  useEffect(() => {
    if (debouncedFilters && filtersInitialized) {
      debugLog('Debounced filters changed, triggering reload')
    }
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

export function buildFilterParams(filterState: ExperimentFilters | null, page: number, size: number) {
  const params: Record<string, unknown> = {
    page,
    items: size,
    iterations: 1,
    previews: 1,
    type: 'test'
  }

  if (!filterState) return params

  if (filterState.search?.trim()) {
    params.search = filterState.search.trim()
  }

  if (filterState.state?.length > 0) {
    params.state = filterState.state.join(',')
  }
  if (filterState.significance?.length > 0) {
    params.significance = filterState.significance.join(',')
  }
  if (filterState.owners?.length > 0) {
    params.owners = filterState.owners.join(',')
  }
  if (filterState.teams?.length > 0) {
    params.teams = filterState.teams.join(',')
  }
  if (filterState.tags?.length > 0) {
    params.tags = filterState.tags.join(',')
  }
  if (filterState.applications?.length > 0) {
    params.applications = filterState.applications.join(',')
  }

  if (filterState.sample_ratio_mismatch === true) params.sample_ratio_mismatch = true
  if (filterState.cleanup_needed === true) params.cleanup_needed = true
  if (filterState.audience_mismatch === true) params.audience_mismatch = true
  if (filterState.sample_size_reached === true) params.sample_size_reached = true
  if (filterState.experiments_interact === true) params.experiments_interact = true
  if (filterState.assignment_conflict === true) params.assignment_conflict = true

  return params
}
