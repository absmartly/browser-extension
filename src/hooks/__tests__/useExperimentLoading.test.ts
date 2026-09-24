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
