import { renderHook, act, waitFor } from '@testing-library/react'
import { useExperimentFilters, buildFilterParams } from '../useExperimentFilters'
import { localAreaStorage } from '~src/utils/storage'
import type { ExperimentFilters } from '~src/types/storage-state'

jest.mock('~src/utils/storage', () => ({
  localAreaStorage: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

const DEBOUNCE_MS = 250

describe('useExperimentFilters', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    ;(localAreaStorage.get as jest.Mock).mockReset()
    ;(localAreaStorage.set as jest.Mock).mockReset().mockResolvedValue(undefined)
    ;(localAreaStorage.remove as jest.Mock).mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const flushMicrotasks = async () => {
    await Promise.resolve()
    await Promise.resolve()
  }

  describe('initial load from storage', () => {
    it('applies the default Draft+Ready filter when storage is empty', async () => {
      ;(localAreaStorage.get as jest.Mock).mockResolvedValue(null)

      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      expect(result.current.filters).toEqual({ state: ['created', 'ready'] })
      expect(result.current.filtersLoaded).toBe(true)
    })

    it('applies saved filters from storage', async () => {
      const saved: ExperimentFilters = { state: ['running'], owners: [1] }
      ;(localAreaStorage.get as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === 'experimentFilters' ? saved : null)
      )

      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      expect(result.current.filters).toEqual(saved)
    })

    it('does not fire the reload callback for the initial storage-loaded filters', async () => {
      const saved: ExperimentFilters = { state: ['created', 'ready'] }
      ;(localAreaStorage.get as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === 'experimentFilters' ? saved : null)
      )

      const onFiltersChange = jest.fn()
      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      act(() => {
        result.current.handleFilterChange(saved, onFiltersChange)
      })
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS + 50)
      })

      expect(onFiltersChange).not.toHaveBeenCalled()
    })
  })

  describe('user-driven filter changes', () => {
    it('fires the reload callback with the new filters after the debounce window', async () => {
      const saved: ExperimentFilters = { state: ['created', 'ready'] }
      ;(localAreaStorage.get as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === 'experimentFilters' ? saved : null)
      )

      const onFiltersChange = jest.fn()
      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      const updated: ExperimentFilters = { state: ['running'] }
      act(() => {
        result.current.handleFilterChange(updated, onFiltersChange)
      })

      expect(onFiltersChange).not.toHaveBeenCalled()

      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS + 10)
      })

      expect(onFiltersChange).toHaveBeenCalledTimes(1)
      expect(onFiltersChange).toHaveBeenCalledWith(updated)
    })

    it('persists changes to storage', async () => {
      ;(localAreaStorage.get as jest.Mock).mockResolvedValue(null)
      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      const onFiltersChange = jest.fn()
      const updated: ExperimentFilters = { state: ['running'] }
      act(() => {
        result.current.handleFilterChange(updated, onFiltersChange)
      })

      expect(localAreaStorage.set).toHaveBeenCalledWith('experimentFilters', updated)
    })

    it('collapses rapid successive changes into a single reload with the latest value', async () => {
      ;(localAreaStorage.get as jest.Mock).mockResolvedValue({ state: ['created', 'ready'] })
      const onFiltersChange = jest.fn()
      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      act(() => {
        result.current.handleFilterChange({ state: ['running'] }, onFiltersChange)
      })
      act(() => {
        jest.advanceTimersByTime(50)
        result.current.handleFilterChange({ state: ['running', 'stopped'] }, onFiltersChange)
      })
      act(() => {
        jest.advanceTimersByTime(50)
        result.current.handleFilterChange({ state: ['stopped'] }, onFiltersChange)
      })
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS + 10)
      })

      expect(onFiltersChange).toHaveBeenCalledTimes(1)
      expect(onFiltersChange).toHaveBeenCalledWith({ state: ['stopped'] })
    })

    it('does not fire when the reported filter state is identical to the current one', async () => {
      const saved: ExperimentFilters = { state: ['created', 'ready'] }
      ;(localAreaStorage.get as jest.Mock).mockResolvedValue(saved)
      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      const onFiltersChange = jest.fn()
      act(() => {
        result.current.handleFilterChange(saved, onFiltersChange)
      })
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS + 10)
      })

      expect(onFiltersChange).not.toHaveBeenCalled()
    })

    it('fires again when the user reverts to an earlier filter state', async () => {
      ;(localAreaStorage.get as jest.Mock).mockResolvedValue({ state: ['created', 'ready'] })
      const onFiltersChange = jest.fn()
      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      act(() => {
        result.current.handleFilterChange({ state: ['running'] }, onFiltersChange)
      })
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS + 10)
      })

      act(() => {
        result.current.handleFilterChange({ state: ['created', 'ready'] }, onFiltersChange)
      })
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS + 10)
      })

      expect(onFiltersChange).toHaveBeenCalledTimes(2)
      expect(onFiltersChange).toHaveBeenNthCalledWith(1, { state: ['running'] })
      expect(onFiltersChange).toHaveBeenNthCalledWith(2, { state: ['created', 'ready'] })
    })
  })
})

describe('buildFilterParams', () => {
  it('omits filter keys entirely when filterState is null', () => {
    const params = buildFilterParams(null, 1, 50)
    expect(params).toEqual({
      page: 1,
      items: 50,
      iterations: 1,
      previews: 1,
      type: 'test'
    })
    expect(params.state).toBeUndefined()
  })

  it('serializes the state filter as a comma-joined string', () => {
    const params = buildFilterParams({ state: ['created', 'ready'] }, 1, 50)
    expect(params.state).toBe('created,ready')
  })

  it('serializes all multi-select filters as comma-joined strings', () => {
    const filterState: ExperimentFilters = {
      state: ['running'],
      significance: ['positive'],
      owners: [1, 2],
      teams: [10],
      tags: [5, 6],
      applications: [100]
    }
    const params = buildFilterParams(filterState, 1, 50)
    expect(params.state).toBe('running')
    expect(params.significance).toBe('positive')
    expect(params.owners).toBe('1,2')
    expect(params.teams).toBe('10')
    expect(params.tags).toBe('5,6')
    expect(params.applications).toBe('100')
  })

  it('passes through boolean issue flags only when set to true', () => {
    const params = buildFilterParams(
      {
        sample_ratio_mismatch: true,
        cleanup_needed: false
      } as ExperimentFilters,
      1,
      50
    )
    expect(params.sample_ratio_mismatch).toBe(true)
    expect(params.cleanup_needed).toBeUndefined()
  })
})
