import { type Page, type FrameLocator, expect } from '@playwright/test'
import { click, debugWait } from '../utils/test-helpers'
import { log } from '../utils/test-helpers'
import { waitForVisualEditorBanner } from '../utils/visual-editor-helpers'

/**
 * Create a new experiment with basic form fields and optional metadata
 * This function handles ALL setup except the actual save button click
 * Returns the experiment name created
 */
export async function createExperiment(
  sidebar: FrameLocator,
  options: { fillOwners?: boolean; fillTeams?: boolean; fillTags?: boolean } = {}
): Promise<string> {
  log('\n📋 Creating new experiment', 'info')

  // Click the plus icon button with title="Create New Experiment"
  await click(sidebar, 'button[title="Create New Experiment"]', 5000)
  log('Clicked Create New Experiment button', 'debug')
  await debugWait()

  // Select "From Scratch" option from the dropdown menu
  log('Selecting "From Scratch" option', 'debug')
  const fromScratchButton = sidebar.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
  await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
  await click(sidebar, 'button:has-text("From Scratch"), button:has-text("from scratch")', 5000)
  log('Selected "From Scratch" option', 'debug')
  await debugWait()

  // Fill experiment name in the form
  const experimentName = `E2E Test Experiment ${Date.now()}`
  await sidebar.locator('input[placeholder*="xperiment"], input[name="name"], input[type="text"]').first().fill(experimentName)
  log(`Filled experiment name: ${experimentName}`, 'debug')
  await debugWait()

  // Select Unit Type (required field)
  log('Selecting Unit Type', 'debug')
  const unitTypeTrigger = sidebar.locator('#unit-type-select-trigger')
  await unitTypeTrigger.waitFor({ state: 'visible', timeout: 5000 })
  await sidebar.locator('#unit-type-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 5000 })
  log('Unit type select is enabled', 'debug')
  await unitTypeTrigger.click()
  log('Clicked unit type trigger', 'debug')
  await debugWait(500)

  const unitTypeDropdown = sidebar.locator('#unit-type-select-dropdown, [data-testid="unit-type-select-dropdown"]')
  await unitTypeDropdown.waitFor({ state: 'visible', timeout: 5000 })
  await unitTypeDropdown.locator('div[class*="cursor-pointer"]').first().click()
  log('Selected unit type', 'debug')
  await debugWait()

  // Select Application
  log('Selecting Applications', 'debug')
  const appsTrigger = sidebar.locator('#applications-select-trigger')
  await appsTrigger.waitFor({ state: 'visible', timeout: 5000 })
  await appsTrigger.click()
  log('Clicked applications trigger', 'debug')
  await debugWait(500)

  const appsDropdown = sidebar.locator('#applications-select-dropdown, [data-testid="applications-select-dropdown"]')
  await appsDropdown.waitFor({ state: 'visible', timeout: 5000 })
  await appsDropdown.locator('div[class*="cursor-pointer"]').first().click()
  log('Selected application', 'debug')
  await debugWait()

  // Click outside to close dropdown
  await sidebar.locator('label:has-text("Traffic")').click()

  // Wait for dropdown to close
  const appsDropdownClosed = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
  await appsDropdownClosed.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})

  log('✅ Experiment form filled with required fields', 'info')
  await debugWait()

  // Optional: Fill owners, teams, and tags if requested
  if (options.fillOwners || options.fillTeams || options.fillTags) {
    log('Filling optional metadata fields', 'debug')
    await fillMetadataFields(sidebar, options)
  }

  return experimentName
}

/**
 * Activate the visual editor by clicking the Visual Editor button
 */
export async function activateVisualEditor(sidebar: FrameLocator, testPage: Page): Promise<void> {
  log('\n🎨 Activating Visual Editor', 'info')

  const visualEditorButton = sidebar.locator('button:has-text("Visual Editor")').first()

  // Wait for button to be visible and then become enabled (form validation to complete)
  await visualEditorButton.waitFor({ state: 'visible', timeout: 5000 })
  await expect(visualEditorButton).toBeEnabled({ timeout: 10000 })
  log('Visual Editor button is enabled', 'debug')

  // Ensure test page is focused/active before clicking VE button
  await testPage.bringToFront()

  // Scroll the button into view if needed
  await visualEditorButton.scrollIntoViewIfNeeded()

  await visualEditorButton.click()
  log('Clicked Visual Editor button', 'debug')

  // Wait for banner to appear
  await waitForVisualEditorBanner(testPage, 15000)
  log('✅ Visual editor active', 'info')

  await debugWait()
}

/**
 * Helper to fill optional metadata fields (owners, teams, tags)
 */
async function fillMetadataFields(
  sidebar: FrameLocator,
  options: { fillOwners?: boolean; fillTeams?: boolean; fillTags?: boolean }
): Promise<void> {
  if (options.fillOwners) {
    log('Filling owners field', 'debug')
    const ownersContainer = sidebar.locator('label:has-text("Owners")').locator('..')
    const ownersClickArea = ownersContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

    const ownersDisabled = await ownersClickArea.evaluate(el => {
      return el.className.includes('cursor-not-allowed') || el.className.includes('disabled')
    })

    if (!ownersDisabled) {
      await ownersClickArea.click({ timeout: 5000 })
      log('Clicked owners field', 'debug')
      await debugWait()

      const ownersDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await ownersDropdown.waitFor({ state: 'visible', timeout: 3000 })

      const firstOwnerOption = ownersDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstOwnerOption.waitFor({ state: 'visible', timeout: 5000 })

      const selectedOptionText = await firstOwnerOption.textContent()
      await firstOwnerOption.evaluate((el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      log(`Selected owner: ${selectedOptionText?.trim()}`, 'debug')
      await debugWait()

      // Close dropdown
      await sidebar.locator('label:has-text("Traffic")').click()
      await ownersDropdown.waitFor({ state: 'hidden', timeout: 3000 })
      log('Owners dropdown closed', 'debug')
      await debugWait()
    }
  }

  if (options.fillTeams) {
    log('Filling teams field', 'debug')
    // Similar logic to owners can be added here
  }

  if (options.fillTags) {
    log('Filling tags field', 'debug')
    const tagsContainer = sidebar.locator('label:has-text("Tags")').locator('..')
    const tagsClickArea = tagsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

    const tagsDisabled = await tagsClickArea.evaluate(el => {
      return el.className.includes('cursor-not-allowed') || el.className.includes('disabled')
    })

    if (!tagsDisabled) {
      await tagsClickArea.click({ timeout: 5000 })
      log('Clicked tags field', 'debug')
      await debugWait()

      const tagsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await tagsDropdown.waitFor({ state: 'visible', timeout: 3000 })

      const firstTagOption = tagsDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstTagOption.waitFor({ state: 'visible', timeout: 5000 })

      const selectedTagText = await firstTagOption.textContent()
      await firstTagOption.evaluate((el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      log(`Selected tag: ${selectedTagText?.trim()}`, 'debug')
      await debugWait()

      // Close dropdown
      await sidebar.locator('label:has-text("Traffic")').click()
      await tagsDropdown.waitFor({ state: 'hidden', timeout: 3000 })
      log('Tags dropdown closed', 'debug')
      await debugWait()
    }
  }
}
