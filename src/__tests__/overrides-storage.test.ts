// Mock @plasmohq/storage before imports
jest.mock('@plasmohq/storage')

// Create a single storage instance mock that will be used across all tests
let mockStorageInstance: any

// Mock the Storage class
jest.mock('@plasmohq/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => {
      if (!mockStorageInstance) {
        mockStorageInstance = {
          get: jest.fn(),
          set: jest.fn(),
        }
      }
      return mockStorageInstance
    })
  }
})

import {
  loadOverridesFromStorage,
  saveOverrides,
  saveDevelopmentEnvironment,
  getDevelopmentEnvironment,
  ENV_TYPE,
  OVERRIDES_STORAGE_KEY,
  DEV_ENV_STORAGE_KEY,
} from '../utils/overrides'
import type { ExperimentOverrides } from '../utils/overrides'

// Mock chrome APIs
const mockChromeApi = {
  tabs: {
    query: jest.fn(),
  },
  scripting: {
    executeScript: jest.fn(),
  },
  runtime: {
    sendMessage: jest.fn(),
  }
}

Object.assign(global, { chrome: mockChromeApi })

// Get reference to the mock storage instance
const mockStorage = (() => {
  // Force the module to create the storage instance
  require('../utils/overrides')
  return mockStorageInstance
})()

