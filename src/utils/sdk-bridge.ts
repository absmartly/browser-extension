/**
 * Bridge functions to communicate with the ABsmartly SDK on the page
 */

import { Storage } from '@plasmohq/storage'
import { getConfig } from './storage'

// Augment Window interface with SDK-specific properties
declare global {
  interface Window {
    __absmartlyGetVariantAssignments?: (experimentNames: string[]) => Promise<any>
    __absmartlyGetContextPath?: () => string | null
    ABsmartlyContext?: any
    peek?: (key: string) => any
    [key: string]: any
  }
}

const storage = new Storage()

export interface VariantAssignments {
  [experimentName: string]: number // variant index
}

export interface SDKVariantData {
  assignments: VariantAssignments
  experimentsInContext: string[] // Experiments that exist in the SDK context data
}

/**
 * Get current variant assignments from the SDK
 */
export async function getCurrentVariantAssignments(experimentNames: string[]): Promise<SDKVariantData> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id || !tabs[0]?.url) return { assignments: {}, experimentsInContext: [] }

    // Skip restricted URLs
    if (isRestrictedURL(tabs[0].url)) {
      return { assignments: {}, experimentsInContext: [] }
    }

    // Execute in MAIN world to access the page context where the SDK lives
    const result = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      world: 'MAIN',
      func: async (expNames) => {
        // Use the function exposed by our inject script
        // This function handles all the complexity of finding the SDK context
        if (typeof window.__absmartlyGetVariantAssignments === 'function') {
          return await window.__absmartlyGetVariantAssignments(expNames as string[])
        }

        // If function not available, inject script hasn't loaded yet or SDK not present
        return { assignments: {}, experimentsInContext: [] }
      },
      args: [experimentNames]
    })

    return result[0]?.result || { assignments: {}, experimentsInContext: [] }
  } catch (error) {
    // Silently return empty for permission errors
    if (!error.message?.includes('Cannot access contents')) {
      console.warn('Failed to get variant assignments from SDK:', error)
    }
    return { assignments: {}, experimentsInContext: [] }
  }
}

/**
 * Check if a URL is restricted and cannot be accessed by the extension
 */
function isRestrictedURL(url?: string): boolean {
  if (!url) return true

  const restrictedPatterns = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'edge://',
    'https://accounts.google.com',
    'https://login.microsoftonline.com',
    'https://chrome.google.com/webstore'
  ]

  return restrictedPatterns.some(pattern => url.startsWith(pattern))
}

/**
 * Check if the ABsmartly DOM changes plugin is available on the page
 * Uses message passing to avoid accessing the window object directly
 */
export async function isSDKAvailable(): Promise<boolean> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id || !tabs[0]?.url) return false

    // Skip restricted URLs that the extension cannot access
    if (isRestrictedURL(tabs[0].url)) {
      return false
    }

    // Send message to content script which will forward to page script
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'CHECK_PLUGIN_STATUS'
    })

    return response?.pluginDetected || false
  } catch (error) {
    // Silently return false for permission errors (restricted pages)
    // Only log if it's not a "Cannot access contents" error
    if (!error.message?.includes('Cannot access contents')) {
      console.warn('Failed to check plugin availability:', error)
    }
    return false
  }
}

/**
 * Get the SDK context path from the page
 */
export async function getSDKContextPath(): Promise<{ found: boolean; path: string | null }> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id || !tabs[0]?.url) return { found: false, path: null }

    // Skip restricted URLs
    if (isRestrictedURL(tabs[0].url)) {
      return { found: false, path: null }
    }

    const result = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      world: 'MAIN',
      func: () => {
        // Try to use the function exposed by our inject script
        if (typeof window.__absmartlyGetContextPath === 'function') {
          return window.__absmartlyGetContextPath()
        }

        // Fallback: do basic detection
        if (window.ABsmartlyContext && typeof window.ABsmartlyContext.peek === 'function') {
          return { found: true, path: 'ABsmartlyContext' }
        }

        return { found: false, path: null }
      }
    })

    return (result[0]?.result as { found: boolean; path: string | null }) || { found: false, path: null }
  } catch (error) {
    // Silently return false for permission errors
    if (!error.message?.includes('Cannot access contents')) {
      console.warn('Failed to get SDK context path:', error)
    }
    return { found: false, path: null }
  }
}