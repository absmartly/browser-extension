import {
  $applyNodeReplacement,
  type EditorConfig,
  type LexicalNode,
  type NodeKey
} from "lexical"

import { mentionStore } from "../mentionStore"
import { MentionNode, type SerializedMentionNode } from "./MentionNode"
import { getMentionClasses } from "./mentionStyles"

export type SerializedUserMentionNode = SerializedMentionNode

export class UserMentionNode extends MentionNode {
  static getType(): string {
    return "user-mention"
  }

  static clone(node: UserMentionNode): UserMentionNode {
    return new UserMentionNode(
      node.__mention,
      node.__id,
      node.__text,
      node.__key
    )
  }

  static importJSON(
    serializedNode: SerializedUserMentionNode
  ): UserMentionNode {
    const node = $createUserMentionNode(
      serializedNode.mentionName,
      serializedNode.id
    )
    node.setTextContent(serializedNode.text)
    node.setFormat(serializedNode.format)
    node.setDetail(serializedNode.detail)
    node.setMode(serializedNode.mode)
    node.setStyle(serializedNode.style)
    return node
  }

  constructor(mentionName: string, id: string, text?: string, key?: NodeKey) {
    super(mentionName, id, text ?? mentionName, key)
  }

  exportJSON(): SerializedUserMentionNode {
    return {
      ...super.exportJSON()
    }
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config)
    dom.className = getMentionClasses("bg-slate-200")
    return dom
  }
}

export function $createUserMentionNode(
  mentionName: string,
  id: string
): UserMentionNode {
  const mentionNode = new UserMentionNode(`@${mentionName}`, id)
  mentionNode.setMode("token").toggleDirectionless()
  return $applyNodeReplacement(mentionNode)
}

export function $getUserMentionNode(id: string): UserMentionNode | undefined {
  const users = mentionStore.getUsers()
  const mention = users.find((u) => u.id.toString() === id)

  if (!mention && users.length === 0) {
    // Users haven't loaded yet — show a pulse placeholder.
    const placeholder = new UserMentionNode(" ".repeat(30), id)
    placeholder.setStyle(
      "animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite "
    )
    return $applyNodeReplacement(placeholder)
  } else if (!mention) {
    return
  }

  return $createUserMentionNode(mention.fullName, id)
}

export function $isUserMentionNode(
  node: LexicalNode | null | undefined
): node is UserMentionNode {
  return node instanceof UserMentionNode
}
