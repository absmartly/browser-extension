import { type FrameLocator, type Page } from "@playwright/test"

import { expect, test } from "../fixtures/extension"
import { log } from "./utils/test-helpers"

const buttonChange = (color: string) => ({
  selector: ".btn",
  type: "style",
  value: { "background-color": color }
})
const headingChange = (color: string) => ({
  selector: "h1, h2, h3, h4, h5, h6",
  type: "style",
  value: { color, "font-weight": "bold" }
})
const paragraphChange = {
  selector: "p",
  type: "style",
  value: { "font-style": "italic" }
}

function mutation(
  promptIncludes: string,
  action: string,
  domChanges: unknown[],
  targetSelectors?: string[]
) {
  return {
    promptIncludes,
    response: {
      tools: [
        {
          id: `dom-${promptIncludes.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60)}`,
          name: "dom_changes_generator",
          input: {
            action,
            domChanges,
            response: `Applied ${action} changes.`,
            ...(targetSelectors ? { targetSelectors } : {})
          }
        }
      ]
    }
  }
}

async function setupExperimentAndAI(
  testPage: Page,
  extensionUrl: (path: string) => string
): Promise<FrameLocator> {
  // Inject sidebar as iframe
  await testPage.evaluate((extUrl) => {
    const originalPadding = document.body.style.paddingRight || "0px"
    document.body.setAttribute(
      "data-absmartly-original-padding-right",
      originalPadding
    )
    document.body.style.transition = "padding-right 0.3s ease-in-out"
    document.body.style.paddingRight = "384px"

    const container = document.createElement("div")
    container.id = "absmartly-sidebar-root"
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 384px;
      height: 100vh;
      background-color: white;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #111827;
      transform: translateX(0);
      transition: transform 0.3s ease-in-out;
    `

    const iframe = document.createElement("iframe")
    iframe.id = "absmartly-sidebar-iframe"
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `
    iframe.src = extUrl

    container.appendChild(iframe)
    document.body.appendChild(container)
  }, extensionUrl("tabs/sidebar.html"))

  const sidebar = testPage.frameLocator("#absmartly-sidebar-iframe")
  await sidebar.locator("body").waitFor({ timeout: 10000 })
  log("✓ Sidebar injected and loaded")

  const createButton = sidebar.locator('button[title="Create New Experiment"]')
  await createButton.waitFor({ state: "visible", timeout: 10000 })
  await createButton.click()

  const fromScratchButton = sidebar.locator("#from-scratch-button")
  await fromScratchButton.waitFor({ state: "visible", timeout: 5000 })
  await fromScratchButton.click()

  await sidebar
    .locator("#display-name-label")
    .waitFor({ state: "visible", timeout: 10000 })
  log("✓ Experiment editor opened")

  await sidebar
    .locator('[data-dom-changes-section="true"]')
    .first()
    .scrollIntoViewIfNeeded()

  const generateWithAIButton = sidebar
    .locator("#generate-with-ai-button")
    .first()
  await generateWithAIButton.waitFor({ state: "visible", timeout: 10000 })
  await generateWithAIButton.evaluate((button) => {
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    )
  })

  await sidebar
    .locator("#ai-dom-generator-heading")
    .waitFor({ state: "visible", timeout: 10000 })
  log("✓ AI page opened")

  return sidebar
}

async function generateAndWait(
  sidebar: FrameLocator,
  prompt: string
): Promise<void> {
  const count = await sidebar.locator("[data-message-index]").count()
  await sidebar.locator("#ai-prompt").fill(prompt)
  await sidebar.locator("#ai-generate-button").click()
  await expect(sidebar.locator("[data-message-index]")).toHaveCount(count + 2)
  await expect(sidebar.locator("#ai-generate-button")).toHaveAttribute(
    "data-loading",
    "false"
  )
}

async function getLatestChanges(testPage: Page): Promise<unknown[]> {
  return testPage
    .frameLocator("#absmartly-sidebar-iframe")
    .locator("body")
    .evaluate(() => (window as any).__absmartlyLatestDomChanges?.changes || [])
}

