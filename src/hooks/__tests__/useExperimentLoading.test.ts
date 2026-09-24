import { act, renderHook } from "@testing-library/react"

import { useExperimentLoading } from "../useExperimentLoading"

jest.mock("~src/utils/storage", () => ({
  getExperimentsCache: jest.fn().mockResolvedValue(null),
  setExperimentsCache: jest.fn().mockResolvedValue(undefined)
}))

it("retains the active mixed selection on page navigation and page-size changes", async () => {
  const getExperiments = jest
    .fn()
    .mockResolvedValue({ experiments: [], total: 0 })
  const { result } = renderHook(() =>
    useExperimentLoading({
      getExperiments,
      requestPermissionsIfNeeded: jest.fn(),
      onAuthExpired: jest.fn(),
      onError: jest.fn()
    })
  )
  await act(async () =>
    result.current.loadExperiments(false, 1, 50, {
      state: ["created", "full_on"]
    })
  )
  getExperiments.mockClear()
  await act(async () => result.current.handlePageChange(2))
  expect(
    getExperiments.mock.calls.map(([params]) => [
      params.state,
      params.running_type
    ])
  ).toEqual([
    ["created", undefined],
    ["running", "full_on"]
  ])
  getExperiments.mockClear()
  await act(async () => result.current.handlePageSizeChange(20))
  // Each partition fetches its page*size+1 sorted prefix in one request.
  expect(
    getExperiments.mock.calls.map(([params]) => [
      params.state,
      params.running_type,
      params.items
    ])
  ).toEqual([
    ["created", undefined, 21],
    ["running", "full_on", 21]
  ])
})

describe("out-of-order responses", () => {
  type Deferred = {
    resolve: (value: { experiments: any[]; total?: number }) => void
    reject: (error: unknown) => void
  }
  const setup = () => {
    const pending: Deferred[] = []
    const getExperiments = jest.fn(
      () =>
        new Promise<{ experiments: any[]; total?: number }>((resolve, reject) =>
          pending.push({ resolve, reject })
        )
    )
    const onError = jest.fn()
    const onAuthExpired = jest.fn()
    const requestPermissionsIfNeeded = jest.fn().mockResolvedValue(true)
    const { result } = renderHook(() =>
      useExperimentLoading({
        getExperiments,
        requestPermissionsIfNeeded,
        onAuthExpired,
        onError
      })
    )
    return {
      pending,
      getExperiments,
      onError,
      onAuthExpired,
      requestPermissionsIfNeeded,
      result
    }
  }
  const row = (id: number, state: string) => ({ id, name: `e${id}`, state })

  it("ignores an older success that resolves after the newest load", async () => {
    const { pending, result } = setup()
    act(() => {
      void result.current.loadExperiments(false, 1, 50, {
        state: ["running"],
        significance: ["positive"]
      })
    })
    act(() => {
      void result.current.loadExperiments(false, 1, 50, {
        state: ["created", "ready"]
      })
    })
    expect(pending).toHaveLength(2)
    // Newest (Clear All defaults) returns first.
    await act(async () =>
      pending[1].resolve({ experiments: [row(1, "created")], total: 1 })
    )
    expect(result.current.experiments).toEqual([row(1, "created")])
    expect(result.current.experimentsLoading).toBe(false)
    // Older (running + positive) returns last and must not overwrite.
    await act(async () => pending[0].resolve({ experiments: [], total: 0 }))
    expect(result.current.experiments).toEqual([row(1, "created")])
    expect(result.current.totalExperiments).toBe(1)
    expect(result.current.experimentsLoading).toBe(false)
  })

  it("ignores an older failure that rejects after the newest load succeeded", async () => {
    const { pending, result, onError } = setup()
    act(() => {
      void result.current.loadExperiments(false, 1, 50, { state: ["running"] })
    })
    act(() => {
      void result.current.loadExperiments(false, 1, 50, { state: ["created"] })
    })
    await act(async () =>
      pending[1].resolve({ experiments: [row(2, "created")], total: 1 })
    )
    onError.mockClear()
    await act(async () => pending[0].reject(new Error("HTTP 500")))
    expect(onError).not.toHaveBeenCalled()
    expect(result.current.experiments).toEqual([row(2, "created")])
  })

  it("keeps loading until the newest request settles when the older one finishes first", async () => {
    const { pending, result } = setup()
    act(() => {
      void result.current.loadExperiments(false, 1, 50, { state: ["running"] })
    })
    act(() => {
      void result.current.loadExperiments(false, 1, 50, { state: ["created"] })
    })
    await act(async () => pending[0].resolve({ experiments: [], total: 0 }))
    expect(result.current.experimentsLoading).toBe(true)
    await act(async () =>
      pending[1].resolve({ experiments: [row(3, "created")], total: 1 })
    )
    expect(result.current.experimentsLoading).toBe(false)
    expect(result.current.experiments).toEqual([row(3, "created")])
  })

  it("does not schedule a deferred auth retry for a superseded load", async () => {
    jest.useFakeTimers()
    try {
      const { pending, result, getExperiments, onAuthExpired } = setup()
      act(() => {
        void result.current.loadExperiments(false, 1, 50, {
          state: ["running"]
        })
      })
      act(() => {
        void result.current.loadExperiments(false, 1, 50, {
          state: ["created"]
        })
      })
      await act(async () =>
        pending[1].resolve({ experiments: [row(4, "created")], total: 1 })
      )
      getExperiments.mockClear()
      onAuthExpired.mockClear()
      await act(async () => pending[0].reject(new Error("AUTH_EXPIRED")))
      await act(async () => {
        jest.advanceTimersByTime(1000)
      })
      expect(onAuthExpired).not.toHaveBeenCalledWith(true)
      expect(getExperiments).not.toHaveBeenCalled()
      expect(result.current.experiments).toEqual([row(4, "created")])
    } finally {
      jest.useRealTimers()
    }
  })
})
