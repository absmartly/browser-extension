import { useEffect } from 'react'
import { debugLog, debugWarn } from '~src/utils/debug'
import { sessionStorage } from '~src/utils/storage'
import type { DOMChangesInlineState, ElementPickerResult, DragDropResult, VisualEditorChanges } from '~src/types/storage-state'
import type { EditingDOMChange } from '~src/components/DOMChangeEditor'
import type { DOMChange } from '~src/types/dom-changes'
import type { ChromeMessage } from '~src/types/messages'

interface UseEditorStateRestorationProps {
  variantName: string
  changes: DOMChange[]
  onChange: (changes: DOMChange[]) => void
  setEditingChange: (change: EditingDOMChange | null) => void
  setPickingForField: (field: string | null) => void
  editingChange: EditingDOMChange | null
  pickingForField: string | null
}

export function useEditorStateRestoration({
  variantName,
  changes,
  onChange,
  setEditingChange,
  setPickingForField,
  editingChange,
  pickingForField
}: UseEditorStateRestorationProps) {

  useEffect(() => {
    const storage = sessionStorage

    storage.get<DOMChangesInlineState>('domChangesInlineState').then(async (result) => {
      debugLog('Checking for saved DOM Changes inline state, variantName:', variantName)
      debugLog('Retrieved state:', result)

      if (result && result.variantName === variantName) {
        debugLog('Restoring DOM Changes inline state:', result)
        debugLog('Was in dragDropMode?', result.dragDropMode)

        setEditingChange(result.editingChange)
        setPickingForField(result.pickingForField)

        const pickerResult = await storage.get<ElementPickerResult>('elementPickerResult')
        if (pickerResult && pickerResult.variantName === variantName && pickerResult.selector) {
          debugLog('Applying element picker result:', pickerResult)

          if (pickerResult.fieldId === 'selector' && result.editingChange) {
            setEditingChange({ ...result.editingChange, selector: pickerResult.selector })
          } else if (pickerResult.fieldId === 'targetSelector' && result.editingChange) {
            setEditingChange({ ...result.editingChange, targetSelector: pickerResult.selector })
          } else if (pickerResult.fieldId === 'observerRoot' && result.editingChange) {
            setEditingChange({ ...result.editingChange, observerRoot: pickerResult.selector })
          }

          storage.remove('elementPickerResult')
        }

        const dragDropResult = await storage.get<DragDropResult>('dragDropResult')
        debugLog('Checking for drag-drop result:', dragDropResult)
        debugLog('Current editingChange from state:', result.editingChange)

        if (dragDropResult && dragDropResult.variantName === variantName) {
          debugLog('Applying drag-drop result:', dragDropResult)
          debugLog('Variant names match:', dragDropResult.variantName, '===', variantName)

          if (result.editingChange) {
            const updatedChange = {
              ...result.editingChange,
              selector: dragDropResult.selector,
              targetSelector: dragDropResult.targetSelector,
              position: dragDropResult.position
            }
            debugLog('Updated editingChange with drag-drop result:', updatedChange)
            debugLog('Setting editingChange state to:', updatedChange)
            setEditingChange(updatedChange)

            setTimeout(() => {
              debugLog('🔄 Force checking editingChange after setEditingChange:', editingChange)
              setEditingChange(updatedChange)
            }, 100)
          } else {
            debugWarn('No editingChange found in restored state, cannot apply drag-drop result')
          }

          await storage.remove('dragDropResult')
          debugLog('Cleared dragDropResult from storage')
        } else {
          debugLog('Drag-drop result not applicable:',
            'variantName match:', dragDropResult?.variantName === variantName,
            'dragDropResult exists:', !!dragDropResult)
        }

        if (!result.dragDropMode || dragDropResult) {
          debugLog('Clearing domChangesInlineState')
          storage.remove('domChangesInlineState')
        } else {
          debugLog('Keeping domChangesInlineState for drag-drop completion')
        }
      }

      const visualEditorResult = await storage.get<VisualEditorChanges>('visualEditorChanges')
      debugLog('💾 visualEditorChanges:', visualEditorResult)
      if (visualEditorResult && visualEditorResult.variantName === variantName) {
        debugLog('Found visual editor changes for this variant!')
        if (visualEditorResult.changes && visualEditorResult.changes.length > 0) {
          const merged = [...changes]
          for (const change of visualEditorResult.changes) {
            const existingIndex = merged.findIndex(c =>
              c.type === change.type && c.selector === change.selector
            )
            if (existingIndex >= 0) {
              merged[existingIndex] = change
            } else {
              merged.push(change)
            }
          }
          onChange(merged)

          storage.remove('visualEditorChanges')
        }
      }
    })
  }, [variantName])

  useEffect(() => {
    const handleElementSelected = (message: ChromeMessage, sender: any, sendResponse: any) => {
      debugLog('[useEditorStateRestoration] RECEIVED ELEMENT_SELECTED, pickingForField:', pickingForField)
      debugLog('DOMChangesInlineEditor received message:', message)
      if (message.type === 'ELEMENT_SELECTED' && 'selector' in message && message.selector) {
        const storage = sessionStorage
        debugLog('[useEditorStateRestoration] Using pickingForField as fieldId:', pickingForField)

        const pickerResult = {
          variantName,
          fieldId: pickingForField,
          selector: message.selector
        }

        storage.set('elementPickerResult', pickerResult)
        debugLog('[useEditorStateRestoration] Stored to sessionStorage:', pickerResult)

        // Also apply immediately
        if (pickingForField && editingChange) {
          debugLog('[useEditorStateRestoration] Applying picker result immediately to field:', pickingForField)
          if (pickingForField === 'selector') {
            setEditingChange({ ...editingChange, selector: message.selector })
          } else if (pickingForField === 'targetSelector') {
            setEditingChange({ ...editingChange, targetSelector: message.selector })
          } else if (pickingForField === 'observerRoot') {
            setEditingChange({ ...editingChange, observerRoot: message.selector })
          }
        }

        sendResponse({ success: true })
        chrome.runtime.onMessage.removeListener(handleElementSelected)
      }
      return false
    }

    chrome.runtime.onMessage.addListener(handleElementSelected)
    return () => {
      chrome.runtime.onMessage.removeListener(handleElementSelected)
    }
  }, [variantName, pickingForField, editingChange])

  useEffect(() => {
    debugLog('📡 Setting up drag-drop listener for variant:', variantName)

    const handleDragDropComplete = async (message: ChromeMessage) => {
      if (message.type === 'DRAG_DROP_COMPLETE' && 'selector' in message && 'targetSelector' in message && 'position' in message) {
        debugLog('📡 Received drag-drop message in DOMChangesInlineEditor:', message)

        const storage = sessionStorage
        const dragDropData = {
          variantName,
          selector: message.selector as string,
          targetSelector: message.targetSelector as string,
          position: message.position as 'before' | 'after' | 'inside'
        }
        debugLog('Storing drag-drop result:', dragDropData)

        await storage.set('dragDropResult', dragDropData)

        const verification = await storage.get('dragDropResult')
        debugLog('Verification - drag-drop result stored:', verification)
      }
    }

    chrome.runtime.onMessage.addListener(handleDragDropComplete)
    return () => {
      chrome.runtime.onMessage.removeListener(handleDragDropComplete)
    }
  }, [variantName])
}
