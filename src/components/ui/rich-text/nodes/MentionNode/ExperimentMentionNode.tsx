import {
  $applyNodeReplacement,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type Spread
} from "lexical"

import { mentionStore } from "../mentionStore"
import { MentionNode, type SerializedMentionNode } from "./MentionNode"

// Inline the ExperimentType enum to avoid pulling in the web app's
// `@/models/Experiment` types.
export enum ExperimentType {
  test = 1,
  feature = 2
}

export interface ExperimentMention {
  id: number
  name: string
  display_name?: string
  iteration?: number
  type: ExperimentType
  archived?: boolean
}

export type SerializedExperimentMentionNode = Spread<
  {
    experimentType: ExperimentType
  },
  SerializedMentionNode
>

export class ExperimentMentionNode extends MentionNode {
  __url: string
  __experimentType: ExperimentType

  static getType(): string {
    return "experiment-mention"
  }

  static clone(node: ExperimentMentionNode): ExperimentMentionNode {
    return new ExperimentMentionNode(
      node.__mention,
      node.__id,
      node.__experimentType,
      node.__text,
      node.__key
    )
  }

  static importJSON(
    serializedNode: SerializedExperimentMentionNode
  ): ExperimentMentionNode {
    const node = $createExperimentMentionNode(
      serializedNode.mentionName,
      serializedNode.id,
      serializedNode.experimentType
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
    experimentType: ExperimentType,
    text?: string,
    key?: NodeKey
  ) {
    super(mentionName, id, text ?? mentionName, key)
    this.__experimentType = experimentType
    this.__url =
      (experimentType === ExperimentType.test
        ? "/experiments/"
        : "/features/") + id
  }

  exportJSON(): SerializedExperimentMentionNode {
    return {
      ...super.exportJSON(),
      experimentType: this.__experimentType
    }
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config)
    dom.className =
      "bg-slate-200 py-0.5 px-2 rounded-md text-xs font-semibold text-blue-600 underline cursor-pointer"
    dom.addEventListener("click", () => {
      window.open(this.__url, "_blank")
    })
    return dom
  }
}

export function $createExperimentMentionNode(
  mentionName: string,
  id: string,
  experimentType: ExperimentType
): ExperimentMentionNode {
  const node = new ExperimentMentionNode(`#${mentionName}`, id, experimentType)
  node.toggleDirectionless()
  return $applyNodeReplacement(node)
}

// Track ids referenced in the source markdown so the placeholder branch can
// keep them visible until the experiment data resolves.
export let experimentMentionIds: string[] = []

export function setExperimentMentionIds(ids: string[]) {
  experimentMentionIds = ids
}

export function $getExperimentMentionNode(
  id: string,
  experimentType: ExperimentType
): ExperimentMentionNode | undefined {
  const experiments = mentionStore.getExperiments()
  const mention = experiments.find(
    (m) => m.id.toString() === id && m.type === experimentType
  )

  if (!mention && [...new Set(experimentMentionIds)].includes(id)) {
    const placeholder = new ExperimentMentionNode(
      " ".repeat(35),
      id,
      experimentType
    )
    placeholder.setStyle(
      "animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; text-decoration: none"
    )
    return $applyNodeReplacement(placeholder)
  } else if (!mention) {
    return
  }

  return $createExperimentMentionNode(
    mention.display_name ?? mention.name,
    id,
    experimentType
  )
}

export function $isExperimentMentionNode(
  node: LexicalNode | null | undefined
): node is ExperimentMentionNode {
  return node instanceof ExperimentMentionNode
}
