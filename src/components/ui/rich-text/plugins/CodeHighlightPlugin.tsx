import { registerCodeHighlighting } from "@lexical/code"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { useEffect } from "react"

/**
 * Mounts Lexical's Prism-based code-block tokenizer on the parent composer.
 * Safe to use in editor and viewer — it only wires the tokenizer; it does not
 * read or set selection. Ported verbatim from the web app.
 */
export const CodeHighlightPlugin = (): null => {
  const [editor] = useLexicalComposerContext()
  useEffect(() => registerCodeHighlighting(editor), [editor])
  return null
}

export default CodeHighlightPlugin
