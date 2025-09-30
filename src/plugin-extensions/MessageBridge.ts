/**
 * MessageBridge
 * Handles communication between the plugin and the browser extension
 * Uses window.postMessage for cross-context communication
 */

export interface ExtensionMessage {
  source: string
  type: string
  payload?: any
}

export type MessageHandler = (payload: any) => void

export class MessageBridge {
  private handlers: Map<string, MessageHandler[]> = new Map()
  private debug: boolean
  private listenerAttached = false

  constructor(debug = false) {
    this.debug = debug
    this.setupListener()
  }

  /**
   * Send a message to the extension
   */
  send(type: string, payload?: any): void {
    const message: ExtensionMessage = {
      source: 'absmartly-page',
      type,
      payload
    }

    if (this.debug) {
      console.log('[MessageBridge] Sending message:', message)
    }

    window.postMessage(message, '*')
  }

  /**
   * Register a handler for incoming messages
   */
  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, [])
    }

    this.handlers.get(type)!.push(handler)

    if (this.debug) {
      console.log(`[MessageBridge] Registered handler for: ${type}`)
    }
  }

  /**
   * Unregister a handler
   */
  off(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type)

    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * Unregister all handlers for a message type
   */
  removeAllHandlers(type: string): void {
    this.handlers.delete(type)
  }

  /**
   * Setup the window message listener
   */
  private setupListener(): void {
    if (this.listenerAttached) {
      return
    }

    window.addEventListener('message', (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'absmartly-extension') {
        return
      }

      const message = event.data as ExtensionMessage

      if (this.debug) {
        console.log('[MessageBridge] Received message:', message)
      }

      this.handleMessage(message)
    })

    this.listenerAttached = true

    if (this.debug) {
      console.log('[MessageBridge] Message listener attached')
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: ExtensionMessage): void {
    const handlers = this.handlers.get(message.type)

    if (!handlers || handlers.length === 0) {
      if (this.debug) {
        console.log(`[MessageBridge] No handlers for message type: ${message.type}`)
      }
      return
    }

    handlers.forEach((handler) => {
      try {
        handler(message.payload)
      } catch (error) {
        console.error(`[MessageBridge] Error in handler for ${message.type}:`, error)
      }
    })
  }

  /**
   * Notify extension that plugin is ready
   */
  notifyReady(version: string, capabilities: string[]): void {
    this.send('PLUGIN_INITIALIZED', {
      version,
      capabilities
    })
  }

  /**
   * Request custom code from extension
   */
  requestCustomCode(): void {
    this.send('REQUEST_CUSTOM_CODE')
  }

  /**
   * Notify extension about experiment trigger
   */
  notifyExperimentTriggered(experimentName: string, variant: number): void {
    this.send('EXPERIMENT_TRIGGERED', {
      experimentName,
      variant
    })
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.handlers.clear()
    // Note: We don't remove the event listener as it might be shared
  }
}
