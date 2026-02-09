/**
 * Integration tests for API client
 * These tests make REAL API calls to the ABsmartly API using credentials from .env.dev.local
 *
 * Run with: npx jest background/core/__tests__/api-client-integration.test.ts
 *
 * @jest-environment node
 */

// We need to reset modules to avoid loading the jsdom setup
jest.resetModules()

import { makeAPIRequest, isAuthError } from '../api-client'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { unsafeAPIEndpoint, unsafeApplicationId } from '~src/types/branded'
import * as fs from 'fs'
import * as path from 'path'

// Mock debug utils
jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

// Mock Chrome APIs since we're running in Node
const mockChrome = {
  cookies: {
    getAll: jest.fn().mockResolvedValue([])
  },
  tabs: {
    create: jest.fn()
  },
  runtime: {
    sendMessage: jest.fn()
  }
}
global.chrome = mockChrome as any

// Load environment variables from .env.dev.local
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    console.warn(`Environment file not found: ${filePath}`)
    return
  }

  const envContent = fs.readFileSync(filePath, 'utf-8')
  envContent.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) return

    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
}

// Load credentials before tests
const envPath = path.join(__dirname, '../../../.env.dev.local')
loadEnvFile(envPath)

// Get config from environment
const authMethod = (process.env.PLASMO_PUBLIC_ABSMARTLY_AUTH_METHOD as 'jwt' | 'apikey') || 'apikey'
const testConfig: ABsmartlyConfig = {
  apiEndpoint: unsafeAPIEndpoint(process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || ''),
  applicationId: process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_ID ?
    unsafeApplicationId(parseInt(process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_ID)) : undefined,
  ...(authMethod === 'apikey'
    ? { authMethod: 'apikey', apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || '' }
    : { authMethod: 'jwt' })
}