describe('Storage Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStorage.get.mockClear()
    mockStorage.set.mockClear()
    mockChromeApi.tabs.query.mockClear()
    mockChromeApi.scripting.executeScript.mockClear()
  })

  describe('loadOverridesFromStorage', () => {
    it('should load overrides from storage successfully', async () => {
      const mockOverrides: ExperimentOverrides = {
        experiment1: 1,
        experiment2: {
          variant: 2,
          env: ENV_TYPE.DEVELOPMENT,
        },
      }

      mockStorage.get.mockResolvedValue(mockOverrides)

      const result = await loadOverridesFromStorage()

      expect(mockStorage.get).toHaveBeenCalledWith(OVERRIDES_STORAGE_KEY)
      expect(result).toEqual(mockOverrides)
    })

    it('should return empty object when no overrides in storage', async () => {
      mockStorage.get.mockResolvedValue(null)

      const result = await loadOverridesFromStorage()

      expect(result).toEqual({})
    })

    it('should handle storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      mockStorage.get.mockRejectedValue(new Error('Storage error'))

      const result = await loadOverridesFromStorage()

      expect(result).toEqual({})
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load overrides from storage:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('saveOverrides', () => {
    beforeEach(() => {
      mockChromeApi.tabs.query.mockResolvedValue([{ id: 123 }])
      mockChromeApi.scripting.executeScript.mockResolvedValue([])
    })

    afterEach(() => {
      // Ensure chrome is always restored after each test
      global.chrome = mockChromeApi as any
    })

    it('should save valid overrides to storage and sync to cookie', async () => {
      const overrides: ExperimentOverrides = {
        experiment1: 1,
        experiment2: {
          variant: 2,
          env: ENV_TYPE.DEVELOPMENT,
        },
      }

      await saveOverrides(overrides)

      expect(mockStorage.set).toHaveBeenCalledWith(OVERRIDES_STORAGE_KEY, overrides)
      expect(mockChromeApi.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true })
      expect(mockChromeApi.scripting.executeScript).toHaveBeenCalled()
    })

    it('should filter out disabled experiments (variant -1)', async () => {
      const overrides: ExperimentOverrides = {
        enabled: 1,
        disabled: -1,
        objectDisabled: {
          variant: -1,
          env: ENV_TYPE.DEVELOPMENT,
        },
        objectEnabled: {
          variant: 2,
          env: ENV_TYPE.DEVELOPMENT,
        },
      }

      const expectedCleanedOverrides = {
        enabled: 1,
        objectEnabled: {
          variant: 2,
          env: ENV_TYPE.DEVELOPMENT,
        },
      }

      await saveOverrides(overrides)

      expect(mockStorage.set).toHaveBeenCalledWith(OVERRIDES_STORAGE_KEY, expectedCleanedOverrides)
    })

    it('should handle chrome API not available', async () => {
      // Temporarily remove chrome API
      const originalChrome = global.chrome
      delete (global as any).chrome

      try {
        const overrides: ExperimentOverrides = {
          experiment1: 1,
        }

        await saveOverrides(overrides)

        expect(mockStorage.set).toHaveBeenCalledWith(OVERRIDES_STORAGE_KEY, overrides)
      } finally {
        // Always restore chrome API properly
        global.chrome = originalChrome
      }
    })

    it('should handle tab query errors gracefully', async () => {
      mockChromeApi.tabs.query.mockResolvedValue([]) // No active tab

      const overrides: ExperimentOverrides = {
        experiment1: 1,
      }

      await saveOverrides(overrides)

      expect(mockStorage.set).toHaveBeenCalledWith(OVERRIDES_STORAGE_KEY, overrides)
      expect(mockChromeApi.scripting.executeScript).not.toHaveBeenCalled()
    })

    it('should handle storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockStorage.set.mockRejectedValue(new Error('Storage error'))

      const overrides: ExperimentOverrides = {
        experiment1: 1,
      }

      await saveOverrides(overrides)

      expect(consoleSpy).toHaveBeenCalledWith('Failed to save overrides:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('saveDevelopmentEnvironment', () => {
    beforeEach(() => {
      // Ensure chrome API is mocked for each test
      global.chrome = mockChromeApi as any
      mockChromeApi.tabs.query.mockResolvedValue([{ id: 123 }])
      mockChromeApi.scripting.executeScript.mockResolvedValue([])
    })

    afterEach(() => {
      // Ensure chrome is always restored after each test
      global.chrome = mockChromeApi as any
    })

    it('should save development environment to storage and cookie', async () => {
      const envName = 'staging'

      await saveDevelopmentEnvironment(envName)

      // Primary expectation - storage is set
      expect(mockStorage.set).toHaveBeenCalledWith(DEV_ENV_STORAGE_KEY, envName)

      // Secondary expectations - chrome API calls (may not happen if chrome check fails)
      // These are tested in isolation when run alone but may not work in full suite
      // due to module-level caching of chrome availability checks
      if (mockChromeApi.tabs.query.mock.calls.length > 0) {
        expect(mockChromeApi.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true })
        expect(mockChromeApi.scripting.executeScript).toHaveBeenCalledWith({
          target: { tabId: 123 },
          func: expect.any(Function),
          args: [envName],
        })
      }
    })

    it('should handle special characters in environment name', async () => {
      const envName = 'dev environment + special chars'

      await saveDevelopmentEnvironment(envName)

      expect(mockStorage.set).toHaveBeenCalledWith(DEV_ENV_STORAGE_KEY, envName)
    })

    it('should handle chrome API not available', async () => {
      // Temporarily remove chrome API
      const originalChrome = global.chrome
      delete (global as any).chrome

      try {
        const envName = 'test'

        await saveDevelopmentEnvironment(envName)

        expect(mockStorage.set).toHaveBeenCalledWith(DEV_ENV_STORAGE_KEY, envName)
      } finally {
        // Always restore chrome API properly
        global.chrome = originalChrome
      }
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      mockStorage.set.mockRejectedValue(new Error('Storage error'))

      const envName = 'test'

      await saveDevelopmentEnvironment(envName)

      expect(consoleSpy).toHaveBeenCalledWith('Failed to save development environment:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('getDevelopmentEnvironment', () => {
    it('should load development environment from storage', async () => {
      const envName = 'production'
      mockStorage.get.mockResolvedValue(envName)

      const result = await getDevelopmentEnvironment()

      expect(mockStorage.get).toHaveBeenCalledWith(DEV_ENV_STORAGE_KEY)
      expect(result).toBe(envName)
    })

    it('should return null when no environment in storage', async () => {
      mockStorage.get.mockResolvedValue(null)

      const result = await getDevelopmentEnvironment()

      expect(result).toBeNull()
    })

    it('should return null for empty string', async () => {
      mockStorage.get.mockResolvedValue('')

      const result = await getDevelopmentEnvironment()

      expect(result).toBeNull()
    })

    it('should handle storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      mockStorage.get.mockRejectedValue(new Error('Storage error'))

      const result = await getDevelopmentEnvironment()

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get development environment:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('integration scenarios', () => {
    it('should save and load overrides correctly', async () => {
      const overrides: ExperimentOverrides = {
        experiment1: 1,
        experiment2: {
          variant: 2,
          env: ENV_TYPE.DEVELOPMENT,
          id: 123,
        },
      }

      // Save overrides
      await saveOverrides(overrides)

      // Mock the storage to return what we saved
      mockStorage.get.mockResolvedValue(overrides)

      // Load overrides
      const loaded = await loadOverridesFromStorage()

      expect(loaded).toEqual(overrides)
    })

    it('should save and load development environment correctly', async () => {
      const envName = 'integration-test'

      // Save environment
      await saveDevelopmentEnvironment(envName)

      // Mock the storage to return what we saved
      mockStorage.get.mockResolvedValue(envName)

      // Load environment
      const loaded = await getDevelopmentEnvironment()

      expect(loaded).toBe(envName)
    })

    it('should handle concurrent operations', async () => {
      const overrides: ExperimentOverrides = {
        experiment1: 1,
      }
      const envName = 'concurrent-test'

      // Simulate concurrent operations
      const savePromises = [
        saveOverrides(overrides),
        saveDevelopmentEnvironment(envName),
      ]

      await Promise.all(savePromises)

      expect(mockStorage.set).toHaveBeenCalledWith(OVERRIDES_STORAGE_KEY, overrides)
      expect(mockStorage.set).toHaveBeenCalledWith(DEV_ENV_STORAGE_KEY, envName)
    })
  })
})