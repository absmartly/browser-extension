import type { PlasmoCSConfig } from "plasmo"

// This is the main content script that will be injected into all web pages
import { VisualEditor, JSONEditor } from '~src/visual-editor'
import { EventViewer } from '~src/visual-editor/ui/event-viewer'
import { ElementPicker } from '~src/content/element-picker'
import type { DOMChange } from '~src/types/dom-changes'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { initializeOverrides } from '~src/utils/overrides'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { html } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
  run_at: "document_start" // Run as early as possible to intercept SDK before it initializes
}

// Mark that content script has loaded (for debugging)
console.log('[ABsmartly] Content script executing - TOP OF FILE')
const w = window as any
w.__absmartlyContentScriptLoaded = true
console.log('[ABsmartly] Content script marker set:', w.__absmartlyContentScriptLoaded)
debugLog('[Visual Editor Content Script] Content script loaded')

// Helper function to send messages - handles both test mode (iframe) and production (chrome.runtime)
const sendMessageToExtension = (message: any) => {
  // Check if sidebar iframe exists (only in test mode)
  const sidebarIframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement

  // Determine the correct source based on message type
  // Visual editor messages should use 'absmartly-visual-editor' source
  // Code editor messages should use 'absmartly-content-script' source
  const source = (message.type === 'VISUAL_EDITOR_CHANGES' ||
                  message.type === 'VISUAL_EDITOR_STOPPED' ||
                  message.type === 'DISABLE_PREVIEW' ||
                  message.type === 'ELEMENT_SELECTED')
    ? 'absmartly-visual-editor'
    : 'absmartly-content-script'

  if (sidebarIframe && sidebarIframe.contentWindow) {
    // Test mode: send to sidebar iframe
    sidebarIframe.contentWindow.postMessage({
      source: source,
      ...message
    }, '*')
    debugLog(`Sent ${message.type} to sidebar iframe (test mode) with source: ${source}`)
  } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    // Production: use chrome.runtime.sendMessage
    chrome.runtime.sendMessage(message).catch(err => {
      debugError(`Failed to send ${message.type} via chrome.runtime:`, err)
    })
    debugLog(`Sent ${message.type} via chrome.runtime (production mode)`)
  } else {
    debugError('No message transport available (neither iframe nor chrome.runtime)')
  }
}

