import { useState, useEffect, useCallback } from 'react'
import { debugLog, debugError } from '~src/utils/debug'
import { sendToContent } from '~src/lib/messaging'
import { clearVisualEditorSessionStorage } from '~src/utils/storage-cleanup'
import { sessionStorage } from '~src/utils/storage'
import type { DOMChange } from '~src/types/dom-changes'
import type { ChromeMessage } from '~src/types/messages'

let isLaunchingVisualEditor = false

interface UseVisualEditorCoordinationProps {
  variantName: string
  variantIndex: number
  experimentName?: string
  changes: DOMChange[]
  onChange: (changes: DOMChange[]) => void
  changesRef: React.MutableRefObject<DOMChange[]>
  activeVEVariant: string | null
  onVEStart: () => void
  onVEStop: () => void
  previewEnabled: boolean
  onPreviewToggle: (enabled: boolean) => void
}

export function useVisualEditorCoordination({
  variantName,
  variantIndex,
  experimentName,
  changes,
  onChange,
  changesRef,
  activeVEVariant,
  onVEStart,
  onVEStop,
  previewEnabled,
  onPreviewToggle
}: UseVisualEditorCoordinationProps) {

  useEffect(() => {
    const handleVisualEditorChanges = (message: ChromeMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
      if (message.type === 'VISUAL_EDITOR_CHANGES' && 'variantName' in message && message.variantName === variantName) {
        (async () => {
        debugLog('📡 Visual editor changes received:', 'changes' in message ? message.changes : [])

        if ('changes' in message && Array.isArray(message.changes)) {
          debugLog('📝 Merging visual editor changes with existing changes')

          const currentChanges = changesRef.current || []

          const changesMap = new Map()

          currentChanges.forEach((change, index) => {
            const key = `${change.selector}-${change.type}`
            changesMap.set(key, { ...change, originalIndex: index })
          })

          message.changes.forEach((change) => {
            const changeObj = change as DOMChange
            const key = `${changeObj.selector}-${changeObj.type}`
            changesMap.set(key, changeObj)
          })

          const mergedChanges = Array.from(changesMap.values()) as DOMChange[]
          debugLog('📝 Merged changes:', mergedChanges)

          onChange(mergedChanges)

          const storage = sessionStorage
          await storage.set('visualEditorChanges', {
            variantName,
            changes: mergedChanges
          })

          const newChangeCount = message.changes.length
          const totalChangeCount = mergedChanges.length
          const toast = document.createElement('div')
          toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-slide-in'
          toast.textContent = `✅ Added ${newChangeCount} change${newChangeCount !== 1 ? 's' : ''} from Visual Editor (Total: ${totalChangeCount})`
          document.body.appendChild(toast)
          setTimeout(() => toast.remove(), 3000)
        }
        })()
        return true
      } else if (message.type === 'VISUAL_EDITOR_CHANGES_COMPLETE' && 'variantName' in message && message.variantName === variantName) {
        (async () => {
        debugLog('✅ Visual Editor Complete - Received changes:', message)

        if ('changes' in message && Array.isArray(message.changes) && message.changes.length > 0) {
          debugLog('📝 Merging final visual editor changes with existing changes')

          const currentChanges = changesRef.current || []

          const changesMap = new Map()

          currentChanges.forEach((change, index) => {
            const key = `${change.selector}-${change.type}`
            changesMap.set(key, { ...change, originalIndex: index })
          })

          message.changes.forEach((change) => {
            const changeObj = change as DOMChange
            const key = `${changeObj.selector}-${changeObj.type}`
            changesMap.set(key, changeObj)
          })

          const mergedChanges = Array.from(changesMap.values()) as DOMChange[]
          debugLog('📝 Final merged changes:', mergedChanges)

          onChange(mergedChanges)

          const storage = sessionStorage
          await storage.set('visualEditorChanges', {
            variantName,
            changes: mergedChanges
          })

          const newChangeCount = message.changes.length
          const totalChangeCount = mergedChanges.length
          const toast = document.createElement('div')
          toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-slide-in'
          toast.textContent = `✅ Visual Editor closed - Added ${newChangeCount} change${newChangeCount !== 1 ? 's' : ''} (Total: ${totalChangeCount})`
          document.body.appendChild(toast)
          setTimeout(() => toast.remove(), 3000)
        }

        onVEStop()
        clearVisualEditorSessionStorage().catch(error => {
          debugError('Failed to clear Visual Editor session storage:', error)
        })
        })()
        return true
      } else if (message.type === 'VISUAL_EDITOR_STOPPED') {
        debugLog('🛑 Visual Editor Stopped - No changes saved')

        onVEStop()
        clearVisualEditorSessionStorage().catch(error => {
          debugError('Failed to clear Visual Editor session storage:', error)
        })
        return true
      }
    }

    console.log('[DOMChangesInlineEditor] Setting up message listeners for variant:', variantName)

    chrome.runtime.onMessage.addListener(handleVisualEditorChanges)

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data && event.data.source === 'absmartly-visual-editor') {
        handleVisualEditorChanges(event.data as ChromeMessage, {} as chrome.runtime.MessageSender, () => {})
      }
    }
    window.addEventListener('message', handleWindowMessage)

    const handleStorageChange = (changes: {[key: string]: chrome.storage.StorageChange}) => {
      if (changes.visualEditorChanges) {
        const newValue = changes.visualEditorChanges.newValue
        if (newValue && newValue.variantName === variantName) {
          void handleVisualEditorChanges({
            type: 'VISUAL_EDITOR_CHANGES',
            variantName: newValue.variantName,
            changes: newValue.changes
          }, {} as chrome.runtime.MessageSender, () => {})
        }
      }
    }

    console.log('[DOMChangesInlineEditor] Adding storage change listener')
    chrome.storage.session.onChanged.addListener(handleStorageChange)

    return () => {
      console.log('[DOMChangesInlineEditor] Cleaning up message listeners for variant:', variantName)
      chrome.runtime.onMessage.removeListener(handleVisualEditorChanges)
      window.removeEventListener('message', handleWindowMessage)
      chrome.storage.session.onChanged.removeListener(handleStorageChange)
    }
  }, [variantName])

  const handleLaunchVisualEditor = useCallback(async () => {
    try {
      console.log('[DOMChanges] 🎯 HANDLER CALLED: handleLaunchVisualEditor')
      console.log('[DOMChanges] 🎯 variantName:', variantName)
      console.log('[DOMChanges] 🎯 variantIndex:', variantIndex)
      console.log('[DOMChangesInlineEditor] 🎨 Launch requested for variant:', variantName)
      console.log('[DOMChangesInlineEditor] 🎨 activeVEVariant state:', activeVEVariant)
      console.log('[DOMChangesInlineEditor] 🎨 isLaunchingVisualEditor flag:', isLaunchingVisualEditor)

      if (activeVEVariant) {
        if (activeVEVariant === variantName) {
          console.log('[DOMChangesInlineEditor] Visual Editor already active for this variant, ignoring click')
          return
        } else {
          alert(`Visual Editor is already active for variant "${activeVEVariant}". Please close it first.`)
          return
        }
      }

      if (isLaunchingVisualEditor) {
        debugLog('⏭️ Visual Editor already launching, skipping duplicate launch for:', variantName)
        return
      }
      isLaunchingVisualEditor = true

      let tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      console.log('[DOMChanges] Initial tabs query result:', tabs.length, 'tabs')

      if (!tabs || tabs.length === 0) {
        console.log('[DOMChanges] ⚠️ No active tab found, querying all tabs as fallback')
        tabs = await chrome.tabs.query({})
        console.log('[DOMChanges] Found tabs (fallback):', tabs.length)
      }

      console.log('[DOMChanges] Using tab ID:', tabs[0]?.id)

      try {
        console.log('[DOMChangesInlineEditor] 🎨 Launching Visual Editor for variant:', variantName)
        console.log('[DOMChangesInlineEditor] Current preview state:', previewEnabled)
        console.log('[DOMChangesInlineEditor] Existing changes:', changes.length)

        console.log('[DOMChangesInlineEditor] About to call onVEStart()...')
        console.log('[DOMChangesInlineEditor] onVEStart type:', typeof onVEStart)
        console.log('[DOMChangesInlineEditor] onVEStart function:', onVEStart.toString())
        onVEStart()
        console.log('[DOMChangesInlineEditor] Called onVEStart() successfully')

        if (tabs[0]?.id) {
          try {
            await sendToContent({
              type: 'SET_VISUAL_EDITOR_STARTING',
              starting: true
            })
            console.log('[DOMChangesInlineEditor] ✅ SET_VISUAL_EDITOR_STARTING sent successfully')
          } catch (e) {
            const error = e as Error
            console.error('[DOMChangesInlineEditor] ⚠️ SET_VISUAL_EDITOR_STARTING failed (content script may not be ready yet):', error?.message)
          }
        }

      if (!previewEnabled) {
        debugLog('🔄 Enabling preview for visual editor')
        onPreviewToggle(true)
      } else {
        debugLog('✅ Preview already active with changes applied')
      }
      debugLog('Preview activation complete, starting visual editor...')

      const storage = sessionStorage
      await storage.set('visualEditorState', {
        variantName,
        changes,
        active: true
      })

      debugLog('🚀 Sending START_VISUAL_EDITOR message to content script')
      debugLog('Variant:', variantName)
      debugLog('Experiment name:', experimentName)
      debugLog('Changes:', changes)

      console.log('[DOMChanges] About to send START_VISUAL_EDITOR, tabs[0]?.id:', tabs[0]?.id)
      if (tabs[0]?.id) {
        console.log('[DOMChanges] ✅ SENDING START_VISUAL_EDITOR')
        console.log('[DOMChanges] Variant:', variantName)
        console.log('[DOMChanges] Experiment:', experimentName)
        console.log('[DOMChanges] Changes count:', changes.length)

        try {
          console.log('[DOMChanges] 📤 Sending START_VISUAL_EDITOR to content script')
          console.log('[DOMChanges] Variant:', variantName)

          const response = await sendToContent({
            type: 'START_VISUAL_EDITOR',
            variantName,
            experimentName,
            changes
          })

          console.log('[DOMChanges] 🔔 RESPONSE from content script:', JSON.stringify(response))

          if (response?.error) {
            console.error('[DOMChanges] ❌ Error from content script:', response.error)
            debugError('❌ Error from content script:', response.error)
            alert('Failed to start visual editor: ' + response.error)
          } else if (response?.success) {
            console.log('[DOMChanges] ✅ Visual editor started successfully')
            debugLog('✅ Visual editor started successfully:', response)
          } else {
            console.log('[DOMChanges] 📨 Response:', JSON.stringify(response))
          }
          isLaunchingVisualEditor = false
        } catch (e) {
          const error = e as Error
          console.error('[DOMChanges] ❌ Exception while sending to content:', error?.message)
          debugError('❌ Exception sending to content:', error?.message)
          isLaunchingVisualEditor = false
        }
      } else {
        console.error('[DOMChanges] ❌ NO ACTIVE TAB FOUND after tabs query')
        console.error('[DOMChanges] tabs array:', tabs)
        console.error('[DOMChanges] tabs.length:', tabs.length)
        debugError('❌ No active tab found')
        isLaunchingVisualEditor = false
      }
      } finally {
        setTimeout(() => {
          isLaunchingVisualEditor = false
        }, 1000)
      }
    } catch (error) {
      const err = error as Error
      console.error('[DOMChanges] ❌ FATAL ERROR in handleLaunchVisualEditor:', error)
      console.error('[DOMChanges] Error message:', err?.message)
      console.error('[DOMChanges] Error stack:', err?.stack)
      isLaunchingVisualEditor = false
    }
  }, [variantName, variantIndex, experimentName, changes, activeVEVariant, onVEStart, previewEnabled, onPreviewToggle])

  return {
    handleLaunchVisualEditor
  }
}
