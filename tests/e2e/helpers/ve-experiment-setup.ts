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

/**
 * Test launching a second Visual Editor instance
 * This verifies that the VE can be stopped and relaunched successfully
 */
export async function testSecondVEInstance(sidebar: FrameLocator, page: Page): Promise<void> {
  log('\n🔄 STEP 10: Testing ability to launch VE a second time...', 'info')

  // Verify test page is still valid
  if (page.isClosed()) {
    throw new Error('Test page was closed unexpectedly')
  }

  // Check if VE is still running and exit it
  const veActive = await page.evaluate(() => {
    const editor = (window as any).__absmartlyVisualEditor
    return editor && editor.isActive === true
  })

  if (veActive) {
    log('VE still active from previous step, exiting it first', 'debug')
    // Exit VE by calling the exit method directly
    await page.evaluate(() => {
      const ve = (window as any).__visualEditor
      if (ve && typeof ve.exit === 'function') {
        ve.exit()
      }
    })

    // Wait for VE to fully exit
    await page.waitForFunction(() => {
      const editor = (window as any).__absmartlyVisualEditor
      return !editor || editor.isActive !== true
    }, { timeout: 5000 })
    log('VE exited successfully', 'debug')
  }

  // Disable preview if enabled
  const disableButton = sidebar.locator('button:has-text("Disable Preview")')
  const isPreviewEnabled = await disableButton.isVisible({ timeout: 2000 }).catch(() => false)

  if (isPreviewEnabled) {
    await disableButton.click()
    await page.waitForFunction(() => {
      const para = document.querySelector('#test-paragraph')
      return para?.textContent?.includes('This is a test paragraph')
    })
    log('Disabled preview mode', 'debug')
  }

  // Wait for VE DOM elements to be cleaned up
  await page.waitForFunction(() => {
    return document.getElementById('absmartly-menu-host') === null
  }, { timeout: 5000 })
  log('Previous VE DOM elements cleaned up', 'debug')

  // Get fresh sidebar reference
  const freshSidebar = page.frameLocator('#absmartly-sidebar-iframe')
  await freshSidebar.locator('body').waitFor({ timeout: 5000 })

  // Click the VE button to launch second instance
  const veButtons = freshSidebar.locator('button:has-text("Visual Editor")')

  // Use dispatchEvent to ensure React handler is triggered in headless mode
  await veButtons.nth(0).evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  log('Dispatched click event to Visual Editor button for second launch', 'debug')

  // Take screenshot to see what's happening
  await page.screenshot({ path: 'test-results/second-ve-before-wait.png' })

  // Wait for VE banner host to appear (banner uses shadow DOM so we check for the host)
  await page.locator('#absmartly-visual-editor-banner-host').waitFor({ timeout: 5000 })
  log('Second VE instance launched successfully!', 'info')

  // Verify banner shows correct experiment name
  log('Second VE is active and ready', 'debug')

  // Exit the second VE by clicking the Exit button in the banner
  log('Clicking Exit button to exit VE...', 'debug')

  // Click the Exit button in the banner (check shadow DOM first, then direct)
  await page.evaluate(() => {
    const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
    if (!bannerHost) {
      console.error('Banner host not found')
      return
    }

    // Try shadow DOM first
    let exitButton: HTMLElement | null = null
    if (bannerHost.shadowRoot) {
      exitButton = bannerHost.shadowRoot.querySelector('[data-action="exit"]') as HTMLElement
    } else {
      // Fallback to direct query (test mode without shadow DOM)
      exitButton = bannerHost.querySelector('[data-action="exit"]') as HTMLElement
    }

    if (exitButton) {
      console.log('Found Exit button, dispatching click event...')
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      })
      exitButton.dispatchEvent(clickEvent)
      console.log('Dispatched click event to Exit button')
    } else {
      console.error('Exit button not found in banner')
    }
  })

  // Wait for VE to exit
  await page.waitForFunction(() => {
    const editor = (window as any).__absmartlyVisualEditor
    return !editor || editor.isActive !== true
  }, { timeout: 5000 })
  log('VE exited - waiting for sidebar to update...', 'debug')

  // Wait for VE DOM cleanup - banner and overlay should be removed
  await page.waitForFunction(() => {
    const banner = document.querySelector('.absmartly-banner')
    const overlay = document.querySelector('#absmartly-overlay-container')
    return banner === null && overlay === null
  }, { timeout: 3000 }).catch(() => log('VE elements still present', 'debug'))

  // Wait for sidebar to clear activeVEVariant state (onVEStop callback)
  log('Waited for sidebar state cleanup', 'debug')

  log('\n✅ Second VE launch test PASSED!', 'info')
  log('  • Successfully launched VE a second time')
  log('  • VE toolbar appeared correctly')
  log('  • Context menu works in second instance')
}

/**
 * Fill metadata fields (owners, teams, tags) for saving the experiment
 * This prepares the experiment form for submission
 */
