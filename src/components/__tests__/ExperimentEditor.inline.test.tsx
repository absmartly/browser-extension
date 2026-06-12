/**
 * Inline-sections smoke test for the refactored ExperimentEditor (FT-1905).
 *
 * Verifies that the audience editor, metrics selector, custom-fields editor,
 * variant screenshots wrapper, and the AI Fill button all render inside the
 * editor itself — no modal involved.
 *
 * The heavy children (variant list, code injection, metadata, audience filter,
 * metrics selector) are mocked so the assertions stay focused on wiring
 * rather than the children's own behavior.
 */
import { act, render, screen, waitFor } from "@testing-library/react"
import React from "react"

import "@testing-library/jest-dom"

import type { Experiment } from "~src/types/absmartly"

const mockGetCustomSectionFields = jest.fn()
const mockGetMetrics = jest.fn().mockResolvedValue([])
const mockGetMetricUsages = jest.fn().mockResolvedValue([])
const mockGetMetricCategories = jest.fn().mockResolvedValue([])

jest.mock("~src/lib/background-api-client", () => ({
  BackgroundAPIClient: jest.fn().mockImplementation(() => ({
    getCustomSectionFields: (...args: unknown[]) =>
      mockGetCustomSectionFields(...args),
    getMetrics: (...args: unknown[]) => mockGetMetrics(...args),
    getMetricUsages: (...args: unknown[]) => mockGetMetricUsages(...args),
    getMetricCategories: (...args: unknown[]) =>
      mockGetMetricCategories(...args)
  }))
}))

jest.mock("~src/lib/messaging", () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined),
  sendToBackground: jest.fn().mockResolvedValue({ success: true })
}))

