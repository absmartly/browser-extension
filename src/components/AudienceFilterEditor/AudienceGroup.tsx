import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline"
import React from "react"

import { AudienceRule } from "./AudienceRule"
import type { AudienceGroup as AudienceGroupModel } from "./models"
import { newExpression } from "./utils"

interface AudienceGroupProps {
  group: AudienceGroupModel
  groupIndex: number
  unitTypeId?: number | null
  onChange: (next: AudienceGroupModel) => void
  onRemove: () => void
  canRemove: boolean
}

/**
 * One OR group of rules. Rules within a group are ANDed together. We expose a
 * dropdown to flip the group's inner operator (and/or) because that's how the
 * Vue editor works, but the visual divider between rules is the simple AND
 * label since real-world audiences are overwhelmingly AND-of-rules within an
 * OR-of-groups outer.
 */
export function AudienceGroup({
  group,
  groupIndex,
  unitTypeId,
  onChange,
  onRemove,
  canRemove
}: AudienceGroupProps) {
  const handleRuleChange = (index: number, next: any) => {
    const expression = [...group.expression]
    expression[index] = next
    onChange({ ...group, expression })
  }

  const handleRuleRemove = (index: number) => {
    const expression = group.expression.filter((_, i) => i !== index)
    onChange({ ...group, expression })
  }

  const handleAddRule = () => {
    onChange({ ...group, expression: [...group.expression, newExpression()] })
  }

  return (
    <div
      data-testid={`audience-group-${groupIndex}`}
      id={`audience-group-${groupIndex}`}
      className="border border-gray-200 rounded-md p-3 bg-gray-50 space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="font-medium">Group {groupIndex + 1}</span>
          <select
            id={`audience-group-${groupIndex}-operator`}
            data-testid={`audience-group-${groupIndex}-operator`}
            className="px-1 py-0.5 border border-gray-300 rounded text-xs bg-white"
            value={group.operator}
            onChange={(e) =>
              onChange({
                ...group,
                operator: e.target.value === "or" ? "or" : "and"
              })
            }>
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
          <span>rules within</span>
        </div>
        {canRemove && (
          <button
            type="button"
            id={`audience-group-${groupIndex}-remove`}
            data-testid={`audience-group-${groupIndex}-remove`}
            aria-label="Remove group"
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-600">
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {group.expression.map((rule, ruleIndex) => (
          <React.Fragment key={ruleIndex}>
            {ruleIndex > 0 && (
              <div
                data-testid={`audience-group-${groupIndex}-inner-divider-${ruleIndex}`}
                className="text-[10px] uppercase tracking-wide text-gray-400 text-center">
                {group.operator}
              </div>
            )}
            <AudienceRule
              rule={rule}
              groupKey={groupIndex}
              ruleIndex={ruleIndex}
              unitTypeId={unitTypeId}
              onChange={(next) => handleRuleChange(ruleIndex, next)}
              onRemove={() => handleRuleRemove(ruleIndex)}
            />
          </React.Fragment>
        ))}
      </div>

      <button
        type="button"
        id={`audience-group-${groupIndex}-add-rule`}
        data-testid={`audience-group-${groupIndex}-add-rule`}
        onClick={handleAddRule}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
        <PlusIcon className="h-3 w-3" />
        Add rule
      </button>
    </div>
  )
}
