import { act, fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import type { Experiment } from "~src/types/absmartly"
import { unsafeExperimentId, unsafeVariantName } from "~src/types/branded"

import { ExperimentDetail } from "../ExperimentDetail"

const mockSave = jest.fn().mockResolvedValue(undefined)

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
jest.mock("~src/hooks/useExperimentSave", () => ({
  useExperimentSave: () => ({ save: mockSave, saving: false })
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

const props = {
  experiment,
  onBack: jest.fn(),
  onStart: jest.fn(),
  onStop: jest.fn(),
  onUpdate: jest.fn(),
  loading: false,
  applications: [{ application_id: 1, name: "Fixture web" }],
  unitTypes: [
    { unit_type_id: 1, name: "fixture_unit" },
    { unit_type_id: 2, name: "fixture_user" }
  ],
  owners: [],
  teams: [],
  tags: [],
  onError: jest.fn()
}

const trafficInput = () =>
  document.getElementById("traffic-percentage-input") as HTMLInputElement
const saveButton = () => screen.getByRole("button", { name: /Save Changes/ })

describe("ExperimentDetail metadata edits (FT-2251)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.confirm = jest.fn(() => false)
  })

  it("marks a traffic change as unsaved and asks before Back discards it", async () => {
    render(<ExperimentDetail {...props} />)
    expect(saveButton()).toHaveTextContent(/^Save Changes$/)

    fireEvent.change(trafficInput(), { target: { value: "42" } })
    expect(saveButton()).toHaveTextContent("• Save Changes")

    fireEvent.click(document.getElementById("header-back-button")!)
    expect(window.confirm).toHaveBeenCalled()
    expect(props.onBack).not.toHaveBeenCalled()
    expect(trafficInput()).toHaveValue(42)
  })

  it("clears the unsaved marker when traffic returns to its saved value", () => {
    render(<ExperimentDetail {...props} />)
    fireEvent.change(trafficInput(), { target: { value: "42" } })
    fireEvent.change(trafficInput(), { target: { value: "100" } })
    expect(saveButton()).toHaveTextContent(/^Save Changes$/)

    fireEvent.click(document.getElementById("header-back-button")!)
    expect(window.confirm).not.toHaveBeenCalled()
    expect(props.onBack).toHaveBeenCalled()
  })

  it.each(["150", "-5"])(
    "rejects traffic %s with an inline error and does not save",
    async (value) => {
      render(<ExperimentDetail {...props} />)
      fireEvent.change(trafficInput(), { target: { value } })

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Traffic percentage must be between 0 and 100"
      )
      expect(trafficInput()).toHaveAttribute("aria-invalid", "true")

      await act(async () => {
        fireEvent.click(saveButton())
      })
      expect(mockSave).not.toHaveBeenCalled()
      expect(trafficInput()).toHaveFocus()
    }
  )

  it("saves a valid traffic value and then treats it as saved", async () => {
    render(<ExperimentDetail {...props} />)
    fireEvent.change(trafficInput(), { target: { value: "55" } })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(saveButton())
    })
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ percentage_of_traffic: 55 }),
      expect.anything(),
      props.onUpdate
    )
    expect(saveButton()).toHaveTextContent(/^Save Changes$/)
  })
})