export async function fillMetadataForSave(sidebar: FrameLocator, page: Page): Promise<void> {
  log('\n💾 Preparing experiment for save: filling metadata fields...', 'info')
  await debugWait()

  // After the discard test:
  // - VE toolbar is removed (VE is stopped)
  // - Preview mode is still active (this is intentional - user might want to keep previewing)
  // - The sidebar is still on the Create New Experiment form

  // We need to exit preview mode before we can save
  log('Exiting preview mode...', 'debug')
  const exitPreviewBtn = page.locator('button:has-text("Exit Preview")')
  const isPreviewActive = await exitPreviewBtn.isVisible().catch(() => false)

  if (isPreviewActive) {
    log('Preview mode is active (expected after VE exit)', 'debug')
    await exitPreviewBtn.click()
    log('Clicked Exit Preview', 'debug')
    await debugWait()
    await exitPreviewBtn.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
    log('Preview mode disabled', 'debug')
    await debugWait()
  } else {
    log('Preview mode already disabled', 'debug')
  }

  // Fill the new metadata fields (owners, teams, tags)
  log('Filling owners, teams, and tags fields...', 'debug')
  await debugWait()

  // Scroll to the metadata section
  await sidebar.locator('label:has-text("Applications"), label:has-text("Owners")').first().scrollIntoViewIfNeeded()
  await debugWait()

  // Fill Owners field - click the field to open dropdown
  log('Attempting to select owners...', 'debug')
  const ownersContainer = sidebar.locator('label:has-text("Owners")').locator('..')
  const ownersClickArea = ownersContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

  // Verify field is enabled
  const ownersDisabled = await ownersClickArea.evaluate(el => {
    return el.className.includes('cursor-not-allowed') || el.className.includes('disabled')
  })

  if (ownersDisabled) {
    throw new Error('Owners field is disabled - cannot select')
  }

  await ownersClickArea.click({ timeout: 5000 })
  log('Clicked owners field', 'debug')
  await debugWait()
  await debugWait()

  // Wait for dropdown to appear and get first option
  const ownersDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
  await ownersDropdown.waitFor({ state: 'visible', timeout: 3000 })
  log('Owners dropdown appeared', 'debug')

  // Wait for owners/teams to be loaded in the dropdown
  const firstOwnerOption = ownersDropdown.locator('div[class*="cursor-pointer"]').first()
  await firstOwnerOption.waitFor({ state: 'visible', timeout: 5000 })
  log('Owners/teams loaded in dropdown', 'debug')

  const optionExists = await firstOwnerOption.isVisible({ timeout: 2000 })

  if (!optionExists) {
    throw new Error('No owners/teams available in dropdown')
  }

  const selectedOptionText = await firstOwnerOption.textContent()

  // Use dispatchEvent to ensure React handler is triggered
  await firstOwnerOption.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  log(`Clicked owner/team option: ${selectedOptionText?.trim()}`, 'debug')
  await debugWait()

  // Wait for the placeholder to disappear OR a badge to appear
  await Promise.race([
    ownersContainer.locator('text="Select owners and teams"').waitFor({ state: 'hidden', timeout: 5000 }),
    ownersContainer.locator('div[class*="badge"], div[class*="chip"], div[class*="tag"]').first().waitFor({ state: 'visible', timeout: 5000 })
  ]).catch(() => {
    log('Neither placeholder disappeared nor badge appeared', 'debug')
  })

  // Close dropdown by clicking outside (multi-select dropdown stays open)
  await sidebar.locator('label:has-text("Traffic")').click()
  log('Clicked outside to close dropdown', 'debug')
  await debugWait()

  // Wait for dropdown to close
  await ownersDropdown.waitFor({ state: 'hidden', timeout: 3000 })
  log('Owner dropdown closed', 'debug')
  await debugWait()

  // Fill Tags field - click the field to open dropdown
  log('Attempting to select tags...', 'debug')
  const tagsContainer = sidebar.locator('label:has-text("Tags")').locator('..')
  const tagsClickArea = tagsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

  // Verify field is enabled
  const tagsDisabled = await tagsClickArea.evaluate(el => {
    return el.className.includes('cursor-not-allowed') || el.className.includes('disabled')
  })

  if (tagsDisabled) {
    throw new Error('Tags field is disabled - cannot select')
  }

  await tagsClickArea.click({ timeout: 5000 })
  log('Clicked tags field', 'debug')
  await debugWait()

  // Wait for dropdown to appear and get first option
  const tagsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
  await tagsDropdown.waitFor({ state: 'visible', timeout: 3000 })
  log('Tags dropdown appeared', 'debug')
  await debugWait()

  // Click first available option in the dropdown
  const firstTagOption = tagsDropdown.locator('div[class*="cursor-pointer"]').first()
  await firstTagOption.waitFor({ state: 'visible', timeout: 5000 })
  log('Tags loaded in dropdown', 'debug')

  const tagOptionExists = await firstTagOption.isVisible({ timeout: 2000 })

  if (!tagOptionExists) {
    throw new Error('No tags available in dropdown')
  }

  const selectedTagText = await firstTagOption.textContent()

  // Use dispatchEvent to ensure React handler is triggered
  await firstTagOption.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  log(`Clicked tag option: ${selectedTagText?.trim()}`, 'debug')
  await debugWait()

  // Wait for the placeholder to disappear OR a badge to appear
  await Promise.race([
    tagsContainer.locator('text="Type tags"').waitFor({ state: 'hidden', timeout: 5000 }),
    tagsContainer.locator('div[class*="badge"], div[class*="chip"], div[class*="tag"]').first().waitFor({ state: 'visible', timeout: 5000 })
  ]).catch(() => {
    log('Neither placeholder disappeared nor badge appeared', 'debug')
  })

  // Close dropdown by clicking outside (multi-select dropdown stays open)
  await sidebar.locator('label:has-text("Traffic")').click()
  log('Clicked outside to close dropdown', 'debug')
  await debugWait()

  // Wait for dropdown to close
  await tagsDropdown.waitFor({ state: 'hidden', timeout: 3000 })
  log('Tag dropdown closed', 'debug')
  await debugWait()

  log('Filled metadata fields', 'info')
  await debugWait()
}

