import { Storage } from '@plasmohq/storage'
import type { ABSmartlyConfig } from '~src/types/absmartly'

const storage = new Storage()

export const STORAGE_KEYS = {
  CONFIG: 'absmartly-config',
  RECENT_EXPERIMENTS: 'recent-experiments',
  EXPERIMENTS_CACHE: 'experiments-cache'
} as const

export async function getConfig(): Promise<ABSmartlyConfig | null> {
  return await storage.get(STORAGE_KEYS.CONFIG)
}

export async function setConfig(config: ABSmartlyConfig): Promise<void> {
  await storage.set(STORAGE_KEYS.CONFIG, config)
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
  experiments: any[]
  timestamp: number
}

// Helper to handle large data by chunking
const CHUNK_SIZE = 5000 // Safe size for Chrome storage

export async function getExperimentsCache(): Promise<ExperimentsCache | null> {
  try {
    // First try to get metadata
    const metadata = await storage.get(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta')
    if (!metadata) {
      // Try to get non-chunked data
      const data = await storage.get(STORAGE_KEYS.EXPERIMENTS_CACHE)
      console.log('Cache retrieved (non-chunked):', data ? 'exists' : 'null')
      return data
    }
    
    // If data is chunked, retrieve all chunks
    if (metadata.chunked) {
      const chunks: string[] = []
      for (let i = 0; i < metadata.chunks; i++) {
        const chunk = await storage.get(STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_' + i)
        if (!chunk) {
          console.warn(`Missing chunk ${i}, cache is corrupted`)
          throw new Error('Cache corrupted - missing chunks')
        }
        chunks.push(chunk)
      }
      
      // Reassemble the data
      const fullData = chunks.join('')
      if (!fullData) {
        throw new Error('Empty cache data')
      }
      
      const cacheData = JSON.parse(fullData)
      console.log('Cache retrieved (chunked):', cacheData.experiments?.length || 0, 'experiments')
      
      // The cached data already has experiments and timestamp
      return cacheData
    } else {
      // Data wasn't chunked, get it directly
      const data = await storage.get(STORAGE_KEYS.EXPERIMENTS_CACHE)
      return data
    }
  } catch (error) {
    console.error('Error getting experiments cache:', error)
    // Clear corrupted cache
    await clearExperimentsCache()
    return null
  }
}

export async function setExperimentsCache(experiments: any[]): Promise<void> {
  try {
    // Clear any old cache first to free up space
    await clearExperimentsCache()
    
    // Reduce the size by only keeping essential fields for the list view
    const minimalExperiments = experiments.map(exp => ({
      id: exp.id,
      name: exp.name,
      display_name: exp.display_name,
      state: exp.state,
      status: exp.status,
      percentage_of_traffic: exp.percentage_of_traffic,
      traffic_split: exp.traffic_split,
      // Only keep variant names and IDs, not full config to save space
      variants: exp.variants?.map((v: any) => ({
        variant: v.variant,
        name: v.name,
        is_control: v.is_control
        // Remove config to save space - it will be fetched on demand
      })),
      applications: exp.applications?.map((a: any) => ({
        application_id: a.application_id,
        id: a.id,
        name: a.name
      }))
    }))
    
    const data = {
      experiments: minimalExperiments,
      timestamp: Date.now()
    }
    
    // Convert to string to check size
    const dataStr = JSON.stringify(data)
    console.log(`Cache size: ${dataStr.length} characters`)
    
    // Try to store directly first (most common case)
    try {
      await storage.set(STORAGE_KEYS.EXPERIMENTS_CACHE, data)
      console.log('Cached experiments successfully (non-chunked)')
      return
    } catch (directError: any) {
      console.log('Direct storage failed, trying chunked approach:', directError.message)
      
      // If direct storage fails, try chunking the JSON string
      const chunks = Math.ceil(dataStr.length / CHUNK_SIZE)
      
      if (chunks > 20) {
        // Too many chunks, don't cache
        console.warn('Data too large even for chunking, skipping cache')
        return
      }
      
      // Store metadata
      await storage.set(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta', {
        timestamp: Date.now(),
        chunked: true,
        chunks: chunks
      })
      
      // Store each chunk
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min((i + 1) * CHUNK_SIZE, dataStr.length)
        const chunk = dataStr.slice(start, end)
        await storage.set(STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_' + i, chunk)
      }
      
      console.log(`Cached experiments successfully (${chunks} chunks)`)
    }
  } catch (error) {
    console.error('Error setting experiments cache:', error)
    // Clear cache on any error to prevent corruption
    await clearExperimentsCache()
  }
}

export async function clearExperimentsCache(): Promise<void> {
  try {
    await storage.remove(STORAGE_KEYS.EXPERIMENTS_CACHE)
    await storage.remove(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta')
    // Clear up to 10 chunks
    for (let i = 0; i < 10; i++) {
      await storage.remove(STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_' + i)
    }
  } catch (error) {
    console.error('Error clearing experiments cache:', error)
  }
}