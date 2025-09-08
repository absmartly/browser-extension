import React, { useState, useEffect, useRef } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { all as knownCSSProperties } from 'known-css-properties'

import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Checkbox } from './ui/Checkbox'
import { MultiSelectTags } from './ui/MultiSelectTags'
import type { DOMChange, DOMChangeType } from '~src/types/dom-changes'
import { suggestCleanedSelector } from '~src/utils/selector-cleaner'
import { generateSelectorSuggestions } from '~src/utils/selector-suggestions'
import { 
  PencilIcon, 
  TrashIcon, 
  PlusIcon, 
  XMarkIcon, 
  CheckIcon,
  CodeBracketIcon,
  CursorArrowRaysIcon,
  PaintBrushIcon,
  DocumentTextIcon,
  HashtagIcon,
  CubeIcon,
  CommandLineIcon,
  ArrowsUpDownIcon,
  TrashIcon,
  PlusCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface DOMChangesInlineEditorProps {
  variantName: string
  changes: DOMChange[]
  onChange: (changes: DOMChange[]) => void
  previewEnabled: boolean
  onPreviewToggle: (enabled: boolean) => void
}

interface EditingDOMChange {
  index: number | null
  selector: string
  type: DOMChangeType
  textValue?: string
  styleProperties?: Array<{ key: string; value: string }>
  classAdd?: string[]
  classRemove?: string[]
  classesWithStatus?: Array<{ name: string; action: 'add' | 'remove' }>
  attributeProperties?: Array<{ key: string; value: string }>
  htmlValue?: string
  jsValue?: string
  targetSelector?: string
  position?: 'before' | 'after' | 'firstChild' | 'lastChild'
  mode?: 'replace' | 'merge'
}

// Simple CSS selector syntax highlighting
const highlightCSSSelector = (selector: string): React.ReactNode => {
  if (!selector) return null
  
  // Pattern to match different parts of CSS selectors
  const parts = []
  let current = ''
  let inAttribute = false
  let inQuote = false
  let quoteChar = ''
  
  for (let i = 0; i < selector.length; i++) {
    const char = selector[i]
    
    if (inQuote) {
      current += char
      if (char === quoteChar) {
        inQuote = false
        parts.push({ type: 'string', value: current })
        current = ''
      }
    } else if (char === '"' || char === "'") {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      current = char
      inQuote = true
      quoteChar = char
    } else if (char === '.') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'class', value: '.' })
      current = ''
    } else if (char === '#') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'id', value: '#' })
      current = ''
    } else if (char === '[') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'bracket', value: '[' })
      current = ''
      inAttribute = true
    } else if (char === ']') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'bracket', value: ']' })
      current = ''
      inAttribute = false
    } else if (char === ':') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'pseudo', value: ':' })
      current = ''
    } else if ((char === '>' || char === '+' || char === '~') && !inAttribute) {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'combinator', value: char })
      current = ''
    } else {
      current += char
    }
  }
  
  if (current) {
    parts.push({ type: 'text', value: current })
  }
  
  return (
    <>
      {parts.map((part, index) => {
        switch (part.type) {
          case 'class':
            return <span key={index} className="text-blue-600">{part.value}</span>
          case 'id':
            return <span key={index} className="text-purple-600">{part.value}</span>
          case 'bracket':
            return <span key={index} className="text-gray-600">{part.value}</span>
          case 'pseudo':
            return <span key={index} className="text-green-600">{part.value}</span>
          case 'combinator':
            return <span key={index} className="text-orange-600">{part.value}</span>
          case 'string':
            return <span key={index} className="text-red-500">{part.value}</span>
          default:
            return <span key={index}>{part.value}</span>
        }
      })}
    </>
  )
}

// Simple HTML syntax highlighting  
const highlightHTML = (html: string): React.ReactNode => {
  if (!html) return null
  
  const parts = []
  let current = ''
  let inTag = false
  let inTagName = false
  let inAttribute = false
  let inString = false
  let stringChar = ''
  
  for (let i = 0; i < html.length; i++) {
    const char = html[i]
    
    if (inString) {
      current += char
      if (char === stringChar) {
        inString = false
        parts.push({ type: 'string', value: current })
        current = ''
      }
    } else if (inTag && (char === '"' || char === "'")) {
      if (current) {
        parts.push({ type: inAttribute ? 'attribute' : 'text', value: current })
      }
      current = char
      inString = true
      stringChar = char
      inAttribute = true
    } else if (char === '<') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'bracket', value: '<' })
      current = ''
      inTag = true
      inTagName = true
    } else if (char === '>') {
      if (current) {
        parts.push({ type: inTagName ? 'tagName' : 'attribute', value: current })
      }
      parts.push({ type: 'bracket', value: '>' })
      current = ''
      inTag = false
      inTagName = false
      inAttribute = false
    } else if (inTag && char === ' ') {
      if (current) {
        parts.push({ type: inTagName ? 'tagName' : 'attribute', value: current })
      }
      current = ' '
      inTagName = false
      inAttribute = true
    } else if (inTag && char === '/') {
      if (current) {
        parts.push({ type: 'attribute', value: current })
      }
      parts.push({ type: 'bracket', value: '/' })
      current = ''
    } else {
      current += char
    }
  }
  
  if (current) {
    parts.push({ type: 'text', value: current })
  }
  
  return (
    <>
      {parts.map((part, index) => {
        switch (part.type) {
          case 'bracket':
            return <span key={index} className="text-gray-600">{part.value}</span>
          case 'tagName':
            return <span key={index} className="text-blue-600">{part.value}</span>
          case 'attribute':
            return <span key={index} className="text-purple-600">{part.value}</span>
          case 'string':
            return <span key={index} className="text-green-600">{part.value}</span>
          default:
            return <span key={index}>{part.value}</span>
        }
      })}
    </>
  )
}

const createEmptyChange = (): EditingDOMChange => ({
  index: null,
  selector: '',
  type: 'style',
  styleProperties: [{ key: '', value: '' }],
  classAdd: [],
  classRemove: [],
  classesWithStatus: [],
  attributeProperties: [{ key: '', value: '' }],
  textValue: '',
  htmlValue: '',
  jsValue: '',
  targetSelector: '',
  position: 'after',
  mode: 'merge'
})

// Get all CSS property names from known-css-properties
const cssPropertyNames = knownCSSProperties.filter(prop => typeof prop === 'string').sort()

// Common CSS values for different property types
const commonCSSValues: Record<string, string[]> = {
  display: ['none', 'block', 'inline', 'inline-block', 'flex', 'grid', 'inline-flex', 'inline-grid'],
  position: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
  'text-align': ['left', 'right', 'center', 'justify'],
  'font-weight': ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
  visibility: ['visible', 'hidden', 'collapse'],
  overflow: ['visible', 'hidden', 'scroll', 'auto'],
  cursor: ['auto', 'default', 'pointer', 'wait', 'text', 'move', 'not-allowed'],
  'flex-direction': ['row', 'row-reverse', 'column', 'column-reverse'],
  'justify-content': ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
  'align-items': ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'],
}

