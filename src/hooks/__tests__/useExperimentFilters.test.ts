import { act, renderHook, waitFor } from "@testing-library/react"

import type { ExperimentFilters } from "~src/types/storage-state"
import { localAreaStorage } from "~src/utils/storage"

import {
  buildFilterParams,
  buildFilterRequests,
  getFilteredExperiments,
  useExperimentFilters
} from "../useExperimentFilters"

jest.mock("~src/utils/storage", () => ({
  localAreaStorage: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock("~src/utils/debug", () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

const DEBOUNCE_MS = 250

describe("useExperimentFilters", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    ;(localAreaStorage.get as jest.Mock).mockReset()
    ;(localAreaStorage.set as jest.Mock)
      .mockReset()
      .mockResolvedValue(undefined)
    ;(localAreaStorage.remove as jest.Mock)
      .mockReset()
      .mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const flushMicrotasks = async () => {
    await Promise.resolve()
    await Promise.resolve()
  }

  describe("initial load from storage", () => {
    it("applies the default Draft+Ready filter when storage is empty", async () => {
      ;(localAreaStorage.get as jest.Mock).mockResolvedValue(null)

      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      expect(result.current.filters).toEqual({ state: ["created", "ready"] })
      expect(result.current.filtersLoaded).toBe(true)
    })

    it("applies saved filters from storage", async () => {
      const saved: ExperimentFilters = { state: ["running"], owners: [1] }
      ;(localAreaStorage.get as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === "experimentFilters" ? saved : null)
      )

      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      expect(result.current.filters).toEqual(saved)
    })

    it("does not fire the reload callback for the initial storage-loaded filters", async () => {
      const saved: ExperimentFilters = { state: ["created", "ready"] }
      ;(localAreaStorage.get as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === "experimentFilters" ? saved : null)
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

  describe("user-driven filter changes", () => {
    it("fires the reload callback with the new filters after the debounce window", async () => {
      const saved: ExperimentFilters = { state: ["created", "ready"] }
      ;(localAreaStorage.get as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === "experimentFilters" ? saved : null)
      )

      const onFiltersChange = jest.fn()
      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      const updated: ExperimentFilters = { state: ["running"] }
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

    it("persists changes to storage", async () => {
      ;(localAreaStorage.get as jest.Mock).mockResolvedValue(null)
      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      const onFiltersChange = jest.fn()
      const updated: ExperimentFilters = { state: ["running"] }
      act(() => {
        result.current.handleFilterChange(updated, onFiltersChange)
      })

      expect(localAreaStorage.set).toHaveBeenCalledWith(
        "experimentFilters",
        updated
      )
    })

    it("collapses rapid successive changes into a single reload with the latest value", async () => {
      ;(localAreaStorage.get as jest.Mock).mockResolvedValue({
        state: ["created", "ready"]
      })
      const onFiltersChange = jest.fn()
      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      act(() => {
        result.current.handleFilterChange(
          { state: ["running"] },
          onFiltersChange
        )
      })
      act(() => {
        jest.advanceTimersByTime(50)
        result.current.handleFilterChange(
          { state: ["running", "stopped"] },
          onFiltersChange
        )
      })
      act(() => {
        jest.advanceTimersByTime(50)
        result.current.handleFilterChange(
          { state: ["stopped"] },
          onFiltersChange
        )
      })
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS + 10)
      })

      expect(onFiltersChange).toHaveBeenCalledTimes(1)
      expect(onFiltersChange).toHaveBeenCalledWith({ state: ["stopped"] })
    })

    it("does not fire when the reported filter state is identical to the current one", async () => {
      const saved: ExperimentFilters = { state: ["created", "ready"] }
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

    it("fires again when the user reverts to an earlier filter state", async () => {
      ;(localAreaStorage.get as jest.Mock).mockResolvedValue({
        state: ["created", "ready"]
      })
      const onFiltersChange = jest.fn()
      const { result } = renderHook(() => useExperimentFilters(null))

      await act(async () => {
        await flushMicrotasks()
      })

      act(() => {
        result.current.handleFilterChange(
          { state: ["running"] },
          onFiltersChange
        )
      })
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS + 10)
      })

      act(() => {
        result.current.handleFilterChange(
          { state: ["created", "ready"] },
          onFiltersChange
        )
      })
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_MS + 10)
      })

      expect(onFiltersChange).toHaveBeenCalledTimes(2)
      expect(onFiltersChange).toHaveBeenNthCalledWith(1, { state: ["running"] })
      expect(onFiltersChange).toHaveBeenNthCalledWith(2, {
        state: ["created", "ready"]
      })
    })
  })
})

