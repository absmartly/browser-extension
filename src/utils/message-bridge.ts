import { debugLog, debugError, debugWarn } from './debug'

/**
 * Message bridge that handles both production (chrome.runtime) and test mode (window.postMessage)
 * This provides a unified API for sending messages that works in both contexts.
 */

interface MessageResponse {
  success?: boolean
  error?: string
  [key: string]: any
}

type MessageCallback = (response: MessageResponse) => void

/**
 * Sends a message to the extension background script or sidebar.
 * Automatically detects test mode and uses appropriate transport.
 *
 * @param message - The message to send
 * @param callback - Optional callback for response (Promise-based if not provided)
 * @returns Promise that resolves with the response
 */
export async function sendMessage(message: any, callback?: MessageCallback): Promise<any> {
  // Check if we're in test mode:
  // 1. In sidebar iframe (window.parent !== window and parent has sidebar iframe)
  // 2. In test page that has sidebar iframe
  // 3. No chrome.runtime available
  const inIframe = window.parent !== window
  const sidebarIframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement
  const isTestMode = inIframe || (sidebarIframe && sidebarIframe.contentWindow) || typeof chrome === 'undefined' || !chrome.runtime

  if (isTestMode) {
    // Test mode: use window.postMessage
    debugLog(`[message-bridge] Using postMessage for ${message.type} (inIframe: ${inIframe}, hasSidebarIframe: ${!!sidebarIframe})`)
    return sendMessageViaPostMessage(message, callback)
  } else {
    // Production mode: use chrome.runtime.sendMessage
    debugLog(`[message-bridge] Using chrome.runtime for ${message.type}`)
    return sendMessageViaChromeRuntime(message, callback)
  }
}

/**
 * Sends message via chrome.runtime (production mode)
 */
function sendMessageViaChromeRuntime(message: any, callback?: MessageCallback): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const error = new Error(chrome.runtime.lastError.message)
          debugError(`chrome.runtime.sendMessage failed for ${message.type}:`, error)
          if (callback) callback({ success: false, error: error.message })
          reject(error)
        } else {
          debugLog(`Received response for ${message.type} via chrome.runtime`)
          if (callback) callback(response)
          resolve(response)
        }
      })
    } catch (error) {
      debugError(`Exception in chrome.runtime.sendMessage for ${message.type}:`, error)
      if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
      reject(error)
    }
  })
}

/**
 * Sends message via window.postMessage (test mode)
 */
function sendMessageViaPostMessage(message: any, callback?: MessageCallback): Promise<any> {
  return new Promise((resolve, reject) => {
    const responseId = `${message.type}_${Date.now()}_${Math.random()}`

    // Set up one-time listener for response
    const responseHandler = (event: MessageEvent) => {
      if (event.data?.source === 'absmartly-extension' && event.data?.responseId === responseId) {
        window.removeEventListener('message', responseHandler)
        clearTimeout(timeoutId)

        const response = event.data.response
        debugLog(`Received response for ${message.type} via postMessage`)

        if (callback) callback(response)

        if (response?.success === false) {
          reject(new Error(response.error || 'Request failed'))
        } else {
          resolve(response)
        }
      }
    }

    // Timeout after 30 seconds (increased for AI generation)
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', responseHandler)
      const error = new Error(`No response received for ${message.type} after 30s`)
      debugWarn(error.message)
      if (callback) callback({ success: false, error: error.message })
      reject(error)
    }, 30000)

    window.addEventListener('message', responseHandler)

    // Send the message
    const sidebarIframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement
    if (sidebarIframe && sidebarIframe.contentWindow) {
      // In content script or page context - send to sidebar iframe
      sidebarIframe.contentWindow.postMessage({
        source: 'absmartly-content-script',
        responseId,
        ...message
      }, '*')
      debugLog(`Sent ${message.type} to sidebar iframe via postMessage`)
    } else if (window.parent !== window) {
      // In iframe context (sidebar) - send to parent window
      window.parent.postMessage({
        source: 'absmartly-sidebar',
        responseId,
        ...message
      }, '*')
      debugLog(`Sent ${message.type} to parent window via postMessage`)
    } else {
      // Fallback: post to same window (will be handled by index.tsx listener)
      window.postMessage({
        source: 'absmartly-content-script',
        responseId,
        ...message
      }, '*')
      debugLog(`Sent ${message.type} to same window via postMessage`)
    }
  })
}

/**
 * Sends a fire-and-forget message (no response expected)
 */
export function sendMessageNoResponse(message: any): void {
  const sidebarIframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement

  if (sidebarIframe && sidebarIframe.contentWindow) {
    // Test mode: send to sidebar iframe
    sidebarIframe.contentWindow.postMessage({
      source: 'absmartly-visual-editor',
      ...message
    }, '*')
    debugLog(`Sent ${message.type} to sidebar iframe (no response expected)`)
  } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    // Production: use chrome.runtime.sendMessage
    chrome.runtime.sendMessage(message).catch(err => {
      debugError(`Failed to send ${message.type} via chrome.runtime:`, err)
    })
    debugLog(`Sent ${message.type} via chrome.runtime (no response expected)`)
  } else {
    debugError('No message transport available (neither iframe nor chrome.runtime)')
  }
}