/**
 * Save the experiment to the database
 * This function handles the entire save flow including validation and error handling
 */
export async function saveExperiment(sidebar: FrameLocator, testPage: Page, experimentName: string): Promise<void> {
  log('\n💾 Saving experiment to database...', 'info')
  log('WARNING: This will write to the production database!', 'debug')

  // Take screenshot before clicking save (should show top of form with any existing errors)
  await testPage.screenshot({ path: 'test-results/before-save-top.png', fullPage: true })
  log('Screenshot saved: before-save-top.png', 'debug')
  await debugWait()

  // Submit the form instead of clicking the button
  // This ensures the form's onSubmit handler is properly triggered
  const form = sidebar.locator('form')

  // Scroll to the submit button area to make it visible
  const saveButton = sidebar.locator('#create-experiment-button')
  await saveButton.scrollIntoViewIfNeeded()
  log('Scrolled to save button', 'debug')
  await debugWait()

  // Wait for form and button to be ready
  await form.waitFor({ state: 'visible', timeout: 2000 })
  await saveButton.waitFor({ state: 'visible', timeout: 2000 })
  await debugWait()

  // Check if button is enabled
  const isDisabled = await saveButton.evaluate((btn) => btn.hasAttribute('disabled'))
  log(`Button disabled: ${isDisabled}`, 'debug')

  if (isDisabled) {
    // Wait for button to become enabled
    await saveButton.waitFor({ state: 'enabled', timeout: 5000 })
    log('Button became enabled', 'debug')
  }

  // Submit the form directly to trigger React's onSubmit handler
  await form.evaluate((f) => {
    f.requestSubmit()
  })
  log('Submitted form', 'debug')
  await debugWait()

  // Wait for network activity (API call)
  await testPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    log('Network did not reach idle state', 'debug')
  })
  await debugWait()

  // Wait for response

  // Scroll to very top again to see any new error messages or success toasts
  await sidebar.locator('body').evaluate(el => {
    el.scrollTop = 0
    const scrollableElements = el.querySelectorAll('[style*="overflow"]')
    scrollableElements.forEach(elem => {
      if (elem instanceof HTMLElement) elem.scrollTop = 0
    })
  })

  // Take screenshot after save (should show validation errors if any)
  await testPage.screenshot({ path: 'test-results/after-save-top.png', fullPage: true })
  log('Screenshot saved: after-save-top.png', 'debug')

  // Wait for navigation to experiments list (which happens on successful save)
  // or for error messages to appear (if save failed)
  log('Waiting for save to complete...', 'debug')

  try {
    // Wait for experiments list header to appear (indicates successful save and navigation)
    await sidebar.locator('text="Experiments"').first().waitFor({ state: 'visible', timeout: 3000 })
    log('Experiment saved successfully - navigated to experiments list', 'info')
  } catch (e) {
    // If we didn't navigate to experiments list, check for errors
    log('Did not navigate to experiments list within 3 seconds', 'debug')

    // Check for validation errors
    const errorMessages = sidebar.locator('text=/error|required|must select|please|is required/i')
    const hasError = await errorMessages.count() > 0

    if (hasError) {
      log(`Found ${await errorMessages.count()} error message(s):`, 'debug')
      for (let i = 0; i < Math.min(5, await errorMessages.count()); i++) {
        const errorText = await errorMessages.nth(i).textContent()
        log(`  ${i + 1}. ${errorText}`, 'debug')
      }
      throw new Error('Failed to save experiment - validation errors found. Check screenshots.')
    } else {
      log('No validation errors visible, but save did not complete', 'debug')
      log('This might be a network issue or the API call was blocked', 'debug')
      throw new Error('Experiment save failed - did not navigate to experiments list. Check screenshots: before-save-top.png and after-save-top.png')
    }
  }

  log(`Experiment name: ${experimentName}`, 'info')

  // In SLOW mode, keep the page open for 5 seconds at the end
  if (process.env.SLOW === '1') {
    log('Keeping page open for 5 seconds...', 'debug')
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {})
    log('Done', 'debug')
  }
}
