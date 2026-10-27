import {
  act,
  fireEvent,
  render,
  renderHook,
  screen
} from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import { useExperimentHandlers } from "~src/hooks/useExperimentHandlers"
import type { Experiment } from "~src/types/absmartly"
import { unsafeExperimentId, unsafeVariantName } from "~src/types/branded"
import { clearAllExperimentStorage } from "~src/utils/storage-cleanup"

import { ExperimentDetail } from "../ExperimentDetail"

jest.mock("~src/lib/messaging", () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined),
  sendToBackground: jest.fn().mockResolvedValue({ success: true })
}))
jest.mock("~src/utils/storage", () => ({
  getConfig: jest
    .fn()
    .mockResolvedValue({ domChangesFieldName: "__dom_changes" })
}))
jest.mock("~src/utils/storage-cleanup", () => ({
  clearAllExperimentStorage: jest.fn().mockResolvedValue(undefined)
}))
jest.mock("~src/lib/background-api-client", () => ({
  BackgroundAPIClient: jest.fn().mockImplementation(() => ({
    getCustomSectionFields: jest.fn().mockResolvedValue([])
  }))
}))
jest.mock("~src/components/VariantList", () => ({
  VariantList: () => <div data-testid="variant-list" />
}))
jest.mock("~src/components/ExperimentCodeInjection", () => ({
  ExperimentCodeInjection: () => null
}))
jest.mock("~src/components/ExperimentDetail/ExperimentActions", () => ({
  ExperimentActions: () => null
}))

const experiment: Experiment = {
  id: unsafeExperimentId(501),
  name: "ft_exp",
  display_name: "FT experiment",
  state: "created",
  status: "draft",
  percentage_of_traffic: 100,
  unit_type_id: 1,
  unit_type: { unit_type_id: 1, name: "fixture_unit" },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  variants: [
    { name: unsafeVariantName("Control"), config: "{}" },
    { name: unsafeVariantName("Variant 1"), config: "{}" }
  ],
  applications: [],
  owners: [],
  teams: [],
  experiment_tags: []
}

const trafficInput = () =>
  document.getElementById("traffic-percentage-input") as HTMLInputElement
