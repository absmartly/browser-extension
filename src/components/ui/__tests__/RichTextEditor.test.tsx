/**
 * Tests for the controlled-value behavior of RichTextEditor.
 *
 * The bug we're guarding against: InitialValuePlugin used to re-seed the
 * editor on every keystroke. The user types "H", parent state updates, value
 * prop becomes "H", the effect saw "" !== "H", cleared the editor, and
 * re-inserted "H" with the cursor at position 0. Next keystroke: same loop.
 * The cursor never advanced — the input felt unresponsive.
 *
 * The fix tracks the markdown the editor itself emitted via `externalChangeRef`.
 * When the parent passes back our own emit, we skip re-seeding. We only
 * re-seed when the value is genuinely external (initial mount, AI Fill, etc.).
 *
 * To avoid jsdom flakiness around Lexical's selection APIs, we mock the
 * markdown bridge and assert how often `$convertFromMarkdownString` is invoked.
 * Every invocation of that function represents a "clear + re-parse" — the
 * behavior we want to suppress on echoes.
 */

import { act, render } from "@testing-library/react"
import React, { useEffect, useState } from "react"

import "@testing-library/jest-dom"

import { RichTextEditor } from "../RichTextEditor"

// Capture the OnChangePlugin's onChange so a test can drive "the editor
// produced new markdown" without needing real keyboard events in jsdom.
let capturedOnChange: ((state: unknown, editor: unknown) => void) | null = null

let convertFromMarkdownCalls: string[] = []
let nextMarkdownToEmit: string = ""

jest.mock("@lexical/markdown", () => ({
  $convertFromMarkdownString: jest.fn((markdown: string) => {
    convertFromMarkdownCalls.push(markdown)
  }),
  $convertToMarkdownString: jest.fn(() => nextMarkdownToEmit),
  TRANSFORMERS: []
}))

jest.mock("@lexical/react/LexicalOnChangePlugin", () => ({
  OnChangePlugin: ({
    onChange
  }: {
    onChange: (state: unknown, editor: unknown) => void
  }) => {
    capturedOnChange = onChange
    return null
  }
}))

// Stub the remaining heavy plugins/composer — we only need the InitialValuePlugin
// effect and the handleChange callback to run. The composer just renders children
// and provides a fake editor context so useLexicalComposerContext returns one.
const fakeEditor = {
  update: (cb: () => void) => cb(),
  hasNodes: () => true,
  registerCommand: () => () => {}
}

jest.mock("@lexical/react/LexicalComposer", () => ({
  LexicalComposer: ({ children }: any) => <div>{children}</div>
}))

jest.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [fakeEditor]
}))

jest.mock("@lexical/react/LexicalContentEditable", () => ({
  ContentEditable: (props: any) => <div data-testid="ce" {...props} />
}))

jest.mock("@lexical/react/LexicalErrorBoundary", () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>
}))

jest.mock("@lexical/react/LexicalRichTextPlugin", () => ({
  RichTextPlugin: ({ contentEditable, placeholder }: any) => (
    <>
      {contentEditable}
      {placeholder}
    </>
  )
}))

const noopPluginFn = () => null
jest.mock("@lexical/react/LexicalAutoLinkPlugin", () => ({
  AutoLinkPlugin: () => null
}))
jest.mock("@lexical/react/LexicalHistoryPlugin", () => ({
  HistoryPlugin: () => null
}))
jest.mock("@lexical/react/LexicalHorizontalRuleNode", () => ({
  HorizontalRuleNode: class {}
}))
jest.mock("@lexical/react/LexicalLinkPlugin", () => ({
  LinkPlugin: () => null
}))
jest.mock("@lexical/react/LexicalListPlugin", () => ({
  ListPlugin: () => null
}))
jest.mock("@lexical/react/LexicalMarkdownShortcutPlugin", () => ({
  MarkdownShortcutPlugin: () => null
}))
jest.mock("@lexical/react/LexicalNodeEventPlugin", () => ({
  NodeEventPlugin: () => null
}))
jest.mock("@lexical/react/LexicalTabIndentationPlugin", () => ({
  TabIndentationPlugin: () => null
}))
jest.mock("@lexical/react/LexicalTablePlugin", () => ({
  TablePlugin: () => null
}))

