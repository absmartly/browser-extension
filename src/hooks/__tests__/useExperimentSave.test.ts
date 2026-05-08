import { act, renderHook } from "@testing-library/react"

import { BackgroundAPIClient } from "~src/lib/background-api-client"
import type { Experiment } from "~src/types/absmartly"
import { unsafeExperimentId } from "~src/types/branded"
import {
  notifyError,
  notifySuccess,
  notifyWarning
} from "~src/utils/notifications"

import { useExperimentSave } from "../useExperimentSave"

jest.mock("~src/lib/background-api-client")
jest.mock("~src/utils/storage", () => ({
  getConfig: jest.fn().mockResolvedValue({
    domChangesFieldName: "__dom_changes"
  })
}))
jest.mock("~src/utils/debug", () => ({
  debugLog: jest.fn(),
  debugError: jest.fn()
}))
jest.mock("~src/utils/notifications", () => ({
  notifyError: jest.fn().mockResolvedValue(undefined),
  notifyWarning: jest.fn().mockResolvedValue(undefined),
  notifySuccess: jest.fn().mockResolvedValue(undefined),
  notifyInfo: jest.fn().mockResolvedValue(undefined)
}))

describe("useExperimentSave - Custom Fields", () => {
  let mockGetCustomSectionFields: jest.Mock

  beforeEach(() => {
    mockGetCustomSectionFields = jest.fn()
    ;(BackgroundAPIClient as jest.Mock).mockImplementation(() => ({
      getCustomSectionFields: mockGetCustomSectionFields
    }))
    ;(global as any).chrome = {
      runtime: {
        sendMessage: jest.fn()
      }
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("Creating new experiment with custom fields", () => {
    it("should fetch and include custom fields when creating experiment", async () => {
      const mockCustomFields = [
        {
          id: 1,
          section_id: 1,
          title: "Hypothesis",
          help_text: "What is your hypothesis?",
          placeholder: "Enter hypothesis",
          default_value: "Default hypothesis",
          type: "text" as const,
          required: true,
          archived: false,
          order_index: 1
        },
        {
          id: 2,
          section_id: 1,
          title: "Purpose",
          help_text: "What is the purpose?",
          placeholder: "Enter purpose",
          default_value: "",
          type: "string" as const,
          required: false,
          archived: false,
          order_index: 2
        }
      ]

      mockGetCustomSectionFields.mockResolvedValue(mockCustomFields)

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: "test-experiment",
        display_name: "Test Experiment",
        percentage_of_traffic: 100,
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [
        { name: "Control", config: { __dom_changes: [] } },
        { name: "Variant A", config: { __dom_changes: [] } }
      ]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      expect(mockGetCustomSectionFields).toHaveBeenCalled()
      expect(mockOnSave).toHaveBeenCalled()

      const experimentData = mockOnSave.mock.calls[0][0]
      expect(experimentData.custom_section_field_values).toBeDefined()
      expect(experimentData.custom_section_field_values["1"]).toEqual({
        value: "Default hypothesis",
        type: "text",
        id: 1
      })
      expect(experimentData.custom_section_field_values["2"]).toEqual({
        value: "",
        type: "string",
        id: 2
      })
    })

    it("should handle empty custom fields array", async () => {
      mockGetCustomSectionFields.mockResolvedValue([])

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: "test-experiment",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      const experimentData = mockOnSave.mock.calls[0][0]
      expect(experimentData.custom_section_field_values).toEqual({})
    })

    it("should handle custom fields fetch error gracefully", async () => {
      mockGetCustomSectionFields.mockRejectedValue(new Error("API Error"))

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: "test-experiment",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      expect(mockOnSave).toHaveBeenCalled()
      const experimentData = mockOnSave.mock.calls[0][0]
      expect(experimentData.custom_section_field_values).toEqual({})
    })

    it("should use default_value from custom fields", async () => {
      const mockCustomFields = [
        {
          id: 1,
          title: "Field With Default",
          type: "text" as const,
          default_value: "My default value",
          required: true
        },
        {
          id: 2,
          title: "Field Without Default",
          type: "string" as const,
          default_value: "",
          required: false
        }
      ]

      mockGetCustomSectionFields.mockResolvedValue(mockCustomFields)

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: "test-experiment",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      const experimentData = mockOnSave.mock.calls[0][0]
      expect(experimentData.custom_section_field_values["1"].value).toBe(
        "My default value"
      )
      expect(experimentData.custom_section_field_values["2"].value).toBe("")
    })

    it("should handle all custom field types", async () => {
      const mockCustomFields = [
        {
          id: 1,
          title: "Text",
          type: "text" as const,
          default_value: "text value",
          required: true
        },
        {
          id: 2,
          title: "String",
          type: "string" as const,
          default_value: "string value",
          required: false
        },
        {
          id: 3,
          title: "JSON",
          type: "json" as const,
          default_value: '{"key": "value"}',
          required: false
        },
        {
          id: 4,
          title: "Boolean",
          type: "boolean" as const,
          default_value: "true",
          required: false
        },
        {
          id: 5,
          title: "Number",
          type: "number" as const,
          default_value: "42",
          required: false
        }
      ]

      mockGetCustomSectionFields.mockResolvedValue(mockCustomFields)

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: "test-experiment",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      const experimentData = mockOnSave.mock.calls[0][0]
      const customFields = experimentData.custom_section_field_values

      expect(customFields["1"]).toEqual({
        value: "text value",
        type: "text",
        id: 1
      })
      expect(customFields["2"]).toEqual({
        value: "string value",
        type: "string",
        id: 2
      })
      expect(customFields["3"]).toEqual({
        value: '{"key": "value"}',
        type: "json",
        id: 3
      })
      expect(customFields["4"]).toEqual({
        value: "true",
        type: "boolean",
        id: 4
      })
      expect(customFields["5"]).toEqual({ value: "42", type: "number", id: 5 })
    })

    it("should include custom fields alongside other experiment data", async () => {
      const mockCustomFields = [
        {
          id: 1,
          title: "Field",
          type: "text" as const,
          default_value: "value",
          required: true
        }
      ]

      mockGetCustomSectionFields.mockResolvedValue(mockCustomFields)

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: "test-experiment",
        display_name: "Test Experiment",
        percentage_of_traffic: 50,
        unit_type_id: 2,
        application_ids: [1, 2],
        owner_ids: [1],
        team_ids: [1],
        tag_ids: [1, 2]
      }
      const variants = [
        { name: "Control", config: { __dom_changes: [] } },
        {
          name: "Variant A",
          config: {
            __dom_changes: [
              { selector: ".test", action: "text", value: "Test" }
            ]
          }
        }
      ]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      const experimentData = mockOnSave.mock.calls[0][0]

      expect(experimentData.name).toBe("test-experiment")
      expect(experimentData.display_name).toBe("Test Experiment")
      expect(experimentData.percentage_of_traffic).toBe(50)
      expect(experimentData.state).toBe("created")
      expect(experimentData.variants).toHaveLength(2)
      expect(experimentData.custom_section_field_values).toBeDefined()
      expect(experimentData.custom_section_field_values["1"]).toEqual({
        value: "value",
        type: "text",
        id: 1
      })
    })
  })

  describe("Updating existing experiment with custom fields", () => {
    it("should preserve existing custom fields when updating", async () => {
      const existingExperiment: Partial<Experiment> = {
        id: unsafeExperimentId(1),
        name: "existing-experiment",
        state: "created",
        custom_section_field_values: [
          {
            id: 1,
            experiment_id: 1,
            experiment_custom_section_field_id: 1,
            type: "text",
            value: "Existing hypothesis",
            updated_at: "2024-01-01T00:00:00Z"
          }
        ]
      }

      const mockOnUpdate = jest.fn()
      const formData = {
        display_name: "Updated Experiment",
        percentage_of_traffic: 75,
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const mockFullExperiment = {
        ...existingExperiment,
        iteration: 1,
        variants: [],
        percentages: "50/50",
        audience: "{}",
        audience_strict: false,
        updated_at: "2024-01-01T00:00:00Z",
        custom_section_field_values: [
          {
            id: 1,
            experiment_id: 1,
            experiment_custom_section_field_id: 1,
            type: "text",
            value: "Existing hypothesis",
            updated_at: "2024-01-01T00:00:00Z",
            custom_section_field: { id: 1 }
          }
        ]
      }

      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: { experiment: mockFullExperiment }
      })

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: "__dom_changes"
        })
      )

      await act(async () => {
        await result.current.save(formData, variants, mockOnUpdate, undefined)
      })

      expect(mockOnUpdate).toHaveBeenCalled()
      const updatePayload = mockOnUpdate.mock.calls[0][1]

      expect(updatePayload.custom_section_field_values).toBeDefined()
      expect(updatePayload.custom_section_field_values["1"]).toEqual({
        experiment_id: 1,
        experiment_custom_section_field_id: 1,
        type: "text",
        value: "Existing hypothesis",
        updated_at: "2024-01-01T00:00:00Z",
        updated_by_user_id: undefined,
        custom_section_field: { id: 1 },
        id: 1,
        default_value: "Existing hypothesis"
      })
    })
  })

  describe("Update payload shape (CLI contract)", () => {
    const buildUpdateScenario = () => {
      const existingExperiment: Partial<Experiment> = {
        id: unsafeExperimentId(1),
        name: "existing-experiment",
        display_name: "Existing",
        state: "created"
      }

      const mockFullExperiment = {
        ...existingExperiment,
        iteration: 1,
        variants: [
          { variant: 0, name: "Control", config: '{"__dom_changes":[]}' },
          {
            variant: 1,
            name: "Variant A",
            config:
              '{"__dom_changes":[{"selector":".old","action":"text","value":"Old"}]}'
          }
        ],
        percentages: "50/50",
        audience: "{}",
        audience_strict: false,
        updated_at: "2024-01-01T00:00:00Z"
      }

      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: { experiment: mockFullExperiment }
      })

      const formData = {
        display_name: "Updated Experiment",
        percentage_of_traffic: 75,
        unit_type_id: 2,
        application_ids: [10, 20],
        owner_ids: [1],
        team_ids: [5],
        tag_ids: [3, 4]
      }

      return { existingExperiment, formData }
    }

    it("passes a flat Partial<ExperimentInput> — not a {id,version,data:{...}} wrapper — so the CLI merge receives the user edits", async () => {
      const { existingExperiment, formData } = buildUpdateScenario()
      const mockOnUpdate = jest.fn()

      const variants = [
        { name: "Control", config: { __dom_changes: [] } },
        {
          name: "Variant A",
          config: {
            __dom_changes: [{ selector: ".new", action: "text", value: "New" }]
          }
        }
      ]

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: "__dom_changes"
        })
      )

      await act(async () => {
        await result.current.save(formData, variants, mockOnUpdate, undefined)
      })

      expect(mockOnUpdate).toHaveBeenCalled()
      const payload = mockOnUpdate.mock.calls[0][1]

      expect(payload.data).toBeUndefined()
      expect(payload.id).toBeUndefined()
      expect(payload.version).toBeUndefined()

      expect(payload.display_name).toBe("Updated Experiment")
      expect(payload.percentage_of_traffic).toBe(75)
      expect(payload.unit_type).toEqual({ unit_type_id: 2 })
      expect(payload.owners).toEqual([{ user_id: 1 }])
      expect(payload.teams).toEqual([{ team_id: 5 }])
      expect(payload.experiment_tags).toEqual([
        { experiment_tag_id: 3 },
        { experiment_tag_id: 4 }
      ])
      expect(payload.applications).toEqual([
        { application_id: 10, application_version: "0" },
        { application_id: 20, application_version: "0" }
      ])
      expect(payload.variants).toBeDefined()
    })

    it("round-trips the user-edited __dom_changes through the payload intact", async () => {
      const { existingExperiment, formData } = buildUpdateScenario()
      const mockOnUpdate = jest.fn()

      const newDomChanges = [
        { selector: ".hero", action: "text", value: "Fresh copy" },
        { selector: ".cta", action: "style", value: "", css: { color: "red" } }
      ]
      const variants = [
        { name: "Control", config: { __dom_changes: [] } },
        { name: "Variant A", config: { __dom_changes: newDomChanges } }
      ]

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: "__dom_changes"
        })
      )

      await act(async () => {
        await result.current.save(formData, variants, mockOnUpdate, undefined)
      })

      const payload = mockOnUpdate.mock.calls[0][1]
      const variantA = payload.variants.find(
        (v: { name: string }) => v.name === "Variant A"
      )
      expect(variantA).toBeDefined()

      const parsed = JSON.parse(variantA.config)
      expect(parsed.__dom_changes).toEqual(newDomChanges)
    })

    it("preserves the original variant indices when reordering/renaming is absent", async () => {
      const { existingExperiment, formData } = buildUpdateScenario()
      const mockOnUpdate = jest.fn()

      const variants = [
        { name: "Control", config: { __dom_changes: [] } },
        { name: "Variant A", config: { __dom_changes: [] } }
      ]

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: "__dom_changes"
        })
      )

      await act(async () => {
        await result.current.save(formData, variants, mockOnUpdate, undefined)
      })

      const payload = mockOnUpdate.mock.calls[0][1]
      expect(
        payload.variants.map((v: { name: string; variant: number }) => ({
          name: v.name,
          variant: v.variant
        }))
      ).toEqual([
        { name: "Control", variant: 0 },
        { name: "Variant A", variant: 1 }
      ])
    })
  })

  describe("Granular save error messages", () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it("should show specific error message when fetching experiment fails", async () => {
      const existingExperiment: Partial<Experiment> = {
        id: unsafeExperimentId(1),
        name: "test-experiment",
        state: "created"
      }

      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: false,
        error: "Experiment not found"
      })

      const mockOnUpdate = jest.fn()
      const mockOnError = jest.fn()
      const formData = {
        display_name: "Test",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: "__dom_changes",
          onError: mockOnError
        })
      )

      await act(async () => {
        await result.current.save(formData, variants, mockOnUpdate, undefined)
      })

      expect(notifyError).toHaveBeenCalledWith(
        "Failed to load experiment: Experiment not found"
      )
      expect(mockOnError).toHaveBeenCalledWith(
        "Failed to fetch experiment data: Experiment not found"
      )
    })

    it("should show specific error message when API save fails", async () => {
      const existingExperiment: Partial<Experiment> = {
        id: unsafeExperimentId(1),
        name: "test-experiment",
        state: "created"
      }

      const mockFullExperiment = {
        id: 1,
        name: "test-experiment",
        state: "created",
        iteration: 1,
        variants: [],
        percentages: "50/50",
        audience: "{}",
        audience_strict: false,
        updated_at: "2024-01-01T00:00:00Z"
      }

      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: { experiment: mockFullExperiment }
      })

      const mockOnUpdate = jest
        .fn()
        .mockRejectedValue(new Error("Network timeout"))
      const mockOnError = jest.fn()
      const formData = {
        display_name: "Test",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: "__dom_changes",
          onError: mockOnError
        })
      )

      await act(async () => {
        try {
          await result.current.save(formData, variants, mockOnUpdate, undefined)
        } catch (error) {}
      })

      expect(notifyError).toHaveBeenCalledWith(
        "Failed to save to ABsmartly: Network timeout"
      )
      expect(mockOnError).toHaveBeenCalledWith(
        "Failed to save to ABsmartly: Network timeout"
      )
    })

    it("should show success notification when save completes", async () => {
      const existingExperiment: Partial<Experiment> = {
        id: unsafeExperimentId(1),
        name: "test-experiment",
        state: "created"
      }

      const mockFullExperiment = {
        id: 1,
        name: "test-experiment",
        state: "created",
        iteration: 1,
        variants: [],
        percentages: "50/50",
        audience: "{}",
        audience_strict: false,
        updated_at: "2024-01-01T00:00:00Z"
      }

      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: { experiment: mockFullExperiment }
      })

      const mockOnUpdate = jest.fn().mockResolvedValue(undefined)
      const formData = {
        display_name: "Test",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: "__dom_changes"
        })
      )

      await act(async () => {
        await result.current.save(formData, variants, mockOnUpdate, undefined)
      })

      expect(notifySuccess).toHaveBeenCalledWith(
        "Experiment saved successfully"
      )
      expect(mockOnUpdate).toHaveBeenCalled()
    })

    it("should show warning when custom fields fetch fails during creation", async () => {
      mockGetCustomSectionFields.mockRejectedValue(new Error("API Error"))

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: "test-experiment",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      expect(notifyWarning).toHaveBeenCalledWith(
        "Failed to fetch custom fields. Using defaults."
      )
      expect(notifySuccess).toHaveBeenCalledWith(
        "Experiment created successfully"
      )
    })

    it("should show specific error when experiment creation fails", async () => {
      mockGetCustomSectionFields.mockResolvedValue([])

      const mockOnSave = jest
        .fn()
        .mockRejectedValue(new Error("Validation failed"))
      const formData = {
        name: "test-experiment",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )

      await act(async () => {
        try {
          await result.current.save(formData, variants, undefined, mockOnSave)
        } catch (error) {}
      })

      expect(notifyError).toHaveBeenCalledWith(
        "Failed to create experiment: Validation failed"
      )
    })

    it("should track save status through each step", async () => {
      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      mockGetCustomSectionFields.mockResolvedValue([])

      const formData = {
        name: "test-experiment",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )

      expect(result.current.saveStatus.step).toBe("idle")

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      expect(result.current.saveStatus.step).toBe("complete")
    })
  })

  describe("customFieldValues from formData (FT-1905)", () => {
    it("layers formData.customFieldValues over default_value when creating", async () => {
      const mockCustomFields = [
        {
          id: 7,
          name: "hypothesis",
          title: "Hypothesis",
          type: "text" as const,
          default_value: "default hypothesis",
          required: true
        },
        {
          id: 8,
          name: "purpose",
          title: "Purpose",
          type: "string" as const,
          default_value: "default purpose",
          required: false
        }
      ]
      mockGetCustomSectionFields.mockResolvedValue(mockCustomFields)

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: "ai-test",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: [],
        customFieldValues: { hypothesis: "AI-filled hypothesis" }
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )
      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      const payload = mockOnSave.mock.calls[0][0]
      expect(payload.custom_section_field_values["7"]).toEqual({
        value: "AI-filled hypothesis",
        type: "text",
        id: 7
      })
      // The non-overridden field still gets its default
      expect(payload.custom_section_field_values["8"]).toEqual({
        value: "default purpose",
        type: "string",
        id: 8
      })
    })

    it("coerces non-string custom-field overrides to strings on create", async () => {
      const mockCustomFields = [
        {
          id: 1,
          name: "active",
          title: "Active",
          type: "boolean" as const,
          default_value: "false",
          required: false
        },
        {
          id: 2,
          name: "count",
          title: "Count",
          type: "number" as const,
          default_value: "0",
          required: false
        },
        {
          id: 3,
          name: "data",
          title: "Data",
          type: "json" as const,
          default_value: "{}",
          required: false
        }
      ]
      mockGetCustomSectionFields.mockResolvedValue(mockCustomFields)

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: "coerce-test",
        unit_type_id: 1,
        application_ids: [],
        owner_ids: [],
        team_ids: [],
        tag_ids: [],
        customFieldValues: {
          active: true,
          count: 42,
          data: { foo: "bar" }
        }
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: "__dom_changes" })
      )
      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      const payload = mockOnSave.mock.calls[0][0]
      expect(payload.custom_section_field_values["1"].value).toBe("true")
      expect(payload.custom_section_field_values["2"].value).toBe("42")
      expect(payload.custom_section_field_values["3"].value).toBe(
        '{"foo":"bar"}'
      )
    })

    it("layers formData.customFieldValues over server values when updating", async () => {
      mockGetCustomSectionFields.mockResolvedValue([
        {
          id: 7,
          name: "hypothesis",
          title: "Hypothesis",
          type: "text",
          default_value: "default",
          required: true
        }
      ])

      const existingExperiment: Partial<Experiment> = {
        id: unsafeExperimentId(1),
        name: "existing",
        state: "created"
      }

      const mockFullExperiment = {
        ...existingExperiment,
        iteration: 1,
        variants: [],
        percentages: "50/50",
        audience: "{}",
        audience_strict: false,
        custom_section_field_values: [
          {
            id: 7,
            experiment_id: 1,
            experiment_custom_section_field_id: 7,
            type: "text",
            value: "stale server value",
            updated_at: "2024-01-01T00:00:00Z",
            custom_section_field: { id: 7 }
          }
        ]
      }
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: { experiment: mockFullExperiment }
      })

      const mockOnUpdate = jest.fn()
      const formData = {
        display_name: "Updated",
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: [],
        customFieldValues: { hypothesis: "Fresh AI hypothesis" }
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: "__dom_changes"
        })
      )
      await act(async () => {
        await result.current.save(formData, variants, mockOnUpdate, undefined)
      })

      const payload = mockOnUpdate.mock.calls[0][1]
      expect(payload.custom_section_field_values["7"].value).toBe(
        "Fresh AI hypothesis"
      )
      // Other fields on the merged object are preserved
      expect(payload.custom_section_field_values["7"].type).toBe("text")
      expect(payload.custom_section_field_values["7"].id).toBe(7)
    })

    it("adds a custom field on update even when the server has none yet", async () => {
      mockGetCustomSectionFields.mockResolvedValue([
        {
          id: 9,
          name: "hypothesis",
          title: "Hypothesis",
          type: "text",
          default_value: "",
          required: true
        }
      ])

      const existingExperiment: Partial<Experiment> = {
        id: unsafeExperimentId(2),
        name: "existing-no-custom",
        state: "created"
      }

      const mockFullExperiment = {
        ...existingExperiment,
        iteration: 1,
        variants: [],
        percentages: "50/50",
        audience: "{}",
        audience_strict: false
        // No custom_section_field_values on the server.
      }
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: { experiment: mockFullExperiment }
      })

      const mockOnUpdate = jest.fn()
      const formData = {
        display_name: "Updated",
        unit_type_id: 1,
        application_ids: [],
        owner_ids: [],
        team_ids: [],
        tag_ids: [],
        customFieldValues: { hypothesis: "First hypothesis ever" }
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: "__dom_changes"
        })
      )
      await act(async () => {
        await result.current.save(formData, variants, mockOnUpdate, undefined)
      })

      const payload = mockOnUpdate.mock.calls[0][1]
      expect(payload.custom_section_field_values).toBeDefined()
      expect(payload.custom_section_field_values["9"].value).toBe(
        "First hypothesis ever"
      )
      expect(payload.custom_section_field_values["9"].type).toBe("text")
    })

    it("drops customFieldValues entries whose name has no matching workspace field on update", async () => {
      mockGetCustomSectionFields.mockResolvedValue([
        {
          id: 9,
          name: "hypothesis",
          title: "Hypothesis",
          type: "text",
          default_value: "",
          required: true
        }
      ])

      const existingExperiment: Partial<Experiment> = {
        id: unsafeExperimentId(3),
        name: "existing-stranger",
        state: "created"
      }
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          experiment: {
            ...existingExperiment,
            iteration: 1,
            variants: [],
            percentages: "50/50",
            audience: "{}",
            audience_strict: false
          }
        }
      })

      const mockOnUpdate = jest.fn()
      const formData = {
        display_name: "Updated",
        unit_type_id: 1,
        application_ids: [],
        owner_ids: [],
        team_ids: [],
        tag_ids: [],
        customFieldValues: { not_a_real_field: "ignored" }
      }
      const variants = [{ name: "Control", config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: "__dom_changes"
        })
      )
      await act(async () => {
        await result.current.save(formData, variants, mockOnUpdate, undefined)
      })

      const payload = mockOnUpdate.mock.calls[0][1]
      // No id 9 (because no override was supplied for it) and unknown name
      // never makes it into the payload.
      expect(payload.custom_section_field_values).toEqual({})
    })
  })
})
