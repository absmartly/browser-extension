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

    expect(document.getElementById("child")).toBe(child)
    expect(wrap.outerHTML).toBe(
      '<div id="wrap" class=""><span id="child">Original</span></div>'
    )
  })
})
