import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { injectSidebar, debugWait, setupConsoleLogging } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'persistence-test.html')

test.describe('Experiment Data Persistence', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    allConsoleMessages = setupConsoleLogging(
      testPage,
      (msg) => msg.text.includes('[ABsmartly]') || msg.text.includes('[Background]')
    )

    await testPage.goto(`file://${TEST_PAGE_PATH}`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('should persist and reload all experiment metadata including unit type', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(process.env.SLOW === '1' ? 90000 : 60000)
    let sidebar: any
    let createdExperimentName: string

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      sidebar = await injectSidebar(testPage, extensionUrl)
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    await test.step('Navigate to experiment editor', async () => {
      console.log('\n➕ STEP 2: Opening experiment editor')

      // Click "Create New Experiment" button
      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button: HTMLElement) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Clicked Create New Experiment button')
      await debugWait()

      // Select "From Scratch"
      const fromScratchButton = sidebar.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.evaluate((button: HTMLElement) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Selected "From Scratch" option')
      await debugWait()
    })

    await test.step('Fill in experiment details', async () => {
      console.log('\n📝 STEP 3: Filling experiment details')

      createdExperimentName = `E2E Persistence Test ${Date.now()}`

      const nameInput = sidebar.locator('input#experiment-name-input')
      await nameInput.waitFor({ state: 'visible', timeout: 3000 })
      await nameInput.fill(createdExperimentName)
      console.log(`  ✓ Set experiment name: ${createdExperimentName}`)

      const trafficInput = sidebar.locator('label:has-text("Traffic Percentage")').locator('..').locator('input')
      await trafficInput.waitFor({ state: 'visible', timeout: 2000 })
      await trafficInput.fill('75')
      console.log('  ✓ Set traffic to 75%')

      await debugWait()
    })

    await test.step('Select Unit Type', async () => {
      console.log('\n🎯 STEP 4: Selecting Unit Type')

      const unitTypeContainer = sidebar.locator('label:has-text("Unit Type")').locator('..')

      await sidebar.locator('label:has-text("Unit Type")').locator('..').locator('span:not(:has-text("Loading..."))').first().waitFor({ timeout: 2000 })
      await testPage.waitForTimeout(800)

      let dropdownOpened = false
      for (let attempt = 0; attempt < 3 && !dropdownOpened; attempt++) {
        if (attempt > 0) {
          console.log(`  Retry attempt ${attempt} to open Unit Type dropdown`)
          await testPage.waitForTimeout(500)
        }

        const unitTypeClickArea = unitTypeContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
        await unitTypeClickArea.click({ force: true })
        await testPage.waitForTimeout(500)

        const unitTypeDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
        dropdownOpened = await unitTypeDropdown.isVisible().catch(() => false)
      }

      const unitTypeDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await unitTypeDropdown.waitFor({ state: 'visible', timeout: 2000 })

      const firstUnitOption = unitTypeDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstUnitOption.waitFor({ state: 'visible', timeout: 2000 })

      const unitTypeName = await firstUnitOption.textContent()
      console.log(`  Selected Unit Type: ${unitTypeName}`)

      await firstUnitOption.click({ force: true })
      await testPage.waitForTimeout(500)

      console.log('  ✓ Unit Type selected')
      await debugWait()
    })

    await test.step('Select Application', async () => {
      console.log('\n📱 STEP 5: Selecting Application')

      const appContainer = sidebar.locator('label:has-text("Applications")').locator('..')

      await sidebar.locator('label:has-text("Applications")').locator('..').locator('span:not(:has-text("Loading..."))').first().waitFor({ timeout: 2000 })
      await testPage.waitForTimeout(800)

      const appClickArea = appContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
      await appClickArea.click({ force: true })
      await testPage.waitForTimeout(500)

      const appDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await appDropdown.waitFor({ state: 'visible', timeout: 2000 })

      const firstAppOption = appDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstAppOption.waitFor({ state: 'visible', timeout: 2000 })

      const appName = await firstAppOption.textContent()
      console.log(`  Selected Application: ${appName}`)

      await firstAppOption.click({ force: true })
      await testPage.waitForTimeout(500)

      console.log('  ✓ Application selected')
      await debugWait()
    })

    await test.step('Create experiment', async () => {
      console.log('\n💾 STEP 6: Creating experiment')

      const createButton = sidebar.locator('button#create-experiment-button')
      await createButton.waitFor({ state: 'visible', timeout: 3000 })

      await createButton.evaluate((btn: HTMLElement) => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      await testPage.waitForTimeout(2000)
      console.log('  ✓ Experiment created')

      // Wait for redirect back to list
      await sidebar.locator('text=Experiments').waitFor({ timeout: 3000 })
      await testPage.waitForTimeout(1000)
      console.log('  ✓ Redirected to experiments list')
      await debugWait()
    })

    await test.step('Find and open the created experiment', async () => {
      console.log('\n🔎 STEP 7: Finding and opening created experiment')

      const experimentList = sidebar.locator('div[class*="space-y"]')
      await experimentList.waitFor({ state: 'visible', timeout: 3000 })

      const experimentRow = sidebar.locator(`div:has-text("${createdExperimentName}")`).first()
      await experimentRow.waitFor({ state: 'visible', timeout: 5000 })
      console.log(`  ✓ Found experiment: ${createdExperimentName}`)

      await experimentRow.evaluate((row: HTMLElement) => {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      await testPage.waitForTimeout(2000)
      console.log('  ✓ Opened experiment')
      await debugWait()
    })

    await test.step('Verify all data persisted correctly', async () => {
      console.log('\n✅ STEP 8: Verifying all persisted data')

      const detailView = sidebar.locator('h2:has-text("' + createdExperimentName + '")')
      await detailView.waitFor({ state: 'visible', timeout: 5000 })
      console.log('  ✓ Experiment detail view loaded')

      const trafficInput = sidebar.locator('label:has-text("Traffic Percentage")').locator('..').locator('input')
      await trafficInput.waitFor({ state: 'visible', timeout: 2000 })
      const trafficValue = await trafficInput.inputValue()
      expect(trafficValue).toBe('75')
      console.log('  ✓ Traffic percentage persisted: 75%')

      const unitTypeContainer = sidebar.locator('label:has-text("Unit Type")').locator('..')
      const unitTypeDisplay = unitTypeContainer.locator('span').first()
      await unitTypeDisplay.waitFor({ state: 'visible', timeout: 2000 })
      const unitTypeText = await unitTypeDisplay.textContent()

      expect(unitTypeText).not.toBe('')
      expect(unitTypeText).not.toContain('Select a unit type')
      console.log(`  ✅ Unit Type persisted and loaded: ${unitTypeText}`)

      const appContainer = sidebar.locator('label:has-text("Applications")').locator('..')
      const appBadges = appContainer.locator('span[class*="badge"], div[class*="badge"]')
      const appCount = await appBadges.count()
      expect(appCount).toBeGreaterThan(0)
      console.log(`  ✓ Application persisted: ${appCount} app(s) selected`)

      await debugWait()
    })

    console.log('\n🎉 Test completed successfully!')
  })
})