// DevTools-style CSS editor component with autocomplete
const CSSStyleEditor = ({ 
  styleProperties, 
  onChange 
}: { 
  styleProperties: Array<{ key: string; value: string }> | undefined,
  onChange: (properties: Array<{ key: string; value: string }>) => void 
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [activeField, setActiveField] = useState<'key' | 'value' | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [focusNewProperty, setFocusNewProperty] = useState(false)
  const propertyRefs = useRef<(HTMLInputElement | null)[]>([])

  const handlePropertyChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const newProps = [...(styleProperties || [])]
    newProps[index][field] = newValue
    onChange(newProps)

    // Update suggestions based on input
    if (field === 'key') {
      const filtered = cssPropertyNames.filter(prop => 
        prop.toLowerCase().startsWith(newValue.toLowerCase())
      )
      setSuggestions(filtered.slice(0, 8))
      setShowSuggestions(filtered.length > 0)
    } else if (field === 'value') {
      const propertyName = newProps[index].key
      const values = commonCSSValues[propertyName] || []
      if (values.length > 0) {
        const filtered = values.filter(val => 
          val.toLowerCase().startsWith(newValue.toLowerCase())
        )
        setSuggestions(filtered)
        setShowSuggestions(filtered.length > 0)
      } else {
        setShowSuggestions(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: 'key' | 'value') => {
    // Handle Enter key in value field to add new property
    if (field === 'value' && e.key === 'Enter' && !showSuggestions) {
      e.preventDefault()
      handleAddProperty()
      return
    }

    // Handle Tab key in value field to jump to next property
    if (field === 'value' && e.key === 'Tab' && !showSuggestions && !e.shiftKey) {
      e.preventDefault()
      const nextIndex = index + 1
      if (nextIndex < (styleProperties || []).length) {
        // Focus next property's key field
        setTimeout(() => {
          const nextInput = propertyRefs.current[nextIndex]
          if (nextInput) {
            nextInput.focus()
          }
        }, 0)
      } else {
        // No next property, add a new one
        handleAddProperty()
      }
      return
    }

    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestion(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Tab':
      case 'Enter':
        if (suggestions[selectedSuggestion]) {
          e.preventDefault()
          handlePropertyChange(index, field, suggestions[selectedSuggestion])
          setShowSuggestions(false)
          setSelectedSuggestion(0)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedSuggestion(0)
        break
    }
  }

  const handleAddProperty = () => {
    onChange([...(styleProperties || []), { key: '', value: '' }])
    setFocusNewProperty(true)
  }

  // Effect to focus the new property input
  useEffect(() => {
    if (focusNewProperty) {
      const newIndex = (styleProperties || []).length - 1
      setTimeout(() => {
        if (propertyRefs.current[newIndex]) {
          propertyRefs.current[newIndex]?.focus()
        }
      }, 50)
      setFocusNewProperty(false)
    }
  }, [styleProperties?.length, focusNewProperty])

  const handleRemoveProperty = (index: number) => {
    const newProps = (styleProperties || []).filter((_, i) => i !== index)
    onChange(newProps)
  }

  return (
    <div className="bg-gray-900 text-gray-100 rounded-md font-mono text-xs relative max-w-full overflow-visible">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 text-gray-400">
        element.style {'{'}
      </div>
      
      {/* Properties */}
      <div className="py-1">
        {(styleProperties || []).map((prop, index) => (
          <div 
            key={index} 
            className="flex items-center hover:bg-gray-800 group px-3 py-1 relative pr-8"
          >
            {/* Property inputs container */}
            <div className="flex items-center flex-1 mr-2">
              {/* Property name */}
              <input
                ref={el => propertyRefs.current[index] = el}
                type="text"
                value={prop.key}
                onChange={(e) => handlePropertyChange(index, 'key', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index, 'key')}
                onFocus={() => {
                  // Reset state on focus to ensure autocomplete works
                  setActiveIndex(index)
                  setActiveField('key')
                  setSelectedSuggestion(0)
                  // Always show suggestions on focus
                  const currentValue = prop.key || ''
                  const filtered = cssPropertyNames.filter(p => 
                    currentValue ? p.toLowerCase().startsWith(currentValue.toLowerCase()) : true
                  ).slice(0, 8)
                  setSuggestions(filtered)
                  // Force show suggestions if there are any available
                  if (filtered.length > 0) {
                    setShowSuggestions(true)
                  }
                }}
                onBlur={() => {
                  // Don't clear the state completely, just hide suggestions
                  setTimeout(() => {
                    setShowSuggestions(false)
                  }, 200)
                }}
                placeholder="property"
                className="bg-transparent outline-none text-cyan-400 placeholder-gray-600 flex-1 min-w-0"
              />
              <span className="text-gray-500 px-1">:</span>
              
              {/* Property value */}
              <input
                type="text"
                value={prop.value}
                onChange={(e) => handlePropertyChange(index, 'value', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index, 'value')}
                onFocus={() => {
                  setActiveIndex(index)
                  setActiveField('value')
                  const values = commonCSSValues[prop.key] || []
                  setSuggestions(values)
                  setShowSuggestions(values.length > 0)
                }}
                onBlur={() => {
                  // Don't clear the state completely, just hide suggestions
                  setTimeout(() => {
                    setShowSuggestions(false)
                  }, 200)
                }}
                placeholder="value"
                className="bg-transparent outline-none text-orange-400 placeholder-gray-600 flex-1 min-w-0"
              />
              <span className="text-gray-500 px-1">;</span>
            </div>
            
            {/* Delete button - positioned absolutely */}
            <button
              onClick={() => handleRemoveProperty(index)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove property"
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          </div>
        ))}
        
        {/* Add new property */}
        <div 
          className="flex items-center hover:bg-gray-800 cursor-pointer px-3 py-1"
          onClick={handleAddProperty}
        >
          <span className="text-gray-600">+ Add property...</span>
        </div>
      </div>
      
      {/* Closing brace */}
      <div className="px-3 py-2 border-t border-gray-700 text-gray-400">
        {'}'}
      </div>

      {/* Autocomplete dropdown */}
      {showSuggestions && activeIndex !== null && (
        <div 
          className="absolute z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg"
          style={{
            top: `${36 + (activeIndex + 1) * 28}px`,
            left: activeField === 'key' ? '12px' : '50%',
            minWidth: '150px',
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {suggestions.map((suggestion, idx) => (
            <div
              key={`${suggestion}-${idx}`}
              className={`px-3 py-1 cursor-pointer text-xs ${
                idx === selectedSuggestion 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                if (activeIndex !== null && activeField) {
                  handlePropertyChange(activeIndex, activeField, suggestion)
                  setShowSuggestions(false)
                  setSelectedSuggestion(0)
                }
              }}
              onMouseEnter={() => setSelectedSuggestion(idx)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Common HTML attributes for autocomplete
const commonAttributes = [
  'href', 'src', 'alt', 'title', 'target', 'rel', 'role', 'aria-label', 'aria-describedby',
  'aria-expanded', 'aria-hidden', 'aria-current', 'data-testid', 'id', 'name', 'type', 
  'value', 'placeholder', 'disabled', 'readonly', 'required', 'checked', 'selected',
  'multiple', 'accept', 'autocomplete', 'autofocus', 'min', 'max', 'step', 'pattern',
  'maxlength', 'minlength', 'size', 'rows', 'cols', 'wrap', 'for', 'form', 'action',
  'method', 'enctype', 'novalidate', 'formnovalidate', 'tabindex', 'accesskey',
  'contenteditable', 'draggable', 'spellcheck', 'translate', 'dir', 'lang', 'hidden'
].sort()

// DevTools-style Attribute editor component with autocomplete
const AttributeEditor = ({ 
  attributeProperties, 
  onChange 
}: { 
  attributeProperties: Array<{ key: string; value: string }> | undefined,
  onChange: (properties: Array<{ key: string; value: string }>) => void 
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [activeField, setActiveField] = useState<'key' | 'value' | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [focusNewProperty, setFocusNewProperty] = useState(false)
  const propertyRefs = useRef<(HTMLInputElement | null)[]>([])

  const handlePropertyChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const newProps = [...(attributeProperties || [])]
    newProps[index][field] = newValue
    onChange(newProps)
    // Update suggestions based on input
    if (field === 'key') {
      const filtered = commonAttributes.filter(attr => 
        attr.toLowerCase().startsWith(newValue.toLowerCase())
      )
      setSuggestions(filtered.slice(0, 8))
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: 'key' | 'value') => {
    // Handle Enter key in value field to add new property
    if (field === 'value' && e.key === 'Enter' && !showSuggestions) {
      e.preventDefault()
      handleAddProperty()
      return
    }

    // Handle Tab key in value field to jump to next property
    if (field === 'value' && e.key === 'Tab' && !showSuggestions && !e.shiftKey) {
      e.preventDefault()
      const nextIndex = index + 1
      if (nextIndex < (attributeProperties || []).length) {
        // Focus next property's key field
        setTimeout(() => {
          const nextInput = propertyRefs.current[nextIndex]
          if (nextInput) {
            nextInput.focus()
          }
        }, 0)
      } else {
        // No next property, add a new one
        handleAddProperty()
      }
      return
    }

    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestion(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
      case 'Tab':
        e.preventDefault()
        if (suggestions[selectedSuggestion] && activeField) {
          handlePropertyChange(index, activeField, suggestions[selectedSuggestion])
          setShowSuggestions(false)
          setSelectedSuggestion(0)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedSuggestion(0)
        break
    }
  }

  const handleAddProperty = () => {
    onChange([...(attributeProperties || []), { key: '', value: '' }])
    setFocusNewProperty(true)
  }

  // Effect to focus the new property input
  useEffect(() => {
    if (focusNewProperty) {
      const newIndex = (attributeProperties || []).length - 1
      setTimeout(() => {
        if (propertyRefs.current[newIndex]) {
          propertyRefs.current[newIndex]?.focus()
        }
      }, 50)
      setFocusNewProperty(false)
    }
  }, [attributeProperties?.length, focusNewProperty])

  const handleRemoveProperty = (index: number) => {
    const newProps = (attributeProperties || []).filter((_, i) => i !== index)
    onChange(newProps)
  }

  return (
    <div className="bg-gray-900 text-gray-100 rounded-md font-mono text-xs relative max-w-full overflow-visible">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 text-gray-400">
        element.attributes {'{'}
      </div>
      
      {/* Properties */}
      <div className="py-1">
        {(attributeProperties || []).map((prop, index) => (
          <div 
            key={index} 
            className="flex items-center hover:bg-gray-800 group px-3 py-1 relative pr-10"
          >
            {/* Attribute name */}
            <input
              ref={el => propertyRefs.current[index] = el}
              type="text"
              value={prop.key}
              onChange={(e) => handlePropertyChange(index, 'key', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index, 'key')}
              onFocus={() => {
                // Reset state on focus to ensure autocomplete works
                setActiveIndex(index)
                setActiveField('key')
                setSelectedSuggestion(0)
                // Always show suggestions on focus
                const currentValue = prop.key || ''
                const filtered = commonAttributes.filter(attr => 
                  currentValue ? attr.toLowerCase().startsWith(currentValue.toLowerCase()) : true
                ).slice(0, 8)
                setSuggestions(filtered)
                // Force show suggestions if there are any available
                if (filtered.length > 0) {
                  setShowSuggestions(true)
                }
              }}
              onBlur={() => {
                // Don't clear the state completely, just hide suggestions
                setTimeout(() => {
                  setShowSuggestions(false)
                }, 200)
              }}
              placeholder="attribute"
              className="bg-transparent outline-none text-cyan-400 placeholder-gray-600 flex-1"
            />
            <span className="text-gray-500 px-1">=</span>
            <span className="text-gray-500">"</span>
            
            {/* Attribute value */}
            <input
              type="text"
              value={prop.value}
              onChange={(e) => handlePropertyChange(index, 'value', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index, 'value')}
              onFocus={() => {
                setActiveIndex(index)
                setActiveField('value')
                setShowSuggestions(false)
              }}
              onBlur={() => {
                // Don't clear the state completely, just hide suggestions
                setTimeout(() => {
                  setShowSuggestions(false)
                }, 200)
              }}
              placeholder="value"
              className="bg-transparent outline-none text-orange-400 placeholder-gray-600 flex-1"
            />
            <span className="text-gray-500">"</span>
            
            {/* Delete button */}
            <button
              onClick={() => handleRemoveProperty(index)}
              className="text-red-400 hover:text-red-300 ml-2"
              title="Remove attribute"
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          </div>
        ))}
        
        {/* Add new property */}
        <div 
          className="flex items-center hover:bg-gray-800 cursor-pointer px-3 py-1"
          onClick={handleAddProperty}
        >
          <span className="text-gray-600">+ Add attribute...</span>
        </div>
      </div>
      
      {/* Closing brace */}
      <div className="px-3 py-2 border-t border-gray-700 text-gray-400">
        {'}'}
      </div>

      {/* Autocomplete dropdown */}
      {showSuggestions && activeIndex !== null && (
        <div 
          className="absolute z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg"
          style={{
            top: `${36 + (activeIndex + 1) * 28}px`,
            left: activeField === 'key' ? '12px' : '50%',
            minWidth: '150px',
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {suggestions.map((suggestion, idx) => (
            <div
              key={`${suggestion}-${idx}`}
              className={`px-3 py-1 cursor-pointer text-xs ${
                idx === selectedSuggestion 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                if (activeIndex !== null && activeField) {
                  handlePropertyChange(activeIndex, activeField, suggestion)
                  setShowSuggestions(false)
                  setSelectedSuggestion(0)
                }
              }}
              onMouseEnter={() => setSelectedSuggestion(idx)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Operation Mode Selector Component
const OperationModeSelector = ({
  mode,
  onChange
}: {
  mode: 'replace' | 'merge'
  onChange: (mode: 'replace' | 'merge') => void
}) => (
  <div className="flex items-center gap-2 text-xs">
    <label className="text-gray-600">Mode:</label>
    <select
      value={mode}
      onChange={(e) => onChange(e.target.value as 'replace' | 'merge')}
      className="bg-gray-800 border border-gray-600 text-white text-xs px-2 py-1 rounded"
    >
      <option value="merge">Merge (Add to existing)</option>
      <option value="replace">Replace (Override existing)</option>
    </select>
  </div>
)

// Reusable DOM change editor component
const DOMChangeEditorForm = ({ 
  editingChange, 
  setEditingChange, 
  pickingForField, 
  handleStartElementPicker,
  handleStartDragDrop,
  onSave,
  onCancel
}: {
  editingChange: EditingDOMChange,
  setEditingChange: (change: EditingDOMChange) => void,
  pickingForField: string | null,
  handleStartElementPicker: (field: string) => void,
  handleStartDragDrop: () => void,
  onSave: () => void,
  onCancel: () => void
}) => (
  <div className="border-2 border-blue-500 rounded-lg p-4 space-y-4 bg-blue-50">
    <div className="flex items-center justify-between">
      <h5 className="font-medium text-gray-900">
        {editingChange.index !== null ? 'Edit' : 'Add'} DOM Change
      </h5>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="p-1 text-green-600 hover:text-green-800"
          title="Save"
        >
          <CheckIcon className="h-5 w-5" />
        </button>
        <button
          onClick={onCancel}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Cancel"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>

    {/* Selector field with picker */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Element Selector
      </label>
      {/* Selector suggestions for better selectors */}
      {editingChange.selector && (() => {
        // Check if selector has auto-generated, temporary classes, or could be improved
        const hasAutoGenerated = /framer-[a-zA-Z0-9]+|css-[a-z0-9]+|hover|active|focus|^#\d|sc-[a-zA-Z0-9]+|svelte-[a-z0-9]+|emotion-[0-9]+|chakra-|MuiBox-root|is-hovered|is-active|is-focused/.test(editingChange.selector)
        
        // Also show suggestions if selector has low quality (many classes, complex structure)
        const needsSuggestions = hasAutoGenerated || 
          editingChange.selector.split('.').length > 4 || // Too many classes
          editingChange.selector.includes(':nth-') // Position-based selector
        
        if (needsSuggestions) {
          // Try to find the element and generate suggestions
          try {
            const elements = document.querySelectorAll(editingChange.selector)
            if (elements.length > 0) {
              // Always generate suggestions to see if there are better alternatives
              const allSuggestions = generateSelectorSuggestions(elements[0])
              
              // Filter out the current selector and prioritize unique matches
              const suggestions = allSuggestions
                .filter(s => s.selector !== editingChange.selector)
                .sort((a, b) => {
                  // Prioritize unique selectors
                  if (a.matchCount === 1 && b.matchCount !== 1) return -1
                  if (b.matchCount === 1 && a.matchCount !== 1) return 1
                  // Then by specificity
                  const specOrder = { high: 3, medium: 2, low: 1 }
                  return specOrder[b.specificity] - specOrder[a.specificity]
                })
                .slice(0, 5)
              
              if (suggestions.length > 0) {
                return (
                  <div className="mb-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <div className="flex items-start gap-2">
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-amber-800 font-medium text-xs mb-2">
                          This selector uses auto-generated classes that may change
                        </p>
                        <p className="text-amber-700 text-xs mb-2">
                          Pick a better selector:
                        </p>
                        <div className="space-y-1">
                          {suggestions.map((suggestion, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                debugLog('Selected alternative selector:', suggestion.selector)
                                setEditingChange({ ...editingChange, selector: suggestion.selector })
                              }}
                              className="w-full text-left p-2 bg-white hover:bg-amber-100 border border-amber-200 rounded text-xs transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <code className="font-mono text-amber-900">
                                  {suggestion.selector}
                                </code>
                                <span className="text-amber-600 ml-2">
                                  {suggestion.matchCount === 1 ? '✓ unique' : `${suggestion.matchCount} matches`}
                                </span>
                              </div>
                              <div className="text-amber-600 mt-0.5">
                                {suggestion.description}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
            }
          } catch (e) {
            debugLog('Could not generate suggestions:', e)
          }
        }
        return null
      })()}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          {/* Syntax highlighted overlay */}
          <div 
            className="absolute inset-0 px-3 py-2 pr-10 pointer-events-none text-xs font-mono bg-white border border-gray-300 rounded-md overflow-x-auto overflow-y-hidden"
            style={{ 
              scrollLeft: 0,
              whiteSpace: 'nowrap'
            }}
            id={`selector-overlay-edit-${editingChange.index}`}
          >
            {editingChange.selector ? highlightCSSSelector(editingChange.selector) : <span className="text-gray-400">.cta-button, #header, [data-test='submit']</span>}
          </div>
          {/* Actual input field */}
          <input
            value={editingChange.selector}
            onChange={(e) => setEditingChange({ ...editingChange, selector: e.target.value })}
            onScroll={(e) => {
              const input = e.target as HTMLInputElement
              const overlay = document.getElementById(`selector-overlay-edit-${editingChange.index}`)
              if (overlay) {
                overlay.scrollLeft = input.scrollLeft
              }
            }}
            placeholder=".cta-button, #header, [data-test='submit']"
            className={`relative w-full px-3 py-2 pr-10 border rounded-md text-xs font-mono whitespace-nowrap ${pickingForField === 'selector' ? 'border-blue-500' : 'border-gray-300'}`}
            style={{ 
              color: 'transparent',
              caretColor: 'black',
              background: 'transparent',
              overflowX: 'auto',
              overflowY: 'hidden'
            }}
          />
        </div>
        <Button
          type="button"
          onClick={() => handleStartElementPicker('selector')}
          size="sm"
          variant="secondary"
          title="Pick element"
          className={pickingForField === 'selector' ? 'bg-blue-100' : ''}
        >
          🎯
        </Button>
      </div>
      {pickingForField === 'selector' && (
        <p className="text-xs text-blue-600 mt-1 animate-pulse">
          Click an element on the page...
        </p>
      )}
    </div>

    {/* Change type selector */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Change Type
      </label>
      <select
        value={editingChange.type}
        onChange={(e) => {
          const newType = e.target.value as DOMChangeType
          debugLog('📝 Changing type to:', newType)
          const updatedChange = { ...editingChange, type: newType }
          debugLog('📝 Updated editingChange:', updatedChange)
          setEditingChange(updatedChange)
        }}
        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-xs font-mono appearance-none bg-white bg-no-repeat bg-[length:16px_16px] bg-[position:right_0.75rem_center]"
        style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" fill=\"%236b7280\"%3e%3cpath fill-rule=\"evenodd\" d=\"M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z\" clip-rule=\"evenodd\" /%3e%3c/svg%3e')" }}
      >
        <option value="text">Text</option>
        <option value="style">Style</option>
        <option value="class">Class</option>
        <option value="attribute">Attribute</option>
        <option value="html">HTML</option>
        <option value="javascript">JavaScript</option>
        <option value="move">Move/Reorder</option>
        <option value="remove">Remove Element</option>
        <option value="insert">Insert Element</option>
      </select>
    </div>

    {/* Dynamic value fields based on type */}
    {editingChange.type === 'text' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Text Content
        </label>
        <Input
          value={editingChange.textValue || ''}
          onChange={(e) => setEditingChange({ ...editingChange, textValue: e.target.value })}
          placeholder="New text content"
        />
      </div>
    )}

    {editingChange.type === 'style' && (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Style Properties
          </label>
          <OperationModeSelector
            mode={editingChange.mode || 'merge'}
            onChange={(mode) => setEditingChange({ ...editingChange, mode })}
          />
        </div>
        <CSSStyleEditor
          styleProperties={editingChange.styleProperties}
          onChange={(newProps) => setEditingChange({ ...editingChange, styleProperties: newProps })}
        />
      </div>
    )}

    {editingChange.type === 'class' && (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Classes to Add
          </label>
          <MultiSelectTags
            currentClasses={editingChange.classAdd || []}
            onAddClass={(className) => {
              const newClassAdd = [...(editingChange.classAdd || []), className]
              const newClassRemove = (editingChange.classRemove || []).filter(c => c !== className)
              setEditingChange({ 
                ...editingChange, 
                classAdd: newClassAdd,
                classRemove: newClassRemove
              })
            }}
            onRemoveClass={(className) => {
              setEditingChange({
                ...editingChange,
                classAdd: (editingChange.classAdd || []).filter(c => c !== className)
              })
            }}
            placeholder="Type class name to add and press Enter..."
            className="bg-green-50"
            pillColor="green"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Classes to Remove
          </label>
          <MultiSelectTags
            currentClasses={editingChange.classRemove || []}
            onAddClass={(className) => {
              const newClassRemove = [...(editingChange.classRemove || []), className]
              const newClassAdd = (editingChange.classAdd || []).filter(c => c !== className)
              setEditingChange({ 
                ...editingChange, 
                classRemove: newClassRemove,
                classAdd: newClassAdd
              })
            }}
            onRemoveClass={(className) => {
              setEditingChange({
                ...editingChange,
                classRemove: (editingChange.classRemove || []).filter(c => c !== className)
              })
            }}
            placeholder="Type class name to remove and press Enter..."
            className="bg-red-50"
            pillColor="red"
          />
        </div>
      </div>
    )}

    {editingChange.type === 'attribute' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attributes
        </label>
        <AttributeEditor 
          attributeProperties={editingChange.attributeProperties}
          onChange={(newProps) => setEditingChange({ ...editingChange, attributeProperties: newProps })}
        />
      </div>
    )}

    {editingChange.type === 'html' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          HTML Content
        </label>
        <div className="relative" style={{ minHeight: '112px' }}>
          <div 
            id={`html-overlay-${editingChange.index}`}
            className="absolute pointer-events-none text-xs font-mono leading-relaxed bg-white border border-gray-300 rounded-md"
            style={{ 
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              padding: '8px 12px 12px 12px',
              overflow: 'hidden',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              zIndex: 1
            }}
          >
            <div
              style={{
                transform: `translateY(${0}px)`,
                transition: 'none'
              }}
              id={`html-overlay-content-${editingChange.index}`}
            >
              {editingChange.htmlValue ? highlightHTML(editingChange.htmlValue) : <span className="text-gray-400">&lt;div class='new-element'&gt;New content to insert&lt;/div&gt;</span>}
            </div>
          </div>
          <textarea
            value={editingChange.htmlValue || ''}
            onChange={(e) => setEditingChange({ ...editingChange, htmlValue: e.target.value })}
            onScroll={(e) => {
              const textarea = e.target as HTMLTextAreaElement
              const overlayContent = document.getElementById(`html-overlay-content-${editingChange.index}`)
              if (overlayContent) {
                overlayContent.style.transform = `translateY(-${textarea.scrollTop}px)`
              }
            }}
            placeholder="<div class='new-element'>New content to insert</div>"
            className="absolute px-3 py-2 border border-transparent rounded-md text-xs font-mono leading-relaxed"
            style={{ 
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              color: 'transparent',
              caretColor: 'black',
              background: 'transparent',
              resize: 'vertical',
              overflow: 'auto',
              minHeight: '96px',
              paddingBottom: '12px',
              zIndex: 2
            }}
            rows={4}
          />
        </div>
      </div>
    )}

    {editingChange.type === 'javascript' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          JavaScript Code
        </label>
        <textarea
          value={editingChange.jsValue || ''}
          onChange={(e) => setEditingChange({ ...editingChange, jsValue: e.target.value })}
          placeholder="// JavaScript code to execute"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono bg-gray-50"
          rows={4}
        />
      </div>
    )}

    {editingChange.type === 'move' && (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎯</span>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 mb-1">Drag & Drop Mode</h4>
              <p className="text-sm text-gray-600 mb-3">
                Click the button below to enter drag-and-drop mode. You'll be able to click and drag any element to a new position.
              </p>
              <Button
                type="button"
                onClick={handleStartDragDrop}
                size="sm"
                variant="primary"
                className="w-full"
              >
                🖱️ Start Drag & Drop
              </Button>
            </div>
          </div>
        </div>
        
        {/* Show captured values if we have them */}
        {(editingChange.selector || editingChange.targetSelector || editingChange.position) && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="text-sm">
              <span className="font-medium text-gray-700">Element to Move:</span>{' '}
              <code className="text-xs bg-white px-1 py-0.5 rounded">
                {editingChange.selector || 'Not set'}
              </code>
            </div>
            <div className="text-sm">
              <span className="font-medium text-gray-700">Target:</span>{' '}
              <code className="text-xs bg-white px-1 py-0.5 rounded">
                {editingChange.targetSelector || 'Not set'}
              </code>
            </div>
            <div className="text-sm">
              <span className="font-medium text-gray-700">Position:</span>{' '}
              <span className="text-gray-600">
                {editingChange.position === 'before' ? 'Before element' :
                 editingChange.position === 'after' ? 'After element' :
                 editingChange.position === 'firstChild' ? 'As first child' :
                 editingChange.position === 'lastChild' ? 'As last child' :
                 'Not set'}
              </span>
            </div>
          </div>
        )}
        
        {/* Manual input as fallback */}
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            Manual input (advanced)
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Selector
              </label>
              <Input
                value={editingChange.targetSelector || ''}
                onChange={(e) => setEditingChange({ ...editingChange, targetSelector: e.target.value })}
                placeholder=".container, #section, [data-role='main']"
                className="text-xs"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position
              </label>
              <select
                value={editingChange.position || 'after'}
                onChange={(e) => setEditingChange({ ...editingChange, position: e.target.value as 'before' | 'after' | 'firstChild' | 'lastChild' })}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-xs font-mono appearance-none bg-white bg-no-repeat bg-[length:16px_16px] bg-[position:right_0.75rem_center]"
        style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" fill=\"%236b7280\"%3e%3cpath fill-rule=\"evenodd\" d=\"M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z\" clip-rule=\"evenodd\" /%3e%3c/svg%3e')" }}
              >
                <option value="before">Before target element</option>
                <option value="after">After target element</option>
                <option value="firstChild">As first child of target</option>
                <option value="lastChild">As last child of target</option>
              </select>
            </div>
          </div>
        </details>
      </div>
    )}

    {editingChange.type === 'remove' && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm text-red-800">
              This will completely remove the selected element from the page.
            </p>
          </div>
        </div>
      </div>
    )}

    {editingChange.type === 'insert' && (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            HTML to Insert
          </label>
          <div className="relative" style={{ minHeight: '112px' }}>
            <div 
              id={`html-overlay-${editingChange.index}`}
              className="absolute pointer-events-none text-xs font-mono leading-relaxed bg-white border border-gray-300 rounded-md"
              style={{ 
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                padding: '8px 12px 12px 12px',
                overflow: 'hidden',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                zIndex: 1
              }}
            >
              <div
                style={{
                  transform: `translateY(${0}px)`,
                  transition: 'none'
                }}
                id={`html-overlay-content-${editingChange.index}`}
              >
                {editingChange.htmlValue ? highlightHTML(editingChange.htmlValue) : <span className="text-gray-400">&lt;div class='new-element'&gt;New content to insert&lt;/div&gt;</span>}
              </div>
            </div>
            <textarea
              value={editingChange.htmlValue || ''}
              onChange={(e) => setEditingChange({ ...editingChange, htmlValue: e.target.value })}
              onScroll={(e) => {
                const textarea = e.target as HTMLTextAreaElement
                const overlayContent = document.getElementById(`html-overlay-content-${editingChange.index}`)
                if (overlayContent) {
                  overlayContent.style.transform = `translateY(-${textarea.scrollTop}px)`
                }
              }}
              placeholder="<div class='new-element'>New content to insert</div>"
              className="absolute px-3 py-2 border border-transparent rounded-md text-xs font-mono leading-relaxed"
              style={{ 
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                color: 'transparent',
                caretColor: 'black',
                background: 'transparent',
                resize: 'vertical',
                overflow: 'auto',
                minHeight: '96px',
                paddingBottom: '12px',
                zIndex: 2
              }}
              rows={4}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Insert Position
          </label>
          <select
            value={editingChange.position || 'after'}
            onChange={(e) => setEditingChange({ ...editingChange, position: e.target.value as 'before' | 'after' | 'firstChild' | 'lastChild' })}
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-xs font-mono appearance-none bg-white bg-no-repeat bg-[length:16px_16px] bg-[position:right_0.75rem_center]"
        style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" fill=\"%236b7280\"%3e%3cpath fill-rule=\"evenodd\" d=\"M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z\" clip-rule=\"evenodd\" /%3e%3c/svg%3e')" }}
          >
            <option value="before">Before the selected element</option>
            <option value="after">After the selected element</option>
            <option value="firstChild">As first child of the selected element</option>
            <option value="lastChild">As last child of the selected element</option>
          </select>
        </div>
      </div>
    )}
  </div>
)

export function DOMChangesInlineEditor({ 
  variantName, 
  changes, 
  onChange, 
  previewEnabled,
  onPreviewToggle
}: DOMChangesInlineEditorProps) {
  const [editingChange, setEditingChange] = useState<EditingDOMChange | null>(null)
  const [pickingForField, setPickingForField] = useState<string | null>(null)
  const [draggedChange, setDraggedChange] = useState<DOMChange | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Debug editingChange state changes (commented out - too verbose)
  // useEffect(() => {
  //   debugLog('🔄 editingChange state updated:', editingChange)
  // }, [editingChange])

  // Restore state when component mounts
  useEffect(() => {
    const storage = new Storage({ area: "session" })
    
    // First restore the editing state
    storage.get('domChangesInlineState').then(async (result) => {
      debugLog('Checking for saved DOM Changes inline state, variantName:', variantName)
      debugLog('Retrieved state:', result)
      
      if (result && result.variantName === variantName) {
        debugLog('Restoring DOM Changes inline state:', result)
        debugLog('Was in dragDropMode?', result.dragDropMode)
        
        setEditingChange(result.editingChange)
        setPickingForField(result.pickingForField)
        
        // Then check for element picker result
        const pickerResult = await storage.get('elementPickerResult')
        if (pickerResult && pickerResult.variantName === variantName && pickerResult.selector) {
          debugLog('Applying element picker result:', pickerResult)
          
          // Apply the selected element to the restored editing state
          if (pickerResult.fieldId === 'selector' && result.editingChange) {
            setEditingChange({ ...result.editingChange, selector: pickerResult.selector })
          } else if (pickerResult.fieldId === 'targetSelector' && result.editingChange) {
            setEditingChange({ ...result.editingChange, targetSelector: pickerResult.selector })
          }
          
          // Clear the picker result
          storage.remove('elementPickerResult')
        }
        
        // Check for drag-drop result
        const dragDropResult = await storage.get('dragDropResult')
        debugLog('Checking for drag-drop result:', dragDropResult)
        debugLog('Current editingChange from state:', result.editingChange)
        
        if (dragDropResult && dragDropResult.variantName === variantName) {
          debugLog('Applying drag-drop result:', dragDropResult)
          debugLog('Variant names match:', dragDropResult.variantName, '===', variantName)
          
          if (result.editingChange) {
            const updatedChange = { 
              ...result.editingChange, 
              selector: dragDropResult.selector,  // Add the source selector
              targetSelector: dragDropResult.targetSelector,
              position: dragDropResult.position 
            }
            debugLog('Updated editingChange with drag-drop result:', updatedChange)
            debugLog('Setting editingChange state to:', updatedChange)
            setEditingChange(updatedChange)
            
            // Force a re-render by updating a dummy state
            setTimeout(() => {
              debugLog('🔄 Force checking editingChange after setEditingChange:', editingChange)
              setEditingChange(prev => {
                debugLog('🔄 Previous editingChange in setState:', prev)
                return updatedChange
              })
            }, 100)
          } else {
            debugWarn('No editingChange found in restored state, cannot apply drag-drop result')
          }
          
          // Clear the drag-drop result
          await storage.remove('dragDropResult')
          debugLog('Cleared dragDropResult from storage')
        } else {
          debugLog('Drag-drop result not applicable:', 
            'variantName match:', dragDropResult?.variantName === variantName,
            'dragDropResult exists:', !!dragDropResult)
        }
        
        // Only clear the inline state if we're not waiting for drag-drop
        if (!result.dragDropMode || dragDropResult) {
          debugLog('Clearing domChangesInlineState')
          storage.remove('domChangesInlineState')
        } else {
          debugLog('Keeping domChangesInlineState for drag-drop completion')
        }
      }
      
      // Also check for visual editor changes
      const visualEditorResult = await storage.get('visualEditorChanges')
      debugLog('💾 visualEditorChanges:', visualEditorResult)
      if (visualEditorResult && visualEditorResult.variantName === variantName) {
        debugLog('Found visual editor changes for this variant!')
        if (visualEditorResult.changes && visualEditorResult.changes.length > 0) {
          // Merge visual editor changes with existing changes
          setChanges(prevChanges => {
            const merged = [...prevChanges]
            for (const change of visualEditorResult.changes) {
              // Check if this change already exists
              const existingIndex = merged.findIndex(c => 
                c.type === change.type && c.selector === change.selector
              )
              if (existingIndex >= 0) {
                // Update existing change
                merged[existingIndex] = change
              } else {
                // Add new change
                merged.push(change)
              }
            }
            return merged
          })
          
          // Clear visual editor changes after using them
          storage.remove('visualEditorChanges')
        }
      }
    })
  }, [variantName])

  // Listen for element selection
  useEffect(() => {
    const handleElementSelected = (message: any) => {
      debugLog('DOMChangesInlineEditor received message:', message)
      if (message.type === 'ELEMENT_SELECTED' && message.selector && pickingForField) {
        const storage = new Storage({ area: "session" })
        
        // Store the result for when popup reopens
        storage.set('elementPickerResult', {
          variantName,
          fieldId: pickingForField,
          selector: message.selector
        })

        // Update current state if we're still open
        if (pickingForField === 'selector' && editingChange) {
          setEditingChange({ ...editingChange, selector: message.selector })
        } else if (pickingForField === 'targetSelector' && editingChange) {
          setEditingChange({ ...editingChange, targetSelector: message.selector })
        }
        
        setPickingForField(null)
        chrome.runtime.onMessage.removeListener(handleElementSelected)
      }
    }
    
    if (pickingForField) {
      chrome.runtime.onMessage.addListener(handleElementSelected)
      return () => {
        chrome.runtime.onMessage.removeListener(handleElementSelected)
      }
    }
  }, [pickingForField, editingChange, variantName])

  // Listen for drag-drop complete from content script
  useEffect(() => {
    debugLog('📡 Setting up drag-drop listener for variant:', variantName)
    
    const handleDragDropComplete = async (message: any) => {
      debugLog('📡 Received message in DOMChangesInlineEditor:', message)
      
      if (message.type === 'DRAG_DROP_COMPLETE') {
        debugLog('Drag-drop complete message received:', message)
        
        // Store result in session storage
        const storage = new Storage({ area: "session" })
        const dragDropData = {
          variantName,
          selector: message.selector,
          targetSelector: message.targetSelector,
          position: message.position
        }
        debugLog('Storing drag-drop result:', dragDropData)
        
        await storage.set('dragDropResult', dragDropData)
        
        // Verify it was stored
        const verification = await storage.get('dragDropResult')
        debugLog('Verification - drag-drop result stored:', verification)
      }
    }
    
    chrome.runtime.onMessage.addListener(handleDragDropComplete)
    return () => {
      chrome.runtime.onMessage.removeListener(handleDragDropComplete)
    }
  }, [variantName])

  // Listen for visual editor changes
  useEffect(() => {
    const handleVisualEditorChanges = async (message: any) => {
      debugLog('📡 Received message in DOMChangesInlineEditor:', message)
      
      if (message.type === 'VISUAL_EDITOR_CHANGES' && message.variantName === variantName) {
        debugLog('Visual editor changes received:', message.changes)
        
        // Update parent component with visual editor changes
        if (message.changes && message.changes.length > 0) {
          onChange(message.changes)
          
          // Store in session storage for persistence
          const storage = new Storage({ area: "session" })
          await storage.set('visualEditorChanges', {
            variantName,
            changes: message.changes
          })
        }
      } else if (message.type === 'VISUAL_EDITOR_CHANGES_COMPLETE' && message.variantName === variantName) {
        debugLog('✅ Visual Editor Complete - Received changes:', message)
        
        if (message.changes && Array.isArray(message.changes) && message.changes.length > 0) {
          // Merge new changes with existing ones
          const mergedChanges = [...changes, ...message.changes]
          debugLog('📝 Merged changes:', mergedChanges)
          
          // Update the parent component
          onChange(mergedChanges)
          
          // Store in session storage for persistence
          const storage = new Storage({ area: "session" })
          await storage.set('visualEditorChanges', {
            variantName,
            changes: mergedChanges
          })
          
          // Show success toast
          const toast = document.createElement('div')
          toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-slide-in'
          toast.textContent = `✅ Added ${message.totalChanges} changes from Visual Editor`
          document.body.appendChild(toast)
          setTimeout(() => toast.remove(), 3000)
        }
      }
    }
    
    chrome.runtime.onMessage.addListener(handleVisualEditorChanges)
    return () => {
      chrome.runtime.onMessage.removeListener(handleVisualEditorChanges)
    }
  }, [variantName, changes, onChange])

  const handleLaunchVisualEditor = async () => {
    debugLog('🎨 Launching Visual Editor')
    
    // Disable preview if it's active to avoid conflicts
    if (previewEnabled) {
      debugLog('🔄 Disabling preview before launching visual editor')
      onPreviewToggle(false)
    }
    
    // Save current state
    const storage = new Storage({ area: "session" })
    await storage.set('visualEditorState', {
      variantName,
      changes,
      active: true
    })
    
    // Send message to background script to start visual editor
    debugLog('🚀 Sending START_VISUAL_EDITOR message to background')
    debugLog('Variant:', variantName)
    debugLog('Changes:', changes)
    
    // Test if we can send any message at all
    chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
      debugLog('PING response:', response)
    })
    
    chrome.runtime.sendMessage({ 
      type: 'START_VISUAL_EDITOR',
      variantName,
      changes
    }, (response) => {
      debugLog('📨 Response received from background:', response)
      if (chrome.runtime.lastError) {
        debugError('❌ Chrome runtime error:', chrome.runtime.lastError)
      } else if (response?.error) {
        debugError('❌ Error from background:', response.error)
        // Show user-friendly error
        if (response.error.includes('browser pages')) {
          alert('Visual editor cannot run on browser pages. Please navigate to a regular website.')
        }
      } else {
        debugLog('✅ Visual editor started successfully:', response)
        // Close popup after a short delay
        setTimeout(() => {
          window.close()
        }, 100)
      }
    })
  }

  const handleStartDragDrop = async () => {
    debugLog('Starting drag-drop picker')
    
    // Ensure we have an editingChange for move type
    const changeToSave = editingChange || {
      type: 'move',
      selector: '',
      targetSelector: '',
      position: 'after',
  mode: 'merge' as const,
      index: null
    }
    
    debugLog('Saving state before drag-drop:', { variantName, editingChange: changeToSave })
    
    // Save current state before starting
    const storage = new Storage({ area: "session" })
    const stateToSave = {
      variantName,
      editingChange: changeToSave,
      dragDropMode: true
    }
    
    debugLog('💾 Saving state for drag-drop:', stateToSave)
    await storage.set('domChangesInlineState', stateToSave)
    
    // Start drag-drop picker
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        const tabId = tabs[0].id
        const tabUrl = tabs[0].url || 'unknown'
        
        // Check if this is a restricted page
        if (tabUrl.startsWith('chrome://') || 
            tabUrl.startsWith('chrome-extension://') || 
            tabUrl.startsWith('edge://') ||
            tabUrl.includes('chrome.google.com/webstore')) {
          debugError('Content scripts cannot run on this page.')
          return
        }
        
        // Send message to start drag-drop picker
        chrome.tabs.sendMessage(tabId, { 
          type: 'START_DRAG_DROP_PICKER',
          fromPopup: true
        }, (response) => {
          if (chrome.runtime.lastError) {
            debugError('Error starting drag-drop picker:', chrome.runtime.lastError)
          } else {
            debugLog('Drag-drop picker started successfully:', response)
          }
        })
        
        // Close popup to allow drag-drop interaction
        setTimeout(() => {
          window.close()
        }, 100)
      }
    })
  }

  const handleStartElementPicker = async (fieldId: string) => {
    debugLog('Starting element picker for field:', fieldId)
    setPickingForField(fieldId)
    
    // Save current state before picker starts
    const storage = new Storage({ area: "session" })
    await storage.set('domChangesInlineState', {
      variantName,
      editingChange,
      pickingForField: fieldId
    })
    debugLog('Saved state to storage')
    
    // Popup state will be handled by the parent component's effect
    // We just need to ensure our state is saved before closing
    
    // Start element picker
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      debugLog('Found tabs:', tabs)
      if (tabs[0]?.id) {
        const tabId = tabs[0].id
        const tabUrl = tabs[0].url || 'unknown'
        
        debugLog('Current tab URL:', tabUrl)
        
        // Check if this is a restricted page
        if (tabUrl.startsWith('chrome://') || 
            tabUrl.startsWith('chrome-extension://') || 
            tabUrl.startsWith('edge://') ||
            tabUrl.includes('chrome.google.com/webstore')) {
          debugError('Content scripts cannot run on this page. Please try on a regular website.')
          return
        }
        
        // Send a test message first to check if content script is responding
        debugLog('Sending test message to content script...')
        chrome.tabs.sendMessage(tabId, { 
          type: 'TEST_CONNECTION',
          fromPopup: true
        }, (testResponse) => {
          if (chrome.runtime.lastError) {
            debugError('Content script not responding to test:', chrome.runtime.lastError)
            debugLog('Content script is not loaded. Please refresh the page and try again.')
            return
          }
          debugLog('Test connection successful:', testResponse)
          
          // Now send the actual element picker message
          chrome.tabs.sendMessage(tabId, { 
            type: 'START_ELEMENT_PICKER',
            fromPopup: true
          }, (response) => {
            if (chrome.runtime.lastError) {
              debugError('Error starting element picker:', chrome.runtime.lastError)
            } else {
              debugLog('Element picker started successfully:', response)
            }
          })
        })
        
        // Don't close the window - we're in a sidebar now, not a popup
        // The sidebar should remain open to receive the element selection
      } else {
        debugError('No active tab found!')
      }
    })
  }

  const handleToggleChange = (index: number) => {
    const newChanges = [...changes]
    const wasEnabled = newChanges[index].enabled !== false
    newChanges[index] = { ...newChanges[index], enabled: !wasEnabled }
    debugLog('🔄 Toggle change:', {
      index,
      selector: newChanges[index].selector,
      wasEnabled,
      isNowEnabled: newChanges[index].enabled,
      allChanges: newChanges
    })
    onChange(newChanges)
  }

  const handleDeleteChange = (index: number) => {
    const newChanges = changes.filter((_, i) => i !== index)
    onChange(newChanges)
  }

  const handleAddChange = () => {
    const newChange = createEmptyChange()
    debugLog('🆕 Creating new DOM change:', newChange)
    setEditingChange(newChange)
  }

  const handleEditChange = (index: number) => {
    const change = changes[index]
    
    // Convert classAdd/classRemove to classesWithStatus
    let classesWithStatus: Array<{ name: string; action: 'add' | 'remove' }> = []
    if (change.type === 'class') {
      const addClasses = (change.add || []).map(name => ({ name, action: 'add' as const }))
      const removeClasses = (change.remove || []).map(name => ({ name, action: 'remove' as const }))
      classesWithStatus = [...addClasses, ...removeClasses]
    }
    
    const editing: EditingDOMChange = {
      index,
      selector: change.selector,
      type: change.type,
      textValue: change.type === 'text' ? change.value : '',
      htmlValue: change.type === 'html' ? change.value : change.type === 'insert' ? (change as any).html : '',
      jsValue: change.type === 'javascript' ? change.value : '',
      styleProperties: change.type === 'style' 
        ? Object.entries(change.value as Record<string, string>).map(([key, value]) => ({ key, value }))
        : [{ key: '', value: '' }],
      attributeProperties: change.type === 'attribute'
        ? Object.entries(change.value as Record<string, string>).map(([key, value]) => ({ key, value }))
        : [{ key: '', value: '' }],
      classAdd: change.type === 'class' ? (change.add || []) : [],
      classRemove: change.type === 'class' ? (change.remove || []) : [],
      classesWithStatus,
      targetSelector: change.type === 'move' ? change.targetSelector : '',
      position: change.type === 'move' ? change.position : change.type === 'insert' ? (change as any).position : 'after',
      mode: (change as any).mode || 'merge'
    }
    setEditingChange(editing)
  }

  const handleSaveChange = () => {
    debugLog('💾 Saving change, editingChange:', editingChange)
    debugLog('💾 Current changes array:', changes)
    
    if (!editingChange || !editingChange.selector) {
      alert('Please enter a selector')
      return
    }

    let domChange: DOMChange

    switch (editingChange.type) {
      case 'text':
        domChange = { 
          selector: editingChange.selector, 
          type: 'text', 
          value: editingChange.textValue || '', 
          enabled: true,
          mode: editingChange.mode || 'merge' 
        }
        break
      case 'html':
        domChange = { 
          selector: editingChange.selector, 
          type: 'html', 
          value: editingChange.htmlValue || '', 
          enabled: true,
          mode: editingChange.mode || 'merge' 
        }
        break
      case 'javascript':
        domChange = { 
          selector: editingChange.selector, 
          type: 'javascript', 
          value: editingChange.jsValue || '', 
          enabled: true,
          mode: editingChange.mode || 'merge' 
        }
        break
      case 'style':
        const styleValue: Record<string, string> = {}
        editingChange.styleProperties?.forEach(({ key, value }) => {
          if (key && value) styleValue[key] = value
        })
        domChange = { 
          selector: editingChange.selector, 
          type: 'style', 
          value: styleValue, 
          enabled: true,
          mode: editingChange.mode || 'merge' 
        }
        break
      case 'attribute':
        const attrValue: Record<string, string> = {}
        editingChange.attributeProperties?.forEach(({ key, value }) => {
          if (key && value) attrValue[key] = value
        })
        domChange = { 
          selector: editingChange.selector, 
          type: 'attribute', 
          value: attrValue, 
          enabled: true,
          mode: editingChange.mode || 'merge' 
        }
        break
      case 'class':
        domChange = { 
          selector: editingChange.selector, 
          type: 'class', 
          add: editingChange.classAdd?.filter(c => c) || [], 
          remove: editingChange.classRemove?.filter(c => c) || [],
          enabled: true,
          mode: editingChange.mode || 'merge' 
        }
        break
      case 'move':
        domChange = {
          selector: editingChange.selector,
          type: 'move',
          targetSelector: editingChange.targetSelector || '',
          position: editingChange.position || 'after',
          enabled: true,
          mode: editingChange.mode || 'merge'
        }
        break
      case 'remove':
        domChange = {
          selector: editingChange.selector,
          type: 'remove',
          enabled: true,
          mode: editingChange.mode || 'merge'
        }
        break
      case 'insert':
        domChange = {
          selector: editingChange.selector,
          type: 'insert',
          html: editingChange.htmlValue || '',
          position: editingChange.position || 'after',
          enabled: true,
          mode: editingChange.mode || 'merge'
        }
        break
      default:
        return
    }

    if (editingChange.index !== null) {
      const newChanges = [...changes]
      newChanges[editingChange.index] = domChange
      debugLog('💾 Updating existing change at index', editingChange.index, 'newChanges:', newChanges)
      onChange(newChanges)
    } else {
      const newChanges = [...changes, domChange]
      debugLog('💾 Adding new change to array, newChanges:', newChanges)
      onChange(newChanges)
    }
    
    setEditingChange(null)
    
    // Clear any stored state
    const storage = new Storage({ area: "session" })
    storage.remove('domChangesInlineState')
  }

  const handleCancelEdit = () => {
    setEditingChange(null)
    setPickingForField(null)
    
    // Clear any stored state
    const storage = new Storage({ area: "session" })
    storage.remove('domChangesInlineState')
  }

  const getChangeIcon = (type: DOMChangeType) => {
    switch (type) {
      case 'text':
        return DocumentTextIcon
      case 'style':
        return PaintBrushIcon
      case 'class':
        return HashtagIcon
      case 'attribute':
        return CubeIcon
      case 'html':
        return CodeBracketIcon
      case 'javascript':
        return CommandLineIcon
      case 'move':
        return ArrowsUpDownIcon
      case 'remove':
        return TrashIcon
      case 'insert':
        return PlusCircleIcon
      default:
        return CursorArrowRaysIcon
    }
  }

  const getChangeTypeLabel = (type: DOMChangeType): string => {
    switch (type) {
      case 'text': return 'Text'
      case 'style': return 'Style'
      case 'class': return 'Class'
      case 'attribute': return 'Attribute'
      case 'html': return 'HTML'
      case 'javascript': return 'JavaScript'
      case 'move': return 'Move/Reorder'
      case 'remove': return 'Remove'
      case 'insert': return 'Insert'
      default: return type
    }
  }

  const getChangeDescription = (change: DOMChange): React.ReactNode => {
    switch (change.type) {
      case 'text':
        return (
          <span className="text-gray-600">
            <span className="text-gray-500">Set text to:</span> <span className="font-medium text-gray-800">"{change.value}"</span>
          </span>
        )
      case 'style':
        const styles = Object.entries(change.value)
        return (
          <div className="flex flex-wrap gap-1.5">
            {styles.map(([key, value], i) => (
              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-xs">
                <span className="text-blue-700 font-medium">{key}:</span>
                <span className="ml-0.5 text-blue-600">{value}</span>
              </span>
            ))}
          </div>
        )
      case 'class':
        // Show empty state if no classes
        if ((!change.add || change.add.length === 0) && (!change.remove || change.remove.length === 0)) {
          return <span className="text-gray-400 text-xs italic">No classes configured</span>
        }
        
        return (
          <div className="flex flex-wrap gap-1.5">
            {change.add?.map((cls, i) => (
              <span key={`add-${i}`} className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-xs">
                <span className="text-green-600">+</span>
                <span className="ml-0.5 text-green-700">{cls}</span>
              </span>
            ))}
            {change.remove?.map((cls, i) => (
              <span key={`remove-${i}`} className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-xs">
                <span className="text-red-600">−</span>
                <span className="ml-0.5 text-red-700">{cls}</span>
              </span>
            ))}
          </div>
        )
      case 'attribute':
        const attrs = Object.entries(change.value)
        return (
          <div className="flex flex-wrap gap-1.5">
            {attrs.map(([key, value], i) => (
              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-xs">
                <span className="text-purple-700 font-medium">{key}=</span>
                <span className="text-purple-600">"{value}"</span>
              </span>
            ))}
          </div>
        )
      case 'html':
        return (
          <span className="text-gray-600">
            <span className="text-gray-500">Replace inner HTML</span>
            {change.value && change.value.length > 50 && (
              <span className="ml-1 text-xs text-gray-400">({change.value.length} chars)</span>
            )}
          </span>
        )
      case 'javascript':
        return (
          <span className="text-gray-600">
            <span className="text-gray-500">Execute JavaScript</span>
            {change.value && change.value.length > 50 && (
              <span className="ml-1 text-xs text-gray-400">({change.value.length} chars)</span>
            )}
          </span>
        )
      case 'move':
        const positionText = change.position === 'before' ? 'before' : 
                           change.position === 'after' ? 'after' :
                           change.position === 'firstChild' ? 'as first child of' :
                           'as last child of'
        return (
          <span className="text-gray-600">
            <span className="text-gray-500">Move</span>{' '}
            <span className="text-gray-500">{positionText}</span>{' '}
            <code className="text-xs font-mono text-blue-600">{change.targetSelector}</code>
          </span>
        )
      case 'remove':
        return <span className="text-red-600">Remove element</span>
      case 'insert':
        const insertChange = change as any
        return (
          <span className="text-green-600">
            Insert new element {insertChange.position || 'after'} the selected element
          </span>
        )
      default:
        return <span className="text-gray-500">Unknown change type: {change.type}</span>
    }
  }

  return (
    <div 
      className={`space-y-3 ${isDragOver ? 'ring-2 ring-blue-400 ring-opacity-50 bg-blue-50 rounded-lg p-2' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
        
        // Try to get the dragged change from dataTransfer
        const changeData = e.dataTransfer.getData('application/json')
        if (changeData) {
          try {
            const draggedChange = JSON.parse(changeData) as DOMChange
            
            // Check if this change already exists (by selector)
            const existingIndex = changes.findIndex(c => c.selector === draggedChange.selector)
            if (existingIndex === -1) {
              // Add the new change
              onChange([...changes, draggedChange])
              debugLog('✅ DOM change dropped and added')
            } else {
              debugLog('⚠️ Change with this selector already exists')
            }
          } catch (err) {
            debugError('Failed to parse dropped change:', err)
          }
        }
      }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">DOM Changes</h4>
        <div className="flex items-center gap-2">
          {/* Copy all changes button */}
          {changes.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                const jsonString = JSON.stringify(changes, null, 2);
                
                try {
                  // Try using the Clipboard API first
                  await navigator.clipboard.writeText(jsonString);
                  debugLog('✅ DOM changes copied to clipboard using Clipboard API');
                } catch (err) {
                  // Fallback: Use a temporary textarea element
                  try {
                    const textarea = document.createElement('textarea');
                    textarea.value = jsonString;
                    textarea.style.position = 'fixed';
                    textarea.style.top = '-9999px';
                    textarea.style.left = '-9999px';
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();
                    
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    
                    if (successful) {
                      debugLog('✅ DOM changes copied to clipboard using fallback method');
                    } else {
                      throw new Error('Document.execCommand failed');
                    }
                  } catch (fallbackErr) {
                    debugError('Failed to copy changes with both methods:', err, fallbackErr);
                    // Last resort: Show the JSON in a prompt for manual copying
                    window.prompt('Copy the DOM changes manually:', jsonString);
                  }
                }
              }}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Copy all DOM changes"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          
          {/* Paste changes button */}
          <button
            type="button"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText()
                const pastedChanges = JSON.parse(text) as DOMChange[]
                
                // Validate that it's an array of DOM changes
                if (Array.isArray(pastedChanges) && pastedChanges.every(c => 
                  c.selector && c.type && ['text', 'html', 'attribute', 'style', 'class'].includes(c.type)
                )) {
                  // Merge with existing changes (avoiding duplicates by selector)
                  const existingSelectors = new Set(changes.map(c => c.selector))
                  const newChanges = pastedChanges.filter(c => !existingSelectors.has(c.selector))
                  onChange([...changes, ...newChanges])
                  debugLog(`✅ Pasted ${newChanges.length} new DOM changes`)
                } else {
                  debugError('Invalid DOM changes format in clipboard')
                }
              } catch (err) {
                debugError('Failed to paste changes:', err)
              }
            }}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            title="Paste DOM changes from clipboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </button>
          
          <label className="flex items-center gap-2 text-sm">
            <span>Preview:</span>
            <button
              type="button"
              onClick={() => onPreviewToggle(!previewEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                previewEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  previewEnabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Existing changes list with improved design */}
      <div className="space-y-2">
        {changes.length === 0 && !editingChange ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
            <CursorArrowRaysIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">No DOM changes configured</p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={handleAddChange}
                size="sm"
                variant="secondary"
                className="inline-flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Add DOM Change
              </Button>
              <Button
                onClick={handleLaunchVisualEditor}
                size="sm"
                variant="primary"
                className="inline-flex items-center gap-1"
              >
                <PaintBrushIcon className="h-4 w-4" />
                Visual Editor
              </Button>
            </div>
          </div>
        ) : (
          <>
            {changes.map((change, index) => {
              const Icon = getChangeIcon(change.type)
              const isDisabled = change.enabled === false
              
              // If we're editing this change, show the edit form instead
              if (editingChange && editingChange.index === index) {
                return (
                  <div key={index} className="border-2 border-blue-500 rounded-lg p-4 space-y-4 bg-blue-50">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-gray-900">
                        Edit DOM Change
                      </h5>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveChange}
                          className="p-1 text-green-600 hover:text-green-800"
                          title="Save"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Cancel"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Selector field with picker */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Element Selector
                      </label>
                      {/* Selector suggestions for better selectors */}
                      {editingChange.selector && (() => {
                        // Check if selector has auto-generated, temporary classes, or could be improved
                        const hasAutoGenerated = /framer-[a-zA-Z0-9]+|css-[a-z0-9]+|hover|active|focus|^#\d|sc-[a-zA-Z0-9]+|svelte-[a-z0-9]+|emotion-[0-9]+|chakra-|MuiBox-root|is-hovered|is-active|is-focused/.test(editingChange.selector)
                        
                        // Also show suggestions if selector has low quality (many classes, complex structure)
                        const needsSuggestions = hasAutoGenerated || 
                          editingChange.selector.split('.').length > 4 || // Too many classes
                          editingChange.selector.includes(':nth-') // Position-based selector
                        
                        if (needsSuggestions) {
                          // Try to find the element and generate suggestions
                          try {
                            const elements = document.querySelectorAll(editingChange.selector)
                            if (elements.length > 0) {
                              // Always generate suggestions to see if there are better alternatives
                              const allSuggestions = generateSelectorSuggestions(elements[0])
                              
                              // Filter out the current selector and prioritize unique matches
                              const suggestions = allSuggestions
                                .filter(s => s.selector !== editingChange.selector)
                                .sort((a, b) => {
                                  // Prioritize unique selectors
                                  if (a.matchCount === 1 && b.matchCount !== 1) return -1
                                  if (b.matchCount === 1 && a.matchCount !== 1) return 1
                                  // Then by specificity
                                  const specOrder = { high: 3, medium: 2, low: 1 }
                                  return specOrder[b.specificity] - specOrder[a.specificity]
                                })
                                .slice(0, 5)
                              
                              if (suggestions.length > 0) {
                                return (
                                  <div className="mb-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                    <div className="flex items-start gap-2">
                                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <p className="text-amber-800 font-medium text-xs mb-2">
                                          This selector uses auto-generated classes that may change
                                        </p>
                                        <p className="text-amber-700 text-xs mb-2">
                                          Pick a better selector:
                                        </p>
                                        <div className="space-y-1">
                                          {suggestions.map((suggestion, idx) => (
                                            <button
                                              key={idx}
                                              onClick={() => {
                                                debugLog('Selected alternative selector:', suggestion.selector)
                                                setEditingChange({ ...editingChange, selector: suggestion.selector })
                                              }}
                                              className="w-full text-left p-2 bg-white hover:bg-amber-100 border border-amber-200 rounded text-xs transition-colors"
                                            >
                                              <div className="flex items-center justify-between">
                                                <code className="font-mono text-amber-900">
                                                  {suggestion.selector}
                                                </code>
                                                <span className="text-amber-600 ml-2">
                                                  {suggestion.matchCount === 1 ? '✓ unique' : `${suggestion.matchCount} matches`}
                                                </span>
                                              </div>
                                              <div className="text-amber-600 mt-0.5">
                                                {suggestion.description}
                                              </div>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              }
                            }
                          } catch (e) {
                            debugLog('Could not generate suggestions:', e)
                          }
                        }
                        return null
                      })()}
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          {/* Syntax highlighted overlay */}
                          <div 
                            className="absolute inset-0 px-3 py-2 pr-10 pointer-events-none text-xs font-mono bg-white border border-gray-300 rounded-md overflow-x-auto overflow-y-hidden"
                            style={{ 
                              scrollLeft: 0,
                              whiteSpace: 'nowrap'
                            }}
                            id={`selector-overlay-edit-${editingChange.index}`}
                          >
                            {editingChange.selector ? highlightCSSSelector(editingChange.selector) : <span className="text-gray-400">.cta-button, #header, [data-test='submit']</span>}
                          </div>
                          {/* Actual input field */}
                          <input
                            value={editingChange.selector}
                            onChange={(e) => setEditingChange({ ...editingChange, selector: e.target.value })}
                            onScroll={(e) => {
                              const input = e.target as HTMLInputElement
                              const overlay = document.getElementById(`selector-overlay-edit-${editingChange.index}`)
                              if (overlay) {
                                overlay.scrollLeft = input.scrollLeft
                              }
                            }}
                            placeholder=".cta-button, #header, [data-test='submit']"
                            className={`relative w-full px-3 py-2 pr-10 border rounded-md text-xs font-mono whitespace-nowrap ${pickingForField === 'selector' ? 'border-blue-500' : 'border-gray-300'}`}
                            style={{ 
                              color: 'transparent',
                              caretColor: 'black',
                              background: 'transparent',
                              overflowX: 'auto',
                              overflowY: 'hidden'
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => handleStartElementPicker('selector')}
                          size="sm"
                          variant="secondary"
                          title="Pick element"
                          className={pickingForField === 'selector' ? 'bg-blue-100' : ''}
                        >
                          🎯
                        </Button>
                      </div>
                      {pickingForField === 'selector' && (
                        <p className="text-xs text-blue-600 mt-1 animate-pulse">
                          Click an element on the page...
                        </p>
                      )}
                    </div>

                    {/* Change type selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Change Type
                      </label>
                      <select
                        value={editingChange.type}
                        onChange={(e) => {
                          const newType = e.target.value as DOMChangeType
                          debugLog('📝 Changing type to:', newType)
                          const updatedChange = { ...editingChange, type: newType }
                          debugLog('📝 Updated editingChange:', updatedChange)
                          setEditingChange(updatedChange)
                        }}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-xs font-mono appearance-none bg-white bg-no-repeat bg-[length:16px_16px] bg-[position:right_0.75rem_center]"
                        style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" fill=\"%236b7280\"%3e%3cpath fill-rule=\"evenodd\" d=\"M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z\" clip-rule=\"evenodd\" /%3e%3c/svg%3e')" }}
                      >
                        <option value="text">Text</option>
                        <option value="style">Style</option>
                        <option value="class">Class</option>
                        <option value="attribute">Attribute</option>
                        <option value="html">HTML</option>
                        <option value="javascript">JavaScript</option>
                        <option value="move">Move/Reorder</option>
                        <option value="remove">Remove Element</option>
                        <option value="insert">Insert Element</option>
                      </select>
                    </div>

                    {/* Dynamic value fields based on type */}
                    {editingChange.type === 'text' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Text Content
                        </label>
                        <Input
                          value={editingChange.textValue || ''}
                          onChange={(e) => setEditingChange({ ...editingChange, textValue: e.target.value })}
                          placeholder="New text content"
                        />
                      </div>
                    )}

                    {editingChange.type === 'style' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Style Properties
                        </label>
                        <CSSStyleEditor
                          styleProperties={editingChange.styleProperties}
                          onChange={(newProps) => setEditingChange({ ...editingChange, styleProperties: newProps })}
                        />
                      </div>
                    )}

                    {editingChange.type === 'class' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Classes to Add
                          </label>
                          <MultiSelectTags
                            currentClasses={editingChange.classAdd || []}
                            onAddClass={(className) => {
                              const newClassAdd = [...(editingChange.classAdd || []), className]
                              const newClassRemove = (editingChange.classRemove || []).filter(c => c !== className)
                              setEditingChange({ 
                                ...editingChange, 
                                classAdd: newClassAdd,
                                classRemove: newClassRemove
                              })
                            }}
                            onRemoveClass={(className) => {
                              setEditingChange({
                                ...editingChange,
                                classAdd: (editingChange.classAdd || []).filter(c => c !== className)
                              })
                            }}
                            placeholder="Type class name to add and press Enter..."
                            className="bg-green-50"
                            pillColor="green"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Classes to Remove
                          </label>
                          <MultiSelectTags
                            currentClasses={editingChange.classRemove || []}
                            onAddClass={(className) => {
                              const newClassRemove = [...(editingChange.classRemove || []), className]
                              const newClassAdd = (editingChange.classAdd || []).filter(c => c !== className)
                              setEditingChange({ 
                                ...editingChange, 
                                classRemove: newClassRemove,
                                classAdd: newClassAdd
                              })
                            }}
                            onRemoveClass={(className) => {
                              setEditingChange({
                                ...editingChange,
                                classRemove: (editingChange.classRemove || []).filter(c => c !== className)
                              })
                            }}
                            placeholder="Type class name to remove and press Enter..."
                            className="bg-red-50"
                            pillColor="red"
                          />
                        </div>
                      </div>
                    )}

                    {editingChange.type === 'attribute' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Attributes
                        </label>
                        <AttributeEditor 
                          attributeProperties={editingChange.attributeProperties}
                          onChange={(newProps) => setEditingChange({ ...editingChange, attributeProperties: newProps })}
                        />
                      </div>
                    )}

                    {editingChange.type === 'html' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          HTML Content
                        </label>
                        <textarea
                          value={editingChange.htmlValue || ''}
                          onChange={(e) => setEditingChange({ ...editingChange, htmlValue: e.target.value })}
                          placeholder="<div>New HTML content</div>"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono bg-gray-50"
                          rows={4}
                        />
                      </div>
                    )}

                    {editingChange.type === 'javascript' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          JavaScript Code
                        </label>
                        <textarea
                          value={editingChange.jsValue || ''}
                          onChange={(e) => setEditingChange({ ...editingChange, jsValue: e.target.value })}
                          placeholder="// JavaScript code to execute"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono bg-gray-50"
                          rows={4}
                        />
                      </div>
                    )}

                    {editingChange.type === 'move' && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">🎯</span>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 mb-1">Drag & Drop Mode</h4>
                              <p className="text-sm text-gray-600 mb-3">
                                Click the button below to enter drag-and-drop mode. You'll be able to click and drag any element to a new position.
                              </p>
                              <Button
                                type="button"
                                onClick={handleStartDragDrop}
                                size="sm"
                                variant="primary"
                                className="w-full"
                              >
                                🖱️ Start Drag & Drop
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Show captured values if we have them */}
                        {(editingChange.selector || editingChange.targetSelector || editingChange.position) && (
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <div className="text-sm">
                              <span className="font-medium text-gray-700">Element to Move:</span>{' '}
                              <code className="text-xs bg-white px-1 py-0.5 rounded">
                                {editingChange.selector || 'Not set'}
                              </code>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium text-gray-700">Target:</span>{' '}
                              <code className="text-xs bg-white px-1 py-0.5 rounded">
                                {editingChange.targetSelector || 'Not set'}
                              </code>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium text-gray-700">Position:</span>{' '}
                              <span className="text-gray-600">
                                {editingChange.position === 'before' ? 'Before element' :
                                 editingChange.position === 'after' ? 'After element' :
                                 editingChange.position === 'firstChild' ? 'As first child' :
                                 editingChange.position === 'lastChild' ? 'As last child' :
                                 'Not set'}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Manual input as fallback */}
                        <details className="text-sm">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                            Manual input (advanced)
                          </summary>
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Target Selector
                              </label>
                              <Input
                                value={editingChange.targetSelector || ''}
                                onChange={(e) => setEditingChange({ ...editingChange, targetSelector: e.target.value })}
                                placeholder=".container, #section, [data-role='main']"
                                className="text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Position
                              </label>
                              <select
                                value={editingChange.position || 'after'}
                                onChange={(e) => setEditingChange({ ...editingChange, position: e.target.value as 'before' | 'after' | 'firstChild' | 'lastChild' })}
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-xs font-mono appearance-none bg-white bg-no-repeat bg-[length:16px_16px] bg-[position:right_0.75rem_center]"
                        style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" fill=\"%236b7280\"%3e%3cpath fill-rule=\"evenodd\" d=\"M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z\" clip-rule=\"evenodd\" /%3e%3c/svg%3e')" }}
                              >
                                <option value="before">Before target element</option>
                                <option value="after">After target element</option>
                                <option value="firstChild">As first child of target</option>
                                <option value="lastChild">As last child of target</option>
                              </select>
                            </div>
                          </div>
                        </details>
                      </div>
                    )}

                    {editingChange.type === 'remove' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-xl">⚠️</span>
                          <div className="flex-1">
                            <p className="text-sm text-red-800">
                              This will completely remove the selected element from the page.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {editingChange.type === 'insert' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            HTML to Insert
                          </label>
                          <div className="relative" style={{ minHeight: '112px' }}>
                            <div 
                              id={`html-overlay-${editingChange.index}`}
                              className="absolute pointer-events-none text-xs font-mono leading-relaxed bg-white border border-gray-300 rounded-md"
                              style={{ 
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                padding: '8px 12px 12px 12px',
                                overflow: 'hidden',
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                                zIndex: 1
                              }}
                            >
                              <div
                                style={{
                                  transform: `translateY(${0}px)`,
                                  transition: 'none'
                                }}
                                id={`html-overlay-content-${editingChange.index}`}
                              >
                                {editingChange.htmlValue ? highlightHTML(editingChange.htmlValue) : <span className="text-gray-400">&lt;div class='new-element'&gt;New content to insert&lt;/div&gt;</span>}
                              </div>
                            </div>
                            <textarea
                              value={editingChange.htmlValue || ''}
                              onChange={(e) => setEditingChange({ ...editingChange, htmlValue: e.target.value })}
                              onScroll={(e) => {
                                const textarea = e.target as HTMLTextAreaElement
                                const overlayContent = document.getElementById(`html-overlay-content-${editingChange.index}`)
                                if (overlayContent) {
                                  overlayContent.style.transform = `translateY(-${textarea.scrollTop}px)`
                                }
                              }}
                              placeholder="<div class='new-element'>New content to insert</div>"
                              className="absolute px-3 py-2 border border-transparent rounded-md text-xs font-mono leading-relaxed"
                              style={{ 
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                color: 'transparent',
                                caretColor: 'black',
                                background: 'transparent',
                                resize: 'vertical',
                                overflow: 'auto',
                                minHeight: '96px',
                                paddingBottom: '12px',
                                zIndex: 2
                              }}
                              rows={4}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Insert Position
                          </label>
                          <select
                            value={editingChange.position || 'after'}
                            onChange={(e) => setEditingChange({ ...editingChange, position: e.target.value as 'before' | 'after' | 'firstChild' | 'lastChild' })}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-xs font-mono appearance-none bg-white bg-no-repeat bg-[length:16px_16px] bg-[position:right_0.75rem_center]"
                        style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" fill=\"%236b7280\"%3e%3cpath fill-rule=\"evenodd\" d=\"M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z\" clip-rule=\"evenodd\" /%3e%3c/svg%3e')" }}
                          >
                            <option value="before">Before the selected element</option>
                            <option value="after">After the selected element</option>
                            <option value="firstChild">As first child of the selected element</option>
                            <option value="lastChild">As last child of the selected element</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
              
              return (
                <div 
                  key={index} 
                  draggable={true}
                  title="Drag to reorder or copy to another variant"
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('application/json', JSON.stringify(change))
                    e.dataTransfer.setData('source-index', index.toString())
                    setDraggedChange(change)
                    setDraggedIndex(index)
                    // Add visual feedback
                    e.currentTarget.classList.add('opacity-50')
                  }}
                  onDragEnd={(e) => {
                    setDraggedChange(null)
                    setDraggedIndex(null)
                    setDragOverIndex(null)
                    // Remove visual feedback
                    e.currentTarget.classList.remove('opacity-50')
                  }}
                  onDragEnter={(e) => {
                    if (draggedIndex !== null && draggedIndex !== index) {
                      setDragOverIndex(index)
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDragLeave={(e) => {
                    // Only clear if we're leaving the entire card, not just moving between child elements
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      if (dragOverIndex === index) {
                        setDragOverIndex(null)
                      }
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverIndex(null)
                    
                    const sourceIndex = parseInt(e.dataTransfer.getData('source-index'))
                    
                    // If source index exists, it's a reorder within the same variant
                    if (!isNaN(sourceIndex) && sourceIndex !== index) {
                      const newChanges = [...changes]
                      const [removed] = newChanges.splice(sourceIndex, 1)
                      newChanges.splice(index, 0, removed)
                      // Type-safe way to pass reorder flag
                      ;(onChange as any)(newChanges, { isReorder: true })
                    }
                    setDraggedIndex(null)
                  }}
                  className={`
                    relative border rounded-lg cursor-move hover:shadow-md
                    ${isDisabled 
                      ? 'border-gray-200 bg-gray-50 opacity-60' 
                      : 'border-gray-300 bg-white hover:border-blue-300 hover:shadow-sm'
                    }
                    ${draggedIndex === index ? 'opacity-50 scale-95' : ''}
                    ${dragOverIndex === index && draggedIndex !== null && draggedIndex !== index 
                      ? 'border-blue-500 border-2' 
                      : ''
                    }
                    transition-all duration-200 ease-in-out
                  `}
                  style={{
                    marginTop: dragOverIndex === index && draggedIndex !== null && draggedIndex > index ? '48px' : '0',
                    marginBottom: dragOverIndex === index && draggedIndex !== null && draggedIndex < index ? '48px' : '0',
                  }}
                >
                  <div className="p-3">
                    {/* Compact Layout */}
                    <div className="flex items-start gap-2">
                      {/* Left side: Checkbox, Icon, and Actions stacked */}
                      <div className="flex flex-col items-center gap-1">
                        {/* Checkbox */}
                        <Checkbox
                          checked={change.enabled !== false}
                          onChange={() => handleToggleChange(index)}
                        />
                        
                        {/* Icon with hover tooltip */}
                        <div className="group relative">
                          <div className={`
                            p-1 rounded
                            ${isDisabled ? 'bg-gray-100' : 'bg-blue-50'}
                          `}>
                            <Icon className={`h-4 w-4 ${isDisabled ? 'text-gray-400' : 'text-blue-600'}`} />
                          </div>
                          {/* Tooltip */}
                          <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            {getChangeTypeLabel(change.type)}
                          </span>
                        </div>
                        
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteChange(index)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Selector with smaller font */}
                        <div className="mb-1.5">
                          <code className="text-xs font-mono text-gray-700">
                            {change.selector}
                          </code>
                        </div>
                        
                        {/* Change Description */}
                        <div className="text-sm">
                          {getChangeDescription(change)}
                        </div>
                      </div>
                      
                      {/* Copy button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(JSON.stringify([change], null, 2))
                            .then(() => {
                              debugLog('✅ DOM change copied to clipboard')
                            })
                            .catch(err => {
                              debugError('Failed to copy change:', err)
                            })
                        }}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors flex-shrink-0"
                        title="Copy this change"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      
                      {/* Edit button */}
                      <button
                        type="button"
                        onClick={() => handleEditChange(index)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* New DOM change form - only show when adding new change */}
      {editingChange && editingChange.index === null && (
        <div className="border-2 border-blue-500 rounded-lg p-4 space-y-4 bg-blue-50">
          <div className="flex items-center justify-between">
            <h5 className="font-medium text-gray-900">
              {editingChange.index !== null ? 'Edit' : 'Add'} DOM Change
            </h5>
            <div className="flex gap-2">
              <button
                onClick={handleSaveChange}
                className="p-1 text-green-600 hover:text-green-800"
                title="Save"
              >
                <CheckIcon className="h-5 w-5" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Cancel"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Selector field with picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Element Selector
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  value={editingChange.selector}
                  onChange={(e) => setEditingChange({ ...editingChange, selector: e.target.value })}
                  placeholder=".cta-button, #header, [data-test='submit']"
                  className={`w-full px-3 py-2 pr-10 border rounded-md text-xs font-mono bg-white ${pickingForField === 'selector' ? 'border-blue-500' : 'border-gray-300'} text-transparent caret-black`}
                  style={{ caretColor: 'black' }}
                />
                <div className="absolute inset-0 px-3 py-2 pointer-events-none text-xs font-mono overflow-hidden whitespace-nowrap">
                  {highlightCSSSelector(editingChange.selector)}
                </div>
              </div>
              <Button
                type="button"
                onClick={() => handleStartElementPicker('selector')}
                size="sm"
                variant="secondary"
                title="Pick element"
                className={pickingForField === 'selector' ? 'bg-blue-100' : ''}
              >
                🎯
              </Button>
            </div>
            {pickingForField === 'selector' && (
              <p className="text-xs text-blue-600 mt-1 animate-pulse">
                Click an element on the page...
              </p>
            )}
          </div>

          {/* Change type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Change Type
            </label>
            <select
              value={editingChange.type}
              onChange={(e) => {
                const newType = e.target.value as DOMChangeType
                debugLog('📝 Changing type to:', newType)
                const updatedChange = { ...editingChange, type: newType }
                debugLog('📝 Updated editingChange:', updatedChange)
                setEditingChange(updatedChange)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="text">Text</option>
              <option value="style">Style</option>
              <option value="class">Class</option>
              <option value="attribute">Attribute</option>
              <option value="html">HTML</option>
              <option value="javascript">JavaScript</option>
              <option value="move">Move/Reorder</option>
            </select>
          </div>

          {/* Dynamic value fields based on type */}
          {editingChange.type === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Text Content
              </label>
              <Input
                value={editingChange.textValue || ''}
                onChange={(e) => setEditingChange({ ...editingChange, textValue: e.target.value })}
                placeholder="New text content"
              />
            </div>
          )}

          {editingChange.type === 'style' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Style Properties
              </label>
              <CSSStyleEditor
                styleProperties={editingChange.styleProperties}
                onChange={(newProps) => setEditingChange({ ...editingChange, styleProperties: newProps })}
              />
            </div>
          )}

          {editingChange.type === 'class' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classes to Add
                </label>
                <MultiSelectTags
                  currentClasses={editingChange.classAdd || []}
                  onAddClass={(className) => {
                    const newClassAdd = [...(editingChange.classAdd || []), className]
                    const newClassRemove = (editingChange.classRemove || []).filter(c => c !== className)
                    setEditingChange({ 
                      ...editingChange, 
                      classAdd: newClassAdd,
                      classRemove: newClassRemove
                    })
                  }}
                  onRemoveClass={(className) => {
                    setEditingChange({
                      ...editingChange,
                      classAdd: (editingChange.classAdd || []).filter(c => c !== className)
                    })
                  }}
                  placeholder="Type class name to add and press Enter..."
                  className="bg-green-50"
                  pillColor="green"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classes to Remove
                </label>
                <MultiSelectTags
                  currentClasses={editingChange.classRemove || []}
                  onAddClass={(className) => {
                    const newClassRemove = [...(editingChange.classRemove || []), className]
                    const newClassAdd = (editingChange.classAdd || []).filter(c => c !== className)
                    setEditingChange({ 
                      ...editingChange, 
                      classRemove: newClassRemove,
                      classAdd: newClassAdd
                    })
                  }}
                  onRemoveClass={(className) => {
                    setEditingChange({
                      ...editingChange,
                      classRemove: (editingChange.classRemove || []).filter(c => c !== className)
                    })
                  }}
                  placeholder="Type class name to remove and press Enter..."
                  className="bg-red-50"
                  pillColor="red"
                />
              </div>
            </div>
          )}

          {editingChange.type === 'html' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                HTML Content
              </label>
              <textarea
                value={editingChange.htmlValue || ''}
                onChange={(e) => setEditingChange({ ...editingChange, htmlValue: e.target.value })}
                placeholder="<div>New HTML content</div>"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                rows={4}
              />
            </div>
          )}

          {editingChange.type === 'javascript' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                JavaScript Code
              </label>
              <textarea
                value={editingChange.jsValue || ''}
                onChange={(e) => setEditingChange({ ...editingChange, jsValue: e.target.value })}
                placeholder="// JavaScript code to execute"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                rows={4}
              />
            </div>
          )}

          {editingChange.type === 'move' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎯</span>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">Drag & Drop Mode</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Click the button below to enter drag-and-drop mode. You'll be able to click and drag any element to a new position.
                    </p>
                    <Button
                      type="button"
                      onClick={handleStartDragDrop}
                      size="sm"
                      variant="primary"
                      className="w-full"
                    >
                      🖱️ Start Drag & Drop
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Show captured values if we have them */}
              {(editingChange.selector || editingChange.targetSelector || editingChange.position) && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Element to Move:</span>{' '}
                    <code className="text-xs bg-white px-1 py-0.5 rounded">
                      {editingChange.selector || 'Not set'}
                    </code>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Target:</span>{' '}
                    <code className="text-xs bg-white px-1 py-0.5 rounded">
                      {editingChange.targetSelector || 'Not set'}
                    </code>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Position:</span>{' '}
                    <span className="text-gray-600">
                      {editingChange.position === 'before' ? 'Before element' :
                       editingChange.position === 'after' ? 'After element' :
                       editingChange.position === 'firstChild' ? 'As first child' :
                       editingChange.position === 'lastChild' ? 'As last child' :
                       'Not set'}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Manual input as fallback */}
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                  Manual input (advanced)
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Selector
                    </label>
                    <Input
                      value={editingChange.targetSelector || ''}
                      onChange={(e) => setEditingChange({ ...editingChange, targetSelector: e.target.value })}
                      placeholder=".container, #section, [data-role='main']"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Position
                    </label>
                    <select
                      value={editingChange.position || 'after'}
                      onChange={(e) => setEditingChange({ ...editingChange, position: e.target.value as 'before' | 'after' | 'firstChild' | 'lastChild' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="before">Before target element</option>
                      <option value="after">After target element</option>
                      <option value="firstChild">As first child of target</option>
                      <option value="lastChild">As last child of target</option>
                    </select>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Action buttons - only show if we have existing changes and not editing */}
      {changes.length > 0 && !editingChange && (
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleAddChange}
            size="sm"
            variant="secondary"
            className="flex-1"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add DOM Change
          </Button>
          <Button
            type="button"
            onClick={handleLaunchVisualEditor}
            size="sm"
            variant="primary"
            className="flex-1"
          >
            <PaintBrushIcon className="h-4 w-4 mr-1" />
            Visual Editor
          </Button>
        </div>
      )}
    </div>
  )
}
