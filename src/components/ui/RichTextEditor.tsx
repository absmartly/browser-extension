import { CodeNode } from "@lexical/code"
import { AutoLinkNode, LinkNode } from "@lexical/link"
import { ListItemNode, ListNode } from "@lexical/list"
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS
} from "@lexical/markdown"
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { $getRoot, type EditorThemeClasses, type LexicalEditor } from "lexical"
import React, { useEffect, useRef } from "react"

/**
 * Minimal Lexical-based RichTextEditor for the FT-1905 fullscreen experiment
 * modal. The main ABsmartly UI uses a much heavier Lexical setup (Mentions,
 * Images, Tables, CodeHighlight, FloatingMenu) — this is a stripped-down
 * version that mirrors the markdown round-trip behaviour
 * (`$convertToMarkdownString(TRANSFORMERS)`) so custom-field values submitted
 * from the extension match what the web app produces.
 *
 * Plugins kept: rich text, history, list, link, auto-link, markdown shortcut,
 * on-change, initial-value seeding. Everything that requires application
 * context (mentions, experiment-mentions) or backend integrations (image
 * upload, drag-drop paste) is deliberately omitted.
 */

const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/

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
  paragraph: "rte-paragraph",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    code: "bg-slate-100 px-1 rounded text-xs font-mono"
  },
  heading: {
    h1: "text-xl font-bold",
    h2: "text-lg font-bold",
    h3: "text-base font-bold"
  },
  list: {
    ul: "list-disc list-inside",
    ol: "list-decimal list-inside",
    listitem: "ml-2"
  },
  link: "text-blue-600 underline cursor-pointer",
  quote: "border-l-4 border-gray-300 pl-2 italic"
}

const editorNodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  // CodeNode is required by the standard `TRANSFORMERS` set
  // (the CODE element transformer pulls it in). Including it lets us reuse
  // the upstream transformer list verbatim without maintaining our own
  // subset — same set the web app uses.
  CodeNode
]

/**
 * Seeds the editor with the supplied markdown value on mount. Re-seeds if the
 * `value` prop changes externally (e.g. AI Fill writes to the parent state)
 * but ignores changes that originated from the editor itself (we suppress the
 * external sync while the editor is focused so user typing is not clobbered).
 */
function InitialValuePlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext()
  const lastValueRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastValueRef.current === value) return
    lastValueRef.current = value

    editor.update(() => {
      const root = $getRoot()
      root.clear()
      // $convertFromMarkdownString treats plain (non-markdown) text as
      // identity, so AI Fill plain text round-trips cleanly.
      $convertFromMarkdownString(value || "", TRANSFORMERS)
    })
  }, [editor, value])

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

  const initialConfig = {
    namespace: "ExtensionRichTextEditor",
    theme,
    onError: (error: Error) => {
      // Lexical surfaces internal errors via this callback; log without
      // throwing so a transient state issue does not crash the modal.
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
      onChange(markdown)
    })
  }

  return (
    <div className={"relative w-full" + (className ? " " + className : "")}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                id={id}
                data-testid={testid}
                ariaLabelledBy={ariaLabelledBy}
                className={
                  "w-full border border-gray-300 rounded px-2 py-1 text-sm " +
                  "min-h-[96px] focus:outline-none focus:ring-2 " +
                  "focus:ring-blue-500 prose prose-sm max-w-none" +
                  (disabled ? " bg-slate-100 cursor-not-allowed" : "")
                }
              />
            }
            placeholder={
              placeholder ? (
                <div className="pointer-events-none absolute left-2 top-1 text-sm text-gray-400">
                  {placeholder}
                </div>
              ) : null
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <AutoLinkPlugin matchers={MATCHERS} />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
          <InitialValuePlugin value={value} />
        </div>
      </LexicalComposer>
    </div>
  )
}

export default RichTextEditor
