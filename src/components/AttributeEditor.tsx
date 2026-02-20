import React from 'react'
import { KeyValueEditor } from './KeyValueEditor'

const commonAttributes = [
  'href', 'src', 'alt', 'title', 'target', 'rel', 'role', 'aria-label', 'aria-describedby',
  'aria-expanded', 'aria-hidden', 'aria-current', 'data-testid', 'id', 'name', 'type',
  'value', 'placeholder', 'disabled', 'readonly', 'required', 'checked', 'selected',
  'multiple', 'accept', 'autocomplete', 'autofocus', 'min', 'max', 'step', 'pattern',
  'maxlength', 'minlength', 'size', 'rows', 'cols', 'wrap', 'for', 'form', 'action',
  'method', 'enctype', 'novalidate', 'formnovalidate', 'tabindex', 'accesskey',
  'contenteditable', 'draggable', 'spellcheck', 'translate', 'dir', 'lang', 'hidden'
].sort()

interface AttributeEditorProps {
  attributeProperties: Array<{ key: string; value: string }> | undefined
  onChange: (properties: Array<{ key: string; value: string }>) => void
  idSuffix?: string
}

export const AttributeEditor = ({
  attributeProperties,
  onChange,
  idSuffix
}: AttributeEditorProps) => {
  return (
    <KeyValueEditor
      properties={attributeProperties}
      onChange={onChange}
      config={{
        keySuggestions: commonAttributes,
        keyPlaceholder: 'attribute',
        valuePlaceholder: 'value',
        headerText: 'element.attributes',
        separatorBefore: '=',
        separatorAfter: '"',
        separatorBeforeValue: '"',
        addButtonText: '+ Add attribute...'
      }}
      idSuffix={idSuffix}
    />
  )
}
