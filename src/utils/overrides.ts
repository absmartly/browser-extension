import { Storage } from '@plasmohq/storage'

export const OVERRIDES_COOKIE_NAME = 'absmartly_overrides'
export const OVERRIDES_STORAGE_KEY = 'experiment_overrides'

const storage = new Storage()

export interface ExperimentOverrides {
  [experimentName: string]: number // variant index
}

export function getCookieOverridesScript(): string {
  return `
    (() => {
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('${OVERRIDES_COOKIE_NAME}='))
        ?.split('=')[1];
      return cookieValue ? JSON.parse(decodeURIComponent(cookieValue)) : {};
    })()
  `
}

export function setCookieOverridesScript(overrides: ExperimentOverrides): string {
  const cleanedOverrides = Object.entries(overrides)
    .filter(([_, variant]) => variant !== -1)
    .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {})
  
  if (Object.keys(cleanedOverrides).length === 0) {
    return `document.cookie = '${OVERRIDES_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'`
  }
  
  const expires = new Date()
  expires.setDate(expires.getDate() + 30)
  const cookieValue = encodeURIComponent(JSON.stringify(cleanedOverrides))
  
  return `document.cookie = '${OVERRIDES_COOKIE_NAME}=${cookieValue}; expires=${expires.toUTCString()}; path=/;'`
}

/**
 * Load overrides from chrome.storage.local (primary source)
 */
export async function loadOverridesFromStorage(): Promise<ExperimentOverrides> {
  try {
    const overrides = await storage.get(OVERRIDES_STORAGE_KEY) as ExperimentOverrides
    return overrides || {}
  } catch (error) {
    console.warn('Failed to load overrides from storage:', error)
    return {}
  }
}

/**
 * Save overrides to both chrome.storage.local and cookie
 */
export async function saveOverrides(overrides: ExperimentOverrides): Promise<void> {
  try {
    // Clean up: remove experiments with variant -1 (off)
    const cleanedOverrides = Object.entries(overrides)
      .filter(([_, variant]) => variant !== -1)
      .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {})
    
    // Save to chrome.storage.local (primary)
    await storage.set(OVERRIDES_STORAGE_KEY, cleanedOverrides)
    
    // Sync to cookie for SSR compatibility
    await syncOverridesToCookie(cleanedOverrides)
  } catch (error) {
    console.error('Failed to save overrides:', error)
  }
}

/**
 * Sync overrides to cookie for SSR compatibility
 * This is a secondary storage method that may expire (7 days on Safari)
 */
async function syncOverridesToCookie(overrides: ExperimentOverrides): Promise<void> {
  try {
    // Check if we're in extension popup/background (have access to chrome.tabs)
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tabs[0]?.id) return
      
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (overridesStr) => {
          const overrides = JSON.parse(overridesStr)
          
          if (Object.keys(overrides).length === 0) {
            // Clear cookie if no overrides
            document.cookie = 'absmartly_overrides=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
          } else {
            // Set cookie with 30 day expiry (will be capped at 7 days on Safari)
            const expires = new Date()
            expires.setDate(expires.getDate() + 30)
            document.cookie = `absmartly_overrides=${encodeURIComponent(JSON.stringify(overrides))}; expires=${expires.toUTCString()}; path=/;`
          }
        },
        args: [JSON.stringify(overrides)]
      })
    } else {
      // We're in a content script - set cookie directly
      if (Object.keys(overrides).length === 0) {
        document.cookie = 'absmartly_overrides=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      } else {
        const expires = new Date()
        expires.setDate(expires.getDate() + 30)
        document.cookie = `absmartly_overrides=${encodeURIComponent(JSON.stringify(overrides))}; expires=${expires.toUTCString()}; path=/;`
      }
    }
  } catch (error) {
    console.warn('Failed to sync overrides to cookie:', error)
    // Don't throw - cookie sync is best effort for SSR
  }
}

/**
 * Load overrides from cookie (fallback/migration)
 * This version works in both extension popup and content scripts
 */
export async function loadOverridesFromCookie(): Promise<ExperimentOverrides> {
  try {
    // Check if we're in a content script (no access to chrome.tabs)
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      // We're in extension popup/background
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tabs[0]?.id) return {}
      
      const result = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('absmartly_overrides='))
            ?.split('=')[1]
          return cookieValue ? JSON.parse(decodeURIComponent(cookieValue)) : {}
        }
      })
      
      return result[0]?.result || {}
    } else {
      // We're in a content script - read cookie directly
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('absmartly_overrides='))
        ?.split('=')[1]
      return cookieValue ? JSON.parse(decodeURIComponent(cookieValue)) : {}
    }
  } catch (error) {
    console.warn('Failed to load overrides from cookie:', error)
    return {}
  }
}

/**
 * Initialize overrides on page load
 * Syncs from storage to cookie to ensure SSR compatibility
 */
export async function initializeOverrides(): Promise<ExperimentOverrides> {
  try {
    // Load from storage (primary source)
    const storageOverrides = await loadOverridesFromStorage()
    
    // Also check cookie in case there are overrides not in storage (migration)
    const cookieOverrides = await loadOverridesFromCookie()
    
    // Merge with storage taking precedence
    const mergedOverrides = { ...cookieOverrides, ...storageOverrides }
    
    // If we found any overrides in cookie that weren't in storage, save them
    if (Object.keys(cookieOverrides).length > 0 && 
        JSON.stringify(cookieOverrides) !== JSON.stringify(storageOverrides)) {
      await saveOverrides(mergedOverrides)
    } else if (Object.keys(storageOverrides).length > 0) {
      // Just sync storage to cookie
      await syncOverridesToCookie(storageOverrides)
    }
    
    return mergedOverrides
  } catch (error) {
    console.error('Failed to initialize overrides:', error)
    return {}
  }
}

export async function reloadPageWithOverrides(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id) return
    
    await chrome.tabs.reload(tabs[0].id)
  } catch (error) {
    console.error('Failed to reload page:', error)
  }
}