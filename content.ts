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

// Send a message to the page to confirm we're loaded
window.postMessage({ type: 'ABSMARTLY_CONTENT_READY', timestamp: Date.now() }, '*')

// Inject the SDK plugin initialization script into the page
function injectSDKPluginScript() {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('inject-sdk-plugin.js')
  script.onload = () => script.remove()
  document.documentElement.appendChild(script)
}

// Initialize SDK plugin when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectSDKPluginScript)
} else {
  // DOM is already ready, inject immediately
  injectSDKPluginScript()
}

// Listen for messages from the injected script and SDK plugin
window.addEventListener('message', async (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) return
  
  // Handle messages from the injected script (absmartly-page)
  if (event.data && event.data.source === 'absmartly-page') {
    console.log('[Content Script] Received message from page:', event.data)
    
    if (event.data.type === 'REQUEST_CUSTOM_CODE' || event.data.type === 'SDK_CONTEXT_READY') {
      // Get custom code from extension settings
      const response = await chrome.runtime.sendMessage({
        type: 'REQUEST_INJECTION_CODE',
        source: 'content-script'
      })
      
      const customCode = response?.data || null
      
      // Send custom code to the page
      window.postMessage({
        source: 'absmartly-extension',
        type: 'INITIALIZE_PLUGIN',
        payload: { customCode }
      }, window.location.origin)
    } else if (event.data.type === 'PLUGIN_INITIALIZED') {
      // Notify background script that plugin is ready
      chrome.runtime.sendMessage({
        type: 'PLUGIN_INITIALIZED',
        source: 'content-script'
      })
    }
  }
  
  // Handle messages from the SDK plugin (absmartly-sdk)
  else if (event.data && event.data.source === 'absmartly-sdk') {
    console.log('[Content Script] Received message from SDK plugin:', event.data)
    
    if (event.data.type === 'REQUEST_INJECTION_CODE') {
      // Forward the request to the background script
      chrome.runtime.sendMessage({
        type: 'REQUEST_INJECTION_CODE',
        source: 'sdk-plugin'
      }, (response) => {
        // Send the response back to the SDK plugin
        window.postMessage({
          source: 'absmartly-extension',
          type: 'INJECTION_CODE',
          payload: response?.data || {
            headStart: '',
            headEnd: '',
            bodyStart: '',
            bodyEnd: '',
            styleTag: ''
          }
        }, window.location.origin)
      })
    }
  }
})

// Also listen for test events
document.addEventListener('absmartly-test', (event: any) => {
  console.log('[Visual Editor Content Script] Received test event:', event.detail)
  document.dispatchEvent(new CustomEvent('absmartly-response', {
    detail: { message: 'Content script received your message', originalMessage: event.detail }
  }))
})

// Code editor functionality
let codeEditorContainer: HTMLDivElement | null = null

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_CODE_EDITOR') {
    openCodeEditor(message.data)
    sendResponse({ success: true })
  } else if (message.type === 'CLOSE_CODE_EDITOR') {
    closeCodeEditor()
    sendResponse({ success: true })
  }
})

