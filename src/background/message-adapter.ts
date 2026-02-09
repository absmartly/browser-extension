/**
 * Message Adapter Interface
 *
 * Abstracts message passing to allow both Chrome extension messages
 * and window.postMessage (for testing) to use the same core logic.
 */

export interface Message {
  type: string
  [key: string]: any
}

export interface MessageSender {
  tab?: {
    id: number
  }
  frameId?: number
}

export interface MessageAdapter {
  /**
   * Send a message to a specific tab
   */
  sendToTab(tabId: number, message: Message): Promise<void>

  /**
   * Send a message to all tabs
   */
  sendToAllTabs(message: Message): Promise<void>

  /**
   * Register a message listener
   * Returns a function to remove the listener
   */
  onMessage(handler: (message: Message, sender: MessageSender) => void | Promise<void>): () => void
}

/**
 * Chrome Extension Message Adapter
 * Uses chrome.runtime and chrome.tabs APIs
 */
export class ChromeMessageAdapter implements MessageAdapter {
  async sendToTab(tabId: number, message: Message): Promise<void> {
    await chrome.tabs.sendMessage(tabId, message)
  }

  async sendToAllTabs(message: Message): Promise<void> {
    const tabs = await chrome.tabs.query({})
    await Promise.all(
      tabs.map(tab => tab.id ? this.sendToTab(tab.id, message) : Promise.resolve())
    )
  }

  onMessage(handler: (message: Message, sender: MessageSender) => void | Promise<void>): () => void {
    const listener = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      const result = handler(message, {
        tab: sender.tab?.id ? { id: sender.tab.id } : undefined,
        frameId: sender.frameId
      })

      // Handle async responses
      if (result instanceof Promise) {
        result.then(sendResponse)
        return true // Keep channel open for async response
      }
    }

    chrome.runtime.onMessage.addListener(listener)

    return () => {
      chrome.runtime.onMessage.removeListener(listener)
    }
  }
}

/**
 * Window PostMessage Adapter
 * Uses window.postMessage for testing
 */
export class WindowMessageAdapter implements MessageAdapter {
  private listeners: Set<(message: Message, sender: MessageSender) => void> = new Set()

  constructor() {
    // Listen for test messages
    window.addEventListener('message', (event) => {
      if (event.source !== window) {
        return
      }

      const isFileProtocol =
        window.location.protocol === 'file:' || event.origin === 'null'
      if (!isFileProtocol && event.origin !== window.location.origin) {
        return
      }

      if (event.data?.source === 'absmartly-test-to-background') {
        const message = event.data.message
        const sender: MessageSender = {
          tab: event.data.tabId ? { id: event.data.tabId } : undefined
        }

        this.listeners.forEach(listener => {
          listener(message, sender)
        })
      }
    })
  }

  async sendToTab(tabId: number, message: Message): Promise<void> {
    // For tests, post back to the window
    window.postMessage({
      source: 'absmartly-background-to-tab',
      tabId,
      message
    }, this.getTargetOrigin())
  }

  async sendToAllTabs(message: Message): Promise<void> {
    // For tests, just broadcast
    window.postMessage({
      source: 'absmartly-background-to-tab',
      message
    }, this.getTargetOrigin())
  }

  onMessage(handler: (message: Message, sender: MessageSender) => void | Promise<void>): () => void {
    this.listeners.add(handler)
    return () => {
      this.listeners.delete(handler)
    }
  }

  private getTargetOrigin(): string {
    return window.location.origin === 'null' ? 'null' : window.location.origin
  }
}
