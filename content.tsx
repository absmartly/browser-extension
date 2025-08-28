import type { PlasmoCSConfig } from "plasmo"

// This is the main content script that will be injected into all web pages
import { VisualEditor } from '~src/content/visual-editor'
import type { DOMChange } from '~src/types/dom-changes'

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

// Keep track of the current visual editor instance
let currentEditor: VisualEditor | null = null

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Visual Editor Content Script] Received message:', message.type)
  
  if (message.type === 'START_VISUAL_EDITOR') {
    console.log('[Visual Editor Content Script] Starting visual editor with variant:', message.variantName)
    
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
          console.log('[Visual Editor Content Script] Changes updated:', changes)
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
      console.log('[Visual Editor Content Script] Visual editor started successfully')
    } catch (error) {
      console.error('[Visual Editor Content Script] Error starting visual editor:', error)
      sendResponse({ success: false, error: error.message })
    }
    
    return true // Keep message channel open for async response
  }
  
  if (message.type === 'STOP_VISUAL_EDITOR') {
    console.log('[Visual Editor Content Script] Stopping visual editor')
    
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

console.log('[Visual Editor Content Script] Loaded and listening for messages')

// Also log to the page directly to ensure we can see it
const debugDiv = document.createElement('div')
debugDiv.id = 'absmartly-debug-content-loaded'
debugDiv.style.display = 'none'
debugDiv.textContent = 'ABSmartly Content Script Loaded at ' + new Date().toISOString()
document.documentElement.appendChild(debugDiv)

// Expose a global function for testing
;(window as any).__absmartlyContentLoaded = true