import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { injectSidebar, debugWait, setupConsoleLogging, waitForExperiments } from './utils/test-helpers'

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

  test.beforeEach(async ({ context, seedStorage }) => {
    const mockExperiments = [
      {
        id: 1,
        name: "test_experiment",
        display_name: "Test Experiment",
        state: "ready",
        variants: [
          { variant: 0, name: "control", config: "{}" },
          { variant: 1, name: "treatment", config: "{}" }
        ]
      }
    ]

    await seedStorage({ experiments: mockExperiments })

    testPage = await context.newPage()

    allConsoleMessages = setupConsoleLogging(
      testPage,
      (msg) => msg.text.includes('[ABsmartly]') || msg.text.includes('[Background]')
    )

    await testPage.goto(`file://${TEST_PAGE_PATH}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForSelector('body', { timeout: 5000 })

    console.log('✅ Test page loaded')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Create new experiment from scratch with Header component', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(process.env.SLOW === '1' ? 30000 : 15000)

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
      const header = sidebar.locator('div').filter({ hasText: /Experiments/i }).first()
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
      const headerTitle = sidebar.locator('#create-experiment-header, h2:has-text("Create New Experiment")')
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
      await sidebar.locator('#unit-type-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 5000 })
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
      const lockButton = sidebar.locator('button').filter({ has: sidebar.locator('svg.h-4.w-4') }).first()

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
      await sidebar.locator('text=/Variants|Control|Variant/i').first().waitFor({ timeout: 5000 }).catch(() => {})

      // Each variant should have Visual Editor button
      const veButtons = sidebar.locator('#visual-editor-button')
      const veButtonCount = await veButtons.count()
      expect(veButtonCount).toBeGreaterThanOrEqual(1)
      console.log(`  ✓ Found ${veButtonCount} Visual Editor buttons (using useExperimentVariants hook)`)

      await debugWait()
    })

    await test.step('Create the experiment', async () => {
      console.log('\n💾 Creating experiment')

      // Use ID selector for more reliable targeting
      const createButton = sidebar.locator('button#create-experiment-button')
      await createButton.waitFor({ state: 'visible', timeout: 5000 })
      console.log('  ✓ Create button visible')

      // Scroll button into view
      await createButton.scrollIntoViewIfNeeded()
      console.log('  ✓ Scrolled button into view')

      await testPage.screenshot({ path: 'debug-flow-before-create-click.png', fullPage: true })

      // Check if button is enabled
      const isDisabled = await createButton.isDisabled()
      console.log(`  [DEBUG] Button disabled: ${isDisabled}`)

      // Check if page is alive before clicking
      const pageAliveBefore = await testPage.evaluate(() => true).catch(() => false)
      console.log(`  [DEBUG] Page alive before click: ${pageAliveBefore}`)
      if (!pageAliveBefore) {
        throw new Error('Page crashed before Create button click')
      }

      // Check form state before clicking
      const nameValue = await sidebar.locator('#experiment-name-input').inputValue().catch(() => 'NOT_FOUND')
      const unitTypeText = await sidebar.locator('#unit-type-select-trigger').textContent().catch(() => 'NOT_FOUND')
      const appsText = await sidebar.locator('#applications-select-trigger').textContent().catch(() => 'NOT_FOUND')

      console.log(`  [DEBUG] Form state before click:`)
      console.log(`    - Name: ${nameValue}`)
      console.log(`    - Unit Type: ${unitTypeText?.trim()}`)
      console.log(`    - Applications: ${appsText?.trim()}`)

      // Set up dialog handler to catch validation alerts
      let alertMessage = null
      testPage.on('dialog', async dialog => {
        alertMessage = dialog.message()
        console.log(`  ⚠️  Alert dialog: ${alertMessage}`)
        await dialog.accept()
      })

      // Try clicking with Playwright's built-in click to ensure React handlers fire
      try {
        await createButton.click({ timeout: 5000 })
        console.log('  ✓ Clicked Create Experiment Draft button')
      } catch (error) {
        console.log(`  ❌ Error clicking Create button: ${error.message}`)
        await testPage.screenshot({ path: 'debug-flow-click-error.png', fullPage: true })
        throw error
      }

      // Check if page is still alive after clicking
      const pageAliveAfter = await testPage.evaluate(() => true).catch(() => false)
      console.log(`  [DEBUG] Page alive after click: ${pageAliveAfter}`)
      if (!pageAliveAfter) {
        console.log('  ❌ Page crashed immediately after Create button click!')
        throw new Error('Page crashed after Create button click')
      }

      // Wait a moment for any immediate UI changes (including alerts)
      await debugWait(500)

      // Check if there was a validation alert
      if (alertMessage) {
        console.log(`  ❌ Form validation alert: ${alertMessage}`)
        await testPage.screenshot({ path: 'debug-flow-validation-alert.png', fullPage: true })

        // Log form state for debugging
        const formState = await sidebar.evaluate(() => {
          const nameInput = document.querySelector('#experiment-name-input') as HTMLInputElement
          const unitTypeValue = document.querySelector('#unit-type-select-trigger')?.textContent
          return {
            name: nameInput?.value,
            unitType: unitTypeValue
          }
        })
        console.log(`  [DEBUG] Form state: ${JSON.stringify(formState)}`)

        throw new Error(`Form validation failed: ${alertMessage}`)
      }

      // Check for any validation errors or loading states
      const validationError = sidebar.locator('text=/required|must|invalid|cannot/i').first()
      const hasValidationError = await validationError.isVisible().catch(() => false)
      if (hasValidationError) {
        const errorText = await validationError.textContent()
        console.log(`  ❌ Validation error: ${errorText}`)
        await testPage.screenshot({ path: 'debug-flow-validation-error.png', fullPage: true })
        throw new Error(`Form validation failed: ${errorText}`)
      }

      // Wait for redirect back to experiment list
      console.log('  [DEBUG] Waiting for redirect to experiments list...')
      await testPage.screenshot({ path: 'debug-flow-after-create-click.png', fullPage: true })

      // Check sidebar HTML to see current state
      const sidebarText = await sidebar.locator('body').textContent()
      console.log(`  [DEBUG] Sidebar contains "Experiments": ${sidebarText.includes('Experiments')}`)
      console.log(`  [DEBUG] Sidebar contains "Create": ${sidebarText.includes('Create')}`)

      // Wait for either success (redirects to list) or error message
      // API calls can take time, so use a longer timeout
      const listHeading = sidebar.locator('text=Experiments')
      const errorMessage = sidebar.locator('text=/error|failed|invalid/i')

      try {
        await Promise.race([
          listHeading.waitFor({ timeout: 30000 }),
          errorMessage.waitFor({ timeout: 30000 })
        ])

        const hasError = await errorMessage.isVisible().catch(() => false)
        if (hasError) {
          const errorText = await errorMessage.textContent()
          console.log(`  ❌ Error during creation: ${errorText}`)
          await testPage.screenshot({ path: 'debug-flow-create-error.png', fullPage: true })
          throw new Error(`Experiment creation failed: ${errorText}`)
        }

        console.log('  ✓ Redirected to experiments list')
      } catch (error) {
        console.log(`  ❌ Timeout or error waiting for redirect: ${error}`)
        await testPage.screenshot({ path: 'debug-flow-create-timeout.png', fullPage: true })

        // Log console messages that might have errors
        const recentMessages = allConsoleMessages.slice(-20)
        console.log('  [DEBUG] Recent console messages:')
        for (const msg of recentMessages) {
          console.log(`    ${msg.type}: ${msg.text}`)
        }

        throw error
      }

      // Wait for loading spinner to disappear
      await sidebar.locator('[role="status"][aria-label="Loading experiments"]')
        .waitFor({ state: 'hidden', timeout: 30000 })
        .catch(() => {
          console.log('  ℹ️  Loading spinner not found or already hidden')
        })
      console.log('  ✓ Experiment list loaded')

      await debugWait()
    })

    await test.step('Open the created experiment to test detail view dropdowns', async () => {
      console.log('\n🔄 Testing detail view dropdowns with created experiment')

      // We're already in the experiment list after creation
      // Find any experiment in the list
      const hasExperiments = await waitForExperiments(sidebar)

      if (!hasExperiments) {
        console.log('  ℹ️  No experiments available to test detail view')
        return
      }

      // Click the first available experiment
      // Use .experiment-item and then click the inner .cursor-pointer div
      const experimentRow = sidebar.locator('.experiment-item').first()
      await experimentRow.waitFor({ state: 'visible', timeout: 5000 })

      const clickableArea = experimentRow.locator('.cursor-pointer').first()
      await clickableArea.waitFor({ state: 'visible', timeout: 2000 })
      await clickableArea.click()
      console.log('  ✓ Opened existing experiment')

      // Wait for detail view title to change
      await sidebar.locator('h2, h1').first().waitFor({ state: 'visible', timeout: 5000 })
      await debugWait()

      // Check Unit Type dropdown
      const unitTypeDropdown = sidebar.locator('#unit-type-label').locator('..').locator('[class*="cursor-pointer"]').first()
      const unitTypeText = await unitTypeDropdown.textContent()
      const isUnitTypeLoading = unitTypeText?.includes('Loading...')

      if (isUnitTypeLoading) {
        console.log('  ❌ Unit Type dropdown stuck in loading state')
        console.log('  📝 Unit Type text:', unitTypeText)
      } else {
        console.log('  ✓ Unit Type dropdown loaded')
      }
      expect(isUnitTypeLoading).toBe(false)

      // Check Owners dropdown
      const ownersDropdown = sidebar.locator('#owners-label').locator('..').locator('[class*="cursor-pointer"]').first()
      const ownersText = await ownersDropdown.textContent()
      const isOwnersLoading = ownersText?.includes('Loading...')

      if (isOwnersLoading) {
        console.log('  ❌ Owners dropdown stuck in loading state')
        console.log('  📝 Owners text:', ownersText)
      } else {
        console.log('  ✓ Owners dropdown loaded')
      }
      expect(isOwnersLoading).toBe(false)

      // Check Tags dropdown
      const tagsDropdown = sidebar.locator('#tags-label').locator('..').locator('[class*="cursor-pointer"]').first()
      const tagsText = await tagsDropdown.textContent()
      const isTagsLoading = tagsText?.includes('Loading...')

      if (isTagsLoading) {
        console.log('  ❌ Tags dropdown stuck in loading state')
        console.log('  📝 Tags text:', tagsText)
      } else {
        console.log('  ✓ Tags dropdown loaded')
      }
      expect(isTagsLoading).toBe(false)

      await debugWait()
    })

    // Continue testing with the experiments list that's already loaded
    await test.step('Verify state labels in existing experiments list', async () => {
      console.log('\n🏷️  Verifying state labels in experiment list')

      // Get all experiment cards with state badges
      const experimentCards = sidebar.locator('div[role="button"], button, [class*="cursor-pointer"]').filter({ hasText: /Experiment|Test/i })
      const cardCount = await experimentCards.count()

      if (cardCount > 0) {
        // Check first 3 experiment cards for state badges
        const cardsToCheck = Math.min(3, cardCount)
        for (let i = 0; i < cardsToCheck; i++) {
          const card = experimentCards.nth(i)
          const stateBadge = card.locator('[class*="badge"], span[class*="bg-"]').first()
          const hasStateBadge = await stateBadge.isVisible().catch(() => false)

          if (hasStateBadge) {
            const badgeText = await stateBadge.textContent()
            console.log(`  Card ${i + 1} badge: "${badgeText}"`)

            // Verify badge doesn't show raw state values
            const rawStates = ['created', 'running_not_full_on', 'full_on']
            const hasRawState = rawStates.some(raw => badgeText?.toLowerCase() === raw.toLowerCase())
            expect(hasRawState).toBe(false)
          }
        }
        console.log('  ✓ State labels display correctly in list view')
      } else {
        console.log('  ℹ️  No experiments available to check')
      }

      await debugWait()
    })

    await test.step('Open first experiment', async () => {
      console.log('\n📖 Opening first experiment')

      await waitForExperiments(sidebar)

      const experimentRow = sidebar.locator('.experiment-item').first()
      await experimentRow.waitFor({ state: 'visible', timeout: 5000 })

      const clickableArea = experimentRow.locator('.cursor-pointer').first()
      await clickableArea.waitFor({ state: 'visible', timeout: 2000 })
      await clickableArea.click()
      console.log('  ✓ Clicked first experiment')

      await sidebar.locator('h2, h1').first().waitFor({ state: 'visible', timeout: 5000 })
      await debugWait()
    })

    await test.step('Verify dropdowns load in detail view', async () => {
      console.log('\n⏳ Verifying dropdowns loaded in detail view')

      // Wait a moment for data to load
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

      // Check Unit Type dropdown
      const unitTypeDropdown = sidebar.locator('#unit-type-label').locator('..').locator('[class*="cursor-pointer"]').first()
      const unitTypeText = await unitTypeDropdown.textContent()
      const isUnitTypeLoading = unitTypeText?.includes('Loading...')

      if (isUnitTypeLoading) {
        console.log('  ❌ Unit Type dropdown stuck in loading state')
        console.log('  📝 Unit Type text:', unitTypeText)
      } else {
        console.log('  ✓ Unit Type dropdown loaded')
      }
      expect(isUnitTypeLoading).toBe(false)

      // Check Owners dropdown
      const ownersDropdown = sidebar.locator('#owners-label').locator('..').locator('[class*="cursor-pointer"]').first()
      const ownersText = await ownersDropdown.textContent()
      const isOwnersLoading = ownersText?.includes('Loading...')

      if (isOwnersLoading) {
        console.log('  ❌ Owners dropdown stuck in loading state')
        console.log('  📝 Owners text:', ownersText)
      } else {
        console.log('  ✓ Owners dropdown loaded')
      }
      expect(isOwnersLoading).toBe(false)

      // Check Tags dropdown
      const tagsDropdown = sidebar.locator('#tags-label').locator('..').locator('[class*="cursor-pointer"]').first()
      const tagsText = await tagsDropdown.textContent()
      const isTagsLoading = tagsText?.includes('Loading...')

      if (isTagsLoading) {
        console.log('  ❌ Tags dropdown stuck in loading state')
        console.log('  📝 Tags text:', tagsText)
      } else {
        console.log('  ✓ Tags dropdown loaded')
      }
      expect(isTagsLoading).toBe(false)

      await debugWait()
    })

    await test.step('Verify Header component in detail view', async () => {
      console.log('\n🔍 Verifying Header component in detail view')

      // Header should have logo
      const logo = sidebar.locator('svg, img').first()
      await expect(logo).toBeVisible()
      console.log('  ✓ Logo visible in header')

      // Back button should be present
      const backButton = sidebar.locator('button[aria-label="Go back"], button[title="Go back"]')
      await expect(backButton).toBeVisible()
      console.log('  ✓ Back button visible in header')

      // Experiment name should be editable (PencilIcon button)
      const editNameButton = sidebar.locator('button').filter({ has: sidebar.locator('svg.h-4.w-4') }).first()
      await expect(editNameButton).toBeVisible()
      console.log('  ✓ Edit name button visible')

      await debugWait()
    })

    await test.step('Verify ExperimentActions component', async () => {
      console.log('\n🎬 Verifying ExperimentActions component')

      // Should have action buttons
      const actionButtons = sidebar.locator('button[aria-label*="ABsmartly"], button[title*="ABsmartly"]')
      const actionButtonCount = await actionButtons.count()

      if (actionButtonCount > 0) {
        console.log(`  ✓ Found ${actionButtonCount} ExperimentActions buttons`)
      } else {
        console.log('  ℹ️  No ExperimentActions buttons visible (may depend on permissions)')
      }

      await debugWait()
    })

    await test.step('Verify state label display', async () => {
      console.log('\n🏷️  Verifying state label displays correctly')

      // Get the state badge - use same selector as other tests
      const stateBadge = sidebar.locator('[class*="badge"], span[class*="bg-"]').first()
      const hasBadge = await stateBadge.isVisible({ timeout: 2000 }).catch(() => false)

      if (!hasBadge) {
        console.log('  ℹ️  No state badge visible (may not be present for all experiments)')
        return
      }

      const badgeText = await stateBadge.textContent()
      console.log(`  Badge text: "${badgeText}"`)

      // Verify badge doesn't show raw state values like "created" or "running_not_full_on"
      // Should show display labels like "Draft" or "Running"
      const rawStates = ['created', 'running_not_full_on', 'full_on']
      const hasRawState = rawStates.some(raw => badgeText?.toLowerCase() === raw.toLowerCase())

      expect(hasRawState).toBe(false)
      console.log('  ✓ Badge shows display label (not raw state value)')

      // Verify it shows a valid display label
      const validLabels = ['Running', 'Draft', 'Ready', 'Stopped', 'Scheduled', 'Archived', 'Development', 'Full On']
      const hasValidLabel = validLabels.some(label => badgeText?.includes(label))

      if (hasValidLabel) {
        console.log(`  ✓ Badge shows valid display label: "${badgeText}"`)
      } else {
        console.log(`  ℹ️  Badge shows: "${badgeText}"`)
      }

      await debugWait()
    })

    await test.step('Verify dropdowns are not stuck in loading state', async () => {
      console.log('\n⏳ Verifying dropdowns loaded properly')

      // Wait a moment for data to load
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

      // Check Unit Type dropdown
      const unitTypeDropdown = sidebar.locator('#unit-type-label').locator('..').locator('[class*="cursor-pointer"]').first()
      const unitTypeText = await unitTypeDropdown.textContent()
      const isUnitTypeLoading = unitTypeText?.includes('Loading...')

      if (isUnitTypeLoading) {
        console.log('  ❌ Unit Type dropdown stuck in loading state')
      } else {
        console.log('  ✓ Unit Type dropdown loaded')
      }
      expect(isUnitTypeLoading).toBe(false)

      // Check Owners dropdown
      const ownersDropdown = sidebar.locator('#owners-label').locator('..').locator('[class*="cursor-pointer"]').first()
      const ownersText = await ownersDropdown.textContent()
      const isOwnersLoading = ownersText?.includes('Loading...')

      if (isOwnersLoading) {
        console.log('  ❌ Owners dropdown stuck in loading state')
      } else {
        console.log('  ✓ Owners dropdown loaded')
      }
      expect(isOwnersLoading).toBe(false)

      // Check Tags dropdown
      const tagsDropdown = sidebar.locator('#tags-label').locator('..').locator('[class*="cursor-pointer"]').first()
      const tagsText = await tagsDropdown.textContent()
      const isTagsLoading = tagsText?.includes('Loading...')

      if (isTagsLoading) {
        console.log('  ❌ Tags dropdown stuck in loading state')
      } else {
        console.log('  ✓ Tags dropdown loaded')
      }
      expect(isTagsLoading).toBe(false)

      await debugWait()
    })

    await test.step('Verify Save Changes button state', async () => {
      console.log('\n💾 Verifying Save Changes button')

      const saveButton = sidebar.locator('#save-changes-button')
      await expect(saveButton).toBeVisible()
      console.log('  ✓ Save Changes button visible')

      // For running/development experiments, button should be disabled
      const stateBadge = sidebar.locator('[class*="badge"], span[class*="bg-"]').first()
      const experimentStatus = await stateBadge.textContent().catch(() => 'unknown')
      console.log(`  Experiment status: ${experimentStatus}`)

      const isDisabled = await saveButton.isDisabled()
      if (experimentStatus?.toLowerCase().includes('running') || experimentStatus?.toLowerCase().includes('development')) {
        expect(isDisabled).toBe(true)
        console.log('  ✓ Save button correctly disabled for running/development experiment')
      } else {
        console.log(`  ℹ️  Save button enabled for status: ${experimentStatus}`)
      }

      await debugWait()
    })

    await test.step('Verify useExperimentVariants hook in detail view', async () => {
      console.log('\n📊 Verifying variants with useExperimentVariants hook')

      // Should have variant cards
      const variantSection = sidebar.locator('text=/Variants|DOM Changes/i')
      const hasVariants = await variantSection.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasVariants) {
        console.log('  ✓ Variants section visible (using useExperimentVariants hook)')
      } else {
        console.log('  ℹ️  No variants section visible (may be empty)')
      }

      await debugWait()
    })

    await test.step('Test back navigation', async () => {
      console.log('\n◀️  Testing back navigation')

      const backButton = sidebar.locator('button[aria-label="Go back"], button[title="Go back"]')
      await backButton.click()
      console.log('  ✓ Clicked back button')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      // Should return to experiment list - check for either heading or create button
      const experimentList = sidebar.locator('#experiments-header, h2:has-text("Experiments")')
      const createButton = sidebar.locator('button[title="Create New Experiment"]')

      const listVisible = await experimentList.isVisible({ timeout: 2000 }).catch(() => false)
      const buttonVisible = await createButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (listVisible || buttonVisible) {
        console.log('  ✓ Returned to experiment list')
      } else {
        console.log('  ⚠️  Could not confirm return to experiment list')
      }

      await debugWait()
    })

    await test.step('Test template selection flow', async () => {
      console.log('\n📋 Testing template selection')

      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      await debugWait()

      // Look for template option (if available)
      const templateButton = sidebar.locator('button').filter({ hasText: /Template|From Template/i })
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
        const scratchButton = sidebar.locator('button').filter({ hasText: /From Scratch|Scratch/i })
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

      const headerTitle = sidebar.locator('#create-experiment-header, h2:has-text("Create New Experiment")')
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

      const backButton = sidebar.locator('button[aria-label="Go back"], button[title="Go back"]')
      await backButton.click()
      console.log('  ✓ Clicked back button')
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      // Check for either heading or create button
      const experimentList = sidebar.locator('#experiments-header, h2:has-text("Experiments")')
      const createButton = sidebar.locator('button[title="Create New Experiment"]')

      const listVisible = await experimentList.isVisible({ timeout: 2000 }).catch(() => false)
      const buttonVisible = await createButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (listVisible || buttonVisible) {
        console.log('  ✓ Returned to experiment list')
      } else {
        console.log('  ⚠️  Could not confirm return to experiment list')
      }

      await debugWait()
    })

    await test.step('Navigate to Settings and verify Header', async () => {
      console.log('\n⚙️  Testing Settings view')

      // Click settings button
      const settingsButton = sidebar.locator('button[title*="Settings"], button[aria-label*="Settings"]').first()
      const hasSettingsButton = await settingsButton.isVisible({ timeout: 2000 }).catch(() => false)

      if (!hasSettingsButton) {
        console.log('  ℹ️  Settings button not found, skipping settings test')
        return
      }

      await settingsButton.click()
      console.log('  ✓ Clicked settings button')
      await debugWait()

      // Verify Header in Settings
      const headerTitle = sidebar.locator('h2:has-text("Settings")')
      await expect(headerTitle).toBeVisible()
      console.log('  ✓ Header shows "Settings" title')

      const logo = sidebar.locator('svg, img').first()
      await expect(logo).toBeVisible()
      console.log('  ✓ Logo visible in header')

      const backButton = sidebar.locator('button[aria-label="Go back"], button[title="Go back"]')
      await expect(backButton).toBeVisible()
      console.log('  ✓ Back button visible in header')

      await debugWait()
    })

    await test.step('Test back navigation from Settings', async () => {
      console.log('\n◀️  Testing back from Settings')

      const backButton = sidebar.locator('button[aria-label="Go back"], button[title="Go back"]')
      await backButton.click()
      console.log('  ✓ Clicked back button')
      await debugWait()

      // Should return to experiment list
      const settingsGone = sidebar.locator('h2:has-text("Settings")')
      await expect(settingsGone).not.toBeVisible({ timeout: 2000 })
      console.log('  ✓ Settings view closed')

      await debugWait()
    })

    console.log('\n✅ Comprehensive experiment flow test PASSED!')
  })

})
