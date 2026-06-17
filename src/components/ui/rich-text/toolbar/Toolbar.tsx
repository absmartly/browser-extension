import { $createCodeNode, $isCodeNode } from "@lexical/code"
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link"
import {
  $createListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND
} from "@lexical/list"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  type HeadingTagType
} from "@lexical/rich-text"
import { $isAtNodeEnd, $setBlocksType } from "@lexical/selection"
import { INSERT_TABLE_COMMAND } from "@lexical/table"
import {
  $findMatchingParent,
  $getNearestBlockElementAncestorOrThrow,
  mergeRegister
} from "@lexical/utils"
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type ElementNode,
  type RangeSelection,
  type TextNode
} from "lexical"
import React, { useCallback, useEffect, useRef, useState } from "react"

import { INSERT_IMAGE_COMMAND } from "../plugins/ImagesPlugin"

const CAN_USE_DOM =
  typeof window !== "undefined" &&
  typeof window.document !== "undefined" &&
  typeof window.document.createElement !== "undefined"

const IS_APPLE =
  CAN_USE_DOM && /Mac|iPod|iPhone|iPad/.test(window.navigator.platform)

export function getSelectedNode(
  selection: RangeSelection
): TextNode | ElementNode {
  const anchor = selection.anchor
  const focus = selection.focus
  const anchorNode = selection.anchor.getNode()
  const focusNode = selection.focus.getNode()
  if (anchorNode === focusNode) return anchorNode
  const isBackward = selection.isBackward()
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode
  }
  return $isAtNodeEnd(anchor) ? focusNode : anchorNode
}

const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/

const TEXT_TYPES = [
  { key: "Normal", label: "Normal" },
  { key: "Heading 1", label: "Heading 1" },
  { key: "Heading 2", label: "Heading 2" },
  { key: "Heading 3", label: "Heading 3" },
  { key: "Heading 4", label: "Heading 4" },
  { key: "Heading 5", label: "Heading 5" },
  { key: "Heading 6", label: "Heading 6" },
  { key: "Bullet List", label: "Bullet List" },
  { key: "Numbered List", label: "Numbered List" }
]

/**
 * Toolbar plugin, extension flavor. Substitutes the web app's
 * react-stately/react-aria/UilIcon components with inline SVG + plain HTML
 * buttons. All operations from the web app toolbar are preserved (text type,
 * bold/italic/underline/strikethrough/quote/code/clear, link, list, table,
 * image). Selection-aware: tracks active formats and reflects them in the
 * button states.
 */
