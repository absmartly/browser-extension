import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { FullScreenExperimentModal } from "~src/components/FullScreenExperimentModal"

jest.mock("~src/components/ExperimentMetadata", () => ({
  ExperimentMetadata: () => <div data-testid="metadata-mock" />
}))
jest.mock("~src/components/VariantList", () => ({
  VariantList: () => <div data-testid="variants-mock" />
}))
jest.mock("~src/components/ExperimentCodeInjection", () => ({
  ExperimentCodeInjection: () => <div data-testid="code-injection-mock" />
}))

// Capture the most recent onResult callback so tests can drive it directly.
let capturedOnResult:
  | ((result: unknown, screenshots: unknown[]) => void)
  | null = null
jest.mock("~src/components/AIFillButton", () => ({
  AIFillButton: (props: any) => {
    capturedOnResult = props.onResult
    return <button data-testid="ai-fill-button" />
  }
}))

const baseDraft = {
  name: "my_test",
  display_name: "My Test",
  state: "created" as const,
  percentage_of_traffic: 100,
  nr_variants: 2,
  percentages: "50/50",
  audience_strict: false,
  audience: '{"filter":[{"and":[]}]}',
  unit_type_id: 1,
  application_ids: [],
  owner_ids: [],
  team_ids: [],
  tag_ids: [],
  customFieldValues: {}
}

const renderModal = (overrides: Partial<React.ComponentProps<typeof FullScreenExperimentModal>> = {}) => {
  const props: React.ComponentProps<typeof FullScreenExperimentModal> = {
    mode: "create",
    draft: baseDraft,
    variants: [],
    customFields: [],
    applications: [],
    unitTypes: [],
    owners: [],
    teams: [],
    tags: [],
    pageUrl: "https://example.com",
    pageTitle: "Example",
    pageVisibleText: "Hello",
    variantDomChanges: [],
    onPreviewToggle: jest.fn(),
    onPreviewWithChanges: jest.fn(),
    aiProviderConfig: { aiProvider: "claude-subscription" },
    onSave: jest.fn(),
    onClose: jest.fn(),
    onDraftChange: jest.fn(),
    onVariantsChange: jest.fn(),
    ...overrides
  }
  render(<FullScreenExperimentModal {...props} />)
  return props
}

describe("FullScreenExperimentModal", () => {
  beforeEach(() => {
    capturedOnResult = null
  })

  it("renders the form, audience editor, custom fields, and the AI fill button", () => {
    renderModal()

    expect(screen.getByTestId("fullscreen-modal")).toBeInTheDocument()
    expect(screen.getByTestId("audience-editor-textarea")).toBeInTheDocument()
    expect(screen.getByTestId("ai-fill-button")).toBeInTheDocument()
    expect(screen.getByTestId("fullscreen-modal-save")).toBeInTheDocument()
    expect(screen.getByTestId("fullscreen-modal-close")).toBeInTheDocument()
  })

  it("calls onClose when the close button is clicked", () => {
    const onClose = jest.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByTestId("fullscreen-modal-close"))
    expect(onClose).toHaveBeenCalled()
  })

  describe("applyAIResultToDraft (via AIFillButton.onResult)", () => {
    it("merges AI custom_fields into customFieldValues by name", () => {
      const onDraftChange = jest.fn()
      renderModal({
        onDraftChange,
        customFields: [
          {
            id: 7,
            custom_section_field_id: 7,
            name: "hypothesis",
            type: "text",
            required: true
          }
        ]
      })

      expect(capturedOnResult).not.toBeNull()
      act(() => {
        capturedOnResult!(
          {
            custom_fields: [
              { field_name: "hypothesis", value: "Bigger CTAs help conversion" }
            ]
          },
          []
        )
      })

      expect(onDraftChange).toHaveBeenCalled()
      const next = onDraftChange.mock.calls[0][0]
      expect(next.customFieldValues).toEqual({
        hypothesis: "Bigger CTAs help conversion"
      })
    })

    it("ignores AI custom_fields whose name is not in the workspace defs", () => {
      const onDraftChange = jest.fn()
      renderModal({
        onDraftChange,
        customFields: [
          {
            id: 7,
            custom_section_field_id: 7,
            name: "hypothesis",
            type: "text",
            required: true
          }
        ]
      })

      act(() => {
        capturedOnResult!(
          {
            custom_fields: [
              { field_name: "unknown_field", value: "should be dropped" }
            ]
          },
          []
        )
      })

      const next = onDraftChange.mock.calls[0][0]
      expect(next.customFieldValues).toEqual({})
    })

    it("maps AI applications by name to application_ids", () => {
      const onDraftChange = jest.fn()
      renderModal({
        onDraftChange,
        applications: [
          { application_id: 11, name: "Web" },
          { application_id: 22, name: "iOS" },
          { application_id: 33, name: "Android" }
        ] as any
      })

      act(() => {
        capturedOnResult!(
          { applications: ["Web", "Android", "MysteryPlatform"] },
          []
        )
      })

      const next = onDraftChange.mock.calls[0][0]
      expect(next.application_ids).toEqual([11, 33])
    })

    it("maps AI tags by name to tag_ids and drops unknown names", () => {
      const onDraftChange = jest.fn()
      renderModal({
        onDraftChange,
        tags: [
          { experiment_tag_id: 100, name: "checkout" },
          { experiment_tag_id: 200, name: "mobile" }
        ] as any
      })

      act(() => {
        capturedOnResult!({ tags: ["checkout", "ghost-tag", "mobile"] }, [])
      })

      const next = onDraftChange.mock.calls[0][0]
      expect(next.tag_ids).toEqual([100, 200])
    })

    it("does not stomp existing application_ids when AI returns no applications", () => {
      const onDraftChange = jest.fn()
      renderModal({
        onDraftChange,
        draft: { ...baseDraft, application_ids: [42] },
        applications: [{ application_id: 11, name: "Web" }] as any
      })

      act(() => {
        capturedOnResult!({ display_name: "Just a rename" }, [])
      })

      const next = onDraftChange.mock.calls[0][0]
      expect(next.application_ids).toEqual([42])
    })
  })
})

