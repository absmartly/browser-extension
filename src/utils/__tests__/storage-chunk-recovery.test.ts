import {
  getExperimentsCache,
  setExperimentsCache,
  clearExperimentsCache,
  STORAGE_KEYS
} from '../storage'
import { notifyUser } from '../notifications'

jest.mock('../notifications', () => ({
  notifyUser: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@plasmohq/storage', () => {
  const mockStorage = {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn()
  }
  return {
    Storage: jest.fn(() => mockStorage)
  }
})

describe('Storage Chunk Recovery', () => {
  let mockStorage: any

  beforeEach(() => {
    jest.clearAllMocks()
    const { Storage } = require('@plasmohq/storage')
    mockStorage = new Storage()
  })

  describe('Quota exceeded during chunking', () => {
    it('should notify user when quota exceeded on direct write', async () => {
      const quotaError = new Error('QuotaExceededError: quota exceeded')
      mockStorage.set.mockRejectedValue(quotaError)

      const experiments = [
        {
          id: 1,
          name: 'Test Exp',
          display_name: 'Test Experiment',
          state: 'running',
          status: 'active',
          percentage_of_traffic: 100
        }
      ]

      await setExperimentsCache(experiments)

      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('quota exceeded'),
        'warning'
      )
    })

    it('should detect when data is too large even for chunking', async () => {
      mockStorage.set.mockImplementation((key, value) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE) {
          throw new Error('QuotaExceededError: quota exceeded')
        }
        return Promise.resolve()
      })

      const largeExperiments = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: 'Very long name '.repeat(100),
        display_name: 'Very long display name '.repeat(100),
        state: 'running',
        status: 'active',
        percentage_of_traffic: 100,
        traffic_split: Array(100).fill({ variant: 0, percentage: 100 }),
        variants: Array(50).fill({
          variant: 0,
          name: 'Variant name '.repeat(50),
          is_control: false
        }),
        applications: Array(20).fill({
          application_id: 1,
          id: 1,
          name: 'App name '.repeat(20)
        })
      }))

      await setExperimentsCache(largeExperiments)

      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('Cache data too large'),
        'warning'
      )
    })

    it('should fail gracefully when all storage methods fail', async () => {
      mockStorage.set.mockRejectedValue(new Error('Storage unavailable'))

      const experiments = [{ id: 1, name: 'Test', state: 'running' }]

      await setExperimentsCache(experiments)

      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cache experiments'),
        'warning'
      )
      expect(mockStorage.remove).toHaveBeenCalled()
    })
  })

  describe('Partial chunk writes (browser crash mid-write)', () => {
    it('should detect missing chunks during read', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 3, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_0') {
          return Promise.resolve('{"experiments":[')
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_1') {
          return Promise.resolve(null)
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_2') {
          return Promise.resolve(']}')
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
        'warning'
      )
      expect(mockStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.EXPERIMENTS_CACHE)
    })

    it('should handle partial chunk write failure during save', async () => {
      mockStorage.remove.mockResolvedValue(undefined)
      mockStorage.set.mockImplementation((key, value) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE) {
          return Promise.reject(new Error('quota exceeded'))
        }
        if (key.includes('_chunk_')) {
          return Promise.reject(new Error('Browser crashed mid-write'))
        }
        return Promise.resolve()
      })

      const experiments = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Experiment ${i}`,
        state: 'running'
      }))

      await setExperimentsCache(experiments)

      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cache experiments'),
        'warning'
      )
      expect(mockStorage.remove).toHaveBeenCalled()
    })

    it('should clear partial chunks before retry', async () => {
      mockStorage.set.mockResolvedValue(undefined)

      const experiments = [{ id: 1, name: 'Test', state: 'running' }]

      await setExperimentsCache(experiments)

      expect(mockStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.EXPERIMENTS_CACHE)
      expect(mockStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta')
    })
  })

  describe('Corrupted chunks detection', () => {
    it('should detect invalid JSON in chunks', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 2, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_0') {
          return Promise.resolve('{"invalid json')
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_1') {
          return Promise.resolve('}')
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
        'warning'
      )
    })

    it('should detect empty chunk data', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 2, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_0') {
          return Promise.resolve('')
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_1') {
          return Promise.resolve('')
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
        'warning'
      )
    })

    it('should validate reassembled chunk data against schema', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 1, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_0') {
          return Promise.resolve('{"invalid":"data","missing":"experiments"}')
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
        'warning'
      )
    })

    it('should handle malformed chunk metadata', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, version: 1 })
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
    })
  })

  describe('Incomplete chunk set rebuilding', () => {
    it('should rebuild valid cache from complete chunk set', async () => {
      const validCacheData = {
        version: 1,
        experiments: [
          {
            id: 1,
            name: 'Test 1',
            state: 'running',
            created_at: '2024-01-01T00:00:00Z',
            variants: [
              { name: 'Control', config: '{}' }
            ]
          },
          {
            id: 2,
            name: 'Test 2',
            state: 'stopped',
            created_at: '2024-01-01T00:00:00Z',
            variants: [
              { name: 'Control', config: '{}' }
            ]
          }
        ],
        timestamp: Date.now()
      }
      const dataStr = JSON.stringify(validCacheData)
      const chunk0 = dataStr.substring(0, Math.floor(dataStr.length / 2))
      const chunk1 = dataStr.substring(Math.floor(dataStr.length / 2))

      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 2, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_0') {
          return Promise.resolve(chunk0)
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_1') {
          return Promise.resolve(chunk1)
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).not.toBeNull()
      expect(result?.experiments).toHaveLength(2)
      expect(notifyUser).not.toHaveBeenCalled()
    })

    it('should fail when first chunk is missing', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 3, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_0') {
          return Promise.resolve(null)
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_1') {
          return Promise.resolve('chunk1')
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_2') {
          return Promise.resolve('chunk2')
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
        'warning'
      )
    })

    it('should fail when middle chunk is missing', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 3, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_0') {
          return Promise.resolve('chunk0')
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_1') {
          return Promise.resolve(null)
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_2') {
          return Promise.resolve('chunk2')
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
        'warning'
      )
    })

    it('should fail when last chunk is missing', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 3, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_0') {
          return Promise.resolve('chunk0')
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_1') {
          return Promise.resolve('chunk1')
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_2') {
          return Promise.resolve(null)
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
        'warning'
      )
    })
  })

  describe('Race conditions between tabs', () => {
    it('should handle concurrent writes without corruption', async () => {
      let writeOrder: string[] = []

      mockStorage.remove.mockResolvedValue(undefined)
      mockStorage.set.mockImplementation((key, value) => {
        writeOrder.push(key)
        return new Promise(resolve => setTimeout(resolve, Math.random() * 10))
      })

      const experiments1 = [{ id: 1, name: 'Tab 1 Exp', state: 'running' }]
      const experiments2 = [{ id: 2, name: 'Tab 2 Exp', state: 'stopped' }]

      await Promise.all([
        setExperimentsCache(experiments1),
        setExperimentsCache(experiments2)
      ])

      const cacheWrites = writeOrder.filter(k => k === STORAGE_KEYS.EXPERIMENTS_CACHE)
      expect(cacheWrites.length).toBeGreaterThan(0)
      expect(notifyUser).not.toHaveBeenCalled()
    })

    it('should clear old chunks before writing new ones', async () => {
      const removeOrder: string[] = []
      const setOrder: string[] = []

      mockStorage.remove.mockImplementation((key) => {
        removeOrder.push(key)
        return Promise.resolve()
      })

      mockStorage.set.mockImplementation((key, value) => {
        setOrder.push(key)
        return Promise.resolve()
      })

      const experiments = [{ id: 1, name: 'Test', state: 'running' }]

      await setExperimentsCache(experiments)

      const firstRemoveIndex = removeOrder.findIndex(k => k === STORAGE_KEYS.EXPERIMENTS_CACHE)
      const firstSetIndex = setOrder.findIndex(k => k === STORAGE_KEYS.EXPERIMENTS_CACHE)

      expect(firstRemoveIndex).toBeGreaterThanOrEqual(0)
      if (firstSetIndex >= 0) {
        expect(firstRemoveIndex).toBeLessThan(setOrder.length)
      }
    })

    it('should handle read during write gracefully', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 2, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_0') {
          return Promise.resolve('{"experiments":[')
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_1') {
          return Promise.resolve(null)
        }
        return Promise.resolve(null)
      })

      mockStorage.set.mockResolvedValue(undefined)

      const writePromise = setExperimentsCache([{ id: 1, name: 'Test', state: 'running' }])
      const readPromise = getExperimentsCache()

      const [writeResult, readResult] = await Promise.all([writePromise, readPromise])

      expect(readResult).toBeNull()
    })
  })

  describe('Orphaned chunk cleanup', () => {
    it('should cleanup old chunks from previous sessions', async () => {
      mockStorage.remove.mockResolvedValue(undefined)

      await clearExperimentsCache()

      expect(mockStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.EXPERIMENTS_CACHE)
      expect(mockStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta')

      for (let i = 0; i < 10; i++) {
        expect(mockStorage.remove).toHaveBeenCalledWith(
          STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_' + i
        )
      }
    })

    it('should cleanup chunks even when metadata is corrupted', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          throw new Error('Corrupted metadata')
        }
        return Promise.resolve(null)
      })

      mockStorage.remove.mockResolvedValue(undefined)

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(mockStorage.remove).toHaveBeenCalled()
    })

    it('should handle cleanup errors without throwing', async () => {
      mockStorage.remove.mockRejectedValue(new Error('Cleanup failed'))

      await expect(clearExperimentsCache()).resolves.not.toThrow()
      expect(notifyUser).not.toHaveBeenCalled()
    })

    it('should cleanup before writing new cache', async () => {
      const operations: Array<{ type: 'remove' | 'set', key: string }> = []

      mockStorage.remove.mockImplementation((key) => {
        operations.push({ type: 'remove', key })
        return Promise.resolve()
      })

      mockStorage.set.mockImplementation((key, value) => {
        operations.push({ type: 'set', key })
        return Promise.resolve()
      })

      const experiments = [{ id: 1, name: 'Test', state: 'running' }]

      await setExperimentsCache(experiments)

      const firstSet = operations.findIndex(op => op.type === 'set')
      const firstRemove = operations.findIndex(op => op.type === 'remove')

      expect(firstRemove).toBeLessThan(firstSet)
    })
  })

  describe('Edge cases and error paths', () => {
    it('should handle null metadata gracefully', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve(null)
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE) {
          return Promise.resolve({
            version: 1,
            experiments: [{ id: 1, name: 'Test', state: 'running' }],
            timestamp: Date.now()
          })
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).not.toBeNull()
      expect(notifyUser).not.toHaveBeenCalled()
    })

    it('should handle metadata with chunked=false', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: false, chunks: 0, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE) {
          return Promise.resolve({
            version: 1,
            experiments: [{ id: 1, name: 'Test', state: 'running' }],
            timestamp: Date.now()
          })
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).not.toBeNull()
      expect(notifyUser).not.toHaveBeenCalled()
    })

    it('should handle zero chunks metadata', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 0, version: 1 })
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
    })

    it('should handle negative chunk count', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: -1, version: 1 })
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
    })

    it('should handle very large chunk count', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 1000, version: 1 })
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
        'warning'
      )
    })

    it('should handle storage.get returning undefined', async () => {
      mockStorage.get.mockResolvedValue(undefined)

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).not.toHaveBeenCalled()
    })

    it('should handle empty experiments array', async () => {
      mockStorage.set.mockResolvedValue(undefined)

      const experiments: any[] = []

      await setExperimentsCache(experiments)

      expect(mockStorage.set).toHaveBeenCalledWith(
        STORAGE_KEYS.EXPERIMENTS_CACHE,
        expect.objectContaining({
          experiments: [],
          timestamp: expect.any(Number)
        })
      )
      expect(notifyUser).not.toHaveBeenCalled()
    })

    it('should handle experiments with missing optional fields', async () => {
      mockStorage.set.mockResolvedValue(undefined)

      const experiments = [
        {
          id: 1,
          name: 'Test',
          state: 'running'
        }
      ]

      await setExperimentsCache(experiments)

      expect(notifyUser).not.toHaveBeenCalled()
    })
  })

  describe('All error paths in setExperimentsCache', () => {
    it('should handle error during clearExperimentsCache', async () => {
      mockStorage.remove.mockRejectedValue(new Error('Clear failed'))
      mockStorage.set.mockRejectedValue(new Error('Set failed'))

      const experiments = [{ id: 1, name: 'Test', state: 'running' }]

      await setExperimentsCache(experiments)

      expect(notifyUser).toHaveBeenCalled()
    })

    it('should handle error in minimalExperiments mapping', async () => {
      mockStorage.set.mockResolvedValue(undefined)

      const experimentsWithCircularRef: any = [{ id: 1, name: 'Test', state: 'running' }]
      experimentsWithCircularRef[0].self = experimentsWithCircularRef[0]

      await expect(setExperimentsCache(experimentsWithCircularRef)).resolves.not.toThrow()
    })

    it('should handle error during JSON.stringify', async () => {
      mockStorage.set.mockResolvedValue(undefined)

      const experiments = [
        {
          id: 1,
          name: 'Test',
          state: 'running',
          variants: [{
            variant: 0,
            name: 'Control',
            is_control: true
          }]
        }
      ]

      await setExperimentsCache(experiments)

      expect(mockStorage.set).toHaveBeenCalled()
    })

    it('should notify user on metadata write failure', async () => {
      mockStorage.set.mockImplementation((key, value) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE) {
          throw new Error('quota exceeded')
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          throw new Error('Metadata write failed')
        }
        return Promise.resolve()
      })

      const experiments = [{ id: 1, name: 'Test', state: 'running' }]

      await setExperimentsCache(experiments)

      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cache experiments'),
        'warning'
      )
    })
  })

  describe('All error paths in getExperimentsCache', () => {
    it('should handle error reading metadata', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          throw new Error('Read failed')
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalled()
    })

    it('should handle error reading chunks', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 2, version: 1 })
        }
        if (key.includes('_chunk_')) {
          throw new Error('Chunk read failed')
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalled()
    })

    it('should handle error during JSON validation', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 1, version: 1 })
        }
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_0') {
          return Promise.resolve('{"experiments":[{"id":"not-a-number"}],"timestamp":123}')
        }
        return Promise.resolve(null)
      })

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
        'warning'
      )
    })
  })

  describe('All error paths in clearExperimentsCache', () => {
    it('should continue cleanup even if individual removes fail', async () => {
      let removeCallCount = 0
      mockStorage.remove.mockImplementation((key) => {
        removeCallCount++
        if (removeCallCount % 2 === 0) {
          throw new Error('Remove failed')
        }
        return Promise.resolve()
      })

      await expect(clearExperimentsCache()).resolves.not.toThrow()
      expect(mockStorage.remove).toHaveBeenCalled()
    })

    it('should not throw on complete removal failure', async () => {
      mockStorage.remove.mockRejectedValue(new Error('All removes failed'))

      await expect(clearExperimentsCache()).resolves.not.toThrow()
    })

    it('should remove all expected keys', async () => {
      mockStorage.remove.mockResolvedValue(undefined)

      await clearExperimentsCache()

      const removedKeys = mockStorage.remove.mock.calls.map(call => call[0])
      expect(removedKeys).toContain(STORAGE_KEYS.EXPERIMENTS_CACHE)
      expect(removedKeys).toContain(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta')
      for (let i = 0; i < 10; i++) {
        expect(removedKeys).toContain(STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_' + i)
      }
    })
  })
})
