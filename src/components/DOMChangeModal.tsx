import React, { useState, useEffect } from 'react'
import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { DOMChange, DOMChangeType } from '~src/types/dom-changes'
import { DOM_CHANGE_TEMPLATES } from '~src/types/dom-changes'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

interface DOMChangeModalProps {
  change?: DOMChange | null
  onSave: (change: DOMChange) => void
  onClose: () => void
}

export function DOMChangeModal({ change, onSave, onClose }: DOMChangeModalProps) {
  const [selector, setSelector] = useState(change?.selector || '')
  const [changeType, setChangeType] = useState<DOMChangeType>(change?.type || 'style')
  const [textValue, setTextValue] = useState('')
  const [htmlValue, setHtmlValue] = useState('')
  const [jsValue, setJsValue] = useState('')
  const [styleProperties, setStyleProperties] = useState<Array<{ key: string; value: string }>>([])
  const [attributeProperties, setAttributeProperties] = useState<Array<{ key: string; value: string }>>([])
  const [classAdd, setClassAdd] = useState<string[]>([])
  const [classRemove, setClassRemove] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [isPickingElement, setIsPickingElement] = useState(false)

  useEffect(() => {
    // Check for saved state from element picker
    const storage = new Storage({ area: "session" })
    storage.get('domChangeModalState').then(result => {
      if (result) {
        const state = result
        console.log('Restoring modal state:', state)
        
        if (state.selectedSelector) {
          setSelector(state.selectedSelector)
        }
        if (state.type) setChangeType(state.type)
        if (state.textValue) setTextValue(state.textValue)
        if (state.htmlValue) setHtmlValue(state.htmlValue)
        if (state.jsValue) setJsValue(state.jsValue)
        if (state.styleProperties) setStyleProperties(state.styleProperties)
        if (state.attributeProperties) setAttributeProperties(state.attributeProperties)
        if (state.classAdd) setClassAdd(state.classAdd)
        if (state.classRemove) setClassRemove(state.classRemove)
        if (state.isPickingElement) setIsPickingElement(state.isPickingElement)
        
        // Clear the state after using it
        storage.remove('domChangeModalState')
      } else if (change) {
        // Use the passed change prop
        setSelector(change.selector)
        setChangeType(change.type)

        switch (change.type) {
          case 'text':
            setTextValue(change.value)
            break
          case 'html':
            setHtmlValue(change.value)
            break
          case 'javascript':
            setJsValue(change.value)
            break
          case 'style':
            setStyleProperties(Object.entries(change.value).map(([key, value]) => ({ key, value })))
            break
          case 'attribute':
            setAttributeProperties(Object.entries(change.value).map(([key, value]) => ({ key, value })))
            break
          case 'class':
            setClassAdd(change.add || [])
            setClassRemove(change.remove || [])
            break
        }
      }
    })
  }, [change])

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = DOM_CHANGE_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setChangeType(template.type)
      if (template.type === 'style' && template.value) {
        setStyleProperties(Object.entries(template.value as Record<string, string>).map(([key, value]) => ({ key, value })))
      }
    }
  }

  const handleElementPicker = async () => {
    setIsPickingElement(true)
    
    // Save current state before starting element picker
    const currentState = {
      selectedSelector: selector,
      type: changeType,
      textValue,
      htmlValue,
      jsValue,
      styleProperties,
      attributeProperties,
      classAdd,
      classRemove,
      isPickingElement: true
    }
    
    try {
      const storage = new Storage({ area: "session" })
      await storage.set('domChangeModalState', currentState)
      console.log('Saved modal state before element picker:', currentState)
    } catch (err) {
      console.error('Failed to save modal state:', err)
    }
    
    // Store current state and start element picker without closing popup
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        const tabId = tabs[0].id
        
        // Don't try to inject content.js - it doesn't exist and content script is already injected via manifest
        
        // Add a listener for the element selection
        const handleElementSelected = (message: any) => {
          console.log('DOMChangeModal received message:', message)
          if (message.type === 'ELEMENT_SELECTED' && message.selector) {
            console.log('Element selected in modal:', message.selector)
            // Update the stored state with the selected element
            const storage = new Storage({ area: "session" })
            storage.set('domChangeModalState', { 
              ...currentState, 
              selectedSelector: message.selector,
              isPickingElement: false 
            })
            setSelector(message.selector)
            setIsPickingElement(false)
            // Remove the listener
            chrome.runtime.onMessage.removeListener(handleElementSelected)
          }
        }
        
        // Listen for the response
        chrome.runtime.onMessage.addListener(handleElementSelected)
        
        // Send message to start element picker
        console.log('Sending START_ELEMENT_PICKER message to tab:', tabId)
        chrome.tabs.sendMessage(tabId, { 
          type: 'START_ELEMENT_PICKER',
          fromPopup: true
        }, (response) => {
          console.log('START_ELEMENT_PICKER response:', response)
        })
      }
    })
  }

  const addStyleProperty = () => {
    setStyleProperties([...styleProperties, { key: '', value: '' }])
  }

  const removeStyleProperty = (index: number) => {
    setStyleProperties(styleProperties.filter((_, i) => i !== index))
  }

  const addAttributeProperty = () => {
    setAttributeProperties([...attributeProperties, { key: '', value: '' }])
  }

  const removeAttributeProperty = (index: number) => {
    setAttributeProperties(attributeProperties.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    if (!selector) {
      alert('Please enter a selector')
      return
    }

    let domChange: DOMChange

    switch (changeType) {
      case 'text':
        domChange = { selector, type: 'text', value: textValue, enabled: true }
        break
      case 'html':
        domChange = { selector, type: 'html', value: htmlValue, enabled: true }
        break
      case 'javascript':
        domChange = { selector, type: 'javascript', value: jsValue, enabled: true }
        break
      case 'style':
        const styleValue: Record<string, string> = {}
        styleProperties.forEach(({ key, value }) => {
          if (key && value) styleValue[key] = value
        })
        domChange = { selector, type: 'style', value: styleValue, enabled: true }
        break
      case 'attribute':
        const attrValue: Record<string, string> = {}
        attributeProperties.forEach(({ key, value }) => {
          if (key && value) attrValue[key] = value
        })
        domChange = { selector, type: 'attribute', value: attrValue, enabled: true }
        break
      case 'class':
        domChange = { 
          selector, 
          type: 'class', 
          add: classAdd.filter(c => c), 
          remove: classRemove.filter(c => c),
          enabled: true 
        }
        break
      default:
        return
    }

    onSave(domChange)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-xl transition-all ${
        isPickingElement ? 'w-96' : 'w-full max-w-2xl'
      } max-h-[90vh] overflow-hidden`}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {isPickingElement ? 'Pick an element' : (change ? 'Edit DOM Change' : 'Add DOM Change')}
          </h3>
          <button
            onClick={() => {
              if (isPickingElement) {
                setIsPickingElement(false)
                // Send cancel message to content script
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                  if (tabs[0]?.id) {
                    chrome.tabs.sendMessage(tabs[0].id, { 
                      type: 'CANCEL_ELEMENT_PICKER'
                    })
                  }
                })
              } else {
                onClose()
              }
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isPickingElement ? (
            // Collapsed view when picking
            <div>
              <div className="text-center mb-4">
                <div className="animate-pulse text-blue-600 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <p className="text-gray-600">Click on any element on the page</p>
                <p className="text-sm text-gray-500 mt-1">Press ESC to cancel</p>
              </div>
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Element
                </label>
                <Input
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  placeholder="Waiting for selection..."
                  className="w-full"
                  readOnly
                />
              </div>
            </div>
          ) : (
            <>
              {/* Element Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Element Selector
                </label>
                <div className="flex gap-2">
                  <Input
                    value={selector}
                    onChange={(e) => setSelector(e.target.value)}
                    placeholder=".cta-button, #header, [data-test='submit']"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleElementPicker}
                    size="sm"
                    variant="secondary"
                    title="Pick element"
                  >
                    🎯
                  </Button>
                </div>
              </div>

              {/* Change Type */}
              <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Change Type
            </label>
            <select
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as DOMChangeType)}
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

          {/* Dynamic Value Editor */}
          {changeType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Text Content
              </label>
              <Input
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder="New text content"
              />
            </div>
          )}

          {changeType === 'style' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Style Properties
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="text-sm px-2 py-1 border border-gray-300 rounded"
                >
                  <option value="">Select template...</option>
                  {DOM_CHANGE_TEMPLATES.filter(t => t.type === 'style').map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {styleProperties.map((prop, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={prop.key}
                      onChange={(e) => {
                        const newProps = [...styleProperties]
                        newProps[index].key = e.target.value
                        setStyleProperties(newProps)
                      }}
                      placeholder="Property (e.g., color)"
                      className="flex-1"
                    />
                    <Input
                      value={prop.value}
                      onChange={(e) => {
                        const newProps = [...styleProperties]
                        newProps[index].value = e.target.value
                        setStyleProperties(newProps)
                      }}
                      placeholder="Value (e.g., #ff0000)"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeStyleProperty(index)}
                      className="p-2 text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={addStyleProperty}
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

          {changeType === 'class' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classes to Add
                </label>
                <Input
                  value={classAdd.join(' ')}
                  onChange={(e) => setClassAdd(e.target.value.split(' ').filter(c => c))}
                  placeholder="class1 class2 class3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classes to Remove
                </label>
                <Input
                  value={classRemove.join(' ')}
                  onChange={(e) => setClassRemove(e.target.value.split(' ').filter(c => c))}
                  placeholder="oldClass1 oldClass2"
                />
              </div>
            </div>
          )}

          {changeType === 'attribute' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attributes
              </label>
              <div className="space-y-2">
                {attributeProperties.map((prop, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={prop.key}
                      onChange={(e) => {
                        const newProps = [...attributeProperties]
                        newProps[index].key = e.target.value
                        setAttributeProperties(newProps)
                      }}
                      placeholder="Attribute name"
                      className="flex-1"
                    />
                    <Input
                      value={prop.value}
                      onChange={(e) => {
                        const newProps = [...attributeProperties]
                        newProps[index].value = e.target.value
                        setAttributeProperties(newProps)
                      }}
                      placeholder="Attribute value"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttributeProperty(index)}
                      className="p-2 text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={addAttributeProperty}
                  size="sm"
                  variant="secondary"
                  className="w-full"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Attribute
                </Button>
              </div>
            </div>
          )}

          {changeType === 'html' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                HTML Content
              </label>
              <textarea
                value={htmlValue}
                onChange={(e) => setHtmlValue(e.target.value)}
                placeholder="<div>New HTML content</div>"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                rows={6}
              />
            </div>
          )}

          {changeType === 'javascript' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                JavaScript Code
              </label>
              <textarea
                value={jsValue}
                onChange={(e) => setJsValue(e.target.value)}
                placeholder="// JavaScript code to execute"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                rows={6}
              />
            </div>
          )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          {isPickingElement ? (
            <Button
              type="button"
              onClick={() => {
                setIsPickingElement(false)
                // Send cancel message to content script
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                  if (tabs[0]?.id) {
                    chrome.tabs.sendMessage(tabs[0].id, { 
                      type: 'CANCEL_ELEMENT_PICKER'
                    })
                  }
                })
              }}
              variant="secondary"
              className="w-full"
            >
              Cancel Picking
            </Button>
          ) : (
            <>
              <Button
                type="button"
                onClick={onClose}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                variant="primary"
              >
                Apply Change
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}