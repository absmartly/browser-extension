import { debugLog, debugError } from '../utils/debug'

/**
 * Extension message format with routing information
 */
export interface ExtensionMessage {
  type: string
  from?: 'sidebar' | 'content' | 'background'
  to?: 'sidebar' | 'content' | 'background'
  payload?: any
  requestId?: string
  expectsResponse?: boolean
  [key: string]: any
}

/**
 * Send message from sidebar to content script in the active tab
 * @param message Message object to send
 * @returns Promise resolving to the response from content script
 */
export async function sendToContent(message: any): Promise<any> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id) {
      throw new Error('No active tab found')
    }
    debugLog('[Messaging] Sending to content script:', message.type)
    return await chrome.tabs.sendMessage(tabs[0].id, message)
  } catch (error) {
    debugError('[Messaging] Error sending to content:', error)
    throw error
  }
}

/**
 * Send message to background script
 * @param message Message object to send
 * @returns Promise resolving to the response from background
 */
export async function sendToBackground(message: any): Promise<any> {
  try {
    debugLog('[Messaging] Sending to background:', message.type)
    return await chrome.runtime.sendMessage(message)
  } catch (error) {
    debugError('[Messaging] Error sending to background:', error)
    throw error
  }
}

/**
 * Broadcast message to all extension pages (sidebar, popups, etc.)
 * @param message Message object to broadcast
 */
export async function broadcastToExtension(message: any): Promise<void> {
  try {
    debugLog('[Messaging] Broadcasting to extension:', message.type)
    await chrome.runtime.sendMessage(message)
  } catch (error) {
    debugLog('[Messaging] No listeners for broadcast (normal when sidebar closed):', (error as Error)?.message)
  }
}
