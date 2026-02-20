import React, { useState, useEffect, useRef } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'

interface KeyValueEditorConfig {
  keySuggestions: string[]
  valueSuggestions?: (key: string) => string[]
  keyPlaceholder: string
  valuePlaceholder: string
  headerText: string
  separatorBefore: string
  separatorAfter: string
  separatorBeforeValue?: string
  keyClassName?: string
  valueClassName?: string
  addButtonText: string
}

interface KeyValueEditorProps {
  properties: Array<{ key: string; value: string }> | undefined
  onChange: (properties: Array<{ key: string; value: string }>) => void
  config: KeyValueEditorConfig
  idSuffix?: string
}

export const KeyValueEditor = ({
  properties,
  onChange,
  config,
  idSuffix
}: KeyValueEditorProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [activeField, setActiveField] = useState<'key' | 'value' | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [focusNewProperty, setFocusNewProperty] = useState(false)
  const propertyRefs = useRef<(HTMLInputElement | null)[]>([])

  const handlePropertyChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const newProps = [...(properties || [])]
    newProps[index][field] = newValue
    onChange(newProps)

    if (field === 'key') {
      const filtered = config.keySuggestions.filter(item =>
        item.toLowerCase().startsWith(newValue.toLowerCase())
      )
      setSuggestions(filtered.slice(0, 8))
      setShowSuggestions(filtered.length > 0)
    } else if (field === 'value' && config.valueSuggestions) {
      const propertyName = newProps[index].key
      const values = config.valueSuggestions(propertyName)
      if (values.length > 0) {
        const filtered = values.filter(val =>
          val.toLowerCase().startsWith(newValue.toLowerCase())
        )
        setSuggestions(filtered)
        setShowSuggestions(filtered.length > 0)
      } else {
        setShowSuggestions(false)
      }
    } else {
      setShowSuggestions(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: 'key' | 'value') => {
    if (field === 'value' && e.key === 'Enter' && !showSuggestions) {
      e.preventDefault()
      handleAddProperty()
      return
    }

    if (field === 'value' && e.key === 'Tab' && !showSuggestions && !e.shiftKey) {
      e.preventDefault()
      const nextIndex = index + 1
      if (nextIndex < (properties || []).length) {
        setTimeout(() => {
          const nextInput = propertyRefs.current[nextIndex]
          if (nextInput) {
            nextInput.focus()
          }
        }, 0)
      } else {
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
    onChange([...(properties || []), { key: '', value: '' }])
    setFocusNewProperty(true)
  }

  useEffect(() => {
    if (focusNewProperty) {
      const newIndex = (properties || []).length - 1
      setTimeout(() => {
        if (propertyRefs.current[newIndex]) {
          propertyRefs.current[newIndex]?.focus()
        }
      }, 50)
      setFocusNewProperty(false)
    }
  }, [properties?.length, focusNewProperty])

  const handleRemoveProperty = (index: number) => {
    const newProps = (properties || []).filter((_, i) => i !== index)
    onChange(newProps)
  }

  return (
    <div className="bg-gray-900 text-gray-100 rounded-md font-mono text-xs relative max-w-full">
      <div className="px-3 py-2 border-b border-gray-700 text-gray-400">
        {config.headerText} {'{'}
      </div>

      <div className="py-1">
        {(properties || []).map((prop, index) => (
          <div
            key={index}
            className="flex items-center hover:bg-gray-800 group px-3 py-1 relative pr-10 min-w-0"
          >
            <input
              ref={el => propertyRefs.current[index] = el}
              type="text"
              value={prop.key}
              onChange={(e) => handlePropertyChange(index, 'key', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index, 'key')}
              onFocus={() => {
                setActiveIndex(index)
                setActiveField('key')
                setSelectedSuggestion(0)
                const currentValue = prop.key || ''
                const filtered = config.keySuggestions.filter(item =>
                  currentValue ? item.toLowerCase().startsWith(currentValue.toLowerCase()) : true
                ).slice(0, 8)
                setSuggestions(filtered)
                if (filtered.length > 0) {
                  setShowSuggestions(true)
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowSuggestions(false)
                }, 200)
              }}
              placeholder={config.keyPlaceholder}
              className={config.keyClassName || "bg-transparent outline-none text-cyan-400 placeholder-gray-600 flex-1"}
            />
            <span className="text-gray-500 px-1">{config.separatorBefore}</span>

            {config.separatorBeforeValue && (
              <span className="text-gray-500">{config.separatorBeforeValue}</span>
            )}

            <div className="flex-1 min-w-0 overflow-hidden">
              <input
                type="text"
                value={prop.value}
                onChange={(e) => handlePropertyChange(index, 'value', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index, 'value')}
                onFocus={() => {
                  setActiveIndex(index)
                  setActiveField('value')
                  if (config.valueSuggestions) {
                    const values = config.valueSuggestions(prop.key)
                    if (values.length > 0) {
                      const currentValue = prop.value || ''
                      const filtered = values.filter(val =>
                        currentValue ? val.toLowerCase().startsWith(currentValue.toLowerCase()) : true
                      )
                      setSuggestions(filtered)
                      if (filtered.length > 0) {
                        setShowSuggestions(true)
                      }
                    } else {
                      setShowSuggestions(false)
                    }
                  } else {
                    setShowSuggestions(false)
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowSuggestions(false)
                  }, 200)
                }}
                placeholder={config.valuePlaceholder}
                className={config.valueClassName || "bg-transparent outline-none text-orange-400 placeholder-gray-600 flex-1 overflow-hidden text-ellipsis"}
              />
            </div>

            <span className="text-gray-500">{config.separatorAfter}</span>

            <button
              type="button"
              onClick={() => handleRemoveProperty(index)}
              className="text-red-400 hover:text-red-300 ml-2"
              title={`Remove ${config.keyPlaceholder}`}
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          </div>
        ))}

        <div
          id={idSuffix ? `add-${config.keyPlaceholder}-${idSuffix}` : undefined}
          className="flex items-center hover:bg-gray-800 cursor-pointer px-3 py-1"
          onClick={handleAddProperty}
        >
          <span className="text-gray-600">{config.addButtonText}</span>
        </div>
      </div>

      <div className="px-3 py-2 border-t border-gray-700 text-gray-400">
        {'}'}
      </div>

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
