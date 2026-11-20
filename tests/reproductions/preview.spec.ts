import type { Page } from "@playwright/test"

import { expect, test } from "./fixture"

type PreviewAction = "apply" | "update" | "remove"

const nextFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )

async function previewSender(page: Page, experimentName: string) {
  const worker =
    page.context().serviceWorkers()[0] ||
    (await page.context().waitForEvent("serviceworker"))
  return (action: PreviewAction, changes: unknown[] = []) =>
    worker.evaluate(
      async ({ action, changes, experimentName }) => {
        const tabs = await chrome.tabs.query({})
        const tab = tabs.find((tab) =>
          tab.url?.includes("/visual-editor-test.html")
        )!
        return chrome.tabs.sendMessage(tab.id!, {
          type: "ABSMARTLY_PREVIEW",
          action,
          experimentName,
          variantName: "Variant 1",
          changes
        })
      },
      { action, changes, experimentName }
    )
}

async function openPreviewPage(page: Page, origin: string) {
  await page.goto(`${origin}/visual-editor-test.html`)
  await expect(page.locator(".test-button")).toHaveCount(3)
  await page.evaluate(() => {
    const fixture = document.createElement("section")
    fixture.id = "preview-regression-fixture"
    fixture.innerHTML = `
      <div id="preview-sentinel">Sentinel</div>
      <div id="style-host"><button id="host-button">Click</button><input id="host-input"><span id="host-span">Original</span></div>
      <div id="structural-parent"><p id="structural-child">Original child</p></div>
      <div id="create-anchor"><span id="create-anchor-child">Anchor child</span></div>
      <div id="late-root"></div>
      <button id="colon-attrs" x-on:click="open = true" wire:click="save" title="orig">Colon</button>
      <svg id="colon-svg" viewBox="0 0 10 10" wire:ignore=""></svg>`
    document.body.append(fixture)
    const win = window as typeof window & {
      previewNodes?: Record<string, Element>
      previewClicks?: number
    }
    win.previewClicks = 0
    win.previewNodes = Object.fromEntries(
      [
        "host-button",
        "host-input",
        "host-span",
        "structural-child",
        "create-anchor-child"
      ].map((id) => [id, document.getElementById(id)!])
    )
    document.getElementById("host-button")!.addEventListener("click", () => {
      win.previewClicks!++
    })
    ;(document.getElementById("host-input") as HTMLInputElement).value =
      "typed by page"
  })
}

const sameNode = (page: Page, id: string) =>
  page.evaluate((id) => {
    const win = window as typeof window & {
      previewNodes: Record<string, Element>
    }
    return document.getElementById(id) === win.previewNodes[id]
  }, id)

test("packaged HTTP preview applies camelCase styles and restores them", async ({
  page,
  origin
}, testInfo) => {
  await page.goto(`${origin}/visual-editor-test.html`)
  await expect(page.locator(".test-button")).toHaveCount(3)
  const worker =
    page.context().serviceWorkers()[0] ||
    (await page.context().waitForEvent("serviceworker"))
  const capturedTargets = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({})
    const tab = tabs.find((tab) =>
      tab.url?.includes("/visual-editor-test.html")
    )!
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => document.querySelectorAll(".test-button").length
    })
    return result[0].result
  })
  expect(capturedTargets).toBe(3)
  const send = (action: string) =>
    worker.evaluate(
      async ({ action }) => {
        const tabs = await chrome.tabs.query({})
        const tab = tabs.find((tab) =>
          tab.url?.includes("/visual-editor-test.html")
        )!
        return chrome.tabs.sendMessage(tab.id!, {
          type: "ABSMARTLY_PREVIEW",
          action,
          experimentName: "FT-2244-file-preview",
          variantName: "Variant 1",
          changes: [
            {
              selector: ".test-button",
              type: "style",
              value: { backgroundColor: "orange" }
            }
          ]
        })
      },
      { action }
    )
  const original = await page
    .locator(".test-button")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  await send("apply")
  try {
    await expect(page.locator(".test-button").first()).toHaveCSS(
      "background-color",
      "rgb(255, 165, 0)"
    )
  } finally {
    await page.screenshot({
      path: testInfo.outputPath("http-preview-applied.png")
    })
  }
  await send("remove")
  await expect(page.locator(".test-button").first()).toHaveCSS(
    "background-color",
    original
  )
})

test("style preview removal keeps page-owned descendants, listeners and form state", async ({
  page,
  origin
}) => {
  await openPreviewPage(page, origin)
  const send = await previewSender(page, "preview-style-identity")
  await send("apply", [
    {
      selector: "#style-host",
      type: "style",
      value: { backgroundColor: "orange" }
    }
  ])
  await expect(page.locator("#style-host")).toHaveCSS(
    "background-color",
    "rgb(255, 165, 0)"
  )

  await send("remove")
  await expect(page.locator("#style-host")).not.toHaveAttribute(
    "data-absmartly-modified",
    "true"
  )
  await expect(page.locator("#style-host")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)"
  )
  for (const id of ["host-button", "host-input", "host-span"])
    expect(await sameNode(page, id)).toBe(true)
  await expect(page.locator("#host-input")).toHaveValue("typed by page")
  await page.locator("#host-button").click()
  expect(
    await page.evaluate(
      () => (window as typeof window & { previewClicks: number }).previewClicks
    )
  ).toBe(1)
})

