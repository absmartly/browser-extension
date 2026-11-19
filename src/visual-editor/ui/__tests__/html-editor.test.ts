import StateManager from "../../core/state-manager"
import HtmlEditor from "../html-editor"

describe("HtmlEditor", () => {
  let editor: HtmlEditor

  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML =
      '<svg id="icon"><rect id="r" class="a b"></rect></svg>'
    editor = new HtmlEditor(
      new StateManager({
        experimentName: "Test",
        variantName: "Control",
        initialChanges: [],
        logoUrl: ""
      })
    )
  })

  afterEach(() => jest.restoreAllMocks())

  it("opens on an SVG target and settles null when cleaned up", async () => {
    const target = document.getElementById("r")
    const shown = editor.show(target, target.innerHTML)
    // Asserted below; keeps a rejection from escaping as unhandled.
    shown.catch(() => {})
    expect(document.getElementById("absmartly-html-editor-host")).not.toBeNull()
    expect(document.querySelector(".editor-tag-info").textContent).toBe(
      "<rect.a.b>"
    )

    expect(() => editor.cleanup()).not.toThrow()

    await expect(shown).resolves.toBeNull()
    expect(document.getElementById("absmartly-html-editor-host")).toBeNull()
    expect(document.getElementById("absmartly-html-editor-styles")).toBeNull()
  })

  it("removes partially created UI and rejects when setup throws", async () => {
    document.body.innerHTML = '<div id="d" class="a">x</div>'
    const target = document.getElementById("d")
    const failure = new Error("mount failed")
    jest.spyOn(document.body, "appendChild").mockImplementationOnce(() => {
      throw failure
    })

    await expect(editor.show(target, "")).rejects.toBe(failure)

    expect(document.getElementById("absmartly-html-editor-styles")).toBeNull()
    expect(document.getElementById("absmartly-html-editor-host")).toBeNull()
    expect(() => editor.cleanup()).not.toThrow()
  })
})
