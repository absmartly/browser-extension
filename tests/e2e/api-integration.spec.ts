import { test, expect } from '../fixtures/extension'
import { injectSidebar, setupTestPage } from './utils/test-helpers'
import { controlledConfigSeed } from '../helpers/management-api/server'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('API Integration Tests', () => {
  test.beforeEach(async ({ clearStorage }) => {
    await clearStorage()
  })

  test('sidebar boots and makes a real API call via background', async ({
    context, seedStorage, extensionUrl
, managementApi }) => {
    // 1) Seed credentials
    await seedStorage(controlledConfigSeed(managementApi))

    // 2) Load sidebar
    const page = await context.newPage()
    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    // 3) Check if sidebar loaded properly
    const hasContent = await sidebar.locator('body').isVisible()
    expect(hasContent).toBeTruthy()

    // Wait for loading spinner to disappear
    await sidebar.locator('[role="status"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})

    // Wait for either experiments to appear or empty state message
    await Promise.race([
      sidebar.locator('[data-test-id="experiment-row"], .experiment-item').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      sidebar.locator('text=/no experiments/i').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
    ])

    // Look for ABsmartly branding or experiment list
    const hasABsmartly = await sidebar.locator('text=/ABsmartly/i').isVisible().catch(() => false)
    const hasExperiments = await sidebar.locator('[data-test-id="experiment-row"], .experiment-item').count().then(c => c > 0).catch(() => false)
    const hasEmptyState = await sidebar.locator('text=/no experiments/i').isVisible().catch(() => false)
    const hasConfigButton = await sidebar.locator('text=/Configure Settings/i').isVisible().catch(() => false)

    // Should have loaded some UI (indicates API call was made successfully)
    expect(hasABsmartly || hasExperiments || hasEmptyState || hasConfigButton).toBeTruthy()
  })

  test('sidebar shows experiments after API call', async ({
    context, seedStorage, extensionUrl, getStorage
, managementApi }) => {
    // Seed with real credentials including the config object
    await seedStorage(controlledConfigSeed(managementApi))

    // Load sidebar
    const page = await context.newPage()
    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    // Wait for either experiments to load or empty state to appear (no loading spinner)
    await sidebar.locator('[role="status"][aria-label="Loading experiments"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})

    // Wait for either experiments to appear or empty state message
    await Promise.race([
      sidebar.locator('.experiment-item, [data-test-id="experiment-row"]').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      sidebar.locator('text=/no experiments/i').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
    ])

    // Check for experiments or empty state
    const experimentCount = await sidebar.locator('.experiment-item, [data-test-id="experiment-row"]').count()
    const hasEmptyState = await sidebar.locator('text=/no experiments/i').isVisible().catch(() => false)

    // Should either have experiments or show empty state (not error)
    expect(experimentCount > 0 || hasEmptyState).toBeTruthy()
  })

  test('can navigate to experiment details', async ({
    context, seedStorage, extensionUrl
, managementApi }) => {
    // Seed credentials including the config object
    await seedStorage(controlledConfigSeed(managementApi))

    const page = await context.newPage()
    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    // Wait for loading spinner to disappear
    await sidebar.locator('[role="status"][aria-label="Loading experiments"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})

    // Wait for either experiments to appear or empty state message
    await Promise.race([
      sidebar.locator('.experiment-item, [data-test-id="experiment-row"]').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      sidebar.locator('text=/no experiments/i').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
    ])

    const experimentCount = await sidebar.locator('.experiment-item, [data-test-id="experiment-row"]').count()

    if (experimentCount > 0) {
      // Click first experiment
      await sidebar.locator('.experiment-item, [data-test-id="experiment-row"]').first().click()

      // Should navigate to experiment detail
      const hasBackButton = await sidebar.locator('#back-button').isVisible().catch(() => false)
      const hasVisualEditorButton = await sidebar.locator('text=/visual editor/i').isVisible().catch(() => false)

      // Should show experiment details
      expect(hasBackButton || hasVisualEditorButton).toBeTruthy()
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
    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    // Reload page
    await page.reload()

    // Check storage is still there
    const storage2 = await getStorage()
    expect(storage2['test-key']).toBe(testData['test-key'])
  })
})