test.describe("AI DOM Granular Operations", () => {
  let testPage: Page
  let sidebar: FrameLocator

  test.beforeEach(async ({ context, extensionUrl }) => {
    testPage = await context.newPage()
    await testPage.goto("http://localhost:3456/visual-editor-test.html")
    await testPage.evaluate(() => {
      ;(window as any).__absmartlyTestMode = true
    })
    sidebar = await setupExperimentAndAI(testPage, extensionUrl)
  })

  test.afterEach(async () => {
    await testPage.close()
  })

  test("should handle append action - add new changes to existing ones", async ({
    aiProvider
  }) => {
    const initial =
      "Apply background-color: orange to every .btn element on the page. Generate the DOM changes now."
    const append =
      "Append a DOM change setting color: blue and font-weight: bold on h1, h2, h3, h4, h5, h6. Keep the existing orange .btn change. Generate the DOM changes now using the DOM changes tool."
    aiProvider.script([
      mutation(initial, "append", [buttonChange("orange")]),
      mutation(append, "append", [headingChange("blue")])
    ])
    await generateAndWait(sidebar, initial)
    await expect(testPage.locator(".btn").first()).toHaveCSS(
      "background-color",
      "rgb(255, 165, 0)"
    )
    await generateAndWait(sidebar, append)
    expect(await getLatestChanges(testPage)).toEqual([
      buttonChange("orange"),
      headingChange("blue")
    ])
    await expect(testPage.locator(".btn").first()).toHaveCSS(
      "background-color",
      "rgb(255, 165, 0)"
    )
    await expect(testPage.locator("h1")).toHaveCSS("color", "rgb(0, 0, 255)")
  })

  test("should handle replace_all action - replace all existing changes", async ({
    aiProvider
  }) => {
    const initial = "Make all buttons have an orange background"
    const replacement =
      "Actually, forget the buttons. Instead make all headings green and italic"
    const greenHeadings = {
      selector: "h1, h2, h3, h4, h5, h6",
      type: "style",
      value: { color: "green", "font-style": "italic" }
    }
    const originalButtonColor = await testPage
      .locator(".btn")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    aiProvider.script([
      mutation(initial, "append", [buttonChange("orange")]),
      mutation(replacement, "replace_all", [greenHeadings])
    ])
    await generateAndWait(sidebar, initial)
    await generateAndWait(sidebar, replacement)
    expect(await getLatestChanges(testPage)).toEqual([greenHeadings])
    await expect(testPage.locator(".btn").first()).toHaveCSS(
      "background-color",
      originalButtonColor
    )
    await expect(testPage.locator("h1")).toHaveCSS("color", "rgb(0, 128, 0)")
    await expect(testPage.locator("h1")).toHaveCSS("font-style", "italic")
  })

  test("should handle replace_specific action - replace specific changes only", async ({
    aiProvider
  }) => {
    const initial = "Make all buttons orange and all headings blue"
    const replacement =
      "Change the buttons to red instead of orange, but keep the headings as they are"
    aiProvider.script([
      mutation(initial, "append", [
        buttonChange("orange"),
        headingChange("blue")
      ]),
      mutation(replacement, "replace_specific", [buttonChange("red")], [".btn"])
    ])
    await generateAndWait(sidebar, initial)
    await generateAndWait(sidebar, replacement)
    expect(await getLatestChanges(testPage)).toEqual([
      headingChange("blue"),
      buttonChange("red")
    ])
    await expect(testPage.locator(".btn").first()).toHaveCSS(
      "background-color",
      "rgb(255, 0, 0)"
    )
    await expect(testPage.locator("h1")).toHaveCSS("color", "rgb(0, 0, 255)")
  })

  test("should handle remove_specific action - remove specific changes only", async ({
    aiProvider
  }) => {
    const initial = "Make buttons orange, headings blue, and paragraphs italic"
    const removal = "Remove the button styling but keep everything else"
    const originalButtonColor = await testPage
      .locator(".btn")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    aiProvider.script([
      mutation(initial, "append", [
        buttonChange("orange"),
        headingChange("blue"),
        paragraphChange
      ]),
      mutation(removal, "remove_specific", [], [".btn"])
    ])
    await generateAndWait(sidebar, initial)
    await generateAndWait(sidebar, removal)
    expect(await getLatestChanges(testPage)).toEqual([
      headingChange("blue"),
      paragraphChange
    ])
    await expect(testPage.locator(".btn").first()).toHaveCSS(
      "background-color",
      originalButtonColor
    )
    await expect(testPage.locator("h1")).toHaveCSS("color", "rgb(0, 0, 255)")
    await expect(testPage.locator("#test-paragraph")).toHaveCSS(
      "font-style",
      "italic"
    )
  })

  test("should handle none action - conversational response only", async ({
    aiProvider
  }) => {
    const initial = "Make all buttons have an orange background"
    const question = "What colors work well for call-to-action buttons?"
    // Text that resembles a mutation must remain conversational unless the provider calls the native tool.
    const answer = JSON.stringify({
      action: "replace_all",
      domChanges: [buttonChange("red")],
      response: "Red is another option."
    })
    aiProvider.script([
      mutation(initial, "append", [buttonChange("orange")]),
      { promptIncludes: question, response: { text: answer } }
    ])
    await generateAndWait(sidebar, initial)
    const before = await getLatestChanges(testPage)
    await generateAndWait(sidebar, question)
    expect(await getLatestChanges(testPage)).toEqual(before)
    await expect(testPage.locator(".btn").first()).toHaveCSS(
      "background-color",
      "rgb(255, 165, 0)"
    )
    await expect(sidebar.locator("[data-message-index]").last()).toContainText(
      "Red is another option."
    )
  })

  test("should maintain change history across multiple operations", async ({
    aiProvider
  }) => {
    const initial = "Make all buttons have an orange background"
    const append = "Also make all headings blue and bold"
    const question = "What is the current color scheme?"
    const replacement = "Change buttons to red instead of orange"
    aiProvider.script([
      mutation(initial, "append", [buttonChange("orange")]),
      mutation(append, "append", [headingChange("blue")]),
      {
        promptIncludes: question,
        response: { text: "The buttons are orange and the headings are blue." }
      },
      {
        ...mutation(
          replacement,
          "replace_specific",
          [buttonChange("red")],
          [".btn"]
        ),
        assertRequest: (body) => {
          expect(body.messages).toHaveLength(7)
          expect(JSON.stringify(body.messages)).toContain(initial)
          expect(JSON.stringify(body.messages)).toContain(
            "The buttons are orange and the headings are blue."
          )
        }
      }
    ])
    for (const prompt of [initial, append, question, replacement])
      await generateAndWait(sidebar, prompt)
    expect(await getLatestChanges(testPage)).toEqual([
      headingChange("blue"),
      buttonChange("red")
    ])
    await expect(sidebar.locator("[data-message-index]")).toHaveCount(8)
    await expect(testPage.locator(".btn").first()).toHaveCSS(
      "background-color",
      "rgb(255, 0, 0)"
    )
    await expect(testPage.locator("h1")).toHaveCSS("color", "rgb(0, 0, 255)")
  })
})
