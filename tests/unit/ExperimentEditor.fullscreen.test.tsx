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

// chrome.runtime.sendMessage is invoked by BackgroundAPIClient.resizeSidebar
// (FT-1905) — the editor sends ABSMARTLY_SIDEBAR_RESIZE before opening the
// modal and again on close to grow/shrink the sidebar iframe.
const sendMessageMock = jest.fn(async (message: { type?: string }) => {
  if (message?.type === "ABSMARTLY_SIDEBAR_RESIZE") {
    return { ok: true }
  }
  // ExperimentEditor's mount effect also fires API_OPERATION calls via the
  // BackgroundAPIClient. Return a generic success shape so those don't blow
  // up the editor render.
  return { success: true, data: [] }
})

const resizeCalls = (): string[] =>
  sendMessageMock.mock.calls
    .map((c) => c[0] as { type?: string; mode?: string })
    .filter((msg) => msg?.type === "ABSMARTLY_SIDEBAR_RESIZE")
    .map((msg) => msg.mode || "")

beforeAll(() => {
  const existingChrome = (globalThis as any).chrome || {}
  ;(globalThis as any).chrome = {
    ...existingChrome,
    runtime: {
      ...(existingChrome.runtime || {}),
      sendMessage: sendMessageMock
    }
  }
})

describe("ExperimentEditor full-screen button", () => {
  beforeEach(() => {
    mockHandleVariantsChange.mockClear()
    capturedModalProps.current = null
    sendMessageMock.mockClear()
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

  it("sends fullscreen-then-restore sidebar resize messages around the modal", async () => {
    ;(openFullScreenModal as jest.Mock).mockImplementation(async () => {
      // At the moment the modal "would be open" we should already have
      // exactly one resize call (fullscreen) — the restore happens after
      // this promise resolves.
      expect(resizeCalls()).toEqual(["fullscreen"])
      return undefined
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

    expect(resizeCalls()).toEqual(["fullscreen", "restore"])
  })

  it("still restores the sidebar when the modal flow throws", async () => {
    ;(openFullScreenModal as jest.Mock).mockImplementation(async () => {
      throw new Error("boom")
    })

    render(
      <ExperimentEditor
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId("open-fullscreen-button"))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(resizeCalls()).toEqual(["fullscreen", "restore"])
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
