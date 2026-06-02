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
import { $getRoot, type EditorThemeClasses, type LexicalEditor } from "lexical"
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
 */
function InitialValuePlugin({ value }: { value: string }): null {
  const [editor] = useLexicalComposerContext()
  const lastValueRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastValueRef.current === value) return
    lastValueRef.current = value
    // Reset experiment mention id tracker before re-parsing so the
    // ExperimentMentionsPlugin only refetches what's actually referenced.
    resetExperimentMentionIds()
    editor.update(() => {
      const root = $getRoot()
      root.clear()
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
              <ContentEditable
                id={id}
                data-testid={testid}
                ariaLabelledBy={ariaLabelledBy}
                className={
                  "ContentEditable__root w-full border border-gray-300 px-2 py-1 text-sm " +
                  (disabled ? "rounded " : "rounded-b ") +
                  "min-h-[120px] focus:outline-none focus:ring-2 " +
                  "focus:ring-blue-500 prose prose-sm max-w-none" +
                  (disabled ? " bg-slate-100 cursor-not-allowed" : "")
                }
              />
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
              <MentionsPlugin value={value} />
              <ExperimentMentionsPlugin value={value} />
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
          <InitialValuePlugin value={value} />
        </div>
      </LexicalComposer>
    </div>
  )
}

export default RichTextEditor
