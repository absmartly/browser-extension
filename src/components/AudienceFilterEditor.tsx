import { PlusIcon } from "@heroicons/react/24/outline"
import React, { useCallback, useEffect, useRef, useState } from "react"

import { AudienceGroup as AudienceGroupView } from "./AudienceFilterEditor/AudienceGroup"
import { AudienceFiltersData } from "./AudienceFilterEditor/models"
import {
  audienceFiltersFromJSON,
  audienceFiltersToJSON,
  newGroup
} from "./AudienceFilterEditor/utils"

interface AudienceFilterEditorProps {
  value: string
  onChange: (next: string) => void
}

/**
 * Visual audience filter editor — the canonical UI used by the fullscreen
 * modal. Maintains an internal `AudienceFiltersData` model and serializes back
 * to the wire JSON on every change so the parent's form state stays in sync.
 *
 * Parsing is lossy for filter shapes the visual editor can't represent (e.g.
 * deeply nested operators). The wrapper component still exposes an Advanced
 * (raw JSON) toggle as a fallback.
 */
export function AudienceFilterEditor({
  value,
  onChange
}: AudienceFilterEditorProps) {
  const [data, setData] = useState<AudienceFiltersData>(() =>
    audienceFiltersFromJSON(value)
  )
  const lastEmittedRef = useRef<string>(value)

  // Re-parse when the external value changes (e.g. AI fill overwrites it).
  useEffect(() => {
    if (value === lastEmittedRef.current) return
    setData(audienceFiltersFromJSON(value))
    lastEmittedRef.current = value
  }, [value])

  const commit = useCallback(
    (next: AudienceFiltersData) => {
      setData(next)
      const serialized = audienceFiltersToJSON(next)
      lastEmittedRef.current = serialized
      onChange(serialized)
    },
    [onChange]
  )

  const handleGroupChange = (
    index: number,
    nextGroup: AudienceFiltersData["groups"][number]
  ) => {
    const groups = [...data.groups]
    groups[index] = nextGroup
    commit({ ...data, groups })
  }

  const handleGroupRemove = (index: number) => {
    const groups = data.groups.filter((_, i) => i !== index)
    commit({ ...data, groups })
  }

  const handleAddGroup = () => {
    commit({ ...data, groups: [...data.groups, newGroup()] })
  }

  const handleOuterOperatorChange = (op: "and" | "or") => {
    commit({ ...data, operator: op })
  }

  const isEmpty = data.groups.length === 0

  return (
    <div
      id="audience-filter-editor"
      data-testid="audience-filter-editor"
      className="space-y-3">
      {isEmpty && (
        <div
          id="audience-filter-empty"
          data-testid="audience-filter-empty"
          className="text-xs text-gray-500 italic">
          No groups — this audience matches everyone. Add a group to narrow
          targeting.
        </div>
      )}

      {!isEmpty && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>Combine groups with</span>
          <select
            id="audience-filter-outer-operator"
            data-testid="audience-filter-outer-operator"
            className="px-1 py-0.5 border border-gray-300 rounded text-xs bg-white"
            value={data.operator}
            onChange={(e) =>
              handleOuterOperatorChange(e.target.value === "or" ? "or" : "and")
            }>
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </div>
      )}

      <div className="space-y-2">
        {data.groups.map((group, index) => (
          <React.Fragment key={group.key ?? index}>
            {index > 0 && (
              <div
                data-testid={`audience-filter-divider-${index}`}
                className="text-[10px] uppercase tracking-wide text-gray-500 text-center font-semibold">
                {data.operator}
              </div>
            )}
            <AudienceGroupView
              group={group}
              groupIndex={index}
              onChange={(next) => handleGroupChange(index, next)}
              onRemove={() => handleGroupRemove(index)}
              canRemove={true}
            />
          </React.Fragment>
        ))}
      </div>

      <button
        type="button"
        id="audience-filter-add-group"
        data-testid="audience-filter-add-group"
        onClick={handleAddGroup}
        className="inline-flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded">
        <PlusIcon className="h-4 w-4" />
        Add group
      </button>
    </div>
  )
}
