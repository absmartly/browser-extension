import { debugLog, debugError } from '../utils/debug'

export type MessageSource = 'sidebar' | 'content' | 'background'
export type MessageDestination = 'sidebar' | 'content' | 'background'

export interface ExtensionMessage {
  type: string
  from: MessageSource
  to: MessageDestination
  expectsResponse?: boolean
  requestId?: string
  payload?: any
  [key: string]: any
}

let messageIdCounter = 0
function generateRequestId(): string {
  return `msg_${Date.now()}_${++messageIdCounter}`
}

function isTestMode(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top
}

export async function sendMessage(message: ExtensionMessage): Promise<any> {
  message.requestId = message.requestId || generateRequestId()

  debugLog(`[Messaging] Sending ${message.type} from ${message.from} to ${message.to}`, message)

  if (isTestMode()) {
    return sendMessageTestMode(message)
  } else {
    return sendMessageProd(message)
  }
}

async function sendMessageProd(message: ExtensionMessage): Promise<any> {
  if (message.to === 'content') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      return chrome.tabs.sendMessage(tabs[0].id, message)
    }
    throw new Error('No active tab found')
  } else {
    return chrome.runtime.sendMessage(message)
  }
}

async function sendMessageTestMode(message: ExtensionMessage): Promise<any> {
  debugLog('[Messaging Test Mode] Sending message via postMessage', message)

  if (message.expectsResponse) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingResponses.delete(message.requestId!)
        reject(new Error(`Message timeout: ${message.type}`))
      }, 10000)

      pendingResponses.set(message.requestId!, (response) => {
        clearTimeout(timeoutId)
        resolve(response)
      })

      window.parent.postMessage({
        source: 'absmartly-extension',
        ...message
      }, '*')
    })
  } else {
    window.parent.postMessage({
      source: 'absmartly-extension',
      ...message
    }, '*')
    return Promise.resolve()
  }
}

const pendingResponses = new Map<string, (response: any) => void>()

// Store registered message listeners - only used in content script for test mode
const registeredListeners: Array<(message: any, sender: any, sendResponse: (response: any) => void) => boolean | void> = []

// Only intercept in content script context (when setupContentScriptMessageListener will be called)
// This prevents breaking the sidebar message handling
let listenersIntercepted = false

function ensureListenersIntercepted() {
  if (listenersIntercepted || typeof chrome === 'undefined') return
  listenersIntercepted = true

  try {
    const originalAddListener = chrome.runtime.onMessage.addListener.bind(chrome.runtime.onMessage)
    chrome.runtime.onMessage.addListener = function(listener: any, filter?: any) {
      registeredListeners.push(listener)
      return originalAddListener(listener, filter)
    }
  } catch (e) {
    debugError('[Messaging] Error intercepting chrome.runtime.onMessage:', e)
  }
}

export function setupMessageResponseHandler() {
  if (!isTestMode()) return

  window.addEventListener('message', (event) => {
    if (event.data?.source === 'absmartly-extension-response' && event.data?.requestId) {
      const handler = pendingResponses.get(event.data.requestId)
      if (handler) {
        handler(event.data.response)
        pendingResponses.delete(event.data.requestId)
      }
    }
  })
}

// For content script - convert incoming postMessage to chrome.runtime.onMessage calls
export function setupContentScriptMessageListener() {
  debugLog('[Messaging] Setting up content script test mode listener')

  // Ensure listeners are intercepted when we first set up the listener
  ensureListenersIntercepted()

  window.addEventListener('message', (event) => {
    // EARLY EXIT: Only process messages from our extension (before any logging)
    if (event.data?.source !== 'absmartly-extension') {
      return
    }

    // Accept messages from sidebar iframe (check it exists and matches source)
    const sidebarIframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement

    // SECURITY: Only accept messages from sidebar iframe
    if (!sidebarIframe || event.source !== sidebarIframe.contentWindow) {
      debugLog('[Messaging] Rejecting message - not from sidebar iframe')
      return
    }

    if (event.data?.type) {
      const message = event.data as ExtensionMessage
      debugLog('[Messaging] Content script received message from sidebar:', message.type)
      debugLog('[Messaging] Number of registered listeners:', registeredListeners.length)

      // Call all registered chrome.runtime.onMessage listeners
      for (const listener of registeredListeners) {
        const sendResponse = (response: any) => {
          if (event.data.requestId && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
              source: 'absmartly-extension-response',
              requestId: event.data.requestId,
              response
            }, '*')
          }
        }

        try {
          debugLog('[Messaging] Calling listener for message type:', message.type)
          const result = listener(message, {}, sendResponse)
          if (result === true) {
            // Listener will call sendResponse asynchronously
            break
          }
        } catch (e) {
          debugError('[Messaging] Error in listener:', e)
        }
      }
    }
  })
}

// For sidebar - setup listener for incoming messages (can use default chrome.runtime.onMessage)
export function setupMessageListener(
  handler: (message: ExtensionMessage, sendResponse: (response: any) => void) => boolean | void
) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.from && message.to) {
      return handler(message as ExtensionMessage, sendResponse)
    }
    return false
  })
}
