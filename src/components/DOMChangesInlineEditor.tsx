import React, { useState, useEffect } from 'react'
import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Checkbox } from './ui/Checkbox'
import { MultiSelectTags } from './ui/MultiSelectTags'
import type { DOMChange, DOMChangeType } from '~src/types/dom-changes'
import { PencilIcon, TrashIcon, PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'

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
  jsValue: ''
})

export function DOMChangesInlineEditor({ 
  variantName, 
  changes, 
  onChange, 
  previewEnabled,
  onPreviewToggle
}: DOMChangesInlineEditorProps) {
  const [editingChange, setEditingChange] = useState<EditingDOMChange | null>(null)
  const [pickingForField, setPickingForField] = useState<string | null>(null)

  // Restore state when component mounts
  useEffect(() => {
    const storage = new Storage({ area: "session" })
    
    // First restore the editing state
    storage.get('domChangesInlineState').then(async (result) => {
      if (result && result.variantName === variantName) {
        console.log('Restoring DOM Changes inline state:', result)
        setEditingChange(result.editingChange)
        setPickingForField(result.pickingForField)
        
        // Then check for element picker result
        const pickerResult = await storage.get('elementPickerResult')
        if (pickerResult && pickerResult.variantName === variantName && pickerResult.selector) {
          console.log('Applying element picker result:', pickerResult)
          
          // Apply the selected element to the restored editing state
          if (pickerResult.fieldId === 'selector' && result.editingChange) {
            setEditingChange({ ...result.editingChange, selector: pickerResult.selector })
          }
          
          // Clear the picker result
          storage.remove('elementPickerResult')
        }
        
        // Clear the inline state after using it
        storage.remove('domChangesInlineState')
      }
    })
  }, [variantName])

  // Listen for element selection
  useEffect(() => {
    const handleElementSelected = (message: any) => {
      console.log('DOMChangesInlineEditor received message:', message)
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

  const handleStartElementPicker = async (fieldId: string) => {
    setPickingForField(fieldId)
    
    // Save current state before picker starts
    const storage = new Storage({ area: "session" })
    await storage.set('domChangesInlineState', {
      variantName,
      editingChange,
      pickingForField: fieldId
    })
    
    // Popup state will be handled by the parent component's effect
    // We just need to ensure our state is saved before closing
    
    // Start element picker
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        const tabId = tabs[0].id
        
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          })
        } catch (err) {
          console.log('Content script might already be injected:', err)
        }
        
        // Send message to start element picker
        chrome.tabs.sendMessage(tabId, { 
          type: 'START_ELEMENT_PICKER',
          fromPopup: true
        })
        
        // Close the popup after a brief delay to ensure message is sent
        setTimeout(() => {
          window.close()
        }, 100)
      }
    })
  }

  const handleToggleChange = (index: number) => {
    const newChanges = [...changes]
    newChanges[index] = { ...newChanges[index], enabled: !newChanges[index].enabled }
    onChange(newChanges)
  }

  const handleDeleteChange = (index: number) => {
    const newChanges = changes.filter((_, i) => i !== index)
    onChange(newChanges)
  }

  const handleAddChange = () => {
    setEditingChange(createEmptyChange())
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
      htmlValue: change.type === 'html' ? change.value : '',
      jsValue: change.type === 'javascript' ? change.value : '',
      styleProperties: change.type === 'style' 
        ? Object.entries(change.value as Record<string, string>).map(([key, value]) => ({ key, value }))
        : [{ key: '', value: '' }],
      attributeProperties: change.type === 'attribute'
        ? Object.entries(change.value as Record<string, string>).map(([key, value]) => ({ key, value }))
        : [{ key: '', value: '' }],
      classAdd: change.type === 'class' ? (change.add || []) : [],
      classRemove: change.type === 'class' ? (change.remove || []) : [],
      classesWithStatus
    }
    setEditingChange(editing)
  }

  const handleSaveChange = () => {
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
          enabled: true 
        }
        break
      case 'html':
        domChange = { 
          selector: editingChange.selector, 
          type: 'html', 
          value: editingChange.htmlValue || '', 
          enabled: true 
        }
        break
      case 'javascript':
        domChange = { 
          selector: editingChange.selector, 
          type: 'javascript', 
          value: editingChange.jsValue || '', 
          enabled: true 
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
          enabled: true 
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
          enabled: true 
        }
        break
      case 'class':
        domChange = { 
          selector: editingChange.selector, 
          type: 'class', 
          add: editingChange.classAdd?.filter(c => c) || [], 
          remove: editingChange.classRemove?.filter(c => c) || [],
          enabled: true 
        }
        break
      default:
        return
    }

    if (editingChange.index !== null) {
      const newChanges = [...changes]
      newChanges[editingChange.index] = domChange
      onChange(newChanges)
    } else {
      onChange([...changes, domChange])
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

  const getChangeDescription = (change: DOMChange): string => {
    switch (change.type) {
      case 'text':
        return `"${change.value}"`
      case 'style':
        return Object.entries(change.value).map(([k, v]) => `${k}: ${v}`).join(', ')
      case 'class':
        const parts = []
        if (change.add?.length) parts.push(`+${change.add.join(', ')}`)
        if (change.remove?.length) parts.push(`-${change.remove.join(', ')}`)
        return parts.join(' ')
      case 'attribute':
        return Object.entries(change.value).map(([k, v]) => `${k}="${v}"`).join(', ')
      case 'html':
        return 'HTML content'
      case 'javascript':
        return 'JavaScript code'
      default:
        return 'Unknown change'
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">DOM Changes</h4>
        <div className="flex items-center gap-2">
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

      {/* Existing changes list */}
      <div className="border border-gray-200 rounded-md divide-y divide-gray-200">
        {changes.length === 0 && !editingChange ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No DOM changes configured
          </div>
        ) : (
          <>
            {changes.map((change, index) => (
              <div key={index} className="p-3 flex items-center gap-3">
                <Checkbox
                  checked={change.enabled !== false}
                  onChange={() => handleToggleChange(index)}
                />
                <div className="flex-1 text-sm">
                  <span className="font-mono text-gray-900">{change.selector}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="text-gray-700">{change.type}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="text-gray-600">{getChangeDescription(change)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditChange(index)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteChange(index)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Inline editing form */}
      {editingChange && (
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
              <Input
                value={editingChange.selector}
                onChange={(e) => setEditingChange({ ...editingChange, selector: e.target.value })}
                placeholder=".cta-button, #header, [data-test='submit']"
                className={`flex-1 ${pickingForField === 'selector' ? 'border-blue-500' : ''}`}
              />
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
              onChange={(e) => setEditingChange({ ...editingChange, type: e.target.value as DOMChangeType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="text">Text</option>
              <option value="style">Style</option>
              <option value="class">Class</option>
              <option value="attribute">Attribute</option>
              <option value="html">HTML</option>
              <option value="javascript">JavaScript</option>
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
              <div className="space-y-2">
                {editingChange.styleProperties?.map((prop, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={prop.key}
                      onChange={(e) => {
                        const newProps = [...(editingChange.styleProperties || [])]
                        newProps[index].key = e.target.value
                        setEditingChange({ ...editingChange, styleProperties: newProps })
                      }}
                      placeholder="Property (e.g., color)"
                      className="flex-1"
                    />
                    <Input
                      value={prop.value}
                      onChange={(e) => {
                        const newProps = [...(editingChange.styleProperties || [])]
                        newProps[index].value = e.target.value
                        setEditingChange({ ...editingChange, styleProperties: newProps })
                      }}
                      placeholder="Value (e.g., #ff0000)"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newProps = editingChange.styleProperties?.filter((_, i) => i !== index) || []
                        setEditingChange({ ...editingChange, styleProperties: newProps })
                      }}
                      className="p-2 text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={() => {
                    const newProps = [...(editingChange.styleProperties || []), { key: '', value: '' }]
                    setEditingChange({ ...editingChange, styleProperties: newProps })
                  }}
                  size="sm"
                  variant="secondary"
                  className="w-full"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Property
                </Button>
              </div>
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
        </div>
      )}

      {/* Add button */}
      {!editingChange && (
        <Button
          type="button"
          onClick={handleAddChange}
          size="sm"
          variant="secondary"
          className="w-full"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add DOM Change
        </Button>
      )}
    </div>
  )
}