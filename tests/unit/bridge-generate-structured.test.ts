import { BridgeProvider } from "~src/lib/ai-providers/bridge"
import { ClaudeCodeBridgeClient } from "~src/lib/claude-code-client"
import { EXPERIMENT_FILL_TOOL_SCHEMA } from "~src/lib/ai-providers/experiment-fill-schema"

jest.mock("~src/lib/claude-code-client")

describe("BridgeProvider.generateStructured", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("creates a conversation, sends the message with the schema, and returns parsed tool input", async () => {
    const fakeToolInput = { display_name: "Hero CTA wording test" }

    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      createConversation: jest
        .fn()
        .mockResolvedValue({ conversationId: "conv-1" }),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      streamResponses: jest.fn((convId, onMessage) => {
        queueMicrotask(() =>
          onMessage({
            type: "tool_result",
            tool_name: "fill_experiment_fields",
            input: fakeToolInput
          })
        )
        return { close: jest.fn() } as unknown as EventSource
      })
    }
    ;(ClaudeCodeBridgeClient as jest.Mock).mockImplementation(() => mockClient)

    const provider = new BridgeProvider({ aiProvider: "claude-subscription" })

    const result = await provider.generateStructured({
      systemPrompt: "test system",
      userMessage: "test user",
      schema: EXPERIMENT_FILL_TOOL_SCHEMA,
      images: [],
      pageUrl: "https://example.com"
    })

    expect(mockClient.connect).toHaveBeenCalled()
    expect(mockClient.createConversation).toHaveBeenCalled()
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      "conv-1",
      "test user",
      [],
      "test system",
      EXPERIMENT_FILL_TOOL_SCHEMA
    )
    expect(result).toEqual(fakeToolInput)
  })

  it("rejects on stream error", async () => {
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      createConversation: jest
        .fn()
        .mockResolvedValue({ conversationId: "conv-2" }),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      streamResponses: jest.fn((_convId, _onMessage, onError) => {
        queueMicrotask(() => onError(new Error("boom")))
        return { close: jest.fn() } as unknown as EventSource
      })
    }
    ;(ClaudeCodeBridgeClient as jest.Mock).mockImplementation(() => mockClient)

    const provider = new BridgeProvider({ aiProvider: "claude-subscription" })

    await expect(
      provider.generateStructured({
        systemPrompt: "x",
        userMessage: "y",
        schema: EXPERIMENT_FILL_TOOL_SCHEMA
      })
    ).rejects.toThrow("boom")
  })
})