// Polyfill chrome.runtime.sendMessage for test mode
// This handles messages that expect a response (like REQUEST_INJECTION_CODE)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  const originalSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime)
  const sidebarIframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement

  if (sidebarIframe && sidebarIframe.contentWindow) {
    // We're in test mode - polyfill sendMessage
    const responseCallbacks = new Map<string, (response: any) => void>()

    // Listen for responses from sidebar
    window.addEventListener('message', (event) => {
      // SECURITY: Only accept messages from sidebar iframe or same window
      if (event.source !== window && event.source !== sidebarIframe?.contentWindow) {
        return
      }

      if (event.data?.source === 'absmartly-extension' && event.data?.responseId) {
        const callback = responseCallbacks.get(event.data.responseId)
        if (callback) {
          callback(event.data.response)
          responseCallbacks.delete(event.data.responseId)
        }
      }
    })

    chrome.runtime.sendMessage = function(message: any, callback?: (response: any) => void) {
      // Determine the correct source based on message type
      const source = (message.type === 'VISUAL_EDITOR_CHANGES' ||
                      message.type === 'VISUAL_EDITOR_STOPPED' ||
                      message.type === 'DISABLE_PREVIEW' ||
                      message.type === 'ELEMENT_SELECTED')
        ? 'absmartly-visual-editor'
        : 'absmartly-content-script'

      if (callback) {
        // Generate unique ID for this request
        const responseId = `${message.type}_${Date.now()}_${Math.random()}`
        responseCallbacks.set(responseId, callback)

        // Send request to sidebar with response ID
        sidebarIframe.contentWindow!.postMessage({
          source: source,
          responseId: responseId,
          ...message
        }, '*')

        // Timeout after 5 seconds
        setTimeout(() => {
          if (responseCallbacks.has(responseId)) {
            responseCallbacks.delete(responseId)
            debugWarn(`No response received for ${message.type} after 5s`)
          }
        }, 5000)
      } else {
        // No callback, just send the message
        sidebarIframe.contentWindow!.postMessage({
          source: source,
          ...message
        }, '*')
      }
    } as any
  }
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
  console.log('[ABsmartly] startVisualEditor called with config:', JSON.stringify(config))
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

    // Hide preview header if it exists, since VE has its own toolbar
    removePreviewHeader()

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

        sendMessageToExtension({
          type: 'VISUAL_EDITOR_CHANGES',
          variantName: config.variantName,
          changes: changes
        })
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
  console.log('[ABsmartly] Message listener called! Message type:', message?.type)
  debugLog('[Visual Editor Content Script] Received message:', message.type)
  
  // Handle test connection message
  if (message.type === 'TEST_CONNECTION') {
    debugLog('[Visual Editor Content Script] Received message: TEST_CONNECTION')
    sendResponse({ success: true, message: 'Content script is loaded and ready' })
    return true
  }

  // Handle SDK plugin injection request
  if (message.type === 'INJECT_SDK_PLUGIN') {
    console.log('[Content Script] 📌 Received INJECT_SDK_PLUGIN message')
    debugLog('[Visual Editor Content Script] Injecting SDK plugin on demand')
    ensureSDKPluginInjected().then(() => {
      sendResponse({ success: true })
    }).catch(error => {
      sendResponse({ success: false, error: error.message })
    })
    return true // Keep message channel open for async response
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
      sendMessageToExtension({
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
    console.log('[ABsmartly] Received START_VISUAL_EDITOR message:', JSON.stringify(message))
    // Use shared start function
    startVisualEditor({
      variantName: message.variantName,
      experimentName: message.experimentName,
      changes: message.changes,
      useShadowDOM: message.useShadowDOM
    }).then(result => {
      console.log('[ABsmartly] startVisualEditor completed with result:', JSON.stringify(result))
      sendResponse(result)
    }).catch(error => {
      console.error('[ABsmartly] startVisualEditor failed:', error)
      sendResponse({ success: false, error: error.message })
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
  
  // Code editor messages
  if (message.type === 'OPEN_CODE_EDITOR') {
    openCodeEditor(message.data)
    sendResponse({ success: true })
    return true
  }
  
  if (message.type === 'CLOSE_CODE_EDITOR') {
    closeCodeEditor()
    sendResponse({ success: true })
    return true
  }
  
  // JSON editor messages
  if (message.type === 'OPEN_JSON_EDITOR') {
    openJSONEditor(message.data)
    sendResponse({ success: true })
    return true
  }

  if (message.type === 'CLOSE_JSON_EDITOR') {
    closeJSONEditor()
    sendResponse({ success: true })
    return true
  }

  // Event viewer messages
  if (message.type === 'OPEN_EVENT_VIEWER') {
    openEventViewer(message.data)
    sendResponse({ success: true })
    return true
  }

  if (message.type === 'CLOSE_EVENT_VIEWER') {
    closeEventViewer()
    sendResponse({ success: true })
    return true
  }

  // Return false for messages we don't handle to keep channel open for other listeners
  return false
})

debugLog('[Visual Editor Content Script] Loaded and listening for messages')

// Also log to the page directly to ensure we can see it
const debugDiv = document.createElement('div')
debugDiv.id = 'absmartly-debug-content-loaded'
debugDiv.style.display = 'none'
debugDiv.textContent = 'ABSmartly Content Script Loaded at ' + new Date().toISOString()
document.documentElement.appendChild(debugDiv)

// Expose a global function for testing (content script context only)
;(window as any).__absmartlyContentLoaded = true

// Send a message to the page to confirm we're loaded (CSP-safe communication)
// Tests can listen for this message instead of checking a global variable
window.postMessage({ type: 'ABSMARTLY_CONTENT_READY', timestamp: Date.now() }, '*')

// Listen for messages from the visual editor and test messages
window.addEventListener('message', (event) => {
  // Get sidebar iframe reference
  const sidebarIframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement

  // Only handle messages from:
  // 1. The same window (visual editor, tests)
  // 2. The sidebar iframe (when in test mode)
  if (event.source !== window && (!sidebarIframe || event.source !== sidebarIframe.contentWindow)) {
    return
  }

  // Handle messages from sidebar iframe
  if (event.data?.source === 'absmartly-sidebar') {
    console.log('[Content Script] Received message from sidebar iframe:', event.data.type, event.data)
    debugLog('[Content Script] Received message from sidebar iframe:', event.data.type)

    if (event.data.type === 'OPEN_CODE_EDITOR') {
      console.log('[Content Script] Opening code editor with data:', event.data.data)
      openCodeEditor(event.data.data)
      // Send confirmation back to sidebar
      if (sidebarIframe && sidebarIframe.contentWindow) {
        console.log('[Content Script] Sending confirmation back to sidebar')
        sidebarIframe.contentWindow.postMessage({
          source: 'absmartly-content-script',
          type: 'CODE_EDITOR_OPENED'
        }, '*')
      }
      return
    }

    if (event.data.type === 'CLOSE_CODE_EDITOR') {
      closeCodeEditor()
      return
    }
  }

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
      sendMessageToExtension({
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
  
  // Create preview header container - floating bar style
  const headerContainer = document.createElement('div')
  headerContainer.id = 'absmartly-preview-header'
  headerContainer.style.cssText = `
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    color: white;
    padding: 12px 20px;
    border-radius: 24px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 20px;
    font-size: 14px;
    min-width: 500px;
    max-width: 90vw;
    cursor: grab;
    pointer-events: auto;
  `

  // Drag functionality
  let isDragging = false
  let startX = 0
  let startY = 0
  let currentX = 0
  let currentY = 0

  headerContainer.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return
    isDragging = true
    headerContainer.style.cursor = 'grabbing'
    startX = e.clientX - currentX
    startY = e.clientY - currentY
  })

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    currentX = e.clientX - startX
    currentY = e.clientY - startY
    headerContainer.style.transform = `translate(calc(-50% + ${currentX}px), ${currentY}px)`
  })

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false
      headerContainer.style.cursor = 'grab'
    }
  })

  // Create content
  const content = document.createElement('div')
  content.style.cssText = 'flex: 1; display: flex; flex-direction: column; align-items: center;'

  // Get the extension URL for the logo
  const logoUrl = chrome.runtime.getURL('assets/absmartly-logo-white.svg')

  content.innerHTML = `
    <div style="font-weight: 500; font-size: 14px; display: flex; align-items: center; gap: 10px;">
      <img src="${logoUrl}" alt="ABSmartly" style="width: 24px; height: 24px;">
      <span>Preview Mode - ${experimentName}</span>
    </div>
    <div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">
      Variant: <strong>${variantName}</strong>
    </div>
  `

  // Create close button
  const closeButton = document.createElement('button')
  closeButton.style.cssText = `
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: white;
    padding: 8px 16px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
  `
  closeButton.textContent = 'Exit Preview'
  closeButton.onmouseover = () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.25)'
  }
  closeButton.onmouseout = () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.15)'
  }
  closeButton.onclick = () => {
    // Remove preview header immediately
    removePreviewHeader()

    // Send message back to extension to disable preview
    sendMessageToExtension({
      type: 'DISABLE_PREVIEW',
      experimentName: experimentName
    })
  }

  headerContainer.appendChild(content)
  headerContainer.appendChild(closeButton)
  document.body.appendChild(headerContainer)
}

