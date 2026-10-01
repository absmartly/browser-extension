import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { injectSidebar, debugWait, setupConsoleLogging, waitForExperiments, openLiveExperimentDetails } from './utils/test-helpers'
import { controlledConfigSeed } from '../helpers/management-api/server'
import { experimentRecord } from '../helpers/management-api/records'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

/**
 * E2E Tests for Experiment Creation, Editing, and Header Components
 *
 * Tests the refactored components:
 * - Header component (shared across all views)
 * - ExperimentEditor (create new experiments)
 * - ExperimentDetail (view/edit existing experiments)
 * - useExperimentVariants hook
 * - useExperimentSave hook
 */

test.describe('Experiment Creation and Editing Flows', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context, seedStorage, managementApi }) => {
    await seedStorage(controlledConfigSeed(managementApi))
    // Owned records with full metadata so the detail view has exact values.
    const r = managementApi.state.resources
    managementApi.state.experiments.push(
      experimentRecord({
        name: 'flows_owned_draft', display_name: 'Flows Owned Draft', state: 'created', created_at: '2026-09-03T10:00:00.000Z',
        unit_type_id: 22, unit_type: r.unit_types[1],
        owners: [{ experiment_id: 0, user_id: 2, user: r.users[1] }],
        experiment_tags: [{ experiment_id: 0, experiment_tag_id: 42, experiment_tag: r.experiment_tags[1] }],
        applications: [{ experiment_id: 0, application_id: 12, application_version: '0', application: r.applications[1] }]
      }),
      experimentRecord({ name: 'flows_owned_ready', display_name: 'Flows Owned Ready', state: 'ready', created_at: '2026-09-02T10:00:00.000Z' })
    )

    testPage = await context.newPage()

    allConsoleMessages = setupConsoleLogging(
      testPage,
      (msg) => msg.text.includes('[ABsmartly]') || msg.text.includes('[Background]')
    )

    await testPage.goto('http://localhost:3456/visual-editor-test.html', { waitUntil: 'domcontentloaded', timeout: 10000 })
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForSelector('body', { timeout: 5000 })

    console.log('✅ Test page loaded')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Experiment creation form and detail view with Header component', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(process.env.SLOW === '1' ? 90000 : 60000)

    let sidebar: any

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 Injecting sidebar')
      sidebar = await injectSidebar(testPage, extensionUrl)
      console.log('✅ Sidebar visible')
      await debugWait()
    })
    let experimentName: string

    await test.step('Verify Header component in experiment list', async () => {
      console.log('\n🔍 Verifying Header component in experiment list')

      // Debug: Log what's actually in the sidebar
      const bodyText = await sidebar.locator('body').textContent()
      console.log('  📋 Sidebar body text:', bodyText?.substring(0, 200))

      // Header should have logo and title
      const header = sidebar.locator('#experiments-heading')
      await expect(header).toBeVisible({ timeout: 2000 })
      console.log('  ✓ Header with "Experiments" title visible')

      // Logo should be present
      const logo = sidebar.locator('svg, img').first()
      await expect(logo).toBeVisible()
      console.log('  ✓ Logo visible in header')

      await debugWait()
    })

    await test.step('Open create experiment form', async () => {
      console.log('\n📋 Opening create experiment form')

      // Click create button
      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Clicked Create New Experiment button')
      await debugWait()

      // Select "From Scratch"
      const fromScratchButton = sidebar.locator('#from-scratch-button')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Selected "From Scratch" option')
      await debugWait()
    })

    await test.step('Verify Header component in create form', async () => {
      console.log('\n🔍 Verifying Header component in create form')

      // Header should show "Create New Experiment"
      const headerTitle = sidebar.locator('#create-experiment-header')
      await expect(headerTitle).toBeVisible()
      console.log('  ✓ Header shows "Create New Experiment" title')

      // Back button should be present
      const backButton = sidebar.locator('button[aria-label="Go back"], button[title="Go back"]')
      await expect(backButton).toBeVisible()
      console.log('  ✓ Back button visible in header')

      // Logo should be present
      const logo = sidebar.locator('svg, img').first()
      await expect(logo).toBeVisible()
      console.log('  ✓ Logo visible in header')

      await debugWait()
    })

    await test.step('Fill experiment creation form', async () => {
      console.log('\n📝 Filling experiment form')

      experimentName = `E2E Test Experiment ${Date.now()}`
      await sidebar.locator('input[placeholder*="xperiment"], input[name="name"], input[type="text"]').first().fill(experimentName)
      console.log(`  ✓ Filled experiment name: ${experimentName}`)
      await debugWait()

      // Verify name sync lock is present
      const lockIcon = sidebar.locator('svg.h-4.w-4')
      const lockCount = await lockIcon.count()
      expect(lockCount).toBeGreaterThan(0)
      console.log('  ✓ Name sync lock icon present')

      // Select Unit Type (using SearchableSelect component with correct IDs)
      console.log('  Selecting Unit Type...')
      const unitTypeTrigger = sidebar.locator('#unit-type-select-trigger')
      await unitTypeTrigger.waitFor({ state: 'visible', timeout: 5000 })
      await sidebar.locator('#unit-type-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 10000 })
      console.log('  ✓ Unit type select is enabled')
      await unitTypeTrigger.click()
      console.log('  ✓ Clicked unit type trigger')
      await debugWait()

      const unitTypeDropdown = sidebar.locator('#unit-type-select-dropdown, [data-testid="unit-type-select-dropdown"]')
      await unitTypeDropdown.waitFor({ state: 'visible', timeout: 5000 })
      await unitTypeDropdown.locator('div[class*="cursor-pointer"]').first().click()
      console.log('  ✓ Selected unit type')
      await debugWait()

      // Select Applications
      console.log('  Selecting Applications...')
      const appsTrigger = sidebar.locator('#applications-select-trigger')
      await appsTrigger.waitFor({ state: 'visible', timeout: 5000 })
      await appsTrigger.click()
      console.log('  ✓ Clicked applications trigger')
      await debugWait()

      const appsDropdown = sidebar.locator('#applications-select-dropdown, [data-testid="applications-select-dropdown"]')
      await appsDropdown.waitFor({ state: 'visible', timeout: 5000 })
      await appsDropdown.locator('div[class*="cursor-pointer"]').first().click()
      console.log('  ✓ Selected application')
      await debugWait()

      // Click outside to close dropdown
      await sidebar.locator('#traffic-label').click()

      // Wait for dropdown to close
      const appsDropdownClosed = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await appsDropdownClosed.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})

      await debugWait()
    })

    await test.step('Verify button text shows "Create Experiment Draft"', async () => {
      console.log('\n🔍 Verifying create button text')

      const createButton = sidebar.locator('#create-experiment-button')
      await expect(createButton).toBeVisible()
      const buttonText = await createButton.textContent()
      expect(buttonText).toContain('Create Experiment Draft')
      console.log('  ✓ Button shows "Create Experiment Draft" (not "Update Experiment")')

      await debugWait()
    })

    await test.step('Test name sync functionality', async () => {
      console.log('\n🔗 Testing name sync functionality')

      // Get current lock state (should be locked for new experiments)
      const lockButton = sidebar.locator('button[title="Names are synced. Click to unlock"]')
      await expect(lockButton).toBeVisible()

      // Type in experiment name
      const nameInput = sidebar.locator('#experiment-name-input')
      await nameInput.waitFor({ state: 'visible', timeout: 5000 })
      await nameInput.fill('test_sync_name')

      // Display name should auto-update to "Test Sync Name"
      const displayNameInput = sidebar.locator('#display-name-input')
      await displayNameInput.waitFor({ state: 'visible', timeout: 5000 })
      const displayNameValue = await displayNameInput.inputValue()
      expect(displayNameValue).toBe('Test Sync Name')
      console.log('  ✓ Display name synced: "Test Sync Name"')

      // Click lock to unsync
      await lockButton.click()
      await expect(sidebar.locator('button[title="Names are not synced. Click to lock"]')).toBeVisible()

      // Now change experiment name again
      await nameInput.fill('another_test')

      // Display name should NOT change
      const displayNameAfter = await displayNameInput.inputValue()
      expect(displayNameAfter).toBe('Test Sync Name')
      console.log('  ✓ Display name unchanged after unlock: "Test Sync Name"')

      // Restore experiment name
      await nameInput.fill(experimentName)
    })

    await test.step('Verify variants section with useExperimentVariants hook', async () => {
      console.log('\n📊 Verifying variants section')

      // Wait for variants to render
      await sidebar.locator('#dom-changes-heading, #visual-editor-button').first().waitFor({ timeout: 5000 }).catch(() => {})

      // Each variant should have Visual Editor button
      const veButtons = sidebar.locator('#visual-editor-button')
      const veButtonCount = await veButtons.count()
      expect(veButtonCount).toBeGreaterThanOrEqual(1)
      console.log(`  ✓ Found ${veButtonCount} Visual Editor buttons (using useExperimentVariants hook)`)

      await debugWait()
    })

    await test.step('Navigate back to experiment list', async () => {
      console.log('\n◀️  Navigating back to experiment list')

      const backButton = sidebar.locator('button[aria-label="Go back"], button[title="Go back"]')
      await backButton.click()
      console.log('  ✓ Clicked back button')

      await sidebar.locator('#experiments-heading, button[title="Create New Experiment"]').first()
        .waitFor({ state: 'visible', timeout: 10000 })

      await sidebar.locator('[role="status"][aria-label="Loading experiments"]')
        .waitFor({ state: 'hidden', timeout: 30000 })
        .catch(() => {})
      console.log('  ✓ Experiment list loaded')

      await debugWait()
    })

    await test.step('Open an experiment to test detail view dropdowns', async () => {
      console.log('\n🔄 Testing detail view dropdowns with existing experiment')

      const hasExperiments = await waitForExperiments(sidebar)
      expect(hasExperiments, 'experiment list must load before opening a detail view').toBe(true)

      const experimentRow = sidebar.locator('.experiment-item').filter({ has: sidebar.locator('[data-experiment-name="flows_owned_draft"]') })
      await openLiveExperimentDetails(testPage, experimentRow)
      console.log('  ✓ Opened owned experiment')

      // Wait for detail view title to change
      await sidebar.locator('h2, h1').first().waitFor({ state: 'visible', timeout: 5000 })
      await debugWait()

      // The detail view shows the record's own metadata, not placeholders.
      await expect(sidebar.locator('#unit-type-select-trigger')).toContainText('session_id')
      await expect(sidebar.locator('#unit-type-select-trigger')).not.toContainText('user_id')
      await expect(sidebar.locator('#owners-label-trigger')).toContainText('Second Owner')
      await expect(sidebar.locator('#tags-select-trigger')).toContainText('second-tag')
      await expect(sidebar.locator('#applications-select-trigger')).toContainText('app')
    })

    // Continue testing with the experiments list that's already loaded
    await test.step('Verify state labels in existing experiments list', async () => {
      console.log('\n🏷️  Verifying state labels in experiment list')
      await sidebar.locator('#header-back-button').click({ timeout: 10000 })
      await expect(sidebar.locator('#experiments-heading')).toBeVisible()

      const badge = (name: string) => sidebar.locator('[data-testid="experiment-list-item"]')
        .filter({ has: sidebar.locator(`[data-experiment-name="${name}"]`) }).locator('span.rounded-full').first()
      await expect(badge('flows_owned_draft')).toHaveText('Draft')
      await expect(badge('flows_owned_ready')).toHaveText('Ready')
      console.log('  ✓ State labels display correctly in list view')
    })

    await test.step('Test template selection flow', async () => {
      console.log('\n📋 Testing template selection')

      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      await debugWait()

      // Look for template option (if available)
      const templateButton = sidebar.locator('[data-testid="from-template-button"]')
      const hasTemplateOption = await templateButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasTemplateOption) {
        await templateButton.click()
        console.log('  ✓ Clicked template option')
        await debugWait()

        // Select first template
        const firstTemplate = sidebar.locator('[class*="template"], [class*="card"]').first()
        const templateExists = await firstTemplate.isVisible({ timeout: 2000 }).catch(() => false)

        if (templateExists) {
          await firstTemplate.click()
          console.log('  ✓ Selected first template')
          await debugWait()
        } else {
          console.log('  ℹ️  No templates available')
        }
      } else {
        // No template option, go directly to create
        const scratchButton = sidebar.locator('#from-scratch-button')
        const hasScratchButton = await scratchButton.isVisible({ timeout: 2000 }).catch(() => false)
        if (hasScratchButton) {
          await scratchButton.click()
          console.log('  ✓ Clicked "From Scratch" option')
          await debugWait()
        }
      }

      await debugWait()
    })

    await test.step('Verify create form shows "Create New Experiment"', async () => {
      console.log('\n🔍 Verifying create form header')

      const headerTitle = sidebar.locator('#create-experiment-header')
      await expect(headerTitle).toBeVisible()
      console.log('  ✓ Header correctly shows "Create New Experiment" (not "Edit Experiment")')

      await debugWait()
    })

    await test.step('Verify button shows "Create Experiment Draft"', async () => {
      console.log('\n🔍 Verifying button text')

      const createButton = sidebar.locator('#create-experiment-button')
      await expect(createButton).toBeVisible()
      const buttonText = await createButton.textContent()
      expect(buttonText).toContain('Create Experiment Draft')
      console.log('  ✓ Button correctly shows "Create Experiment Draft" (not "Update Experiment")')

      await debugWait()
    })

    await test.step('Navigate back to experiments list', async () => {
      console.log('\n◀️  Navigating back to experiments list')

      // Back runs the editor's async cleanup (content-script messages) before
      // switching views: wait for the list itself, not a fixed delay.
      await sidebar.locator('#create-experiment-header').waitFor({ state: 'visible' })
      await sidebar.locator('#header-back-button').click()
      await expect(sidebar.locator('#create-experiment-header')).toBeHidden()
      await expect(sidebar.locator('#experiments-heading')).toBeVisible()
      console.log('  ✓ Returned to experiment list')
    })

    await test.step('Navigate to Settings and verify Header', async () => {
      console.log('\n⚙️  Testing Settings view')

      await sidebar.locator('#nav-settings').click()
      console.log('  ✓ Clicked settings button')

      // Verify Header in Settings
      const headerTitle = sidebar.locator('#absmartly-endpoint')
      await expect(headerTitle).toBeVisible()
      console.log('  ✓ Header shows "Settings" title')

      const logo = sidebar.locator('svg, img').first()
      await expect(logo).toBeVisible()
      console.log('  ✓ Logo visible in header')

      const backButton = sidebar.locator('#header-back-button')
      await expect(backButton).toBeVisible()
      console.log('  ✓ Back button visible in header')

      await debugWait()
    })

    await test.step('Test back navigation from Settings', async () => {
      console.log('\n◀️  Testing back from Settings')

      await expect(sidebar.locator('#absmartly-endpoint')).toBeVisible()
      await sidebar.locator('#header-back-button').click()
      console.log('  ✓ Clicked back button')
      await expect(sidebar.locator('#absmartly-endpoint')).toBeHidden()
      await expect(sidebar.locator('#experiments-heading')).toBeVisible()
      console.log('  ✓ Settings view closed, back on the list')
    })

    console.log('\n✅ Comprehensive experiment flow test PASSED!')
  })

})
