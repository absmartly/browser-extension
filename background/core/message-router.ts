import type { ExtensionMessage } from '~src/lib/messaging'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

export interface RouteResult {
  handled: boolean
  async: boolean
}

/**
 * Routes a message to the appropriate destination (content script or sidebar)
 * @param message - The extension message to route
 * @param sender - The message sender information
 * @param sendResponse - Function to send response back
 * @returns Route result indicating if message was handled and if async
 */
export function routeMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): RouteResult {
  if (!message.from || !message.to) {
    return { handled: false, async: false }
  }

  if (!sender.id || sender.id !== chrome.runtime.id) {
    debugWarn('[Router] Rejected message from unauthorized sender:', sender)
    return { handled: false, async: false }
  }

  debugLog(`[Router] Received message: ${message.type} from ${message.from} to ${message.to}`)

  if (message.to === 'content') {
    routeToContent(message, sendResponse)
    return { handled: true, async: true }
  } else if (message.to === 'sidebar') {
    routeToSidebar(message, sendResponse)
    return { handled: true, async: true }
  }

  return { handled: false, async: false }
}

/**
 * Routes a message to the content script in the active tab
 * @param message - The extension message to route
 * @param sendResponse - Function to send response back
 */
function routeToContent(
  message: ExtensionMessage,
  sendResponse: (response?: any) => void
): void {
  chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, message).then(response => {
        sendResponse(response)
      }).catch(error => {
        debugError('[Router] Error forwarding to content:', error)
        sendResponse({ error: error.message })
      })
    } else {
      sendResponse({ error: 'No active tab found' })
    }
  })
}

/**
 * Routes a message to the sidebar (extension page)
 * @param message - The extension message to route
 * @param sendResponse - Function to send response back
 */
function routeToSidebar(
  message: ExtensionMessage,
  sendResponse: (response?: any) => void
): void {
  chrome.runtime.sendMessage(message).then(response => {
    sendResponse(response)
  }).catch(error => {
    debugError('[Router] Error forwarding to sidebar:', error)
    sendResponse({ error: error.message })
  })
}

/**
 * Validates a message sender to prevent unauthorized access
 * @param sender - The message sender to validate
 * @returns True if sender is valid, false otherwise
 */
export function validateSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender.id || sender.id !== chrome.runtime.id) {
    debugWarn('[Router] Rejected message from unauthorized sender:', sender)
    return false
  }
  return true
}

/**
 * Checks if a message uses the new unified message format
 * @param message - The message to check
 * @returns True if message has 'from' and 'to' fields
 */
export function isUnifiedMessage(message: any): message is ExtensionMessage {
  return !!message && typeof message === 'object' && 'from' in message && 'to' in message
}

/**
 * Forwards a message to the active tab's content script
 * @param message - The message to forward
 * @returns Promise that resolves with the response
 */
export async function forwardToActiveTab(message: any): Promise<any> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tabs[0]?.id) {
    throw new Error('No active tab found')
  }

  return chrome.tabs.sendMessage(tabs[0].id, message)
}

/**
 * Broadcasts a message to all extension pages (sidebar, popup, etc.)
 * @param message - The message to broadcast
 * @returns Promise that resolves when broadcast is complete
 */
export async function broadcastToExtension(message: any): Promise<void> {
  try {
    await chrome.runtime.sendMessage(message)
  } catch (error) {
    debugLog('[Router] No listeners for broadcast (this is normal if sidebar not open):', (error as Error)?.message)
  }
}
