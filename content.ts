import type { PlasmoCSConfig } from "plasmo"

// This is the main content script that will be injected into all web pages
import { VisualEditor } from '~src/visual-editor'
import { ElementPicker } from '~src/content/element-picker'
import type { DOMChange } from '~src/types/dom-changes'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { initializeOverrides } from '~src/utils/overrides'

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

// Keep track of the current visual editor instance
let currentEditor: VisualEditor | null = null
let elementPicker: ElementPicker | null = null
let isVisualEditorActive = false
let isVisualEditorStarting = false

// Initialize overrides on page load
// This ensures storage is synced to cookie for SSR compatibility
initializeOverrides().then(overrides => {
  if (Object.keys(overrides).length > 0) {
    debugLog('[Content Script] Initialized experiment overrides:', overrides)
  }
}).catch(error => {
  debugWarn('[Content Script] Failed to initialize overrides:', error)
})

/**
 * Start the visual editor with the given configuration
 * Shared logic used by both chrome.runtime messages and test messages
 */
async function startVisualEditor(config: {
  variantName: string
  experimentName?: string
  changes?: DOMChange[]
  useShadowDOM?: boolean
}): Promise<{ success: boolean; error?: string }> {
  debugLog('[Visual Editor Content Script] Starting visual editor with config:', config)
  debugLog('[Visual Editor Content Script] Variant:', config.variantName)
  debugLog('[Visual Editor Content Script] Experiment name:', config.experimentName)

  await ensureSDKPluginInjected()

  try {
    // Stop any existing editor
    if (currentEditor) {
      currentEditor.destroy()
      currentEditor = null
    }

    // Mark visual editor as active BEFORE starting
    isVisualEditorActive = true
    isVisualEditorStarting = false

    // Get the extension URL for the logo
    const logoUrl = chrome.runtime.getURL('assets/absmartly-logo-white.svg')

    // Check if we're in test mode (URL param or window flag)
    const urlParams = new URLSearchParams(window.location.search)
    const isTestMode = urlParams.get('use_shadow_dom_for_visual_editor_context_menu') === '0'
    debugLog('[Visual Editor Content Script] Test mode:', isTestMode)

    // Use shadow DOM by default, unless explicitly disabled (for testing)
    // If in test mode, always disable shadow DOM
    const useShadowDOM = isTestMode ? false : (config.useShadowDOM !== false)
    debugLog('[Visual Editor Content Script] Use Shadow DOM:', useShadowDOM)

    // Create and start new editor
    currentEditor = new VisualEditor({
      variantName: config.variantName,
      experimentName: config.experimentName,
      logoUrl: logoUrl,
      initialChanges: config.changes || [],
      useShadowDOM: useShadowDOM,
      onChangesUpdate: (changes: DOMChange[]) => {
        console.log('[Visual Editor Content Script] CALLBACK START')
        debugLog('[Visual Editor Content Script] Changes updated:', changes?.length)
        console.log('[Visual Editor Content Script] AFTER debugLog - about to send message')
        console.log('[Visual Editor Content Script] NOW SENDING VISUAL_EDITOR_CHANGES message with', changes.length, 'changes')

        // Check if we're in test mode by looking for the test query parameter
        const urlParams = new URLSearchParams(window.location.search)
        const isTestMode = urlParams.has('use_shadow_dom_for_visual_editor_context_menu')
        console.log('[Visual Editor Content Script] Test mode:', isTestMode)

        if (isTestMode) {
          // In test mode, find the sidebar iframe and post message to its contentWindow
          console.log('[Visual Editor Content Script] Sending message via iframe.contentWindow.postMessage (test mode)')
          const sidebarIframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement
          if (sidebarIframe && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
              source: 'absmartly-visual-editor',
              type: 'VISUAL_EDITOR_CHANGES',
              variantName: config.variantName,
              changes: changes
            }, '*')
            console.log('[Visual Editor Content Script] Message posted to sidebar iframe')
          } else {
            console.error('[Visual Editor Content Script] Sidebar iframe not found!')
          }
        } else {
          // In production, use chrome.runtime.sendMessage for extension context
          console.log('[Visual Editor Content Script] Sending message via chrome.runtime.sendMessage (production mode)')
          chrome.runtime.sendMessage({
            type: 'VISUAL_EDITOR_CHANGES',
            variantName: config.variantName,
            changes: changes
          }, (response) => {
            console.log('[Visual Editor Content Script] Message sent, got response:', response)
            if (chrome.runtime.lastError) {
              console.error('[Visual Editor Content Script] Error:', chrome.runtime.lastError.message)
            }
          })
        }
      }
    })

    const result = currentEditor.start()
    debugLog('[Visual Editor Content Script] Visual editor start result:', result)

    if (!result.success) {
      throw new Error('Visual editor failed to start')
    }

    debugLog('[Visual Editor Content Script] Visual editor started successfully')
    return { success: true }
  } catch (error) {
    debugError('[Visual Editor Content Script] Error starting visual editor:', error)
    console.error('[Visual Editor Content Script] Full error:', error)
    isVisualEditorActive = false
    return { success: false, error: error.message }
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('[Visual Editor Content Script] Received message:', message.type)
  
  // Handle test connection message
  if (message.type === 'TEST_CONNECTION') {
    debugLog('[Visual Editor Content Script] Received message: TEST_CONNECTION')
    sendResponse({ success: true, message: 'Content script is loaded and ready' })
    return true
  }
  
  // Handle element picker message
  if (message.type === 'START_ELEMENT_PICKER') {
    debugLog('[Visual Editor Content Script] Starting element picker')
    
    if (!elementPicker) {
      elementPicker = new ElementPicker()
    }
    
    elementPicker.start((selector: string) => {
      debugLog('[Visual Editor Content Script] Element selected:', selector)
      // Send the selected element back to the extension
      chrome.runtime.sendMessage({
        type: 'ELEMENT_SELECTED',
        selector: selector
      })
      elementPicker = null
    })
    
    sendResponse({ success: true })
    return true
  }
  
  // Handle cancel element picker message
  if (message.type === 'CANCEL_ELEMENT_PICKER') {
    debugLog('[Visual Editor Content Script] Canceling element picker')
    
    if (elementPicker) {
      elementPicker.stop()
      elementPicker = null
    }
    
    sendResponse({ success: true })
    return true
  }
  
  if (message.type === 'CHECK_VISUAL_EDITOR_ACTIVE') {
    const isActive = isVisualEditorActive || isVisualEditorStarting || !!(window as any).__absmartlyVisualEditorActive
    debugLog('[Visual Editor Content Script] CHECK_VISUAL_EDITOR_ACTIVE:', {
      isVisualEditorActive,
      isVisualEditorStarting,
      windowFlag: !!(window as any).__absmartlyVisualEditorActive,
      result: isActive
    })
    sendResponse(isActive)
    return true
  }

  if (message.type === 'SET_VISUAL_EDITOR_STARTING') {
    debugLog('[Visual Editor Content Script] Setting visual editor starting flag:', message.starting)
    isVisualEditorStarting = message.starting
    sendResponse({ success: true })
    return true
  }

  if (message.type === 'START_VISUAL_EDITOR') {
    // Use shared start function
    startVisualEditor({
      variantName: message.variantName,
      experimentName: message.experimentName,
      changes: message.changes,
      useShadowDOM: message.useShadowDOM
    }).then(result => {
      sendResponse(result)
    })

    return true // Keep message channel open for async response
  }
  
  if (message.type === 'STOP_VISUAL_EDITOR') {
    debugLog('[Visual Editor Content Script] Stopping visual editor')

    isVisualEditorActive = false
    isVisualEditorStarting = false

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
      active: isVisualEditorActive,
      changes: currentEditor?.getChanges() || []
    })
    return true
  }
  
  // Visual editor preview messages aren't sent through chrome.tabs.sendMessage
  // They're sent via chrome.runtime.sendMessage and need to be handled differently

  // Handle preview messages
  if (message.type === 'ABSMARTLY_PREVIEW') {
    debugLog('[ABSmartly Content Script] Received preview message:', message.action)

    // If visual editor is active or starting, ignore preview update messages
    // The visual editor manages its own changes and we don't want conflicts
    if ((isVisualEditorActive || isVisualEditorStarting) && message.action === 'update') {
      debugLog('[ABSmartly Content Script] Visual editor is active/starting, ignoring preview update')
      sendResponse({ success: true, message: 'Visual editor active, preview update ignored' })
      return true
    }

    // Ensure SDK plugin is injected before handling preview
    ;(async () => {
      await ensureSDKPluginInjected()

      if (message.action === 'apply') {
        // Create preview header (it will check visual editor state internally)
        createPreviewHeader(message.experimentName, message.variantName)

        // Send message to SDK plugin to preview changes
        window.postMessage({
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {
            changes: message.changes || [],
            experimentName: message.experimentName,
            variantName: message.variantName,
            experimentId: message.experimentId
          }
        }, '*')

        sendResponse({ success: true })
      } else if (message.action === 'update') {
        // Update changes WITHOUT recreating the header
        // Just send the new changes to the SDK plugin with updateMode flag
        window.postMessage({
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {
            changes: message.changes || [],
            experimentName: message.experimentName,
            variantName: message.variantName,
            experimentId: message.experimentId,
            updateMode: 'replace' // Tell plugin to replace all changes instead of incremental
          }
        }, '*')

        sendResponse({ success: true })
      } else if (message.action === 'remove') {
        // Only remove preview header if visual editor is NOT active
        if (!isVisualEditorActive) {
          removePreviewHeader()
        }

        // Send message to SDK plugin to remove preview
        window.postMessage({
          source: 'absmartly-extension',
          type: 'REMOVE_PREVIEW',
          payload: {
            experimentName: message.experimentName
          }
        }, '*')

        sendResponse({ success: true })
      }
    })()

    return true
  }
})

