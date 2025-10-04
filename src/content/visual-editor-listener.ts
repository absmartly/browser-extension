import { VisualEditor } from '~src/visual-editor'
import type { DOMChange } from '~src/types/dom-changes'

// Keep track of the current visual editor instance
let currentEditor: VisualEditor | null = null

// Listen for postMessage from the visual editor (running in MAIN world)
window.addEventListener('message', (event) => {
  if (event.data && event.data.source === 'absmartly-visual-editor' && event.data.type === 'VISUAL_EDITOR_COMPLETE') {
    console.log('[Visual Editor Listener] Received visual editor complete via postMessage:', event.data)
    
    // Relay to background script
    chrome.runtime.sendMessage({
      type: 'VISUAL_EDITOR_COMPLETE',
      variantName: event.data.variantName,
      changes: event.data.changes,
      totalChanges: event.data.totalChanges
    }, (response) => {
      console.log('[Visual Editor Listener] Relayed to background, response:', response)
    })
  }
})

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
        experimentName: message.experimentName || 'Unknown Experiment',
        logoUrl: message.logoUrl || '',
        initialChanges: message.changes || [],
        onChangesUpdate: (changes: DOMChange[]) => {
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