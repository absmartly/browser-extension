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

describe('storage cache corruption handling', () => {
  let mockStorage: any

  beforeEach(() => {
    jest.clearAllMocks()
    const { Storage } = require('@plasmohq/storage')
    mockStorage = new Storage()
  })

  describe('getExperimentsCache', () => {
    it('should notify user when cache is corrupted', async () => {
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

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        'Experiment cache was corrupted and has been cleared. Data will be refreshed from server.',
        'warning'
      )
    })

    it('should notify user with quota message when quota exceeded', async () => {
      const quotaError = new Error('QuotaExceededError: quota exceeded')
      mockStorage.get.mockRejectedValue(quotaError)

      const result = await getExperimentsCache()

      expect(result).toBeNull()
      expect(notifyUser).toHaveBeenCalledWith(
        'Storage quota exceeded. Consider clearing old data. Data will be refreshed from server.',
        'warning'
      )
    })

    it('should clear cache after corruption', async () => {
      mockStorage.get.mockImplementation((key) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta') {
          return Promise.resolve({ chunked: true, chunks: 1, version: 1 })
        }
        throw new Error('Cache corrupted - missing chunks')
      })

      await getExperimentsCache()

      expect(mockStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.EXPERIMENTS_CACHE)
      expect(mockStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta')
      for (let i = 0; i < 10; i++) {
        expect(mockStorage.remove).toHaveBeenCalledWith(
          STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_' + i
        )
      }
    })

    it('should handle corrupted JSON in chunks', async () => {
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
  })

  describe('setExperimentsCache', () => {
    it('should notify user when caching fails due to quota', async () => {
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
        'Storage quota exceeded while caching experiments. Data will be fetched fresh from server.',
        'warning'
      )
      expect(mockStorage.remove).toHaveBeenCalled()
    })

    it('should notify user when cache data too large for chunking', async () => {
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
      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('Consider deleting old conversations'),
        'warning'
      )
    })

    it('should handle errors during chunk writing', async () => {
      mockStorage.set.mockImplementation((key, value) => {
        if (key === STORAGE_KEYS.EXPERIMENTS_CACHE) {
          throw new Error('quota exceeded')
        }
        if (key.includes('_chunk_')) {
          throw new Error('Failed to write chunk')
        }
        return Promise.resolve()
      })

      const experiments = [
        {
          id: 1,
          name: 'Test',
          display_name: 'Test',
          state: 'running',
          status: 'active'
        }
      ]

      await setExperimentsCache(experiments)

      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cache experiments'),
        'warning'
      )
      expect(mockStorage.remove).toHaveBeenCalled()
    })

    it('should successfully cache without notification on success', async () => {
      mockStorage.set.mockResolvedValue(undefined)

      const experiments = [
        {
          id: 1,
          name: 'Test',
          display_name: 'Test',
          state: 'running',
          status: 'active'
        }
      ]

      await setExperimentsCache(experiments)

      expect(notifyUser).not.toHaveBeenCalled()
    })
  })

  describe('clearExperimentsCache', () => {
    it('should clear all cache-related keys without notification', async () => {
      mockStorage.remove.mockResolvedValue(undefined)

      await clearExperimentsCache()

      expect(mockStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.EXPERIMENTS_CACHE)
      expect(mockStorage.remove).toHaveBeenCalledWith(STORAGE_KEYS.EXPERIMENTS_CACHE + '_meta')
      for (let i = 0; i < 10; i++) {
        expect(mockStorage.remove).toHaveBeenCalledWith(
          STORAGE_KEYS.EXPERIMENTS_CACHE + '_chunk_' + i
        )
      }
      expect(notifyUser).not.toHaveBeenCalled()
    })

    it('should handle errors during cleanup without notification', async () => {
      mockStorage.remove.mockRejectedValue(new Error('Cleanup failed'))

      await clearExperimentsCache()

      expect(notifyUser).not.toHaveBeenCalled()
    })
  })

  describe('error classification', () => {
    it('should distinguish between quota and corruption errors', async () => {
      const quotaError = new Error('QuotaExceededError: quota limit reached')
      mockStorage.get.mockRejectedValue(quotaError)

      await getExperimentsCache()

      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('quota exceeded'),
        'warning'
      )
    })

    it('should handle generic errors as corruption', async () => {
      const genericError = new Error('Unexpected error')
      mockStorage.get.mockRejectedValue(genericError)

      await getExperimentsCache()

      expect(notifyUser).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
        'warning'
      )
    })
  })
})
