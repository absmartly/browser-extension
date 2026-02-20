import { Storage } from '@plasmohq/storage'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { notifyUser } from '~src/utils/notifications'
import { safeParseJSON, parseExperimentsCache, ExperimentsCacheSchema } from '~src/lib/validation-schemas'

import { debugLog, debugWarn } from '~src/utils/debug'
export const storage = new Storage()

export const secureStorage = new Storage({ area: "local" })

export const localAreaStorage = new Storage({ area: "local" })
export const sessionStorage = new Storage({ area: "session" })

export const STORAGE_KEYS = {
  CONFIG: 'absmartly-config',
  RECENT_EXPERIMENTS: 'recent-experiments',
  EXPERIMENTS_CACHE: 'experiments-cache'
} as const

const CHUNK_SIZE = 5000
const MAX_CACHE_CHUNKS = 20
const CHUNK_CLEANUP_LIMIT = 10
const EXPERIMENTS_CACHE_VERSION = 1

export async function getConfig(): Promise<ABsmartlyConfig | null> {
  try {
    const config = await storage.get(STORAGE_KEYS.CONFIG) as ABsmartlyConfig | null

    if (config) {
      config.apiKey = await secureStorage.get("absmartly-apikey") || ''
      config.aiApiKey = await secureStorage.get("ai-apikey") || ''
    }

    return config
  } catch (error) {
    console.error('[Storage] Failed to get config:', error)
    return null
  }
}

export async function setConfig(config: ABsmartlyConfig): Promise<void> {
  try {
    if (config.apiKey) {
      await secureStorage.set("absmartly-apikey", config.apiKey)
    } else {
      await secureStorage.remove("absmartly-apikey")
    }

    if (config.aiApiKey) {
      await secureStorage.set("ai-apikey", config.aiApiKey)
    } else {
      await secureStorage.remove("ai-apikey")
    }

    const configToStore = { ...config, apiKey: '', aiApiKey: '' }
    await storage.set(STORAGE_KEYS.CONFIG, configToStore)
  } catch (error) {
    console.error('[Storage] Failed to save config:', error)
    notifyUser('Failed to save settings. Please try again.', 'error')
    throw error
  }
}

export async function getRecentExperiments(): Promise<number[]> {
  return (await storage.get(STORAGE_KEYS.RECENT_EXPERIMENTS)) || []
}

export async function addRecentExperiment(experimentId: number): Promise<void> {
  const recent = await getRecentExperiments()
  const updated = [experimentId, ...recent.filter(id => id !== experimentId)].slice(0, 10)
  await storage.set(STORAGE_KEYS.RECENT_EXPERIMENTS, updated)
}

export interface ExperimentsCache {
  version: number
  experiments: any[]
  timestamp: number
}