test("overlapping ancestor and descendant previews restore one original descendant", async ({
  page,
  origin
}) => {
  await openPreviewPage(page, origin)
  const send = await previewSender(page, "preview-overlap")
  await send("apply", [
    {
      selector: "#structural-parent",
      type: "html",
      value: '<p id="structural-child">Preview child</p>'
    },
    {
      selector: "#structural-child",
      type: "text",
      value: "Preview descendant text"
    }
  ])
  await expect(page.locator("#structural-child")).toHaveText(
    "Preview descendant text"
  )

  await send("remove")
  await expect(page.locator("#structural-child")).toHaveText("Original child")
  await expect(page.locator("#structural-parent > p")).toHaveCount(1)
  expect(await sameNode(page, "structural-child")).toBe(true)
})

test("attribute preview removal restores colon-named attributes and SVG viewBox exactly", async ({
  page,
  origin
}) => {
  await openPreviewPage(page, origin)
  const attributes = (id: string) =>
    page
      .locator(`#${id}`)
      .evaluate((el) =>
        el.getAttributeNames().map((name) => [name, el.getAttribute(name)])
      )
  const before = {
    button: await attributes("colon-attrs"),
    svg: await attributes("colon-svg")
  }
  const send = await previewSender(page, "preview-colon-attributes")
  await send("apply", [
    {
      selector: "#colon-attrs",
      type: "attribute",
      value: { "x-on:click": null, "wire:click": null, title: "preview" }
    },
    {
      selector: "#colon-svg",
      type: "attribute",
      value: { viewBox: null, "wire:ignore": null }
    },
    {
      selector: "#preview-sentinel",
      type: "attribute",
      value: { "x-on:click": "added" }
    }
  ])
  await expect(page.locator("#colon-attrs")).toHaveAttribute("title", "preview")
  await expect(page.locator("#colon-attrs")).not.toHaveAttribute(
    "x-on:click",
    /.*/
  )
  await expect(page.locator("#colon-attrs")).not.toHaveAttribute(
    "wire:click",
    /.*/
  )
  await expect(page.locator("#colon-svg")).not.toHaveAttribute(
    "wire:ignore",
    /.*/
  )
  await expect(page.locator("#preview-sentinel")).toHaveAttribute(
    "x-on:click",
    "added"
  )
  expect(
    await page
      .locator("#colon-svg")
      .evaluate((el) => el.hasAttribute("viewBox"))
  ).toBe(false)

  await send("remove")
  await expect(page.locator("#colon-attrs")).toHaveAttribute("title", "orig")
  await expect(page.locator("#colon-attrs")).not.toHaveAttribute(
    "data-absmartly-modified",
    "true"
  )
  await expect(page.locator("#preview-sentinel")).not.toHaveAttribute(
    "x-on:click",
    /.*/
  )
  expect(await attributes("colon-attrs")).toEqual(before.button)
  expect(await attributes("colon-svg")).toEqual(before.svg)
})

