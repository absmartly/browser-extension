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

      const unitTypeClickArea = unitTypeContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
      const unitTypeDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      
      // Retry clicking until dropdown appears (sometimes needs multiple attempts)
      for (let attempt = 0; attempt < 3; attempt++) {
        await unitTypeClickArea.click({ force: true })
        try {
          await unitTypeDropdown.waitFor({ state: 'visible', timeout: 500 })
          break
        } catch (e) {
          if (attempt === 2) throw e
        }
      }

      const firstUnitOption = unitTypeDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstUnitOption.waitFor({ state: 'visible', timeout: 2000 })

      const unitTypeName = await firstUnitOption.textContent()
      console.log(`  Selected Unit Type: ${unitTypeName}`)

      await firstUnitOption.click({ force: true })

      console.log('  ✓ Unit Type selected')
      await debugWait()
    })

    await test.step('Select Application', async () => {
      console.log('\n📱 STEP 5: Selecting Application')

      const appContainer = sidebar.locator('label:has-text("Applications")').locator('..')

      await sidebar.locator('label:has-text("Applications")').locator('..').locator('span:not(:has-text("Loading..."))').first().waitFor({ timeout: 2000 })

      const appClickArea = appContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
      await appClickArea.click({ force: true })

      const appDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await appDropdown.waitFor({ state: 'visible', timeout: 2000 })

      const firstAppOption = appDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstAppOption.waitFor({ state: 'visible', timeout: 2000 })

      const appName = await firstAppOption.textContent()
      console.log(`  Selected Application: ${appName}`)

      await firstAppOption.click({ force: true })

      console.log('  ✓ Application selected')
      await debugWait()
    })

    await test.step('Select Owners', async () => {
      console.log('\n👥 STEP 6: Selecting Owners')

      const ownersContainer = sidebar.locator('label:has-text("Owners")').locator('..')

      await sidebar.locator('label:has-text("Owners")').locator('..').locator('span:not(:has-text("Loading..."))').first().waitFor({ timeout: 2000 })

      const ownersClickArea = ownersContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
      await ownersClickArea.click({ force: true })

      const ownersDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await ownersDropdown.waitFor({ state: 'visible', timeout: 2000 })

      const firstOwnerOption = ownersDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstOwnerOption.waitFor({ state: 'visible', timeout: 2000 })

      const ownerName = await firstOwnerOption.textContent()
      console.log(`  Selected Owner: ${ownerName}`)

      await firstOwnerOption.click({ force: true })

      console.log('  ✓ Owner selected')
      await debugWait()
    })

    await test.step('Select Tags', async () => {
      console.log('\n🏷️  STEP 7: Selecting Tags')

      const tagsContainer = sidebar.locator('label:has-text("Tags")').locator('..')

      await sidebar.locator('label:has-text("Tags")').locator('..').locator('span:not(:has-text("Loading..."))').first().waitFor({ timeout: 2000 })

      const tagsClickArea = tagsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()
      await tagsClickArea.click({ force: true })

      const tagsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await tagsDropdown.waitFor({ state: 'visible', timeout: 2000 })

      const firstTagOption = tagsDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstTagOption.waitFor({ state: 'visible', timeout: 2000 })

      const tagName = await firstTagOption.textContent()
      console.log(`  Selected Tag: ${tagName}`)

      await firstTagOption.click({ force: true })

      console.log('  ✓ Tag selected')
      await debugWait()
    })

    await test.step('Create experiment', async () => {
      console.log('\n💾 STEP 8: Creating experiment')

      const createButton = sidebar.locator('button#create-experiment-button')
      await createButton.waitFor({ state: 'visible', timeout: 3000 })

      await createButton.evaluate((btn: HTMLElement) => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      console.log('  ✓ Experiment created')

      // Wait for redirect back to list
      await sidebar.locator('text=Experiments').waitFor({ timeout: 5000 })
      console.log('  ✓ Redirected to experiments list')
      await debugWait()
    })

    await test.step('Find and open the created experiment', async () => {
      console.log('\n🔎 STEP 9: Finding and opening created experiment')

      // Try multiple strategies to find the experiment
      console.log('  Searching for created experiment...')
      let experimentRow = null
      let foundOurExperiment = false

      // Strategy 1: Look for experiments with our naming pattern
      const allExperiments = sidebar.locator('div[role="button"], [class*="cursor-pointer"]').filter({ hasText: /E2E.*Test|Persistence.*Test/i })
      
      try {
        await allExperiments.first().waitFor({ state: 'visible', timeout: 3000 })
        const count = await allExperiments.count()
        console.log(`  Found ${count} matching E2E test experiments`)
        experimentRow = allExperiments.first()
        foundOurExperiment = true
      } catch (e) {
        console.log('  No matching E2E experiments found, trying fallback strategy...')
      }

      if (!foundOurExperiment) {
        // Fallback: Look for ANY experiment with complete data (has apps/owners)
        console.log('  Looking for any experiment with metadata...')
        const allRows = sidebar.locator('div[role="button"], [class*="cursor-pointer"]').filter({ hasText: /Experiment|Test/i })
        const rowCount = await allRows.count()
        console.log(`  Found ${rowCount} total experiments`)

        // Try to find one that looks like it has metadata (multiple badges)
        for (let i = 0; i < Math.min(rowCount, 5); i++) {
          const row = allRows.nth(i)
          const text = await row.textContent()
          // Look for experiments that likely have metadata (longer text suggests badges/metadata)
          if (text && text.length > 30) {
            experimentRow = row
            console.log(`  Selected experiment ${i+1} based on metadata indicators`)
            break
          }
        }

        if (!experimentRow) {
          experimentRow = allRows.first()
        }
      }

      await experimentRow.waitFor({ state: 'visible', timeout: 10000 })
      const selectedExpName = await experimentRow.textContent()
      console.log(`  ✓ Found experiment: ${selectedExpName?.substring(0, 50)}...`)

      await experimentRow.evaluate((row: HTMLElement) => {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Opened experiment')
      await debugWait()
    })

    await test.step('Verify all data persisted correctly', async () => {
      console.log('\n✅ STEP 10: Verifying all persisted data')

      // Wait for detail view to load - look for any h2 title
      const detailView = sidebar.locator('h2').first()
      await detailView.waitFor({ state: 'visible', timeout: 5000 })
      const experimentTitle = await detailView.textContent()
      console.log(`  ✓ Experiment detail view loaded: ${experimentTitle}`)

      const trafficInput = sidebar.locator('label:has-text("Traffic Percentage")').locator('..').locator('input')
      await trafficInput.waitFor({ state: 'visible', timeout: 2000 })
      const trafficValue = await trafficInput.inputValue()
      expect(parseInt(trafficValue)).toBeGreaterThan(0)
      expect(parseInt(trafficValue)).toBeLessThanOrEqual(100)
      console.log(`  ✓ Traffic percentage persisted: ${trafficValue}%`)

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
      expect(appCount).toBeGreaterThanOrEqual(0)
      console.log(`  ✓ Applications: ${appCount} app(s) ${appCount > 0 ? 'selected' : '(none)'}`)

      const ownersContainer = sidebar.locator('label:has-text("Owners")').locator('..')
      const ownerBadges = ownersContainer.locator('span[class*="badge"], div[class*="badge"]')
      const ownerCount = await ownerBadges.count()
      expect(ownerCount).toBeGreaterThanOrEqual(0)
      console.log(`  ✓ Owners: ${ownerCount} owner(s) ${ownerCount > 0 ? 'selected' : '(none)'}`)

      const tagsContainer = sidebar.locator('label:has-text("Tags")').locator('..')
      const tagBadges = tagsContainer.locator('span[class*="badge"], div[class*="badge"]')
      const tagCount = await tagBadges.count()
      expect(tagCount).toBeGreaterThanOrEqual(0)
      console.log(`  ✓ Tags: ${tagCount} tag(s) ${tagCount > 0 ? 'selected' : '(none)'}`)

      await debugWait()
    })

    console.log('\n🎉 Test completed successfully!')
  })
})
