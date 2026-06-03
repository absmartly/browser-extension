import { CodeHighlightNode, CodeNode } from "@lexical/code"
import {
  AutoLinkNode,
  LinkNode,
  LinkNode as LinkNodeClass
} from "@lexical/link"
import { ListItemNode, ListNode } from "@lexical/list"
import {
  $convertFromMarkdownString,
  $convertToMarkdownString
} from "@lexical/markdown"
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin"
import { NodeEventPlugin } from "@lexical/react/LexicalNodeEventPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin"
import { TablePlugin } from "@lexical/react/LexicalTablePlugin"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table"
import {
  $createParagraphNode,
  $getRoot,
  type EditorThemeClasses,
  type LexicalEditor
} from "lexical"
import React, { useEffect, useRef } from "react"

import { ImageNode } from "./rich-text/nodes/ImageNode"
import { ExperimentMentionNode } from "./rich-text/nodes/MentionNode/ExperimentMentionNode"
import { TeamMentionNode } from "./rich-text/nodes/MentionNode/TeamMentionNode"
import { UserMentionNode } from "./rich-text/nodes/MentionNode/UserMentionNode"
import { CodeHighlightPlugin } from "./rich-text/plugins/CodeHighlightPlugin"
import DragDropPaste from "./rich-text/plugins/DragDropPastePlugin"
import ImagesPlugin from "./rich-text/plugins/ImagesPlugin"
import {
  resetExperimentMentionIds,
  TRANSFORMERS
} from "./rich-text/plugins/MarkdownTransformers"
import ExperimentMentionsPlugin from "./rich-text/plugins/MentionsPlugin/ExperimentMentionsPlugin"
import MentionsPlugin from "./rich-text/plugins/MentionsPlugin/MentionsPlugin"
import { FloatingMenuPlugin } from "./rich-text/toolbar/plugins/FloatingMenuPlugin/FloatingMenuPlugin"
import { ToolbarPlugin } from "./rich-text/toolbar/Toolbar"

/**
 * Full Lexical-based RichTextEditor for the FT-1905 fullscreen experiment
 * modal — ported from the ABsmartly web app (FT-1882) so markdown round-trips
 * match the web app exactly: mentions, experiment-mentions, base64 images,
 * tables, code highlight, floating link menu, toolbar.
 */

const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/

// Sentinel for `externalChangeRef`. The ref starts at this value so the first
// effect run of InitialValuePlugin always seeds the editor (the seeded value
// could legitimately be the empty string, so we can't use "" as a sentinel).
const EDITOR_UNSEEDED = "__rte_unseeded_sentinel__"

const MATCHERS = [
  (text: string) => {
    const match = URL_MATCHER.exec(text)
    if (match === null) return null
    const fullMatch = match[0]
    return {
      index: match.index,
      length: fullMatch.length,
      text: fullMatch,
      url: fullMatch.startsWith("http") ? fullMatch : `https://${fullMatch}`,
      attributes: {
        target: "_blank",
        rel: "noopener noreferrer"
      }
    }
  }
]

const theme: EditorThemeClasses = {
  paragraph: "rte-paragraph mb-2 last:mb-0",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "bg-slate-100 px-1 rounded text-xs font-mono",
    highlight: "bg-yellow-200"
  },
  heading: {
    h1: "text-2xl font-bold mb-2",
    h2: "text-xl font-bold mb-2",
    h3: "text-lg font-bold mb-2",
    h4: "text-base font-bold mb-2",
    h5: "text-sm font-bold mb-2",
    h6: "text-xs font-bold mb-2"
  },
  list: {
    ul: "list-disc list-inside",
    ol: "list-decimal list-inside",
    listitem: "ml-2"
  },
  link: "text-blue-600 underline cursor-pointer",
  quote: "border-l-4 border-slate-300 pl-2 italic",
  code: "bg-slate-100 p-3 my-2 block w-full overflow-x-auto rounded font-mono text-xs leading-snug whitespace-pre",
  codeHighlight: {
    atrule: "text-purple-700",
    "attr-name": "text-blue-700",
    "attr-value": "text-emerald-700",
    boolean: "text-amber-700",
    builtin: "text-purple-700",
    cdata: "text-slate-500",
    char: "text-emerald-700",
    "class-name": "text-amber-700",
    comment: "text-slate-500 italic",
    constant: "text-amber-700",
    function: "text-blue-700",
    important: "text-rose-700 font-semibold",
    keyword: "text-purple-700",
    namespace: "text-amber-700",
    number: "text-amber-700",
    operator: "text-slate-700",
    property: "text-blue-700",
    punctuation: "text-slate-700",
    "regex-delimiter": "text-slate-700",
    "regex-flags": "text-amber-700",
    "regex-source": "text-emerald-700",
    selector: "text-emerald-700",
    string: "text-emerald-700",
    tag: "text-rose-700",
    url: "text-blue-700",
    variable: "text-amber-700"
  },
  table: "table-auto border-collapse my-3 w-full text-sm",
  tableCell: "border border-slate-200 px-3 py-2 align-top",
  tableCellHeader:
    "border border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold"
}

const editorNodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  AutoLinkNode,
  HorizontalRuleNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  ImageNode,
  UserMentionNode,
  TeamMentionNode,
  ExperimentMentionNode,
  TableNode,
  TableCellNode,
  TableRowNode
]

/**
 * Seeds the editor with the supplied markdown value on mount. Re-seeds if the
 * `value` prop changes externally (e.g. AI Fill writes to the parent state)
 * but ignores changes that originated from the editor itself.
 *
 * `externalChangeRef` is the editor's last emitted markdown — when the parent
 * passes back that exact value as the controlled `value` prop, we know it's
 * just our own echo, so we must NOT clear and re-parse (which would destroy
 * the user's selection and reset the cursor to position 0 on every keystroke).
 */
function InitialValuePlugin({
  value,
  externalChangeRef
}: {
  value: string
  externalChangeRef: React.MutableRefObject<string>
}): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (externalChangeRef.current === value) return
    externalChangeRef.current = value
    // Reset experiment mention id tracker before re-parsing so the
    // ExperimentMentionsPlugin only refetches what's actually referenced.
    resetExperimentMentionIds()
    editor.update(() => {
      const root = $getRoot()
      root.clear()
      if (value) {
        $convertFromMarkdownString(value, TRANSFORMERS)
      }
      // CRITICAL: $convertFromMarkdownString strips empty paragraphs from
      // the parsed output, so seeding with "" leaves the root with zero
      // children. A Lexical contenteditable with no children can be focused
      // and even reports a Selection, but beforeinput events have no node
      // to insert into — every keystroke is silently dropped. Guarantee at
      // least one empty paragraph here so the first keystroke after a
      // real-user click always lands.
      if (root.getChildrenSize() === 0) {
        root.append($createParagraphNode())
      }
    })
  }, [editor, value, externalChangeRef])

  return null
}

/**
 * Shadow-DOM focus fix for Lexical.
 *
 * Lexical reads the active DOM selection via `window.getSelection()` in
 * `internalCreateRangeSelection`, `onBeforeInput`, `onClick`, etc. In
 * Chromium, when content lives inside an open shadow root (which this modal
 * uses for style isolation), the shadow root owns its own Selection;
 * the document-level `window.getSelection()` returns a range scoped to the
 * iframe document (anchor at <body>) — never the shadow content. Result:
 * every Lexical update inside a shadow root resets the editor's Selection
 * to `null`, `beforeinput` handlers bail out with
 * `!$isRangeSelection(selection)`, and every keystroke is silently dropped.
 * Pre-fix E2E tests passed only because they manually set the document
 * Selection via JS — something a real user can't do.
 *
 * The fix patches the iframe window's `getSelection` to forward to the
 * shadow root's own `getSelection()` whenever the document's active element
 * lives under the shadow host. The patch is installed once per window
 * (idempotent) and is a no-op when the active element isn't in a registered
 * shadow root, so non-shadow editors and the rest of the document are
 * unaffected. We also bridge `selectionchange` events from the shadow root
 * up to the document so Lexical's onDocumentSelectionChange handler fires.
 */
