import React from "react"

import type { ExperimentCustomSectionField } from "~src/types/absmartly"

import { RichTextEditor } from "./ui/RichTextEditor"

interface CustomFieldsEditorProps {
  fields: readonly ExperimentCustomSectionField[]
  values: Record<string, unknown>
  onChange: (fieldId: number, value: unknown) => void
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
            key={f.id}
            field={f}
            value={values[String(f.id)]}
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
  onChange: (fieldId: number, value: unknown) => void
}) {
  const labelId = `cfe-label-${field.id}`
  return (
    <div>
      <label
        id={labelId}
        className="block text-sm font-medium text-gray-700 mb-1">
        {field.title || `Field ${field.id}`}
        {field.required && (
          <span
            id={`cfe-required-${field.id}`}
            data-testid={`cfe-required-${field.id}`}
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
  onChange: (fieldId: number, value: unknown) => void
) {
  const id = `cfe-input-${field.id}`
  switch (field.type) {
    case "text":
      // The ABsmartly main UI renders `type: "text"` with a Lexical-based
      // RichTextEditor that emits markdown via `$convertToMarkdownString`.
      // Use a minimal Lexical wrapper here so values round-trip cleanly when
      // the same experiment is opened in the main UI.
      return (
        <RichTextEditor
          id={id}
          data-testid={id}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(markdown) => onChange(field.id, markdown)}
          ariaLabelledBy={`cfe-label-${field.id}`}
        />
      )
    case "string":
      return (
        <input
          id={id}
          data-testid={id}
          type="text"
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.id, e.target.value)}
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
              field.id,
              e.target.value === "" ? null : Number(e.target.value)
            )
          }
        />
      )
    case "boolean":
      return (
        <input
          id={`cfe-checkbox-${field.id}`}
          data-testid={`cfe-checkbox-${field.id}`}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.id, e.target.checked)}
        />
      )
    case "select":
    case "single_select":
      return (
        <select
          id={`cfe-select-${field.id}`}
          data-testid={`cfe-select-${field.id}`}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(field.id, e.target.value)}>
          <option value="">— Select —</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    case "multiselect":
    case "multi_select": {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <select
          id={`cfe-multiselect-${field.id}`}
          data-testid={`cfe-multiselect-${field.id}`}
          multiple
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          value={selected}
          onChange={(e) => {
            const vals = Array.from(e.target.selectedOptions).map(
              (o) => o.value
            )
            onChange(field.id, vals)
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
          id={`cfe-json-${field.id}`}
          data-testid={`cfe-json-${field.id}`}
          className="w-full font-mono text-xs border border-gray-300 rounded p-2 min-h-[80px]"
          value={
            typeof value === "string"
              ? value
              : JSON.stringify(value ?? "", null, 2)
          }
          onChange={(e) => onChange(field.id, e.target.value)}
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
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      )
  }
}
