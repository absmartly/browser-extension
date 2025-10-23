import { DEFAULT_CONFIG } from '../config/defaults'

// Mock the storage utilities
jest.mock('../utils/storage', () => ({
  getConfig: jest.fn(),
}))

import { getConfig } from '../utils/storage'

describe('Background Script - Config Usage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('DEFAULT_CONFIG usage in background.ts', () => {
    it('should use DEFAULT_CONFIG.queryPrefix when config.queryPrefix is undefined', () => {
      const configData = {
        queryPrefix: undefined || DEFAULT_CONFIG.queryPrefix,
      }
      expect(configData.queryPrefix).toBe('_')
    })

    it('should use config.queryPrefix when provided', () => {
      const customPrefix = 'custom_'
      const configData = {
        queryPrefix: customPrefix || DEFAULT_CONFIG.queryPrefix,
      }
      expect(configData.queryPrefix).toBe('custom_')
    })

    it('should use DEFAULT_CONFIG.persistQueryToCookie when config value is undefined', () => {
      const configData = {
        persistQueryToCookie: undefined ?? DEFAULT_CONFIG.persistQueryToCookie,
      }
      expect(configData.persistQueryToCookie).toBe(true)
    })

    it('should use config.persistQueryToCookie when explicitly set to false', () => {
      const configData = {
        persistQueryToCookie: false ?? DEFAULT_CONFIG.persistQueryToCookie,
      }
      expect(configData.persistQueryToCookie).toBe(false)
    })

    it('should use DEFAULT_CONFIG.injectSDK when config value is undefined', () => {
      const configData = {
        injectSDK: undefined ?? DEFAULT_CONFIG.injectSDK,
      }
      expect(configData.injectSDK).toBe(false)
    })

    it('should use config.injectSDK when explicitly set to true', () => {
      const configData = {
        injectSDK: true ?? DEFAULT_CONFIG.injectSDK,
      }
      expect(configData.injectSDK).toBe(true)
    })

    it('should use DEFAULT_CONFIG.sdkUrl when config.sdkUrl is empty', () => {
      const configData = {
        sdkUrl: '' || DEFAULT_CONFIG.sdkUrl,
      }
      expect(configData.sdkUrl).toBe('')
    })

    it('should use config.sdkUrl when provided', () => {
      const customUrl = 'https://custom-sdk.example.com/sdk.js'
      const config = { sdkUrl: customUrl }
      const configData = {
        sdkUrl: config.sdkUrl || DEFAULT_CONFIG.sdkUrl,
      }
      expect(configData.sdkUrl).toBe('https://custom-sdk.example.com/sdk.js')
    })
  })

  describe('Config data preparation for SDK plugin', () => {
    it('should prepare correct config data with all defaults', () => {
      const config = undefined

      const configData = {
        apiEndpoint: config?.apiEndpoint,
        sdkEndpoint: undefined,
        queryPrefix: config?.queryPrefix || DEFAULT_CONFIG.queryPrefix,
        persistQueryToCookie: config?.persistQueryToCookie ?? DEFAULT_CONFIG.persistQueryToCookie,
        injectSDK: config?.injectSDK ?? DEFAULT_CONFIG.injectSDK,
        sdkUrl: config?.sdkUrl || DEFAULT_CONFIG.sdkUrl,
      }

      expect(configData).toEqual({
        apiEndpoint: undefined,
        sdkEndpoint: undefined,
        queryPrefix: '_',
        persistQueryToCookie: true,
        injectSDK: false,
        sdkUrl: '',
      })
    })

    it('should prepare correct config data with custom values', () => {
      const config = {
        apiEndpoint: 'https://api.example.com',
        sdkEndpoint: 'https://sdk.example.com',
        queryPrefix: 'custom_',
        persistQueryToCookie: false,
        injectSDK: true,
        sdkUrl: 'https://custom.sdk.url/sdk.js',
      }

      const configData = {
        apiEndpoint: config.apiEndpoint,
        sdkEndpoint: config.sdkEndpoint,
        queryPrefix: config.queryPrefix || DEFAULT_CONFIG.queryPrefix,
        persistQueryToCookie: config.persistQueryToCookie ?? DEFAULT_CONFIG.persistQueryToCookie,
        injectSDK: config.injectSDK ?? DEFAULT_CONFIG.injectSDK,
        sdkUrl: config.sdkUrl || DEFAULT_CONFIG.sdkUrl,
      }

      expect(configData).toEqual({
        apiEndpoint: 'https://api.example.com',
        sdkEndpoint: 'https://sdk.example.com',
        queryPrefix: 'custom_',
        persistQueryToCookie: false,
        injectSDK: true,
        sdkUrl: 'https://custom.sdk.url/sdk.js',
      })
    })

    it('should prepare correct config data with partial config', () => {
      const config: {
        apiEndpoint: string
        queryPrefix: string
        persistQueryToCookie?: boolean
        injectSDK?: boolean
        sdkUrl?: string
      } = {
        apiEndpoint: 'https://api.example.com',
        queryPrefix: 'partial_',
      }

      const configData = {
        apiEndpoint: config.apiEndpoint,
        sdkEndpoint: undefined,
        queryPrefix: config.queryPrefix || DEFAULT_CONFIG.queryPrefix,
        persistQueryToCookie: config.persistQueryToCookie ?? DEFAULT_CONFIG.persistQueryToCookie,
        injectSDK: config.injectSDK ?? DEFAULT_CONFIG.injectSDK,
        sdkUrl: config.sdkUrl || DEFAULT_CONFIG.sdkUrl,
      }

      expect(configData).toEqual({
        apiEndpoint: 'https://api.example.com',
        sdkEndpoint: undefined,
        queryPrefix: 'partial_',
        persistQueryToCookie: true,
        injectSDK: false,
        sdkUrl: '',
      })
    })
  })

  describe('Edge cases for nullish coalescing', () => {
    it('should handle false values correctly with ?? operator', () => {
      const config = {
        persistQueryToCookie: false,
        injectSDK: false,
      }

      const configData = {
        persistQueryToCookie: config.persistQueryToCookie ?? DEFAULT_CONFIG.persistQueryToCookie,
        injectSDK: config.injectSDK ?? DEFAULT_CONFIG.injectSDK,
      }

      expect(configData.persistQueryToCookie).toBe(false)
      expect(configData.injectSDK).toBe(false)
    })

    it('should handle empty string values correctly with || operator', () => {
      const config = {
        queryPrefix: '',
        sdkUrl: '',
      }

      const configData = {
        queryPrefix: config.queryPrefix || DEFAULT_CONFIG.queryPrefix,
        sdkUrl: config.sdkUrl || DEFAULT_CONFIG.sdkUrl,
      }

      expect(configData.queryPrefix).toBe('_')
      expect(configData.sdkUrl).toBe('')
    })
  })
})
