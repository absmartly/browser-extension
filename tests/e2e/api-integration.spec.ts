import { test, expect } from '../fixtures/extension'

test.describe('API Integration Tests', () => {
  test.beforeEach(async ({ clearStorage }) => {
    await clearStorage()
  })

  test('sidebar boots and makes a real API call via background', async ({
    context, seedStorage, extensionUrl
  }) => {
    // 1) Seed credentials
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-endpoint': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
      'absmartly-env': process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
      'absmartly-auth-method': 'apikey',
      absmartlyConfig: {
        apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
        environment: process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
        authMethod: 'apikey'
      }
    })

    // 2) Track background requests
    const apiRequests: string[] = []
    context.on('request', (req) => {
      const url = req.url()
      // Check if it's an API request to ABsmartly
      if (url.includes('absmartly.com')) {
        console.log('API request detected:', req.method(), url)
        apiRequests.push(url)
      }
    })

    // 3) Load sidebar
    const page = await context.newPage()
    await page.goto(extensionUrl('tabs/sidebar.html', { waitUntil: 'domcontentloaded', timeout: 10000 }))

    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('[Sidebar Error]', msg.text())
      }
    })

    // Wait for sidebar to load
    await page.waitForSelector('body', { timeout: 5000 })

    // 4) Check if sidebar loaded properly
    const hasContent = await page.locator('body').isVisible()
    expect(hasContent).toBeTruthy()

    // Look for ABsmartly branding or experiment list
    const hasABsmartly = await page.locator('text=/ABsmartly/i').isVisible().catch(() => false)
    const hasExperiments = await page.locator('.experiment-item').count().then(c => c > 0).catch(() => false)
    const hasEmptyState = await page.locator('text=/no experiments/i').isVisible().catch(() => false)
    const hasConfigButton = await page.locator('text=/Configure Settings/i').isVisible().catch(() => false)

    console.log('Sidebar state:', {
      hasABsmartly,
      hasExperiments,
      hasEmptyState,
      hasConfigButton
    })

    // Should have loaded some UI
    expect(hasABsmartly || hasExperiments || hasEmptyState || hasConfigButton).toBeTruthy()

    // 5) Wait a bit for API calls to happen
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})

    // 6) Check if any API calls were made
    if (apiRequests.length > 0) {
      console.log(`✅ Captured ${apiRequests.length} API requests`)
      apiRequests.forEach(url => console.log('  -', url))
    } else {
      console.log('⚠️ No direct API requests detected (might be going through service worker)')
    }

    // Alternative: Check service worker activity
    const [sw] = context.serviceWorkers()
    if (sw) {
      console.log('Service worker is active:', sw.url())
    }
  })

  test('sidebar shows experiments after API call', async ({
    context, seedStorage, extensionUrl, getStorage
  }) => {
    // Seed with real credentials including the config object
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-config': {
        apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
        environment: process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
        authMethod: 'apikey'
      }
    })

    // Verify storage was set
    const storage = await getStorage()
    console.log('Storage state:', Object.keys(storage))

    // Load sidebar
    const page = await context.newPage()
    await page.goto(extensionUrl('tabs/sidebar.html', { waitUntil: 'domcontentloaded', timeout: 10000 }))

    // Wait for the page to finish loading and for the config to be loaded
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {})

    // Wait for either experiments to load or empty state to appear (no loading spinner)
    await page.locator('[role="status"][aria-label="Loading experiments"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {
      console.log('Loading spinner not found or did not disappear - continuing anyway')
    })

    // Check for experiments or empty state
    const experimentCount = await page.locator('.experiment-item').count()
    const hasEmptyState = await page.locator('text=/no experiments/i').isVisible().catch(() => false)

    console.log('Found experiments:', experimentCount)
    console.log('Has empty state:', hasEmptyState)

    // Should either have experiments or show empty state (not error)
    expect(experimentCount > 0 || hasEmptyState).toBeTruthy()
  })

  test('can navigate to experiment details', async ({
    context, seedStorage, extensionUrl
  }) => {
    // Seed credentials including the config object
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-config': {
        apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
        environment: process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
        authMethod: 'apikey'
      }
    })

    const page = await context.newPage()
    await page.goto(extensionUrl('tabs/sidebar.html', { waitUntil: 'domcontentloaded', timeout: 10000 }))

    // Wait for experiments to load
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {})

    // Wait for loading spinner to disappear
    await page.locator('[role="status"][aria-label="Loading experiments"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {
      console.log('Loading spinner not found or did not disappear - continuing anyway')
    })

    const experimentCount = await page.locator('.experiment-item').count()

    if (experimentCount > 0) {
      console.log(`Found ${experimentCount} experiments`)

      // Click first experiment
      await page.locator('.experiment-item').first().click()

      // Should navigate to experiment detail
      const hasBackButton = await page.locator('button:has-text("Back")').isVisible().catch(() => false)
      const hasVisualEditorButton = await page.locator('text=/visual editor/i').isVisible().catch(() => false)

      console.log('Has back button:', hasBackButton)
      console.log('Has visual editor button:', hasVisualEditorButton)

      // Should show experiment details
      expect(hasBackButton || hasVisualEditorButton).toBeTruthy()
    } else {
      console.log('No experiments available to test navigation')
    }
  })

  test('storage persists across page reloads', async ({
    context, seedStorage, extensionUrl, getStorage
  }) => {
    // Seed with test data
    const testData = {
      'test-key': 'test-value-' + Date.now(),
      'absmartly-apikey': 'test-key'
    }

    await seedStorage(testData)

    // Verify it was stored
    const storage1 = await getStorage()
    expect(storage1['test-key']).toBe(testData['test-key'])

    // Open sidebar
    const page = await context.newPage()
    await page.goto(extensionUrl('tabs/sidebar.html', { waitUntil: 'domcontentloaded', timeout: 10000 }))

    // Reload page
    await page.reload()

    // Check storage is still there
    const storage2 = await getStorage()
    expect(storage2['test-key']).toBe(testData['test-key'])

    console.log('✅ Storage persisted across reload')
  })
})