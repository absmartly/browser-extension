/**
 * SDK Detector
 *
 * Detects ABsmartly SDK and context on window object
 *
 * @module SDKDetector
 */

import { Logger } from '../utils/logger'

export interface SDKDetectionResult {
  sdk: any | null
  context: any | null
  contextPath: string | null
}

export class SDKDetector {
  private cachedContext: any = null
  private contextPropertyPath: string | null = null

  /**
   * Detect ABsmartly SDK on the window object
   */
  detectSDK(): SDKDetectionResult {
    // Return cached context if available
    if (this.cachedContext) {
      return {
        sdk: null,
        context: this.cachedContext,
        contextPath: this.contextPropertyPath
      }
    }

    // Check for SDK instances (have createContext method)
    let sdk = null
    const sdkLocations = [
      (window as any).sdk,
      (window as any).absmartly,
      (window as any).ABsmartly,
      (window as any).__absmartly
    ]

    for (const location of sdkLocations) {
      if (location && typeof location.createContext === 'function') {
        sdk = location
        Logger.log('[ABsmartly Extension] SDK instance found')
        break
      }
    }

    // Check common context locations
    const possibleLocations = [
      (window as any).ABsmartlyContext,
      (window as any).absmartly,
      (window as any).ABsmartly,
      (window as any).__absmartly,
      (window as any).sdk,
      (window as any).abSmartly,
      (window as any).context,
      (window as any).absmartlyContext,
      (window as any).__context
    ]

    let context = null

    // First pass: Check if any location is directly a context (has treatment method)
    for (const location of possibleLocations) {
      if (location && typeof location.treatment === 'function') {
        context = location
        break
      }
    }

    // Second pass: Check if any location has a context property with treatment method
    if (!context) {
      for (const location of possibleLocations) {
        if (location && location.context && typeof location.context.treatment === 'function') {
          context = location.context
          break
        }
      }
    }

    // Third pass: Check for contexts array
    if (!context) {
      for (const location of possibleLocations) {
        if (location && location.contexts && Array.isArray(location.contexts) && location.contexts.length > 0) {
          // Check each context in the array for treatment method
          for (const ctx of location.contexts) {
            if (ctx && typeof ctx.treatment === 'function') {
              context = ctx
              break
            }
          }
          if (context) break
        }
      }
    }

    // Cache the context and its location for future use
    if (context && !this.cachedContext) {
      this.cachedContext = context

      // Store where we found it
      if ((window as any).ABsmartlyContext === context) {
        this.contextPropertyPath = 'ABsmartlyContext'
      } else if ((window as any).absmartly === context) {
        this.contextPropertyPath = 'absmartly'
      } else if ((window as any).sdk && (window as any).sdk.context === context) {
        this.contextPropertyPath = 'sdk.context'
      } else {
        this.contextPropertyPath = 'unknown'
      }

      Logger.log('[ABsmartly Extension] ✅ Context found and cached at:', this.contextPropertyPath)
      Logger.log('[ABsmartly Extension] 📊 Context details:', {
        hasTreatment: !!context.treatment,
        hasPeek: !!context.peek,
        hasData: !!context.data,
        hasEventLogger: !!context.eventLogger,
        has_eventLogger: context._eventLogger !== undefined,
        contextType: typeof context
      })
    } else if (!context) {
      Logger.warn('[ABsmartly Extension] ⚠️ No context found after detection')
    }

    return { sdk, context, contextPath: this.contextPropertyPath }
  }

  /**
   * Get cached context
   */
  getCachedContext(): any | null {
    return this.cachedContext
  }

  /**
   * Get context property path
   */
  getContextPath(): string | null {
    return this.contextPropertyPath
  }

  /**
   * Clear cached context
   */
  clearCache(): void {
    this.cachedContext = null
    this.contextPropertyPath = null
  }
}
