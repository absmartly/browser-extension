/**
 * PreviewManager tests against the real @absmartly/sdk-plugins manipulator.
 */

import { DOMManipulatorLite } from "@absmartly/sdk-plugins/core/dom-manipulator"

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

  it("undoes writes an SDK apply made before throwing", () => {
    document.body.innerHTML = '<p id="p" title="orig">P</p>'
    // The SDK catches its own errors; an escaping throw (for example from a
    // future SDK version) is simulated by a partial write followed by throw.
    const spy = jest
      .spyOn(DOMManipulatorLite.prototype, "applyChange")
      .mockImplementation(() => {
        byId("p").setAttribute("title", "half")
        throw new Error("sdk failure")
      })

    expect(() =>
      manager.applyPreviewChange(
        { selector: "#p", type: "attribute", value: { title: "x" } },
        "exp"
      )
    ).toThrow("sdk failure")
    spy.mockRestore()
    expect(byId("p").getAttribute("title")).toBe("half")

    manager.removePreviewChanges("exp")
    expect(byId("p").getAttribute("title")).toBe("orig")
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

  it.each([
    ["html", { type: "style", value: { color: "red" } }],
    ["text", { type: "javascript", value: "element.style.color = 'red'" }]
  ] as const)(
    "keeps the %s change's original children when a later change targets the same element",
    (first, second) => {
      document.body.innerHTML = '<div id="h"><b id="k">Keep</b></div>'
      const child = byId("k")

      manager.applyPreviewChange(
        { selector: "#h", type: first, value: "<i>S</i>" } as DOMChange,
        "exp"
      )
      manager.applyPreviewChange(
        { selector: "#h", ...second } as DOMChange,
        "exp"
      )
      expect(byId("h").style.color).toBe("red")
      manager.removePreviewChanges("exp")

      expect(byId("h").childNodes).toHaveLength(1)
      expect(byId("h").firstChild).toBe(child)
      expect(byId("h").style.color).toBe("")
    }
  )

  it.each(["text", "html"] as const)(
    "restores nested matches of one %s change when the outer match detaches the inner one",
    (type) => {
      document.body.innerHTML =
        '<div id="outer" class="card"><span id="s">S</span><div id="inner" class="card"><b id="k">K</b></div></div>'
      const original = document.body.innerHTML
      const inner = byId("inner")
      const kept = byId("k")

      manager.applyPreviewChange(
        { selector: ".card", type, value: "<i>P</i>" } as DOMChange,
        "exp"
      )
      expect(inner.isConnected).toBe(false)
      manager.removePreviewChanges("exp")

      expect(document.body.innerHTML).toBe(original)
      expect(byId("inner")).toBe(inner)
      expect(byId("k")).toBe(kept)
    }
  )

  it("leaves no class attribute on an element that had none", () => {
    document.body.innerHTML = '<p id="p">P</p><p id="q" class="">Q</p>'

    for (const selector of ["#p", "#q"]) {
      manager.applyPreviewChange(
        { selector, type: "class", add: ["hl"], remove: [] } as DOMChange,
        "exp"
      )
    }
    expect(byId("p").className).toBe("hl")
    manager.removePreviewChanges("exp")

    expect(byId("p").hasAttribute("class")).toBe(false)
    expect(byId("q").getAttribute("class")).toBe("")
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

  it("keeps a moved node attached when the page nested its old parent inside it", () => {
    document.body.innerHTML =
      '<div id="a"><span id="x">X</span></div><div id="b"></div><p id="s">S</p>'
    const x = byId("x")
    const a = byId("a")

    manager.applyPreviewChange(
      { selector: "#s", type: "style", value: { color: "red" } },
      "exp"
    )
    manager.applyPreviewChange(
      {
        selector: "#x",
        type: "move",
        targetSelector: "#b",
        position: "lastChild"
      } as DOMChange,
      "exp"
    )
    expect(x.parentElement).toBe(byId("b"))
    // Page code puts the preview's source container inside the moved node.
    x.appendChild(a)

    expect(() => manager.removePreviewChanges("exp")).not.toThrow()
    expect(x.parentElement).toBe(byId("b"))
    expect(a.parentElement).toBe(x)
    expect(x.isConnected).toBe(true)
    expect(byId("s").hasAttribute("style")).toBe(false)
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

  describe("a javascript change on an ancestor of an earlier change", () => {
    const parentJs: DOMChange = {
      selector: "#p",
      type: "javascript",
      value:
        "element.dataset.x = '1'; element.querySelector('span').title = 'js'"
    }
    const original = '<div id="p"><span id="c" class="label">orig</span></div>'

    it.each([
      ["style", { selector: "#c", type: "style", value: { color: "red" } }],
      ["text", { selector: "#c", type: "text", value: "PREVIEW" }]
    ] as const)(
      "restores a single original child after %s on the child",
      (_name, childChange) => {
        document.body.innerHTML = original
        const child = byId("c")
        const click = jest.fn()
        child.addEventListener("click", click)

        manager.applyPreviewChange(childChange as DOMChange, "exp")
        manager.applyPreviewChange(parentJs, "exp")
        manager.removePreviewChanges("exp")

        expect(document.querySelectorAll("#c")).toHaveLength(1)
        expect(byId("c")).toBe(child)
        expect(document.body.innerHTML).toBe(original)
        byId("c").click()
        expect(click).toHaveBeenCalledTimes(1)
      }
    )

    it("does not multiply the child over visual-editor replays", () => {
      document.body.innerHTML = original
      const changes: DOMChange[] = [
        { selector: "span.label", type: "style", value: { color: "red" } },
        parentJs
      ]

      for (let cycle = 0; cycle < 3; cycle++) {
        for (const change of changes) manager.applyPreviewChange(change, "exp")
        expect(document.querySelectorAll("span.label")).toHaveLength(1)
        manager.removePreviewChanges("exp")
        expect(document.body.innerHTML).toBe(original)
      }
    })

    it("removes a node created before the javascript change", () => {
      document.body.innerHTML = original
      manager.applyPreviewChange(
        {
          selector: "",
          type: "create",
          element: '<i id="new">N</i>',
          targetSelector: "#c",
          position: "after"
        },
        "exp"
      )
      manager.applyPreviewChange(parentJs, "exp")
      manager.removePreviewChanges("exp")

      expect(byId("new")).toBeNull()
      expect(document.body.innerHTML).toBe(original)
    })

    it("keeps form controls and their state when javascript rewrites the container", () => {
      document.body.innerHTML =
        '<form id="p"><label for="q">Q</label><input id="q" data-track="1" type="search"><button id="go" type="submit" aria-label="Go"><svg viewBox="0 0 1 1"></svg></button><span>s</span></form>'
      const markup = document.body.innerHTML
      const input = byId("q") as HTMLInputElement
      input.value = "typed"

      manager.applyPreviewChange(
        {
          selector: "#p",
          type: "javascript",
          value: "element.innerHTML = '<p>replaced</p>'"
        },
        "exp"
      )
      expect(byId("q")).toBeNull()
      manager.removePreviewChanges("exp")

      expect(document.body.innerHTML).toBe(markup)
      expect(byId("q")).toBe(input)
      expect(input.value).toBe("typed")
    })
  })

  it("restores live form state a javascript preview set without attributes", () => {
    document.body.innerHTML = `<form id="f">
      <input id="t" value="orig"><input id="c" type="checkbox">
      <select id="s"><option>a</option><option>b</option></select>
      <textarea id="ta">orig</textarea><input id="kept" value="orig">
    </form>`
    const field = <T>(id: string) => byId(id) as T
    manager.applyPreviewChange(
      {
        selector: "#f",
        type: "javascript",
        value: [
          "element.querySelector('#t').value = 'js'",
          "element.querySelector('#c').checked = true",
          "element.querySelector('#s').selectedIndex = 1",
          "element.querySelector('#ta').value = 'js'",
          "element.querySelector('#kept').value = 'js'"
        ].join(";")
      },
      "exp"
    )
    expect(field<HTMLInputElement>("t").value).toBe("js")
    // The user types into one field while the preview is applied.
    field<HTMLInputElement>("kept").value = "user"
    manager.removePreviewChanges("exp")

    expect(field<HTMLInputElement>("t").value).toBe("orig")
    expect(field<HTMLInputElement>("c").checked).toBe(false)
    expect(field<HTMLSelectElement>("s").selectedIndex).toBe(0)
    expect(field<HTMLTextAreaElement>("ta").value).toBe("orig")
    expect(field<HTMLInputElement>("kept").value).toBe("user")
  })

  it("restores an extension host that an immediate change's selector also matched", () => {
    document.body.innerHTML =
      '<div id="absmartly-visual-editor-toolbar-host" class="box"></div><div id="page" class="box"></div>'
    const host = byId("absmartly-visual-editor-toolbar-host")

    manager.applyPreviewChange(
      { selector: ".box", type: "style", value: { color: "red" } },
      "exp"
    )
    expect(byId("page").style.color).toBe("red")
    // The SDK applies the change to every match, extension host included;
    // the document-wide journal records that write too.
    expect(host.style.color).toBe("red")
    manager.removePreviewChanges("exp")

    expect(host.hasAttribute("style")).toBe(false)
    expect(host.outerHTML).toBe(
      '<div id="absmartly-visual-editor-toolbar-host" class="box"></div>'
    )
    expect(byId("page").hasAttribute("style")).toBe(false)
  })

  it("restores the page when two experiments overlap and are removed in either order", () => {
    const original = '<div id="p"><span id="c">orig</span></div>'
    for (const order of [
      ["a", "b"],
      ["b", "a"]
    ]) {
      document.body.innerHTML = original
      const child = byId("c")
      manager.applyPreviewChange(
        {
          selector: "#p",
          type: "javascript",
          value: "element.querySelector('span').textContent = 'JS'"
        },
        "a"
      )
      manager.applyPreviewChange(
        { selector: "#c", type: "style", value: { color: "red" } },
        "b"
      )
      for (const name of order) manager.removePreviewChanges(name)

      expect(document.body.innerHTML).toBe(original)
      expect(byId("c")).toBe(child)
    }
  })

  it.each([
    ["the next sibling", "x", '<li id="y">Y</li><li id="z">Z</li>'],
    [
      "the previous sibling",
      "z",
      '<li id="x">X</li><li id="y">Y</li><li id="w">W</li>'
    ]
  ])(
    "reinserts a deleted element beside %s when page code removed the other one",
    (_name, removedByPage, expected) => {
      document.body.innerHTML =
        '<ul id="l"><li id="x">X</li><li id="y">Y</li><li id="z">Z</li></ul>'
      const deleted = byId("y")

      manager.applyPreviewChange({ selector: "#y", type: "delete" }, "exp")
      byId(removedByPage).remove()
      const late = document.createElement("li")
      late.id = "w"
      late.textContent = "W"
      if (removedByPage === "z") byId("l").append(late)
      manager.removePreviewChanges("exp")

      expect(byId("l").innerHTML).toBe(expected)
      expect(byId("y")).toBe(deleted)
    }
  )

  it("keeps children the page rendered over html-preview content", () => {
    document.body.innerHTML = '<div id="h"><b id="k">Original</b></div>'

    manager.applyPreviewChange(
      { selector: "#h", type: "html", value: "<i>Preview</i>" },
      "exp"
    )
    // The SPA re-renders the container after the preview applied.
    byId("h").innerHTML = "<u>Current</u>"
    manager.removePreviewChanges("exp")

    expect(byId("h").innerHTML).toBe("<u>Current</u>")
  })

  it("restores html-preview content by identity while the preview's nodes are in place", () => {
    document.body.innerHTML = '<div id="h"><b id="k">Keep</b></div>'
    const child = byId("k")

    manager.applyPreviewChange(
      { selector: "#h", type: "html", value: "<i>Preview</i>" },
      "exp"
    )
    byId("h").append(document.createElement("hr"))
    manager.removePreviewChanges("exp")

    expect(byId("h").innerHTML).toBe('<b id="k">Keep</b><hr>')
    expect(byId("k")).toBe(child)
  })

  it.each([
    ['<div id="h">x</div>', null],
    ['<div id="h" style="">x</div>', ""],
    ['<div id="h" style="margin: 1px;">x</div>', "margin: 1px;"]
  ])(
    "undoes style declarations the page left alone in %s",
    (markup, original) => {
      document.body.innerHTML = markup
      const element = byId("h")
      manager.applyPreviewChange(
        {
          selector: "#h",
          type: "style",
          value: { color: "red", fontSize: "2px" }
        },
        "exp"
      )
      // Page code adds an unrelated declaration and overrides one of the
      // preview's.
      element.style.backgroundColor = "blue"
      element.style.fontSize = "9px"
      manager.removePreviewChanges("exp")

      expect(element.style.color).toBe("")
      expect(element.style.fontSize).toBe("9px")
      expect(element.style.backgroundColor).toBe("blue")
      expect(element.style.margin).toBe(original ? "1px" : "")

      // The page removed one of the preview's declarations: undoing the
      // other leaves no declarations, and the attribute returns to its
      // original absent, empty or populated form.
      document.body.innerHTML = markup
      const fresh = byId("h")
      manager.applyPreviewChange(
        {
          selector: "#h",
          type: "style",
          value: { color: "red", fontSize: "2px" }
        },
        "exp"
      )
      fresh.style.removeProperty("font-size")
      manager.removePreviewChanges("exp")
      expect(fresh.getAttribute("style")).toBe(original)
    }
  )

  it("does not overwrite page attribute or text mutations made after preview apply", () => {
    document.body.innerHTML = '<div id="h">Original</div>'
    const element = byId("h")
    const text = element.firstChild as Text

    expect(
      manager.applyPreviewChange(
        { selector: "#h", type: "style", value: { color: "red" } },
        "exp"
      )
    ).toBe(true)
    expect(
      manager.applyPreviewChange(
        { selector: "#h", type: "text", value: "Preview" },
        "exp"
      )
    ).toBe(true)

    element.setAttribute("style", "color: blue")
    text.data = "Page"
    manager.removePreviewChanges("exp")

    expect(element.getAttribute("style")).toBe("color: blue")
    expect(element.textContent).toBe("Page")
  })

  it("restores unchanged values and leaves a namespaced page mutation alone", () => {
    document.body.innerHTML =
      '<svg id="icon"><use id="use" /></svg><p id="p">Original</p>'
    const use = byId("use")
    const paragraph = byId("p")
    const text = paragraph.firstChild as Text
    const href = "http://www.w3.org/1999/xlink"
    use.setAttributeNS(href, "xlink:href", "#old")

    expect(
      manager.applyPreviewChange(
        { selector: "#p", type: "text", value: "Preview" },
        "exp"
      )
    ).toBe(true)
    expect(paragraph.textContent).toBe("Preview")
    expect(
      manager.applyPreviewChange(
        {
          selector: "#use",
          type: "attribute",
          value: { "xlink:href": "#preview" }
        },
        "exp"
      )
    ).toBe(true)
    expect(use.getAttributeNS(href, "href")).toBe("#preview")
    use.setAttributeNS(href, "xlink:href", "#page")
    manager.removePreviewChanges("exp")

    expect(paragraph.textContent).toBe("Original")
    expect(text.data).toBe("Original")
    expect(use.getAttributeNS(href, "href")).toBe("#page")
  })

  it("does not re-add an originally absent attribute removed by page code", () => {
    document.body.innerHTML = '<div id="h"></div>'
    const element = byId("h")

    expect(
      manager.applyPreviewChange(
        { selector: "#h", type: "attribute", value: { title: "Preview" } },
        "exp"
      )
    ).toBe(true)
    expect(element.getAttribute("title")).toBe("Preview")
    element.removeAttribute("title")

    manager.removePreviewChanges("exp")

    expect(element.hasAttribute("title")).toBe(false)
  })

  it("restores a javascript outer removal with nested descendant removals", () => {
    document.body.innerHTML =
      '<div id="host"><div id="outer"><span id="first">First</span><span id="second">Second</span></div></div>'
    const host = byId("host")
    const outer = byId("outer")
    const first = byId("first")
    const second = byId("second")

    expect(
      manager.applyPreviewChange(
        {
          selector: "#outer",
          type: "javascript",
          value:
            "const outer = document.getElementById('outer'); const host = outer.parentNode; const first = outer.querySelector('#first'); const second = outer.querySelector('#second'); host.removeChild(outer); outer.removeChild(first); outer.removeChild(second)"
        },
        "exp"
      )
    ).toBe(true)

    manager.removePreviewChanges("exp")

    expect(host.firstElementChild).toBe(outer)
    expect(outer.children).toHaveLength(2)
    expect(outer.firstElementChild).toBe(first)
    expect(outer.lastElementChild).toBe(second)
  })

  it("restores a detached and reinserted javascript target without stale ownership", () => {
    document.body.innerHTML =
      '<div id="host"><span id="target" data-state="original">Original</span></div>'
    const host = byId("host")
    const target = byId("target")

    expect(
      manager.applyPreviewChange(
        {
          selector: "#host",
          type: "javascript",
          value:
            "const node = document.getElementById('target'); const parent = node.parentNode; node.setAttribute('data-state', 'first'); parent.removeChild(node); parent.appendChild(node); node.setAttribute('data-state', 'second')"
        },
        "exp"
      )
    ).toBe(true)
    expect(target.getAttribute("data-state")).toBe("second")

    manager.removePreviewChanges("exp")

    expect(host.firstElementChild).toBe(target)
    expect(target.getAttribute("data-state")).toBe("original")
  })

  it("leaves a later overlapping experiment value owned by that experiment", () => {
    document.body.innerHTML = '<div id="h">Original</div>'
    manager.applyPreviewChange(
      { selector: "#h", type: "style", value: { color: "red" } },
      "a"
    )
    manager.applyPreviewChange(
      { selector: "#h", type: "style", value: { color: "blue" } },
      "b"
    )

    manager.removePreviewChanges("b")
    expect(byId("h").style.color).toBe("red")
    manager.removePreviewChanges("a")
    expect(byId("h").style.color).toBe("")
  })

  it.each([
    [
      "removePreviewChanges",
      (m: PreviewManager) => {
        m.removePreviewChanges("a")
        expect(byId("h").getAttribute("title")).toBe("blue")
        m.removePreviewChanges("b")
      }
    ],
    ["clearAll", (m: PreviewManager) => m.clearAll()]
  ])(
    "does not bring back an earlier experiment's value after it was removed (%s)",
    (_name, removeAll) => {
      document.body.innerHTML = '<div id="h" title="orig">Original</div>'
      manager.applyPreviewChange(
        { selector: "#h", type: "attribute", value: { title: "red" } },
        "a"
      )
      manager.applyPreviewChange(
        { selector: "#h", type: "attribute", value: { title: "blue" } },
        "b"
      )
      removeAll(manager)
      expect(byId("h").getAttribute("title")).toBe("orig")
    }
  )

  it("hands a removed experiment's old value only to the experiment that overwrote it", () => {
    document.body.innerHTML = '<div id="h" title="x">Original</div>'
    const apply = (title: string, name: string) =>
      manager.applyPreviewChange(
        { selector: "#h", type: "attribute", value: { title } },
        name
      )
    apply("red", "c")
    apply("x", "a")
    apply("blue", "b")

    manager.removePreviewChanges("a")
    expect(byId("h").getAttribute("title")).toBe("blue")
    manager.removePreviewChanges("b")
    expect(byId("h").getAttribute("title")).toBe("red")
    manager.removePreviewChanges("c")
    expect(byId("h").getAttribute("title")).toBe("x")
  })

  it.each([
    ["the same declaration", { color: "blue" } as Record<string, string>],
    ["a different declaration", { fontSize: "2px" } as Record<string, string>]
  ])(
    "restores the page style when an earlier experiment on %s is removed first",
    (_name, laterStyle) => {
      document.body.innerHTML = '<div id="h">x</div>'
      manager.applyPreviewChange(
        { selector: "#h", type: "style", value: { color: "red" } },
        "a"
      )
      manager.applyPreviewChange(
        { selector: "#h", type: "style", value: laterStyle },
        "b"
      )
      manager.removePreviewChanges("a")
      expect(byId("h").style.color).toBe(laterStyle.color ?? "")
      manager.removePreviewChanges("b")
      expect(byId("h").hasAttribute("style")).toBe(false)
    }
  )

  it("keeps a page declaration added between two experiments on the same declaration", () => {
    document.body.innerHTML = '<div id="h">x</div>'
    manager.applyPreviewChange(
      { selector: "#h", type: "style", value: { color: "red" } },
      "a"
    )
    byId("h").style.margin = "1px"
    manager.applyPreviewChange(
      { selector: "#h", type: "style", value: { color: "blue" } },
      "b"
    )
    manager.removePreviewChanges("a")
    manager.removePreviewChanges("b")
    expect(byId("h").getAttribute("style")).toBe("margin: 1px;")
  })

  it("keeps a page write made between two overlapping experiments", () => {
    document.body.innerHTML = '<div id="h" title="orig">Original</div>'
    manager.applyPreviewChange(
      { selector: "#h", type: "attribute", value: { title: "red" } },
      "a"
    )
    byId("h").setAttribute("title", "page")
    manager.applyPreviewChange(
      { selector: "#h", type: "attribute", value: { title: "blue" } },
      "b"
    )
    manager.removePreviewChanges("a")
    manager.removePreviewChanges("b")
    expect(byId("h").getAttribute("title")).toBe("page")
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

  it("ignores a visual-editor sidecar written onto an element this preview journaled", () => {
    document.body.innerHTML = '<p id="p">Original</p>'
    const text = byId("p").firstChild

    manager.applyPreviewChange(
      { selector: "#p", type: "html", value: "<b>Preview</b>" },
      "__visual_editor__"
    )
    // Selecting an element in the visual editor serializes its current,
    // previewed content into the sidecar.
    byId("p").setAttribute(
      "data-absmartly-original",
      JSON.stringify({
        textContent: "Preview",
        innerHTML: "<b>Preview</b>"
      })
    )
    manager.removePreviewChanges("__visual_editor__")

    expect(byId("p").innerHTML).toBe("Original")
    expect(byId("p").firstChild).toBe(text)
    expect(byId("p").hasAttribute("data-absmartly-original")).toBe(false)

    manager.applyPreviewChange(
      { selector: "#p", type: "text", value: "Again" },
      "__visual_editor__"
    )
    manager.removePreviewChanges("__visual_editor__")
    expect(byId("p").firstChild).toBe(text)
    expect(byId("p").outerHTML).toBe('<p id="p">Original</p>')
  })

  it("clears visual-editor selection markers from an element the preview deleted", () => {
    document.body.innerHTML = '<div id="l"><b id="d">Gone</b></div>'
    const deleted = byId("d")
    // The visual editor marks a selected element with the production
    // experiment name before the delete change is replayed.
    deleted.setAttribute(
      "data-absmartly-original",
      JSON.stringify({ textContent: "Gone", innerHTML: "Gone" })
    )
    deleted.setAttribute("data-absmartly-experiment", "production_exp")

    manager.applyPreviewChange(
      { selector: "#d", type: "delete" },
      "__visual_editor__"
    )
    expect(byId("d")).toBeNull()
    manager.removePreviewChanges("__visual_editor__")

    expect(byId("d")).toBe(deleted)
    expect(byId("l").innerHTML).toBe('<b id="d">Gone</b>')
  })

  it("keeps markers owned by another experiment whose preview is still applied", () => {
    document.body.innerHTML = '<p id="p">Original</p>'
    manager.applyPreviewChange(
      { selector: "#p", type: "style", value: { color: "red" } },
      "__visual_editor__"
    )
    manager.applyPreviewChange(
      { selector: "#p", type: "style", value: { fontSize: "2px" } },
      "other"
    )
    manager.removePreviewChanges("__visual_editor__")

    expect(byId("p").getAttribute("data-absmartly-experiment")).toBe("other")
    expect(byId("p").getAttribute("data-absmartly-modified")).toBe("true")
  })
})
