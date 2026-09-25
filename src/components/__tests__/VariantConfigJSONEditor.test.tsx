import { render } from "@testing-library/react"
import React from "react"

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

  const renderEditor = () => {
    const onSave = jest.fn()
    const onClose = jest.fn()
    render(
      <VariantConfigJSONEditor
        isOpen={true}
        onClose={onClose}
        variant={variant as any}
        onSave={onSave}
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
})