// Heavy custom plugins/nodes — replace with stubs so the module loads.
jest.mock("../rich-text/nodes/ImageNode", () => ({
  ImageNode: class {}
}))
jest.mock("../rich-text/nodes/MentionNode/ExperimentMentionNode", () => ({
  ExperimentMentionNode: class {}
}))
jest.mock("../rich-text/nodes/MentionNode/TeamMentionNode", () => ({
  TeamMentionNode: class {}
}))
jest.mock("../rich-text/nodes/MentionNode/UserMentionNode", () => ({
  UserMentionNode: class {}
}))
jest.mock("../rich-text/plugins/CodeHighlightPlugin", () => ({
  CodeHighlightPlugin: () => null
}))
jest.mock("../rich-text/plugins/DragDropPastePlugin", () => ({
  __esModule: true,
  default: () => null
}))
jest.mock("../rich-text/plugins/ImagesPlugin", () => ({
  __esModule: true,
  default: () => null
}))
jest.mock("../rich-text/plugins/MarkdownTransformers", () => ({
  resetExperimentMentionIds: jest.fn(),
  TRANSFORMERS: []
}))
jest.mock(
  "../rich-text/plugins/MentionsPlugin/ExperimentMentionsPlugin",
  () => ({
    __esModule: true,
    default: () => null
  })
)
jest.mock("../rich-text/plugins/MentionsPlugin/MentionsPlugin", () => ({
  __esModule: true,
  default: () => null
}))
jest.mock(
  "../rich-text/toolbar/plugins/FloatingMenuPlugin/FloatingMenuPlugin",
  () => ({
    FloatingMenuPlugin: () => null
  })
)
jest.mock("../rich-text/toolbar/Toolbar", () => ({
  ToolbarPlugin: () => null
}))

// lexical core — we never call any real DOM logic. Provide minimal stubs.
jest.mock("lexical", () => ({
  $getRoot: () => ({ clear: jest.fn() }),
  $setSelection: jest.fn()
}))

// link / list / code / rich-text node classes — referenced by the editor's
// `nodes` array. Just provide constructor stubs.
jest.mock("@lexical/code", () => ({
  CodeNode: class {},
  CodeHighlightNode: class {}
}))
jest.mock("@lexical/link", () => ({
  AutoLinkNode: class {},
  LinkNode: class {}
}))
jest.mock("@lexical/list", () => ({
  ListNode: class {},
  ListItemNode: class {}
}))
jest.mock("@lexical/rich-text", () => ({
  HeadingNode: class {},
  QuoteNode: class {}
}))
jest.mock("@lexical/table", () => ({
  TableNode: class {},
  TableCellNode: class {},
  TableRowNode: class {}
}))

beforeEach(() => {
  convertFromMarkdownCalls = []
  capturedOnChange = null
  nextMarkdownToEmit = ""
})

/**
 * A controlled wrapper that mirrors how the modal feeds the editor: every
 * call to `onChange` updates state, which re-renders the editor with the new
 * `value`. If the editor naively re-seeds on every prop change, the test will
 * see multiple `$convertFromMarkdownString` calls when typing.
 */
function ControlledHarness({
  initialValue,
  capture
}: {
  initialValue: string
  capture: (api: {
    setValue: (v: string) => void
    getValue: () => string
  }) => void
}) {
  const [value, setValue] = useState(initialValue)
  useEffect(() => {
    capture({ setValue, getValue: () => value })
  })
  return <RichTextEditor value={value} onChange={setValue} />
}

