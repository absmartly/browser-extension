import UIComponents from "../../ui/components"
import { Notifications } from "../../ui/notifications"
import Cleanup from "../cleanup"
import ContextMenu from "../context-menu"
import EditModes from "../edit-modes"
import {
  EditorCoordinator,
  type EditorCoordinatorCallbacks
} from "../editor-coordinator"
import { ElementActions } from "../element-actions"
import EventHandlers from "../event-handlers"
import StateManager from "../state-manager"
import UndoRedoManager from "../undo-redo-manager"

// Real visual-editor modules wired the way VisualEditor wires them; only the
// callbacks that the Delete key does not reach are no-ops.
function buildEditor() {
  const stateManager = new StateManager({
    variantName: "v",
    experimentName: "e",
    logoUrl: ""
  })
  const undoRedoManager = new UndoRedoManager()
  const notifications = new Notifications()
  const elementActions = new ElementActions(
    stateManager,
    undoRedoManager,
    notifications,
    { onChangesUpdate: () => {} }
  )
  const noop = () => {}
  const callbacks: EditorCoordinatorCallbacks = {
    onChangesUpdate: noop,
    removeStyles: noop,
    getSelector: (element) => elementActions.getSelector(element),
    hideElement: noop,
    deleteElement: () => elementActions.deleteElement(),
    copyElement: noop,
    copySelectorPath: noop,
    moveElement: noop,
    insertNewBlock: noop,
    showRelativeElementSelector: noop,
    changeImageSource: noop,
    undoLastChange: noop,
    redoChange: noop,
    undo: noop,
    redo: noop,
    clearAllChanges: noop,
    saveChanges: noop,
    stop: noop
  }
  const cleanup = new Cleanup(stateManager)
  const coordinator = new EditorCoordinator(
    stateManager,
    new EventHandlers(stateManager),
    new ContextMenu(stateManager, false),
    undoRedoManager,
    new UIComponents(stateManager),
    new EditModes(stateManager),
    cleanup,
    null,
    notifications,
    callbacks
  )
  coordinator.setupKeyboardHandlers()
  return { stateManager, undoRedoManager, cleanup }
}

describe("EditorCoordinator Delete key", () => {
  let editor: ReturnType<typeof buildEditor>

  beforeEach(() => {
    document.body.innerHTML = `
      <section><div><button>Keep</button></div></section>
      <section><div><button>Delete me</button></div></section>`
    editor = buildEditor()
  })

  afterEach(() => {
    editor.cleanup.cleanupVisualEditor?.()
    document.body.innerHTML = ""
  })

  it("records a delete selector that matches exactly the selected element", () => {
    const target = document.querySelectorAll("button")[1]
    const others = Array.from(document.querySelectorAll("button")).filter(
      (button) => button !== target
    )
    editor.stateManager.setSelectedElement(target)

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }))

    const changes = editor.undoRedoManager.squashChanges()
    expect(changes).toHaveLength(1)
    expect(changes[0].type).toBe("delete")
    const matches = document.querySelectorAll(changes[0].selector)
    expect(matches).toHaveLength(1)
    expect(matches[0]).toBe(target)
    others.forEach((button) => expect(button.isConnected).toBe(true))
  })
})
