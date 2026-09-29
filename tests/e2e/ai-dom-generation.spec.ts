import type { FrameLocator, Page } from "@playwright/test"

import { expect, test } from "../fixtures/extension"
import { injectSidebar } from "./utils/test-helpers"

test.describe("AI DOM Changes Generation", () => {
  let testPage: Page
  let sidebar: FrameLocator

  test.beforeEach(async ({ context, extensionUrl }) => {
    testPage = await context.newPage()
    await testPage.goto("http://localhost:3456/visual-editor-test.html")
    await testPage.evaluate(() => {
      ;(window as any).__absmartlyTestMode = true
    })
    sidebar = await injectSidebar(testPage, extensionUrl)
    await sidebar.locator('button[title="Create New Experiment"]').click()
    await sidebar.locator("#from-scratch-button").click()
    await sidebar.locator("#display-name-label").waitFor({ state: "visible" })
    await sidebar.locator("#generate-with-ai-button").first().click()
    await expect(sidebar.locator("#ai-dom-generator-heading")).toBeVisible()
  })

  test.afterEach(async () => {
    await testPage.close()
  })

  test("Generate DOM changes using AI prompts", async ({ aiProvider }) => {
    const prompt =
      'Change the text in the paragraph with id "test-paragraph" to say "Modified text!"'
    const change = {
      selector: "#test-paragraph",
      type: "text",
      value: "Modified text!"
    }
    aiProvider.script([
      {
        promptIncludes: prompt,
        response: {
          tools: [
            {
              id: "text-change",
              name: "dom_changes_generator",
              input: {
                action: "append",
                domChanges: [change],
                response: "Updated the paragraph text."
              }
            }
          ]
        }
      }
    ])
    await sidebar.locator("#ai-prompt").fill(prompt)
    await sidebar.locator("#ai-generate-button").click()
    await expect(testPage.locator("#test-paragraph")).toHaveText(
      "Modified text!"
    )
    await expect(sidebar.locator("[data-message-index]")).toHaveCount(2)
    await sidebar.locator('button[aria-label="Go back"]').click()
    await expect(sidebar.locator(".dom-change-card")).toHaveCount(1)
    await expect(sidebar.locator(".dom-change-card")).toContainText(
      "#test-paragraph"
    )
    await expect(sidebar.locator(".dom-change-card")).toContainText(
      "Modified text!"
    )
  })

  test("Refresh HTML button updates page context", async () => {
    const refresh = sidebar.locator("#refresh-html-button")
    await expect(refresh).toBeEnabled()
    await refresh.click()
    await expect(refresh).toBeEnabled()
    await expect(sidebar.locator(".bg-red-50").first()).not.toBeVisible()
  })

  test("AI uses css_query tool with Anthropic API", async ({ aiProvider }) => {
    const prompt =
      'Look at what is inside the #test-container div and change the section title text to say "Updated by AI"'
    aiProvider.script([
      {
        promptIncludes: prompt,
        response: {
          tools: [
            {
              id: "inspect-container",
              name: "css_query",
              input: { selectors: ["#test-container"] }
            }
          ]
        }
      },
      {
        toolResultFor: "inspect-container",
        assertRequest: (body) => {
          const content = body.messages.at(-1)!.content
          expect(Array.isArray(content)).toBe(true)
          if (!Array.isArray(content))
            throw new Error("Expected tool-result content blocks")
          const result = content.find(
            (part: any) => part.type === "tool_result"
          )
          expect(result.content).toContain('id="section-title"')
          expect(result.content).toContain("Section Title")
          expect(result.content).toContain(
            "Section content that can be modified."
          )
        },
        response: {
          tools: [
            {
              id: "update-inspected-title",
              name: "dom_changes_generator",
              input: {
                action: "append",
                domChanges: [
                  {
                    selector: "#section-title",
                    type: "text",
                    value: "Updated by AI"
                  }
                ],
                response: "Inspected the container and updated its title."
              }
            }
          ]
        }
      }
    ])
    await sidebar.locator("#ai-prompt").fill(prompt)
    await sidebar.locator("#ai-generate-button").click()
    await expect(testPage.locator("#section-title")).toHaveText("Updated by AI")
    await expect(sidebar.locator("[data-message-index]").last()).toContainText(
      "Inspected the container"
    )
  })

  test("provider authentication error is shown and a corrected request can recover", async ({
    aiProvider
  }) => {
    const prompt = "Change the paragraph text after recovery"
    aiProvider.script([
      {
        promptIncludes: prompt,
        status: 401,
        error: {
          type: "authentication_error",
          message: "Test provider rejected credentials"
        },
        response: {}
      },
      {
        promptIncludes: prompt,
        response: {
          tools: [
            {
              id: "recovered-change",
              name: "dom_changes_generator",
              input: {
                action: "append",
                domChanges: [
                  {
                    selector: "#test-paragraph",
                    type: "text",
                    value: "Recovered successfully"
                  }
                ],
                response: "The retry succeeded."
              }
            }
          ]
        }
      }
    ])
    await sidebar.locator("#ai-prompt").fill(prompt)
    await sidebar.locator("#ai-generate-button").click()
    await expect(sidebar.locator(".bg-red-50").first()).toContainText(
      "Authentication failed. Check your API key in Settings"
    )
    await expect(sidebar.locator("#ai-generate-button")).toHaveAttribute(
      "data-loading",
      "false"
    )
    await expect(testPage.locator("#test-paragraph")).not.toHaveText(
      "Recovered successfully"
    )
    await sidebar.locator("#ai-prompt").fill(prompt)
    await sidebar.locator("#ai-generate-button").click()
    await expect(testPage.locator("#test-paragraph")).toHaveText(
      "Recovered successfully"
    )
    await expect(sidebar.locator(".bg-red-50").first()).not.toBeVisible()
  })
})
