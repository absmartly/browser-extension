import {
  TRANSFORMERS as DEFAULT_TRANSFORMERS,
  type TextMatchTransformer,
  type Transformer
} from "@lexical/markdown"

import {
  $createImageNode,
  $isImageNode,
  ImageNode
} from "../../nodes/ImageNode"
import {
  $createExperimentMentionNode,
  $getExperimentMentionNode,
  $isExperimentMentionNode,
  ExperimentMentionNode,
  ExperimentType,
  setExperimentMentionIds
} from "../../nodes/MentionNode/ExperimentMentionNode"
import {
  $getTeamMentionNode,
  $isTeamMentionNode,
  TeamMentionNode
} from "../../nodes/MentionNode/TeamMentionNode"
import {
  $getUserMentionNode,
  $isUserMentionNode,
  UserMentionNode
} from "../../nodes/MentionNode/UserMentionNode"

// Patterns ported verbatim from the web app's `@/constants/*Regex.ts`.
export const IMAGE_REGEX = /!(?:\[([^[]*)\])(?:\(([^(]+)\))/
export const TEAM_MENTION_REGEX = /\[@team_id:(?:(\d+))\]/
export const USER_MENTION_REGEX = /\[@user_id:(?:(\d+))\]/
export const EXPERIMENT_MENTION_REGEX =
  /\[#(?:(experiment|feature))_id:(?:(\d+))\]/

export const IMAGE: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: (node) => {
    if (!$isImageNode(node) || node.__uploading) {
      return null
    }
    return `![${node.getAltText()}](${node.getSrc()})`
  },
  importRegExp: IMAGE_REGEX,
  regExp: IMAGE_REGEX,
  replace: (textNode, match) => {
    const [, altText, src] = match
    const imageNode = $createImageNode({
      altText,
      maxWidth: 800,
      src
    })
    textNode.replace(imageNode)
  },
  trigger: ")",
  type: "text-match"
}

export const USER_MENTION: TextMatchTransformer = {
  dependencies: [UserMentionNode],
  export: (node) => {
    if (!$isUserMentionNode(node)) {
      return null
    }
    return `[@user_id:${node.__id}]`
  },
  importRegExp: USER_MENTION_REGEX,
  regExp: USER_MENTION_REGEX,
  replace: (textNode, match) => {
    const [, id] = match
    const mentionNode = $getUserMentionNode(id)
    if (mentionNode) {
      textNode.replace(mentionNode)
    }
  },
  trigger: "]",
  type: "text-match"
}

export const TEAM_MENTION: TextMatchTransformer = {
  dependencies: [TeamMentionNode],
  export: (node) => {
    if (!$isTeamMentionNode(node)) {
      return null
    }
    return `[@team_id:${node.__id}]`
  },
  importRegExp: TEAM_MENTION_REGEX,
  regExp: TEAM_MENTION_REGEX,
  replace: (textNode, match) => {
    const [, id] = match
    const mentionNode = $getTeamMentionNode(id)
    if (mentionNode) {
      textNode.replace(mentionNode)
    }
  },
  trigger: "]",
  type: "text-match"
}

// Module-local accumulator of experiment ids seen during the most recent
// markdown import. Plugins (`ExperimentMentionsPlugin`) read this to fetch
// the full experiment objects so the placeholders can resolve into real
// mention nodes. Exported as `let` so the live binding stays current.
export let experimentMentionIds: string[] = []

export function getExperimentMentionIds(): string[] {
  return experimentMentionIds
}

export function resetExperimentMentionIds(): void {
  experimentMentionIds = []
  setExperimentMentionIds([])
}

export const EXPERIMENT_MENTION: TextMatchTransformer = {
  dependencies: [ExperimentMentionNode],
  export: (node) => {
    if (!$isExperimentMentionNode(node)) {
      return null
    }
    return node.__experimentType === ExperimentType.test
      ? `[#experiment_id:${node.__id}]`
      : `[#feature_id:${node.__id}]`
  },
  importRegExp: EXPERIMENT_MENTION_REGEX,
  regExp: EXPERIMENT_MENTION_REGEX,
  replace: (textNode, match) => {
    const [, type, id] = match
    const experimentType =
      type === "experiment" ? ExperimentType.test : ExperimentType.feature

    experimentMentionIds = [...experimentMentionIds, id]
    setExperimentMentionIds(experimentMentionIds)

    const mentionNode = $getExperimentMentionNode(id, experimentType)
    if (mentionNode) {
      textNode.replace(mentionNode)
    }
  },
  trigger: "]",
  type: "text-match"
}

// Helper to build a new ExperimentMentionNode from the typeahead.
export { $createExperimentMentionNode }

export const TRANSFORMERS: Array<Transformer> = [
  IMAGE,
  USER_MENTION,
  TEAM_MENTION,
  EXPERIMENT_MENTION,
  ...DEFAULT_TRANSFORMERS
]
