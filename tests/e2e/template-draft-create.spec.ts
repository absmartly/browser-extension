import { expect, test } from "../fixtures/extension"
import { experimentRecord } from "../helpers/management-api/records"
import { assertNativeFormValid } from "./helpers/ve-experiment-setup"
import { setupTestPage } from "./utils/test-helpers"

test("creates a template draft and reopens it with the saved unit type", async ({
  context,
  extensionUrl,
  managementApi
}) => {
  test.setTimeout(10000)
  const template = experimentRecord({
    id: 900,
    name: "template_with_session_unit_type",
    type: "test_template",
    unit_type_id: 22,
    unit_type: null
  })
  managementApi.state.experiments.push(template)
  const name = "template_draft_unit_type_regression"
  const unitType = managementApi.state.resources.unit_types[0]
  const page = await context.newPage()
  const { sidebar } = await setupTestPage(
    page,
    extensionUrl,
    "/persistence-test.html"
  )

  await sidebar.locator("#create-experiment-menu-button").click()
  await sidebar.locator("#load-template-900-button").click()
  await expect(sidebar.locator("#experiment-name-input")).toHaveValue("")
  await sidebar.locator("#display-name-input").fill("Template draft regression")
  await sidebar.locator("#experiment-name-input").fill(name)
  await sidebar.locator("#unit-type-select-trigger").click()
  await sidebar
    .locator(
      `#unit-type-select-dropdown [data-testid="searchable-select-option-${unitType.id}"]`
    )
    .click()
  await expect(sidebar.locator("#unit-type-select-trigger")).toContainText(
    unitType.name
  )
  await assertNativeFormValid(sidebar)

  const createdResponse = context.waitForEvent("response", {
    predicate: (response) =>
      ["POST", "PUT"].includes(response.request().method()) &&
      /^\/v1\/experiments(?:\/\d+)?$/.test(new URL(response.url()).pathname)
  })
  await sidebar.locator("#create-experiment-button").click()
  const response = await createdResponse
  expect(
    response.request().method(),
    "A template draft must create, never update id 0"
  ).toBe("POST")
  expect(response.status()).toBe(200)
  const { experiment: created } = await response.json()
  expect(created).toMatchObject({
    name,
    state: "created",
    unit_type_id: unitType.id
  })
  expect(created.id).toBeGreaterThan(0)
  expect(managementApi.callsTo("POST", "/v1/experiments")).toHaveLength(1)
  expect(
    managementApi.callsTo("POST", "/v1/experiments")[0].body
  ).toMatchObject({
    name,
    unit_type: { unit_type_id: unitType.id }
  })
  expect(managementApi.callsTo("PUT", /^\/v1\/experiments\//)).toHaveLength(0)
  await expect(sidebar.locator("#experiments-heading")).toBeVisible()

  // The template remains selected with id 0 and its original unit type. Hold the
  // detail GET until that stale selection has actually mounted in the UI.
  let releaseDetail!: () => void
  const detailGate = new Promise<void>((resolve) => {
    releaseDetail = resolve
  })
  managementApi.override(async ({ method, url }) => {
    if (method === "GET" && url.pathname === `/v1/experiments/${created.id}`) {
      await detailGate
    }
    return undefined
  })
  try {
    await sidebar.locator(`[data-experiment-name="${name}"]`).click()
    await expect(sidebar.locator("#unit-type-select-trigger")).toContainText(
      "session_id"
    )
    releaseDetail()
    await expect(sidebar.locator("#experiment-detail-name")).toHaveText(name)
    await expect(sidebar.locator("#unit-type-select-trigger")).toContainText(
      unitType.name
    )
    expect(
      managementApi.callsTo("GET", `/v1/experiments/${created.id}`)
    ).toHaveLength(1)
  } finally {
    releaseDetail()
  }
  await page.close()
})