debugLog('[Visual Editor Content Script] Loaded and listening for messages')

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

// Listen for messages from the visual editor and test messages
window.addEventListener('message', (event) => {
  // Only handle messages from the same origin
  if (event.source !== window) return

  // Handle test messages for programmatic sidebar control
  if (event.data.source === 'absmartly-tests') {
    if (event.data.type === 'TEST_OPEN_SIDEBAR') {
      debugLog('[Content Script] Received TEST_OPEN_SIDEBAR from tests')
      // Simulate opening the sidebar - in reality, this would be triggered by the extension
      // For tests, we just confirm the message was received
      window.postMessage({
        source: 'absmartly-extension',
        type: 'TEST_SIDEBAR_RESULT',
        success: true,
        message: 'Sidebar open message received'
      }, '*')
      return
    }

    if (event.data.type === 'TEST_CLOSE_SIDEBAR') {
      debugLog('[Content Script] Received TEST_CLOSE_SIDEBAR from tests')
      window.postMessage({
        source: 'absmartly-extension',
        type: 'TEST_SIDEBAR_RESULT',
        success: true,
        message: 'Sidebar close message received'
      }, '*')
      return
    }

    if (event.data.type === 'TEST_START_VISUAL_EDITOR') {
      debugLog('[Content Script] Received TEST_START_VISUAL_EDITOR from tests')
      // Use shared start function directly
      startVisualEditor({
        variantName: event.data.variantName || 'test-variant',
        experimentName: event.data.experimentName,
        changes: event.data.changes || []
      }).then(result => {
        window.postMessage({
          source: 'absmartly-extension',
          type: 'TEST_SIDEBAR_RESULT',
          success: result.success,
          message: result.success ? 'Visual editor started' : `Failed: ${result.error}`
        }, '*')
      })
      return
    }

    if (event.data.type === 'TEST_STATUS') {
      debugLog('[Content Script] Received TEST_STATUS from tests')
      window.postMessage({
        source: 'absmartly-extension',
        type: 'TEST_SIDEBAR_RESULT',
        success: true,
        active: isVisualEditorActive,
        changes: currentEditor?.getChanges() || []
      }, '*')
      return
    }
  }

  if (event.data.type === 'ABSMARTLY_VISUAL_EDITOR_EXIT') {
    debugLog('[Visual Editor Content Script] Received EXIT message from visual editor')

    // Stop the visual editor
    if (currentEditor) {
      const changes = currentEditor.getChanges()
      const experimentName = currentEditor.experimentName
      const variantName = currentEditor.variantName

      currentEditor.destroy()
      currentEditor = null
      isVisualEditorActive = false
      isVisualEditorStarting = false

      // Send message to extension that visual editor was stopped
      chrome.runtime.sendMessage({
        type: 'VISUAL_EDITOR_STOPPED',
        changes: changes
      })

      // Restore the preview header since preview is still active
      // Store VE changes for restoration when preview is toggled
      // Note: VE changes include physically removed elements (delete operations),
      // so we need to track them separately for restoration
      if (experimentName && variantName) {
        // Store VE changes globally for preview toggle handling
        ;(window as any).__absmartlyVEChanges = {
          experimentName,
          changes
        }
        debugLog('[Content Script] Stored VE changes for preview toggle', { experimentName, changeCount: changes.length })

        createPreviewHeader(experimentName, variantName)
      }
    }
  }
})

