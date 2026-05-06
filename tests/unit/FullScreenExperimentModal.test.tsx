import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
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

describe("FullScreenExperimentModal", () => {
  it("renders the form, audience editor, custom fields, and the AI fill button", () => {
    render(
      <FullScreenExperimentModal
        mode="create"
        draft={baseDraft}
        variants={[]}
        customFields={[]}
        applications={[]}
        unitTypes={[]}
        owners={[]}
        teams={[]}
        tags={[]}
        pageUrl="https://example.com"
        pageTitle="Example"
        pageVisibleText="Hello"
        variantDomChanges={[]}
        onPreviewToggle={jest.fn()}
        onPreviewWithChanges={jest.fn()}
        aiProviderConfig={{ aiProvider: "claude-subscription" }}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onDraftChange={jest.fn()}
        onVariantsChange={jest.fn()}
      />
    )

    expect(screen.getByTestId("fullscreen-modal")).toBeInTheDocument()
    expect(screen.getByTestId("audience-editor-textarea")).toBeInTheDocument()
    expect(screen.getByTestId("ai-fill-button")).toBeInTheDocument()
    expect(screen.getByTestId("fullscreen-modal-save")).toBeInTheDocument()
    expect(screen.getByTestId("fullscreen-modal-close")).toBeInTheDocument()
  })

  it("calls onClose when the close button is clicked", () => {
    const onClose = jest.fn()
    render(
      <FullScreenExperimentModal
        mode="create"
        draft={baseDraft}
        variants={[]}
        customFields={[]}
        applications={[]}
        unitTypes={[]}
        owners={[]}
        teams={[]}
        tags={[]}
        pageUrl="https://example.com"
        pageTitle="Example"
        pageVisibleText="Hello"
        variantDomChanges={[]}
        onPreviewToggle={jest.fn()}
        onPreviewWithChanges={jest.fn()}
        aiProviderConfig={{ aiProvider: "claude-subscription" }}
        onSave={jest.fn()}
        onClose={onClose}
        onDraftChange={jest.fn()}
        onVariantsChange={jest.fn()}
      />
    )
    fireEvent.click(screen.getByTestId("fullscreen-modal-close"))
    expect(onClose).toHaveBeenCalled()
  })
})
