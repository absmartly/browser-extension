import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import type { Experiment } from "~src/types/absmartly"
import { unsafeExperimentId, unsafeVariantName } from "~src/types/branded"
import { clearAllExperimentStorage } from "~src/utils/storage-cleanup"

import { ExperimentDetail } from "../ExperimentDetail"

const mockSave = jest.fn().mockResolvedValue(true)

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
  VariantList: ({ initialVariants, onVariantsChange }: any) => (
    <input
      aria-label="Variant name"
      defaultValue={initialVariants[1].name}
      onChange={(event) =>
        onVariantsChange(
          [
            initialVariants[0],
            { ...initialVariants[1], name: event.target.value }
          ],
          true
        )
      }
    />
  )
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
    mockSave.mockResolvedValue(true)
  })

  it("marks a traffic change as unsaved and asks before Back discards it", async () => {
    render(<ExperimentDetail {...props} />)
    expect(saveButton()).toHaveTextContent(/^Save Changes$/)
    expect(saveButton()).toBeDisabled()
    expect(saveButton()).toHaveClass("bg-gray-200")

    fireEvent.change(trafficInput(), { target: { value: "42" } })
    expect(saveButton()).toBeEnabled()
    expect(saveButton()).toHaveTextContent(/^Save Changes$/)
    expect(saveButton()).toHaveClass("bg-blue-600")
    expect(saveButton()).not.toHaveClass("ring-yellow-400")

    fireEvent.click(document.getElementById("header-back-button")!)
    expect(screen.getByRole("dialog", { name: "Save changes?" })).toBeVisible()
    expect(props.onBack).not.toHaveBeenCalled()
    fireEvent.click(document.getElementById("unsaved-changes-cancel")!)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(trafficInput()).toHaveValue(42)
    expect(saveButton()).toBeEnabled()
  })

  it("clears the unsaved marker when traffic returns to its saved value", () => {
    render(<ExperimentDetail {...props} />)
    fireEvent.change(trafficInput(), { target: { value: "42" } })
    fireEvent.change(trafficInput(), { target: { value: "100" } })
    expect(saveButton()).toBeDisabled()

    fireEvent.click(document.getElementById("header-back-button")!)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
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
    expect(saveButton()).toBeDisabled()
  })

  it("keeps edits unsaved when the save reports a failure", async () => {
    mockSave.mockResolvedValue(false)
    render(<ExperimentDetail {...props} />)
    fireEvent.change(trafficInput(), { target: { value: "42" } })

    await act(async () => {
      fireEvent.click(saveButton())
    })
    expect(mockSave).toHaveBeenCalled()
    expect(saveButton()).toBeEnabled()

    fireEvent.click(document.getElementById("header-back-button")!)
    expect(screen.getByRole("dialog", { name: "Save changes?" })).toBeVisible()
    expect(props.onBack).not.toHaveBeenCalled()
    expect(trafficInput()).toHaveValue(42)
  })

  it("opens a stored traffic of 0 as 0 without marking it unsaved", async () => {
    render(
      <ExperimentDetail
        {...props}
        experiment={{ ...experiment, percentage_of_traffic: 0 }}
      />
    )
    expect(trafficInput()).toHaveValue(0)
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByTestId("unit-type-select-trigger"))
    fireEvent.click(screen.getByTestId("searchable-select-option-2"))

    await act(async () => {
      fireEvent.click(saveButton())
    })
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ percentage_of_traffic: 0 }),
      expect.anything(),
      props.onUpdate
    )
  })

  it("does not send a save when there are no changes", () => {
    render(<ExperimentDetail {...props} />)
    fireEvent.click(saveButton())
    expect(mockSave).not.toHaveBeenCalled()
  })

  it("disables Save again when a variant name is reverted", () => {
    render(<ExperimentDetail {...props} />)
    const name = screen.getByLabelText("Variant name")
    fireEvent.change(name, { target: { value: "Variant B" } })
    expect(saveButton()).toBeEnabled()
    fireEvent.change(name, { target: { value: "Variant 1" } })
    expect(saveButton()).toBeDisabled()
  })

  it("disables Save again when a display name is reverted", () => {
    const { container } = render(<ExperimentDetail {...props} />)
    fireEvent.click(container.querySelector("h2")!)
    const name = screen.getByDisplayValue("FT experiment")
    fireEvent.change(name, { target: { value: "New name" } })
    expect(saveButton()).toBeEnabled()
    fireEvent.change(name, { target: { value: "FT experiment" } })
    expect(saveButton()).toBeDisabled()
  })

  it("marks the current variants as saved after a successful save", async () => {
    render(<ExperimentDetail {...props} />)
    fireEvent.change(screen.getByLabelText("Variant name"), {
      target: { value: "Variant B" }
    })
    await act(async () => {
      fireEvent.click(saveButton())
    })
    expect(mockSave).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ name: "Variant B" })]),
      props.onUpdate
    )
    expect(saveButton()).toBeDisabled()
  })

  it("leaves directly from Cancel when there are no changes", () => {
    render(<ExperimentDetail {...props} />)
    fireEvent.click(document.getElementById("experiment-detail-cancel")!)
    expect(props.onBack).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens the same modal from Cancel, and Discard clears the draft before leaving", async () => {
    let finishCleanup!: () => void
    jest.mocked(clearAllExperimentStorage).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCleanup = resolve
        })
    )
    render(<ExperimentDetail {...props} />)
    fireEvent.change(trafficInput(), { target: { value: "42" } })
    fireEvent.click(document.getElementById("experiment-detail-cancel")!)
    expect(screen.getByRole("dialog", { name: "Save changes?" })).toBeVisible()
    expect(props.onBack).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(document.getElementById("unsaved-changes-discard")!)
    })
    expect(clearAllExperimentStorage).toHaveBeenCalledWith(experiment.id)
    expect(props.onBack).not.toHaveBeenCalled()
    await act(async () => {
      finishCleanup()
    })
    expect(props.onBack).toHaveBeenCalledTimes(1)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it("saves from the modal and leaves only after persistence succeeds", async () => {
    let finishSave!: (saved: boolean) => void
    mockSave.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve
        })
    )
    render(<ExperimentDetail {...props} />)
    fireEvent.change(trafficInput(), { target: { value: "42" } })
    fireEvent.click(document.getElementById("header-back-button")!)
    fireEvent.click(document.getElementById("unsaved-changes-save")!)
    expect(props.onBack).not.toHaveBeenCalled()
    expect(clearAllExperimentStorage).not.toHaveBeenCalled()

    await act(async () => {
      finishSave(true)
    })
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ percentage_of_traffic: 42 }),
      expect.anything(),
      props.onUpdate
    )
    expect(props.onBack).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it.each([false, new Error("update failed")])(
    "keeps the modal and edits after a failed modal save (%s)",
    async (failure) => {
      if (failure instanceof Error) mockSave.mockRejectedValueOnce(failure)
      else mockSave.mockResolvedValueOnce(failure)
      render(<ExperimentDetail {...props} />)
      fireEvent.change(trafficInput(), { target: { value: "42" } })
      fireEvent.click(document.getElementById("header-back-button")!)

      await act(async () => {
        fireEvent.click(document.getElementById("unsaved-changes-save")!)
      })
      expect(
        screen.getByRole("dialog", { name: "Save changes?" })
      ).toBeVisible()
      expect(props.onBack).not.toHaveBeenCalled()
      expect(clearAllExperimentStorage).not.toHaveBeenCalled()
      expect(trafficInput()).toHaveValue(42)
    }
  )

  it("returns to the invalid field when Save from the modal fails validation", async () => {
    render(<ExperimentDetail {...props} />)
    fireEvent.change(trafficInput(), { target: { value: "150" } })
    fireEvent.click(document.getElementById("header-back-button")!)
    fireEvent.click(document.getElementById("unsaved-changes-save")!)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await waitFor(() => expect(trafficInput()).toHaveFocus())
    expect(mockSave).not.toHaveBeenCalled()
    expect(props.onBack).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("between 0 and 100")
  })
})
