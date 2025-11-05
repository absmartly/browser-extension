import React, { useState, useEffect, useRef } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'

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
          id={idSuffix ? `add-attribute-${idSuffix}` : undefined}
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
