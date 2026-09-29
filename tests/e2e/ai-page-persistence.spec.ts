import type { FrameLocator } from "@playwright/test"

import { expect, test } from "../fixtures/extension"
import { injectSidebar } from "./utils/test-helpers"

async function openAI(sidebar: FrameLocator) {
  await sidebar
    .locator(
      "#experiments-heading, #display-name-label, #ai-dom-generator-heading"
    )
    .first()
    .waitFor({ state: "visible" })
  if (await sidebar.locator("#ai-dom-generator-heading").isVisible()) return
  if (await sidebar.locator("#experiments-heading").isVisible()) {
    await sidebar.locator('button[title="Create New Experiment"]').click()
    await sidebar.locator("#from-scratch-button").click()
  }
  await sidebar.locator("#generate-with-ai-button").first().click()
  await expect(sidebar.locator("#ai-dom-generator-heading")).toBeVisible()
}

test("should persist AI conversation after reload and capture HTML successfully", async ({
  context,
  extensionUrl,
  aiProvider
}) => {
  const prompt = "Make all buttons have an orange background"
  aiProvider.script([
    {
      promptIncludes: prompt,
      assertRequest: (body) => {
        expect(body.system).toContain("button-1")
      },
      response: {
        tools: [
          {
            id: "persistent-buttons",
            name: "dom_changes_generator",
            input: {
              action: "append",
              domChanges: [
                {
                  selector: ".btn",
                  type: "style",
                  value: { "background-color": "orange" }
                }
              ],
              response: "Applied orange backgrounds to the buttons."
            }
          }
        ]
      }
    }
  ])
  const page = await context.newPage()
  await page.goto("http://localhost:3456/visual-editor-test.html")
  let sidebar = await injectSidebar(page, extensionUrl)
  await openAI(sidebar)
  await sidebar.locator("#ai-prompt").fill(prompt)
  await sidebar.locator("#ai-generate-button").click()
  await expect(sidebar.locator("[data-message-index]")).toHaveCount(2)
  for (const id of ["#button-1", "#button-2", "#button-3"]) {
    await expect(page.locator(id)).toHaveCSS(
      "background-color",
      "rgb(255, 165, 0)"
    )
  }
  await expect(sidebar.locator("#ai-generate-button")).toHaveAttribute(
    "data-loading",
    "false"
  )
  await page.reload()
  sidebar = await injectSidebar(page, extensionUrl)
  // Reload recreates the view callbacks. Reopen the same variant and require the stored conversation.
  await openAI(sidebar)
  await expect(sidebar.locator("[data-message-index]")).toHaveCount(2)
  await expect(sidebar.locator("[data-message-index]").first()).toContainText(
    prompt
  )
  await expect(sidebar.locator("[data-message-index]").last()).toContainText(
    "Applied orange backgrounds"
  )
  await sidebar.locator('button[aria-label="Go back"]').click()
  await expect(sidebar.locator(".dom-change-card")).toHaveCount(1)
  await expect(sidebar.locator(".dom-change-card")).toContainText("orange")
  const preview = sidebar.locator('[data-testid="preview-toggle-variant-1"]')
  if (!(await preview.evaluate((el) => el.classList.contains("bg-blue-600"))))
    await preview.click()
  for (const id of ["#button-1", "#button-2", "#button-3"]) {
    await expect(page.locator(id)).toHaveCSS(
      "background-color",
      "rgb(255, 165, 0)"
    )
  }
  await page.close()
})
