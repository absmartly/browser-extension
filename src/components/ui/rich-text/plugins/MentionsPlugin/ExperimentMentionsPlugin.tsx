import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption
} from "@lexical/react/LexicalTypeaheadMenuPlugin"
import {
  $createTextNode,
  $getRoot,
  type LexicalNode,
  type TextNode
} from "lexical"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as ReactDOM from "react-dom"

import {
  $createExperimentMentionNode,
  ExperimentMentionNode,
  ExperimentType,
  type ExperimentMention
} from "../../nodes/MentionNode/ExperimentMentionNode"
import { mentionStore } from "../../nodes/mentionStore"
import { experimentMentionIds } from "../MarkdownTransformers"
import { checkForMentionTrigger } from "./checkForMentionTrigger"
import {
  fetchExperimentMentionsPage,
  loadExperimentMentionsByIds
} from "./mentionData"

const PAGE_SIZE = 15
const DEBOUNCE_MS = 300

class MentionTypeaheadOption extends MenuOption {
  experiment: ExperimentMention
  constructor(experiment: ExperimentMention) {
    super(experiment.id.toString())
    this.experiment = experiment
  }
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function MentionsTypeaheadMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
  lastElement,
  lastElementRef
}: {
  index: number
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
  option: MentionTypeaheadOption
  lastElement: boolean
  lastElementRef: (node: HTMLLIElement | null) => void
}): JSX.Element {
  const isFeature = option.experiment.type === ExperimentType.feature
  return (
    <li
      className={`flex px-1.5 py-1 ${
        isSelected ? "bg-blue-100 text-blue-900" : ""
      }`}
      key={`li-${option.experiment.id}`}
      tabIndex={-1}
      ref={lastElement ? lastElementRef : option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={index.toString()}
      onMouseEnter={onMouseEnter}
      onClick={onClick}>
      <div className="inline-flex w-full items-center gap-x-3">
        <span
          className="flex h-5 w-5 items-center justify-center text-slate-400"
          aria-hidden>
          {isFeature ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10H7c-2.21 0-4 1.79-4 4s1.79 4 4 4h10c2.21 0 4-1.79 4-4s-1.79-4-4-4zm0 6H7c-1.1 0-2-.9-2-2s.9-2 2-2h10c1.1 0 2 .9 2 2s-.9 2-2 2z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 0H8v2h1v3.07A7.001 7.001 0 0 0 12 19a7 7 0 0 0 3-13.93V2h1V0zm-1 6.31c2.36.94 4 3.27 4 5.69a6 6 0 0 1-6 6 6 6 0 0 1-6-6c0-2.42 1.64-4.75 4-5.69V2h4v4.31z" />
            </svg>
          )}
        </span>
        <span
          className="whitespace-break-spaces text-sm font-normal leading-4"
          style={{ wordBreak: "break-word" }}>
          {option.experiment.display_name ?? option.experiment.name}
        </span>
        {option.experiment.iteration != null && (
          <span className="ml-auto rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
            i{option.experiment.iteration}
          </span>
        )}
      </div>
    </li>
  )
}

export default function ExperimentMentionsPlugin({
  convertMentionsOnly = false
}: {
  convertMentionsOnly?: boolean
} = {}): JSX.Element | null {
  const [editor] = useLexicalComposerContext()

  const [results, setResults] = useState<ExperimentMention[]>([])
  const [queryString, setQueryString] = useState<string>("")
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const debouncedQuery = useDebounce(queryString, DEBOUNCE_MS)

  // 1. Hydrate placeholder experiment mentions referenced in the markdown.
  //    Runs ONCE on mount — re-seeding on every value change destroys the
  //    user's cursor between keystrokes. The initial parse done by
  //    InitialValuePlugin (in `RichTextEditor.tsx`) already produced
  //    placeholder ExperimentMentionNodes; once we resolve the experiment
  //    data into `mentionStore`, Lexical re-renders the placeholders
  //    automatically via `decorate()`/`createDOM()` on next update.
  useEffect(() => {
    if (!editor.hasNodes([ExperimentMentionNode])) return
    const idsAtMount = [...new Set(experimentMentionIds)].map(Number)
    if (!idsAtMount.length) return
    let alive = true
    loadExperimentMentionsByIds(idsAtMount).then((experiments) => {
      if (!alive) return
      mentionStore.setExperiments(experiments)
      // Touch the editor so any placeholder node refreshes its DOM from
      // the now-populated mentionStore, WITHOUT clearing the root and
      // re-parsing the markdown (that would race with active typing).
      editor.update(() => {
        const root = $getRoot()
        const stack: LexicalNode[] = [root]
        while (stack.length) {
          const node = stack.pop()
          if (!node) continue
          if (
            (node as LexicalNode).getType &&
            (node as LexicalNode).getType() === "experiment-mention"
          ) {
            const expNode = node as unknown as {
              __id: string
              setTextContent: (text: string) => void
            }
            const exp = experiments.find(
              (e) => e.id.toString() === expNode.__id
            )
            if (exp) {
              expNode.setTextContent(`#${exp.display_name ?? exp.name}`)
            }
          }
          const children = (
            node as unknown as { getChildren?: () => LexicalNode[] }
          ).getChildren?.()
          if (children) {
            for (const child of children) stack.push(child)
          }
        }
      })
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. Search experiments for the typeahead.
  useEffect(() => {
    if (convertMentionsOnly) return
    setIsLoading(true)
    setPageNumber(1)
    setResults([])
  }, [debouncedQuery, convertMentionsOnly])

  useEffect(() => {
    if (convertMentionsOnly) return
    let alive = true
    setIsLoading(true)
    fetchExperimentMentionsPage({
      search: debouncedQuery,
      page: pageNumber,
      items: PAGE_SIZE
    })
      .then((res) => {
        if (!alive) return
        setResults((prev) =>
          pageNumber === 1 ? res.experiments : [...prev, ...res.experiments]
        )
        setHasMore(res.total > pageNumber * PAGE_SIZE)
        setIsLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        // eslint-disable-next-line no-console
        console.warn("[ExperimentMentionsPlugin] fetch failed:", err)
        setIsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [debouncedQuery, pageNumber, convertMentionsOnly])

  // Infinite scroll
  const observer = useRef<IntersectionObserver | null>(null)
  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoading) return
      if (observer.current) observer.current.disconnect()
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPageNumber((prev) => prev + 1)
        }
      })
      if (node) observer.current.observe(node)
    },
    [isLoading, hasMore]
  )

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
        const exp = selectedOption.experiment
        const mentionNode = $createExperimentMentionNode(
          exp.display_name ?? exp.name,
          exp.id.toString(),
          exp.type
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
    (text: string) => checkForMentionTrigger(text, 0, ["#"]),
    []
  )

  if (convertMentionsOnly) return null

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
        (isLoading || results.length !== 0 || queryString?.length === 0)
          ? ReactDOM.createPortal(
              <div className="relative top-6 z-[210] w-72 overflow-y-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
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
                      key={`ul-${option.experiment.id}`}
                      option={option}
                      lastElement={options.length === i + 1}
                      lastElementRef={lastElementRef}
                    />
                  ))}
                </ul>
                {isLoading && results.length === 0 && (
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