export function ToolbarPlugin({
  onInsertImage
}: {
  onInsertImage?: () => void
}): JSX.Element {
  const [editor] = useLexicalComposerContext()
  const [textType, setTextType] = useState("Normal")
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [isCode, setIsCode] = useState(false)
  const [isQuote, setIsQuote] = useState(false)
  const [isLink, setIsLink] = useState(false)
  const [isAutoLink, setIsAutoLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkLabel, setLinkLabel] = useState("")
  const [linkEditorOpen, setLinkEditorOpen] = useState(false)
  const linkUrlInputRef = useRef<HTMLInputElement>(null)

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    const anchorNode = selection.anchor.getNode()
    let element: ElementNode | null = (
      anchorNode.getKey() === "root"
        ? (anchorNode as unknown as ElementNode)
        : ($findMatchingParent(anchorNode, (e) => {
            const parent = e.getParent()
            return parent != null && $isRootOrShadowRoot(parent)
          }) as ElementNode | null)
    ) as ElementNode | null

    if (element == null) {
      element = anchorNode.getTopLevelElementOrThrow() as ElementNode
    }

    const node = getSelectedNode(selection)
    const parent = node.getParent()

    setIsBold(selection.hasFormat("bold"))
    setIsItalic(selection.hasFormat("italic"))
    setIsUnderline(selection.hasFormat("underline"))
    setIsStrikethrough(selection.hasFormat("strikethrough"))
    setIsCode($isCodeNode(element))
    setIsQuote($isQuoteNode(element))
    setIsLink($isLinkNode(parent) || $isLinkNode(node))
    setIsAutoLink(
      $isTextNode(node) ? URL_MATCHER.exec(node.__text) !== null : false
    )

    // Reflect text type
    const type = $isHeadingNode(element) ? element.getTag() : element.getType()
    switch (type) {
      case "paragraph":
        setTextType("Normal")
        break
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        setTextType(`Heading ${type.charAt(1)}`)
        break
      case "list": {
        const tag = (element as unknown as { getTag: () => string }).getTag()
        if (tag === "ul") setTextType("Bullet List")
        else if (tag === "ol") setTextType("Numbered List")
        break
      }
      default:
        setTextType("Normal")
    }
  }, [])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateToolbar()
        })
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          $updateToolbar()
          return false
        },
        1
      )
    )
  }, [editor, $updateToolbar])

  const handleTextTypeChange = (key: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      switch (key) {
        case "Normal":
          $setBlocksType(selection, () => $createParagraphNode())
          break
        case "Heading 1":
        case "Heading 2":
        case "Heading 3":
        case "Heading 4":
        case "Heading 5":
        case "Heading 6": {
          const tag = `h${key.charAt(key.length - 1)}` as HeadingTagType
          $setBlocksType(selection, () => $createHeadingNode(tag))
          break
        }
        case "Bullet List":
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
          break
        case "Numbered List":
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
          break
      }
    })
    setTextType(key)
  }

  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      const anchor = selection.anchor
      const focus = selection.focus
      const nodes = selection.getNodes()
      const anchorNode = anchor.getNode()
      let element: ElementNode | null = (
        anchorNode.getKey() === "root"
          ? (anchorNode as unknown as ElementNode)
          : ($findMatchingParent(anchorNode, (e) => {
              const parent = e.getParent()
              return parent != null && $isRootOrShadowRoot(parent)
            }) as ElementNode | null)
      ) as ElementNode | null
      if (element == null)
        element = anchorNode.getTopLevelElementOrThrow() as ElementNode
      if (
        $isHeadingNode(element) ||
        $isQuoteNode(element) ||
        $isCodeNode(element)
      ) {
        element.replace($createParagraphNode(), true)
      }
      if (anchor.key === focus.key && anchor.offset === focus.offset) return
      nodes.forEach((node, i) => {
        if ($isTextNode(node)) {
          let n = node
          if (i === 0 && anchor.offset !== 0) {
            n = n.splitText(anchor.offset)[1] || n
          }
          if (i === nodes.length - 1) {
            n = n.splitText(focus.offset)[0] || n
          }
          if (n.__style !== "") n.setStyle("")
          if (n.__format !== 0) {
            n.setFormat(0)
            $getNearestBlockElementAncestorOrThrow(n).setFormat("")
          }
          if ($isHeadingNode(n) || $isQuoteNode(n) || $isCodeNode(n)) {
            n.replace($createParagraphNode(), true)
          }
        }
      })
    })
  }

  const toggleQuote = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () =>
          !isQuote ? $createQuoteNode() : $createParagraphNode()
        )
      }
    })
  }

  const toggleCode = () => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      $setBlocksType(selection, () =>
        !isCode ? $createCodeNode() : $createParagraphNode()
      )
      const root = $getRoot()
      if ($isCodeNode(root.getLastChild()) && !isCode) {
        root.append($createParagraphNode())
      }
    })
  }

  const openLinkEditor = () => {
    editor.getEditorState().read(() => {
      const sel = $getSelection()
      if ($isRangeSelection(sel)) {
        const node = getSelectedNode(sel)
        const parent = node.getParent()
        if ($isLinkNode(parent)) {
          setLinkUrl(parent.getURL())
          setLinkLabel(parent.getTextContent())
        } else if ($isLinkNode(node)) {
          setLinkUrl(node.getURL())
          setLinkLabel(node.getTextContent())
        } else {
          setLinkUrl("")
          setLinkLabel(node.getTextContent())
        }
      }
    })
    setLinkEditorOpen(true)
    setTimeout(() => linkUrlInputRef.current?.focus(), 0)
  }

  const removeLink = () => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
  }

  const applyLink = () => {
    const url = linkUrl.trim()
    if (!url) {
      setLinkEditorOpen(false)
      return
    }
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
      url,
      target: "_blank",
      rel: "noopener noreferrer"
    })
    setLinkEditorOpen(false)
  }

  const insertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: "3",
      rows: "3",
      includeHeaders: true
    })
  }

  const insertImage = () => {
    if (onInsertImage) return onInsertImage()
    // Default: open file picker, convert to data URL, insert.
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const src = reader.result as string
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
          src,
          altText: file.name,
          uploaded: true
        })
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const btn = (props: {
    onClick: () => void
    title: string
    isActive?: boolean
    isDisabled?: boolean
    children: React.ReactNode
    "aria-label": string
  }) => (
    <button
      type="button"
      tabIndex={-1}
      onClick={(e) => {
        e.preventDefault()
        props.onClick()
      }}
      onMouseDown={(e) => e.preventDefault()}
      title={props.title}
      aria-label={props["aria-label"]}
      aria-pressed={props.isActive}
      disabled={props.isDisabled}
      className={
        "inline-flex h-7 w-7 items-center justify-center rounded text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 " +
        (props.isActive ? "bg-slate-200 text-slate-900" : "")
      }>
      {props.children}
    </button>
  )

  return (
    <div
      tabIndex={-1}
      className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-slate-300 bg-white px-2 py-1">
      <select
        aria-label="Text Type"
        className="h-7 rounded border border-slate-300 bg-white px-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
        value={textType}
        onChange={(e) => handleTextTypeChange(e.target.value)}>
        {TEXT_TYPES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <Divider />
      {btn({
        onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
        title: IS_APPLE ? "Bold (⌘B)" : "Bold (Ctrl+B)",
        "aria-label": "Bold",
        isActive: isBold,
        children: <span className="font-bold">B</span>
      })}
      {btn({
        onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
        title: IS_APPLE ? "Italic (⌘I)" : "Italic (Ctrl+I)",
        "aria-label": "Italic",
        isActive: isItalic,
        children: <span className="italic">I</span>
      })}
      {btn({
        onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"),
        title: IS_APPLE ? "Underline (⌘U)" : "Underline (Ctrl+U)",
        "aria-label": "Underline",
        isActive: isUnderline,
        children: <span className="underline">U</span>
      })}
      {btn({
        onClick: () =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough"),
        title: "Strikethrough",
        "aria-label": "Strikethrough",
        isActive: isStrikethrough,
        children: <span className="line-through">S</span>
      })}
      <Divider />
      {btn({
        onClick: toggleQuote,
        title: "Quote",
        "aria-label": "Quote",
        isActive: isQuote,
        children: <QuoteIcon />
      })}
      {btn({
        onClick: toggleCode,
        title: "Code Block",
        "aria-label": "Code Block",
        isActive: isCode,
        children: <CodeIcon />
      })}
      {btn({
        onClick: clearFormatting,
        title: "Clear Formatting",
        "aria-label": "Clear Formatting",
        children: <ClearIcon />
      })}
      <Divider />
      {btn({
        onClick: isLink ? removeLink : openLinkEditor,
        title: "Link",
        "aria-label": "Link",
        isActive: isLink,
        isDisabled: isAutoLink,
        children: <LinkIcon />
      })}
      {btn({
        onClick: insertImage,
        title: "Insert Image",
        "aria-label": "Insert Image",
        children: <ImageIcon />
      })}
      {btn({
        onClick: insertTable,
        title: "Insert Table",
        "aria-label": "Insert Table",
        children: <TableIcon />
      })}

      {linkEditorOpen && (
        <div
          className="absolute z-50 mt-1 flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-md"
          style={{ top: "100%" }}
          role="dialog"
          aria-label="Edit Link">
          <div className="flex items-center gap-2">
            <label
              className="w-12 text-xs text-slate-600"
              htmlFor="rte-link-label">
              Text
            </label>
            <input
              id="rte-link-label"
              type="text"
              className="h-7 w-64 rounded border border-slate-300 px-2 text-sm focus:border-blue-500 focus:outline-none"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyLink()
                else if (e.key === "Escape") setLinkEditorOpen(false)
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              className="w-12 text-xs text-slate-600"
              htmlFor="rte-link-url">
              URL
            </label>
            <input
              ref={linkUrlInputRef}
              id="rte-link-url"
              type="url"
              className="h-7 w-64 rounded border border-slate-300 px-2 text-sm focus:border-blue-500 focus:outline-none"
              value={linkUrl}
              placeholder="https://"
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyLink()
                else if (e.key === "Escape") setLinkEditorOpen(false)
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="h-7 rounded border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-100"
              onClick={() => setLinkEditorOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="h-7 rounded bg-blue-600 px-2 text-xs text-white hover:bg-blue-700"
              onClick={applyLink}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Divider(): JSX.Element {
  return <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
}

function QuoteIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden>
      <path
        d="M5 4v6m6-4c-2 0-3 1-3 3v3h3V8H8c0-1 1-2 3-2zm-6 0c-2 0-3 1-3 3v3h3V8H2c0-1 1-2 3-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}

function CodeIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden>
      <path d="M7 5l-5 5 5 5 1.4-1.4L4.8 10l3.6-3.6L7 5zm6 0l-1.4 1.4L15.2 10l-3.6 3.6L13 15l5-5-5-5z" />
    </svg>
  )
}

function ClearIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden>
      <path d="M3 4h14v2H3V4zm3 4h8v2H6V8zm-1 4l7 7 1.4-1.4-5.6-5.6L13 11l-1.4-1.4-7 7L5 12z" />
    </svg>
  )
}

function LinkIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden>
      <path d="M9 13a4 4 0 010-6l3-3a4 4 0 116 6l-1.5 1.5-1.4-1.4L16.6 8.6a2 2 0 10-2.8-2.8L11 8.6a2 2 0 000 2.8L9 13zm2-6a4 4 0 010 6l-3 3a4 4 0 11-6-6l1.5-1.5L4.9 9.9 3.4 11.4a2 2 0 102.8 2.8L9 11.4a2 2 0 000-2.8L11 7z" />
    </svg>
  )
}

function ImageIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden>
      <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 0v12h12V4H4zm2 8l3-3 2 2 4-4v5H6v0zm1-7a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
    </svg>
  )
}

function TableIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden>
      <path d="M3 4h14v12H3V4zm2 2v2h4V6H5zm6 0v2h4V6h-4zM5 10v2h4v-2H5zm6 0v2h4v-2h-4zM5 14v0h4v0H5zm6 0v0h4v0h-4z" />
      <path
        d="M3 4h14v12H3z M3 8h14 M3 12h14 M9 4v12 M13 4v12"
        stroke="currentColor"
        fill="none"
        strokeWidth="1"
      />
    </svg>
  )
}

// Avoid unused
void $createListNode
