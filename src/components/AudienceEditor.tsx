import React, { useEffect, useState } from "react"

import { AudienceFilterEditor } from "./AudienceFilterEditor"

interface AudienceEditorProps {
  value: string
  strict: boolean
  /**
   * Drives the `source_id` for the JSON layout autocomplete in
   * {@link AudienceFilterEditor} — should be the experiment's unit_type_id.
   * Falls back to 0 (the API treats 0 as "all unit types") when null.
   */
  unitTypeId?: number | null
  onChange: (next: string) => void
  onStrictChange: (next: boolean) => void
}

/**
 * Wrapper that renders the visual {@link AudienceFilterEditor} by default and
 * exposes an "Advanced (raw JSON)" toggle for filters the visual editor
 * cannot represent (e.g. deeply nested operator trees pasted from an export).
 */
export function AudienceEditor({
  value,
  strict,
  unitTypeId,
  onChange,
  onStrictChange
}: AudienceEditorProps) {
  const [advanced, setAdvanced] = useState(false)
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const parseError = (() => {
    if (!localValue.trim()) return null
    try {
      JSON.parse(localValue)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid JSON"
    }
  })()

  const handleRawChange = (next: string) => {
    setLocalValue(next)
    onChange(next)
  }

  const handleVisualChange = (next: string) => {
    setLocalValue(next)
    onChange(next)
  }

  return (
    <div id="audience-editor" className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          id="audience-editor-label"
          className="block text-sm font-medium text-gray-700">
          Audience filter
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input
            type="checkbox"
            id="audience-editor-advanced-toggle"
            data-testid="audience-editor-advanced-toggle"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />
          Advanced (raw JSON)
        </label>
      </div>

      {!advanced && (
        <AudienceFilterEditor
          value={localValue}
          unitTypeId={unitTypeId}
          onChange={handleVisualChange}
        />
      )}

      {advanced && (
        <>
          <p className="text-xs text-gray-500">
            Default {`{"filter":[{"and":[]}]}`} matches everyone. Edit to narrow
            the targeting.
          </p>
          <textarea
            id="audience-editor-textarea"
            data-testid="audience-editor-textarea"
            className="w-full font-mono text-xs border border-gray-300 rounded p-2 min-h-[120px] resize-y"
            style={{ resize: "vertical" }}
            value={localValue}
            onChange={(e) => handleRawChange(e.target.value)}
            spellCheck={false}
          />
          {parseError && (
            <p
              id="audience-editor-error"
              data-testid="audience-editor-error"
              className="text-xs text-red-600">
              Invalid JSON: {parseError}
            </p>
          )}
        </>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          id="audience-editor-strict"
          data-testid="audience-editor-strict"
          type="checkbox"
          checked={strict}
          onChange={(e) => onStrictChange(e.target.checked)}
        />
        Strict audience matching
      </label>
    </div>
  )
}
