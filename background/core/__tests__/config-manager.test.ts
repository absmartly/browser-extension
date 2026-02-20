import { Storage } from '@plasmohq/storage'
import {
  validateConfig,
  getConfig,
  initializeConfig
} from '../config-manager'
import { validateAPIEndpoint } from '../../utils/security'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { unsafeAPIEndpoint, unsafeApplicationId } from '~src/types/branded'

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

describe('config-manager', () => {
  describe('validateAPIEndpoint', () => {
    it('should accept valid absmartly.com domain', () => {
      expect(validateAPIEndpoint('https://api.absmartly.com')).toBe(true)
    })

    it('should accept valid absmartly.io domain', () => {
      expect(validateAPIEndpoint('https://api.absmartly.io')).toBe(true)
    })

    it('should accept subdomains of absmartly.com', () => {
      expect(validateAPIEndpoint('https://dev.api.absmartly.com')).toBe(true)
    })

    it('should accept subdomains of absmartly.io', () => {
      expect(validateAPIEndpoint('https://staging.api.absmartly.io')).toBe(true)
    })

    it('should reject non-absmartly domains', () => {
      expect(validateAPIEndpoint('https://evil.com')).toBe(false)
    })

    it('should reject invalid URLs', () => {
      expect(validateAPIEndpoint('not-a-url')).toBe(false)
    })

    it('should reject similar but different domains', () => {
      expect(validateAPIEndpoint('https://absmartly.com.evil.com')).toBe(false)
    })
  })

  describe('validateConfig', () => {
    it('should validate a valid config', () => {
      const config = {
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'jwt' as const
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(true)
      expect(result.config).toEqual(config)
      expect(result.error).toBeUndefined()
    })

    it('should validate config with all optional fields', () => {
      const config: ABsmartlyConfig = {
        apiKey: 'test-key',
        apiEndpoint: unsafeAPIEndpoint('https://api.absmartly.com'),
        applicationId: unsafeApplicationId(123),
        authMethod: 'apikey' as const,
        domChangesFieldName: 'customField',
        queryPrefix: '_exp_',
        persistQueryToCookie: true
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(true)
      expect(result.config).toEqual(config)
    })

    it('should reject config with missing apiEndpoint', () => {
      const config = {
        authMethod: 'jwt'
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject config with invalid apiEndpoint', () => {
      const config = {
        apiEndpoint: 'not-a-url'
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid URL')
    })

    it('should reject config with invalid authMethod', () => {
      const config = {
        apiEndpoint: 'https://api.absmartly.com',
        authMethod: 'invalid'
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject config with negative applicationId', () => {
      const config = {
        apiEndpoint: 'https://api.absmartly.com',
        applicationId: -1
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject config with non-integer applicationId', () => {
      const config = {
        apiEndpoint: 'https://api.absmartly.com',
        applicationId: 1.5
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('getConfig', () => {
    let storage: Storage
    let secureStorage: Storage

    beforeEach(() => {
      storage = new Storage()
      secureStorage = new Storage({ area: 'local', secretKeyring: true } as any)

      jest.clearAllMocks()
    })

    it('should return null when no config is stored', async () => {
      jest.spyOn(storage, 'get').mockResolvedValue(null)
      jest.spyOn(secureStorage, 'get').mockResolvedValue(null)

      const config = await getConfig(storage, secureStorage)
      expect(config).toBeNull()
    })

    it('should return stored config with API key from secure storage', async () => {
      const storedConfig: ABsmartlyConfig = {
        apiEndpoint: unsafeAPIEndpoint('https://api.absmartly.com'),
        authMethod: 'apikey',
        apiKey: ''
      }

      jest.spyOn(storage, 'get').mockResolvedValue(storedConfig)
      jest.spyOn(secureStorage, 'get').mockResolvedValue('secret-api-key')

      const config = await getConfig(storage, secureStorage)
      expect(config).toEqual({
        ...storedConfig,
        apiKey: 'secret-api-key'
      })
    })

    it('should use apiKey from config if secure storage is empty', async () => {
      const storedConfig: ABsmartlyConfig = {
        apiKey: 'fallback-key',
        apiEndpoint: unsafeAPIEndpoint('https://api.absmartly.com'),
        authMethod: 'apikey'
      }

      jest.spyOn(storage, 'get').mockResolvedValue(storedConfig)
      jest.spyOn(secureStorage, 'get').mockResolvedValue(null)

      const config = await getConfig(storage, secureStorage)
      expect(config?.apiKey).toBe('fallback-key')
    })

    it('should throw error for invalid API endpoint domain', async () => {
      const storedConfig: ABsmartlyConfig = {
        apiEndpoint: unsafeAPIEndpoint('https://evil.com'),
        authMethod: 'jwt'
      }

      jest.spyOn(storage, 'get').mockResolvedValue(storedConfig)
      jest.spyOn(secureStorage, 'get').mockResolvedValue(null)

      await expect(getConfig(storage, secureStorage)).rejects.toThrow(
        'Invalid API endpoint: Only ABsmartly domains are allowed'
      )
    })
  })

  describe('initializeConfig', () => {
    let storage: Storage
    let secureStorage: Storage
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
      storage = new Storage()
      secureStorage = new Storage({ area: 'local', secretKeyring: true } as any)
      originalEnv = { ...process.env }

      jest.clearAllMocks()
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should initialize config from environment variables when storage is empty', async () => {
      process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY = 'env-api-key'
      process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT = 'https://api.absmartly.com'
      process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_ID = '456'
      process.env.PLASMO_PUBLIC_ABSMARTLY_AUTH_METHOD = 'apikey'

      jest.spyOn(storage, 'get').mockResolvedValue(null)
      jest.spyOn(secureStorage, 'get').mockResolvedValue(null)
      const setStorageSpy = jest.spyOn(storage, 'set').mockResolvedValue(undefined as any)
      const setSecureStorageSpy = jest.spyOn(secureStorage, 'set').mockResolvedValue(undefined as any)

      await initializeConfig(storage, secureStorage)

      expect(setSecureStorageSpy).toHaveBeenCalledWith('absmartly-apikey', 'env-api-key')
      expect(setStorageSpy).toHaveBeenCalledWith('absmartly-config', expect.objectContaining({
        apiKey: '',
        apiEndpoint: 'https://api.absmartly.com',
        applicationId: 456,
        authMethod: 'apikey'
      }))
    })

    it('should not override existing config values', async () => {
      process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY = 'env-api-key'
      process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT = 'https://api.absmartly.com'

      const existingConfig: ABsmartlyConfig = {
        apiKey: 'existing-key',
        apiEndpoint: unsafeAPIEndpoint('https://existing.absmartly.com'),
        authMethod: 'apikey'
      }

      jest.spyOn(storage, 'get').mockResolvedValue(existingConfig)
      jest.spyOn(secureStorage, 'get').mockResolvedValue('existing-key')
      const setStorageSpy = jest.spyOn(storage, 'set').mockResolvedValue(undefined as any)
      const setSecureStorageSpy = jest.spyOn(secureStorage, 'set').mockResolvedValue(undefined as any)

      await initializeConfig(storage, secureStorage)

      expect(setSecureStorageSpy).not.toHaveBeenCalled()
      expect(setStorageSpy).not.toHaveBeenCalled()
    })

    it('should use default JWT auth method when not specified', async () => {
      delete process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
      delete process.env.PLASMO_PUBLIC_ABSMARTLY_AUTH_METHOD
      delete process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_ID
      process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT = 'https://api.absmartly.com'

      jest.spyOn(storage, 'get').mockResolvedValue(null)
      jest.spyOn(secureStorage, 'get').mockResolvedValue(null)
      const setStorageSpy = jest.spyOn(storage, 'set').mockResolvedValue(undefined as any)

      await initializeConfig(storage, secureStorage)

      expect(setStorageSpy).toHaveBeenCalledWith('absmartly-config', expect.objectContaining({
        authMethod: 'jwt'
      }))
    })

    it('should parse applicationId as integer', async () => {
      process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_ID = '789'
      process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT = 'https://api.absmartly.com'

      jest.spyOn(storage, 'get').mockResolvedValue(null)
      jest.spyOn(secureStorage, 'get').mockResolvedValue(null)
      const setStorageSpy = jest.spyOn(storage, 'set').mockResolvedValue(undefined as any)

      await initializeConfig(storage, secureStorage)

      expect(setStorageSpy).toHaveBeenCalledWith('absmartly-config', expect.objectContaining({
        applicationId: 789
      }))
    })

    it('should handle missing environment variables gracefully', async () => {
      delete process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
      delete process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT
      delete process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_ID
      delete process.env.PLASMO_PUBLIC_ABSMARTLY_AUTH_METHOD

      jest.spyOn(storage, 'get').mockResolvedValue(null)
      jest.spyOn(secureStorage, 'get').mockResolvedValue(null)
      const setStorageSpy = jest.spyOn(storage, 'set').mockResolvedValue(undefined as any)

      await initializeConfig(storage, secureStorage)

      expect(setStorageSpy).not.toHaveBeenCalled()
    })
  })
})
