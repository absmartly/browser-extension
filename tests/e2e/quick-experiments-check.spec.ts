import { test, expect } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import { injectSidebar, debugWait, setupTestPage } from './utils/test-helpers'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('Quick Experiments Check', () => {
  let testPage: Page
  let sidebar: FrameLocator

  test.beforeEach(async ({ context, extensionUrl }) => {
    testPage = await context.newPage()
    const result = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
    sidebar = result.sidebar
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('Check experiments are loading from API', async () => {
    test.setTimeout(30000)

    await debugWait(2000)

    // Wait for loading spinner to disappear
    await sidebar.locator('[role="status"][aria-label="Loading experiments"]')
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {})

    await debugWait(1000)

    // Count experiment items in the sidebar
    const experimentItems = sidebar.locator('[data-testid="experiment-item"]')
    const count = await experimentItems.count()

    // Check sidebar body content to see what loaded
    const bodyText = await sidebar.locator('body').textContent()
    const sidebarLoaded = bodyText && bodyText.includes('Experiments') // The sidebar header
    const hasEmptyState = bodyText && bodyText.includes('No experiments found')

    console.log(`✅ Found ${count} experiments in sidebar`)
    console.log(`✅ Sidebar loaded: ${sidebarLoaded}`)
    console.log(`✅ Empty state shown: ${hasEmptyState}`)

    if (count > 0) {
      const firstExperiment = experimentItems.first()
      const experimentText = await firstExperiment.textContent()
      console.log(`✅ First experiment: ${experimentText}`)
      await expect(firstExperiment).toBeVisible()
      console.log('✅ Experiment item is visible')
    } else if (hasEmptyState) {
      console.log('✅ Sidebar loaded successfully and shows empty state (API returned 0 experiments)')
    } else if (!sidebarLoaded) {
      console.error('❌ Sidebar did not load properly!')
      console.error('Sidebar body content:', bodyText?.substring(0, 500))
    } else {
      console.log('⚠️ Sidebar loaded but no experiments found and empty state not detected')
    }

    // Test passes if sidebar loaded AND either found experiments OR shows empty state
    expect(sidebarLoaded && (count > 0 || hasEmptyState)).toBeTruthy()
  })
})
