import React, { useState, useEffect, useRef } from 'react'
import { debugLog } from '~src/utils/debug'
import { all as knownCSSProperties } from 'known-css-properties'
import type { DOMChangeType } from '~src/types/dom-changes'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { MultiSelectTags } from './ui/MultiSelectTags'
import { StyleRulesEditor } from './StyleRulesEditor'
import { AttributeEditor } from './AttributeEditor'
import { DOMChangeOptions } from './DOMChangeOptions'
import { CheckIcon, XMarkIcon, TrashIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { JavaScriptEditor } from '~src/visual-editor/ui/javascript-editor'
import { sendToContent } from '~src/lib/messaging'

export interface EditingDOMChange {
  index: number | null
  selector: string
  type: DOMChangeType
  textValue?: string
  styleProperties?: Array<{ key: string; value: string }>
  styleRulesStates?: {
    normal?: Record<string, string>
    hover?: Record<string, string>
    active?: Record<string, string>
    focus?: Record<string, string>
  }
  styleRulesImportant?: boolean
  styleImportant?: boolean
  classAdd?: string[]
  classRemove?: string[]
  classesWithStatus?: Array<{ name: string; action: 'add' | 'remove' }>
  attributeProperties?: Array<{ key: string; value: string }>
  htmlValue?: string
  jsValue?: string
  targetSelector?: string
  position?: 'before' | 'after' | 'firstChild' | 'lastChild'
  mode?: 'replace' | 'merge'
  waitForElement?: boolean
  observerRoot?: string
  persistStyle?: boolean
}

export const createEmptyChange = (): EditingDOMChange => ({
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

// Helper function to handle type changes and preserve styles
export const handleDOMChangeTypeChange = (
  editingChange: EditingDOMChange,
  newType: DOMChangeType
): EditingDOMChange => {
  debugLog('📝 Changing type to:', newType)
  let updatedChange = { ...editingChange, type: newType }

  // Preserve styles when switching between style and styleRules
  if (editingChange.type === 'style' && newType === 'styleRules') {
    // From style to styleRules: preserve inline styles in the normal state
    const normalStyles: Record<string, string> = {}
    if (editingChange.styleProperties) {
      editingChange.styleProperties.forEach(({ key, value }) => {
        if (key && value) {
          normalStyles[key] = value
        }
      })
    }

    updatedChange.styleRulesStates = {
      normal: normalStyles,
      hover: editingChange.styleRulesStates?.hover || {},
      active: editingChange.styleRulesStates?.active || {},
      focus: editingChange.styleRulesStates?.focus || {},
    }
  } else if (editingChange.type === 'styleRules' && newType === 'style') {
    // From styleRules to style: preserve normal state styles as inline styles
    const styleProperties: Array<{ key: string; value: string }> = []
    if (editingChange.styleRulesStates?.normal) {
      Object.entries(editingChange.styleRulesStates.normal).forEach(([key, value]) => {
        if (key && value) {
          styleProperties.push({ key, value })
        }
      })
    }

    // If no normal styles exist but we have inline styles already, keep them
    if (styleProperties.length === 0 && editingChange.styleProperties) {
      updatedChange.styleProperties = editingChange.styleProperties
    } else if (styleProperties.length > 0) {
      updatedChange.styleProperties = styleProperties
    } else {
      // Default empty property if nothing exists
      updatedChange.styleProperties = [{ key: '', value: '' }]
    }
  }

  debugLog('📝 Updated editingChange:', updatedChange)
  return updatedChange
}

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
            className="flex items-center hover:bg-gray-800 group px-3 py-1 relative pr-10"
          >
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
                const filtered = cssPropertyNames.filter(prop =>
                  currentValue ? prop.toLowerCase().startsWith(currentValue.toLowerCase()) : true
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
              className="bg-transparent outline-none text-cyan-400 placeholder-gray-600 flex-1"
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
                // Show value suggestions based on property
                const values = commonCSSValues[prop.key] || []
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
            <span className="text-gray-500">;</span>

            {/* Delete button */}
            <button
              onClick={() => handleRemoveProperty(index)}
              className="text-red-400 hover:text-red-300 ml-2"
              title="Remove property"
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

// Unified DOM Change Editor Component
export const DOMChangeEditor = ({
  editingChange: initialChange,
  variantIndex,
  onSave,
  onCancel,
  onStartPicker
}: {
  editingChange: EditingDOMChange,
  variantIndex: number,
  onSave: (change: EditingDOMChange) => void,
  onCancel: () => void,
  onStartPicker: (field: string) => void
}) => {
  const [localChange, setLocalChange] = useState<EditingDOMChange>(initialChange)
  const [pickingForField, setPickingForField] = useState<string | null>(null)

  // Update local state when prop changes
  useEffect(() => {
    setLocalChange(initialChange)
  }, [initialChange])

  // Listen for JavaScript editor save message
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'JAVASCRIPT_EDITOR_SAVE') {
        setLocalChange({ ...localChange, jsValue: message.value })
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [localChange])

  const isEditMode = localChange.index !== null
  // Create unique ID suffix using variant index and change index
  // For new changes (index === null), use 'new' as the change index
  const changeIdx = localChange.index !== null ? localChange.index : 'new'
  const idSuffix = `${variantIndex}-${changeIdx}`

  return (
    <div className="border-2 border-blue-500 rounded-lg p-4 space-y-4 bg-blue-50">
      <div className="flex items-center justify-between">
        <h5 className="font-medium text-gray-900">
          {isEditMode ? 'Edit' : 'Add'} DOM Change
        </h5>
        <div className="flex gap-2">
          <button
            onClick={() => onSave(localChange)}
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
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              id={`dom-change-selector-${idSuffix}`}
              value={localChange.selector}
              onChange={(e) => setLocalChange({ ...localChange, selector: e.target.value })}
              placeholder=".cta-button, #header, [data-test='submit']"
              className={`w-full px-3 py-2 pr-10 border rounded-md text-xs font-mono bg-white ${pickingForField === 'selector' ? 'border-blue-500' : 'border-gray-300'}`}
            />
          </div>
          <Button
            type="button"
            onClick={() => {
              setPickingForField('selector')
              onStartPicker('selector')
            }}
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
          id={`dom-change-type-${idSuffix}`}
          value={localChange.type}
          onChange={(e) => {
            const newType = e.target.value as DOMChangeType
            setLocalChange(handleDOMChangeTypeChange(localChange, newType))
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="text">Text</option>
          <option value="style">Inline Style</option>
          <option value="styleRules">Stylesheet</option>
          <option value="class">Class</option>
          <option value="attribute">Attribute</option>
          <option value="html">HTML</option>
          <option value="javascript">JavaScript</option>
          <option value="move">Move/Reorder</option>
        </select>
      </div>

      {/* Dynamic value fields based on type */}
      {localChange.type === 'text' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Text Content
          </label>
          <Input
            value={localChange.textValue || ''}
            onChange={(e) => setLocalChange({ ...localChange, textValue: e.target.value })}
            placeholder="New text content"
          />
        </div>
      )}

      {localChange.type === 'style' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Style Properties
            </label>
            {/* Mode checkbox instead of dropdown */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="merge-mode"
                checked={localChange.mode === 'merge'}
                onChange={(e) => setLocalChange({ ...localChange, mode: e.target.checked ? 'merge' : 'replace' })}
                className="mr-2"
              />
              <label htmlFor="merge-mode" className="text-sm text-gray-600">
                Merge with existing styles
              </label>
            </div>
          </div>
          <CSSStyleEditor
            styleProperties={localChange.styleProperties}
            onChange={(newProps) => setLocalChange({ ...localChange, styleProperties: newProps })}
          />

          {/* Checkboxes for important flag and lazy loading */}
          <div className="pt-2 border-t border-gray-200">
            <DOMChangeOptions
              important={localChange.styleImportant || false}
              waitForElement={localChange.waitForElement || false}
              persistStyle={localChange.persistStyle || false}
              observerRoot={localChange.observerRoot || ''}
              onImportantChange={(value) => setLocalChange({ ...localChange, styleImportant: value })}
              onWaitForElementChange={(value) => setLocalChange({ ...localChange, waitForElement: value })}
              onPersistStyleChange={(value) => setLocalChange({ ...localChange, persistStyle: value })}
              onObserverRootChange={(value) => setLocalChange({ ...localChange, observerRoot: value })}
              onStartPicker={onStartPicker}
              pickingForField={pickingForField}
              idPrefix={`style-${isEditMode ? 'edit' : 'new'}`}
            />
          </div>
        </div>
      )}

      {localChange.type === 'styleRules' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Style Rules (with pseudo-classes)
          </label>
          <StyleRulesEditor
            change={{
              selector: localChange.selector,
              type: 'styleRules',
              states: localChange.styleRulesStates || { normal: {}, hover: {}, active: {}, focus: {} },
              important: localChange.styleRulesImportant,
              waitForElement: localChange.waitForElement,
              observerRoot: localChange.observerRoot
            }}
            onChange={(change) => setLocalChange({
              ...localChange,
              styleRulesStates: change.states,
              styleRulesImportant: change.important,
              waitForElement: change.waitForElement,
              observerRoot: change.observerRoot
            })}
          />
        </div>
      )}

      {localChange.type === 'class' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              CSS Classes
            </label>
            {/* Mode checkbox instead of dropdown */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="class-merge-mode"
                checked={localChange.mode === 'merge'}
                onChange={(e) => setLocalChange({ ...localChange, mode: e.target.checked ? 'merge' : 'replace' })}
                className="mr-2"
              />
              <label htmlFor="class-merge-mode" className="text-sm text-gray-600">
                Merge with existing classes
              </label>
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Classes to Add
            </label>
            <MultiSelectTags
              currentClasses={localChange.classAdd || []}
              onAddClass={(className) => {
                const classAdd = [...(localChange.classAdd || []), className]
                setLocalChange({ ...localChange, classAdd })
              }}
              onRemoveClass={(className) => {
                const classAdd = (localChange.classAdd || []).filter(c => c !== className)
                setLocalChange({ ...localChange, classAdd })
              }}
              placeholder="Type class name and press Enter"
              pillColor="green"
            />

            <label className="block text-sm font-medium text-gray-700 mt-4">
              Classes to Remove
            </label>
            <MultiSelectTags
              currentClasses={localChange.classRemove || []}
              onAddClass={(className) => {
                const classRemove = [...(localChange.classRemove || []), className]
                setLocalChange({ ...localChange, classRemove })
              }}
              onRemoveClass={(className) => {
                const classRemove = (localChange.classRemove || []).filter(c => c !== className)
                setLocalChange({ ...localChange, classRemove })
              }}
              placeholder="Type class name and press Enter"
              pillColor="red"
            />
          </div>
        </div>
      )}

      {localChange.type === 'attribute' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Attributes
            </label>
            {/* Mode checkbox instead of dropdown */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="attr-merge-mode"
                checked={localChange.mode === 'merge'}
                onChange={(e) => setLocalChange({ ...localChange, mode: e.target.checked ? 'merge' : 'replace' })}
                className="mr-2"
              />
              <label htmlFor="attr-merge-mode" className="text-sm text-gray-600">
                Merge with existing attributes
              </label>
            </div>
          </div>
          <AttributeEditor
            attributeProperties={localChange.attributeProperties || [{ key: '', value: '' }]}
            onChange={(attrs) => setLocalChange({ ...localChange, attributeProperties: attrs })}
          />
        </div>
      )}

      {localChange.type === 'html' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            HTML Content
          </label>
          <textarea
            value={localChange.htmlValue || ''}
            onChange={(e) => setLocalChange({ ...localChange, htmlValue: e.target.value })}
            placeholder="<div>New HTML content</div>"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            rows={5}
          />
        </div>
      )}

      {localChange.type === 'javascript' && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                JavaScript Code
              </label>
              <button
                type="button"
                onClick={async () => {
                  // Send message to content script to open editor in page context
                  try {
                    await sendToContent({
                      type: 'OPEN_JAVASCRIPT_EDITOR',
                      data: {
                        value: localChange.jsValue || ''
                      }
                    })
                  } catch (error) {
                    console.error('Error opening JavaScript editor:', error)
                  }
                }}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                title="Open fullscreen editor"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                Fullscreen
              </button>
            </div>
            <textarea
              value={localChange.jsValue || ''}
              onChange={(e) => setLocalChange({ ...localChange, jsValue: e.target.value })}
              placeholder="// JavaScript code to execute
// Available context:
// - element: The selected element
// - document: Page document
// - window: Page window
// - console: For logging
// - experimentName: Experiment identifier

console.log('Hello from experiment:', experimentName);"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
              rows={6}
            />
          </div>

          {/* Wait for element checkbox and options */}
          <div className="pt-2 border-t border-gray-200">
            <DOMChangeOptions
              waitForElement={localChange.waitForElement || false}
              observerRoot={localChange.observerRoot || ''}
              onWaitForElementChange={(value) => setLocalChange({ ...localChange, waitForElement: value })}
              onObserverRootChange={(value) => setLocalChange({ ...localChange, observerRoot: value })}
              onStartPicker={onStartPicker}
              pickingForField={pickingForField}
              idPrefix={`js-${isEditMode ? 'edit' : 'new'}`}
            />
          </div>
        </div>
      )}

      {localChange.type === 'move' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Selector
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  value={localChange.targetSelector || ''}
                  onChange={(e) => setLocalChange({ ...localChange, targetSelector: e.target.value })}
                  placeholder=".target-container, #sidebar"
                  className={`w-full px-3 py-2 pr-10 border rounded-md text-xs font-mono bg-white ${pickingForField === 'targetSelector' ? 'border-blue-500' : 'border-gray-300'}`}
                />
              </div>
              <Button
                type="button"
                onClick={() => {
                  setPickingForField('targetSelector')
                  onStartPicker('targetSelector')
                }}
                size="sm"
                variant="secondary"
                title="Pick target element"
                className={pickingForField === 'targetSelector' ? 'bg-blue-100' : ''}
              >
                🎯
              </Button>
            </div>
            {pickingForField === 'targetSelector' && (
              <p className="text-xs text-blue-600 mt-1 animate-pulse">
                Click the target element...
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Position
            </label>
            <select
              value={localChange.position || 'after'}
              onChange={(e) => setLocalChange({ ...localChange, position: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="before">Before target</option>
              <option value="after">After target</option>
              <option value="firstChild">As first child</option>
              <option value="lastChild">As last child</option>
            </select>
          </div>
        </div>
      )}

      {/* Wait for element checkbox for applicable types */}
      {localChange.type !== 'style' && localChange.type !== 'styleRules' && localChange.type !== 'javascript' && (
        <div className="space-y-2 pt-2 border-t border-gray-200">
          <div className="flex items-start">
            <input
              type="checkbox"
              id={`wait-${isEditMode ? 'edit' : 'new'}`}
              checked={localChange.waitForElement || false}
              onChange={(e) => setLocalChange({ ...localChange, waitForElement: e.target.checked })}
              className="mt-1 mr-2"
            />
            <label htmlFor={`wait-${isEditMode ? 'edit' : 'new'}`} className="text-sm">
              <span className="font-medium text-gray-700">Wait for element (lazy-loaded)</span>
              <p className="text-gray-500">Apply change when element appears in DOM</p>
            </label>
          </div>

          {localChange.waitForElement && (
            <div className="ml-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observer Root (optional)
              </label>
              <Input
                value={localChange.observerRoot || ''}
                onChange={(e) => setLocalChange({ ...localChange, observerRoot: e.target.value })}
                placeholder="body, .container, #app"
                className="text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
