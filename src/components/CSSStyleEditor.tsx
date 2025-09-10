import React, { useState, useEffect, useRef } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import { all as knownCSSProperties } from 'known-css-properties'

const cssPropertyNames = knownCSSProperties.map(p => p.property)

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

// DevTools-style CSS editor component with autocomplete
export const CSSStyleEditor = ({ 
  styleProperties, 
  onChange,
  pseudoState
}: { 
  styleProperties: Array<{ key: string; value: string }> | undefined,
  onChange: (properties: Array<{ key: string; value: string }>) => void,
  pseudoState?: 'normal' | 'hover' | 'active' | 'focus'
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

  const getSelectorDisplay = () => {
    if (!pseudoState || pseudoState === 'normal') {
      return 'element.style'
    }
    return `element:${pseudoState}`
  }

  return (
    <div className="bg-gray-900 text-gray-100 rounded-md font-mono text-xs relative max-w-full overflow-visible">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 text-gray-400">
        {getSelectorDisplay()} {'{'}
      </div>
      
      {/* Properties */}
      <div className="py-1">
        {(styleProperties || []).map((prop, index) => (
          <div 
            key={index} 
            className="flex items-center hover:bg-gray-800 group px-3 py-1 relative pr-8"
          >
            {/* Property inputs container */}
            <div className="flex items-center flex-1 mr-2 min-w-0">
              {/* Property name - with constrained width */}
              <div className="flex-shrink-0 max-w-[40%] min-w-[80px]">
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
                  className="bg-transparent outline-none text-cyan-400 placeholder-gray-600 w-full overflow-hidden text-ellipsis"
                />
              </div>
              <span className="text-gray-500 px-1 flex-shrink-0">:</span>
              
              {/* Property value - with overflow handling */}
              <div className="flex-1 min-w-0">
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
                  className="bg-transparent outline-none text-orange-400 placeholder-gray-600 w-full overflow-hidden text-ellipsis"
                />
              </div>
              <span className="text-gray-500 px-1 flex-shrink-0">;</span>
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