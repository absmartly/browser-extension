import Anthropic from "@anthropic-ai/sdk"

import { AnthropicProvider } from "~src/lib/ai-providers/anthropic"
import type { StoredConversation } from "~src/types/absmartly"
import {
  unsafeConversationId,
  unsafeSessionId,
  unsafeVariantName
} from "~src/types/branded"

import { loadConversation, saveConversation } from "../ai-conversation-storage"
import * as idbStorage from "../indexeddb-storage"

jest.mock("@anthropic-ai/sdk")
jest.mock("../indexeddb-storage")
// Thumbnailing needs a real canvas; keep stored images as given.
jest.mock("../image-compression", () => ({
  compressImages: async (images?: string[]) => images
}))

// Real save → load → Anthropic request construction; only IndexedDB and the
// SDK transport are controlled. Review 5385550449 / comment 4160506781.
const IMAGE = "data:image/png;base64,iVBORw0KGgo="

function imageOnlyConversation(): StoredConversation {
  return {
    id: unsafeConversationId("conv-image"),
    variantName: unsafeVariantName("variant-a"),
    messages: [
      { role: "user", content: "", images: [IMAGE], timestamp: 1, id: "u1" },
      {
        role: "assistant",
        content: "The image says HELLO.",
        timestamp: 2,
        id: "a1"
      }
    ],
    conversationSession: {
      id: unsafeSessionId("session-image"),
      htmlSent: true,
      messages: [
        { role: "user", content: "User Request: " },
        { role: "assistant", content: "The image says HELLO." }
      ]
    },
    createdAt: 1,
    updatedAt: 2,
    messageCount: 2,
    firstUserMessage: "",
    isActive: true
  } as StoredConversation
}

test("a reopened image-only conversation sends no empty historical message", async () => {
  const create = jest.fn().mockResolvedValue({
    content: [{ type: "text", text: "Done." }],
    stop_reason: "end_turn"
  })
  ;(Anthropic as unknown as jest.Mock).mockImplementation(() => ({
    messages: { create }
  }))
  const idb = idbStorage as jest.Mocked<typeof idbStorage>
  idb.saveConversation.mockResolvedValue(undefined)

  await saveConversation(imageOnlyConversation())
  idb.loadConversation.mockResolvedValue(idb.saveConversation.mock.calls[0][0])
  const restored = await loadConversation("variant-a", "conv-image")

  const provider = new AnthropicProvider({
    aiProvider: "anthropic-api",
    apiKey: "synthetic-key"
  } as any)
  await provider.generate("", "Now make it blue", [], undefined, {
    conversationSession: restored!.conversationSession
  } as any)

  const messages = create.mock.calls[0][0].messages
  for (const m of messages) {
    const parts =
      typeof m.content === "string"
        ? [{ type: "text", text: m.content }]
        : m.content
    for (const p of parts)
      if (p.type === "text") expect(p.text.trim()).not.toBe("")
  }
  // Text follow-up is sent last; the earlier assistant reply is kept.
  expect(messages[messages.length - 1].content[0].text).toContain(
    "Now make it blue"
  )
  expect(
    messages.some(
      (m: any) =>
        m.role === "assistant" && m.content === "The image says HELLO."
    )
  ).toBe(true)
})

test("an assistant reply with no text is also not restored as empty", async () => {
  const idb = idbStorage as jest.Mocked<typeof idbStorage>
  const conversation = imageOnlyConversation()
  conversation.messages[1] = { ...conversation.messages[1], content: "" }
  idb.saveConversation.mockResolvedValue(undefined)
  await saveConversation(conversation)
  idb.loadConversation.mockResolvedValue(
    idb.saveConversation.mock.calls.at(-1)![0]
  )
  const restored = await loadConversation("variant-a", "conv-image")
  expect(restored!.conversationSession.messages).toEqual([
    { role: "user", content: "[1 image attached]" },
    { role: "assistant", content: "(empty message)" }
  ])
})

test("text turns, with or without images, restore exactly as before", async () => {
  const idb = idbStorage as jest.Mocked<typeof idbStorage>
  const conversation = imageOnlyConversation()
  conversation.messages[0] = {
    ...conversation.messages[0],
    content: "What does it say?"
  }
  idb.saveConversation.mockResolvedValue(undefined)
  await saveConversation(conversation)
  idb.loadConversation.mockResolvedValue(
    idb.saveConversation.mock.calls.at(-1)![0]
  )
  const restored = await loadConversation("variant-a", "conv-image")
  expect(restored!.conversationSession.messages).toEqual([
    { role: "user", content: "What does it say?" },
    { role: "assistant", content: "The image says HELLO." }
  ])
})
