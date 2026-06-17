import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $wrapNodeInElement, mergeRegister } from "@lexical/utils"
import {
  $createParagraphNode,
  $createRangeSelection,
  $getSelection,
  $insertNodes,
  $isNodeSelection,
  $isRootOrShadowRoot,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  createCommand,
  DRAGOVER_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  type LexicalCommand,
  type LexicalEditor
} from "lexical"
import { useEffect } from "react"

import {
  $createImageNode,
  $isImageNode,
  ImageNode,
  type ImagePayload
} from "../../nodes/ImageNode"
import { CAN_USE_DOM } from "../../shared/canUseDOM"

export type InsertImagePayload = Readonly<ImagePayload>

const getDOMSelection = (targetWindow: Window | null): Selection | null =>
  CAN_USE_DOM ? (targetWindow || window).getSelection() : null

export const INSERT_IMAGE_COMMAND: LexicalCommand<InsertImagePayload> =
  createCommand("INSERT_IMAGE_COMMAND")

/**
 * Images plugin — extension flavor. The web app uses
 * `uploadFile({ usage: "attachments" })` to push images to the
 * absmartly file service; the extension has no such endpoint, so we
 * always embed images as `data:image/...` base64 URLs in the markdown.
 *
 * This component only handles INSERT_IMAGE_COMMAND wiring + drag/drop
 * within the editor (re-positioning an already-inserted image). The
 * actual paste/drop-file → data-url conversion lives in
 * DragDropPastePlugin.
 */
export default function ImagesPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error("ImagesPlugin: ImageNode not registered on editor")
    }

    return mergeRegister(
      editor.registerCommand<InsertImagePayload>(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          // Always not-uploading in the extension; src is already a data URL.
          const imageNode = $createImageNode({ ...payload, uploading: false })
          $insertNodes([imageNode])
          if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
            $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd()
          }
          return true
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand<DragEvent>(
        DRAGSTART_COMMAND,
        (event) => onDragStart(event),
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand<DragEvent>(
        DRAGOVER_COMMAND,
        (event) => onDragover(event),
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand<DragEvent>(
        DROP_COMMAND,
        (event) => onDrop(event, editor),
        COMMAND_PRIORITY_HIGH
      )
    )
  }, [editor])

  return null
}

const TRANSPARENT_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
let dragImage: HTMLImageElement | null = null
function getDragImage(): HTMLImageElement {
  if (!dragImage && CAN_USE_DOM) {
    dragImage = document.createElement("img")
    dragImage.src = TRANSPARENT_IMAGE
  }
  return dragImage as HTMLImageElement
}

function onDragStart(event: DragEvent): boolean {
  const node = getImageNodeInSelection()
  if (!node) return false
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return false
  dataTransfer.setData("text/plain", "_")
  const dragImg = getDragImage()
  if (dragImg) dataTransfer.setDragImage(dragImg, 0, 0)
  dataTransfer.setData(
    "application/x-lexical-drag",
    JSON.stringify({
      data: {
        altText: node.__altText,
        height: node.__height,
        key: node.getKey(),
        maxWidth: node.__maxWidth,
        src: node.__src,
        width: node.__width
      },
      type: "image"
    })
  )
  return true
}

function onDragover(event: DragEvent): boolean {
  const node = getImageNodeInSelection()
  if (!node) return false
  if (!canDropImage(event)) {
    event.preventDefault()
  }
  return true
}

function onDrop(event: DragEvent, editor: LexicalEditor): boolean {
  const node = getImageNodeInSelection()
  if (!node) return false
  const data = getDragImageData(event)
  if (!data) return false
  event.preventDefault()
  if (canDropImage(event)) {
    const range = getDragSelection(event)
    node.remove()
    const rangeSelection = $createRangeSelection()
    if (range) {
      rangeSelection.applyDOMRange(range)
    }
    $setSelection(rangeSelection)
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, { ...data, uploaded: true })
  }
  return true
}

function getImageNodeInSelection() {
  const selection = $getSelection()
  if (!$isNodeSelection(selection)) return null
  const nodes = selection.getNodes()
  const node = nodes[0]
  return $isImageNode(node) ? node : null
}

function getDragImageData(event: DragEvent): null | InsertImagePayload {
  const dragData = event.dataTransfer?.getData("application/x-lexical-drag")
  if (!dragData) return null
  const { type, data } = JSON.parse(dragData)
  if (type !== "image") return null
  return data
}

function canDropImage(event: DragEvent): boolean {
  const target = event.target
  return !!(
    target &&
    target instanceof HTMLElement &&
    !target.closest("code, span.editor-image") &&
    target.parentElement &&
    target.parentElement.closest("div.ContentEditable__root")
  )
}

interface LexicalDragEvent extends DragEvent {
  rangeOffset?: number
  rangeParent?: Node
}

function getDragSelection(event: DragEvent): Range | null | undefined {
  const ev = event as LexicalDragEvent
  let range: Range | null | undefined
  const target = event.target as null | Element | Document
  const targetWindow =
    target == null
      ? null
      : target.nodeType === 9
        ? (target as Document).defaultView
        : (target as Element).ownerDocument.defaultView
  const domSelection = getDOMSelection(targetWindow)
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(event.clientX, event.clientY)
  } else if (ev.rangeParent && domSelection !== null) {
    domSelection.collapse(ev.rangeParent, ev.rangeOffset || 0)
    range = domSelection.getRangeAt(0)
  } else {
    throw new Error("Cannot get the selection when dragging")
  }
  return range
}