describe("RichTextEditor controlled-value behavior", () => {
  it("seeds the editor once on initial mount", async () => {
    await act(async () => {
      render(<RichTextEditor value="Hello" onChange={() => {}} />)
    })
    expect(convertFromMarkdownCalls).toEqual(["Hello"])
  })

  it("does not re-seed when the parent echoes the editor's own emitted value", async () => {
    let api: any = null
    await act(async () => {
      render(<ControlledHarness initialValue="" capture={(a) => (api = a)} />)
    })
    // 1) Initial seed with empty string
    expect(convertFromMarkdownCalls).toEqual([""])

    // 2) Editor emits "H" — handleChange will call onChange("H"), parent
    // updates state, RichTextEditor re-renders with value="H". With the fix,
    // InitialValuePlugin must see that externalChangeRef.current === "H" and
    // skip re-seeding.
    await act(async () => {
      nextMarkdownToEmit = "H"
      capturedOnChange?.({}, fakeEditor)
    })
    expect(convertFromMarkdownCalls).toEqual([""])

    // 3) Editor emits "He" — same flow, must still not re-seed.
    await act(async () => {
      nextMarkdownToEmit = "He"
      capturedOnChange?.({}, fakeEditor)
    })
    expect(convertFromMarkdownCalls).toEqual([""])

    // 4) Confirm the parent's state reflects the typed value.
    expect(api.getValue()).toBe("He")
  })

  it("does not re-seed across ten consecutive keystrokes (Bug 1 regression)", async () => {
    // This covers the FT-1905 regression where mentions plugins re-seeded the
    // editor between keystrokes, resetting the cursor. We simulate ten editor
    // emits in sequence and assert the only `$convertFromMarkdownString` call
    // remains the initial mount seed.
    let api: any = null
    await act(async () => {
      render(<ControlledHarness initialValue="" capture={(a) => (api = a)} />)
    })
    expect(convertFromMarkdownCalls).toEqual([""])

    const word = "hello rich"
    let acc = ""
    for (const ch of word) {
      acc += ch
      await act(async () => {
        nextMarkdownToEmit = acc
        capturedOnChange?.({}, fakeEditor)
      })
    }
    expect(convertFromMarkdownCalls).toEqual([""])
    expect(api.getValue()).toBe("hello rich")
  })

  it("re-seeds when value is changed externally (e.g. AI Fill)", async () => {
    let api: any = null
    await act(async () => {
      render(<ControlledHarness initialValue="" capture={(a) => (api = a)} />)
    })
    expect(convertFromMarkdownCalls).toEqual([""])

    // Editor emits "H" — no re-seed.
    await act(async () => {
      nextMarkdownToEmit = "H"
      capturedOnChange?.({}, fakeEditor)
    })
    expect(convertFromMarkdownCalls).toEqual([""])

    // Parent sets value externally (e.g. AI Fill overwrites the field) —
    // must re-seed because externalChangeRef.current === "H" !== new value.
    await act(async () => {
      api.setValue("AI generated description")
    })
    expect(convertFromMarkdownCalls).toEqual(["", "AI generated description"])

    // Parent passes the same external value again (idempotent re-render) —
    // must NOT re-seed, externalChangeRef now tracks it.
    await act(async () => {
      api.setValue("AI generated description")
    })
    expect(convertFromMarkdownCalls).toEqual(["", "AI generated description"])
  })
})

describe("RichTextEditor resize handle", () => {
  it("wraps the ContentEditable in a vertical-resize container so Chromium renders a grip", async () => {
    let result: ReturnType<typeof render> | null = null
    await act(async () => {
      result = render(
        <RichTextEditor
          value=""
          onChange={() => {}}
          id="my-editor"
          data-testid="my-editor"
        />
      )
    })
    const wrapper = result!.container.querySelector(
      '[data-testid="my-editor-resize-wrapper"]'
    ) as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.style.resize).toBe("vertical")
    expect(wrapper.style.overflow).toBe("auto")
    expect(wrapper.className).toContain("min-h-[120px]")
  })

  it("does not enable resize on the disabled editor", async () => {
    let result: ReturnType<typeof render> | null = null
    await act(async () => {
      result = render(
        <RichTextEditor
          value=""
          onChange={() => {}}
          disabled
          id="my-editor"
          data-testid="my-editor"
        />
      )
    })
    const wrapper = result!.container.querySelector(
      '[data-testid="my-editor-resize-wrapper"]'
    ) as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.style.resize).toBe("")
  })
})
