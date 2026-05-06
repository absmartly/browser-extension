import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { ExperimentEditor } from "~src/components/ExperimentEditor"
import { openFullScreenModal } from "~src/components/fullscreen/openFullScreenModal"

jest.mock("~src/components/fullscreen/openFullScreenModal")

jest.mock("~src/lib/messaging", () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined),
  sendToBackground: jest.fn().mockResolvedValue({ success: true })
}))

jest.mock("~src/utils/storage", () => ({
  getConfig: jest.fn().mockResolvedValue({
    domChangesFieldName: "__dom_changes",
    htmlInjectionEnabled: true
  }),
  localAreaStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  },
  sessionStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock("~src/hooks/useEditorStateRestoration", () => ({
  useEditorStateRestoration: jest.fn(() => ({
    isRestoring: false,
    restoredVariant: null,
    restoredChange: null,
    clearRestoration: jest.fn()
  }))
}))

jest.mock("~src/components/VariantList", () => ({
  VariantList: () => <div data-testid="variant-list" />
}))

jest.mock("~src/components/ExperimentMetadata", () => ({
  ExperimentMetadata: () => <div data-testid="experiment-metadata" />
}))

jest.mock("~src/components/ExperimentCodeInjection", () => ({
  ExperimentCodeInjection: () => <div data-testid="code-injection" />
}))

jest.mock("~src/hooks/useExperimentSave", () => ({
  useExperimentSave: () => ({ save: jest.fn() })
}))
jest.mock("~src/hooks/useExperimentVariants", () => ({
  useExperimentVariants: () => ({
    initialVariants: [],
    currentVariants: [
      { name: "Control", config: "{}" },
      { name: "Variant 1", config: "{}" }
    ],
    setCurrentVariants: jest.fn(),
    handleVariantsChange: jest.fn()
  })
}))

describe("ExperimentEditor full-screen button", () => {
  it("renders an Open in full screen button", () => {
    render(
      <ExperimentEditor
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    )
    expect(screen.getByTestId("open-fullscreen-button")).toBeInTheDocument()
  })

  it("opens the modal with the current draft and merges the result on close", async () => {
    ;(openFullScreenModal as jest.Mock).mockResolvedValue({
      draft: {
        display_name: "Updated From Modal",
        name: "updated_from_modal"
      }
    })

    render(
      <ExperimentEditor
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId("open-fullscreen-button"))
    })

    expect(openFullScreenModal).toHaveBeenCalled()
    expect(
      (screen.getByTestId("display-name-input") as HTMLInputElement).value
    ).toBe("Updated From Modal")
    expect(
      (screen.getByTestId("experiment-name-input") as HTMLInputElement).value
    ).toBe("updated_from_modal")
  })
})
