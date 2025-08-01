/**
 * SDK Communication Module
 * Handles communication between the ABSmartly Extension and the SDK Plugin
 */

import type { DOMChange } from '../types/dom-changes'

export interface SDKMessage {
  source: 'absmartly-extension'
  type: 'APPLY_CHANGES' | 'REMOVE_CHANGES' | 'GET_VARIANT' | 'SET_VARIANT'
  payload: any
}

export interface SDKResponse {
  source: 'absmartly-sdk'
  type: 'CHANGES_APPLIED' | 'CHANGES_REMOVED' | 'VARIANT_INFO' | 'ERROR'
  payload: any
}

/**
 * Send a message to the SDK plugin on the page
 */
export function sendToSDK(type: SDKMessage['type'], payload: any): void {
  window.postMessage({
    source: 'absmartly-extension',
    type,
    payload
  }, '*')
}

/**
 * Apply DOM changes through the SDK
 */
export function applyDOMChanges(variantName: string, changes: DOMChange[]): void {
  sendToSDK('APPLY_CHANGES', {
    variant: variantName,
    changes
  })
}

/**
 * Remove all DOM changes
 */
export function removeDOMChanges(): void {
  sendToSDK('REMOVE_CHANGES', {})
}

/**
 * Request current variant information
 */
export function requestVariantInfo(): void {
  sendToSDK('GET_VARIANT', {})
}

/**
 * Force a specific variant (for preview)
 */
export function setVariant(experimentName: string, variantName: string): void {
  sendToSDK('SET_VARIANT', {
    experiment: experimentName,
    variant: variantName
  })
}

/**
 * Listen for responses from the SDK
 */
export function listenToSDK(callback: (response: SDKResponse) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.source !== window) return
    if (event.data?.source !== 'absmartly-sdk') return
    
    callback(event.data as SDKResponse)
  }
  
  window.addEventListener('message', handler)
  
  // Return cleanup function
  return () => window.removeEventListener('message', handler)
}