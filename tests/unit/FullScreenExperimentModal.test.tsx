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
jest.mock("~src/components/MetricsSelector", () => ({
  MetricsSelector: (props: any) => (
    <div data-testid="metrics-selector-mock">
      primary={String(props.primaryMetricId)} secondary={JSON.stringify(props.secondaryMetricIds)}
    </div>
  )
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
  primary_metric_id: null,
  secondary_metric_ids: [],
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
    metrics: [],
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
    // The visual audience filter editor renders by default; the raw textarea
    // is only mounted when the user toggles Advanced.
    expect(screen.getByTestId("audience-filter-editor")).toBeInTheDocument()
    expect(screen.getByTestId("ai-fill-button")).toBeInTheDocument()
    expect(screen.getByTestId("fullscreen-modal-save")).toBeInTheDocument()
    expect(screen.getByTestId("fullscreen-modal-close")).toBeInTheDocument()
  })

  it("calls onSave when the X close button is clicked (FT-1905: X preserves draft)", () => {
    const onSave = jest.fn()
    const onClose = jest.fn()
    renderModal({ onSave, onClose })
    fireEvent.click(screen.getByTestId("fullscreen-modal-close"))
    // X is wired to onSave (close-with-save) so typed values survive.
    expect(onSave).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("Discard button calls onClose only after window.confirm() approves", () => {
    const onClose = jest.fn()
    const onSave = jest.fn()
    const confirmSpy = jest
      .spyOn(window, "confirm")
      .mockImplementationOnce(() => false)
      .mockImplementationOnce(() => true)

    try {
      renderModal({ onClose, onSave })
      // First click: user cancels the confirm → nothing happens.
      fireEvent.click(screen.getByTestId("fullscreen-modal-discard"))
      expect(onClose).not.toHaveBeenCalled()
      // Second click: user confirms → onClose fires (which discards in parent).
      fireEvent.click(screen.getByTestId("fullscreen-modal-discard"))
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onSave).not.toHaveBeenCalled()
      expect(confirmSpy).toHaveBeenCalledTimes(2)
    } finally {
      confirmSpy.mockRestore()
    }
  })

  describe("display_name ↔ name lock+sync", () => {
    it("auto-syncs display_name → snake_case name when locked (create mode)", () => {
      const onDraftChange = jest.fn()
      renderModal({
        mode: "create",
        draft: { ...baseDraft, display_name: "", name: "" },
        onDraftChange
      })
      const display = screen.getByTestId("fs-display-name-input")
      fireEvent.change(display, { target: { value: "My Cool Test" } })
      const last = onDraftChange.mock.calls.at(-1)![0]
      expect(last.display_name).toBe("My Cool Test")
      expect(last.name).toBe("my_cool_test")
    })

    it("auto-syncs name → Title Case display_name when locked", () => {
      const onDraftChange = jest.fn()
      renderModal({ mode: "create", onDraftChange })
      const nameInput = screen.getByTestId("fs-experiment-name-input")
      fireEvent.change(nameInput, { target: { value: "checkout_promo_v2" } })
      const last = onDraftChange.mock.calls.at(-1)![0]
      expect(last.name).toBe("checkout_promo_v2")
      expect(last.display_name).toBe("Checkout Promo V2")
    })

    it("stops syncing once the lock is toggled off", () => {
      const onDraftChange = jest.fn()
      renderModal({ mode: "create", onDraftChange })
      // Click the lock to unsync.
      fireEvent.click(screen.getByTestId("fs-names-sync-lock"))
      fireEvent.change(screen.getByTestId("fs-display-name-input"), {
        target: { value: "Independent Display" }
      })
      const last = onDraftChange.mock.calls.at(-1)![0]
      expect(last.display_name).toBe("Independent Display")
      // name field was not auto-updated.
      expect(last.name).toBe(baseDraft.name)
    })

    it("starts unsynced for existing experiments (edit mode)", () => {
      const onDraftChange = jest.fn()
      renderModal({ mode: "edit", onDraftChange })
      fireEvent.change(screen.getByTestId("fs-display-name-input"), {
        target: { value: "Renamed Just The Display" }
      })
      const last = onDraftChange.mock.calls.at(-1)![0]
      expect(last.display_name).toBe("Renamed Just The Display")
      expect(last.name).toBe(baseDraft.name)
    })
  })

  describe("applyAIResultToDraft (via AIFillButton.onResult)", () => {
    it("merges AI custom_fields into customFieldValues keyed by id", () => {
      const onDraftChange = jest.fn()
      renderModal({
        onDraftChange,
        customFields: [
          {
            id: 7,
            custom_section_field_id: 7,
            title: "Hypothesis",
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
              { field_id: 7, value: "Bigger CTAs help conversion" }
            ]
          },
          []
        )
      })

      expect(onDraftChange).toHaveBeenCalled()
      const next = onDraftChange.mock.calls[0][0]
      expect(next.customFieldValues).toEqual({
        "7": "Bigger CTAs help conversion"
      })
    })

    it("ignores AI custom_fields whose id is not in the workspace defs", () => {
      const onDraftChange = jest.fn()
      renderModal({
        onDraftChange,
        customFields: [
          {
            id: 7,
            custom_section_field_id: 7,
            title: "Hypothesis",
            type: "text",
            required: true
          }
        ]
      })

      act(() => {
        capturedOnResult!(
          {
            custom_fields: [
              { field_id: 999, value: "should be dropped" }
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

    it("maps AI primary_metrics name to primary_metric_id and drops unknown names", () => {
      const onDraftChange = jest.fn()
      renderModal({
        onDraftChange,
        metrics: [
          { metric_id: 11, name: "Conversion Rate" },
          { metric_id: 22, name: "Revenue per User" }
        ] as any
      })

      act(() => {
        capturedOnResult!(
          { primary_metrics: ["Unknown", "Conversion Rate"] },
          []
        )
      })

      const next = onDraftChange.mock.calls[0][0]
      expect(next.primary_metric_id).toBe(11)
    })

    it("maps AI secondary_metrics names to secondary_metric_ids and dedupes primary", () => {
      const onDraftChange = jest.fn()
      renderModal({
        onDraftChange,
        metrics: [
          { metric_id: 11, name: "Conversion Rate" },
          { metric_id: 22, name: "Revenue per User" },
          { metric_id: 33, name: "Bounce Rate" }
        ] as any
      })

      act(() => {
        capturedOnResult!(
          {
            primary_metrics: ["Conversion Rate"],
            secondary_metrics: [
              "Revenue per User",
              "Conversion Rate", // duplicate of primary → dropped
              "Bounce Rate",
              "Unknown"
            ]
          },
          []
        )
      })

      const next = onDraftChange.mock.calls[0][0]
      expect(next.primary_metric_id).toBe(11)
      expect(next.secondary_metric_ids).toEqual([22, 33])
    })
  })

  describe("applyAIVariantNames (via AIFillButton.onResult)", () => {
    it("calls onVariantsChange with AI-renamed variants when result.variants is present", () => {
      const onVariantsChange = jest.fn()
      renderModal({
        onVariantsChange,
        variants: [
          { name: "Control", config: "{}" },
          { name: "Variant 1", config: "{}" }
        ] as any
      })

      act(() => {
        capturedOnResult!(
          {
            display_name: "X",
            variants: [{ name: "Original" }, { name: "New CTA Copy" }]
          },
          []
        )
      })

      expect(onVariantsChange).toHaveBeenCalledWith(
        [
          { name: "Original", config: "{}" },
          { name: "New CTA Copy", config: "{}" }
        ],
        true
      )
    })

    it("keeps extras when the AI returns fewer variants than exist", () => {
      const onVariantsChange = jest.fn()
      renderModal({
        onVariantsChange,
        variants: [
          { name: "Control", config: "{}" },
          { name: "Variant 1", config: "{}" },
          { name: "Variant 2", config: "{}" }
        ] as any
      })

      act(() => {
        capturedOnResult!(
          { variants: [{ name: "Original" }] },
          []
        )
      })

      expect(onVariantsChange).toHaveBeenCalledWith(
        [
          { name: "Original", config: "{}" },
          { name: "Variant 1", config: "{}" },
          { name: "Variant 2", config: "{}" }
        ],
        true
      )
    })

    it("ignores extras when the AI returns more variants than exist (count is user-controlled)", () => {
      const onVariantsChange = jest.fn()
      renderModal({
        onVariantsChange,
        variants: [
          { name: "Control", config: "{}" },
          { name: "Variant 1", config: "{}" }
        ] as any
      })

      act(() => {
        capturedOnResult!(
          {
            variants: [
              { name: "Original" },
              { name: "New CTA Copy" },
              { name: "Bonus Variant" }
            ]
          },
          []
        )
      })

      expect(onVariantsChange).toHaveBeenCalledWith(
        [
          { name: "Original", config: "{}" },
          { name: "New CTA Copy", config: "{}" }
        ],
        true
      )
    })

    it("leaves existing names in place when AI provides empty / missing / non-string names", () => {
      const onVariantsChange = jest.fn()
      renderModal({
        onVariantsChange,
        variants: [
          { name: "Control", config: "{}" },
          { name: "Variant 1", config: "{}" },
          { name: "Variant 2", config: "{}" }
        ] as any
      })

      act(() => {
        capturedOnResult!(
          {
            variants: [
              { name: "" },
              { description: "no name field" } as any,
              { name: "Real Rename" }
            ]
          },
          []
        )
      })

      expect(onVariantsChange).toHaveBeenCalledWith(
        [
          { name: "Control", config: "{}" },
          { name: "Variant 1", config: "{}" },
          { name: "Real Rename", config: "{}" }
        ],
        true
      )
    })

    it("does not call onVariantsChange when AI returns no variants", () => {
      const onVariantsChange = jest.fn()
      renderModal({
        onVariantsChange,
        variants: [
          { name: "Control", config: "{}" },
          { name: "Variant 1", config: "{}" }
        ] as any
      })

      act(() => {
        capturedOnResult!({ display_name: "Just a rename" }, [])
      })

      expect(onVariantsChange).not.toHaveBeenCalled()
    })

    it("does not call onVariantsChange when AI variant names match existing names", () => {
      const onVariantsChange = jest.fn()
      renderModal({
        onVariantsChange,
        variants: [
          { name: "Control", config: "{}" },
          { name: "Variant 1", config: "{}" }
        ] as any
      })

      act(() => {
        capturedOnResult!(
          {
            variants: [{ name: "Control" }, { name: "Variant 1" }]
          },
          []
        )
      })

      expect(onVariantsChange).not.toHaveBeenCalled()
    })
  })
})

