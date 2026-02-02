import { useState, useCallback } from 'react'
import { debugLog, debugError } from '~src/utils/debug'
import { sendToContent, sendToBackground } from '~src/lib/messaging'
import { capturePageHTML } from '~src/utils/html-capture'
import { applyDOMChangeAction } from '~src/utils/dom-change-operations'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { EditingDOMChange } from '~src/components/DOMChangeEditor'
import { createEmptyChange } from '~src/components/DOMChangeEditor'

interface UseDOMChangesEditorProps {
  changes: DOMChange[]
  onChange: (changes: DOMChange[]) => void
  variantName: string
  experimentName?: string
  previewEnabled: boolean
}

export function useDOMChangesEditor({
  changes,
  onChange,
  variantName,
  experimentName,
  previewEnabled
}: UseDOMChangesEditorProps) {
  const [editingChange, setEditingChange] = useState<EditingDOMChange | null>(null)
  const [pickingForField, setPickingForField] = useState<string | null>(null)

  const handleAddChange = useCallback(() => {
    const newChange = createEmptyChange()
    debugLog('🆕 Creating new DOM change:', newChange)
    setEditingChange(newChange)
  }, [])

  const handleEditChange = useCallback((index: number) => {
    const change = changes[index]

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
        ? Object.entries(change.value as Record<string, string>).map(([key, value]) => ({
            key,
            value: value.replace(/ !important$/i, '')
          }))
        : [{ key: '', value: '' }],
      styleImportant: change.type === 'style'
        ? Object.values(change.value as Record<string, string>).some(v => v.includes('!important'))
        : false,
      styleRulesStates: change.type === 'styleRules' ? (change as any).states : undefined,
      styleRulesImportant: change.type === 'styleRules' ? (change as any).important : undefined,
      attributeProperties: change.type === 'attribute'
        ? Object.entries(change.value as Record<string, string>).map(([key, value]) => ({ key, value }))
        : [{ key: '', value: '' }],
      classAdd: change.type === 'class' ? (change.add || []) : [],
      classRemove: change.type === 'class' ? (change.remove || []) : [],
      classesWithStatus,
      targetSelector: change.type === 'move' ? (change.targetSelector || '') : '',
      position: change.type === 'move' ? (change.position || 'after') : change.type === 'insert' ? (change as any).position : 'after',
      mode: (change as any).mode || 'merge',
      waitForElement: (change as any).waitForElement,
      triggerOnView: (change as any).triggerOnView,
      persistStyle: change.type === 'style' ? (change as any).persistStyle : undefined,
      persistAttribute: change.type === 'attribute' ? (change as any).persistAttribute : undefined,
      persistScript: change.type === 'javascript' ? (change as any).persistScript : undefined,
      observerRoot: (change as any).observerRoot
    }
    setEditingChange(editing)
  }, [changes])

  const handleSaveChange = useCallback((changeToSave: EditingDOMChange) => {
    debugLog('💾 Saving change, change:', changeToSave)
    debugLog('💾 Current changes array:', changes)

    if (!changeToSave || !changeToSave.selector) {
      alert('Please enter a selector')
      return
    }

    let domChange: DOMChange

    switch (changeToSave.type) {
      case 'text':
        domChange = {
          selector: changeToSave.selector,
          type: 'text',
          value: changeToSave.textValue || '',
          waitForElement: changeToSave.waitForElement,
          triggerOnView: changeToSave.triggerOnView,
          observerRoot: changeToSave.observerRoot
        }
        break
      case 'html':
        domChange = {
          selector: changeToSave.selector,
          type: 'html',
          value: changeToSave.htmlValue || '',
          waitForElement: changeToSave.waitForElement,
          triggerOnView: changeToSave.triggerOnView,
          observerRoot: changeToSave.observerRoot
        }
        break
      case 'javascript':
        domChange = {
          selector: changeToSave.selector,
          type: 'javascript',
          value: changeToSave.jsValue || '',
          waitForElement: changeToSave.waitForElement,
          triggerOnView: changeToSave.triggerOnView,
          persistScript: changeToSave.persistScript,
          observerRoot: changeToSave.observerRoot
        }
        break
      case 'style':
        const styleValue: Record<string, string> = {}
        changeToSave.styleProperties?.forEach(({ key, value }) => {
          if (key && value) {
            const finalValue = changeToSave.styleImportant && !value.includes('!important')
              ? `${value} !important`
              : value
            styleValue[key] = finalValue
          }
        })
        domChange = {
          selector: changeToSave.selector,
          type: 'style',
          value: styleValue,
          mode: changeToSave.mode || 'merge',
          waitForElement: changeToSave.waitForElement,
          triggerOnView: changeToSave.triggerOnView,
          observerRoot: changeToSave.observerRoot
        }
        break
      case 'styleRules':
        domChange = {
          selector: changeToSave.selector,
          type: 'styleRules',
          states: changeToSave.styleRulesStates || {},
          important: changeToSave.styleRulesImportant,
          waitForElement: changeToSave.waitForElement,
          triggerOnView: changeToSave.triggerOnView,
          observerRoot: changeToSave.observerRoot
        } as any
        break
      case 'attribute':
        const attrValue: Record<string, string> = {}
        changeToSave.attributeProperties?.forEach(({ key, value }) => {
          if (key && value) attrValue[key] = value
        })
        domChange = {
          selector: changeToSave.selector,
          type: 'attribute',
          value: attrValue,
          mode: changeToSave.mode || 'merge',
          waitForElement: changeToSave.waitForElement,
          triggerOnView: changeToSave.triggerOnView,
          observerRoot: changeToSave.observerRoot
        }
        break
      case 'class':
        domChange = {
          selector: changeToSave.selector,
          type: 'class',
          add: changeToSave.classAdd?.filter(c => c) || [],
          remove: changeToSave.classRemove?.filter(c => c) || [],
          mode: changeToSave.mode || 'merge',
          waitForElement: changeToSave.waitForElement,
          triggerOnView: changeToSave.triggerOnView,
          observerRoot: changeToSave.observerRoot
        }
        break
      case 'move':
        domChange = {
          selector: changeToSave.selector,
          type: 'move',
          targetSelector: changeToSave.targetSelector || '',
          position: changeToSave.position || 'after',
          waitForElement: changeToSave.waitForElement,
          triggerOnView: changeToSave.triggerOnView,
          observerRoot: changeToSave.observerRoot
        }
        break
      case 'remove':
        domChange = {
          selector: changeToSave.selector,
          type: 'remove',
          waitForElement: changeToSave.waitForElement,
          triggerOnView: changeToSave.triggerOnView,
          observerRoot: changeToSave.observerRoot
        }
        break
      case 'insert':
        domChange = {
          selector: changeToSave.selector,
          type: 'insert',
          html: changeToSave.htmlValue || '',
          position: changeToSave.position || 'after',
          waitForElement: changeToSave.waitForElement,
          triggerOnView: changeToSave.triggerOnView,
          observerRoot: changeToSave.observerRoot
        }
        break
      default:
        return
    }

    if (changeToSave.index !== null) {
      const newChanges = [...changes]
      newChanges[changeToSave.index] = domChange
      debugLog('💾 Updating existing change at index', changeToSave.index, 'newChanges:', newChanges)
      onChange(newChanges)
    } else {
      const newChanges = [...changes, domChange]
      debugLog('💾 Adding new change to array, newChanges:', newChanges)
      onChange(newChanges)
    }

    setEditingChange(null)
  }, [changes, onChange])

  const handleCancelEdit = useCallback(() => {
    setEditingChange(null)
    setPickingForField(null)
  }, [])

  const handleDeleteChange = useCallback((index: number) => {
    debugLog('🗑️ Deleting DOM change at index:', index)
    const deletedChange = changes[index]
    debugLog('🗑️ Change being deleted:', deletedChange)

    const newChanges = changes.filter((_, i) => i !== index)
    debugLog('📝 New changes array after deletion:', newChanges)

    onChange(newChanges)
    debugLog('💾 onChange called with updated changes - should save to storage')
  }, [changes, onChange])

  const handleToggleChange = useCallback((index: number) => {
    const newChanges = [...changes]
    const wasDisabled = newChanges[index].disabled === true
    newChanges[index] = { ...newChanges[index], disabled: !wasDisabled }
    debugLog('🔄 Toggle change:', {
      index,
      selector: newChanges[index].selector,
      wasDisabled,
      isNowDisabled: newChanges[index].disabled,
      allChanges: newChanges
    })
    onChange(newChanges)

    if (previewEnabled && experimentName && variantName) {
      const enabledChanges = newChanges.filter(c => !c.disabled)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'update',
            changes: enabledChanges,
            experimentName: experimentName,
            variantName: variantName
          })
        }
      })
    }
  }, [changes, onChange, previewEnabled, experimentName, variantName])

  const handleReorderChanges = useCallback((newChanges: DOMChange[]) => {
    onChange(newChanges)
  }, [onChange])

  const handleStartElementPicker = useCallback(async (field: string) => {
    debugLog('Starting element picker for field:', field)
    setPickingForField(field)

    try {
      const msg = {
        type: 'START_ELEMENT_PICKER',
        fieldId: field
      }
      console.log('[useDOMChangesEditor] SENDING START_ELEMENT_PICKER with fieldId:', msg)
      await sendToContent(msg)
    } catch (error) {
      debugError('Error starting element picker:', error)
      alert('Element picker cannot run on this page.\n\nPlease navigate to a regular website and try again.')
      setPickingForField(null)
    }
  }, [])

  const handleAIGenerate = useCallback(async (
    prompt: string,
    images?: string[],
    conversationSession?: import('~src/types/absmartly').ConversationSession | null
  ): Promise<AIDOMGenerationResult> => {
    try {
      console.log('[AI Generate] 🤖 Starting generation, prompt:', prompt, 'images count:', images?.length || 0)
      debugLog('🤖 Generating DOM changes with AI, prompt:', prompt, 'images:', images?.length || 0)

      console.log('[AI Generate] Using API key from environment...')
      const apiKey = process.env.PLASMO_PUBLIC_ANTHROPIC_API_KEY || "***REMOVED_API_KEY***"

      console.log('[AI Generate] Has API key:', !!apiKey, 'API key length:', apiKey?.length)
      if (!apiKey) {
        console.error('[AI Generate] No API key found!')
        throw new Error('Anthropic API key not configured. Please add it in Settings.')
      }

      let html: string | undefined
      let pageUrl: string | undefined
      let domStructure: string | undefined

      if (conversationSession?.htmlSent) {
        console.log('[AI Generate] Session already has HTML sent, skipping capture')
        html = undefined
        pageUrl = conversationSession.pageUrl
        domStructure = undefined
      } else {
        console.log('[AI Generate] ===== About to call capturePageHTML =====')

        try {
          console.log('[AI Generate] Calling capturePageHTML()...')
          const captureResult = await capturePageHTML()
          html = captureResult.html
          pageUrl = captureResult.url
          domStructure = captureResult.domStructure
          console.log('[AI Generate] capturePageHTML completed, HTML length:', html?.length, 'url:', pageUrl, 'structure lines:', domStructure?.split('\n').length)
        } catch (callError) {
          console.error('[AI Generate] capturePageHTML() call threw:', callError)
          throw callError
        }
      }

      console.log('[AI Generate] Sending message to background script...')
      console.log('[AI Generate] Session:', conversationSession?.id || 'null')
      console.log('[AI Generate] Page URL:', pageUrl)
      const response = await sendToBackground({
        type: 'AI_GENERATE_DOM_CHANGES',
        html,
        prompt,
        apiKey,
        images,
        currentChanges: changes,
        conversationSession: conversationSession || null,
        pageUrl,
        domStructure
      })

      console.log('[AI Generate] Response received:', JSON.stringify(response, null, 2))
      console.log('[AI Generate] Response keys:', Object.keys(response || {}))
      console.log('[AI Generate] Response.success:', response?.success)
      console.log('[AI Generate] Response.result:', response?.result ? 'present' : 'MISSING')
      console.log('[AI Generate] Response.error:', response?.error)

      if (!response) {
        console.error('[AI Generate] ❌ No response received from background!')
        throw new Error('No response received from background')
      }

      if (!response.success) {
        console.error('[AI Generate] ❌ Response failed:', response.error)
        console.error('[AI Generate] Error type:', typeof response.error)
        console.error('[AI Generate] Error keys:', response.error ? Object.keys(response.error) : 'null')

        let errorMsg = 'Failed to generate DOM changes'
        try {
          if (typeof response.error === 'string') {
            // Try to parse as JSON to extract nested error message
            try {
              const parsed = JSON.parse(response.error)
              if (parsed.error?.message) {
                errorMsg = parsed.error.message
              } else if (parsed.message) {
                errorMsg = parsed.message
              } else if (parsed.error?.error?.message) {
                errorMsg = parsed.error.error.message
              } else {
                errorMsg = response.error
              }
            } catch {
              // Not JSON, use as is
              errorMsg = response.error
            }
          } else if (response.error && typeof response.error === 'object') {
            errorMsg = response.error.message || String(response.error)
          }
        } catch (e) {
          console.error('[AI Generate] Error extracting error message:', e)
        }

        throw new Error(errorMsg)
      }

      if (!response.result) {
        console.error('[AI Generate] ❌ Response missing result property!', response)
        throw new Error('Invalid response: missing result property')
      }

      const result = response.result as AIDOMGenerationResult

      if (!result.domChanges) {
        console.error('[AI Generate] ❌ Result missing domChanges!', result)
        throw new Error('Invalid result: missing domChanges property')
      }

      if (!Array.isArray(result.domChanges)) {
        console.error('[AI Generate] ❌ Result.domChanges is not an array!', typeof result.domChanges, result.domChanges)
        throw new Error(`Invalid result: domChanges must be an array, got ${typeof result.domChanges}`)
      }

      console.log('[AI Generate] ✅ Result received with action:', result.action, 'changes:', result.domChanges.length)
      debugLog('✅ Result received with action:', result.action, 'changes:', result.domChanges.length)

      console.log('[AI Generate] Current changes count:', changes.length)
      const updatedChanges = applyDOMChangeAction(changes, result)
      console.log('[AI Generate] Updated changes count after', result.action, ':', updatedChanges.length)
      console.log('[AI Generate] Calling onChange...')
      onChange(updatedChanges)

      console.log('[AI Generate] ✅ AI-generated changes applied successfully')
      debugLog('✅ AI-generated changes applied successfully')

      if (response.session) {
        console.log('[AI Generate] Session returned from background:', response.session.id)
        return { ...result, session: response.session }
      }

      return result
    } catch (error) {
      console.error('[AI Generate] ❌ AI generation failed:', error)
      debugError('❌ AI generation failed:', error)
      throw error
    }
  }, [changes, onChange])

  return {
    editingChange,
    pickingForField,
    setEditingChange,
    setPickingForField,
    handleAddChange,
    handleEditChange,
    handleSaveChange,
    handleCancelEdit,
    handleDeleteChange,
    handleToggleChange,
    handleReorderChanges,
    handleStartElementPicker,
    handleAIGenerate
  }
}
