import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { DRAG_DROP_PASTE } from "@lexical/rich-text"
import { isMimeType, mediaFileReader } from "@lexical/utils"
import { COMMAND_PRIORITY_LOW } from "lexical"
import { useEffect } from "react"

import { BackgroundAPIClient } from "~src/lib/background-api-client"
import { debugWarn } from "~src/utils/debug"

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
 * Listens for drag-drop / clipboard-paste of files. Filters image MIME types
 * only, uploads to the ABsmartly /file_uploads/attachments endpoint via the
 * background script (mirrors the web app), and dispatches INSERT_IMAGE_COMMAND
 * with the returned hosted URL.
 *
 * If the upload fails (no auth, offline, server error) we fall back to a
 * `data:` URL via FileReader so the user still sees their image — better
 * to have a temporarily-inlined image than to silently drop the paste.
 */
export default function DragDropPaste(): null {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    return editor.registerCommand(
      DRAG_DROP_PASTE,
      (files) => {
        ;(async () => {
          const apiClient = new BackgroundAPIClient()
          const filesResult = await mediaFileReader(
            files,
            [ACCEPTABLE_IMAGE_TYPES].flatMap((x) => x)
          )
          for (const { file, result } of filesResult) {
            if (!isMimeType(file, ACCEPTABLE_IMAGE_TYPES)) continue
            let src: string = result
            try {
              const uploaded = await apiClient.uploadFile(file, "attachments")
              const url =
                (uploaded as any)?.file?.url || (uploaded as any)?.url || null
              if (typeof url === "string" && url.length > 0) {
                src = url
              }
            } catch (err) {
              debugWarn(
                "[DragDropPaste] file upload failed, falling back to data URL:",
                err instanceof Error ? err.message : err
              )
            }
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
              altText: file.name,
              src,
              uploaded: true
            })
          }
        })()
        return true
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor])
  return null
}
