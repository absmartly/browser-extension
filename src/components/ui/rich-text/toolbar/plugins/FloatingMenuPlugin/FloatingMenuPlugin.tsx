import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection } from "lexical"
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject
} from "react"
import { createPortal } from "react-dom"

import { getSelectedNode } from "../../Toolbar"

interface FloatingMenuPluginProps {
  showFloatingMenu: boolean
  linkRef: MutableRefObject<HTMLAnchorElement | null>
}

/**
 * Lightweight floating menu over a clicked link. Reproduces the web app's
 * `Open url / Edit` mini-toolbar without depending on react-aria's overlay
 * positioning APIs — we just measure the link's bounding box and position
 * the menu above it.
 */
export function FloatingMenuPlugin({
  showFloatingMenu,
  linkRef
}: FloatingMenuPluginProps): React.ReactPortal | null {
  const [editor] = useLexicalComposerContext()
  const [isLink, setIsLink] = useState(false)
  const [nodeUrl, setNodeUrl] = useState("")
  const [hover, setHover] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0
  })

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return
        const node = getSelectedNode(selection)
        const parent = node.getParent()
        const linkNode = $isLinkNode(parent)
          ? parent
          : $isLinkNode(node)
            ? node
            : null
        if (linkNode) {
          setNodeUrl(linkNode.getURL())
          setIsLink(true)
        } else {
          setIsLink(false)
        }
      })
    })
  }, [editor])

  useLayoutEffect(() => {
    const link = linkRef.current
    if (!link || (!showFloatingMenu && !hover)) return
    const rect = link.getBoundingClientRect()
    setPos({
      top: rect.top - 36 + window.scrollY,
      left: rect.left + window.scrollX
    })
  }, [showFloatingMenu, hover, linkRef])

  if (typeof document === "undefined") return null
  if (!isLink || (!showFloatingMenu && !hover)) return null

  return createPortal(
    <div
      ref={menuRef}
      className="absolute z-[100] flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-md"
      style={{ top: pos.top, left: pos.left }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}>
      <a
        href={nodeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline">
        Open url
      </a>
      <span aria-hidden className="h-3 w-px bg-slate-300" />
      <button
        type="button"
        className="text-slate-700 hover:text-blue-600"
        onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)}>
        Remove
      </button>
    </div>,
    document.body
  )
}
