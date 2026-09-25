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
const saveButton = () => screen.getByRole("button", { name: /Save Changes/ })

describe("ExperimentDetail with the real update handler (FT-2251)", () => {
  beforeEach(() => {
    window.confirm = jest.fn(() => false)
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
    expect(saveButton()).toHaveTextContent("• Save Changes")

    fireEvent.click(document.getElementById("header-back-button")!)
    expect(window.confirm).toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
    expect(trafficInput()).toHaveValue(42)

    await act(async () => {
      fireEvent.click(saveButton())
    })
    expect(updateExperiment).toHaveBeenCalledTimes(2)
    expect(updateExperiment.mock.calls[1][1]).toMatchObject({
      percentage_of_traffic: 42
    })
    expect(saveButton()).toHaveTextContent(/^Save Changes$/)
  })
})