const saveButton = () => document.getElementById("experiment-detail-save")!

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe("ExperimentDetail with the real update handler (FT-2251)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .mocked(clearAllExperimentStorage)
      .mockReset()
      .mockResolvedValue(undefined)
    ;(global as any).chrome.runtime = {
      onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
      sendMessage: jest.fn((message: any) =>
        message?.type === "API_REQUEST" && message.method === "GET"
          ? Promise.resolve({ success: true, data: { experiment } })
          : Promise.resolve(undefined)
      )
    }
  })

  const renderWithHandlers = (updateExperiment: jest.Mock) => {
    const handlerProps = {
      getExperiment: jest.fn().mockResolvedValue(experiment),
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
    }
    const { result } = renderHook(() => useExperimentHandlers(handlerProps))
    const onBack = jest.fn()
    render(
      <ExperimentDetail
        experiment={experiment}
        onBack={onBack}
        onStart={jest.fn()}
        onStop={jest.fn()}
        onUpdate={result.current.handleUpdateExperiment}
        applications={[{ application_id: 1, name: "Fixture web" }]}
        unitTypes={[{ unit_type_id: 1, name: "fixture_unit" }]}
        onError={handlerProps.onError}
      />
    )
    return { handlerProps, onBack }
  }

  it("keeps the traffic edit unsaved when the PUT fails, then saves on retry", async () => {
    const updateExperiment = jest
      .fn()
      .mockRejectedValueOnce(new Error("Test-owned update rejected"))
      .mockResolvedValueOnce({})
    const { handlerProps, onBack } = renderWithHandlers(updateExperiment)

    fireEvent.change(trafficInput(), { target: { value: "42" } })
    await act(async () => {
      fireEvent.click(saveButton())
    })

    expect(updateExperiment).toHaveBeenCalledTimes(1)
    expect(handlerProps.onError).toHaveBeenCalledTimes(1)
    expect(handlerProps.onError).toHaveBeenCalledWith(
      "Test-owned update rejected"
    )
    expect(handlerProps.onSuccess).not.toHaveBeenCalled()
    expect(saveButton()).toBeEnabled()

    fireEvent.click(document.getElementById("header-back-button")!)
    expect(screen.getByRole("dialog", { name: "Save changes?" })).toBeVisible()
    expect(onBack).not.toHaveBeenCalled()
    expect(trafficInput()).toHaveValue(42)
    fireEvent.click(document.getElementById("unsaved-changes-cancel")!)

    await act(async () => {
      fireEvent.click(saveButton())
    })
    expect(updateExperiment).toHaveBeenCalledTimes(2)
    expect(updateExperiment.mock.calls[1][1]).toMatchObject({
      percentage_of_traffic: 42
    })
    expect(saveButton()).toBeDisabled()
  })

  it.each(["resolve", "reject"] as const)(
    "keeps modal navigation busy through delayed persistence and cleanup (%s)",
    async (cleanupResult) => {
      const persistence = deferred()
      const cleanup = deferred()
      const updateExperiment = jest.fn().mockReturnValue(persistence.promise)
      jest
        .mocked(clearAllExperimentStorage)
        .mockReturnValueOnce(cleanup.promise)
      const { onBack } = renderWithHandlers(updateExperiment)
      const modal = () => document.getElementById("unsaved-changes-modal")!
      const cancel = () => document.getElementById("unsaved-changes-cancel")!
      const discard = () => document.getElementById("unsaved-changes-discard")!
      const modalSave = () => document.getElementById("unsaved-changes-save")!
      const expectBusy = () => {
        expect(modal()).toBeVisible()
        expect(cancel()).toBeDisabled()
        expect(discard()).toBeDisabled()
        expect(modalSave()).toBeDisabled()
        expect(modalSave()).toHaveTextContent("Saving...")
        expect(
          document.getElementById("experiment-detail-cancel")
        ).toBeDisabled()
        expect(saveButton()).toBeDisabled()
        fireEvent.click(cancel())
        fireEvent.click(discard())
        fireEvent.keyDown(modal(), { key: "Escape" })
        expect(modal()).toBeVisible()
        expect(onBack).not.toHaveBeenCalled()
      }

      fireEvent.change(trafficInput(), { target: { value: "42" } })
      fireEvent.click(document.getElementById("header-back-button")!)
      await act(async () => {
        fireEvent.click(modalSave())
      })
      expect(updateExperiment).toHaveBeenCalledTimes(1)
      expect(clearAllExperimentStorage).not.toHaveBeenCalled()
      expectBusy()

      await act(async () => {
        persistence.resolve()
      })
      expect(clearAllExperimentStorage).toHaveBeenCalledWith(experiment.id)
      expectBusy()

      await act(async () => {
        if (cleanupResult === "resolve") cleanup.resolve()
        else cleanup.reject(new Error("Test-owned cleanup failure"))
      })
      expect(onBack).toHaveBeenCalledTimes(1)
      expect(document.getElementById("unsaved-changes-modal")).toBeNull()
      expect(updateExperiment.mock.calls[0][1]).toMatchObject({
        percentage_of_traffic: 42
      })
      expect(updateExperiment).toHaveBeenCalledTimes(1)
    }
  )

  it("keeps regular Save busy through cleanup and preserves a newer edit", async () => {
    const cleanup = deferred()
    jest.mocked(clearAllExperimentStorage).mockReturnValueOnce(cleanup.promise)
    const updateExperiment = jest.fn().mockResolvedValue({})
    const { onBack } = renderWithHandlers(updateExperiment)
    fireEvent.change(trafficInput(), { target: { value: "42" } })
    await act(async () => {
      fireEvent.click(saveButton())
    })
    expect(clearAllExperimentStorage).toHaveBeenCalledWith(experiment.id)
    expect(document.getElementById("experiment-detail-cancel")).toBeDisabled()
    expect(saveButton()).toBeDisabled()
    expect(saveButton()).toHaveTextContent("Saving...")
    fireEvent.change(trafficInput(), { target: { value: "55" } })

    await act(async () => {
      cleanup.resolve()
    })
    expect(onBack).not.toHaveBeenCalled()
    expect(trafficInput()).toHaveValue(55)
    expect(saveButton()).toBeEnabled()
    expect(updateExperiment.mock.calls[0][1]).toMatchObject({
      percentage_of_traffic: 42
    })

    await act(async () => {
      fireEvent.click(saveButton())
    })
    expect(updateExperiment).toHaveBeenCalledTimes(2)
    expect(updateExperiment.mock.calls[1][1]).toMatchObject({
      percentage_of_traffic: 55
    })
    expect(saveButton()).toBeDisabled()
  })
})