describe("buildFilterParams", () => {
  it.each(["full_on", "running_not_full_on"])(
    "preserves Draft/Ready OR %s without a global running type",
    (state) => {
      const requests = buildFilterRequests(
        { state: ["created", "ready", state], search: "owned" },
        1,
        50
      )
      expect(requests).toHaveLength(2)
      expect(requests[0]).toMatchObject({
        state: "created,ready",
        search: "owned"
      })
      expect(requests[0].running_type).toBeUndefined()
      expect(requests[1]).toMatchObject({
        state: "running",
        running_type: state === "full_on" ? "full_on" : "experiment",
        search: "owned"
      })
    }
  )

  it.each([
    ["running", "full_on"],
    ["running", "running_not_full_on"],
    ["full_on", "running_not_full_on"]
  ])("keeps the entire running union for %j", (...states) => {
    const requests = buildFilterRequests(
      { state: ["created", ...states] },
      1,
      50
    )
    expect(requests).toHaveLength(1)
    expect(requests[0].state).toBe("created,running")
    expect(requests[0].running_type).toBeUndefined()
  })

  it("merges overlapping sorted partitions without dropping ordinary states or inventing totals", async () => {
    const row = (id: number) => ({
      id,
      created_at: new Date(id * 1000).toISOString()
    })
    const ordinary = [9, 7, 5, 3, 1].map(row)
    const fullOn = [10, 7, 6, 2].map(row)
    const get = jest.fn(async (params: Record<string, unknown>) => {
      const rows = params.running_type ? fullOn : ordinary
      const start = (Number(params.page) - 1) * Number(params.items)
      return {
        experiments: rows.slice(start, start + Number(params.items)),
        total: rows.length
      }
    })
    const filters = { state: ["scheduled", "full_on"] }
    const first = await getFilteredExperiments(get, filters, 1, 2)
    expect(first).toEqual({
      experiments: [row(10), row(9)],
      total: undefined,
      hasMore: true
    })
    // One bounded sorted-prefix request per partition: page*size+1 rows.
    expect(get).toHaveBeenCalledTimes(2)
    expect(
      get.mock.calls.map(([params]) => [params.page, params.items])
    ).toEqual([
      [1, 3],
      [1, 3]
    ])
    const second = await getFilteredExperiments(get, filters, 2, 2)
    expect(second.experiments.map((item) => item.id)).toEqual([7, 6])
    expect(second.total).toBe(8)
    const last = await getFilteredExperiments(get, filters, 4, 2)
    expect(last).toEqual({
      experiments: [row(2), row(1)],
      total: 8,
      hasMore: false
    })
  })

  it("keeps mixed-union reads to one request per partition at list page depth", async () => {
    const row = (id: number) => ({
      id,
      created_at: new Date(id * 1000).toISOString()
    })
    const ordinary = Array.from({ length: 2000 }, (_, i) => row(4000 - i * 2))
    const fullOn = Array.from({ length: 2000 }, (_, i) => row(3999 - i * 2))
    const get = jest.fn(async (params: Record<string, unknown>) => {
      const rows = params.running_type ? fullOn : ordinary
      const start = (Number(params.page) - 1) * Number(params.items)
      return {
        experiments: rows.slice(start, start + Number(params.items)),
        total: rows.length
      }
    })
    const result = await getFilteredExperiments(
      get,
      { state: ["created", "full_on"] },
      10,
      50
    )
    expect(get).toHaveBeenCalledTimes(2)
    expect(get.mock.calls.map(([params]) => params.items)).toEqual([501, 501])
    // Global page 10 of the interleaved union: ids 4000, 3999, ... descending.
    expect(result.experiments).toHaveLength(50)
    expect(result.experiments[0].id).toBe(4000 - 450)
    expect(result.experiments[49].id).toBe(4000 - 499)
    expect(result).toMatchObject({ total: undefined, hasMore: true })
  })

  it("never exceeds the endpoint items cap and still pages correctly beyond it", async () => {
    const row = (id: number) => ({
      id,
      created_at: new Date(id * 1000).toISOString()
    })
    // 1600 ordinary rows interleaved with 1 full-on row near the top.
    const ordinary = Array.from({ length: 1600 }, (_, i) => row(3200 - i * 2))
    const fullOn = [row(3199)]
    const get = jest.fn(async (params: Record<string, unknown>) => {
      expect(Number(params.items)).toBeLessThanOrEqual(1500)
      const rows = params.running_type ? fullOn : ordinary
      const start = (Number(params.page) - 1) * Number(params.items)
      return {
        experiments: rows.slice(start, start + Number(params.items)),
        total: rows.length
      }
    })
    // page 32 × 50 = 1600 rows needed (+1) > cap: ordinary needs two capped
    // requests, the full-on partition is exhausted by its first request.
    const result = await getFilteredExperiments(
      get,
      { state: ["created", "full_on"] },
      32,
      50
    )
    const ordinaryCalls = get.mock.calls.filter(
      ([params]) => !params.running_type
    )
    expect(
      ordinaryCalls.map(([params]) => [params.page, params.items])
    ).toEqual([
      [1, 1500],
      [2, 1500]
    ])
    expect(get).toHaveBeenCalledTimes(3)
    // Union has 1601 rows; the last page holds ids 3200-2*1550 .. 3200-2*1599.
    expect(result.experiments).toHaveLength(50)
    expect(result.experiments[0].id).toBe(3200 - 2 * 1549)
    expect(result.experiments[49].id).toBe(3200 - 2 * 1598)
    expect(result).toEqual(
      expect.objectContaining({ total: 1601, hasMore: true })
    )
  })

  it("propagates a failed partition instead of presenting an incomplete successful union", async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({ experiments: [], total: 0 })
      .mockRejectedValueOnce(new Error("HTTP 400"))
    await expect(
      getFilteredExperiments(get, { state: ["ready", "full_on"] }, 1, 50)
    ).rejects.toThrow("HTTP 400")
  })

  it("maps Full On to the experiment running category, not feature flag on", () => {
    expect(buildFilterParams({ state: ["full_on"] }, 1, 50)).toMatchObject({
      state: "running",
      running_type: "full_on"
    })
  })

  it("maps Running Not Full On to running with the documented experiment running type", () => {
    expect(
      buildFilterParams({ state: ["running_not_full_on"] }, 1, 50)
    ).toMatchObject({ state: "running", running_type: "experiment" })
  })

  it("keeps the broader running/full-on union when both running options are selected", () => {
    const params = buildFilterParams(
      { state: ["full_on", "running_not_full_on", "running"] },
      1,
      50
    )
    expect(params.state).toBe("running")
    expect(params.running_type).toBeUndefined()
  })

  it.each([
    "created",
    "ready",
    "running",
    "development",
    "stopped",
    "archived",
    "scheduled"
  ])("preserves supported API state %s", (state) => {
    expect(buildFilterParams({ state: [state] }, 1, 50).state).toBe(state)
  })

  it("omits filter keys entirely when filterState is null", () => {
    const params = buildFilterParams(null, 1, 50)
    expect(params).toEqual({
      page: 1,
      items: 50,
      iterations: 1,
      previews: 1,
      type: "test"
    })
    expect(params.state).toBeUndefined()
  })

  it("serializes the state filter as a comma-joined string", () => {
    const params = buildFilterParams({ state: ["created", "ready"] }, 1, 50)
    expect(params.state).toBe("created,ready")
  })

  it("serializes all multi-select filters as comma-joined strings", () => {
    const filterState: ExperimentFilters = {
      state: ["running"],
      significance: ["positive"],
      owners: [1, 2],
      teams: [10],
      tags: [5, 6],
      applications: [100]
    }
    const params = buildFilterParams(filterState, 1, 50)
    expect(params.state).toBe("running")
    expect(params.significance).toBe("positive")
    expect(params.owners).toBe("1,2")
    expect(params.teams).toBe("10")
    expect(params.tags).toBe("5,6")
    expect(params.applications).toBe("100")
  })

  it("passes through boolean issue flags only when set to true", () => {
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