describe('API Client Integration Tests', () => {
  // Skip tests if no API key is configured
  const shouldSkip = !testConfig.apiKey || testConfig.apiKey === ''

  beforeAll(() => {
    if (shouldSkip) {
      console.warn('⚠️  Skipping integration tests: No API key found in environment')
      console.warn('   Set PLASMO_PUBLIC_ABSMARTLY_API_KEY in .env.dev.local to run these tests')
    } else {
      console.log('✅ Running integration tests with config:', {
        apiEndpoint: testConfig.apiEndpoint,
        authMethod: testConfig.authMethod,
        hasApiKey: !!testConfig.apiKey,
        applicationId: testConfig.applicationId
      })
    }
  })

  describe('GET /auth/current-user', () => {
    it('should get current user info', async () => {
      if (shouldSkip) {
        console.log('   Skipped')
        return
      }

      const response = await makeAPIRequest(
        'GET',
        '/auth/current-user',
        undefined,
        false,
        testConfig
      )

      expect(response).toBeDefined()
      expect(response.user).toBeDefined()
      expect(response.user.id).toBeDefined()
      expect(response.user.email).toBeDefined()
      console.log('   Current user:', response.user.email)
    }, 30000)

    it('should fail with invalid API key', async () => {
      if (shouldSkip) {
        console.log('   Skipped')
        return
      }

      const invalidConfig: ABsmartlyConfig = {
        apiEndpoint: testConfig.apiEndpoint,
        applicationId: testConfig.applicationId,
        authMethod: 'apikey',
        apiKey: 'invalid-key-123'
      }

      await expect(
        makeAPIRequest('GET', '/auth/current-user', undefined, false, invalidConfig)
      ).rejects.toThrow()
    }, 30000)
  })

  describe('GET /experiments', () => {
    it('should fetch experiments list', async () => {
      if (shouldSkip) {
        console.log('   Skipped')
        return
      }

      const response = await makeAPIRequest(
        'GET',
        '/experiments',
        undefined,
        false,
        testConfig
      )

      expect(response).toBeDefined()
      const experiments = response.experiments || response.data || response
      expect(Array.isArray(experiments)).toBe(true)
      console.log(`   Found ${experiments.length} experiments`)
    }, 30000)
  })

  describe('GET /applications', () => {
    it('should fetch applications list', async () => {
      if (shouldSkip) {
        console.log('   Skipped')
        return
      }

      const response = await makeAPIRequest(
        'GET',
        '/applications',
        undefined,
        false,
        testConfig
      )

      expect(response).toBeDefined()
      const applications = response.applications || response.data || response
      expect(Array.isArray(applications)).toBe(true)
      console.log(`   Found ${applications.length} applications`)
    }, 30000)
  })

  describe('GET /unit_types', () => {
    it('should fetch unit types list', async () => {
      if (shouldSkip) {
        console.log('   Skipped')
        return
      }

      const response = await makeAPIRequest(
        'GET',
        '/unit_types',
        undefined,
        false,
        testConfig
      )

      expect(response).toBeDefined()
      const unitTypes = response.unit_types || response.data || response
      expect(Array.isArray(unitTypes)).toBe(true)
      console.log(`   Found ${unitTypes.length} unit types`)
    }, 30000)
  })

  describe('GET /metrics', () => {
    it('should fetch metrics list', async () => {
      if (shouldSkip) {
        console.log('   Skipped')
        return
      }

      const response = await makeAPIRequest(
        'GET',
        '/metrics',
        undefined,
        false,
        testConfig
      )

      expect(response).toBeDefined()
      const metrics = response.metrics || response.data || response
      expect(Array.isArray(metrics)).toBe(true)
      console.log(`   Found ${metrics.length} metrics`)
    }, 30000)
  })

  describe('GET /experiment_tags', () => {
    it('should fetch experiment tags list', async () => {
      if (shouldSkip) {
        console.log('   Skipped')
        return
      }

      const response = await makeAPIRequest(
        'GET',
        '/experiment_tags',
        undefined,
        false,
        testConfig
      )

      expect(response).toBeDefined()
      const tags = response.experiment_tags || response.data || response
      expect(Array.isArray(tags)).toBe(true)
      console.log(`   Found ${tags.length} experiment tags`)
    }, 30000)
  })

  describe('GET /teams', () => {
    it('should fetch teams list', async () => {
      if (shouldSkip) {
        console.log('   Skipped')
        return
      }

      const response = await makeAPIRequest(
        'GET',
        '/teams',
        undefined,
        false,
        testConfig
      )

      expect(response).toBeDefined()
      const teams = response.teams || response.data || response
      expect(Array.isArray(teams)).toBe(true)
      console.log(`   Found ${teams.length} teams`)
    }, 30000)
  })

  describe('GET /users', () => {
    it('should fetch users list', async () => {
      if (shouldSkip) {
        console.log('   Skipped')
        return
      }

      const response = await makeAPIRequest(
        'GET',
        '/users',
        undefined,
        false,
        testConfig
      )

      expect(response).toBeDefined()
      const users = response.users || response.data || response
      expect(Array.isArray(users)).toBe(true)
      console.log(`   Found ${users.length} users`)
    }, 30000)
  })

  describe('GET /environments', () => {
    it('should fetch environments list', async () => {
      if (shouldSkip) {
        console.log('   Skipped')
        return
      }

      const response = await makeAPIRequest(
        'GET',
        '/environments',
        undefined,
        false,
        testConfig
      )

      expect(response).toBeDefined()
      const environments = response.environments || response.data || response
      expect(Array.isArray(environments)).toBe(true)
      console.log(`   Found ${environments.length} environments`)
    }, 30000)
  })

  describe('Error Handling', () => {
    it('should identify auth errors correctly', () => {
      expect(isAuthError({ response: { status: 401 } })).toBe(true)
      expect(isAuthError({ response: { status: 403 } })).toBe(true)
      expect(isAuthError({ response: { status: 404 } })).toBe(false)
      expect(isAuthError({ response: { status: 500 } })).toBe(false)
    })
  })
})
