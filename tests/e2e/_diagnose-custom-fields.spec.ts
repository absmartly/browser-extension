import { test, expect } from "../fixtures/extension"
import {
  installAPIOperationStub,
  installAuthStub,
  setupTestPage,
} from "./utils/test-helpers"

const FIELDS = [
  {
    id: 7,
    custom_section_field_id: 7,
    title: "Hypothesis",
    type: "text",
    archived: false,
  },
  {
    id: 8,
    custom_section_field_id: 8,
    title: "Goal",
    type: "string",
    archived: false,
  },
  {
    id: 9,
    custom_section_field_id: 9,
    title: "Notes",
    type: "text",
    archived: false,
  },
]

test("DIAGNOSE: dump modal tree + custom fields editor", async ({
  context,
  extensionUrl,
}) => {
  test.setTimeout(60_000)

  // Capture every console message so we can see crashes / warnings.
  const messages: string[] = []
  context.on("page", (p) => {
    p.on("console", (msg) => {
      messages.push(`[${msg.type()}] ${msg.text()}`)
    })
    p.on("pageerror", (err) => {
      messages.push(`[pageerror] ${err.message}\n${err.stack}`)
    })
  })

  await installAuthStub(context)
  await installAPIOperationStub(context, {
    listApplications: { data: [] },
    listUnitTypes: { data: [{ unit_type_id: 1, name: "user_id" }] },
    listMetrics: { data: [] },
    listExperimentTags: { data: [] },
    listUsers: { data: [] },
    listTeams: { data: [] },
    listMetricUsages: { data: [] },
    listMetricCategories: { data: [] },
    listCustomSectionFields: { data: FIELDS },
  })

  const testPage = await context.newPage()
  const { sidebar } = await setupTestPage(
    testPage,
    extensionUrl,
    "/visual-editor-test.html"
  )

  await sidebar.locator('button[title="Create New Experiment"]').click()
  const fromScratch = sidebar.locator("#from-scratch-button")
  await fromScratch.waitFor({ state: "visible", timeout: 10_000 })
  await fromScratch.click()

  await sidebar.locator("#open-fullscreen-button").click()

  await sidebar
    .locator("#absmartly-fullscreen-host")
    .waitFor({ state: "attached", timeout: 10_000 })
  await sidebar
    .locator("#fullscreen-experiment-modal")
    .waitFor({ state: "visible", timeout: 10_000 })

  // Give React a tick to render the children after custom-fields are loaded.
  await sidebar.locator("#fullscreen-modal-body").waitFor({
    state: "attached",
    timeout: 5_000,
  })

  // Dump tree from inside the sidebar iframe context.
  const result = await sidebar.locator("body").evaluate(() => {
    const host = document.getElementById("absmartly-fullscreen-host")
    const root = host?.shadowRoot
    if (!root) return { error: "no shadow root" }
    const body = root.querySelector("#fullscreen-modal-body")
    if (!body) return { error: "no body" }
    const cfe = root.querySelector("#custom-fields-editor")
    const sections = Array.from(body.querySelectorAll(":scope > section")).map(
      (s) => {
        const headings = Array.from(s.querySelectorAll("h2,h3,label")).map(
          (h) => (h.textContent || "").slice(0, 40)
        )
        return {
          id: s.id || null,
          headings: headings.slice(0, 4),
          childCount: s.children.length,
        }
      }
    )
    const cfeInfo = cfe
      ? {
          children: cfe.children.length,
          fieldLabels: Array.from(cfe.querySelectorAll("label")).map((l) =>
            (l.textContent || "").slice(0, 40)
          ),
          html: (cfe as HTMLElement).outerHTML.slice(0, 2500),
        }
      : { missing: true }
    return { sections, cfeInfo }
  })

  console.log("=== DIAGNOSTIC ===")
  console.log(JSON.stringify(result, null, 2))
  console.log("=== END ===")

  // Now test: click the editor (no JS focus) and type. Does the text appear?
  console.log("=== TYPING TEST ===")
  const richInput = sidebar.locator("#cfe-input-7")
  await richInput.waitFor({ state: "visible", timeout: 5_000 })
  await richInput.click()
  await testPage.keyboard.type("hello")
  const editorText = await sidebar.locator("body").evaluate(() => {
    const ce = document
      .getElementById("absmartly-fullscreen-host")
      ?.shadowRoot?.getElementById("cfe-input-7")
    return ce?.textContent || "(empty)"
  })
  console.log("After type 'hello', editor textContent:", editorText)
  console.log("=== END TYPING ===")

  console.log("=== CONSOLE MESSAGES (last 50) ===")
  for (const m of messages.slice(-50)) console.log(m)
  console.log("=== END MESSAGES ===")

  expect(result).toBeDefined()
})