export async function getExperimentsCache(): Promise<ExperimentsCache | null> {
  try {
    const metadata = await storage.get(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta')
    if (!metadata) {
      const data = await storage.get(STORAGE_KEYS.EXPERIMENTS_CACHE)
      debugLog('Cache retrieved (non-chunked):', data ? 'exists' : 'null')
      if (!data) {
        return null
      }

      const validation = ExperimentsCacheSchema.safeParse(data)
      if (!validation.success) {
        console.error('[Storage] Cache validation failed:', validation.error.issues)
        throw new Error(`Cache validation failed: ${validation.error.issues[0].path.join('.')}: ${validation.error.issues[0].message}`)
      }

      if ((validation.data as ExperimentsCache).version !== EXPERIMENTS_CACHE_VERSION) {
        throw new Error('Cache version mismatch')
      }

      return validation.data as unknown as ExperimentsCache
    }

    if ((metadata as any).chunked) {
      if ((metadata as any).version !== EXPERIMENTS_CACHE_VERSION) {
        throw new Error('Cache version mismatch')
      }

      const chunks: string[] = []
      for (let i = 0; i < (metadata as any).chunks; i++) {
        const chunk = await storage.get(STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_' + i)
        if (!chunk) {
          debugWarn(`Missing chunk ${i}, cache is corrupted`)
          throw new Error('Cache corrupted - missing chunks')
        }
        chunks.push(chunk)
      }

      const fullData = chunks.join('')
      if (!fullData) {
        throw new Error('Empty cache data')
      }

      const parseResult = safeParseJSON(fullData, ExperimentsCacheSchema)
      if (parseResult.success) {
        const { data } = parseResult
        if ((data as ExperimentsCache).version !== EXPERIMENTS_CACHE_VERSION) {
          throw new Error('Cache version mismatch')
        }
        debugLog('Cache retrieved (chunked):', data.experiments?.length || 0, 'experiments')
        return data as unknown as ExperimentsCache
      }

      console.error('[Storage] Cache validation failed:', (parseResult as { success: false; error: string }).error)
      throw new Error(`Cache validation failed: ${(parseResult as { success: false; error: string }).error}`)
    } else {
      const data = await storage.get(STORAGE_KEYS.EXPERIMENTS_CACHE)
      return data as unknown as ExperimentsCache | null
    }
  } catch (error) {
    console.error('Error getting experiments cache:', error)

    let errorType = 'corruption'
    let userMessage = 'Experiment cache was corrupted and has been cleared. '

    if (error.message?.includes('quota')) {
      errorType = 'quota'
      userMessage = 'Storage quota exceeded. Consider clearing old data. '
    }

    await clearExperimentsCache()

    notifyUser(userMessage + 'Data will be refreshed from server.', 'warning')

    return null
  }
}

export async function setExperimentsCache(experiments: any[]): Promise<void> {
  try {
    await clearExperimentsCache()

    const minimalExperiments = experiments.map(exp => ({
      id: exp.id,
      name: exp.name,
      display_name: exp.display_name,
      state: exp.state,
      status: exp.status,
      percentage_of_traffic: exp.percentage_of_traffic,
      traffic_split: exp.traffic_split,
      variants: exp.variants?.map((v: any) => ({
        variant: v.variant,
        name: v.name,
        is_control: v.is_control
      })),
      applications: exp.applications?.map((a: any) => ({
        application_id: a.application_id,
        id: a.id,
        name: a.name
      }))
    }))

    const data = {
      version: EXPERIMENTS_CACHE_VERSION,
      experiments: minimalExperiments,
      timestamp: Date.now()
    }

    const dataStr = JSON.stringify(data)
    debugLog(`Cache size: ${dataStr.length} characters`)

    try {
      await storage.set(STORAGE_KEYS.EXPERIMENTS_CACHE, data)
      debugLog('Cached experiments successfully (non-chunked)')
      return
    } catch (directError: any) {
      debugLog('Direct storage failed, trying chunked approach:', directError.message)

      const chunks = Math.ceil(dataStr.length / CHUNK_SIZE)

      if (chunks > MAX_CACHE_CHUNKS) {
        const message = `Cache data too large (${dataStr.length} bytes). Caching disabled.`
        debugWarn('[Storage]', message)
        notifyUser(message + ' Consider deleting old conversations.', 'warning')
        return
      }

      await storage.set(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta', {
        timestamp: Date.now(),
        chunked: true,
        chunks: chunks,
        version: EXPERIMENTS_CACHE_VERSION
      })

      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min((i + 1) * CHUNK_SIZE, dataStr.length)
        const chunk = dataStr.slice(start, end)
        await storage.set(STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_' + i, chunk)
      }

      debugLog(`Cached experiments successfully (${chunks} chunks)`)
    }
  } catch (error) {
    console.error('Error setting experiments cache:', error)

    let userMessage = 'Failed to cache experiments. '
    if (error.message?.includes('quota')) {
      userMessage = 'Storage quota exceeded while caching experiments. '
    }

    await clearExperimentsCache()
    notifyUser(userMessage + 'Data will be fetched fresh from server.', 'warning')
  }
}

export async function clearExperimentsCache(): Promise<void> {
  try {
    await storage.remove(STORAGE_KEYS.EXPERIMENTS_CACHE)
    await storage.remove(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta')
    for (let i = 0; i < CHUNK_CLEANUP_LIMIT; i++) {
      await storage.remove(STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_' + i)
    }
  } catch (error) {
    console.error('Error clearing experiments cache:', error)
  }
}
