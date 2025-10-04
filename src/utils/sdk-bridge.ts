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
    if (!tabs[0]?.id) return { assignments: {}, experimentsInContext: [] }
    
    // Get the configured SDK window property
    const config = await getConfig()
    const sdkWindowProperty = config?.sdkWindowProperty || null
    
    // Execute in MAIN world to access the page context where the SDK lives
    const result = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      world: 'MAIN',
      func: async (expNames, sdkProp) => {
        console.log('[ABsmartly Extension SDK Bridge] Checking for exposed function...')
        
        // Try to use the function exposed by our inject script
        if (typeof window.__absmartlyGetVariantAssignments === 'function') {
          console.log('[ABsmartly Extension SDK Bridge] Found exposed function, using it')
          return await window.__absmartlyGetVariantAssignments(expNames as string[])
        }
        
        console.warn('[ABsmartly Extension SDK Bridge] No exposed function found, trying direct access...')
        
        // Try the configured SDK property first if provided
        if (sdkProp && typeof sdkProp === 'string') {
          console.log(`[ABsmartly Extension SDK Bridge] Trying configured property: ${sdkProp}`)
          try {
            // Handle nested property paths like "sdk.context"
            const parts = sdkProp.split('.')
            let context = window
            for (const part of parts) {
              context = context[part]
              if (!context) break
            }
            
            if (context && typeof context.peek === 'function') {
              console.log(`[ABsmartly Extension SDK Bridge] Found context at ${sdkProp}`)
              const assignments = {}
              for (const expName of expNames) {
                try {
                  const variant = context.peek(expName)
                  if (variant !== undefined && variant !== null && variant !== -1) {
                    assignments[expName] = variant
                  }
                } catch (error) {
                  console.warn(`Failed to peek ${expName}:`, error)
                }
              }
              return { assignments, experimentsInContext: [] }
            }
          } catch (error) {
            console.warn(`Failed to access configured property ${sdkProp}:`, error)
          }
        }
        
        // Fallback: Try direct access at common locations
        if (window.ABsmartlyContext && typeof window.ABsmartlyContext.peek === 'function') {
          console.log('[ABsmartly Extension SDK Bridge] Found ABsmartlyContext directly')
          const assignments = {}
          for (const expName of expNames) {
            try {
              const variant = window.ABsmartlyContext.peek(expName)
              if (variant !== undefined && variant !== null && variant !== -1) {
                assignments[expName] = variant
              }
            } catch (error) {
              console.warn(`Failed to peek ${expName}:`, error)
            }
          }
          return { assignments, experimentsInContext: [] }
        }
        
        console.warn('[ABsmartly Extension SDK Bridge] No SDK context found')
        return { assignments: {}, experimentsInContext: [] }
      },
      args: [experimentNames, sdkWindowProperty]
    })
    
    return result[0]?.result || { assignments: {}, experimentsInContext: [] }
  } catch (error) {
    console.warn('Failed to get variant assignments from SDK:', error)
    return { assignments: {}, experimentsInContext: [] }
  }
}

/**
 * Check if the ABsmartly SDK is available on the page
 */
export async function isSDKAvailable(): Promise<boolean> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id) return false
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      world: 'MAIN',
      func: () => {
        // Check for our exposed function or direct SDK access
        return typeof window.__absmartlyGetVariantAssignments === 'function' ||
               (window.ABsmartlyContext && typeof window.ABsmartlyContext.peek === 'function')
      }
    })
    
    return result[0]?.result || false
  } catch (error) {
    console.warn('Failed to check SDK availability:', error)
    return false
  }
}

/**
 * Get the SDK context path from the page
 */
export async function getSDKContextPath(): Promise<{ found: boolean; path: string | null }> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id) return { found: false, path: null }
    
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
    console.warn('Failed to get SDK context path:', error)
    return { found: false, path: null }
  }
}