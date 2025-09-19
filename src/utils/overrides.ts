import { Storage } from '@plasmohq/storage'

export const OVERRIDES_COOKIE_NAME = 'absmartly_overrides'
export const OVERRIDES_STORAGE_KEY = 'experiment_overrides'
export const DEV_ENV_STORAGE_KEY = 'development_environment'
export const DEV_ENV_COOKIE_NAME = 'absmartly_dev_env'

const storage = new Storage()

// Environment types for experiments
export const ENV_TYPE = {
  PRODUCTION: 0,   // Running experiment (no env needed)
  DEVELOPMENT: 1,  // Development mode experiments
  API_FETCH: 2     // Non-running experiments (draft, stopped, etc)
} as const

export interface OverrideValue {
  variant: number
  env?: number  // ENV_TYPE value
  id?: number   // Experiment ID for API fetching
}

export interface ExperimentOverrides {
  [experimentName: string]: number | OverrideValue
}

/**
 * Parse compact cookie format: "devEnv=envName|exp1:variant.env.id,exp2:variant,exp3:variant.env.id"
 * New format uses comma to separate experiments and dot to separate values
 */
export function parseCookieFormat(cookieValue: string): { overrides: ExperimentOverrides, devEnv?: string } {
  if (!cookieValue) return { overrides: {} }

  try {
    let devEnv: string | undefined
    let experimentsStr = cookieValue

    // Check if dev environment is included
    if (cookieValue.startsWith('devEnv=')) {
      const parts = cookieValue.split('|')
      const devEnvPart = parts[0].substring(7) // Remove 'devEnv=' prefix
      devEnv = decodeURIComponent(devEnvPart)
      experimentsStr = parts[1] || ''
    }

    const overrides: ExperimentOverrides = {}
    if (experimentsStr) {
      const experiments = experimentsStr.split(',')

      for (const exp of experiments) {
        const [name, values] = exp.split(':')
        if (!name || !values) continue

        const decodedName = decodeURIComponent(name)
        const parts = values.split('.')

        if (parts.length === 1) {
          // Simple format: just variant (running experiment)
          overrides[decodedName] = parseInt(parts[0], 10)
        } else if (parts.length === 2) {
          // Format: variant.env
          overrides[decodedName] = {
            variant: parseInt(parts[0], 10),
            env: parseInt(parts[1], 10)
          }
        } else {
          // Full format: variant.env.id
          overrides[decodedName] = {
            variant: parseInt(parts[0], 10),
            env: parseInt(parts[1], 10),
            id: parseInt(parts[2], 10)
          }
        }
      }
    }

    return { overrides, devEnv }
  } catch (error) {
    console.warn('Failed to parse override cookie:', error)
    return { overrides: {} }
  }
}

/**
 * Serialize overrides to compact cookie format with optional dev environment
 * New format uses comma to separate experiments and dot to separate values
 */
export function serializeToCookieFormat(overrides: ExperimentOverrides, devEnv?: string | null): string {
  const parts: string[] = []

  for (const [name, value] of Object.entries(overrides)) {
    const encodedName = encodeURIComponent(name)

    if (typeof value === 'number') {
      // Simple format for running experiments
      parts.push(`${encodedName}:${value}`)
    } else {
      // Extended format with env and optional id
      if (value.env !== undefined && value.env !== ENV_TYPE.PRODUCTION) {
        if (value.id !== undefined) {
          // Full format: variant.env.id
          parts.push(`${encodedName}:${value.variant}.${value.env}.${value.id}`)
        } else {
          // Format without id: variant.env
          parts.push(`${encodedName}:${value.variant}.${value.env}`)
        }
      } else {
        // Running experiment stored as object (shouldn't happen, but handle it)
        parts.push(`${encodedName}:${value.variant}`)
      }
    }
  }

  const experimentsStr = parts.join(',')

  // Include dev environment if provided
  if (devEnv) {
    return `devEnv=${encodeURIComponent(devEnv)}|${experimentsStr}`
  }

  return experimentsStr
}