test("packaged preview removal replays root attributes with parser-created xmlns", async ({
  page,
  origin
}) => {
  await page.route(`${origin}/visual-editor-test.html`, async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    await route.fulfill({
      response,
      body: html.replace(
        "<html>",
        '<html xmlns="http://www.w3.org/1999/xhtml">'
      )
    })
  })
  await openPreviewPage(page, origin)
  await page.evaluate(() => {
    document.documentElement.id = "preview-page-root"
    document.documentElement.title = "Original root title"
    document.getElementById("test-paragraph")!.title =
      "Original paragraph title"
  })
  const root = page.locator("#preview-page-root")
  const paragraph = page.locator("#test-paragraph")
  await expect(root).toHaveAttribute("xmlns", "http://www.w3.org/1999/xhtml")
  expect(
    await root.evaluate((el) => el.getAttributeNode("xmlns")!.namespaceURI)
  ).toBeNull()
  const snapshot = () =>
    page.evaluate(() => {
      const attributes = (el: Element) =>
        Array.from(el.attributes, (attr) => ({
          name: attr.name,
          value: attr.value,
          namespaceURI: attr.namespaceURI
        }))
      return {
        root: attributes(document.documentElement),
        body: attributes(document.body),
        paragraph: attributes(document.getElementById("test-paragraph")!),
        elementCount: document.querySelectorAll("*").length
      }
    })
  const before = await snapshot()
  const sendA = await previewSender(page, "preview-parser-xmlns-a")
  const sendB = await previewSender(page, "preview-parser-xmlns-b")
  await sendA("apply", [
    {
      selector: "#test-paragraph",
      type: "attribute",
      value: { title: "Preview A paragraph title" }
    }
  ])
  await expect(paragraph).toHaveAttribute("title", "Preview A paragraph title")
  await sendB("apply", [
    {
      selector: "#preview-page-root",
      type: "attribute",
      value: { title: "Preview B root title", xmlns: null }
    }
  ])
  await expect(root).toHaveAttribute("title", "Preview B root title")
  await expect(root).not.toHaveAttribute("xmlns", /.*/)
  await expect(paragraph).toHaveAttribute("title", "Preview A paragraph title")

  await sendA("remove")
  await expect(paragraph).toHaveAttribute("title", "Original paragraph title")
  await expect(root).toHaveAttribute("title", "Preview B root title")
  await expect(root).not.toHaveAttribute("xmlns", /.*/)
  await expect(root).toHaveAttribute(
    "data-absmartly-experiment",
    "preview-parser-xmlns-b"
  )
  await expect
    .poll(async () => (await snapshot()).paragraph)
    .toEqual(before.paragraph)

  await sendB("remove")
  await expect(root).toHaveAttribute("title", "Original root title")
  await expect(root).toHaveAttribute("xmlns", "http://www.w3.org/1999/xhtml")
  await expect(
    page.locator(
      "[data-absmartly-experiment], [data-absmartly-modified], [data-absmartly-original]"
    )
  ).toHaveCount(0)
  await expect(page.locator("#absmartly-preview-header-host")).toHaveCount(0)
  await expect.poll(snapshot).toEqual(before)
  expect(
    await root.evaluate((el) => el.getAttributeNode("xmlns")!.namespaceURI)
  ).toBeNull()
})

test("created preview nodes are removed for every insertion position", async ({
  page,
  origin
}) => {
  await openPreviewPage(page, origin)
  const send = await previewSender(page, "preview-create-positions")
  const positions = ["before", "after", "firstChild", "lastChild"]
  await send(
    "apply",
    positions.map((position) => ({
      selector: `#preview-created-${position}`,
      type: "create",
      targetSelector: "#create-anchor",
      position,
      element: `<p id="preview-created-${position}">${position}</p>`
    }))
  )
  for (const position of positions) {
    await expect(page.locator(`#preview-created-${position}`)).toHaveCount(1)
  }
  await expect(
    page.locator("#create-anchor > #preview-created-firstChild")
  ).toHaveCount(1)
  await expect(
    page.locator("#create-anchor > #preview-created-lastChild")
  ).toHaveCount(1)

  await send("remove")
  for (const position of positions) {
    await expect(page.locator(`#preview-created-${position}`)).toHaveCount(0)
  }
  expect(await sameNode(page, "create-anchor-child")).toBe(true)
})

test("SPA preview applies late mounts while active and cancels pending work on replacement and removal", async ({
  page,
  origin
}) => {
  await openPreviewPage(page, origin)
  const send = await previewSender(page, "preview-spa-pending")
  const sentinel = {
    selector: "#preview-sentinel",
    type: "style",
    value: { color: "rgb(1, 2, 3)" }
  }
  const pending = (selector: string) => ({
    selector,
    type: "style",
    value: { backgroundColor: "orange" }
  })
  const mount = (id: string) =>
    page.evaluate((id) => {
      const element = document.createElement("div")
      element.id = id
      element.textContent = id
      document.getElementById("late-root")!.append(element)
    }, id)

  await send("apply", [
    sentinel,
    pending("#late-active"),
    pending("#late-replaced")
  ])
  await expect(page.locator("#preview-sentinel")).toHaveCSS(
    "color",
    "rgb(1, 2, 3)"
  )
  await mount("late-active")
  await expect(page.locator("#late-active")).toHaveCSS(
    "background-color",
    "rgb(255, 165, 0)"
  )

  await send("update", [{ ...sentinel, value: { color: "rgb(4, 5, 6)" } }])
  await expect(page.locator("#preview-sentinel")).toHaveCSS(
    "color",
    "rgb(4, 5, 6)"
  )
  await expect(page.locator("#late-active")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)"
  )
  await mount("late-replaced")

  await send("apply", [sentinel, pending("#late-removed")])
  await expect(page.locator("#preview-sentinel")).toHaveCSS(
    "color",
    "rgb(1, 2, 3)"
  )
  await send("remove")
  await expect(page.locator("#preview-sentinel")).not.toHaveAttribute(
    "data-absmartly-modified",
    "true"
  )
  await mount("late-removed")
  await nextFrames(page)

  await expect(page.locator("#late-active")).toHaveCount(1)
  for (const id of ["late-replaced", "late-removed"]) {
    await expect(page.locator(`#${id}`)).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)"
    )
    await expect(page.locator(`#${id}`)).not.toHaveAttribute(
      "data-absmartly-modified",
      "true"
    )
  }
})
