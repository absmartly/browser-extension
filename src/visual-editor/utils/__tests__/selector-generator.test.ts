import { generateRobustSelector, improveSelector } from "../selector-generator"

function expectSelectsOnly(
  selector: string,
  element: Element,
  root: ParentNode = document
) {
  const matches = root.querySelectorAll(selector)
  expect(matches).toHaveLength(1)
  expect(matches[0]).toBe(element)
}

describe("generateRobustSelector", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("escapes IDs containing selector syntax", () => {
    document.body.innerHTML = `<div id="checkout:total.v2">Total</div><div id="checkout">Other</div>`
    const target = document.getElementById("checkout:total.v2")!

    const selector = generateRobustSelector(target)

    expect(selector).toBe("#checkout\\:total\\.v2")
    expectSelectsOnly(selector, target)
  })

  it("does not return a duplicated ID that also matches another element", () => {
    document.body.innerHTML = `
      <section class="card"><button id="buy">First</button></section>
      <aside class="panel"><button id="buy">Second</button></aside>`
    const target = document.querySelectorAll("#buy")[1]

    const selector = generateRobustSelector(target)

    expect(selector).not.toBe("#buy")
    expectSelectsOnly(selector, target)
  })

  it("does not return a duplicated ID whose first match is another element", () => {
    document.body.innerHTML = `
      <div><span id="label">One</span></div>
      <div><span id="label">Two</span></div>`
    const target = document.querySelectorAll("#label")[1]

    expectSelectsOnly(generateRobustSelector(target), target)
  })

  it("escapes class tokens so the generated selector parses and matches", () => {
    document.body.innerHTML = `
      <button class="btn md:px-4">Target</button>
      <button class="btn">Other</button>`
    const target = document.querySelector("button")!

    const selector = generateRobustSelector(target)

    expect(selector).toBe("button.btn.md\\:px-4")
    expectSelectsOnly(selector, target)
  })

  it("escapes name attribute values in contextual selectors", () => {
    document.body.innerHTML = `
      <form><input name='coupon"code'><input name="other"></form>`
    const target = document.querySelector("input")!

    const selector = generateRobustSelector(target)

    expectSelectsOnly(selector, target)
  })

  it("falls back to a position-based selector that is unique for repeated structures", () => {
    document.body.innerHTML = `
      <main><div><div><span>One</span></div></div></main>
      <main><div><div><span>Two</span></div></div></main>`
    const target = document.querySelectorAll("span")[1]

    const selector = generateRobustSelector(target)

    expect(selector).toContain(":nth-of-type(2)")
    expectSelectsOnly(selector, target)
  })

  it("keeps a unique stable ID as the preferred selector", () => {
    document.body.innerHTML = `<button id="hero-cta" class="btn">Go</button><button class="btn">No</button>`
    const target = document.getElementById("hero-cta")!

    expect(generateRobustSelector(target)).toBe("#hero-cta")
  })

  it("keeps a unique data-testid as the preferred non-ID selector", () => {
    document.body.innerHTML = `<button data-testid="checkout">Go</button><button>No</button>`
    const target = document.querySelector("button")!

    expect(generateRobustSelector(target)).toBe('[data-testid="checkout"]')
  })

  describe("with the visual editor option set", () => {
    const veOptions = {
      preferDataAttributes: false,
      includeParentContext: true
    }

    it("returns a unique selector for duplicated Tailwind variant classes", () => {
      document.body.innerHTML = `
        <div class="flex md:flex-row w-1/2 hover:bg-x">One</div>
        <div class="flex md:flex-row w-1/2 hover:bg-x">Two</div>`
      const target = document.querySelectorAll("div")[1]

      expectSelectsOnly(generateRobustSelector(target, veOptions), target)
    })

    it("returns a unique selector for an element whose ID starts with a digit", () => {
      document.body.innerHTML = `<span id="1abc">A</span><span>B</span>`
      const target = document.getElementById("1abc")!

      expectSelectsOnly(generateRobustSelector(target, veOptions), target)
    })

    it("escapes a data-component-name value containing a double quote", () => {
      document.body.innerHTML = `
        <section><a data-component-name='Hero "CTA"'>Go</a><a>Other</a></section>`
      const target = document.querySelector("a")!

      expectSelectsOnly(generateRobustSelector(target, veOptions), target)
    })

    it("anchors on a parent whose ID needs escaping", () => {
      document.body.innerHTML = `
        <div id="cart:v2"><button class="btn">Pay</button></div>
        <div id="cart"><button class="btn">Pay</button></div>`
      const target = document.querySelector("#cart\\:v2 button")!

      const selector = generateRobustSelector(target, veOptions)

      expect(selector).toBe("#cart\\:v2 button.btn")
      expectSelectsOnly(selector, target)
    })
  })

  describe("improveSelector", () => {
    it("returns an ambiguous selector unchanged", () => {
      document.body.innerHTML = `<p class="note">A</p><p class="note">B</p>`

      expect(improveSelector("p.note")).toBe("p.note")
    })

    it("replaces a unique selector with a robust one for the same element", () => {
      document.body.innerHTML = `<main><p id="lead">A</p><p>B</p></main>`
      const target = document.getElementById("lead")!

      const improved = improveSelector("main > p:nth-of-type(1)")

      expect(improved).toBe("#lead")
      expectSelectsOnly(improved, target)
    })
  })

  describe("disconnected elements", () => {
    const veOptions = {
      preferDataAttributes: false,
      avoidAutoGenerated: true,
      includeParentContext: true,
      maxParentLevels: 3
    }

    it("returns the element's own ID for a detached element", () => {
      document.body.innerHTML = `<button id="buy">Buy</button><button>Other</button>`
      const target = document.getElementById("buy")!
      target.remove()

      const selector = generateRobustSelector(target, veOptions)

      expect(selector).toBe("#buy")
      document.body.append(target)
      expectSelectsOnly(selector, target)
    })

    it("returns tag plus stable classes for a detached class-only element", () => {
      document.body.innerHTML = `<div><button class="cta">Buy</button></div><button>Other</button>`
      const target = document.querySelector("button.cta")!
      const parent = target.parentElement!
      target.remove()

      const selector = generateRobustSelector(target, veOptions)

      parent.append(target)
      expectSelectsOnly(selector, target)
    })

    it("throws instead of returning a bare tag for a detached element without identifiers", () => {
      const target = document.createElement("button")
      document.createElement("div").append(target)

      expect(() => generateRobustSelector(target, veOptions)).toThrow(
        /disconnected <button>/
      )
    })
  })

  describe("elements inside an open shadow root", () => {
    function shadowHost(html: string) {
      const host = document.createElement("div")
      document.body.append(host)
      const shadow = host.attachShadow({ mode: "open" })
      shadow.innerHTML = html
      return shadow
    }

    it("keeps a stable ID that is unique within the shadow root", () => {
      document.body.innerHTML = "<button>Page</button>"
      const shadow = shadowHost('<div><button id="inner">In</button></div>')
      const target = shadow.getElementById("inner")!

      const selector = generateRobustSelector(target)

      expect(selector).toBe("#inner")
      expectSelectsOnly(selector, target, shadow)
    })

    it("returns a path unique within the shadow root for repeated siblings", () => {
      document.body.innerHTML = "<button>Page</button>"
      const shadow = shadowHost(
        "<div><button>A</button></div><div><button>B</button></div>"
      )
      const target = shadow.querySelectorAll("button")[1]

      const selector = generateRobustSelector(target, {
        preferDataAttributes: false,
        includeParentContext: true
      })

      expectSelectsOnly(selector, target, shadow)
    })
  })

  describe("positional fallback on deep auto-generated markup", () => {
    const hoverOptions = {
      preferDataAttributes: false,
      avoidAutoGenerated: true,
      includeParentContext: true,
      maxParentLevels: 3
    }

    function buildFramerLike(depth: number, copies: number) {
      const open = Array.from(
        { length: depth },
        (_, d) => `<div class="framer-x${d}Ab9">`
      ).join("")
      const close = "</div>".repeat(depth)
      document.body.innerHTML = Array.from(
        { length: copies },
        () => `${open}<a class="framer-v-4yns67">Link</a>${close}`
      ).join("")
    }

    it("resolves a depth-36 target with at most 10 document queries", () => {
      buildFramerLike(36, 20)
      const spy = jest.spyOn(Document.prototype, "querySelectorAll")
      try {
        for (const target of Array.from(document.querySelectorAll("a"))) {
          spy.mockClear()
          const selector = generateRobustSelector(target, hoverOptions)
          expect(spy.mock.calls.length).toBeLessThanOrEqual(10)
          expectSelectsOnly(selector, target)
        }
      } finally {
        spy.mockRestore()
      }
    })

    it("anchors the path at the nearest ancestor with a unique stable ID", () => {
      buildFramerLike(12, 3)
      const wrappers = document.body.children
      wrappers[1].id = "promo"
      const target = wrappers[1].querySelector("a")!

      const selector = generateRobustSelector(target, hoverOptions)

      expect(selector.startsWith("#promo > ")).toBe(true)
      expectSelectsOnly(selector, target)
    })

    it("skips a duplicated ancestor ID and still returns a unique path", () => {
      buildFramerLike(12, 3)
      const wrappers = document.body.children
      wrappers[0].id = "dup"
      wrappers[1].id = "dup"
      const target = wrappers[1].querySelector("a")!

      const selector = generateRobustSelector(target, hoverOptions)

      expect(selector.includes("#dup")).toBe(false)
      expectSelectsOnly(selector, target)
    })
  })
})
