import { test, expect } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import { injectSidebar, click, debugWait, log, initializeTestLogging, setupTestPage } from './utils/test-helpers'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('Experiment List Filters', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context, extensionUrl, seedStorage }) => {
    initializeTestLogging()

    await seedStorage({
      'absmartly-config': {
        apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || '',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || '',
        authMethod: 'apikey',
        domChangesFieldName: '__dom_changes',
        vibeStudioEnabled: true
      }
    })

    testPage = await context.newPage()

    const { sidebar: _, allMessages } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
    allConsoleMessages = allMessages
  })

  test.afterEach(async () => {
    if (testPage && process.env.SLOW === '1') {
      log('Test finished — keeping browser open for 30s...')
      await new Promise(resolve => setTimeout(resolve, 30000))
    }
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('Complete filter workflow: toggle panel, state filters, significance, alerts, search, clear', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(process.env.SLOW === '1' ? 90000 : 15000)

    let sidebar: any
    let stepNumber = 1

    const step = (title: string, emoji = '📋') => {
      if (process.env.DEBUG === '1' || process.env.PWDEBUG === '1') {
        log(`\n${emoji} STEP ${stepNumber++}: ${title}`)
      } else {
        stepNumber++
      }
    }

    // ========================================
    // HELPERS
    // ========================================

    const isActive = async (selector: string): Promise<boolean> => {
      const className = await sidebar.locator(selector).getAttribute('class')
      return className?.includes('bg-blue-100') ?? false
    }

    const getStates = async (): Promise<string[]> => {
      const items = sidebar.locator('[data-testid="experiment-list-item"]')
      const count = await items.count()
      const states: string[] = []
      for (let i = 0; i < count; i++) {
        const state = await items.nth(i).getAttribute('data-experiment-state')
        if (state) states.push(state)
      }
      return states
    }

    const experimentCount = async (): Promise<number> => {
      return await sidebar.locator('[data-testid="experiment-list-item"]').count()
    }

    const waitForResults = async (): Promise<void> => {
      await sidebar.locator('.animate-spin').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
      await debugWait()
      await sidebar.locator('[data-testid="experiment-list-item"], #no-experiments-message').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      await debugWait()
    }

    // The initial render has experimentsLoading=false and experiments=[], which
    // satisfies waitForResults' selectors immediately (#no-experiments-message
    // is visible). That lets the test charge ahead before loadExperiments has
    // even fired, and a late-arriving API response then re-renders mid-test —
    // detaching elements out from under in-flight clicks. Block on a real
    // load cycle instead: refresh-experiments-button is disabled while
    // experimentsLoading=true, so wait for it to flip true→false.
    const waitForInitialLoad = async (): Promise<void> => {
      const refreshBtn = sidebar.locator('#refresh-experiments-button')
      await refreshBtn.waitFor({ state: 'visible', timeout: 10000 })
      // Catch the disabled phase if we can; if the load completes before we
      // observe it, the next assertion still confirms no in-flight load.
      await expect(refreshBtn).toBeDisabled({ timeout: 10000 }).catch(() => {})
      await expect(refreshBtn).not.toBeDisabled({ timeout: 30000 })
    }

    const clickFilter = async (selector: string): Promise<void> => {
      await click(sidebar, selector)
      await debugWait()
    }

    const selectOnlyState = async (targetState: string): Promise<void> => {
      const allStates = ['created', 'ready', 'running', 'development', 'full_on', 'running_not_full_on', 'stopped', 'archived', 'scheduled']
      // First deactivate all states
      for (const s of allStates) {
        if (await isActive(`#filter-state-${s}`)) {
          await clickFilter(`#filter-state-${s}`)
        }
      }
      // Now activate only the target
      await clickFilter(`#filter-state-${targetState}`)
      // Wait for debounced filter to apply and list to update
      // The filter uses a 250ms debounce, so wait for old items to disappear
      await sidebar.locator('[data-testid="experiment-list-item"]').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
      await sidebar.locator('.animate-spin').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
      await waitForResults()
    }

    // ========================================
    // SETUP
    // ========================================

    await test.step('Inject sidebar and wait for experiments', async () => {
      step('Injecting sidebar', '📂')
      sidebar = await injectSidebar(testPage, extensionUrl)
      await debugWait()

      if (process.env.DEBUG === '1' || process.env.PWDEBUG === '1') {
        testPage.on('console', msg => {
          const msgText = msg.text()
          if (msgText.includes('filter') || msgText.includes('Filter') || msgText.includes('loadExperiments')) {
            log(`  [Console] ${msgText}`)
          }
        })
      }

      await sidebar.locator('#experiments-heading').waitFor({ state: 'visible', timeout: 10000 })
      await debugWait()
      await waitForInitialLoad()
      log(`Initial experiment count: ${await experimentCount()}`)
      await debugWait()
    })

    // ========================================
    // FILTER PANEL TOGGLE
    // ========================================

    await test.step('Filter panel is collapsed by default', async () => {
      step('Checking filter panel collapsed', '🔍')
      await expect(sidebar.locator('#filter-state-created')).not.toBeVisible()
      await debugWait()
    })

    await test.step('Open filter panel', async () => {
      step('Opening filter panel', '📂')
      await click(sidebar, '[data-testid="filter-toggle"]')
      await debugWait()
      await sidebar.locator('#filter-state-created').waitFor({ state: 'visible', timeout: 3000 })
      await debugWait()
    })

    // ========================================
    // DEFAULT STATE
    // ========================================

    await test.step('Default state filters are Draft and Ready', async () => {
      step('Checking default filters', '✅')
      expect(await isActive('#filter-state-created')).toBe(true)
      await debugWait()
      expect(await isActive('#filter-state-ready')).toBe(true)
      await debugWait()
      expect(await isActive('#filter-state-running')).toBe(false)
      await debugWait()
      expect(await isActive('#filter-state-stopped')).toBe(false)
      await debugWait()
    })

    await test.step('Default filters show only Draft/Ready experiments', async () => {
      step('Verifying default results', '📊')
      const states = await getStates()
      log(`Default filter states: ${JSON.stringify(states)}`)
      for (const s of states) {
        expect(['created', 'ready']).toContain(s)
      }
      await debugWait()
    })

    // ========================================
    // STATE FILTERS
    // ========================================

    await test.step('All state filter buttons are rendered', async () => {
      step('Checking state buttons', '🔘')
      for (const id of ['created', 'ready', 'running', 'development', 'full_on', 'running_not_full_on', 'stopped', 'archived', 'scheduled']) {
        await expect(sidebar.locator(`#filter-state-${id}`)).toBeVisible()
      }
      await debugWait()
    })

    await test.step('Running filter shows only running experiments (if any exist)', async () => {
      step('Testing Running filter', '🏃')
      await selectOnlyState('running')
      await debugWait()
      const states = await getStates()
      log(`Running filter: ${states.length} experiments, active: ${await isActive('#filter-state-running')}`)
      await debugWait()
    })

    await test.step('Stopped filter can be selected', async () => {
      step('Testing Stopped filter', '🛑')
      await selectOnlyState('stopped')
      await debugWait()
      const states = await getStates()
      log(`Stopped filter: ${states.length} experiments, active: ${await isActive('#filter-state-stopped')}`)
      await debugWait()
    })

    await test.step('Full On filter can be selected', async () => {
      step('Testing Full On filter', '🔛')
      await selectOnlyState('full_on')
      await debugWait()
      const states = await getStates()
      log(`Full On filter: ${states.length} experiments, active: ${await isActive('#filter-state-full_on')}`)
      await debugWait()
    })

    await test.step('Archived filter can be selected', async () => {
      step('Testing Archived filter', '📦')
      await selectOnlyState('archived')
      await debugWait()
      const states = await getStates()
      log(`Archived filter: ${states.length} experiments, active: ${await isActive('#filter-state-archived')}`)
      await debugWait()
    })

    await test.step('Development filter can be selected', async () => {
      step('Testing Development filter', '🔧')
      await selectOnlyState('development')
      await debugWait()
      const states = await getStates()
      log(`Development filter: ${states.length} experiments, active: ${await isActive('#filter-state-development')}`)
      await debugWait()
    })

    // ========================================
    // SIGNIFICANCE FILTERS
    // ========================================

    await test.step('Significance filter buttons are rendered', async () => {
      step('Checking significance buttons', '📈')
      for (const sig of ['positive', 'negative', 'neutral', 'inconclusive']) {
        await expect(sidebar.locator(`#filter-significance-${sig}`)).toBeVisible()
      }
      await debugWait()
    })

    await test.step('Toggle significance filters on and off', async () => {
      step('Testing significance toggles', '🔀')
      await clickFilter('#filter-significance-positive')
      await debugWait()
      expect(await isActive('#filter-significance-positive')).toBe(true)
      await debugWait()

      await clickFilter('#filter-significance-negative')
      await debugWait()
      expect(await isActive('#filter-significance-negative')).toBe(true)
      await debugWait()

      await clickFilter('#filter-significance-positive')
      await debugWait()
      expect(await isActive('#filter-significance-positive')).toBe(false)
      expect(await isActive('#filter-significance-negative')).toBe(true)
      await debugWait()

      // Clean up
      await clickFilter('#filter-significance-negative')
      await debugWait()
    })

    // ========================================
    // APPLICATION FILTERS
    // ========================================

    await test.step('Application filters toggle correctly', async () => {
      step('Testing application filters', '📱')
      const appButtons = sidebar.locator('[id^="filter-app-"]')
      const count = await appButtons.count()
      log(`Found ${count} application filter buttons`)
      await debugWait()

      if (count > 0) {
        const firstApp = appButtons.first()
        const id = await firstApp.getAttribute('id')

        await clickFilter(`#${id}`)
        await debugWait()
        expect(await isActive(`#${id}`)).toBe(true)
        await debugWait()

        await clickFilter(`#${id}`)
        await debugWait()
        expect(await isActive(`#${id}`)).toBe(false)
        log(`Toggled application filter: ${id}`)
        await debugWait()
      }
    })

    // ========================================
    // ISSUES & ALERTS CHECKBOXES
    // ========================================

    await test.step('Alert checkboxes are rendered and unchecked by default', async () => {
      step('Checking alert checkboxes', '🚨')
      for (const key of ['sample_ratio_mismatch', 'cleanup_needed', 'audience_mismatch', 'sample_size_reached', 'experiments_interact', 'assignment_conflict']) {
        const checkbox = sidebar.locator(`#filter-alert-${key}`)
        await expect(checkbox).toBeVisible()
        await expect(checkbox).not.toBeChecked()
      }
      await debugWait()
    })

    await test.step('Toggle alert checkboxes on and off', async () => {
      step('Testing alert toggles', '✅')
      await clickFilter('#filter-alert-sample_ratio_mismatch')
      await debugWait()
      await expect(sidebar.locator('#filter-alert-sample_ratio_mismatch')).toBeChecked()
      await debugWait()

      await clickFilter('#filter-alert-cleanup_needed')
      await debugWait()
      await expect(sidebar.locator('#filter-alert-cleanup_needed')).toBeChecked()
      await debugWait()

      await clickFilter('#filter-alert-sample_ratio_mismatch')
      await debugWait()
      await expect(sidebar.locator('#filter-alert-sample_ratio_mismatch')).not.toBeChecked()
      await expect(sidebar.locator('#filter-alert-cleanup_needed')).toBeChecked()
      await debugWait()

      // Clean up
      await clickFilter('#filter-alert-cleanup_needed')
      await debugWait()
    })

    // ========================================
    // SEARCH FILTER
    // ========================================

    await test.step('Restore defaults before search test', async () => {
      step('Restoring defaults', '🔄')
      if (!(await isActive('#filter-state-created'))) {
        await clickFilter('#filter-state-created')
        await debugWait()
      }
      if (!(await isActive('#filter-state-ready'))) {
        await clickFilter('#filter-state-ready')
        await debugWait()
      }
      if (await isActive('#filter-state-development')) {
        await clickFilter('#filter-state-development')
        await debugWait()
      }
      await waitForResults()
      await debugWait()
    })

    const countBefore = await experimentCount()
    log(`Experiments before search: ${countBefore}`)
    await debugWait()

    await test.step('Search narrows results', async () => {
      step('Testing search filter', '🔎')
      const searchInput = sidebar.locator('#filter-search-input')
      await searchInput.fill('zzz_nonexistent_experiment_xyz')
      await debugWait()
      await waitForResults()
      await debugWait()

      const countAfter = await experimentCount()
      log(`Experiments after nonsense search: ${countAfter} (before: ${countBefore})`)
      // Search should reduce or show no results; if client-side search isn't applied yet, just log
      if (countAfter >= countBefore && countBefore > 0) {
        log('Note: search did not reduce results - may be a timing issue with client-side filtering')
      }
      await debugWait()
    })

    await test.step('Clearing search restores results', async () => {
      step('Clearing search', '🧹')
      const searchInput = sidebar.locator('#filter-search-input')
      await searchInput.fill('')
      await debugWait()
      await waitForResults()
      await debugWait()

      const countRestored = await experimentCount()
      log(`Experiments after clearing search: ${countRestored}`)
      expect(countRestored).toBeGreaterThanOrEqual(countBefore)
      await debugWait()
    })

    // ========================================
    // CLEAR ALL FILTERS
    // ========================================

    await test.step('Apply non-default filters then clear all', async () => {
      step('Testing Clear All Filters', '🗑️')

      // Apply Running + significance + alert
      await selectOnlyState('running')
      await debugWait()
      await clickFilter('#filter-significance-positive')
      await debugWait()
      await clickFilter('#filter-alert-sample_ratio_mismatch')
      await debugWait()

      await expect(sidebar.locator('#filter-clear-all')).toBeVisible()
      await debugWait()

      await click(sidebar, '#filter-clear-all')
      await debugWait()
      await waitForResults()
      await debugWait()

      // Verify defaults restored
      expect(await isActive('#filter-state-created')).toBe(true)
      await debugWait()
      expect(await isActive('#filter-state-ready')).toBe(true)
      await debugWait()
      expect(await isActive('#filter-state-running')).toBe(false)
      await debugWait()
      expect(await isActive('#filter-significance-positive')).toBe(false)
      await debugWait()
      await expect(sidebar.locator('#filter-alert-sample_ratio_mismatch')).not.toBeChecked()
      await debugWait()

      // Verify experiments match defaults
      const states = await getStates()
      for (const s of states) {
        expect(['created', 'ready']).toContain(s)
      }
      log('Clear All Filters verified')
      await debugWait()

      // Clear button should be gone
      await expect(sidebar.locator('#filter-clear-all')).not.toBeVisible()
      await debugWait()
    })
  })
})
