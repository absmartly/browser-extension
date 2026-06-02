import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption
} from "@lexical/react/LexicalTypeaheadMenuPlugin"
import { $createTextNode, type TextNode } from "lexical"
import React, { useCallback, useMemo, useState } from "react"
import * as ReactDOM from "react-dom"

import {
  $createTeamMentionNode,
  TeamMentionNode
} from "../../nodes/MentionNode/TeamMentionNode"
import {
  $createUserMentionNode,
  UserMentionNode
} from "../../nodes/MentionNode/UserMentionNode"
import type { MentionTeam, MentionUser } from "../../nodes/mentionStore"
import { checkForMentionTrigger } from "./checkForMentionTrigger"
import { useMentionUsersAndTeams } from "./mentionData"

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function isUserMention(
  mention: MentionUser | MentionTeam
): mention is MentionUser {
  return "fullName" in mention
}

function getDisplayName(mention: MentionUser | MentionTeam): string {
  return isUserMention(mention) ? mention.fullName : mention.name
}

function mentionLookupService({
  users,
  teams,
  mentionString
}: {
  users: MentionUser[]
  teams: MentionTeam[]
  mentionString: string | null
}): (MentionUser | MentionTeam)[] {
  const searchString = mentionString?.toLowerCase() ?? ""

  if (!searchString) {
    return [
      ...users.sort((a, b) => a.fullName.localeCompare(b.fullName)),
      ...teams.sort((a, b) => a.name.localeCompare(b.name))
    ]
  }

  const userResults = users.filter((u) =>
    normalize(u.fullName).includes(normalize(searchString))
  )
  const teamResults = teams.filter((t) =>
    normalize(t.name).includes(normalize(searchString))
  )

  return [
    ...userResults.sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b))
    ),
    ...teamResults.sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b))
    )
  ]
}

class MentionTypeaheadOption extends MenuOption {
  mention: MentionUser | MentionTeam
  constructor(mention: MentionUser | MentionTeam) {
    super(`${mention.id}`)
    this.mention = mention
  }
}

function MentionAvatar({
  mention
}: {
  mention: MentionUser | MentionTeam
}): JSX.Element {
  if (isUserMention(mention)) {
    if (mention.avatarUrl) {
      return (
        <img
          src={mention.avatarUrl}
          alt={mention.fullName}
          className="h-6 w-6 rounded-full object-cover"
        />
      )
    }
    const initials = mention.fullName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-[10px] font-semibold text-slate-700">
        {initials || "?"}
      </span>
    )
  }
  const initials = mention.initials || mention.name[0] || "?"
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
      style={{ backgroundColor: mention.color || "#64748b" }}>
      {initials}
    </span>
  )
}

function MentionsTypeaheadMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option
}: {
  index: number
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
  option: MentionTypeaheadOption
}): JSX.Element {
  const mention = option.mention
  return (
    <li
      className={`cursor-pointer px-1.5 py-1 ${
        isSelected ? "bg-blue-100 text-blue-900" : ""
      }`}
      key={`${isUserMention(mention) ? "user" : "team"}:${mention.id}`}
      tabIndex={-1}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={index.toString()}
      onMouseEnter={onMouseEnter}
      onClick={onClick}>
      <div className="inline-flex items-center gap-x-3">
        <MentionAvatar mention={mention} />
        <span
          className="whitespace-break-spaces text-sm font-normal leading-4"
          style={{ wordBreak: "break-word" }}>
          {isUserMention(mention) ? mention.fullName : mention.name}
        </span>
      </div>
    </li>
  )
}

export default function MentionsPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext()
  const { data, isLoading } = useMentionUsersAndTeams()
  const [queryString, setQueryString] = useState<string>("")

  if (data && !editor.hasNodes([UserMentionNode, TeamMentionNode])) {
    throw new Error(
      "MentionsPlugin: UserMentionNode or TeamMentionNode not registered on editor"
    )
  }

  const results = mentionLookupService({
    users: data?.users ?? [],
    teams: data?.teams ?? [],
    mentionString: queryString
  })

  const options = useMemo(
    () => results.map((r) => new MentionTypeaheadOption(r)),
    [results]
  )

  const onSelectOption = useCallback(
    (
      selectedOption: MentionTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void
    ) => {
      editor.update(() => {
        const mentionNode = isUserMention(selectedOption.mention)
          ? $createUserMentionNode(
              selectedOption.mention.fullName,
              selectedOption.mention.id.toString()
            )
          : $createTeamMentionNode(
              selectedOption.mention.name,
              selectedOption.mention.id.toString(),
              selectedOption.mention.color
            )
        const spaceNode = $createTextNode(" ")
        if (nodeToReplace) {
          nodeToReplace.replace(mentionNode)
        }
        mentionNode.insertAfter(spaceNode).select()
        closeMenu()
      })
    },
    [editor]
  )

  const checkForMentionMatch = useCallback(
    (text: string) => checkForMentionTrigger(text, 0, ["@"]),
    []
  )

  return (
    <LexicalTypeaheadMenuPlugin<MentionTypeaheadOption>
      onQueryChange={(value) =>
        value === null ? setQueryString("") : setQueryString(value)
      }
      onSelectOption={onSelectOption}
      triggerFn={checkForMentionMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
      ) =>
        anchorElementRef.current &&
        (results.length !== 0 || queryString?.length === 0)
          ? ReactDOM.createPortal(
              <div className="relative top-6 z-[210] w-72 overflow-y-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {!isLoading ? (
                  <ul className="m-0 max-h-48 list-none overflow-y-auto rounded-lg p-px">
                    {options.map((option, i) => (
                      <MentionsTypeaheadMenuItem
                        index={i}
                        isSelected={selectedIndex === i}
                        onClick={() => {
                          setHighlightedIndex(i)
                          selectOptionAndCleanUp(option)
                        }}
                        onMouseEnter={() => setHighlightedIndex(i)}
                        key={`${isUserMention(option.mention) ? "user" : "team"}:${option.mention.id}`}
                        option={option}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="flex h-12 items-center justify-center text-xs text-slate-500">
                    Loading…
                  </div>
                )}
              </div>,
              anchorElementRef.current
            )
          : null
      }
    />
  )
}
