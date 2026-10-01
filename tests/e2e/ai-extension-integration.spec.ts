import { expect, test } from "../fixtures/extension"
import {
  createExperiment,
  fillMetadataForSave,
  saveExperiment
} from "./helpers/ve-experiment-setup"
import { click, setupTestPage } from "./utils/test-helpers"

test.describe("Extension AI Integration (mocked Anthropic protocol)", () => {
  test("extension generates DOM changes via Anthropic API", async ({
    context,
    extensionUrl,
    aiProvider
  }) => {
    test.setTimeout(180000)

    const prompt =
      'Use the DOM-change tool to change the h1 text to "Hello from Anthropic!". Apply the change, not just describe it.'
    aiProvider.script([
      {
        promptIncludes: prompt,
        response: {
          tools: [
            {
              id: "integration-title",
              name: "dom_changes_generator",
              input: {
                action: "append",
                domChanges: [
                  {
                    selector: "h1",
                    type: "text",
                    value: "Hello from Anthropic!"
                  }
                ],
                response:
                  "Updated the page heading through the native DOM-change tool."
              }
            }
          ]
        }
      }
    ])

    const testPage = await context.newPage()
    const { sidebar } = await setupTestPage(testPage, extensionUrl)

    await sidebar
      .locator('[role="status"][aria-label="Loading experiments"]')
      .waitFor({ state: "hidden", timeout: 30000 })
      .catch(() => {})

    const experimentName = await createExperiment(sidebar)
    await fillMetadataForSave(sidebar, testPage)
    const createdName = await sidebar
      .locator("#experiment-name-input")
      .inputValue()
    await saveExperiment(sidebar, testPage, experimentName)

    const createdRow = sidebar.locator(
      `[data-experiment-name=${JSON.stringify(createdName)}]`
    )
    await createdRow.waitFor({ state: "visible", timeout: 10000 })
    await click(sidebar, createdRow)

    const generateAIButton = sidebar.locator("#generate-with-ai-button").first()
    await generateAIButton.scrollIntoViewIfNeeded()
    await generateAIButton.waitFor({ state: "visible", timeout: 15000 })
    await click(sidebar, generateAIButton)

    const aiPrompt = sidebar.locator("#ai-prompt")
    await aiPrompt.waitFor({ state: "visible", timeout: 10000 })
    await aiPrompt.fill(prompt)
    await click(sidebar, "#ai-generate-button")
    await expect(testPage.locator("h1")).toHaveText("Hello from Anthropic!")

    // The last message immediately after click is the USER prompt. Require
    // the rendered assistant role and actual generated changes as well.
    const assistantMessage = sidebar
      .locator("[data-message-index].justify-start")
      .last()
    await assistantMessage.waitFor({ state: "visible", timeout: 60000 })

    const responseText = await assistantMessage.textContent()
    expect(responseText).toBeTruthy()
    expect(responseText!.length).toBeGreaterThan(10)
    await expect
      .poll(async () =>
        sidebar
          .locator("body")
          .evaluate(() =>
            JSON.stringify(
              (window as any).__absmartlyLatestDomChanges?.changes || []
            )
          )
      )
      .toContain("Hello from Anthropic!")

    await testPage.close()
  })
})
