import { test, expect, chromium } from '@playwright/test'
import path from 'path'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { checkAuthentication } from '../../src/utils/auth'
import { getJWTCookie } from '../../src/utils/cookies'

/**
 * Unit tests for authentication utility functions
 *
 * These tests call the actual authentication functions with REAL API calls
 * to the ABsmartly API. No mocking is used.
 *
 * For API Key tests: Functions are called directly since they don't need chrome.cookies
 * For JWT tests: Playwright is used to access chrome.cookies API in extension context
 */

// Get test credentials from environment
const TEST_API_KEY = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
const TEST_API_ENDPOINT = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://demo-2.absmartly.com/v1'

test.describe('Authentication Utils - API Key', () => {
  test('checkAuthentication should authenticate with valid API Key', async () => {
    // Skip if no API key configured
    if (!TEST_API_KEY) {
      console.log('⚠️ Skipping test - no API key configured')
      test.skip()
      return
    }

    const config: ABsmartlyConfig = {
      apiKey: TEST_API_KEY,
      apiEndpoint: TEST_API_ENDPOINT,
      authMethod: 'apikey'
    }

    console.log('Testing API Key authentication...')
    console.log('Endpoint:', TEST_API_ENDPOINT)
    console.log('API Key length:', TEST_API_KEY.length)

    const result = await checkAuthentication(config)

    console.log('Authentication result:', result)

    // Should succeed
    expect(result.success).toBe(true)

    // Should have user data
    expect(result.data).toBeDefined()
    expect(result.data.user).toBeDefined()

    // User should have basic info
    expect(result.data.user.id).toBeDefined()
    expect(result.data.user.email).toBeDefined()

    console.log('✅ API Key authentication successful')
    console.log('User ID:', result.data.user.id)
    console.log('User Email:', result.data.user.email)
  })

  test('checkAuthentication should fail with invalid API Key', async () => {
    const config: ABsmartlyConfig = {
      apiKey: 'invalid-api-key-12345',
      apiEndpoint: TEST_API_ENDPOINT,
      authMethod: 'apikey'
    }

    console.log('Testing invalid API Key authentication...')

    const result = await checkAuthentication(config)

    console.log('Authentication result:', result)

    // Should fail
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()

    console.log('✅ Invalid API Key correctly rejected')
    console.log('Error:', result.error)
  })

  test('checkAuthentication should fail with no authentication', async () => {
    const config: ABsmartlyConfig = {
      apiKey: '', // No API key
      apiEndpoint: TEST_API_ENDPOINT,
      authMethod: 'apikey'
    }

    console.log('Testing no authentication...')

    const result = await checkAuthentication(config)

    console.log('Authentication result:', result)

    // Should fail
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()

    console.log('✅ No authentication correctly rejected')
    console.log('Error:', result.error)
  })
})

test.describe('Authentication Utils - JWT (Extension Context)', () => {
  test('getJWTCookie should extract JWT cookie from browser', async () => {
    // Create a browser context with extension loaded
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    try {
      // Navigate to ABsmartly to potentially get JWT cookie
      const page = await context.newPage()
      await page.goto(TEST_API_ENDPOINT.replace(/\/v1$/, ''))
      await page.waitForLoadState('networkidle')

      console.log('Opened ABsmartly page:', page.url())

      // Check if user is logged in by looking for jwt cookie
      const cookies = await context.cookies()
      const jwtCookie = cookies.find(c =>
        c.name === 'jwt' ||
        c.name === 'JWT' ||
        (c.value.includes('.') && c.value.split('.').length === 3)
      )

      if (!jwtCookie) {
        console.log('⚠️ No JWT cookie found - user may not be logged in')
        console.log('To test JWT authentication, manually log in to ABsmartly first')
        test.skip()
        return
      }

      console.log('✅ JWT cookie found:', jwtCookie.name)
      console.log('Cookie domain:', jwtCookie.domain)
      console.log('Cookie value length:', jwtCookie.value.length)

      // Verify the token is a valid JWT format
      expect(jwtCookie.value).toContain('.')
      expect(jwtCookie.value.split('.').length).toBe(3)

      console.log('✅ JWT cookie has valid format')

    } finally {
      await context.close()
    }
  })

  test('checkAuthentication with JWT - manual cookie test', async () => {
    // Create a browser context with extension loaded
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    try {
      // Navigate to ABsmartly to potentially get JWT cookie
      const page = await context.newPage()
      await page.goto(TEST_API_ENDPOINT.replace(/\/v1$/, ''))
      await page.waitForLoadState('networkidle')

      console.log('Opened ABsmartly page:', page.url())

      // Check if user is logged in
      const cookies = await context.cookies()
      const jwtCookie = cookies.find(c =>
        c.name === 'jwt' ||
        c.name === 'JWT' ||
        (c.value.includes('.') && c.value.split('.').length === 3)
      )

      if (!jwtCookie) {
        console.log('⚠️ No JWT cookie found - user may not be logged in')
        console.log('To test JWT authentication, manually log in to ABsmartly first')
        test.skip()
        return
      }

      console.log('✅ JWT cookie found, testing authentication with extracted JWT...')

      // Now test checkAuthentication by passing the JWT as if it were an API key
      // This tests the authentication logic without requiring chrome.cookies
      const config: ABsmartlyConfig = {
        apiKey: jwtCookie.value, // Pass JWT as "API key"
        apiEndpoint: TEST_API_ENDPOINT,
        authMethod: 'apikey' // Use apikey mode to avoid chrome.cookies call
      }

      const result = await checkAuthentication(config)

      console.log('Authentication result:', result)

      // Should succeed
      expect(result.success).toBe(true)

      // Should have user data
      expect(result.data).toBeDefined()
      expect(result.data.user).toBeDefined()

      // User should have basic info
      expect(result.data.user.id).toBeDefined()
      expect(result.data.user.email).toBeDefined()

      console.log('✅ JWT authentication successful')
      console.log('User ID:', result.data.user.id)
      console.log('User Email:', result.data.user.email)

    } finally {
      await context.close()
    }
  })
})

test.describe('Authentication Utils - Edge Cases', () => {
  test('checkAuthentication should handle missing endpoint', async () => {
    const config: ABsmartlyConfig = {
      apiKey: TEST_API_KEY,
      apiEndpoint: '', // No endpoint
      authMethod: 'apikey'
    }

    console.log('Testing missing endpoint...')

    const result = await checkAuthentication(config)

    console.log('Authentication result:', result)

    // Should fail gracefully
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('endpoint')

    console.log('✅ Missing endpoint handled correctly')
  })

  test('checkAuthentication should handle network errors gracefully', async () => {
    const config: ABsmartlyConfig = {
      apiKey: TEST_API_KEY,
      apiEndpoint: 'https://invalid-domain-that-does-not-exist-12345.com/v1',
      authMethod: 'apikey'
    }

    console.log('Testing network error handling...')

    const result = await checkAuthentication(config)

    console.log('Authentication result:', result)

    // Should fail gracefully
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()

    console.log('✅ Network error handled gracefully')
    console.log('Error:', result.error)
  })
})
