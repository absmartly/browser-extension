/**
 * E2E tests for Experiment Code Injection UI
 *
 * These tests verify that clicking code injection sections opens the code editor modal.
 */

import { test, expect } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import path from 'path'
import { injectSidebar, debugWait } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev', 'local-test-page.html')

test.describe('Experiment Code Injection UI', () => {
  let testPage: Page
  let sidebar: FrameLocator

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()
    await testPage.goto(`file://${TEST_PAGE_PATH}`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('code injection UI exists and code editor can be opened', async ({ extensionUrl }) => {
    // Set a longer timeout for this test
    test.setTimeout(120000)

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      sidebar = await injectSidebar(testPage, extensionUrl)
      await sidebar.locator('body').waitFor({ timeout: 10000 })
      console.log('✅ Sidebar injected')
      await debugWait()
    })

    await test.step('Wait for experiments to load', async () => {
      console.log('\n⏳ STEP 2: Waiting for experiments to load')
      await testPage.waitForTimeout(3000)
      console.log('✅ Experiments should be loaded')
      await debugWait()
    })

    await test.step('Find and click first experiment', async () => {
      console.log('\n🔍 STEP 3: Looking for experiment')

      let firstExperiment = sidebar.locator('[class*="cursor-pointer"]').filter({ hasText: /test|experiment/i }).first()
      let experimentExists = await firstExperiment.isVisible({ timeout: 5000 }).catch(() => false)

      if (!experimentExists) {
        console.log('  Trying alternative selector...')
        firstExperiment = sidebar.locator('div').filter({ hasText: /test|experiment/i }).first()
        experimentExists = await firstExperiment.isVisible({ timeout: 5000 }).catch(() => false)
      }

      if (!experimentExists) {
        console.log('❌ No experiments found - test cannot proceed')
        throw new Error('No experiments found in sidebar. Please ensure there are experiments in your account.')
      }

      console.log('✅ Found experiment')
      await debugWait()

      await firstExperiment.click()
      console.log('✅ Clicked experiment')
      await testPage.waitForTimeout(2000)
      await debugWait()
    })

    await test.step('Find Custom Code Injection section', async () => {
      console.log('\n📝 STEP 4: Looking for Custom Code Injection section')

      const codeInjectionSection = sidebar.locator('text=Custom Code Injection')
      const sectionExists = await codeInjectionSection.isVisible({ timeout: 5000 }).catch(() => false)

      if (!sectionExists) {
        console.log('❌ Custom Code Injection section not found')
        await testPage.screenshot({ path: 'test-failed-no-code-injection.png', fullPage: true })
        throw new Error('Custom Code Injection section not found in experiment detail view')
      }

      console.log('✅ Found Custom Code Injection section')
      await debugWait()
    })

    await test.step('Expand Custom Code Injection section', async () => {
      console.log('\n🔽 STEP 5: Expanding Custom Code Injection section')

      const codeInjectionButton = sidebar.locator('button, div[role="button"], h3, h4').filter({ hasText: 'Custom Code Injection' }).first()
      await codeInjectionButton.click()
      console.log('✅ Clicked Code Injection button/header')
      await testPage.waitForTimeout(2000)
      await debugWait()

      // Check if sections appeared
      const headStartSection = sidebar.locator('text=Start of <head>')
      let headStartExists = await headStartSection.isVisible({ timeout: 2000 }).catch(() => false)

      if (!headStartExists) {
        console.log('⚠️  Section might still be collapsed, trying to click again')
        await codeInjectionButton.click()
        await testPage.waitForTimeout(2000)
        await debugWait()
        headStartExists = await headStartSection.isVisible({ timeout: 10000 }).catch(() => false)
      }

      if (!headStartExists) {
        console.log('❌ Start of <head> section not found after expanding')
        await testPage.screenshot({ path: 'test-failed-no-head-start.png', fullPage: true })
        throw new Error('Start of <head> section not found after expanding Custom Code Injection')
      }

      console.log('✅ Found Start of <head> section')
      await debugWait()
    })

    await test.step('Click Start of <head> section', async () => {
      console.log('\n👆 STEP 6: Clicking Start of <head> section')

      const headStartSection = sidebar.locator('text=Start of <head>')
      await headStartSection.click()
      console.log('✅ Clicked Start of <head>')
      await debugWait()
    })

    await test.step('Verify editor modal appears', async () => {
      console.log('\n✨ STEP 7: Waiting for editor modal to appear')

      const editorModal = await testPage.waitForSelector('#absmartly-code-editor-fullscreen', { timeout: 10000 })
      expect(editorModal).toBeTruthy()
      console.log('✅ Code editor modal appeared!')
      await debugWait()

      // Verify textarea exists
      const textarea = await testPage.$('textarea')
      expect(textarea).toBeTruthy()
      console.log('✅ Textarea found in editor')
      await debugWait()
    })

    await test.step('Close the modal', async () => {
      console.log('\n❌ STEP 8: Closing modal')

      const cancelBtn = await testPage.$('button:has-text("Cancel")')
      if (cancelBtn) {
        await cancelBtn.click()
        console.log('✅ Closed modal')
        await debugWait()
      }
    })
  })
})
