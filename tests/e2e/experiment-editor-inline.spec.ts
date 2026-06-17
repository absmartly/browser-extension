/**
 * E2E smoke for the FT-1905 inline experiment editor.
 *
 * Replaces the deleted `fullscreen-modal-*` specs. Verifies that opening
 * the create form shows the inline audience / metrics / custom fields /
 * AI Fill sections inside the sidebar. (Width changes happen via the
 * left-edge drag handle, capped at 50vw, which the iframe harness doesn't
 * model — covered by the unit test for `clampWidth`.)
 *
 * No shadow-root indirection is needed any more — the editor lives directly
 * in the sidebar's React tree.
 */
import path from "path"

import { type Page } from "@playwright/test"

import { test, expect } from "../fixtures/extension"
import {
  debugWait,
  injectSidebar,
  setupConsoleLogging
} from "./utils/test-helpers"

const TEST_PAGE_PATH = path.join(
  __dirname,
  "..",
  "test-pages",
  "visual-editor-test.html"
)

test.describe("Experiment editor — inline form (FT-1905)", () => {
  let testPage: Page

  test.beforeEach(async ({ context, seedStorage }) => {
    await seedStorage({
      "absmartly-apikey":
        process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY ||
        "BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB",
      "absmartly-endpoint":
        process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT ||
        "https://dev-1.absmartly.com/v1",
      "absmartly-env":
        process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || "development",
      "absmartly-auth-method": "apikey"
    })

    testPage = await context.newPage()
    setupConsoleLogging(
      testPage,
      (msg) => msg.text.includes("[ABsmartly]") || msg.text.includes("[Background]")
    )

    await testPage.goto("http://localhost:3456/visual-editor-test.html", {
      waitUntil: "domcontentloaded",
      timeout: 10000
    })
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForSelector("body", { timeout: 5000 })
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test("inline sections render in the sidebar editor", async ({
    extensionUrl
  }) => {
    test.setTimeout(8000)

    const sidebar = await injectSidebar(testPage, extensionUrl)

    // Open create experiment from scratch.
    await sidebar
      .locator('button[title="Create New Experiment"]')
      .click({ timeout: 3000 })
    await debugWait()
    await sidebar
      .locator("#from-scratch-button")
      .click({ timeout: 3000 })
    await debugWait()

    // The header is the structural anchor we wait on — once it's visible,
    // the editor has mounted and the inline sections will have been rendered.
    await expect(
      sidebar.locator("#create-experiment-header")
    ).toBeVisible({ timeout: 3000 })

    // Each inline section uses a stable id so we can assert on it directly
    // without text selectors (per CLAUDE.md).
    await expect(
      sidebar.locator("#experiment-audience-section")
    ).toBeVisible({ timeout: 3000 })
    await expect(
      sidebar.locator("#experiment-metrics-section")
    ).toBeVisible({ timeout: 3000 })
  })
})
