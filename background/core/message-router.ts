import type { ExtensionMessage } from '~src/lib/messaging'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

export interface RouteResult {
  handled: boolean
  async: boolean
}

function isValidSenderUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    if (parsed.protocol === 'chrome-extension:') {
      return true
    }

    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true
    }

    if (parsed.hostname.endsWith('absmartly.com') || parsed.hostname.endsWith('absmartly.io')) {
      return true
    }

    debugWarn('[Router] Rejected sender URL with invalid origin:', url)
    return false
  } catch (error) {
    debugWarn('[Router] Invalid sender URL format:', url)
    return false
  }
}

export function validateSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender.id || sender.id !== chrome.runtime.id) {
    debugWarn('[Router] Rejected message from unauthorized extension ID:', sender.id)
    return false
  }

  if (sender.frameId !== undefined && sender.frameId !== 0) {
    if (!sender.url || !isValidSenderUrl(sender.url)) {
      debugWarn('[Router] Rejected message from iframe with invalid origin:', {
        frameId: sender.frameId,
        url: sender.url
      })
      return false
    }
  }

  if (sender.url && !isValidSenderUrl(sender.url)) {
    return false
  }

  return true
}

export function routeMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): RouteResult {
  if (!message.from || !message.to) {
    return { handled: false, async: false }
  }

  if (!validateSender(sender)) {
    debugWarn('[Router] Sender validation failed, rejecting message route')
    return { handled: false, async: false }
  }

  if (message.to === 'content') {
    routeToContent(message, sendResponse)
    return { handled: true, async: true }
  } else if (message.to === 'sidebar') {
    routeToSidebar(message, sendResponse)
    return { handled: true, async: true }
  }

  return { handled: false, async: false }
}

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
  }).catch(error => {
    debugError('[Router] Error querying tabs:', error)
    sendResponse({ error: error.message })
  })
}

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

export function isUnifiedMessage(message: any): message is ExtensionMessage {
  return !!message && typeof message === 'object' && 'from' in message && 'to' in message
}

export async function forwardToActiveTab(message: any): Promise<any> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tabs[0]?.id) {
    throw new Error('No active tab found')
  }

  return chrome.tabs.sendMessage(tabs[0].id, message)
}

export async function broadcastToExtension(message: any): Promise<void> {
  try {
    await chrome.runtime.sendMessage(message)
  } catch (error) {
    debugLog('[Router] No listeners for broadcast (this is normal if sidebar not open):', (error as Error)?.message)
  }
}
