import { render } from "@testing-library/react"
import React from "react"

import { sendToContent } from "~src/lib/messaging"

import { VariantConfigJSONEditor } from "../VariantConfigJSONEditor"

jest.mock("~src/lib/messaging", () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined)
}))

describe("VariantConfigJSONEditor (FT-2251)", () => {
  const variant = {
    name: "Variant 1",
    config: { cta_color: "blue", __dom_changes: [] }
  }
  let listener: (message: any) => void

  beforeEach(() => {
    ;(global as any).chrome.runtime = {
      onMessage: {
        addListener: jest.fn((fn) => {
          listener = fn
        }),
        removeListener: jest.fn()
      }
    }
  })

  const renderEditor = (domFieldName?: string) => {
    const onSave = jest.fn()
    const onClose = jest.fn()
    render(
      <VariantConfigJSONEditor
        isOpen={true}
        onClose={onClose}
        variant={variant as any}
        onSave={onSave}
        domFieldName={domFieldName}
      />
    )
    return { onSave, onClose }
  }

  it("ignores a top-level array instead of replacing the variant config", () => {
    const { onSave, onClose } = renderEditor()
    listener({
      type: "JSON_EDITOR_SAVE",
      value: '[{"selector":"#main-title","type":"text","value":"x"}]'
    })
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("saves an object config", () => {
    const { onSave, onClose } = renderEditor()
    listener({ type: "JSON_EDITOR_SAVE", value: '{"cta_color":"green"}' })
    expect(onSave).toHaveBeenCalledWith({
      name: "Variant 1",
      config: { cta_color: "green" }
    })
    expect(onClose).toHaveBeenCalled()
  })

  it("sends the configured DOM field to the content editor and preserves valid full config", () => {
    const { onSave } = renderEditor("custom_dom")
    expect(sendToContent).toHaveBeenCalledWith({
      type: "OPEN_JSON_EDITOR",
      data: {
        variantName: variant.name,
        value: JSON.stringify(variant.config, null, 2),
        domFieldName: "custom_dom"
      }
    })
    const config = {
      color: "green",
      __dom_changes: "ordinary variable",
      custom_dom: [{ selector: "#heading", type: "text", value: "Updated" }]
    }
    listener({ type: "JSON_EDITOR_SAVE", value: JSON.stringify(config) })
    expect(onSave).toHaveBeenCalledWith({ name: variant.name, config })
  })

  it.each([[null], { changes: [null] }, { changes: "invalid" }])(
    "rejects malformed data in the configured DOM field: %p",
    (value) => {
      const { onSave, onClose } = renderEditor("custom_dom")
      listener({
        type: "JSON_EDITOR_SAVE",
        value: JSON.stringify({ custom_dom: value })
      })
      expect(onSave).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
    }
  )

  it.each([
    null,
    "invalid",
    { urlFilter: "/products/*" },
    { changes: "invalid" },
    [null],
    { changes: [null] }
  ])("rejects invalid nested DOM changes: %p", (value) => {
    const { onSave, onClose } = renderEditor()
    listener({
      type: "JSON_EDITOR_SAVE",
      value: JSON.stringify({ color: "green", __dom_changes: value })
    })
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it.each([[], { changes: [], urlFilter: "/products/*" }])(
    "preserves valid DOM changes and custom values: %p",
    (value) => {
      const { onSave, onClose } = renderEditor()
      const config = { color: "green", __dom_changes: value }
      listener({ type: "JSON_EDITOR_SAVE", value: JSON.stringify(config) })
      expect(onSave).toHaveBeenCalledWith({ name: "Variant 1", config })
      expect(onClose).toHaveBeenCalled()
    }
  )
})
