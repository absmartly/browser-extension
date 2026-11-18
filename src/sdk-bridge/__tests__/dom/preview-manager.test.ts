/**
 * PreviewManager tests against the real @absmartly/sdk-plugins manipulator.
 */

import type { DOMChange } from "~src/types/dom-changes"

import { PreviewManager } from "../../dom/preview-manager"

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

// The SDK queues late matches from a MutationObserver callback (microtask)
// into a requestAnimationFrame batch; two frames cover both hops.
const settle = async () => {
  await Promise.resolve()
  await nextFrame()
  await nextFrame()
}

const byId = (id: string) => document.getElementById(id)

const mount = (html: string) => {
  const holder = document.createElement("div")
  holder.innerHTML = html
  const nodes = Array.from(holder.childNodes)
  document.body.append(...nodes)
  return nodes
}

describe("PreviewManager", () => {
  let manager: PreviewManager

  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    manager = new PreviewManager()
  })

  afterEach(() => {
    manager.clearAll()
  })

  it("keeps host descendants by identity when a style preview is removed", () => {
    document.body.innerHTML =
      '<div id="h"><button id="b">Buy</button><input id="i"></div>'
    const button = byId("b")
    const input = byId("i") as HTMLInputElement
    input.value = "typed"
    const click = jest.fn()
    button.addEventListener("click", click)

    manager.applyPreviewChange(
      { selector: "#h", type: "style", value: { color: "red" } },
      "exp"
    )
    expect(byId("h").style.color).toBe("red")
    manager.removePreviewChanges("exp")

    expect(byId("h").style.color).toBe("")
    expect(byId("b")).toBe(button)
    expect(byId("i")).toBe(input)
    expect(input.value).toBe("typed")
    byId("b").click()
    expect(click).toHaveBeenCalledTimes(1)
  })

  it("restores one original descendant when a later change targets content an html change introduced", () => {
    document.body.innerHTML = '<div id="p"><p id="c">Orig</p></div>'
    const original = byId("c")

    manager.applyPreviewChange(
      { selector: "#p", type: "html", value: '<p id="c">New</p>' },
      "exp"
    )
    expect(byId("c")).not.toBe(original)
    manager.applyPreviewChange(
      { selector: "#c", type: "text", value: "Preview child" },
      "exp"
    )
    manager.removePreviewChanges("exp")

    const children = document.querySelectorAll("#p > p")
    expect(children).toHaveLength(1)
    expect(children[0]).toBe(original)
    expect(original.textContent).toBe("Orig")
  })

  it("restores the original descendant when it was changed before its ancestor", () => {
    document.body.innerHTML = '<div id="p"><p id="c">Orig</p></div>'
    const original = byId("c")

    manager.applyPreviewChange(
      { selector: "#c", type: "text", value: "Preview child" },
      "exp"
    )
    manager.applyPreviewChange(
      { selector: "#p", type: "html", value: "<span>Replaced</span>" },
      "exp"
    )
    manager.removePreviewChanges("exp")

    const children = document.querySelectorAll("#p > *")
    expect(children).toHaveLength(1)
    expect(children[0]).toBe(original)
    expect(original.textContent).toBe("Orig")
  })

  it.each(["before", "after", "firstChild", "lastChild"] as const)(
    "removes nodes created at %s",
    (position) => {
      document.body.innerHTML =
        '<section id="s"><div id="t"><span id="a">A</span></div></section>'
      const anchorChild = byId("a")

      const success = manager.applyPreviewChange(
        {
          selector: "",
          type: "create",
          element: `<em id="n1"></em><em id="n2"></em>`,
          targetSelector: "#t",
          position
        },
        "exp"
      )
      expect(success).toBe(true)
      expect(byId("n1")).not.toBeNull()
      expect(byId("n2")).not.toBeNull()

      manager.removePreviewChanges("exp")

      expect(byId("n1")).toBeNull()
      expect(byId("n2")).toBeNull()
      expect(byId("a")).toBe(anchorChild)
      expect(byId("t").childNodes).toHaveLength(1)
    }
  )

  it.each(["before", "after", "firstChild", "lastChild"] as const)(
    "keeps a node created at %s removed when a later change styled it",
    (position) => {
      document.body.innerHTML =
        '<section id="s"><div id="t"><span id="a">A</span></div></section>'

      manager.applyPreviewChange(
        {
          selector: "",
          type: "create",
          element: '<i id="new">N</i>',
          targetSelector: "#t",
          position
        },
        "exp"
      )
      manager.applyPreviewChange(
        { selector: "#new", type: "style", value: { color: "red" } },
        "exp"
      )
      expect(byId("new").style.color).toBe("red")

      manager.removePreviewChanges("exp")

      expect(byId("new")).toBeNull()
      expect(byId("s").innerHTML).toBe(
        '<div id="t"><span id="a">A</span></div>'
      )
    }
  )

  it("does not accumulate created nodes over apply/remove cycles", () => {
    document.body.innerHTML = '<div id="t"><span id="a">A</span></div>'
    const changes: DOMChange[] = [
      {
        selector: "",
        type: "create",
        element: '<i class="new">N</i>',
        targetSelector: "#t",
        position: "lastChild"
      },
      { selector: "i.new", type: "style", value: { color: "red" } }
    ]

    for (let cycle = 0; cycle < 3; cycle++) {
      for (const change of changes) manager.applyPreviewChange(change, "exp")
      expect(document.querySelectorAll("i.new")).toHaveLength(1)
      manager.removePreviewChanges("exp")
      expect(document.querySelectorAll("i.new")).toHaveLength(0)
    }
    expect(byId("t").innerHTML).toBe('<span id="a">A</span>')
  })

  it("restores original children by identity after a style then html change on one element", () => {
    document.body.innerHTML = '<div id="h"><b id="k">Keep</b></div>'
    const child = byId("k")

    manager.applyPreviewChange(
      { selector: "#h", type: "style", value: { color: "red" } },
      "exp"
    )
    manager.applyPreviewChange(
      { selector: "#h", type: "html", value: "<i>Swapped</i>" },
      "exp"
    )
    expect(byId("k")).toBeNull()
    manager.removePreviewChanges("exp")

    expect(byId("h").childNodes).toHaveLength(1)
    expect(byId("h").firstChild).toBe(child)
    expect(byId("h").style.color).toBe("")
  })

  it("restores a move preview to the original position", () => {
    document.body.innerHTML =
      '<div id="from"><span id="m">M</span><span id="z">Z</span></div><div id="to"></div>'
    const moved = byId("m")

    manager.applyPreviewChange(
      {
        selector: "#m",
        type: "move",
        targetSelector: "#to",
        position: "lastChild"
      } as DOMChange,
      "exp"
    )
    expect(moved.parentElement).toBe(byId("to"))
    manager.removePreviewChanges("exp")

    expect(moved.parentElement).toBe(byId("from"))
    expect(byId("from").firstChild).toBe(moved)
    expect(moved.nextSibling).toBe(byId("z"))
  })

  it("restores a deleted element to the original position", () => {
    document.body.innerHTML =
      '<ul id="l"><li id="x">X</li><li id="y">Y</li></ul>'
    const deleted = byId("x")

    manager.applyPreviewChange({ selector: "#x", type: "delete" }, "exp")
    expect(byId("x")).toBeNull()
    manager.removePreviewChanges("exp")

    expect(byId("l").firstChild).toBe(deleted)
    expect(deleted.nextSibling).toBe(byId("y"))
  })

  describe("SPA pending changes", () => {
    const lateStyle: DOMChange = {
      selector: "#late",
      type: "style",
      value: { color: "red" }
    }

    it("applies to a late mount and restores it on removal", async () => {
      manager.applyPreviewChange(lateStyle, "exp")
      mount('<div id="late">L</div>')
      await settle()
      expect(byId("late").style.color).toBe("red")

      manager.removePreviewChanges("exp")

      expect(byId("late").style.color).toBe("")
      expect(byId("late").hasAttribute("data-absmartly-experiment")).toBe(false)
    })

    it("does not apply to a mount after removal", async () => {
      manager.applyPreviewChange(lateStyle, "exp")
      manager.removePreviewChanges("exp")

      mount('<div id="late">L</div>')
      await settle()

      expect(byId("late").style.color).toBe("")
    })

    it("drops a batched application when removal happens before the frame", async () => {
      manager.applyPreviewChange(lateStyle, "exp")
      mount('<div id="late">L</div>')
      await Promise.resolve()

      manager.removePreviewChanges("exp")
      await settle()

      expect(byId("late").style.color).toBe("")
    })

    it("cancels a pending-only session on clearAll", async () => {
      manager.applyPreviewChange(lateStyle, "exp")
      manager.clearAll()

      mount('<div id="late">L</div>')
      await settle()

      expect(byId("late").style.color).toBe("")
    })

    it("keeps another experiment's pending and applied changes when one is removed", async () => {
      document.body.innerHTML = '<div id="now">N</div>'
      manager.applyPreviewChange(lateStyle, "a")
      manager.applyPreviewChange(
        { selector: "#now", type: "style", value: { color: "blue" } },
        "b"
      )
      manager.applyPreviewChange(
        { selector: "#later-b", type: "style", value: { color: "green" } },
        "b"
      )

      manager.removePreviewChanges("a")
      mount('<div id="late">L</div><div id="later-b">B</div>')
      await settle()

      expect(byId("late").style.color).toBe("")
      expect(byId("later-b").style.color).toBe("green")
      expect(byId("now").style.color).toBe("blue")
    })

    it("restores original children of a late html mount by identity", async () => {
      manager.applyPreviewChange(
        { selector: "#late", type: "html", value: "<em>Preview</em>" },
        "exp"
      )
      mount('<div id="late"><span id="orig">O</span></div>')
      const original = byId("orig")
      await settle()
      expect(byId("orig")).toBeNull()
      expect(byId("late").querySelector("em")).not.toBeNull()

      manager.removePreviewChanges("exp")

      expect(byId("late").childNodes).toHaveLength(1)
      expect(byId("late").firstChild).toBe(original)
    })

    it("restores the original markup of a late javascript mount", async () => {
      manager.applyPreviewChange(
        {
          selector: "#late",
          type: "javascript",
          value: "element.querySelector('span').textContent = 'JS'"
        },
        "exp"
      )
      mount('<div id="late"><span id="orig">O</span></div>')
      await settle()
      expect(byId("orig").textContent).toBe("JS")

      manager.removePreviewChanges("exp")

      expect(byId("late").innerHTML).toBe('<span id="orig">O</span>')
    })
  })

  it("undoes javascript changes to existing descendants", () => {
    document.body.innerHTML =
      '<div id="p"><span id="s">orig</span><a id="l" href="/x">l</a></div>'

    manager.applyPreviewChange(
      {
        selector: "#p",
        type: "javascript",
        value: [
          "const s = element.querySelector('span')",
          "s.textContent = 'JS'",
          "s.style.color = 'red'",
          "element.querySelector('a').setAttribute('href', '/js')"
        ].join("\n")
      },
      "exp"
    )
    expect(byId("s").textContent).toBe("JS")
    expect(byId("s").style.color).toBe("red")
    expect(byId("l").getAttribute("href")).toBe("/js")

    manager.removePreviewChanges("exp")

    expect(byId("s").textContent).toBe("orig")
    expect(byId("s").hasAttribute("style")).toBe(false)
    expect(byId("l").getAttribute("href")).toBe("/x")
    expect(byId("p").innerHTML).toBe(
      '<span id="s">orig</span><a id="l" href="/x">l</a>'
    )
  })

  it("undoes javascript descendant changes made after a style change on the same element", () => {
    document.body.innerHTML = '<div id="p"><span id="s">orig</span></div>'

    manager.applyPreviewChange(
      { selector: "#p", type: "style", value: { color: "blue" } },
      "exp"
    )
    manager.applyPreviewChange(
      {
        selector: "#p",
        type: "javascript",
        value: "element.querySelector('span').textContent = 'JS'"
      },
      "exp"
    )
    manager.removePreviewChanges("exp")

    expect(byId("s").textContent).toBe("orig")
    expect(byId("p").style.color).toBe("")
  })

  it("restores visual-editor marked elements from their serialized original", () => {
    document.body.innerHTML = '<div id="ve">Edited</div>'
    const element = byId("ve")
    element.setAttribute("data-absmartly-experiment", "__preview__")
    element.setAttribute("data-absmartly-modified", "true")
    element.setAttribute("title", "edited")
    element.setAttribute(
      "data-absmartly-original",
      JSON.stringify({
        innerHTML: "<b>Original</b>",
        styles: { color: "" },
        attributes: { title: null }
      })
    )
    element.style.color = "red"

    expect(manager.removePreviewChanges("exp")).toBe(true)

    expect(element.innerHTML).toBe("<b>Original</b>")
    expect(element.style.color).toBe("")
    expect(element.hasAttribute("title")).toBe(false)
    expect(element.hasAttribute("data-absmartly-original")).toBe(false)
    expect(element.hasAttribute("data-absmartly-experiment")).toBe(false)
    expect(element.hasAttribute("data-absmartly-modified")).toBe(false)
  })
})
