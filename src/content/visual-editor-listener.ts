import { VisualEditor } from './visual-editor'
import type { DOMChange } from '~src/types/dom-changes'

// Keep track of the current visual editor instance
let currentEditor: VisualEditor | null = null

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Visual Editor Listener] Received message:', message.type)
  
  if (message.type === 'START_VISUAL_EDITOR') {
    console.log('[Visual Editor Listener] Starting visual editor with variant:', message.variantName)
    
    try {
      // Stop any existing editor
      if (currentEditor) {
        currentEditor.destroy()
        currentEditor = null
      }
      
      // Create and start new editor
      currentEditor = new VisualEditor({
        variantName: message.variantName,
        initialChanges: message.changes || [],
        onChangesUpdate: (changes: DOMChange[]) => {
          console.log('[Visual Editor Listener] Changes updated:', changes)
          // Send changes back to extension
          chrome.runtime.sendMessage({
            type: 'VISUAL_EDITOR_CHANGES',
            variantName: message.variantName,
            changes: changes
          })
        }
      })
      
      currentEditor.start()
      sendResponse({ success: true })
      console.log('[Visual Editor Listener] Visual editor started successfully')
    } catch (error) {
      console.error('[Visual Editor Listener] Error starting visual editor:', error)
      sendResponse({ success: false, error: error.message })
    }
    
    return true // Keep message channel open for async response
  }
  
  if (message.type === 'STOP_VISUAL_EDITOR') {
    console.log('[Visual Editor Listener] Stopping visual editor')
    
    if (currentEditor) {
      const changes = currentEditor.getChanges()
      currentEditor.destroy()
      currentEditor = null
      sendResponse({ success: true, changes })
    } else {
      sendResponse({ success: true, changes: [] })
    }
    
    return true
  }
  
  if (message.type === 'GET_VISUAL_EDITOR_STATUS') {
    sendResponse({ 
      active: currentEditor !== null,
      changes: currentEditor?.getChanges() || []
    })
    return true
  }
})

console.log('[Visual Editor Listener] Content script loaded and listening')