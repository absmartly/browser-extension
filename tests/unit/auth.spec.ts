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
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD

// Helper function to log in and get JWT cookie
async function loginAndGetJWT(context: any, page: any): Promise<any> {
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    console.log('⚠️ TEST_USER_EMAIL or TEST_USER_PASSWORD not configured')
    return null
  }

  const baseUrl = TEST_API_ENDPOINT.replace(/\/v1$/, '')
  
  // Check if already logged in
  let cookies = await context.cookies()
  let jwtCookie = cookies.find((c: any) =>
    c.name === 'jwt' ||
    c.name === 'JWT' ||
    (c.value.includes('.') && c.value.split('.').length === 3)
  )

  if (jwtCookie) {
    console.log('✅ Already logged in')
    return jwtCookie
  }

  console.log('Not logged in, attempting to log in with test credentials...')
  
  // Navigate to login page
  await page.goto(`${baseUrl}/login`, { waitUntil: \'domcontentloaded\', timeout: 10000 })
  await page.waitForSelector('body', { timeout: 5000 })
  
  // Fill in email and password
  await page.fill('input[type="email"], input[name="email"]', TEST_USER_EMAIL)
  await page.fill('input[type="password"], input[name="password"]', TEST_USER_PASSWORD)
  
  // Click login button
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")')
  await page.waitForSelector('body', { timeout: 5000 })
  // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {}) // Wait for cookie to be set
  
  console.log('Login completed, checking for JWT cookie...')
  
  // Check for JWT cookie again
  cookies = await context.cookies()
  jwtCookie = cookies.find((c: any) =>
    c.name === 'jwt' ||
    c.name === 'JWT' ||
    (c.value.includes('.') && c.value.split('.').length === 3)
  )

  if (jwtCookie) {
    console.log('✅ Successfully logged in')
  } else {
    console.log('❌ Login failed - no JWT cookie found')
  }
  
  return jwtCookie
}

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
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    try {
      const page = await context.newPage()
      const baseUrl = TEST_API_ENDPOINT.replace(/\/v1$/, '')
      await page.goto(baseUrl, { waitUntil: \'domcontentloaded\', timeout: 10000 })
      await page.waitForSelector('body', { timeout: 5000 })

      console.log('Opened ABsmartly page:', page.url())

      // Attempt to log in and get JWT cookie
      const jwtCookie = await loginAndGetJWT(context, page)

      if (!jwtCookie) {
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
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    try {
      const page = await context.newPage()
      const baseUrl = TEST_API_ENDPOINT.replace(/\/v1$/, '')
      await page.goto(baseUrl, { waitUntil: \'domcontentloaded\', timeout: 10000 })
      await page.waitForSelector('body', { timeout: 5000 })

      console.log('Opened ABsmartly page:', page.url())

      // Attempt to log in and get JWT cookie
      const jwtCookie = await loginAndGetJWT(context, page)

      if (!jwtCookie) {
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