// Function to remove preview header
function removePreviewHeader() {
  const header = document.getElementById('absmartly-preview-header')
  if (header) {
    header.remove()
  }
}

// Inject the SDK bridge bundle into the page
async function injectSDKPluginScript(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const script = document.createElement('script')
      script.src = chrome.runtime.getURL('absmartly-sdk-bridge.bundle.js')
      script.onload = () => {
        debugLog('[Content Script] SDK bridge bundle loaded')
        script.remove()
        resolve()
      }
      script.onerror = () => {
        debugError('[Content Script] Failed to load SDK bridge bundle')
        reject(new Error('Failed to load SDK bridge bundle'))
      }
      document.documentElement.appendChild(script)
    } catch (error) {
      debugError('[Content Script] Error loading SDK bridge bundle:', error)
      reject(error)
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
    console.log('[Content Script] 🚀 Injecting SDK plugin...')
    sdkPluginInjecting = true
    try {
      await injectSDKPluginScript()
      sdkPluginInjected = true
      console.log('[Content Script] ✅ SDK plugin injected successfully')
    } catch (error) {
      console.error('[Content Script] ❌ Failed to inject SDK plugin:', error)
    } finally {
      sdkPluginInjecting = false
    }
    // Give the script a moment to set up its message listener
    await new Promise(resolve => setTimeout(resolve, 50))
  } else if (sdkPluginInjected) {
    console.log('[Content Script] ℹ️ SDK plugin already injected')
  } else if (sdkPluginInjecting) {
    console.log('[Content Script] ⏳ SDK plugin injection already in progress')
  }
}

