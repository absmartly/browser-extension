import {
  TextNode,
  type DOMExportOutput,
  type EditorConfig,
  type NodeKey,
  type SerializedTextNode,
  type Spread
} from "lexical"

/**
 * Base TextNode for all mention variants (user / team / experiment).
 * Ported verbatim from the ABsmartly web app (FT-1882) so markdown
 * round-trips match what the web app produces.
 */
export type SerializedMentionNode = Spread<
  {
    mentionName: string
    id: string
    type: "mention"
    version: 1
  },
  SerializedTextNode
>

export class MentionNode extends TextNode {
  __id: string
  __mention: string

  static getType(): string {
    return "mention"
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__mention, node.__id, node.__text, node.__key)
  }

  constructor(mentionName: string, id: string, text?: string, key?: NodeKey) {
    super(text ?? mentionName, key)
    this.__mention = mentionName
    this.__id = id
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      mentionName: this.__mention,
      id: this.__id,
      type: "mention",
      version: 1
    }
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config)
    dom.className =
      "bg-slate-200 py-0.5 px-1.5 rounded-md text-xs font-semibold"
    return dom
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span")
    element.setAttribute("data-lexical-mention", "true")
    element.textContent = this.__text
    return { element }
  }

  isTextEntity(): true {
    return true
  }

  isSegmented(): false {
    return false
  }

  isToken(): true {
    return true
  }

  canInsertTextBefore(): boolean {
    return false
  }

  canInsertTextAfter(): boolean {
    return false
  }
}
