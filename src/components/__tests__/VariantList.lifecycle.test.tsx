import { act, cleanup, fireEvent, render } from "@testing-library/react"
import React, { useState } from "react"

import "@testing-library/jest-dom"

import { localAreaStorage } from "~src/utils/storage"

import { VariantList } from "../VariantList"

jest.mock("~src/lib/messaging", () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined)
}))
jest.mock("~src/utils/storage", () => ({
  localAreaStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  },
  sessionStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  }
}))
jest.mock("~src/utils/storage-cleanup", () => ({
  clearVisualEditorSessionStorage: jest.fn().mockResolvedValue(undefined)
}))

let listeners: Set<any>
let storageListeners: Set<any>
let update: jest.Mock
const el = (id: string) => document.getElementById(id)!
const variant = (name: string, pattern: string) => ({
  name,
  config: {
    color: "blue",
    __dom_changes: {
      changes: [],
      urlFilter: { include: [pattern], mode: "simple", matchType: "path" }
    }
  }
})
const server = [{ name: "Control", config: {} }, variant("Variant 1", "/old/*")]
const restored = [server[0], variant("Draft B", "/new/*")]

function Parent({ initial = server }: { initial?: any[] }) {
  const [variants, setVariants] = useState(initial)
  return (
    <VariantList
      experimentId={501}
      experimentName="synthetic"
      domFieldName="__dom_changes"
      initialVariants={variants}
      onVariantsChange={(next) => {
        update(next)
        setVariants(next)
      }}
    />
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(localAreaStorage.get).mockResolvedValue(null)
  update = jest.fn()
  listeners = new Set()
  storageListeners = new Set()
  ;(global as any).chrome = {
    tabs: {
      query: jest
        .fn()
        .mockResolvedValue([
          { id: 1, url: "https://example.invalid/products/1" }
        ])
    },
    runtime: {
      onMessage: {
        addListener: (f: any) => listeners.add(f),
        removeListener: (f: any) => listeners.delete(f)
      },
      sendMessage: jest.fn().mockResolvedValue({})
    },
    storage: {
      session: {
        onChanged: {
          addListener: (f: any) => storageListeners.add(f),
          removeListener: (f: any) => storageListeners.delete(f)
        }
      }
    }
  }
})
afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
})

it("restores a renamed draft and saves its current URL pattern after a match-type edit", async () => {
  let release!: (value: any) => void
  const pending = new Promise((resolve) => {
    release = resolve
  })
  jest
    .mocked(localAreaStorage.get)
    .mockImplementation((key: any) =>
      key === "experiment-501-variants" ? pending : Promise.resolve(null)
    )
  render(<Parent />)
  await act(async () => {
    release(restored)
  })
  expect(el("variant-name-input-1")).toHaveValue("Draft B")
  fireEvent.click(el("url-filtering-toggle-variant-1"))
  expect(el("url-filter-pattern-variant-1-0")).toHaveValue("/new/*")
  fireEvent.change(el("url-filter-match-type-variant-1"), {
    target: { value: "full-url" }
  })
  expect(update.mock.calls.at(-1)[0][1].config.__dom_changes.urlFilter).toEqual(
    { include: ["/new/*"], mode: "simple", matchType: "full-url" }
  )
})

it("refreshes child inputs when an external replacement changes a variant config", async () => {
  const props = {
    experimentId: 501,
    experimentName: "synthetic",
    domFieldName: "__dom_changes",
    onVariantsChange: update
  }
  const view = render(<VariantList {...props} initialVariants={server} />)
  await act(async () => {})
  view.rerender(<VariantList {...props} initialVariants={restored} />)
  await act(async () => {})
  fireEvent.click(el("url-filtering-toggle-variant-1"))
  expect(el("url-filter-pattern-variant-1-0")).toHaveValue("/new/*")
})

it.each(["VISUAL_EDITOR_CHANGES", "VISUAL_EDITOR_CHANGES_COMPLETE", "storage"])(
  "does not restore a deleted variant when surviving B receives %s",
  async (type) => {
    render(
      <Parent
        initial={[server[0], variant("A", "/a/*"), variant("B", "/b/*")]}
      />
    )
    await act(async () => {})
    fireEvent.click(el("variant-delete-1"))
    expect(update.mock.calls.at(-1)[0].map((v: any) => v.name)).toEqual([
      "Control",
      "B"
    ])
    const change = { selector: "#heading", type: "text", value: "Updated B" }
    await act(async () => {
      if (type === "storage") {
        for (const fn of [...storageListeners])
          fn({
            visualEditorChanges: {
              newValue: { variantName: "B", changes: [change] }
            }
          })
      } else {
        for (const fn of [...listeners])
          fn({ type, variantName: "B", changes: [change] }, {}, () => {})
      }
    })
    const saved = update.mock.calls.at(-1)[0]
    expect(saved.map((v: any) => v.name)).toEqual(["Control", "B"])
    expect(saved[1].config.color).toBe("blue")
    expect(saved[1].config.__dom_changes.changes).toEqual([change])
    expect(saved[1].config.__dom_changes.urlFilter.include).toEqual(["/b/*"])
  }
)
