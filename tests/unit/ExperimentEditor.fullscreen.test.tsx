import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"
import React from "react"

import { ExperimentEditor } from "~src/components/ExperimentEditor"
import { openFullScreenModal } from "~src/components/fullscreen/openFullScreenModal"

jest.mock("~src/components/fullscreen/openFullScreenModal")

const capturedModalProps: { current: any } = { current: null }

jest.mock("~src/components/FullScreenExperimentModal", () => ({
  FullScreenExperimentModal: (props: {
    aiProviderConfig?: unknown
    onVariantsChange: (variants: { name: string; config: string }[]) => void
  }) => {
    capturedModalProps.current = props
    return (
      <button
        data-testid="mock-modal-trigger-variants-change"
        onClick={() =>
          props.onVariantsChange([{ name: "X", config: "{}" }])
        }>
        change variants
      </button>
    )
  }
}))

jest.mock("~src/lib/messaging", () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined),
  sendToBackground: jest.fn().mockResolvedValue({ success: true })
}))

const mockGetConfig = jest.fn().mockResolvedValue({
  domChangesFieldName: "__dom_changes",
  htmlInjectionEnabled: true
})

jest.mock("~src/utils/storage", () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
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

const mockHandleVariantsChange = jest.fn()
jest.mock("~src/hooks/useExperimentVariants", () => ({
  useExperimentVariants: () => ({
    initialVariants: [],
    currentVariants: [
      { name: "Control", config: "{}" },
      { name: "Variant 1", config: "{}" }
    ],
    setCurrentVariants: jest.fn(),
    handleVariantsChange: mockHandleVariantsChange
  })
}))

describe("ExperimentEditor full-screen button", () => {
  beforeEach(() => {
    mockHandleVariantsChange.mockClear()
    capturedModalProps.current = null
    mockGetConfig.mockReset()
    mockGetConfig.mockResolvedValue({
      domChangesFieldName: "__dom_changes",
      htmlInjectionEnabled: true
    })
  })

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
    let capturedRender:
      | ((args: { close: (val?: unknown) => void }) => React.ReactElement)
      | null = null
    ;(openFullScreenModal as jest.Mock).mockImplementation(
      async ({
        render: renderFn
      }: {
        render: (args: {
          close: (val?: unknown) => void
        }) => React.ReactElement
      }) => {
        capturedRender = renderFn
        return {
          draft: {
            display_name: "Updated From Modal",
            name: "updated_from_modal"
          }
        }
      }
    )

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

    // Render the modal (via captured render arg) and simulate it triggering
    // onVariantsChange. This verifies modal-side variant changes route
    // through the React state setter (handleVariantsChange) instead of being
    // applied via in-place mutation.
    expect(capturedRender).not.toBeNull()
    const modalElement = (
      capturedRender as unknown as (args: {
        close: (val?: unknown) => void
      }) => React.ReactElement
    )({ close: jest.fn() })
    render(modalElement)
    await act(async () => {
      fireEvent.click(
        screen.getByTestId("mock-modal-trigger-variants-change")
      )
    })
    expect(mockHandleVariantsChange).toHaveBeenCalledWith(
      [{ name: "X", config: "{}" }],
      true
    )
  })

  it("passes aiProviderConfig from user settings to the modal", async () => {
    mockGetConfig.mockResolvedValue({
      domChangesFieldName: "__dom_changes",
      aiProvider: "anthropic-api",
      aiApiKey: "sk-xxx",
      llmModel: "claude-sonnet",
      providerEndpoints: { "anthropic-api": "https://custom" }
    })

    let capturedRender:
      | ((args: { close: (val?: unknown) => void }) => React.ReactElement)
      | null = null
    ;(openFullScreenModal as jest.Mock).mockImplementation(
      async ({
        render: renderFn
      }: {
        render: (args: {
          close: (val?: unknown) => void
        }) => React.ReactElement
      }) => {
        capturedRender = renderFn
        return undefined
      }
    )

    render(
      <ExperimentEditor
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    )

    // Let the storage-loading effect resolve before opening the modal.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId("open-fullscreen-button"))
    })

    expect(openFullScreenModal).toHaveBeenCalled()
    expect(capturedRender).not.toBeNull()

    const modalElement = (
      capturedRender as unknown as (args: {
        close: (val?: unknown) => void
      }) => React.ReactElement
    )({ close: jest.fn() })
    render(modalElement)

    expect(capturedModalProps.current).not.toBeNull()
    expect(capturedModalProps.current.aiProviderConfig).toEqual({
      aiProvider: "anthropic-api",
      apiKey: "sk-xxx",
      llmModel: "claude-sonnet",
      customEndpoint: "https://custom"
    })
  })

  it("falls back to claude-subscription when no AI provider is configured", async () => {
    let capturedRender:
      | ((args: { close: (val?: unknown) => void }) => React.ReactElement)
      | null = null
    ;(openFullScreenModal as jest.Mock).mockImplementation(
      async ({
        render: renderFn
      }: {
        render: (args: {
          close: (val?: unknown) => void
        }) => React.ReactElement
      }) => {
        capturedRender = renderFn
        return undefined
      }
    )

    render(
      <ExperimentEditor
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId("open-fullscreen-button"))
    })

    expect(capturedRender).not.toBeNull()
    const modalElement = (
      capturedRender as unknown as (args: {
        close: (val?: unknown) => void
      }) => React.ReactElement
    )({ close: jest.fn() })
    render(modalElement)

    expect(capturedModalProps.current).not.toBeNull()
    expect(capturedModalProps.current.aiProviderConfig).toEqual({
      aiProvider: "claude-subscription",
      apiKey: undefined,
      llmModel: undefined,
      customEndpoint: undefined
    })
  })
})
