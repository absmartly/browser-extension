import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { DRAG_DROP_PASTE } from "@lexical/rich-text"
import { isMimeType, mediaFileReader } from "@lexical/utils"
import { COMMAND_PRIORITY_LOW } from "lexical"
import { useEffect } from "react"

import { INSERT_IMAGE_COMMAND } from "../ImagesPlugin"

const ACCEPTABLE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp"
]

/**
 * Listens for drag-drop / clipboard-paste of files. Filters image MIME
 * types only, converts to a `data:` URL (FileReader runs inside
 * `mediaFileReader`) and dispatches INSERT_IMAGE_COMMAND with the data URL.
 *
 * No upload — the extension embeds images directly into the markdown payload.
 */
export default function DragDropPaste(): null {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    return editor.registerCommand(
      DRAG_DROP_PASTE,
      (files) => {
        ;(async () => {
          const filesResult = await mediaFileReader(
            files,
            [ACCEPTABLE_IMAGE_TYPES].flatMap((x) => x)
          )
          for (const { file, result } of filesResult) {
            if (isMimeType(file, ACCEPTABLE_IMAGE_TYPES)) {
              editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
                altText: file.name,
                src: result,
                uploaded: true
              })
            }
          }
        })()
        return true
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor])
  return null
}
