import type { FrameLocator, Page } from "@playwright/test"

import { TEST_IMAGES } from "../../src/lib/__tests__/test-images"
import { expect, test } from "../fixtures/extension"
import { injectSidebar } from "./utils/test-helpers"

async function storedConversations(sidebar: FrameLocator): Promise<any[]> {
  // IndexedDB belongs to the extension origin, not the target page hosting its iframe.
  return sidebar.locator("body").evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("absmartly-conversations")
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<any[]>((resolve, reject) => {
        const request = db
          .transaction("conversations", "readonly")
          .objectStore("conversations")
          .getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } finally {
      db.close()
    }
  })
}

async function generate(
  sidebar: FrameLocator,
  prompt: string,
  expectedMessages: number
) {
  await sidebar.locator("#ai-prompt").fill(prompt)
  await sidebar.locator("#ai-generate-button").click()
  await expect(sidebar.locator("[data-message-index]")).toHaveCount(
    expectedMessages
  )
  await expect(sidebar.locator("#ai-generate-button")).toHaveAttribute(
    "data-loading",
    "false"
  )
}

test.describe("AI Storage Quota Management", () => {
  let page: Page
  let sidebar: FrameLocator

  test.beforeEach(async ({ context, extensionUrl }) => {
    page = await context.newPage()
    await page.goto("http://localhost:3456/visual-editor-test.html")
    sidebar = await injectSidebar(page, extensionUrl)
    await sidebar.locator('button[title="Create New Experiment"]').click()
    await sidebar.locator("#from-scratch-button").click()
    await sidebar.locator("#generate-with-ai-button").first().click()
    await expect(sidebar.locator("#ai-dom-generator-heading")).toBeVisible()
  })
  test.afterEach(async () => {
    await page.close()
  })

  test("should sanitize images before storage", async ({ aiProvider }) => {
    aiProvider.script([
      {
        promptIncludes: "What do you see in this image?",
        assertRequest: (body) => {
          const content = body.messages.at(-1)!.content
          expect(Array.isArray(content)).toBe(true)
          if (!Array.isArray(content))
            throw new Error("Expected user content blocks")
          expect(
            content.filter((part: any) => part.type === "image")
          ).toHaveLength(1)
        },
        response: { text: "The image says HELLO." }
      }
    ])
    await sidebar
      .locator("#ai-prompt")
      .evaluate(async (textarea, imageDataUri) => {
        const file = new File(
          [await (await fetch(imageDataUri)).blob()],
          "test-image.png",
          { type: "image/png" }
        )
        const event = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true
        })
        Object.defineProperty(event, "clipboardData", {
          value: {
            items: [{ kind: "file", type: "image/png", getAsFile: () => file }]
          }
        })
        textarea.dispatchEvent(event)
      }, TEST_IMAGES.HELLO)
    await expect(sidebar.locator('img[alt^="Attachment"]')).toBeVisible()
    await generate(sidebar, "What do you see in this image?", 2)
    const conversations = await storedConversations(sidebar)
    expect(conversations).toHaveLength(1)
    const conversation = conversations[0]
    expect(conversation.messages).toHaveLength(2)
    expect(conversation.messages[0].images).toHaveLength(1)
    expect(conversation.messages[0].images[0]).toMatch(/^data:image\//)
    expect(conversation.messages[0].images[0].length).toBeLessThan(100000)
    expect(conversation.conversationSession.messages).toEqual([])
  })

  test("should persist conversations larger than the former sync-storage limit", async ({
    aiProvider
  }) => {
    const answer = "A detailed response. ".repeat(5000)
    aiProvider.script([
      {
        promptIncludes: "Give me a detailed response",
        response: { text: answer }
      }
    ])
    await generate(sidebar, "Give me a detailed response", 2)
    const conversations = await storedConversations(sidebar)
    expect(conversations).toHaveLength(1)
    expect(conversations[0].messages[1].content).toBe(answer.trim())
    expect(Buffer.byteLength(JSON.stringify(conversations[0]))).toBeGreaterThan(
      90000
    )
  })

  test("should handle storage quota exceeded error and save after recovery", async ({
    aiProvider
  }) => {
    aiProvider.script([
      {
        promptIncludes: "Apply changes despite a full history store",
        response: {
          tools: [
            {
              id: "quota-change",
              name: "dom_changes_generator",
              input: {
                action: "append",
                domChanges: [
                  {
                    selector: "#test-paragraph",
                    type: "text",
                    value: "Changes still applied"
                  }
                ],
                response: "Applied the paragraph change."
              }
            }
          ]
        }
      },
      {
        promptIncludes: "Save the recovered conversation",
        response: { text: "The conversation can be saved again." }
      }
    ])
    // Fail one real IndexedDB write at its browser boundary; unrelated reads and later writes stay real.
    await sidebar.locator("body").evaluate(() => {
      const original = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (value, key) {
        if (this.name === "conversations") {
          IDBObjectStore.prototype.put = original
          throw new DOMException(
            "Test storage quota exceeded",
            "QuotaExceededError"
          )
        }
        return key === undefined
          ? original.call(this, value)
          : original.call(this, value, key)
      }
    })
    const dialogPromise = page.waitForEvent("dialog").then(async (dialog) => {
      const result = { type: dialog.type(), message: dialog.message() }
      await dialog.dismiss()
      return result
    })
    await generate(sidebar, "Apply changes despite a full history store", 2)
    const dialog = await dialogPromise
    expect(dialog.type).toBe("confirm")
    expect(dialog.message).toContain("Storage quota exceeded")
    await expect(page.locator("#test-paragraph")).toHaveText(
      "Changes still applied"
    )
    expect(await storedConversations(sidebar)).toHaveLength(0)
    await generate(sidebar, "Save the recovered conversation", 4)
    const conversations = await storedConversations(sidebar)
    expect(conversations).toHaveLength(1)
    expect(conversations[0].messages).toHaveLength(4)
    expect(conversations[0].messages[3].content).toBe(
      "The conversation can be saved again."
    )
  })

  test("should sanitize session messages before storage", async ({
    aiProvider
  }) => {
    aiProvider.script([
      {
        promptIncludes: "Test message for session sanitization",
        response: { text: "A deterministic conversation response." }
      }
    ])
    await generate(sidebar, "Test message for session sanitization", 2)
    const conversations = await storedConversations(sidebar)
    expect(conversations).toHaveLength(1)
    expect(conversations[0].messages).toHaveLength(2)
    expect(conversations[0].conversationSession.id).toBeTruthy()
    expect(conversations[0].conversationSession.htmlSent).toBe(true)
    expect(conversations[0].conversationSession.messages).toEqual([])
  })
})