export function getCookieOverridesScript(): string {
  return `
    (() => {
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('${OVERRIDES_COOKIE_NAME}='))
        ?.split('=')[1];
      if (!cookieValue) return {};

      // Parse compact format with experiment ID
      let devEnv = undefined;
      let experimentsStr = cookieValue;

      // Check if dev environment is included
      if (cookieValue.startsWith('devEnv=')) {
        const parts = cookieValue.split('|');
        devEnv = decodeURIComponent(parts[0].substring(7));
        experimentsStr = parts[1] || '';
      }

      const result = {};
      if (experimentsStr) {
        const experiments = experimentsStr.split(',');

        for (const exp of experiments) {
          const [name, values] = exp.split(':');
          if (!name || !values) continue;

          const decodedName = decodeURIComponent(name);
          const parts = values.split('.');

          if (parts.length === 1) {
            result[decodedName] = parseInt(parts[0], 10);
          } else if (parts.length === 2) {
            result[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10)
            };
          } else {
            result[decodedName] = {
              variant: parseInt(parts[0], 10),
              env: parseInt(parts[1], 10),
              id: parseInt(parts[2], 10)
            };
          }
        }
      }

      return result;
    })()
  `
}

export function setCookieOverridesScript(overrides: ExperimentOverrides): string {
  const cleanedOverrides = Object.entries(overrides)
    .filter(([_, value]) => {
      if (value === undefined || value === null) return false
      if (typeof value === 'number') return value !== -1
      return value.variant !== -1
    })
    .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {})

  if (Object.keys(cleanedOverrides).length === 0) {
    return `document.cookie = '${OVERRIDES_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'`
  }

  const expires = new Date()
  expires.setDate(expires.getDate() + 30)
  const cookieValue = serializeToCookieFormat(cleanedOverrides)

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
    console.log('[ABsmartly] saveOverrides called with:', overrides)
    // Clean up: remove experiments with variant -1 (off) and handle undefined/null values
    const cleanedOverrides = Object.entries(overrides)
      .filter(([_, value]) => {
        if (value === undefined || value === null) return false
        if (typeof value === 'number') return value !== -1
        return value.variant !== -1
      })
      .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {})

    console.log('[ABsmartly] Cleaned overrides:', cleanedOverrides)
    // Save to chrome.storage.local (primary)
    await storage.set(OVERRIDES_STORAGE_KEY, cleanedOverrides)

    // Sync to cookie for SSR compatibility
    await syncOverridesToCookie(cleanedOverrides)
  } catch (error) {
    console.error('Failed to save overrides:', error)
  }
}

/**
 * Save the development environment name
 */
export async function saveDevelopmentEnvironment(envName: string): Promise<void> {
  try {
    await storage.set(DEV_ENV_STORAGE_KEY, envName)

    // Also save to cookie for SDK access
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tabs[0]?.id) return

      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (envName) => {
          const expires = new Date()
          expires.setDate(expires.getDate() + 30)
          document.cookie = `absmartly_dev_env=${encodeURIComponent(envName)}; expires=${expires.toUTCString()}; path=/;`
        },
        args: [envName]
      })
    }
  } catch (error) {
    console.error('Failed to save development environment:', error)
  }
}

/**
 * Get the development environment name
 */
export async function getDevelopmentEnvironment(): Promise<string | null> {
  try {
    const envName = await storage.get(DEV_ENV_STORAGE_KEY) as string
    return envName || null
  } catch (error) {
    console.warn('Failed to get development environment:', error)
    return null
  }
}

/**
 * Sync overrides to cookie for SSR compatibility
 * This is a secondary storage method that may expire (7 days on Safari)
 */
