import { fillExperimentFromAI } from "~src/lib/ai-experiment-filler"
import { createAIProvider } from "~src/lib/ai-providers"
import type { AIFillRequest } from "~src/types/ai-fill"
import { getMetadata } from "~src/utils/indexeddb-storage"

jest.mock("~src/lib/ai-providers", () => {
  const actual = jest.requireActual("~src/lib/ai-providers")
  return { ...actual, createAIProvider: jest.fn() }
})

jest.mock("~src/utils/indexeddb-storage", () => ({
  getMetadata: jest.fn(),
  setMetadata: jest.fn()
}))

const baseRequest: AIFillRequest = {
  draft: {
    name: "",
    display_name: "",
    percentage_of_traffic: 100,
    percentages: "50/50",
    audience: '{"filter":[{"and":[]}]}',
    audience_strict: false,
    application_ids: [],
    tag_ids: [],
    variantNames: ["Control", "Variant 1"],
    customFieldValues: {}
  },
  customFields: [
    {
      id: 7,
      title: "Hypothesis",
      type: "text",
      required: false
    }
  ],
  pageUrl: "https://shop.example.com/product/123",
  pageTitle: "Blue Sneakers",
  pageVisibleText: "Buy now $89.99",
  variantDomChanges: [],
  variantScreenshots: []
}

describe("fillExperimentFromAI", () => {
  beforeEach(() => {
    ;(getMetadata as jest.Mock).mockReset()
  })

  it("builds a structured request from the AIFillRequest and returns the parsed response", async () => {
    const generateStructured = jest
      .fn()
      .mockResolvedValue({ display_name: "Hero CTA copy test" })
    ;(createAIProvider as jest.Mock).mockReturnValue({ generateStructured })

    const result = await fillExperimentFromAI(baseRequest, {
      aiProvider: "claude-subscription"
    })

    expect(result).toEqual({ display_name: "Hero CTA copy test" })
    expect(generateStructured).toHaveBeenCalledTimes(1)
    const call = generateStructured.mock.calls[0][0]
    expect(call.schema.name).toBe("fill_experiment_fields")
    expect(call.systemPrompt).toContain("ABsmartly")
    expect(call.userMessage).toContain("https://shop.example.com/product/123")
    expect(call.userMessage).toContain("Blue Sneakers")
    expect(call.pageUrl).toBe("https://shop.example.com/product/123")
  })

  it("attaches before/after screenshots as image inputs", async () => {
    const generateStructured = jest.fn().mockResolvedValue({})
    ;(createAIProvider as jest.Mock).mockReturnValue({ generateStructured })

    await fillExperimentFromAI(
      {
        ...baseRequest,
        variantScreenshots: [
          {
            variantIndex: 1,
            variantName: "Variant 1",
            beforeDataUrl: "data:image/png;base64,AAA",
            afterDataUrl: "data:image/png;base64,BBB",
            width: 1280,
            height: 800
          }
        ]
      },
      { aiProvider: "claude-subscription" }
    )
    const call = generateStructured.mock.calls[0][0]
    expect(call.images).toEqual([
      "data:image/png;base64,AAA",
      "data:image/png;base64,BBB"
    ])
    expect(call.userMessage).toContain("Variant 1")
  })

  it("throws a clear error if the provider does not implement generateStructured", async () => {
    // Guard for future providers being added to the registry without
    // implementing structured generation. All four direct API providers
    // (Anthropic, OpenAI, OpenRouter, Gemini) plus the Claude Subscription
    // bridge implement it as of FT-1905, so we simulate a synthetic provider
    // by mocking createAIProvider to return a bare object.
    ;(createAIProvider as jest.Mock).mockReturnValue({})
    await expect(
      fillExperimentFromAI(baseRequest, {
        aiProvider: "future-provider-without-structured" as never
      })
    ).rejects.toThrow(/structured generation/i)
  })

  it("uses the custom override system prompt from IndexedDB when present", async () => {
    const generateStructured = jest.fn().mockResolvedValue({})
    ;(createAIProvider as jest.Mock).mockReturnValue({ generateStructured })
    ;(getMetadata as jest.Mock).mockResolvedValue(
      "CUSTOM_OVERRIDE: keep it brief."
    )

    await fillExperimentFromAI(baseRequest, {
      aiProvider: "claude-subscription"
    })

    expect(getMetadata).toHaveBeenCalledWith("ai-fill-prompt-override")
    expect(generateStructured.mock.calls[0][0].systemPrompt).toBe(
      "CUSTOM_OVERRIDE: keep it brief."
    )
  })

  it("falls back to the default prompt when no override is stored", async () => {
    const generateStructured = jest.fn().mockResolvedValue({})
    ;(createAIProvider as jest.Mock).mockReturnValue({ generateStructured })
    ;(getMetadata as jest.Mock).mockResolvedValue(null)

    await fillExperimentFromAI(baseRequest, {
      aiProvider: "claude-subscription"
    })
    expect(generateStructured.mock.calls[0][0].systemPrompt).toContain(
      "ABsmartly"
    )
  })

  it("falls back to the default prompt when the stored override is empty/whitespace", async () => {
    const generateStructured = jest.fn().mockResolvedValue({})
    ;(createAIProvider as jest.Mock).mockReturnValue({ generateStructured })
    ;(getMetadata as jest.Mock).mockResolvedValue("   \n  ")

    await fillExperimentFromAI(baseRequest, {
      aiProvider: "claude-subscription"
    })
    expect(generateStructured.mock.calls[0][0].systemPrompt).toContain(
      "ABsmartly"
    )
  })

  it("falls back to the default prompt if IndexedDB throws", async () => {
    const generateStructured = jest.fn().mockResolvedValue({})
    ;(createAIProvider as jest.Mock).mockReturnValue({ generateStructured })
    ;(getMetadata as jest.Mock).mockRejectedValue(new Error("idb unavailable"))

    await fillExperimentFromAI(baseRequest, {
      aiProvider: "claude-subscription"
    })
    expect(generateStructured.mock.calls[0][0].systemPrompt).toContain(
      "ABsmartly"
    )
  })
})
