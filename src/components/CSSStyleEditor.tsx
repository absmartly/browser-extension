import React from 'react'
import { all as knownCSSProperties } from 'known-css-properties'
import { KeyValueEditor } from './KeyValueEditor'

const cssPropertyNames = knownCSSProperties
  .filter((prop): prop is string => prop !== undefined && prop !== null)

const commonCSSValues: Record<string, string[]> = {
  display: ['none', 'block', 'inline', 'inline-block', 'flex', 'grid', 'none'],
  position: ['relative', 'absolute', 'fixed', 'sticky', 'static'],
  'text-align': ['left', 'center', 'right', 'justify'],
  'font-weight': ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
  'font-style': ['normal', 'italic', 'oblique'],
  visibility: ['visible', 'hidden', 'collapse'],
  cursor: ['pointer', 'default', 'text', 'wait', 'not-allowed', 'help', 'move'],
  overflow: ['visible', 'hidden', 'scroll', 'auto'],
  'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
  'justify-content': ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
  'align-items': ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'],
}

export const CSSStyleEditor = ({
  styleProperties,
  onChange,
  pseudoState
}: {
  styleProperties: Array<{ key: string; value: string }> | undefined,
  onChange: (properties: Array<{ key: string; value: string }>) => void,
  pseudoState?: 'normal' | 'hover' | 'active' | 'focus'
}) => {
  const headerText = pseudoState && pseudoState !== 'normal'
    ? `element:${pseudoState}`
    : 'element.style'

  return (
    <KeyValueEditor
      properties={styleProperties}
      onChange={onChange}
      config={{
        keySuggestions: cssPropertyNames,
        valueSuggestions: (key: string) => commonCSSValues[key] || [],
        keyPlaceholder: 'property',
        valuePlaceholder: 'value',
        headerText,
        separatorBefore: ':',
        separatorAfter: ';',
        addButtonText: '+ Add property...'
      }}
    />
  )
}