function ShadowFocusFixPlugin(): null {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    const rootEl = editor.getRootElement()
    if (!rootEl) return
    const root = rootEl.getRootNode()
    if (!(root instanceof ShadowRoot)) return
    const win = rootEl.ownerDocument.defaultView
    if (!win) return

    type PatchedWindow = Window & {
      __absmartlyShadowGetSelectionPatched?: boolean
      __absmartlyShadowRoots?: Set<ShadowRoot>
    }
    const patched = win as PatchedWindow

    const shadowRoots: Set<ShadowRoot> =
      patched.__absmartlyShadowRoots || new Set<ShadowRoot>()
    patched.__absmartlyShadowRoots = shadowRoots
    shadowRoots.add(root)

    if (!patched.__absmartlyShadowGetSelectionPatched) {
      patched.__absmartlyShadowGetSelectionPatched = true
      const orig = win.getSelection.bind(win)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(win as any).getSelection = function (): Selection | null {
        const active = win.document.activeElement
        if (active) {
          for (const sr of shadowRoots) {
            if (sr.host === active || sr.host.contains(active)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fn = (sr as any).getSelection
              if (typeof fn === "function") {
                const sel = fn.call(sr) as Selection | null
                if (sel) return sel
              }
            }
          }
        }
        return orig()
      }
    }

    // Bridge `selectionchange` events fired on the shadow root up to the
    // owner document. Lexical's `onDocumentSelectionChange` listens on the
    // document, so without this it never fires for shadow-DOM edits.
    const onShadowSelChange = () => {
      try {
        win.document.dispatchEvent(new Event("selectionchange"))
      } catch {
        // best-effort
      }
    }
    root.addEventListener("selectionchange", onShadowSelChange)

    return () => {
      shadowRoots.delete(root)
      root.removeEventListener("selectionchange", onShadowSelChange)
      // Intentionally do NOT undo the window.getSelection patch: another
      // editor may still rely on it, and once removed there's no way to
      // re-apply atomically. The patch is a no-op when the active element
      // isn't a shadow host, so it's safe to leave installed.
    }
  }, [editor])
  return null
}

