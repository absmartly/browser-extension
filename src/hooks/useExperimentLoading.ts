import { useState, useCallback, useEffect, useMemo } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { setExperimentsCache, getExperimentsCache } from '~src/utils/storage'
import type { Experiment } from '~src/types/absmartly'
import type { ExperimentFilters } from '~src/types/storage-state'
import { buildFilterParams } from './useExperimentFilters'

interface UseExperimentLoadingParams {
  getExperiments: (params: Record<string, unknown>) => Promise<{
    experiments: Experiment[]
    total?: number
    hasMore?: boolean
  }>
  requestPermissionsIfNeeded: (forceRequest: boolean) => Promise<boolean>
  onAuthExpired: (expired: boolean) => void
  onError: (error: string | null) => void
}

export function useExperimentLoading({
  getExperiments,
  requestPermissionsIfNeeded,
  onAuthExpired,
  onError
}: UseExperimentLoadingParams) {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [filteredExperiments, setFilteredExperiments] = useState<Experiment[]>([])
  const [experimentsLoading, setExperimentsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalExperiments, setTotalExperiments] = useState<number | undefined>()
  const [hasMore, setHasMore] = useState(false)

  const loadExperiments = useCallback(async (
    forceRefresh = false,
    page = currentPage,
    size = pageSize,
    customFilters: ExperimentFilters | null = null
  ) => {
    const stack = new Error().stack
    debugLog('=== loadExperiments called ===')
    debugLog('Called from:', stack?.split('\n').slice(2, 5).join('\n'))
    debugLog('Params:', { forceRefresh, page, size, hasCustomFilters: !!customFilters })

    setExperimentsLoading(true)
    onError(null)

    try {
      const params = buildFilterParams(customFilters, page, size)

      const response = await getExperiments(params)
      const experimentsData = response.experiments || []

      setExperiments(experimentsData)
      setFilteredExperiments(experimentsData)
      setTotalExperiments(response.total)
      setHasMore(response.hasMore || false)
      setCurrentPage(page)
      setPageSize(size)
      onAuthExpired(false)

      if (page === 1) {
        try {
          await setExperimentsCache(experimentsData)
        } catch (cacheError) {
          debugWarn('Failed to cache experiments:', cacheError)
        }
      }
    } catch (err: unknown) {
      const error = err as { isAuthError?: boolean; message?: string }
      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        console.log('[loadExperiments] AUTH_EXPIRED error detected')
        onAuthExpired(true)

        const permissionsGranted = await requestPermissionsIfNeeded(true)

        if (permissionsGranted) {
          console.log('[loadExperiments] Retrying after permissions granted...')
          setTimeout(() => loadExperiments(true, page, size, customFilters), 500)
        } else {
          onError('Your session has expired. Please log in again.')
        }
      } else {
        onError('Failed to load experiments. Please check your API settings.')
      }
      debugError('Failed to load experiments:', err)
      setExperiments([])
      setFilteredExperiments([])
    } finally {
      setExperimentsLoading(false)
    }
  }, [currentPage, pageSize, getExperiments, requestPermissionsIfNeeded, onAuthExpired, onError])

  const handlePageChange = useCallback((page: number) => {
    loadExperiments(false, page, pageSize)
  }, [loadExperiments, pageSize])

  const handlePageSizeChange = useCallback((size: number) => {
    setCurrentPage(1)
    setPageSize(size)
    loadExperiments(true, 1, size)
  }, [loadExperiments])

  const loadCachedExperiments = useCallback(async () => {
    try {
      const cache = await getExperimentsCache()
      if (cache && cache.experiments && cache.experiments.length > 0) {
        debugLog('Loading cached experiments:', cache.experiments.length)
        setExperiments(cache.experiments)
        setFilteredExperiments(cache.experiments)
        setTotalExperiments(cache.experiments.length)
        return true
      }
      return false
    } catch (error) {
      debugWarn('Failed to load cached experiments:', error)
      return false
    }
  }, [])

  useEffect(() => {
    loadCachedExperiments()
  }, [loadCachedExperiments])

  const experimentMap = useMemo(() => {
    return new Map(experiments.map(exp => [exp.id, exp]))
  }, [experiments])

  return {
    experiments,
    filteredExperiments,
    experimentsLoading,
    currentPage,
    pageSize,
    totalExperiments,
    hasMore,
    loadExperiments,
    loadCachedExperiments,
    handlePageChange,
    handlePageSizeChange,
    setCurrentPage,
    setPageSize,
    experimentMap
  }
}