// Listen for messages from the injected script and SDK plugin
window.addEventListener('message', async (event) => {
  // Only accept messages from the same origin
  // Allow file:// protocol for testing (origin is "null" for file:// URLs)
  const isFileProtocol = window.location.protocol === 'file:' || event.origin === 'null'
  if (!isFileProtocol && event.origin !== window.location.origin) {
    return
  }

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

    if (event.data.type === 'SDK_EVENT') {
      // Forward SDK events to background script for buffering
      chrome.runtime.sendMessage({
        type: 'SDK_EVENT',
        payload: event.data.payload
      }).catch(err => {
        debugError('[Content Script] Failed to send SDK_EVENT to background:', err)
      })
    } else if (event.data.type === 'REQUEST_CUSTOM_CODE' || event.data.type === 'SDK_CONTEXT_READY') {
      // Get config from extension settings (per-experiment __inject_html only, no global custom code)
      const response = await chrome.runtime.sendMessage({
        type: 'REQUEST_INJECTION_CODE',
        source: 'content-script'
      })

      const config = response?.config || null

      // Send config to the page for plugin initialization
      window.postMessage({
        source: 'absmartly-extension',
        type: 'INITIALIZE_PLUGIN',
        payload: { config }
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
let codeEditorView: EditorView | null = null

function openCodeEditor(data: {
  section: string
  value: string
  sectionTitle: string
  placeholder: string
  readOnly?: boolean
}) {
  console.log('[openCodeEditor] Function called with:', { section: data.section, valueLength: data.value?.length, timestamp: Date.now() })
  // Remove any existing editor
  closeCodeEditor()
  console.log('[openCodeEditor] After closeCodeEditor, now creating new container')

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
    sendMessageToExtension({ type: 'CODE_EDITOR_CLOSE' })
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
    display: flex !important;
    flex-direction: column !important;
  `

  // Create CodeMirror wrapper
  const editorWrapper = document.createElement('div')
  editorWrapper.style.cssText = `
    flex: 1 !important;
    overflow: auto !important;
    border-radius: 6px !important;
    background: #1f2937 !important;
  `

  // Initialize CodeMirror editor
  const extensions = [
    basicSetup,
    html(),
    oneDark,
    EditorView.lineWrapping,
  ]

  // Add readOnly extension if needed
  if (data.readOnly) {
    extensions.push(EditorState.readOnly.of(true))
  }

  const startState = EditorState.create({
    doc: data.value || '',
    extensions
  })

  codeEditorView = new EditorView({
    state: startState,
    parent: editorWrapper
  })

  editorContainer.appendChild(editorWrapper)

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
  cancelBtn.textContent = data.readOnly ? 'Close' : 'Cancel'
  cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#f9fafb'
  cancelBtn.onmouseout = () => cancelBtn.style.backgroundColor = 'white'
  cancelBtn.onclick = () => {
    sendMessageToExtension({ type: 'CODE_EDITOR_CLOSE' })
    closeCodeEditor()
  }

  footer.appendChild(cancelBtn)

  // Only show Save button if not in read-only mode
  if (!data.readOnly) {
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
      const value = codeEditorView?.state.doc.toString() || ''
      sendMessageToExtension({
        type: 'CODE_EDITOR_SAVE',
        value
      })
      closeCodeEditor()
    }

    footer.appendChild(saveBtn)
  }

  // Assemble the modal
  modal.appendChild(header)
  modal.appendChild(editorContainer)
  modal.appendChild(footer)
  codeEditorContainer.appendChild(modal)

  // Add to page
  document.body.appendChild(codeEditorContainer)

  // Focus the editor
  codeEditorView.focus()

  // Prevent body scroll
  document.body.style.overflow = 'hidden'
}

function closeCodeEditor() {
  console.log('[closeCodeEditor] Function called, container exists:', !!codeEditorContainer, 'view exists:', !!codeEditorView)
  if (codeEditorView) {
    codeEditorView.destroy()
    codeEditorView = null
  }
  if (codeEditorContainer) {
    codeEditorContainer.remove()
    codeEditorContainer = null
    document.body.style.overflow = ''
  }
}

// JSON editor functionality
let jsonEditorInstance: any = null

async function openJSONEditor(data: {
  variantName: string
  value: string
}) {
  // Close any existing editor
  closeJSONEditor()

  // Temporarily disable VE if it's active (to prevent event conflicts)
  const wasVEActive = isVisualEditorActive
  if (wasVEActive && currentEditor) {
    debugLog('[JSON Editor] Temporarily disabling VE while JSON editor is open')
    currentEditor.disable()
  }

  jsonEditorInstance = new JSONEditor()

  const title = `Edit DOM Changes - ${data.variantName}`
  const result = await jsonEditorInstance.show(title, data.value)

  // Re-enable VE if it was active before
  if (wasVEActive && currentEditor) {
    debugLog('[JSON Editor] Re-enabling VE after JSON editor closed')
    currentEditor.enable()
  }

  if (result !== null) {
    // User saved changes
    chrome.runtime.sendMessage({
      type: 'JSON_EDITOR_SAVE',
      value: result
    })
  } else {
    // User cancelled
    chrome.runtime.sendMessage({
      type: 'JSON_EDITOR_CLOSE'
    })
  }
}

// Event viewer functionality
let eventViewerInstance: EventViewer | null = null

function openEventViewer(data: {
  eventName: string
  timestamp: string
  value: string
}) {
  // Close any existing viewer
  closeEventViewer()

  eventViewerInstance = new EventViewer()
  eventViewerInstance.show(data.eventName, data.timestamp, data.value)
}

function closeEventViewer() {
  if (eventViewerInstance) {
    eventViewerInstance.close()
    eventViewerInstance = null
  }
}

function closeJSONEditor() {
  if (jsonEditorInstance) {
    // The editor cleans up when promise resolves/rejects
    jsonEditorInstance = null
  }
}

// Automatically inject SDK plugin on page load to capture SDK events passively
// This allows the Events Debug page to receive events without needing to be opened first
ensureSDKPluginInjected().catch(err => {
  debugError('[Content Script] Failed to auto-inject SDK plugin:', err)
})
