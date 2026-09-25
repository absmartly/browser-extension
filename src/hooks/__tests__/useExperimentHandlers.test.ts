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

describe("experiment update result", () => {
  const makeProps = (updateExperiment: jest.Mock) => ({
    getExperiment: jest.fn().mockResolvedValue({ id: 7, name: "exp" }),
    startExperiment: jest.fn(),
    stopExperiment: jest.fn(),
    createExperiment: jest.fn(),
    updateExperiment,
    loadExperiments: jest.fn(),
    onAuthExpired: jest.fn(),
    onError: jest.fn(),
    onSuccess: jest.fn(),
    setView: jest.fn(),
    pageSize: 20
  })

  it("reports a failed update once and resolves false", async () => {
    const props = makeProps(
      jest.fn().mockRejectedValue(new Error("Test-owned update rejected"))
    )
    const { result } = renderHook(() => useExperimentHandlers(props))

    let persisted: unknown
    await act(async () => {
      persisted = await result.current.handleUpdateExperiment(7, {
        percentage_of_traffic: 42
      })
    })
    expect(persisted).toBe(false)
    expect(props.onError).toHaveBeenCalledTimes(1)
    expect(props.onError).toHaveBeenCalledWith("Test-owned update rejected")
    expect(props.onSuccess).not.toHaveBeenCalled()
    expect(props.loadExperiments).not.toHaveBeenCalled()
  })

  it("resolves true after a successful update", async () => {
    const props = makeProps(jest.fn().mockResolvedValue({}))
    const { result } = renderHook(() => useExperimentHandlers(props))

    let persisted: unknown
    await act(async () => {
      persisted = await result.current.handleUpdateExperiment(7, {
        percentage_of_traffic: 42
      })
    })
    expect(persisted).toBe(true)
    expect(props.onError).not.toHaveBeenCalled()
    expect(props.onSuccess).toHaveBeenCalledWith(
      "Experiment saved successfully!"
    )
  })
})
