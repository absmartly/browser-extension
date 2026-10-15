import { act, renderHook } from "@testing-library/react"

import { routeAPIOperation } from "~background/core/api-operations"
import { BackgroundAPIClient } from "~src/lib/background-api-client"
import type { Experiment } from "~src/types/absmartly"
import { unsafeExperimentId } from "~src/types/branded"

import { useExperimentHandlers } from "../useExperimentHandlers"

jest.mock("~src/utils/storage-cleanup", () => ({
  clearAllExperimentStorage: jest.fn().mockResolvedValue(undefined)
}))

jest.mock("~src/utils/debug", () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

// The shared CLI mock makes ExperimentId an identity function, which hides the
// "Invalid ExperimentId: 0" rejection users hit. Use the real validator so the
// save flow is checked against the production API boundary.
jest.mock("@absmartly/cli/api-client", () => ({
  ExperimentId: jest.requireActual(
    "../../../node_modules/@absmartly/cli/dist/api-client/types.js"
  ).ExperimentId
}))

describe("experiment save error propagation", () => {
  it("rejects a failed create without navigating or announcing success", async () => {
    const failure = new Error("Test-owned create rejected")
    const props = {
      getExperiment: jest.fn(),
      startExperiment: jest.fn(),
      stopExperiment: jest.fn(),
      createExperiment: jest.fn().mockRejectedValue(failure),
      updateExperiment: jest.fn(),
      loadExperiments: jest.fn(),
      onAuthExpired: jest.fn(),
      onError: jest.fn(),
      onSuccess: jest.fn(),
      setView: jest.fn(),
      pageSize: 20
    }
    const { result } = renderHook(() => useExperimentHandlers(props))

    await act(async () => {
      await expect(
        result.current.handleSaveExperiment({ name: "test_owned_draft" })
      ).rejects.toBe(failure)
    })
    expect(props.onError).toHaveBeenCalledWith(failure.message)
    expect(props.onSuccess).not.toHaveBeenCalled()
    expect(props.setView).not.toHaveBeenCalled()
    expect(props.loadExperiments).not.toHaveBeenCalled()
  })
})

describe("experiment save routing through the background API", () => {
  const TEMPLATE_ID = 77
  const CREATED_ID = 501
  const EXISTING_ID = 42

  const template = {
    id: unsafeExperimentId(TEMPLATE_ID),
    name: "checkout_template",
    display_name: "Checkout template",
    state: "created",
    percentage_of_traffic: 80,
    unit_type: { unit_type_id: 3 },
    variants: [
      { variant: 0, name: "Control", config: "{}" },
      { variant: 1, name: "Treatment", config: '{"color":"red"}' }
    ]
  } as unknown as Experiment

  const existing = {
    id: unsafeExperimentId(EXISTING_ID),
    name: "existing_experiment",
    display_name: "Existing experiment",
    state: "created"
  } as unknown as Experiment

  // Stands in for the CLI APIClient used by the service worker.
  let cliClient: {
    getExperiment: jest.Mock
    createExperiment: jest.Mock
    updateExperiment: jest.Mock
  }
  let originalRuntime: unknown

  const setup = () => {
    // Mirrors the API_OPERATION handler in background/main.ts.
    const sendMessage = jest.fn(async (message: any) => {
      try {
        const data = await routeAPIOperation(
          cliClient as any,
          message.operation
        )
        return { success: true, data }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          isAuthError: false
        }
      }
    })
    ;(global as any).chrome.runtime = { sendMessage }

    // Same delegation as useABsmartly.
    const api = new BackgroundAPIClient()
    const props = {
      getExperiment: (id: number) => api.getExperiment(id),
      startExperiment: jest.fn(),
      stopExperiment: jest.fn(),
      createExperiment: (data: Partial<Experiment>) =>
        api.createExperiment(data as any),
      updateExperiment: (id: number, data: Partial<Experiment>) =>
        api.updateExperiment(id, data as any),
      loadExperiments: jest.fn(),
      onAuthExpired: jest.fn(),
      onError: jest.fn(),
      onSuccess: jest.fn(),
      setView: jest.fn(),
      pageSize: 20
    }
    const hook = renderHook(() => useExperimentHandlers(props))
    return { ...hook, props }
  }

  const draftPayload = {
    name: "new_from_template",
    display_name: "New from template",
    percentage_of_traffic: 80,
    unit_type: { unit_type_id: 3 }
  } as Partial<Experiment>

  beforeEach(() => {
    originalRuntime = (global as any).chrome.runtime
    cliClient = {
      getExperiment: jest.fn().mockResolvedValue(template),
      createExperiment: jest
        .fn()
        .mockImplementation(async (data) => ({ ...data, id: CREATED_ID })),
      updateExperiment: jest
        .fn()
        .mockImplementation(async (id, data) => ({ ...data, id }))
    }
  })

  afterEach(() => {
    ;(global as any).chrome.runtime = originalRuntime
  })

  it("rejects non-persisted ids at the API boundary", async () => {
    await expect(
      routeAPIOperation(cliClient as any, {
        op: "updateExperiment",
        id: 0,
        data: {}
      })
    ).rejects.toThrow("Invalid ExperimentId: 0 must be a positive integer")
    expect(cliClient.updateExperiment).not.toHaveBeenCalled()
  })

  it("creates a new experiment when saving a draft loaded from a template", async () => {
    const { result, props } = setup()

    await act(async () => {
      await result.current.handleCreateFromTemplate(TEMPLATE_ID)
    })

    expect(cliClient.getExperiment).toHaveBeenCalledWith(TEMPLATE_ID)
    expect(props.setView).toHaveBeenCalledWith("create")
    // The editor is seeded from the template, minus its identity.
    expect(result.current.selectedExperiment).toMatchObject({
      name: "",
      display_name: "",
      percentage_of_traffic: 80,
      unit_type: { unit_type_id: 3 },
      variants: template.variants
    })
    expect(result.current.selectedExperiment?.id).not.toBe(TEMPLATE_ID)

    await act(async () => {
      await result.current.handleSaveExperiment(draftPayload)
    })

    expect(cliClient.createExperiment).toHaveBeenCalledTimes(1)
    expect(cliClient.createExperiment).toHaveBeenCalledWith(draftPayload)
    expect(cliClient.updateExperiment).not.toHaveBeenCalled()
    expect(props.onError).not.toHaveBeenCalled()
    expect(props.onSuccess).toHaveBeenCalledWith(
      "Experiment saved successfully!"
    )
    expect(props.setView).toHaveBeenLastCalledWith("list")
    expect(props.loadExperiments).toHaveBeenCalledWith(true, 1, 20)
  })

  it("keeps a template draft retryable when create fails", async () => {
    const { result, props } = setup()
    cliClient.createExperiment.mockRejectedValueOnce(
      new Error("Name already in use")
    )

    await act(async () => {
      await result.current.handleCreateFromTemplate(TEMPLATE_ID)
    })
    const draft = result.current.selectedExperiment
    props.setView.mockClear()

    await act(async () => {
      await expect(
        result.current.handleSaveExperiment(draftPayload)
      ).rejects.toThrow("Name already in use")
    })

    expect(props.onError).toHaveBeenCalledWith("Name already in use")
    expect(props.onSuccess).not.toHaveBeenCalled()
    expect(props.setView).not.toHaveBeenCalled()
    expect(props.loadExperiments).not.toHaveBeenCalled()
    expect(result.current.selectedExperiment).toBe(draft)

    await act(async () => {
      await result.current.handleSaveExperiment(draftPayload)
    })

    expect(cliClient.createExperiment).toHaveBeenCalledTimes(2)
    expect(cliClient.updateExperiment).not.toHaveBeenCalled()
    expect(props.onSuccess).toHaveBeenCalledWith(
      "Experiment saved successfully!"
    )
    expect(props.setView).toHaveBeenLastCalledWith("list")
  })

  it("creates a new experiment when saving a blank draft", async () => {
    const { result, props } = setup()

    await act(async () => {
      await result.current.handleCreateExperiment()
    })
    expect(result.current.selectedExperiment).toBeNull()

    await act(async () => {
      await result.current.handleSaveExperiment(draftPayload)
    })

    expect(cliClient.createExperiment).toHaveBeenCalledWith(draftPayload)
    expect(cliClient.updateExperiment).not.toHaveBeenCalled()
    expect(props.onSuccess).toHaveBeenCalled()
  })

  it("creates a new experiment when saving an unsaved draft restored without an id", async () => {
    const { result, props } = setup()

    // useSidebarState restores an unsaved draft as an experiment without id.
    act(() => {
      result.current.setSelectedExperiment({
        id: undefined,
        name: "",
        display_name: ""
      } as unknown as Experiment)
    })

    await act(async () => {
      await result.current.handleSaveExperiment(draftPayload)
    })

    expect(cliClient.createExperiment).toHaveBeenCalledWith(draftPayload)
    expect(cliClient.updateExperiment).not.toHaveBeenCalled()
    expect(props.onError).not.toHaveBeenCalled()
  })

  it("updates the selected experiment when it already exists", async () => {
    const { result, props } = setup()
    const updates = { display_name: "Renamed" } as Partial<Experiment>

    await act(async () => {
      await result.current.handleEditExperiment(existing)
    })

    await act(async () => {
      await result.current.handleSaveExperiment(updates)
    })

    expect(cliClient.updateExperiment).toHaveBeenCalledWith(
      EXISTING_ID,
      updates
    )
    expect(cliClient.createExperiment).not.toHaveBeenCalled()
    expect(props.onSuccess).toHaveBeenCalledWith(
      "Experiment saved successfully!"
    )
    expect(props.setView).toHaveBeenLastCalledWith("list")
  })
})
