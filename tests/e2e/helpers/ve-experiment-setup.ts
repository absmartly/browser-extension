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

  await click(sidebar, 'button[title="Create New Experiment"]', 5000)
  await debugWait()

  const fromScratchButton = sidebar.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
  await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
  await click(sidebar, 'button:has-text("From Scratch"), button:has-text("from scratch")', 5000)
  await debugWait()

  const experimentName = `E2E Test Experiment ${Date.now()}`
  await sidebar.locator('input[placeholder*="xperiment"], input[name="name"], input[type="text"]').first().fill(experimentName)
  await debugWait()

  const unitTypeTrigger = sidebar.locator('#unit-type-select-trigger')
  await unitTypeTrigger.waitFor({ state: 'visible', timeout: 5000 })
  await sidebar.locator('#unit-type-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 5000 })
  await unitTypeTrigger.click()
  await debugWait(500)

  const unitTypeDropdown = sidebar.locator('#unit-type-select-dropdown, [data-testid="unit-type-select-dropdown"]')
  await unitTypeDropdown.waitFor({ state: 'visible', timeout: 5000 })
  await unitTypeDropdown.locator('div[class*="cursor-pointer"]').first().click()
  await debugWait()

  const appsTrigger = sidebar.locator('#applications-select-trigger')
  await appsTrigger.waitFor({ state: 'visible', timeout: 5000 })
  await appsTrigger.click()
  await debugWait(500)

  const appsDropdown = sidebar.locator('#applications-select-dropdown, [data-testid="applications-select-dropdown"]')
  await appsDropdown.waitFor({ state: 'visible', timeout: 5000 })
  await appsDropdown.locator('div[class*="cursor-pointer"]').first().click()
  await debugWait()

  await sidebar.locator('label:has-text("Traffic")').click()

  const appsDropdownClosed = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
  await appsDropdownClosed.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})

  log('✅ Experiment form filled', 'info')
  await debugWait()

  if (options.fillOwners || options.fillTeams || options.fillTags) {
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

  await visualEditorButton.waitFor({ state: 'visible', timeout: 5000 })
  await expect(visualEditorButton).toBeEnabled({ timeout: 10000 })

  await testPage.bringToFront()
  await visualEditorButton.scrollIntoViewIfNeeded()

  await visualEditorButton.click()

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
    const ownersContainer = sidebar.locator('label:has-text("Owners")').locator('..')
    const ownersClickArea = ownersContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

    const ownersDisabled = await ownersClickArea.evaluate(el => {
      return el.className.includes('cursor-not-allowed') || el.className.includes('disabled')
    })

    if (!ownersDisabled) {
      await ownersClickArea.click({ timeout: 5000 })
      await debugWait()

      const ownersDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await ownersDropdown.waitFor({ state: 'visible', timeout: 3000 })

      const firstOwnerOption = ownersDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstOwnerOption.waitFor({ state: 'visible', timeout: 5000 })

      await firstOwnerOption.evaluate((el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      await debugWait()

      await sidebar.locator('label:has-text("Traffic")').click()
      await ownersDropdown.waitFor({ state: 'hidden', timeout: 3000 })
      await debugWait()
    }
  }

  if (options.fillTags) {
    const tagsContainer = sidebar.locator('label:has-text("Tags")').locator('..')
    const tagsClickArea = tagsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

    const tagsDisabled = await tagsClickArea.evaluate(el => {
      return el.className.includes('cursor-not-allowed') || el.className.includes('disabled')
    })

    if (!tagsDisabled) {
      await tagsClickArea.click({ timeout: 5000 })
      await debugWait()

      const tagsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await tagsDropdown.waitFor({ state: 'visible', timeout: 3000 })

      const firstTagOption = tagsDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstTagOption.waitFor({ state: 'visible', timeout: 5000 })

      await firstTagOption.evaluate((el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      await debugWait()

      await sidebar.locator('label:has-text("Traffic")').click()
      await tagsDropdown.waitFor({ state: 'hidden', timeout: 3000 })
      await debugWait()
    }
  }
}

/**
 * Test launching a second Visual Editor instance
 * This verifies that the VE can be stopped and relaunched successfully
 */
export async function testSecondVEInstance(sidebar: FrameLocator, page: Page): Promise<void> {
  log('\n🔄 STEP 10: Testing second VE launch', 'info')

  if (page.isClosed()) {
    throw new Error('Test page was closed unexpectedly')
  }

  const veActive = await page.evaluate(() => {
    const editor = (window as any).__absmartlyVisualEditor
    return editor && editor.isActive === true
  })

  if (veActive) {
    await page.evaluate(() => {
      const ve = (window as any).__visualEditor
      if (ve && typeof ve.exit === 'function') {
        ve.exit()
      }
    })

    await page.waitForFunction(() => {
      const editor = (window as any).__absmartlyVisualEditor
      return !editor || editor.isActive !== true
    }, { timeout: 5000 })
  }

  const disableButton = sidebar.locator('button:has-text("Disable Preview")')
  const isPreviewEnabled = await disableButton.isVisible({ timeout: 2000 }).catch(() => false)

  if (isPreviewEnabled) {
    await disableButton.click()
    await page.waitForFunction(() => {
      const para = document.querySelector('#test-paragraph')
      return para?.textContent?.includes('This is a test paragraph')
    })
  }

  await page.waitForFunction(() => {
    return document.getElementById('absmartly-menu-host') === null
  }, { timeout: 5000 })

  const freshSidebar = page.frameLocator('#absmartly-sidebar-iframe')
  await freshSidebar.locator('body').waitFor({ timeout: 5000 })

  const veButtons = freshSidebar.locator('button:has-text("Visual Editor")')

  await veButtons.nth(0).evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  await page.screenshot({ path: 'test-results/second-ve-before-wait.png' })

  await page.locator('#absmartly-visual-editor-banner-host').waitFor({ timeout: 5000 })
  log('  ✓ Second VE instance launched', 'info')

  await page.evaluate(() => {
    const bannerHost = document.getElementById('absmartly-visual-editor-banner-host')
    if (!bannerHost) {
      console.error('Banner host not found')
      return
    }

    let exitButton: HTMLElement | null = null
    if (bannerHost.shadowRoot) {
      exitButton = bannerHost.shadowRoot.querySelector('[data-action="exit"]') as HTMLElement
    } else {
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

  await page.waitForFunction(() => {
    const editor = (window as any).__absmartlyVisualEditor
    return !editor || editor.isActive !== true
  }, { timeout: 5000 })

  await page.waitForFunction(() => {
    const banner = document.querySelector('.absmartly-banner')
    const overlay = document.querySelector('#absmartly-overlay-container')
    return banner === null && overlay === null
  }, { timeout: 3000 }).catch(() => {})

  log('\n✅ Second VE launch test PASSED', 'info')
}

/**
 * Fill metadata fields (owners, teams, tags) for saving the experiment
 * This prepares the experiment form for submission
 */
export async function fillMetadataForSave(sidebar: FrameLocator, page: Page): Promise<void> {
  log('\n💾 Preparing experiment for save', 'info')
  await debugWait()

  const exitPreviewBtn = page.locator('button:has-text("Exit Preview")')
  const isPreviewActive = await exitPreviewBtn.isVisible().catch(() => false)

  if (isPreviewActive) {
    await exitPreviewBtn.click()
    await debugWait()
    await exitPreviewBtn.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
    await debugWait()
  }

  await debugWait()

  await sidebar.locator('label:has-text("Applications"), label:has-text("Owners")').first().scrollIntoViewIfNeeded()
  await debugWait()

  const ownersContainer = sidebar.locator('label:has-text("Owners")').locator('..')
  const ownersClickArea = ownersContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

  const ownersDisabled = await ownersClickArea.evaluate(el => {
    return el.className.includes('cursor-not-allowed') || el.className.includes('disabled')
  })

  if (ownersDisabled) {
    throw new Error('Owners field is disabled - cannot select')
  }

  await ownersClickArea.click({ timeout: 5000 })
  await debugWait()
  await debugWait()

  const ownersDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
  await ownersDropdown.waitFor({ state: 'visible', timeout: 3000 })

  const firstOwnerOption = ownersDropdown.locator('div[class*="cursor-pointer"]').first()
  await firstOwnerOption.waitFor({ state: 'visible', timeout: 5000 })

  const optionExists = await firstOwnerOption.isVisible({ timeout: 2000 })

  if (!optionExists) {
    throw new Error('No owners/teams available in dropdown')
  }

  await firstOwnerOption.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await debugWait()

  await Promise.race([
    ownersContainer.locator('text="Select owners and teams"').waitFor({ state: 'hidden', timeout: 5000 }),
    ownersContainer.locator('div[class*="badge"], div[class*="chip"], div[class*="tag"]').first().waitFor({ state: 'visible', timeout: 5000 })
  ]).catch(() => {})

  await sidebar.locator('label:has-text("Traffic")').click()
  await debugWait()

  await ownersDropdown.waitFor({ state: 'hidden', timeout: 3000 })
  await debugWait()

  const tagsContainer = sidebar.locator('label:has-text("Tags")').locator('..')
  const tagsClickArea = tagsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

  const tagsDisabled = await tagsClickArea.evaluate(el => {
    return el.className.includes('cursor-not-allowed') || el.className.includes('disabled')
  })

  if (tagsDisabled) {
    throw new Error('Tags field is disabled - cannot select')
  }

  await tagsClickArea.click({ timeout: 5000 })
  await debugWait()

  const tagsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
  await tagsDropdown.waitFor({ state: 'visible', timeout: 3000 })
  await debugWait()

  const firstTagOption = tagsDropdown.locator('div[class*="cursor-pointer"]').first()
  await firstTagOption.waitFor({ state: 'visible', timeout: 5000 })

  const tagOptionExists = await firstTagOption.isVisible({ timeout: 2000 })

  if (!tagOptionExists) {
    throw new Error('No tags available in dropdown')
  }

  await firstTagOption.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await debugWait()

  await Promise.race([
    tagsContainer.locator('text="Type tags"').waitFor({ state: 'hidden', timeout: 5000 }),
    tagsContainer.locator('div[class*="badge"], div[class*="chip"], div[class*="tag"]').first().waitFor({ state: 'visible', timeout: 5000 })
  ]).catch(() => {})

  await sidebar.locator('label:has-text("Traffic")').click()
  await debugWait()

  await tagsDropdown.waitFor({ state: 'hidden', timeout: 3000 })
  await debugWait()

  log('  ✓ Metadata fields filled', 'info')
  await debugWait()
}

/**
 * Save the experiment to the database
 * This function handles the entire save flow including validation and error handling
 */
export async function saveExperiment(sidebar: FrameLocator, testPage: Page, experimentName: string): Promise<void> {
  log('\n💾 Saving experiment to database', 'info')

  await testPage.screenshot({ path: 'test-results/before-save-top.png', fullPage: true })
  await debugWait()

  const form = sidebar.locator('form')

  const saveButton = sidebar.locator('#create-experiment-button')
  await saveButton.scrollIntoViewIfNeeded()
  await debugWait()

  await form.waitFor({ state: 'visible', timeout: 2000 })
  await saveButton.waitFor({ state: 'visible', timeout: 2000 })
  await debugWait()

  const isDisabled = await saveButton.evaluate((btn) => btn.hasAttribute('disabled'))

  if (isDisabled) {
    await saveButton.waitFor({ state: 'enabled', timeout: 5000 })
  }

  await form.evaluate((f) => {
    f.requestSubmit()
  })
  await debugWait()

  await testPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await debugWait()

  await sidebar.locator('body').evaluate(el => {
    el.scrollTop = 0
    const scrollableElements = el.querySelectorAll('[style*="overflow"]')
    scrollableElements.forEach(elem => {
      if (elem instanceof HTMLElement) elem.scrollTop = 0
    })
  })

  await testPage.screenshot({ path: 'test-results/after-save-top.png', fullPage: true })

  try {
    await sidebar.locator('text="Experiments"').first().waitFor({ state: 'visible', timeout: 3000 })
    log('  ✓ Experiment saved successfully', 'info')
  } catch (e) {
    const errorMessages = sidebar.locator('text=/error|required|must select|please|is required/i')
    const hasError = await errorMessages.count() > 0

    if (hasError) {
      throw new Error('Failed to save experiment - validation errors found. Check screenshots.')
    } else {
      throw new Error('Experiment save failed - did not navigate to experiments list. Check screenshots: before-save-top.png and after-save-top.png')
    }
  }

  if (process.env.SLOW === '1') {
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {})
  }
}
