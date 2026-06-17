import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection"
import { mergeRegister } from "@lexical/utils"
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DRAGSTART_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type NodeKey
} from "lexical"
import React, { useCallback, useEffect, useRef } from "react"

import { $isImageNode } from "./ImageNode"

/**
 * Renders an inline image inside the Lexical editor. Simplified version of the
 * web-app component — no lightbox, no right-click menu, no resize handles.
 * Selection + delete/backspace removal is preserved so the keyboard UX matches.
 */
export default function ImageComponent({
  src,
  altText,
  width,
  height,
  maxWidth,
  nodeKey,
  uploading
}: {
  src: string
  altText: string
  width: "inherit" | number
  height: "inherit" | number
  maxWidth: number
  nodeKey: NodeKey
  uploading: boolean
}): React.JSX.Element {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey)
  const [editor] = useLexicalComposerContext()

  const onDelete = useCallback(
    (payload: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        payload.preventDefault()
        const node = $getNodeByKey(nodeKey)
        if ($isImageNode(node)) {
          node.remove()
        }
      }
      return false
    },
    [isSelected, nodeKey]
  )

  const onClick = useCallback(
    (event: MouseEvent) => {
      if (event.target === imageRef.current) {
        if (event.shiftKey) {
          setSelected(!isSelected)
        } else {
          clearSelection()
          setSelected(true)
        }
        return true
      }
      return false
    },
    [isSelected, setSelected, clearSelection]
  )

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand<MouseEvent>(
        CLICK_COMMAND,
        onClick,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        DRAGSTART_COMMAND,
        (event: DragEvent) => {
          if (event.target === imageRef.current) {
            event.preventDefault()
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      )
    )
  }, [editor, onClick, onDelete])

  return (
    <span className="relative inline-block align-bottom">
      <img
        ref={imageRef}
        src={src}
        alt={altText}
        draggable={isSelected}
        style={{
          maxWidth,
          width: width === "inherit" ? undefined : width,
          height: height === "inherit" ? undefined : height,
          outline: isSelected ? "2px solid #2563eb" : "none",
          opacity: uploading ? 0.5 : 1
        }}
        className="max-w-full rounded"
      />
      {uploading && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/50 text-xs text-gray-700">
          Uploading…
        </span>
      )}
    </span>
  )
}
