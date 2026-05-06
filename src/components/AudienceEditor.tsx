import React, { useEffect, useState } from "react"

interface AudienceEditorProps {
  value: string
  strict: boolean
  onChange: (next: string) => void
  onStrictChange: (next: boolean) => void
}

export function AudienceEditor({
  value,
  strict,
  onChange,
  onStrictChange
}: AudienceEditorProps) {
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

  const handleChange = (next: string) => {
    setLocalValue(next)
    onChange(next)
  }

  return (
    <div id="audience-editor" className="space-y-2">
      <label
        id="audience-editor-label"
        className="block text-sm font-medium text-gray-700">
        Audience filter (JSON)
      </label>
      <p className="text-xs text-gray-500">
        Default {`{"filter":[{"and":[]}]}`} matches everyone. Edit to narrow the
        targeting.
      </p>
      <textarea
        id="audience-editor-textarea"
        data-testid="audience-editor-textarea"
        className="w-full font-mono text-xs border border-gray-300 rounded p-2 min-h-[120px]"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
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