export interface RichTextEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  "data-testid"?: string
  className?: string
  ariaLabelledBy?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled = false,
  id,
  "data-testid": testid,
  className,
  ariaLabelledBy
}: RichTextEditorProps) {
  const lastEmittedRef = useRef<string>(value || "")
  // Tracks the markdown the editor currently contains. We update it whenever
  // we emit a change ourselves AND whenever we accept an external value (in
  // InitialValuePlugin). When the parent re-renders with the same value we
  // just emitted, externalChangeRef.current === value and we skip re-seeding,
  // which preserves the user's cursor/selection across keystrokes.
  //
  // Initialized to a sentinel object (cast to string) so the first effect run
  // always re-seeds the editor — even when the initial value is the same
  // string we'd otherwise treat as already-applied.
  const externalChangeRef = useRef<string>(EDITOR_UNSEEDED)
  const linkRef = useRef<HTMLAnchorElement | null>(null)
  const [showFloatingMenu, setShowFloatingMenu] = React.useState(false)
  const delayHandlerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initialConfig = {
    namespace: "ExtensionRichTextEditor",
    theme,
    onError: (error: Error) => {
      // eslint-disable-next-line no-console
      console.error("[RichTextEditor]", error)
    },
    editable: !disabled,
    nodes: editorNodes
  }

  const handleChange = (_editorState: unknown, editor: LexicalEditor): void => {
    editor.update(() => {
      const markdown = $convertToMarkdownString(TRANSFORMERS)
      if (markdown === lastEmittedRef.current) return
      lastEmittedRef.current = markdown
      // Record that the editor's current content is this markdown. When the
      // parent passes it back via the `value` prop, InitialValuePlugin will
      // skip re-seeding instead of clobbering the user's selection.
      externalChangeRef.current = markdown
      onChange(markdown)
    })
  }

  const handleLinkClick = (e: Event) => {
    if (delayHandlerRef.current) clearTimeout(delayHandlerRef.current)
    setShowFloatingMenu(true)
    linkRef.current = e.target as HTMLAnchorElement
  }

  const handleLinkMouseOut = () => {
    delayHandlerRef.current = setTimeout(() => setShowFloatingMenu(false), 500)
  }

  return (
    <div className={"relative w-full" + (className ? " " + className : "")}>
      <LexicalComposer initialConfig={initialConfig}>
        {!disabled && <ToolbarPlugin />}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <div
                data-testid={testid ? `${testid}-resize-wrapper` : undefined}
                id={id ? `${id}-resize-wrapper` : undefined}
                className={
                  "rte-resize-wrapper " +
                  (disabled ? "rounded" : "rounded-b") +
                  " min-h-[120px] " +
                  (disabled ? "" : "border border-gray-300 ")
                }
                // Chromium honours `resize` on non-contenteditable block
                // ancestors but not on the contenteditable itself. Wrapping
                // here gives users a native bottom-right grip while leaving
                // the ContentEditable free to grow inside it.
                style={
                  disabled
                    ? undefined
                    : { resize: "vertical", overflow: "auto" }
                }
                // The border lives on the wrapper, so users intuitively click
                // anywhere in the bordered box expecting to focus the editor.
                // The contenteditable inside fills the area but click events
                // on the border / scroll-padding land on the wrapper itself.
                // Delegate the focus down so typing always works on click.
                onMouseDown={(e) => {
                  if (disabled) return
                  // Ignore the bottom-right grip area (~16x16) so dragging the
                  // resize handle still works.
                  const rect = e.currentTarget.getBoundingClientRect()
                  if (
                    rect.right - e.clientX < 18 &&
                    rect.bottom - e.clientY < 18
                  ) {
                    return
                  }
                  // Only delegate when the user clicked the wrapper itself
                  // (not bubbled from the contenteditable interior).
                  if (e.target !== e.currentTarget) return
                  e.preventDefault()
                  const ce = e.currentTarget.querySelector<HTMLElement>(
                    '[contenteditable="true"]'
                  )
                  if (!ce) return
                  ce.focus()
                  // Place the caret at the end of the editor so the next
                  // keystroke lands somewhere visible.
                  const sel = ce.ownerDocument.getSelection()
                  if (sel) {
                    sel.removeAllRanges()
                    const range = ce.ownerDocument.createRange()
                    range.selectNodeContents(ce)
                    range.collapse(false)
                    sel.addRange(range)
                  }
                }}>
                <ContentEditable
                  id={id}
                  data-testid={testid}
                  ariaLabelledBy={ariaLabelledBy}
                  className={
                    "ContentEditable__root w-full px-2 py-1 text-sm " +
                    "min-h-[120px] focus:outline-none focus:ring-2 " +
                    "focus:ring-blue-500 prose prose-sm max-w-none" +
                    (disabled ? " bg-slate-100 cursor-not-allowed" : "")
                  }
                />
              </div>
            }
            placeholder={
              placeholder ? (
                <div
                  className={
                    "pointer-events-none absolute left-2 text-sm text-gray-400 " +
                    (disabled ? "top-1" : "top-1")
                  }>
                  {placeholder}
                </div>
              ) : null
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          {!disabled && (
            <>
              <MentionsPlugin />
              <ExperimentMentionsPlugin />
              <NodeEventPlugin
                nodeType={LinkNodeClass}
                eventType="click"
                eventListener={handleLinkClick}
              />
              <NodeEventPlugin
                nodeType={LinkNodeClass}
                eventType="mouseout"
                eventListener={handleLinkMouseOut}
              />
              <FloatingMenuPlugin
                showFloatingMenu={showFloatingMenu}
                linkRef={linkRef}
              />
              <ImagesPlugin />
              <DragDropPaste />
              <TablePlugin hasCellMerge hasCellBackgroundColor={false} />
              <TabIndentationPlugin />
              <CodeHighlightPlugin />
            </>
          )}
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <AutoLinkPlugin matchers={MATCHERS} />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
          <InitialValuePlugin
            value={value}
            externalChangeRef={externalChangeRef}
          />
          {!disabled && <ShadowFocusFixPlugin />}
        </div>
      </LexicalComposer>
    </div>
  )
}

export default RichTextEditor
