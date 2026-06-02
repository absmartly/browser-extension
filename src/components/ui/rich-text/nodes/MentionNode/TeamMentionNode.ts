import {
  $applyNodeReplacement,
  type EditorConfig,
  type LexicalNode,
  type NodeKey
} from "lexical"

import { mentionStore } from "../mentionStore"
import { MentionNode, type SerializedMentionNode } from "./MentionNode"
import { getMentionClasses } from "./mentionStyles"

export type SerializedTeamMentionNode = SerializedMentionNode

export class TeamMentionNode extends MentionNode {
  __color?: string

  static getType(): string {
    return "team-mention"
  }

  static clone(node: TeamMentionNode): TeamMentionNode {
    return new TeamMentionNode(
      node.__mention,
      node.__id,
      node.__color,
      node.__text,
      node.__key
    )
  }

  static importJSON(
    serializedNode: SerializedTeamMentionNode
  ): TeamMentionNode {
    const node = $createTeamMentionNode(
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

  constructor(
    mentionName: string,
    id: string,
    color?: string,
    text?: string,
    key?: NodeKey
  ) {
    super(mentionName, id, text ?? mentionName, key)
    this.__color = color
  }

  exportJSON(): SerializedTeamMentionNode {
    return {
      ...super.exportJSON()
    }
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config)
    if (this.__color != null) {
      dom.className = getMentionClasses("text-white")
      dom.style.backgroundColor = this.__color
    } else {
      dom.className = getMentionClasses("bg-slate-200")
    }
    return dom
  }
}

export function $createTeamMentionNode(
  mentionName: string,
  id: string,
  color?: string
): TeamMentionNode {
  const mentionNode = new TeamMentionNode(`@${mentionName}`, id, color)
  mentionNode.setMode("token").toggleDirectionless()
  return $applyNodeReplacement(mentionNode)
}

export function $getTeamMentionNode(id: string): TeamMentionNode | undefined {
  const teams = mentionStore.getTeams()
  const mention = teams.find((t) => t.id.toString() === id)

  if (!mention && teams.length === 0) {
    const placeholder = new TeamMentionNode(" ".repeat(30), id)
    placeholder.setStyle(
      "animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite "
    )
    return $applyNodeReplacement(placeholder)
  } else if (!mention) {
    return
  }

  return $createTeamMentionNode(mention.name, id, mention.color)
}

export function $isTeamMentionNode(
  node: LexicalNode | null | undefined
): node is TeamMentionNode {
  return node instanceof TeamMentionNode
}