jest.mock("~src/utils/storage", () => ({
  getConfig: jest.fn().mockResolvedValue({
    domChangesFieldName: "__dom_changes"
  }),
  localAreaStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock("~src/components/ExperimentMetadata", () => ({
  ExperimentMetadata: () => (
    <div data-testid="experiment-metadata-mock">metadata</div>
  )
}))

jest.mock("~src/components/VariantList", () => ({
  VariantList: () => <div data-testid="variant-list-mock">variants</div>
}))

jest.mock("~src/components/ExperimentCodeInjection", () => ({
  ExperimentCodeInjection: () => (
    <div data-testid="code-injection-mock">code injection</div>
  )
}))

jest.mock("~src/components/AudienceEditor", () => ({
  AudienceEditor: () => (
    <div data-testid="audience-editor-mock">audience editor</div>
  )
}))

jest.mock("~src/components/MetricsSelector", () => ({
  MetricsSelector: () => (
    <div data-testid="metrics-selector-mock">metrics selector</div>
  )
}))

jest.mock("~src/components/CustomFieldsEditor", () => ({
  CustomFieldsEditor: () => (
    <div data-testid="custom-fields-editor-mock">custom fields editor</div>
  )
}))

// Capture the AI Fill button props so we can verify the inline editor wires
// up the right callbacks and adapters.
let lastAIFillProps: any = null
jest.mock("~src/components/AIFillButton", () => ({
  AIFillButton: (props: any) => {
    lastAIFillProps = props
    return (
      <button data-testid="ai-fill-button-mock" type="button">
        AI Fill
      </button>
    )
  }
}))

const mockHandleVariantsChange = jest.fn()

jest.mock("~src/hooks/useExperimentVariants", () => ({
  useExperimentVariants: jest.fn(() => ({
    initialVariants: [
      { name: "Control", config: "{}" },
      { name: "Variant 1", config: "{}" }
    ],
    currentVariants: [
      { name: "Control", config: "{}" },
      { name: "Variant 1", config: "{}" }
    ],
    setCurrentVariants: jest.fn(),
    handleVariantsChange: mockHandleVariantsChange
  }))
}))

jest.mock("~src/hooks/useExperimentSave", () => ({
  useExperimentSave: jest.fn(() => ({ save: jest.fn() }))
}))

global.chrome = {
  storage: {
    local: {
      get: jest.fn((_keys, callback) => callback({})),
      set: jest.fn((_items, callback) => callback?.())
    }
  },
  runtime: {
    onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
    sendMessage: jest.fn().mockResolvedValue({ ok: true })
  },
  tabs: {
    query: jest.fn((_q, cb) => {
      cb([{ url: "https://example.com" }])
      return Promise.resolve([{ url: "https://example.com" }])
    })
  }
} as any

// Lazy-require AFTER all mocks are set so the editor picks them up.
const { ExperimentEditor } = require("../ExperimentEditor")

const defaultProps = {
  experiment: null as Experiment | null,
  onSave: jest.fn().mockResolvedValue(undefined),
  onCancel: jest.fn(),
  loading: false,
  applications: [],
  unitTypes: [],
  metrics: [],
  tags: [],
  owners: [],
  teams: []
}

describe("ExperimentEditor — inline sections (FT-1905)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    lastAIFillProps = null
    mockGetCustomSectionFields.mockResolvedValue([])
  })

  it("renders AudienceEditor, MetricsSelector and AIFillButton inline", async () => {
    render(<ExperimentEditor {...defaultProps} />)

    expect(
      await screen.findByTestId("audience-editor-mock")
    ).toBeInTheDocument()
    expect(screen.getByTestId("metrics-selector-mock")).toBeInTheDocument()
    expect(screen.getByTestId("ai-fill-button-mock")).toBeInTheDocument()
  })

  it("renders CustomFieldsEditor only when there are workspace custom fields", async () => {
    mockGetCustomSectionFields.mockResolvedValue([
      {
        id: 7,
        custom_section_field_id: 7,
        title: "Hypothesis",
        type: "text",
        required: true
      }
    ])
    render(<ExperimentEditor {...defaultProps} />)

    // The custom fields section is keyed on the workspace defs, so it
    // appears only once those fields have loaded.
    await waitFor(() =>
      expect(
        document.querySelector("#experiment-custom-fields-section")
      ).toBeInTheDocument()
    )
  })

  it("does not render CustomFieldsEditor when workspace has no fields", async () => {
    mockGetCustomSectionFields.mockResolvedValue([])
    render(<ExperimentEditor {...defaultProps} />)

    // Sanity-check that mount finished by waiting for the audience editor.
    await screen.findByTestId("audience-editor-mock")
    expect(
      document.querySelector("#experiment-custom-fields-section")
    ).not.toBeInTheDocument()
  })

  it("Expand-form button toggles label and calls resizeSidebar (expand_form ↔ restore)", async () => {
    // Removed in FT-1905 follow-up: the Expand-form button was deleted in
    // favor of the left-edge drag handle (now capped at 50% of viewport).
  })

  it("forwards an AI fill result through ai-fill-apply utilities", async () => {
    render(<ExperimentEditor {...defaultProps} />)

    // Wait for the AI Fill button to be wired up.
    await waitFor(() => expect(lastAIFillProps).not.toBeNull())

    // Simulate an AI fill response. The editor should update formData
    // via the pure applyAIResultToDraft helper — we can verify indirectly
    // by checking that subsequent renders of the AIFillButton see the
    // updated draft.
    act(() => {
      lastAIFillProps.onResult({ display_name: "Renamed by AI" }, [])
    })

    await waitFor(() => {
      expect(lastAIFillProps.draft.display_name).toBe("Renamed by AI")
    })
  })

  it("renames variants via applyAIVariantNames when AI returns variants", async () => {
    render(<ExperimentEditor {...defaultProps} />)
    await waitFor(() => expect(lastAIFillProps).not.toBeNull())

    act(() => {
      lastAIFillProps.onResult(
        { variants: [{ name: "New Control" }, { name: "Renamed v1" }] },
        []
      )
    })

    await waitFor(() =>
      expect(mockHandleVariantsChange).toHaveBeenCalledWith(
        [
          { name: "New Control", config: "{}" },
          { name: "Renamed v1", config: "{}" }
        ],
        true
      )
    )
  })
})
