import { TrashIcon } from "@heroicons/react/24/outline"
import React, { useCallback, useMemo } from "react"

import { BackgroundAPIClient } from "~src/lib/background-api-client"
import { debugWarn } from "~src/utils/debug"

import { AutocompleteInput } from "../ui/AutocompleteInput"
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
  unitTypeId?: number | null
  onChange: (next: FilterExpression) => void
  onRemove: () => void
  /**
   * Optional override for the API client — tests inject a mock here so they
   * don't have to stub `chrome.runtime.sendMessage`.
   */
  apiClient?: Pick<
    BackgroundAPIClient,
    "getEventJsonLayouts" | "getEventJsonValues"
  >
}

const defaultClient = new BackgroundAPIClient()

/**
 * Convert the `{columnNames, rows}` query response shape used by the events
 * endpoints into a plain `string[]`. We pluck the column named `field` (e.g.
 * `key` for layouts, `value` for values). Returns an empty array — and warns —
 * if the response doesn't match the expected shape so the dropdown stays
 * usable even when the API surface changes.
 */
function rowsToStrings(raw: unknown, field: string): string[] {
  if (!raw || typeof raw !== "object") {
    debugWarn(
      "[AudienceRule] expected {columnNames, rows} response, got:",
      typeof raw
    )
    return []
  }
  const obj = raw as { columnNames?: unknown; rows?: unknown }
  const columnNames = obj.columnNames
  const rows = obj.rows
  if (!Array.isArray(columnNames) || !Array.isArray(rows)) {
    debugWarn(
      "[AudienceRule] response missing columnNames/rows arrays:",
      Object.keys(obj)
    )
    return []
  }
  const idx = columnNames.indexOf(field)
  if (idx < 0) {
    debugWarn(
      `[AudienceRule] response columnNames missing "${field}":`,
      columnNames
    )
    return []
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (!Array.isArray(row)) continue
    const cell = row[idx]
    if (cell === null || cell === undefined) continue
    const str = String(cell)
    if (seen.has(str)) continue
    seen.add(str)
    out.push(str)
  }
  return out
}

/**
 * One audience rule. Renders three controls in a row: an attribute path
 * autocomplete, an operator dropdown, and a value autocomplete (hidden for
 * unary operators like `null`). Both autocompletes pull live suggestions from
 * the ABsmartly events API — paths via `event_json_layouts`, values via
 * `event_json_values` — matching the web app's `AbsJSONLayoutTextField` /
 * `AbsJSONValueSelect` behavior. Free text is always allowed: an unknown path
 * or unseen value is just typed in and submitted.
 */
export function AudienceRule({
  rule,
  groupKey,
  ruleIndex,
  unitTypeId,
  onChange,
  onRemove,
  apiClient
}: AudienceRuleProps) {
  const isUnary = defineOperatorType(rule.lowPrecedenceOperator) === "unary"
  const idPrefix = `audience-rule-${groupKey}-${ruleIndex}`
  const client = apiClient ?? defaultClient

  const fetchPathOptions = useCallback(
    async (prefix: string): Promise<string[]> => {
      try {
        const raw = await client.getEventJsonLayouts({
          source: "unit_attribute",
          phase: "before_enrichment",
          prefix: prefix ?? "",
          source_id: unitTypeId ?? 0,
          take: 20
        })
        return rowsToStrings(raw, "key")
      } catch (err) {
        debugWarn("[AudienceRule] getEventJsonLayouts failed:", err)
        return []
      }
    },
    [client, unitTypeId]
  )

  const path = rule.path
  const fetchValueOptions = useCallback(
    async (_prefix: string): Promise<string[]> => {
      if (!path) return []
      try {
        const raw = await client.getEventJsonValues({
          event_type: "exposure",
          path,
          take: 20
        })
        return rowsToStrings(raw, "value")
      } catch (err) {
        debugWarn("[AudienceRule] getEventJsonValues failed:", err)
        return []
      }
    },
    [client, path]
  )

  const valuePlaceholder = useMemo(
    () =>
      rule.lowPrecedenceOperator === "in" ? "comma-separated values" : "value",
    [rule.lowPrecedenceOperator]
  )

  return (
    <div
      data-testid={`audience-rule-${groupKey}-${ruleIndex}`}
      id={idPrefix}
      className="flex flex-wrap items-start gap-2">
      <div className="flex-1 min-w-[180px]">
        <AutocompleteInput
          id={`${idPrefix}-path`}
          data-testid={`${idPrefix}-path`}
          placeholder="attribute path (e.g. country)"
          value={rule.path}
          onChange={(next) => onChange({ ...rule, path: next })}
          fetchOptions={fetchPathOptions}
        />
      </div>

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
        <div className="flex-1 min-w-[120px]">
          <AutocompleteInput
            id={`${idPrefix}-value`}
            data-testid={`${idPrefix}-value`}
            placeholder={valuePlaceholder}
            value={rule.value}
            onChange={(next) => onChange({ ...rule, value: next })}
            fetchOptions={fetchValueOptions}
          />
        </div>
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
