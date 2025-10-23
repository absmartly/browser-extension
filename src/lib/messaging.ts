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

  window.addEventListener('message', (event) => {
    debugLog('[Messaging DEBUG] Received window message event:', {
      source: event.source === window ? 'window' : 'other',
      origin: event.origin,
      dataSource: event.data?.source,
      dataType: event.data?.type
    })

    // Accept messages from sidebar iframe (check it exists and matches source)
    const sidebarIframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement

    debugLog('[Messaging DEBUG] Sidebar iframe check:', {
      iframeExists: !!sidebarIframe,
      eventSourceMatchesIframe: sidebarIframe ? event.source === sidebarIframe.contentWindow : false
    })

    // SECURITY: Only accept messages from sidebar iframe
    if (!sidebarIframe || event.source !== sidebarIframe.contentWindow) {
      debugLog('[Messaging DEBUG] Rejecting message - iframe check failed')
      return
    }

    debugLog('[Messaging DEBUG] Passed iframe check, checking message format')

    if (event.data?.source === 'absmartly-extension' && event.data?.type) {
      const message = event.data as ExtensionMessage
      debugLog('[Messaging] Content script received message from sidebar:', message.type)

      // Call all registered chrome.runtime.onMessage listeners
      const listeners = chrome.runtime.onMessage.hasListeners()
        ? (chrome.runtime.onMessage as any)._listeners || []
        : []

      debugLog('[Messaging DEBUG] Found', listeners.length, 'chrome.runtime.onMessage listeners')

      for (const listener of listeners) {
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
          const result = listener(message, {}, sendResponse)
          if (result === true) {
            // Listener will call sendResponse asynchronously
            break
          }
        } catch (e) {
          debugError('[Messaging] Error in listener:', e)
        }
      }
    } else {
      debugLog('[Messaging DEBUG] Message format check failed:', {
        hasSource: !!event.data?.source,
        source: event.data?.source,
        hasType: !!event.data?.type,
        type: event.data?.type
      })
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
