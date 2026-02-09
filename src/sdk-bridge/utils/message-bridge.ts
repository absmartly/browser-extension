/**
 * Message Bridge Utility
 *
 * Handles message passing between page context and extension
 *
 * @module MessageBridge
 */

import type { ExtensionMessage } from '../types/messages'
import { Logger } from './logger'

export class MessageBridge {
  /**
   * Send a message to the extension (via content script)
   */
  static sendToExtension(message: ExtensionMessage): void {
    Logger.log('Sending message to extension:', message)
    // SECURITY: Use same-origin only, not wildcard
    window.postMessage(message, window.location.origin)
  }

  /**
   * Listen for messages from the extension
   */
  static onMessage(type: string, handler: (payload: any) => void): void {
    window.addEventListener('message', (event) => {
      if (event.source !== window) {
        return
      }

      // SECURITY: Validate origin to prevent malicious iframes from intercepting
      const isFileProtocol =
        window.location.protocol === 'file:' || event.origin === 'null'
      if (!isFileProtocol && event.origin !== window.location.origin) {
        Logger.warn('[Security] Rejected message from invalid origin:', event.origin)
        return
      }

      if (
        event.data?.source === 'absmartly-extension' &&
        event.data?.type === type
      ) {
        Logger.log('Received message from extension:', event.data)
        handler(event.data.payload)
      }
    })
  }

  /**
   * Listen for all messages from the extension
   */
  static onAnyMessage(handler: (message: ExtensionMessage) => void): void {
    window.addEventListener('message', (event) => {
      if (event.source !== window) {
        return
      }

      // SECURITY: Validate origin to prevent malicious iframes from intercepting
      const isFileProtocol =
        window.location.protocol === 'file:' || event.origin === 'null'
      if (!isFileProtocol && event.origin !== window.location.origin) {
        Logger.warn('[Security] Rejected message from invalid origin:', event.origin)
        return
      }

      if (event.data?.source === 'absmartly-extension') {
        handler(event.data)
      }
    })
  }
}
