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

  await click(sidebar, 'button[title="Create New Experiment"]', 5000)
  await debugWait()

  const fromScratchButton = sidebar.locator('#from-scratch-button')
  await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
  await fromScratchButton.click()
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

  await sidebar.locator('#traffic-label').click()

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

  const visualEditorButton = sidebar.locator('#visual-editor-button')

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
    const ownersContainer = sidebar.locator('#owners-label').locator('..')
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

      await sidebar.locator('#traffic-label').click()
      await ownersDropdown.waitFor({ state: 'hidden', timeout: 3000 })
      await debugWait()
    }
  }

  if (options.fillTags) {
    const tagsContainer = sidebar.locator('#tags-label').locator('..')
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

      await sidebar.locator('#traffic-label').click()
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

  const previewToggleBtn = sidebar.locator('#preview-variant-1')
  const toggleExists = await previewToggleBtn.isVisible({ timeout: 2000 }).catch(() => false)

  if (toggleExists) {
    const isEnabled = await previewToggleBtn.evaluate((btn) => {
      return btn.className.includes('bg-blue-600')
    })
    if (isEnabled) {
      await previewToggleBtn.click()
      await page.waitForFunction(() => {
        const para = document.querySelector('#test-paragraph')
        return para?.textContent?.includes('This is a test paragraph')
      })
    }
  }

  await page.waitForFunction(() => {
    return document.getElementById('absmartly-menu-host') === null
  }, { timeout: 5000 })

  const freshSidebar = page.frameLocator('#absmartly-sidebar-iframe')
  await freshSidebar.locator('body').waitFor({ timeout: 5000 })

  const veButtons = freshSidebar.locator('#visual-editor-button')

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
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      })
      exitButton.dispatchEvent(clickEvent)
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
  log('  Starting metadata fill')

  const exitPreviewBtn = page.locator('#absmartly-preview-header button')
  const isPreviewActive = await exitPreviewBtn.first().isVisible().catch(() => false)

  if (isPreviewActive) {
    await exitPreviewBtn.first().click()
    await page.locator('#absmartly-preview-header').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  }

  await sidebar.locator('#owners-label').scrollIntoViewIfNeeded()
  log('  Scrolled to owners')

  const ownersTrigger = sidebar.locator('#owners-label-trigger')
  await ownersTrigger.click({ timeout: 3000 })
  log('  Opened owners dropdown')

  const ownersDropdown = sidebar.locator('#owners-label-dropdown')
  await ownersDropdown.waitFor({ state: 'visible', timeout: 3000 })

  const userOption = ownersDropdown.locator('.max-h-60 > div:has(.rounded-full:not(.hidden))').first()
  const userOptionVisible = await userOption.isVisible().catch(() => false)

  if (userOptionVisible) {
    const optText = await userOption.innerText().catch(() => 'unknown')
    log(`  Found user option: "${optText.trim()}"`)
    await userOption.click()
    log('  Selected user owner')
  } else {
    log('  No user options found, selecting first option')
    await ownersDropdown.locator('.max-h-60 > div').first().click()
  }

  await ownersDropdown.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})

  const tagsTrigger = sidebar.locator('#tags-label-trigger')
  await tagsTrigger.scrollIntoViewIfNeeded()
  await tagsTrigger.click({ timeout: 3000 })
  log('  Opened tags dropdown')

  const tagsDropdown = sidebar.locator('#tags-label-dropdown')
  await tagsDropdown.waitFor({ state: 'visible', timeout: 3000 })

  const firstTagOption = tagsDropdown.locator('.max-h-60 > div').first()
  await firstTagOption.waitFor({ state: 'visible', timeout: 3000 })
  await firstTagOption.click()
  log('  Selected tag')

  await tagsDropdown.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})

  const ownerTriggerAfterAll = await sidebar.locator('#owners-label-trigger').innerText().catch(() => '')
  const hasOwnerSelected = ownerTriggerAfterAll.trim().length > 0 && !ownerTriggerAfterAll.includes('Select')
  log(`  Owner trigger after all: "${ownerTriggerAfterAll.trim().substring(0, 60)}" hasSelection=${hasOwnerSelected}`)

  if (!hasOwnerSelected) {
    log('  WARNING: Owner selection was lost, re-selecting')
    await sidebar.locator('#owners-label-trigger').click({ timeout: 3000 })
    const ownersDropdown2 = sidebar.locator('#owners-label-dropdown')
    await ownersDropdown2.waitFor({ state: 'visible', timeout: 3000 })
    const userOption2 = ownersDropdown2.locator('.max-h-60 > div:has(.rounded-full:not(.hidden))').first()
    await userOption2.click()
    await ownersDropdown2.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
  }

  log('  ✓ Metadata fields filled', 'info')
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
    await sidebar.locator('#experiments-heading').waitFor({ state: 'visible', timeout: 15000 })
    log('  ✓ Experiment saved successfully', 'info')
  } catch (e) {
    const bodyText = await sidebar.locator('body').innerText().catch(() => '')
    const errorLines = bodyText.split('\n').filter((l: string) => /error|required|must select|please|is required|invalid/i.test(l))
    log(`  Save failed. Error lines found: ${errorLines.length}`)
    for (const line of errorLines.slice(0, 5)) {
      log(`    Error: ${line.trim().substring(0, 200)}`)
    }

    const visibleText = await sidebar.locator('.text-red-500, .text-red-600, [class*="error"]').allInnerTexts().catch(() => [])
    if (visibleText.length > 0) {
      log(`  Red/error text on page:`)
      for (const t of visibleText) {
        log(`    ${t.trim().substring(0, 200)}`)
      }
    }

    throw new Error(`Failed to save experiment. Errors: ${errorLines.join(' | ').substring(0, 500)}`)
  }

  if (process.env.SLOW === '1') {
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {})
  }
}
