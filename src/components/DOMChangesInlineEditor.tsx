import React, { useState, useEffect } from 'react'
import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Checkbox } from './ui/Checkbox'
import { MultiSelectTags } from './ui/MultiSelectTags'
import type { DOMChange, DOMChangeType } from '~src/types/dom-changes'
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
  ArrowsUpDownIcon
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
  position: 'after'
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

  // Debug editingChange state changes
  useEffect(() => {
    console.log('🔄 editingChange state updated:', editingChange)
  }, [editingChange])

  // Restore state when component mounts
  useEffect(() => {
    const storage = new Storage({ area: "session" })
    
    // First restore the editing state
    storage.get('domChangesInlineState').then(async (result) => {
      console.log('Checking for saved DOM Changes inline state, variantName:', variantName)
      console.log('Retrieved state:', result)
      
      if (result && result.variantName === variantName) {
        console.log('Restoring DOM Changes inline state:', result)
        console.log('Was in dragDropMode?', result.dragDropMode)
        
        setEditingChange(result.editingChange)
        setPickingForField(result.pickingForField)
        
        // Then check for element picker result
        const pickerResult = await storage.get('elementPickerResult')
        if (pickerResult && pickerResult.variantName === variantName && pickerResult.selector) {
          console.log('Applying element picker result:', pickerResult)
          
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
        console.log('Checking for drag-drop result:', dragDropResult)
        console.log('Current editingChange from state:', result.editingChange)
        
        if (dragDropResult && dragDropResult.variantName === variantName) {
          console.log('Applying drag-drop result:', dragDropResult)
          console.log('Variant names match:', dragDropResult.variantName, '===', variantName)
          
          if (result.editingChange) {
            const updatedChange = { 
              ...result.editingChange, 
              selector: dragDropResult.selector,  // Add the source selector
              targetSelector: dragDropResult.targetSelector,
              position: dragDropResult.position 
            }
            console.log('Updated editingChange with drag-drop result:', updatedChange)
            console.log('Setting editingChange state to:', updatedChange)
            setEditingChange(updatedChange)
            
            // Force a re-render by updating a dummy state
            setTimeout(() => {
              console.log('🔄 Force checking editingChange after setEditingChange:', editingChange)
              setEditingChange(prev => {
                console.log('🔄 Previous editingChange in setState:', prev)
                return updatedChange
              })
            }, 100)
          } else {
            console.warn('No editingChange found in restored state, cannot apply drag-drop result')
          }
          
          // Clear the drag-drop result
          await storage.remove('dragDropResult')
          console.log('Cleared dragDropResult from storage')
        } else {
          console.log('Drag-drop result not applicable:', 
            'variantName match:', dragDropResult?.variantName === variantName,
            'dragDropResult exists:', !!dragDropResult)
        }
        
        // Only clear the inline state if we're not waiting for drag-drop
        if (!result.dragDropMode || dragDropResult) {
          console.log('Clearing domChangesInlineState')
          storage.remove('domChangesInlineState')
        } else {
          console.log('Keeping domChangesInlineState for drag-drop completion')
        }
      }
      
      // Also check for visual editor changes
      const visualEditorResult = await storage.get('visualEditorChanges')
      console.log('💾 visualEditorChanges:', visualEditorResult)
      if (visualEditorResult && visualEditorResult.variantName === variantName) {
        console.log('Found visual editor changes for this variant!')
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
    console.log('📡 Setting up drag-drop listener for variant:', variantName)
    
    const handleDragDropComplete = async (message: any) => {
      console.log('📡 Received message in DOMChangesInlineEditor:', message)
      
      if (message.type === 'DRAG_DROP_COMPLETE') {
        console.log('Drag-drop complete message received:', message)
        
        // Store result in session storage
        const storage = new Storage({ area: "session" })
        const dragDropData = {
          variantName,
          selector: message.selector,
          targetSelector: message.targetSelector,
          position: message.position
        }
        console.log('Storing drag-drop result:', dragDropData)
        
        await storage.set('dragDropResult', dragDropData)
        
        // Verify it was stored
        const verification = await storage.get('dragDropResult')
        console.log('Verification - drag-drop result stored:', verification)
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
      if (message.type === 'VISUAL_EDITOR_CHANGES' && message.variantName === variantName) {
        console.log('Visual editor changes received:', message.changes)
        
        // Update local changes state with visual editor changes
        if (message.changes && message.changes.length > 0) {
          setChanges(message.changes)
          
          // Store in session storage for persistence
          const storage = new Storage({ area: "session" })
          await storage.set('visualEditorChanges', {
            variantName,
            changes: message.changes
          })
        }
      }
    }
    
    chrome.runtime.onMessage.addListener(handleVisualEditorChanges)
    return () => {
      chrome.runtime.onMessage.removeListener(handleVisualEditorChanges)
    }
  }, [variantName])

  const handleLaunchVisualEditor = async () => {
    console.log('🎨 Launching Visual Editor')
    
    // Save current state
    const storage = new Storage({ area: "session" })
    await storage.set('visualEditorState', {
      variantName,
      changes,
      active: true
    })
    
    // Send message to background script to start visual editor
    console.log('🚀 Sending START_VISUAL_EDITOR message to background')
    console.log('Variant:', variantName)
    console.log('Changes:', changes)
    
    chrome.runtime.sendMessage({ 
      type: 'START_VISUAL_EDITOR',
      variantName,
      changes
    }, (response) => {
      console.log('📨 Response received from background:', response)
      if (chrome.runtime.lastError) {
        console.error('❌ Chrome runtime error:', chrome.runtime.lastError)
      } else if (response?.error) {
        console.error('❌ Error from background:', response.error)
        // Show user-friendly error
        if (response.error.includes('browser pages')) {
          alert('Visual editor cannot run on browser pages. Please navigate to a regular website.')
        }
      } else {
        console.log('✅ Visual editor started successfully:', response)
        // Close popup after a short delay
        setTimeout(() => {
          window.close()
        }, 100)
      }
    })
  }

  const handleStartDragDrop = async () => {
    console.log('Starting drag-drop picker')
    
    // Ensure we have an editingChange for move type
    const changeToSave = editingChange || {
      type: 'move',
      selector: '',
      targetSelector: '',
      position: 'after' as const,
      index: null
    }
    
    console.log('Saving state before drag-drop:', { variantName, editingChange: changeToSave })
    
    // Save current state before starting
    const storage = new Storage({ area: "session" })
    const stateToSave = {
      variantName,
      editingChange: changeToSave,
      dragDropMode: true
    }
    
    console.log('💾 Saving state for drag-drop:', stateToSave)
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
          console.error('Content scripts cannot run on this page.')
          return
        }
        
        // Send message to start drag-drop picker
        chrome.tabs.sendMessage(tabId, { 
          type: 'START_DRAG_DROP_PICKER',
          fromPopup: true
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error starting drag-drop picker:', chrome.runtime.lastError)
          } else {
            console.log('Drag-drop picker started successfully:', response)
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
    console.log('Starting element picker for field:', fieldId)
    setPickingForField(fieldId)
    
    // Save current state before picker starts
    const storage = new Storage({ area: "session" })
    await storage.set('domChangesInlineState', {
      variantName,
      editingChange,
      pickingForField: fieldId
    })
    console.log('Saved state to storage')
    
    // Popup state will be handled by the parent component's effect
    // We just need to ensure our state is saved before closing
    
    // Start element picker
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      console.log('Found tabs:', tabs)
      if (tabs[0]?.id) {
        const tabId = tabs[0].id
        const tabUrl = tabs[0].url || 'unknown'
        
        console.log('Current tab URL:', tabUrl)
        
        // Check if this is a restricted page
        if (tabUrl.startsWith('chrome://') || 
            tabUrl.startsWith('chrome-extension://') || 
            tabUrl.startsWith('edge://') ||
            tabUrl.includes('chrome.google.com/webstore')) {
          console.error('Content scripts cannot run on this page. Please try on a regular website.')
          return
        }
        
        // Send a test message first to check if content script is responding
        console.log('Sending test message to content script...')
        chrome.tabs.sendMessage(tabId, { 
          type: 'TEST_CONNECTION',
          fromPopup: true
        }, (testResponse) => {
          if (chrome.runtime.lastError) {
            console.error('Content script not responding to test:', chrome.runtime.lastError)
            console.log('Content script is not loaded. Please refresh the page and try again.')
            return
          }
          console.log('Test connection successful:', testResponse)
          
          // Now send the actual element picker message
          chrome.tabs.sendMessage(tabId, { 
            type: 'START_ELEMENT_PICKER',
            fromPopup: true
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error starting element picker:', chrome.runtime.lastError)
            } else {
              console.log('Element picker started successfully:', response)
            }
          })
        })
        
        // Close the popup after a brief delay to ensure message is sent
        setTimeout(() => {
          console.log('Closing popup window...')
          window.close()
        }, 100)
      } else {
        console.error('No active tab found!')
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
    const newChange = createEmptyChange()
    console.log('🆕 Creating new DOM change:', newChange)
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
      classesWithStatus,
      targetSelector: change.type === 'move' ? change.targetSelector : '',
      position: change.type === 'move' ? change.position : 'after'
    }
    setEditingChange(editing)
  }

  const handleSaveChange = () => {
    console.log('💾 Saving change, editingChange:', editingChange)
    console.log('💾 Current changes array:', changes)
    
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
      case 'move':
        domChange = {
          selector: editingChange.selector,
          type: 'move',
          targetSelector: editingChange.targetSelector || '',
          position: editingChange.position || 'after',
          enabled: true
        }
        break
      default:
        return
    }

    if (editingChange.index !== null) {
      const newChanges = [...changes]
      newChanges[editingChange.index] = domChange
      console.log('💾 Updating existing change at index', editingChange.index, 'newChanges:', newChanges)
      onChange(newChanges)
    } else {
      const newChanges = [...changes, domChange]
      console.log('💾 Adding new change to array, newChanges:', newChanges)
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
      default:
        return <span className="text-gray-500">Unknown change type</span>
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
              
              return (
                <div 
                  key={index} 
                  className={`
                    relative border rounded-lg transition-all
                    ${isDisabled 
                      ? 'border-gray-200 bg-gray-50 opacity-60' 
                      : 'border-gray-300 bg-white hover:border-blue-300 hover:shadow-sm'
                    }
                  `}
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
                      
                      {/* Edit button on the right */}
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
              onChange={(e) => {
                const newType = e.target.value as DOMChangeType
                console.log('📝 Changing type to:', newType)
                const updatedChange = { ...editingChange, type: newType }
                console.log('📝 Updated editingChange:', updatedChange)
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

      {/* Add button - only show if we have existing changes and not editing */}
      {changes.length > 0 && !editingChange && (
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