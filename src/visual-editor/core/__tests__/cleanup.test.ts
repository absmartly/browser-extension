import { PreviewManager } from "~src/sdk-bridge/dom/preview-manager"

import Cleanup from "../cleanup"
import EventHandlers from "../event-handlers"
import { VISUAL_EDITOR_EXPERIMENT_NAME } from "../sdk-applier"
import StateManager from "../state-manager"

describe("Cleanup on visual-editor exit with unsaved changes", () => {
  it("leaves restoration to the journal instead of replaying selection sidecars", () => {
    document.body.innerHTML =
      '<div id="wrap"><span id="child">Original</span></div>'
    const child = document.getElementById("child")
    const wrap = document.getElementById("wrap")
    const stateManager = new StateManager({
      variantName: "v",
      experimentName: "exp",
      logoUrl: ""
    })
    const preview = new PreviewManager()
    preview.applyPreviewChange(
      { selector: "#child", type: "text", value: "Preview" },
      VISUAL_EDITOR_EXPERIMENT_NAME
    )
    // Selecting the container serializes the previewed descendant.
    new EventHandlers(stateManager).handleClick({
      target: wrap,
      preventDefault: () => {},
      stopPropagation: () => {}
    } as unknown as MouseEvent)
    expect(wrap.hasAttribute("data-absmartly-original")).toBe(true)
    // A later edit replays the change list (replace mode).
    preview.removePreviewChanges(VISUAL_EDITOR_EXPERIMENT_NAME)
    preview.applyPreviewChange(
      { selector: "#child", type: "text", value: "Edited" },
      VISUAL_EDITOR_EXPERIMENT_NAME
    )

    // stop(): Cleanup runs synchronously; the journal removal posted to the
    // page lands after it.
    new Cleanup(stateManager).cleanupVisualEditor(true)
    preview.removePreviewChanges(VISUAL_EDITOR_EXPERIMENT_NAME)

    expect(wrap.firstChild).toBe(child)
    expect(wrap.childNodes).toHaveLength(1)
    expect(child.outerHTML).toBe('<span id="child">Original</span>')
    expect(
      wrap.getAttributeNames().filter((name) => name.startsWith("data-"))
    ).toEqual([])
  })
})

describe("visual-editor selection over a journaled preview", () => {
  it("restores the original text node after selection, html preview and removal", () => {
    document.body.innerHTML = '<p id="p">Original</p>'
    const paragraph = document.getElementById("p")
    const text = paragraph.firstChild
    const stateManager = new StateManager({
      variantName: "v",
      experimentName: "exp",
      logoUrl: ""
    })
    const handlers = new EventHandlers(stateManager)
    handlers.showContextMenu = () => {}
    const preview = new PreviewManager()

    handlers.handleClick({
      target: paragraph,
      preventDefault: () => {},
      stopPropagation: () => {}
    } as unknown as MouseEvent)
    preview.applyPreviewChange(
      { selector: "#p", type: "html", value: "<b>Preview</b>" },
      "exp"
    )
    // Selecting again after the preview applied keeps the first sidecar.
    handlers.handleClick({
      target: paragraph,
      preventDefault: () => {},
      stopPropagation: () => {}
    } as unknown as MouseEvent)
    preview.removePreviewChanges("exp")

    expect(paragraph.firstChild).toBe(text)
    expect(paragraph.childNodes).toHaveLength(1)
    expect(paragraph.hasAttribute("data-absmartly-original")).toBe(false)
    expect(paragraph.hasAttribute("data-absmartly-experiment")).toBe(false)
  })
})
