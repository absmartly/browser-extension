/**
 * Rearrange drops replayed through the real PreviewManager and the real
 * @absmartly/sdk-plugins manipulator, the way the visual editor replays its
 * squashed change list (replace mode) after every committed move.
 */

import { PreviewManager } from "~src/sdk-bridge/dom/preview-manager"

import { EditModes } from "../edit-modes"
import { VISUAL_EDITOR_EXPERIMENT_NAME } from "../sdk-applier"
import StateManager from "../state-manager"
import UndoRedoManager from "../undo-redo-manager"

// jsdom has no DragEvent; the drop handler reads only these fields.
function dispatchDrag(
  drag: Element,
  drop: Element,
  opts: { altKey?: boolean; before?: boolean } = {}
): void {
  const make = (type: string) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperties(event, {
      altKey: { value: !!opts.altKey },
      // jsdom rects are all zero, so a negative clientY is the "top half".
      clientY: { value: opts.before ? -1 : 1 },
      dataTransfer: { value: null }
    })
    return event
  }
  drag.dispatchEvent(make("dragstart"))
  drop.dispatchEvent(make("dragover"))
  drop.dispatchEvent(make("drop"))
  drag.dispatchEvent(make("dragend"))
}

describe("EditModes rearrange replayed through PreviewManager", () => {
  let previewManager: PreviewManager
  let editModes: EditModes
  let undoRedo: UndoRedoManager

  beforeEach(() => {
    // jsdom applies no UA stylesheet, so spans must be declared inline for
    // the inline-drag (nest by default, Alt for sibling) rules to apply.
    document.head.innerHTML = "<style>span { display: inline }</style>"
    document.body.innerHTML = `<p id="rearrange-inline">
      <span>Alpha-i</span><span>Beta-i</span><span>Gamma-i</span>
    </p>`
    previewManager = new PreviewManager()
    undoRedo = new UndoRedoManager()
    editModes = new EditModes(
      new StateManager({ variantName: "v", experimentName: "e", logoUrl: "" })
    )
    // Same replace cycle the orchestrator runs for PREVIEW_CHANGES.
    undoRedo.setOnChangeAdded(() => {
      previewManager.removePreviewChanges(VISUAL_EDITOR_EXPERIMENT_NAME)
      for (const change of undoRedo.squashChanges()) {
        previewManager.applyPreviewChange(change, VISUAL_EDITOR_EXPERIMENT_NAME)
      }
    })
    editModes.setAddChangeCallback((change) => undoRedo.addChange(change, null))
  })

  afterEach(() => previewManager.clearAll())

  const topLevel = (selector: string) =>
    document.querySelector(`#rearrange-inline > span:nth-of-type(${selector})`)

  const topLevelLabels = () =>
    Array.from(document.querySelectorAll("#rearrange-inline > span")).map(
      (span) => span.firstChild?.textContent?.trim()
    )

  it("replays only the final drop when one element is dragged twice", () => {
    const gamma = topLevel("3")
    editModes.enableRearrangeMode(gamma)
    dispatchDrag(gamma, topLevel("1"), { altKey: true, before: true })
    expect(topLevelLabels()).toEqual(["Gamma-i", "Alpha-i", "Beta-i"])

    editModes.enableRearrangeMode(gamma)
    dispatchDrag(gamma, topLevel("3"), { altKey: true, before: true })
    expect(topLevelLabels()).toEqual(["Alpha-i", "Gamma-i", "Beta-i"])

    // Both drops carry gamma's positional selector from the unmodified
    // page; replaying the first one too would shift which span the second
    // selector names.
    const saved = undoRedo.squashChanges()
    expect(saved).toHaveLength(1)
    previewManager.removePreviewChanges(VISUAL_EDITOR_EXPERIMENT_NAME)
    for (const change of saved)
      previewManager.applyPreviewChange(change, "replay")
    expect(topLevelLabels()).toEqual(["Alpha-i", "Gamma-i", "Beta-i"])
  })

  it("keeps a positional move correct after an earlier move changed sibling positions", () => {
    const container = document.getElementById("rearrange-inline")
    const originalNodes = Array.from(container.childNodes)

    editModes.enableRearrangeMode(topLevel("3"))
    dispatchDrag(topLevel("3"), topLevel("1"))
    expect(topLevelLabels()).toEqual(["Alpha-i", "Beta-i"])
    expect(topLevel("1").querySelector("span").textContent).toBe("Gamma-i")

    editModes.enableRearrangeMode(topLevel("2"))
    dispatchDrag(topLevel("2"), topLevel("1"), { altKey: true, before: true })
    expect(topLevelLabels()).toEqual(["Beta-i", "Alpha-i"])
    expect(topLevel("2").querySelector("span").textContent).toBe("Gamma-i")

    // Drag-mode leaves its own class/draggable attributes behind; the
    // preview must restore the original nodes in their original slots.
    previewManager.removePreviewChanges(VISUAL_EDITOR_EXPERIMENT_NAME)
    const restored = Array.from(container.childNodes)
    expect(restored).toHaveLength(originalNodes.length)
    restored.forEach((node, i) => expect(node).toBe(originalNodes[i]))
  })
})
