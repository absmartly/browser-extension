import { TrashIcon } from "@heroicons/react/24/outline"
import React from "react"

import {
  defineOperatorType,
  FilterExpression,
  LowPrecedenceOperator,
  lowPrecedenceOperatorsWithSemver,
  operatorDict
} from "./models"

interface AudienceRuleProps {
  rule: FilterExpression
  groupKey: number
  ruleIndex: number
  onChange: (next: FilterExpression) => void
  onRemove: () => void
}

/**
 * One audience rule. Renders three controls in a row: an attribute path text
 * input, an operator dropdown, and a value input (hidden for unary operators
 * like `null`). The optional high-precedence operator (currently only `not`)
 * is exposed as a single "Negate" checkbox to keep the UI compact.
 */
export function AudienceRule({
  rule,
  groupKey,
  ruleIndex,
  onChange,
  onRemove
}: AudienceRuleProps) {
  const isUnary = defineOperatorType(rule.lowPrecedenceOperator) === "unary"
  const idPrefix = `audience-rule-${groupKey}-${ruleIndex}`

  return (
    <div
      data-testid={`audience-rule-${groupKey}-${ruleIndex}`}
      id={idPrefix}
      className="flex flex-wrap items-start gap-2">
      <input
        type="text"
        id={`${idPrefix}-path`}
        data-testid={`${idPrefix}-path`}
        placeholder="attribute path (e.g. country)"
        className="flex-1 min-w-[180px] px-2 py-1 border border-gray-300 rounded text-sm"
        value={rule.path}
        onChange={(e) => onChange({ ...rule, path: e.target.value })}
      />

      <select
        id={`${idPrefix}-op`}
        data-testid={`${idPrefix}-op`}
        className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
        value={rule.lowPrecedenceOperator}
        onChange={(e) =>
          onChange({
            ...rule,
            lowPrecedenceOperator: e.target.value as LowPrecedenceOperator,
            // clearing value when switching to a unary operator keeps the
            // serialized JSON honest — unary ops have no value slot.
            value:
              defineOperatorType(e.target.value as LowPrecedenceOperator) ===
              "unary"
                ? ""
                : rule.value
          })
        }>
        {lowPrecedenceOperatorsWithSemver.map((op) => (
          <option key={op} value={op}>
            {operatorDict[op] || op}
          </option>
        ))}
      </select>

      {!isUnary && (
        <input
          type="text"
          id={`${idPrefix}-value`}
          data-testid={`${idPrefix}-value`}
          placeholder={
            rule.lowPrecedenceOperator === "in"
              ? "comma-separated values"
              : "value"
          }
          className="flex-1 min-w-[120px] px-2 py-1 border border-gray-300 rounded text-sm"
          value={rule.value}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
        />
      )}

      <label
        id={`${idPrefix}-not-label`}
        className="flex items-center gap-1 text-xs text-gray-600 px-1 py-1">
        <input
          type="checkbox"
          id={`${idPrefix}-not`}
          data-testid={`${idPrefix}-not`}
          checked={rule.highPrecedenceOperator === "not"}
          onChange={(e) =>
            onChange({
              ...rule,
              highPrecedenceOperator: e.target.checked ? "not" : null
            })
          }
        />
        Negate
      </label>

      <button
        type="button"
        id={`${idPrefix}-remove`}
        data-testid={`${idPrefix}-remove`}
        aria-label="Remove rule"
        onClick={onRemove}
        className="p-1 text-gray-400 hover:text-red-600">
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
