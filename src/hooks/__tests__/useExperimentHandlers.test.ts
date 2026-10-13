import { act, renderHook } from "@testing-library/react"

import { useExperimentHandlers } from "../useExperimentHandlers"

jest.mock("~src/utils/storage-cleanup", () => ({
  clearAllExperimentStorage: jest.fn().mockResolvedValue(undefined)
}))

describe("experiment save error propagation", () => {
  it("rejects a failed create without navigating or announcing success", async () => {
    const failure = new Error("Test-owned create rejected")
    const props = {
      getExperiment: jest.fn(),
      startExperiment: jest.fn(),
      stopExperiment: jest.fn(),
      createExperiment: jest.fn().mockRejectedValue(failure),
      updateExperiment: jest.fn(),
      loadExperiments: jest.fn(),
      onAuthExpired: jest.fn(),
      onError: jest.fn(),
      onSuccess: jest.fn(),
      setView: jest.fn(),
      pageSize: 20
    }
    const { result } = renderHook(() => useExperimentHandlers(props))

    await act(async () => {
      await expect(
        result.current.handleSaveExperiment({ name: "test_owned_draft" })
      ).rejects.toBe(failure)
    })
    expect(props.onError).toHaveBeenCalledWith(failure.message)
    expect(props.onSuccess).not.toHaveBeenCalled()
    expect(props.setView).not.toHaveBeenCalled()
    expect(props.loadExperiments).not.toHaveBeenCalled()
  })
})