async function syncOverridesToCookie(overrides: ExperimentOverrides): Promise<void> {
  try {
    // Get the development environment if any
    const devEnv = await getDevelopmentEnvironment()
    console.log('[ABsmartly] Syncing to cookie - overrides:', overrides, 'devEnv:', devEnv)

    // Check if we're in extension sidebar/background (have access to chrome.tabs)
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tabs[0]?.id) return

      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (overridesStr, devEnvName) => {
          const overrides = JSON.parse(overridesStr)
          console.log('[ABsmartly] Setting cookie - overrides:', overrides, 'devEnv:', devEnvName)

          if (Object.keys(overrides).length === 0 && !devEnvName) {
            // Clear cookie if no overrides and no dev environment
            document.cookie = 'absmartly_overrides=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
          } else {
            // Serialize to compact format (new format)
            const parts = []
            for (const [name, value] of Object.entries(overrides)) {
              const encodedName = encodeURIComponent(name)
              if (typeof value === 'number') {
                parts.push(`${encodedName}:${value}`)
              } else {
                const v = value as any
                if (v.env !== undefined && v.env !== 0) {
                  if (v.id !== undefined) {
                    parts.push(`${encodedName}:${v.variant}.${v.env}.${v.id}`)
                  } else {
                    parts.push(`${encodedName}:${v.variant}.${v.env}`)
                  }
                } else {
                  parts.push(`${encodedName}:${v.variant}`)
                }
              }
            }

            // Include dev environment if provided
            let cookieValue = parts.join(',')
            if (devEnvName) {
              cookieValue = `devEnv=${encodeURIComponent(devEnvName)}|${cookieValue}`
            }

            console.log('[ABsmartly] Final cookie value:', cookieValue)
            const expires = new Date()
            expires.setDate(expires.getDate() + 30)
            document.cookie = `absmartly_overrides=${cookieValue}; expires=${expires.toUTCString()}; path=/;`
          }
        },
        args: [JSON.stringify(overrides), devEnv]
      })
    } else {
      // We're in a content script - set cookie directly
      if (Object.keys(overrides).length === 0) {
        document.cookie = 'absmartly_overrides=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      } else {
        const cookieValue = serializeToCookieFormat(overrides, devEnv)
        const expires = new Date()
        expires.setDate(expires.getDate() + 30)
        document.cookie = `absmartly_overrides=${cookieValue}; expires=${expires.toUTCString()}; path=/;`
      }
    }
  } catch (error) {
    console.warn('Failed to sync overrides to cookie:', error)
    // Don't throw - cookie sync is best effort for SSR
  }
}

/**
 * Load overrides from cookie (fallback/migration)
 * This version works in both extension sidebar and content scripts
 */
export async function loadOverridesFromCookie(): Promise<ExperimentOverrides> {
  try {
    // Check if we're in a content script (no access to chrome.tabs)
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      // We're in extension sidebar/background
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tabs[0]?.id) return {}

      const result = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('absmartly_overrides='))
            ?.split('=')[1]

          if (!cookieValue) return {}

          // Parse compact format with dev env
          let devEnv = undefined
          let experimentsStr = cookieValue

          // Check if dev environment is included
          if (cookieValue.startsWith('devEnv=')) {
            const parts = cookieValue.split('|')
            devEnv = decodeURIComponent(parts[0].substring(7))
            experimentsStr = parts[1] || ''
          }

          const result: any = {}
          if (experimentsStr) {
            const experiments = experimentsStr.split(',')

            for (const exp of experiments) {
              const [name, values] = exp.split(':')
              if (!name || !values) continue

              const decodedName = decodeURIComponent(name)
              const parts = values.split('.')

              if (parts.length === 1) {
                result[decodedName] = parseInt(parts[0], 10)
              } else if (parts.length === 2) {
                result[decodedName] = {
                  variant: parseInt(parts[0], 10),
                  env: parseInt(parts[1], 10)
                }
              } else {
                result[decodedName] = {
                  variant: parseInt(parts[0], 10),
                  env: parseInt(parts[1], 10),
                  id: parseInt(parts[2], 10)
                }
              }
            }
          }

          // Store dev env if found (for migration purposes)
          if (devEnv && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ 'development_environment': devEnv })
          }

          return result
        }
      })

      return result[0]?.result || {}
    } else {
      // We're in a content script - read cookie directly
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('absmartly_overrides='))
        ?.split('=')[1]
      return cookieValue ? parseCookieFormat(cookieValue).overrides : {}
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
    } else if (Object.keys(storageOverrides).length > 0 || (await getDevelopmentEnvironment())) {
      // Sync storage to cookie (including dev environment if it exists)
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