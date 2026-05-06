import React from "react"

import type { ExperimentCustomSectionField } from "~src/types/absmartly"

interface CustomFieldsEditorProps {
  fields: readonly ExperimentCustomSectionField[]
  values: Record<string, unknown>
  onChange: (fieldName: string, value: unknown) => void
}

export function CustomFieldsEditor({
  fields,
  values,
  onChange
}: CustomFieldsEditorProps) {
  return (
    <div id="custom-fields-editor" className="space-y-4">
      <h3 id="custom-fields-editor-heading" className="text-sm font-semibold">
        Custom fields
      </h3>
      {fields
        .filter((f) => !f.archived)
        .slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((f) => (
          <FieldRow
            key={f.name}
            field={f}
            value={values[f.name]}
            onChange={onChange}
          />
        ))}
    </div>
  )
}

function FieldRow({
  field,
  value,
  onChange
}: {
  field: ExperimentCustomSectionField
  value: unknown
  onChange: (fieldName: string, value: unknown) => void
}) {
  const labelId = `cfe-label-${field.name}`
  return (
    <div>
      <label
        id={labelId}
        className="block text-sm font-medium text-gray-700 mb-1">
        {field.title || field.name}
        {field.required && (
          <span
            id={`cfe-required-${field.name}`}
            data-testid={`cfe-required-${field.name}`}
            className="text-red-500 ml-1">
            *
          </span>
        )}
      </label>
      {renderInput(field, value, onChange)}
      {field.help_text && (
        <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>
      )}
    </div>
  )
}

function renderInput(
  field: ExperimentCustomSectionField,
  value: unknown,
  onChange: (fieldName: string, value: unknown) => void
) {
  const id = `cfe-input-${field.name}`
  switch (field.type) {
    case "text":
    case "string":
      return (
        <input
          id={id}
          data-testid={id}
          type="text"
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      )
    case "number":
      return (
        <input
          id={id}
          data-testid={id}
          type="number"
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={typeof value === "number" ? value : ""}
          onChange={(e) =>
            onChange(
              field.name,
              e.target.value === "" ? null : Number(e.target.value)
            )
          }
        />
      )
    case "boolean":
      return (
        <input
          id={`cfe-checkbox-${field.name}`}
          data-testid={`cfe-checkbox-${field.name}`}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.name, e.target.checked)}
        />
      )
    case "select":
      return (
        <select
          id={`cfe-select-${field.name}`}
          data-testid={`cfe-select-${field.name}`}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.name, e.target.value)}>
          <option value="">— Select —</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <select
          id={`cfe-multiselect-${field.name}`}
          data-testid={`cfe-multiselect-${field.name}`}
          multiple
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={selected}
          onChange={(e) => {
            const vals = Array.from(e.target.selectedOptions).map(
              (o) => o.value
            )
            onChange(field.name, vals)
          }}>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    }
    case "json":
      return (
        <textarea
          id={`cfe-json-${field.name}`}
          data-testid={`cfe-json-${field.name}`}
          className="w-full font-mono text-xs border border-gray-300 rounded p-2 min-h-[80px]"
          value={
            typeof value === "string"
              ? value
              : JSON.stringify(value ?? "", null, 2)
          }
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      )
    default:
      return (
        <input
          id={id}
          data-testid={id}
          type="text"
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      )
  }
}
