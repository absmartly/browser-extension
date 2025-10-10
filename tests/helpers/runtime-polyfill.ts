/**
 * Runtime Messaging Polyfill for Tests
 *
 * This module polyfills chrome.runtime messaging APIs to work in test environments.
 * It intercepts both sendMessage and onMessage to route through window.postMessage
 * when running in iframe/test contexts, allowing components to use a single
 * listener pattern instead of dual listeners.
 */

export function setupRuntimePolyfill() {
  if (!(window as any).chrome) {
    (window as any).chrome = {}
  }

  const chrome = (window as any).chrome

  // Create message listeners registry
  const messageListeners: Set<Function> = new Set()

  // Polyfill chrome.runtime.onMessage
  chrome.runtime = chrome.runtime || {}

  const originalOnMessage = chrome.runtime.onMessage

  chrome.runtime.onMessage = {
    // Store original addListener if it exists
    _originalAddListener: originalOnMessage?.addListener,

    addListener: (callback: Function) => {
      messageListeners.add(callback)

      // Also add to original if it exists (for hybrid contexts)
      if (originalOnMessage?.addListener) {
        originalOnMessage.addListener(callback)
      }
    },

    removeListener: (callback: Function) => {
      messageListeners.delete(callback)

      // Also remove from original if it exists
      if (originalOnMessage?.removeListener) {
        originalOnMessage.removeListener(callback)
      }
    },

    hasListener: (callback: Function) => {
      return messageListeners.has(callback)
    }
  }

  // Set up window.postMessage listener to forward to chrome.runtime.onMessage listeners
  window.addEventListener('message', (event: MessageEvent) => {
    // Handle messages from background to extension (test context)
    if (event.data?.source === 'absmartly-extension-incoming') {
      const message = event.data
      const sender = {
        tab: event.data.tabId ? { id: event.data.tabId } : undefined
      }

      // Forward to all registered chrome.runtime.onMessage listeners
      messageListeners.forEach(listener => {
        try {
          listener(message, sender, () => {})
        } catch (error) {
          console.error('[Runtime Polyfill] Error in message listener:', error)
        }
      })
    }
  })

  // Polyfill chrome.runtime.sendMessage to use postMessage in test context
  const originalSendMessage = chrome.runtime.sendMessage

  chrome.runtime.sendMessage = (message: any, callback?: Function) => {
    // In test context, use window.postMessage
    if (window.location.protocol === 'file:' || window.parent !== window) {
      window.postMessage({
        source: 'absmartly-test-to-background',
        ...message
      }, '*')

      // Call callback if provided (simulating async response)
      if (callback) {
        setTimeout(() => callback({ success: true }), 0)
      }

      return Promise.resolve({ success: true })
    }

    // In production context, use original if available
    if (originalSendMessage) {
      return originalSendMessage(message, callback)
    }

    console.warn('[Runtime Polyfill] sendMessage called but no handler available')
    return Promise.resolve({ success: false, error: 'No handler' })
  }

  console.log('✅ Runtime messaging polyfill initialized')
}

/**
 * Helper to clean up polyfill (useful for test cleanup)
 */
export function cleanupRuntimePolyfill() {
  const chrome = (window as any).chrome
  if (chrome?.runtime?.onMessage?._originalAddListener) {
    chrome.runtime.onMessage = {
      addListener: chrome.runtime.onMessage._originalAddListener,
      removeListener: chrome.runtime.onMessage._originalRemoveListener,
      hasListener: chrome.runtime.onMessage._originalHasListener
    }
  }
}