// Function to create preview header
function createPreviewHeader(experimentName: string, variantName: string) {
  // Remove any existing preview header
  removePreviewHeader()

  // Don't create header if visual editor is active or starting
  // The visual editor has its own toolbar with exit button
  if (isVisualEditorActive || isVisualEditorStarting) {
    return
  }
  
  // Create preview header container
  const headerContainer = document.createElement('div')
  headerContainer.id = 'absmartly-preview-header'
  headerContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #3b82f6, #10b981);
    color: white;
    padding: 12px 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
  `
  
  // Create content
  const content = document.createElement('div')
  content.style.cssText = 'flex: 1; text-align: center;'

  // Get the extension URL for the logo
  const logoUrl = chrome.runtime.getURL('assets/absmartly-logo-white.svg')

  content.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <img src="${logoUrl}" alt="ABSmartly" style="height: 20px; width: auto; vertical-align: middle;">
      <span>ABSmartly Preview Mode Active</span>
    </div>
    <div style="font-size: 12px; opacity: 0.95;">
      Previewing variant <strong>${variantName}</strong> of experiment <strong>${experimentName}</strong>
    </div>
  `
  
  // Create close button
  const closeButton = document.createElement('button')
  closeButton.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
  `
  closeButton.textContent = 'Exit Preview'
  closeButton.onmouseover = () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.3)'
  }
  closeButton.onmouseout = () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.2)'
  }
  closeButton.onclick = () => {
    // Send message back to extension to disable preview
    chrome.runtime.sendMessage({
      type: 'DISABLE_PREVIEW',
      experimentName: experimentName
    })
  }
  
  headerContainer.appendChild(content)
  headerContainer.appendChild(closeButton)
  document.body.appendChild(headerContainer)
  
  // Adjust body padding to accommodate header
  const originalPaddingTop = document.body.style.paddingTop
  document.body.style.paddingTop = '60px'
  headerContainer.dataset.originalPadding = originalPaddingTop
}

// Function to remove preview header
function removePreviewHeader() {
  const header = document.getElementById('absmartly-preview-header')
  if (header) {
    // Restore original body padding
    const originalPadding = header.dataset.originalPadding || ''
    document.body.style.paddingTop = originalPadding
    header.remove()
  }
}

// Inject the SDK plugin initialization script into the page
async function injectSDKPluginScript(): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    try {
      // First try to load the mapping file to get the hashed filename
      const mappingUrl = chrome.runtime.getURL('inject-sdk-plugin-mapping.json')
      const response = await fetch(mappingUrl)

      let scriptFilename = 'inject-sdk-plugin.js' // fallback

      if (response.ok) {
        const mapping = await response.json()
        scriptFilename = mapping.filename
        debugLog('[Content Script] Loading hashed inject script:', scriptFilename)
      } else {
        debugLog('[Content Script] No mapping file found, using default filename')
      }

      const script = document.createElement('script')
      script.src = chrome.runtime.getURL(scriptFilename)
      script.onload = () => {
        debugLog('[Content Script] Inject script loaded:', scriptFilename)
        script.remove()
        resolve()
      }
      script.onerror = () => {
        debugError('[Content Script] Failed to load inject script:', scriptFilename)
        // Fallback to non-hashed version
        if (scriptFilename !== 'inject-sdk-plugin.js') {
          debugLog('[Content Script] Trying fallback: inject-sdk-plugin.js')
          const fallbackScript = document.createElement('script')
          fallbackScript.src = chrome.runtime.getURL('inject-sdk-plugin.js')
          fallbackScript.onload = () => {
            fallbackScript.remove()
            resolve()
          }
          fallbackScript.onerror = () => reject(new Error('Failed to load fallback script'))
          document.documentElement.appendChild(fallbackScript)
        } else {
          reject(new Error('Failed to load inject script'))
        }
      }
      document.documentElement.appendChild(script)
    } catch (error) {
      debugError('[Content Script] Error loading inject script:', error)
      // Fallback to direct load
      const script = document.createElement('script')
      script.src = chrome.runtime.getURL('inject-sdk-plugin.js')
      script.onload = () => {
        script.remove()
        resolve()
      }
      script.onerror = () => reject(error)
      document.documentElement.appendChild(script)
    }
  })
}

// Don't automatically inject SDK plugin on every page
// Only inject when the user actually opens the sidebar or uses extension features
// This prevents breaking websites that don't need the SDK
let sdkPluginInjected = false
let sdkPluginInjecting = false

async function ensureSDKPluginInjected() {
  if (!sdkPluginInjected && !sdkPluginInjecting) {
    sdkPluginInjecting = true
    await injectSDKPluginScript()
    sdkPluginInjected = true
    sdkPluginInjecting = false
    // Give the script a moment to set up its message listener
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

// Listen for messages from the injected script and SDK plugin
window.addEventListener('message', async (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) return

  // Handle visual editor closed message
  if (event.data && event.data.source === 'absmartly-visual-editor' && event.data.type === 'VISUAL_EDITOR_CLOSED') {
    debugLog('[Content Script] Visual editor closed, updating state')
    isVisualEditorActive = false
    isVisualEditorStarting = false

    // Always create preview header if we have experiment info (preview is still on)
    if (event.data.experimentName && event.data.variantName) {
      debugLog('[Content Script] Creating preview header after visual editor close')
      createPreviewHeader(event.data.experimentName, event.data.variantName)
    }
    return
  }

  // Handle messages from the injected script (absmartly-page)
  if (event.data && event.data.source === 'absmartly-page') {
    debugLog('[Content Script] Received message from page:', event.data)
    
    if (event.data.type === 'REQUEST_CUSTOM_CODE' || event.data.type === 'SDK_CONTEXT_READY') {
      // Get custom code and config from extension settings
      const response = await chrome.runtime.sendMessage({
        type: 'REQUEST_INJECTION_CODE',
        source: 'content-script'
      })

      const customCode = response?.data || null
      const config = response?.config || null

      // Send custom code and config to the page
      window.postMessage({
        source: 'absmartly-extension',
        type: 'INITIALIZE_PLUGIN',
        payload: { customCode, config }
      }, window.location.origin)
    } else if (event.data.type === 'REQUEST_SDK_INJECTION_CONFIG') {
      // Get SDK injection config from extension settings
      const response = await chrome.runtime.sendMessage({
        type: 'REQUEST_INJECTION_CODE',
        source: 'content-script'
      })

      const config = response?.config || null

      // Send config to the page for SDK injection decision
      window.postMessage({
        source: 'absmartly-extension',
        type: 'SDK_INJECTION_CONFIG',
        payload: { config }
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
    debugLog('[Content Script] Received message from SDK plugin:', event.data)
    
    // We can handle other plugin messages here if needed
    // but we don't need to handle REQUEST_INJECTION_CODE anymore
    // since we inject the code directly during plugin initialization
  }
})

// Also listen for test events
document.addEventListener('absmartly-test', (event: any) => {
  debugLog('[Visual Editor Content Script] Received test event:', event.detail)
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