function openCodeEditor(data: {
  section: string
  value: string
  sectionTitle: string
  placeholder: string
}) {
  // Remove any existing editor
  closeCodeEditor()

  // Create the editor container
  codeEditorContainer = document.createElement('div')
  codeEditorContainer.id = 'absmartly-code-editor-fullscreen'
  codeEditorContainer.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    background: rgba(0, 0, 0, 0.5) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `

  // Create the editor modal
  const modal = document.createElement('div')
  modal.style.cssText = `
    width: calc(100vw - 32px) !important;
    height: calc(100vh - 32px) !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    background: white !important;
    border-radius: 8px !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  `

  // Create header
  const header = document.createElement('div')
  header.style.cssText = `
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 16px !important;
    border-bottom: 1px solid #e5e7eb !important;
    background: white !important;
  `

  const title = document.createElement('h2')
  title.style.cssText = `
    font-size: 18px !important;
    font-weight: 600 !important;
    color: #111827 !important;
    margin: 0 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  `
  title.textContent = `</> ${data.sectionTitle}`

  const closeBtn = document.createElement('button')
  closeBtn.style.cssText = `
    padding: 8px !important;
    background: transparent !important;
    border: none !important;
    cursor: pointer !important;
    color: #6b7280 !important;
    font-size: 24px !important;
    line-height: 1 !important;
    border-radius: 4px !important;
    transition: background-color 0.2s !important;
  `
  closeBtn.innerHTML = '×'
  closeBtn.onmouseover = () => closeBtn.style.backgroundColor = '#f3f4f6'
  closeBtn.onmouseout = () => closeBtn.style.backgroundColor = 'transparent'
  closeBtn.onclick = () => {
    chrome.runtime.sendMessage({ type: 'CODE_EDITOR_CLOSE' })
    closeCodeEditor()
  }

  header.appendChild(title)
  header.appendChild(closeBtn)

  // Create editor container
  const editorContainer = document.createElement('div')
  editorContainer.style.cssText = `
    flex: 1 !important;
    padding: 16px !important;
    overflow: hidden !important;
    background: #f9fafb !important;
  `

  // Create textarea
  const textarea = document.createElement('textarea')
  textarea.value = data.value || ''
  textarea.placeholder = data.placeholder
  textarea.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    padding: 16px !important;
    background: #1f2937 !important;
    color: #f3f4f6 !important;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
    border: none !important;
    border-radius: 6px !important;
    resize: none !important;
    outline: none !important;
    tab-size: 2 !important;
    box-sizing: border-box !important;
  `
  textarea.spellcheck = false

  editorContainer.appendChild(textarea)

  // Create footer
  const footer = document.createElement('div')
  footer.style.cssText = `
    display: flex !important;
    justify-content: flex-end !important;
    gap: 8px !important;
    padding: 16px !important;
    border-top: 1px solid #e5e7eb !important;
    background: white !important;
  `

  const cancelBtn = document.createElement('button')
  cancelBtn.style.cssText = `
    padding: 8px 16px !important;
    background: white !important;
    color: #374151 !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    transition: all 0.2s !important;
  `
  cancelBtn.textContent = 'Cancel'
  cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f9fafb'
  cancelBtn.onmouseout = () => cancelBtn.style.backgroundColor = 'white'
  cancelBtn.onclick = () => {
    chrome.runtime.sendMessage({ type: 'CODE_EDITOR_CLOSE' })
    closeCodeEditor()
  }

  const saveBtn = document.createElement('button')
  saveBtn.style.cssText = `
    padding: 8px 16px !important;
    background: #3b82f6 !important;
    color: white !important;
    border: none !important;
    border-radius: 6px !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    transition: all 0.2s !important;
  `
  saveBtn.textContent = 'Save'
  saveBtn.onmouseover = () => saveBtn.style.backgroundColor = '#2563eb'
  saveBtn.onmouseout = () => saveBtn.style.backgroundColor = '#3b82f6'
  saveBtn.onclick = () => {
    chrome.runtime.sendMessage({ 
      type: 'CODE_EDITOR_SAVE',
      value: textarea.value
    })
    closeCodeEditor()
  }

  footer.appendChild(cancelBtn)
  footer.appendChild(saveBtn)

  // Assemble the modal
  modal.appendChild(header)
  modal.appendChild(editorContainer)
  modal.appendChild(footer)
  codeEditorContainer.appendChild(modal)

  // Add to page
  document.body.appendChild(codeEditorContainer)

  // Focus the textarea
  textarea.focus()

  // Prevent body scroll
  document.body.style.overflow = 'hidden'
}

function closeCodeEditor() {
  if (codeEditorContainer) {
    codeEditorContainer.remove()
    codeEditorContainer = null
    document.body.style.overflow = ''
  }
}