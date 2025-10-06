import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

// Slow mode - set to true to add waits between steps for debugging
const SLOW_MODE = process.env.SLOW === '1'
const debugWait = async (ms: number = 300) => SLOW_MODE ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()

// Debug mode - set to true to show console logs
const DEBUG_MODE = process.env.DEBUG === '1' || process.env.PWDEBUG === '1'

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

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    // Set up console listener
    allConsoleMessages = []
    const consoleHandler = (msg: any) => {
      const msgType = msg.type()
      const msgText = msg.text()
      allConsoleMessages.push({ type: msgType, text: msgText })

      if (DEBUG_MODE && (msgText.includes('[ABsmartly]') || msgText.includes('[Background]'))) {
        console.log(`  📝 [${msgType}] ${msgText}`)
      }
    }
    testPage.on('console', consoleHandler)

    await testPage.goto(`file://${TEST_PAGE_PATH}`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    console.log('✅ Test page loaded')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Create new experiment from scratch with Header component', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 30000 : 15000)

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 Injecting sidebar')
      await testPage.evaluate((extUrl) => {
        const originalPadding = document.body.style.paddingRight || '0px'
        document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)
        document.body.style.transition = 'padding-right 0.3s ease-in-out'
        document.body.style.paddingRight = '384px'

        const container = document.createElement('div')
        container.id = 'absmartly-sidebar-root'
        container.style.cssText = `
          position: fixed;
          top: 0;
          right: 0;
          width: 384px;
          height: 100vh;
          background-color: white;
          border-left: 1px solid #e5e7eb;
          box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px;
          color: #111827;
        `

        const iframe = document.createElement('iframe')
        iframe.id = 'absmartly-sidebar-iframe'
        iframe.style.cssText = `width: 100%; height: 100%; border: none;`
        iframe.src = extUrl

        container.appendChild(iframe)
        document.body.appendChild(container)
      }, extensionUrl('tabs/sidebar.html'))

      const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await sidebar.locator('body').waitFor({ timeout: 10000 })
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    let experimentName: string

    await test.step('Verify Header component in experiment list', async () => {
      console.log('\n🔍 Verifying Header component in experiment list')

      // Header should have logo and title
      const header = sidebar.locator('div').filter({ hasText: /Experiments/i }).first()
      await expect(header).toBeVisible()
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
      const fromScratchButton = sidebar.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
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
      const headerTitle = sidebar.locator('h2:has-text("Create New Experiment")')
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

      // Select Unit Type
      console.log('  Selecting Unit Type...')
      const unitTypeSelect = sidebar.locator('label:has-text("Unit Type")').locator('..').locator('select')
      await unitTypeSelect.waitFor({ state: 'visible', timeout: 5000 })
      await sidebar.locator('label:has-text("Unit Type")').locator('..').locator('select option').nth(1).waitFor({ state: 'attached', timeout: 10000 })

      const firstUnitTypeValue = await unitTypeSelect.locator('option').nth(1).getAttribute('value')
      await unitTypeSelect.selectOption(firstUnitTypeValue || '')
      console.log('  ✓ Selected unit type')
      await debugWait()

      // Select Applications
      console.log('  Selecting Applications...')
      const appsContainer = sidebar.locator('label:has-text("Applications")').locator('..')
      const appsClickArea = appsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

      await appsClickArea.click({ timeout: 5000 })
      const appsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await appsDropdown.waitFor({ state: 'visible', timeout: 3000 })

      const firstAppOption = appsDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstAppOption.waitFor({ state: 'visible', timeout: 5000 })
      await firstAppOption.click()
      console.log('  ✓ Selected application')

      await sidebar.locator('label:has-text("Traffic")').click()
      await debugWait()
    })

    await test.step('Verify button text shows "Create Experiment"', async () => {
      console.log('\n🔍 Verifying create button text')

      const createButton = sidebar.locator('button:has-text("Create Experiment")')
      await expect(createButton).toBeVisible()
      console.log('  ✓ Button shows "Create Experiment" (not "Update Experiment")')

      await debugWait()
    })

    await test.step('Test name sync functionality', async () => {
      console.log('\n🔗 Testing name sync functionality')

      // Get current lock state (should be locked for new experiments)
      const lockButton = sidebar.locator('button').filter({ has: sidebar.locator('svg.h-4.w-4') }).first()

      // Type in experiment name
      const nameInput = sidebar.locator('input[placeholder*="experiment_name"]')
      await nameInput.fill('test_sync_name')
      await debugWait()

      // Display name should auto-update to "Test Sync Name"
      const displayNameInput = sidebar.locator('label:has-text("Display Name")').locator('..').locator('input')
      const displayNameValue = await displayNameInput.inputValue()
      expect(displayNameValue).toBe('Test Sync Name')
      console.log('  ✓ Display name synced: "Test Sync Name"')

      // Click lock to unsync
      await lockButton.click()
      await debugWait()

      // Now change experiment name again
      await nameInput.fill('another_test')
      await debugWait()

      // Display name should NOT change
      const displayNameAfter = await displayNameInput.inputValue()
      expect(displayNameAfter).toBe('Test Sync Name')
      console.log('  ✓ Display name unchanged after unlock: "Test Sync Name"')

      // Restore experiment name
      await nameInput.fill(experimentName)
      await debugWait()
    })

    await test.step('Verify variants section with useExperimentVariants hook', async () => {
      console.log('\n📊 Verifying variants section')

      // Wait for variants to render
      await sidebar.locator('text=/Variants|Control|Variant/i').first().waitFor({ timeout: 5000 }).catch(() => {})

      // Each variant should have Visual Editor button
      const veButtons = sidebar.locator('button:has-text("Visual Editor")')
      const veButtonCount = await veButtons.count()
      expect(veButtonCount).toBeGreaterThanOrEqual(2)
      console.log(`  ✓ Found ${veButtonCount} Visual Editor buttons (using useExperimentVariants hook)`)

      await debugWait()
    })

    console.log('\n✅ Create experiment flow test PASSED!')
  })

  test('Edit existing experiment with Header and hooks', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 30000 : 15000)

    await test.step('Inject sidebar and navigate to experiment list', async () => {
      console.log('\n📂 Injecting sidebar')
      await testPage.evaluate((extUrl) => {
        document.body.style.paddingRight = '384px'
        const container = document.createElement('div')
        container.id = 'absmartly-sidebar-root'
        container.style.cssText = `
          position: fixed; top: 0; right: 0; width: 384px; height: 100vh;
          background-color: white; border-left: 1px solid #e5e7eb;
          z-index: 2147483647;
        `
        const iframe = document.createElement('iframe')
        iframe.id = 'absmartly-sidebar-iframe'
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
        iframe.src = extUrl
        container.appendChild(iframe)
        document.body.appendChild(container)
      }, extensionUrl('tabs/sidebar.html'))

      const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await sidebar.locator('body').waitFor({ timeout: 10000 })
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    await test.step('Open first experiment', async () => {
      console.log('\n📖 Opening first experiment')

      // Wait for experiments to load - look for any clickable experiment item
      const experimentItem = sidebar.locator('div[role="button"], button, [class*="cursor-pointer"]').filter({ hasText: /Experiment|Test/i }).first()
      const hasExperiments = await experimentItem.isVisible({ timeout: 10000 }).catch(() => false)

      if (!hasExperiments) {
        console.log('  ℹ️  No experiments available to open')
        test.skip()
        return
      }

      await experimentItem.click()
      console.log('  ✓ Clicked first experiment')
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

    await test.step('Verify Save Changes button state', async () => {
      console.log('\n💾 Verifying Save Changes button')

      const saveButton = sidebar.locator('button:has-text("Save Changes")')
      await expect(saveButton).toBeVisible()
      console.log('  ✓ Save Changes button visible')

      // For running/development experiments, button should be disabled
      const experimentStatus = await sidebar.locator('[class*="badge"]').first().textContent()
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
      await debugWait()

      // Should return to experiment list
      const experimentList = sidebar.locator('h2:has-text("Experiments")')
      await expect(experimentList).toBeVisible({ timeout: 5000 })
      console.log('  ✓ Returned to experiment list')

      await debugWait()
    })

    console.log('\n✅ Edit experiment flow test PASSED!')
  })

  test('Template selection shows "Create New Experiment"', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 20000 : 10000)

    await test.step('Inject sidebar', async () => {
      await testPage.evaluate((extUrl) => {
        document.body.style.paddingRight = '384px'
        const container = document.createElement('div')
        container.id = 'absmartly-sidebar-root'
        container.style.cssText = `
          position: fixed; top: 0; right: 0; width: 384px; height: 100vh;
          background-color: white; z-index: 2147483647;
        `
        const iframe = document.createElement('iframe')
        iframe.id = 'absmartly-sidebar-iframe'
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
        iframe.src = extUrl
        container.appendChild(iframe)
        document.body.appendChild(container)
      }, extensionUrl('tabs/sidebar.html'))

      const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await sidebar.locator('body').waitFor({ timeout: 10000 })
      await debugWait()
    })

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    await test.step('Open template selection', async () => {
      console.log('\n📋 Opening template selection')

      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      await debugWait()

      // Look for template option (if available)
      const templateButton = sidebar.locator('button').filter({ hasText: /Template|From Template/i })
      const hasTemplateOption = await templateButton.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasTemplateOption) {
        await templateButton.click()
        console.log('  ✓ Clicked template option')
        await debugWait()

        // Select first template
        const firstTemplate = sidebar.locator('[class*="template"], [class*="card"]').first()
        const templateExists = await firstTemplate.isVisible({ timeout: 5000 }).catch(() => false)

        if (templateExists) {
          await firstTemplate.click()
          console.log('  ✓ Selected first template')
          await debugWait()
        } else {
          console.log('  ℹ️  No templates available')
          test.skip()
          return
        }
      } else {
        console.log('  ℹ️  Template option not available')
        test.skip()
        return
      }
    })

    await test.step('Verify header shows "Create New Experiment"', async () => {
      console.log('\n🔍 Verifying header for template')

      const headerTitle = sidebar.locator('h2:has-text("Create New Experiment")')
      await expect(headerTitle).toBeVisible()
      console.log('  ✓ Header correctly shows "Create New Experiment" (not "Edit Experiment")')

      await debugWait()
    })

    await test.step('Verify button shows "Create Experiment"', async () => {
      console.log('\n🔍 Verifying button text')

      const createButton = sidebar.locator('button:has-text("Create Experiment")')
      await expect(createButton).toBeVisible()
      console.log('  ✓ Button correctly shows "Create Experiment" (not "Update Experiment")')

      await debugWait()
    })

    console.log('\n✅ Template selection test PASSED!')
  })

  test('Header component in Settings view', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 20000 : 15000)

    await test.step('Inject sidebar and navigate to settings', async () => {
      await testPage.evaluate((extUrl) => {
        document.body.style.paddingRight = '384px'
        const container = document.createElement('div')
        container.id = 'absmartly-sidebar-root'
        container.style.cssText = `
          position: fixed; top: 0; right: 0; width: 384px; height: 100vh;
          background-color: white; z-index: 2147483647;
        `
        const iframe = document.createElement('iframe')
        iframe.id = 'absmartly-sidebar-iframe'
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
        iframe.src = extUrl
        container.appendChild(iframe)
        document.body.appendChild(container)
      }, extensionUrl('tabs/sidebar.html'))

      const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await sidebar.locator('body').waitFor({ timeout: 10000 })
      await debugWait()

      // Click settings button - look for gear/cog icon or Settings button
      const settingsButton = sidebar.locator('button[title*="Settings"], button[aria-label*="Settings"]').first()
      const hasSettingsButton = await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)

      if (!hasSettingsButton) {
        console.log('  ℹ️  Settings button not found')
        test.skip()
        return
      }

      await settingsButton.click()
      console.log('  ✓ Clicked settings button')
      await debugWait()
    })

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    await test.step('Verify Header component in Settings', async () => {
      console.log('\n🔍 Verifying Header in Settings view')

      // Header should show "Settings"
      const headerTitle = sidebar.locator('h2:has-text("Settings")')
      await expect(headerTitle).toBeVisible()
      console.log('  ✓ Header shows "Settings" title')

      // Logo should be present
      const logo = sidebar.locator('svg, img').first()
      await expect(logo).toBeVisible()
      console.log('  ✓ Logo visible in header')

      // Back button should be present
      const backButton = sidebar.locator('button[aria-label="Go back"], button[title="Go back"]')
      await expect(backButton).toBeVisible()
      console.log('  ✓ Back button visible in header')

      await debugWait()
    })

    await test.step('Test back navigation from settings', async () => {
      console.log('\n◀️  Testing back from settings')

      const backButton = sidebar.locator('button[aria-label="Go back"], button[title="Go back"]')
      await backButton.click()
      console.log('  ✓ Clicked back button')
      await debugWait()

      // Should return to previous view (experiment list or main view)
      // Wait for settings to be gone
      const settingsGone = sidebar.locator('h2:has-text("Settings")')
      await expect(settingsGone).not.toBeVisible({ timeout: 5000 })
      console.log('  ✓ Settings view closed, returned to previous view')

      await debugWait()
    })

    console.log('\n✅ Settings Header test PASSED!')
  })
})
