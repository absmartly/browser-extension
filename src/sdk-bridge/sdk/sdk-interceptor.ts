/**
 * SDK Interceptor
 *
 * Intercepts ABsmartly SDK methods to forward events to extension
 *
 * @module SDKInterceptor
 */

import { Logger } from '../utils/logger'

export interface InterceptorCallbacks {
  onSDKEvent?: (eventName: string, data: any) => void
}

export class SDKInterceptor {
  private callbacks: InterceptorCallbacks

  constructor(callbacks: InterceptorCallbacks = {}) {
    this.callbacks = callbacks
  }

  /**
   * Intercept eventLogger calls and forward to callback
   */
  interceptEventLogger(context: any): void {
    Logger.log('[ABsmartly Extension] 🎯 interceptEventLogger called', {
      hasContext: !!context,
      alreadyIntercepted: context?.__eventLoggerIntercepted,
      hasEventLogger: !!context?.eventLogger,
      has_eventLogger: context?._eventLogger !== undefined,
      contextKeys: context ? Object.keys(context).filter((k) => k.includes('event') || k.includes('logger')) : [],
      allContextMethods: context ? Object.keys(context).filter((k) => typeof context[k] === 'function') : [],
      hasTreatment: context && typeof context.treatment === 'function',
      hasReady: context && typeof context.ready === 'function',
      hasPeek: context && typeof context.peek === 'function'
    })

    if (!context || context.__eventLoggerIntercepted) {
      Logger.log('[ABsmartly Extension] ⚠️ Skipping interception - no context or already intercepted')
      return
    }

    const originalEventLogger = context.eventLogger ? context.eventLogger() : null
    Logger.log('[ABsmartly Extension] 📝 Original eventLogger:', {
      hasMethod: !!context.eventLogger,
      originalEventLogger: !!originalEventLogger,
      typeOfOriginal: typeof originalEventLogger
    })

    // Create wrapper eventLogger
    const wrappedEventLogger = (ctx: any, eventName: string, data: any) => {
      Logger.log('[ABsmartly Extension] 🔔 SDK Event:', { eventName, data })

      // Call callback if registered
      if (this.callbacks.onSDKEvent) {
        try {
          this.callbacks.onSDKEvent(eventName, data ? JSON.parse(JSON.stringify(data)) : null)
        } catch (error) {
          Logger.error('[ABsmartly Extension] Error in SDK event callback:', error)
        }
      }

      // Call original eventLogger if it exists
      if (originalEventLogger) {
        originalEventLogger(ctx, eventName, data)
      }
    }

    // Replace the eventLogger
    if (context._eventLogger !== undefined) {
      Logger.log('[ABsmartly Extension] ✅ Replacing context._eventLogger')
      context._eventLogger = wrappedEventLogger
    } else {
      Logger.warn('[ABsmartly Extension] ⚠️ context._eventLogger is undefined, cannot intercept')
    }

    context.__eventLoggerIntercepted = true
    Logger.log('[ABsmartly Extension] ✅ EventLogger intercepted successfully')
  }

  /**
   * Intercept SDK's createContext method to auto-intercept all new contexts
   */
  interceptSDKCreateContext(sdk: any): void {
    if (!sdk || !sdk.createContext || sdk.__createContextIntercepted) {
      return
    }

    const originalCreateContext = sdk.createContext.bind(sdk)
    const self = this

    sdk.createContext = async function (config: any) {
      Logger.log('[ABsmartly Extension] Intercepting createContext call')

      // Call original createContext
      const context = await originalCreateContext(config)

      // Intercept the eventLogger on this new context
      self.interceptEventLogger(context)

      return context
    }

    sdk.__createContextIntercepted = true
    Logger.log('[ABsmartly Extension] SDK createContext intercepted successfully')
  }

  /**
   * Intercept SDK constructor to intercept all SDK instances
   */
  interceptSDKConstructor(sdkModule: any): void {
    if (!sdkModule || !sdkModule.SDK || sdkModule.SDK.__constructorIntercepted) {
      return
    }

    const OriginalSDK = sdkModule.SDK
    const self = this

    // Create a proxy constructor
    sdkModule.SDK = function (config: any) {
      Logger.log('[ABsmartly Extension] Intercepting new SDK() call')

      // Create SDK instance
      const sdkInstance = new OriginalSDK(config)

      // Intercept createContext on this SDK instance
      if (sdkInstance && typeof sdkInstance.createContext === 'function') {
        self.interceptSDKCreateContext(sdkInstance)
      }

      return sdkInstance
    }

    // Copy static properties
    Object.setPrototypeOf(sdkModule.SDK, OriginalSDK)
    Object.assign(sdkModule.SDK, OriginalSDK)

    sdkModule.SDK.__constructorIntercepted = true
    Logger.log('[ABsmartly Extension] SDK constructor intercepted successfully')
  }
}
