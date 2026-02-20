import { test, expect } from '../fixtures/extension'
import type { Page } from '@playwright/test'
import { injectSidebar, initializeTestLogging, setupTestPage } from './utils/test-helpers'
import { createExperiment } from './helpers/ve-experiment-setup'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('AI Chat Simple Diagnostic', () => {
  let testPage: Page

  test.beforeEach(async ({ context, extensionUrl }) => {
    initializeTestLogging()
    testPage = await context.newPage()

    await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
    console.log('✅ Test page loaded and sidebar injected')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Diagnostic: What happens when clicking Generate with AI', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(120000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    // Create experiment first
    console.log('\n📝 Creating experiment')
    const experimentName = await createExperiment(sidebar)
    console.log(`✅ Created experiment: ${experimentName}`)

    // Take baseline screenshot
    await testPage.screenshot({ path: 'test-results/simple-01-baseline.png', fullPage: true })
    console.log('📸 Baseline screenshot saved')

    // Scroll to DOM Changes section in the editor
    await sidebar.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
    await testPage.screenshot({ path: 'test-results/simple-02-experiment-editor.png', fullPage: true })
    console.log('📸 Experiment editor screenshot saved')

    // Set up console message listener BEFORE clicking
    const consoleMessages: string[] = []
    testPage.on('console', msg => {
      const text = msg.text()
      if (text.includes('COMPONENT_LIFECYCLE') ||
          text.includes('STATE_CHANGE') ||
          text.includes('CALLBACK_CHANGE') ||
          text.includes('DOM NODES REMOVED') ||
          text.includes('AIDOMChangesPage')) {
        consoleMessages.push(text)
        console.log(`[Console] ${text}`)
      }
    })

    // Check state before clicking AI button
    console.log('\n🔍 STATE BEFORE CLICKING "Generate with AI":')
    const plasmoChildrenBefore = await sidebar.locator('#__plasmo > *').count()
    console.log(`  Plasmo children count: ${plasmoChildrenBefore}`)

    // Find Generate with AI button in editor
    const aiButton = sidebar.locator('#generate-with-ai-button').first()
    await aiButton.waitFor({ state: 'visible', timeout: 10000 })
    console.log('✅ Found "Generate with AI" button')

    // Take screenshot before click
    await testPage.screenshot({ path: 'test-results/simple-03-before-ai-click.png', fullPage: true })

    // Click the button
    console.log('\n🚨 CLICKING "Generate with AI" BUTTON NOW...')
    await aiButton.click()

    // Wait for any potential state change by checking if plasmo is still visible
    await sidebar.locator('#__plasmo').waitFor({ state: 'attached', timeout: 1000 }).catch(() => {})

    console.log('\n📊 STATE 100ms AFTER CLICK:')

    const rootExists100 = await testPage.evaluate(() => {
      return document.getElementById('absmartly-sidebar-root') !== null
    })
    const iframeExists100 = await testPage.evaluate(() => {
      return document.getElementById('absmartly-sidebar-iframe') !== null
    })

    console.log(`  Root exists: ${rootExists100}`)
    console.log(`  Iframe exists: ${iframeExists100}`)

    if (iframeExists100) {
      try {
        const plasmoCount100 = await sidebar.locator('#__plasmo').count()
        const plasmoChildren100 = await sidebar.locator('#__plasmo > *').count()
        const aiComponentCount100 = await sidebar.locator('[data-ai-dom-changes-page]').count()

        console.log(`  Plasmo div count: ${plasmoCount100}`)
        console.log(`  Plasmo children count: ${plasmoChildren100}`)
        console.log(`  AI component count: ${aiComponentCount100}`)
      } catch (e) {
        console.log(`  ❌ Error checking iframe: ${e.message}`)
      }
    }

    await testPage.screenshot({ path: 'test-results/simple-04-100ms-after-click.png', fullPage: true })

    // Check state 500ms after click - wait for any AI component to potentially appear
    await sidebar.locator('[data-ai-dom-changes-page]').waitFor({ state: 'attached', timeout: 1000 }).catch(() => {})
    console.log('\n📊 STATE 500ms AFTER CLICK:')

    const iframeExists500 = await testPage.evaluate(() => {
      return document.getElementById('absmartly-sidebar-iframe') !== null
    })
    console.log(`  Iframe exists: ${iframeExists500}`)

    if (iframeExists500) {
      try {
        const plasmoChildren500 = await sidebar.locator('#__plasmo > *').count()
        const aiComponentCount500 = await sidebar.locator('[data-ai-dom-changes-page]').count()

        console.log(`  Plasmo children count: ${plasmoChildren500}`)
        console.log(`  AI component count: ${aiComponentCount500}`)
      } catch (e) {
        console.log(`  ❌ Error checking iframe: ${e.message}`)
      }
    }

    await testPage.screenshot({ path: 'test-results/simple-05-500ms-after-click.png', fullPage: true })

    // Check final state 2 seconds after click - wait for component rendering to settle
    await testPage.waitForFunction(() => {
      const iframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement
      if (!iframe || !iframe.contentDocument) return true
      const plasmo = iframe.contentDocument.getElementById('__plasmo')
      return plasmo !== null && plasmo.children.length > 0
    }, { timeout: 2000 }).catch(() => {})
    console.log('\n📊 FINAL STATE (2 seconds after click):')

    const rootExistsFinal = await testPage.evaluate(() => {
      return document.getElementById('absmartly-sidebar-root') !== null
    })
    const iframeExistsFinal = await testPage.evaluate(() => {
      return document.getElementById('absmartly-sidebar-iframe') !== null
    })

    console.log(`  Root exists: ${rootExistsFinal}`)
    console.log(`  Iframe exists: ${iframeExistsFinal}`)

    if (iframeExistsFinal) {
      try {
        const plasmoChildrenFinal = await sidebar.locator('#__plasmo > *').count()
        const aiComponentCountFinal = await sidebar.locator('[data-ai-dom-changes-page]').count()

        console.log(`  Plasmo children count: ${plasmoChildrenFinal}`)
        console.log(`  AI component count: ${aiComponentCountFinal}`)

        if (aiComponentCountFinal > 0) {
          console.log('✅ AI component IS rendered!')
        } else {
          console.log('❌ AI component NOT rendered - blank screen!')
        }
      } catch (e) {
        console.log(`  ❌ Error checking iframe: ${e.message}`)
      }
    } else {
      console.log('❌ IFRAME WAS REMOVED!')
    }

    await testPage.screenshot({ path: 'test-results/simple-06-final-state.png', fullPage: true })

    console.log('\n📸 All screenshots saved to test-results/')

    // Analyze console messages
    console.log('\n📋 CONSOLE MESSAGE ANALYSIS:')
    console.log(`Total relevant messages: ${consoleMessages.length}`)

    const mountEvents = consoleMessages.filter(m => m.includes('"event":"MOUNT"'))
    const unmountEvents = consoleMessages.filter(m => m.includes('"event":"UNMOUNT"'))
    const renderEvents = consoleMessages.filter(m => m.includes('"event":"RENDER"'))
    const viewChanges = consoleMessages.filter(m => m.includes('"event":"VIEW_CHANGED"'))
    const domRemovals = consoleMessages.filter(m => m.includes('DOM NODES REMOVED'))

    console.log(`  MOUNT events: ${mountEvents.length}`)
    console.log(`  UNMOUNT events: ${unmountEvents.length}`)
    console.log(`  RENDER events: ${renderEvents.length}`)
    console.log(`  VIEW_CHANGED events: ${viewChanges.length}`)
    console.log(`  DOM NODES REMOVED: ${domRemovals.length}`)

    if (mountEvents.length > 1) {
      console.log('\n⚠️  MULTIPLE MOUNT EVENTS DETECTED - Component is mounting multiple times!')
    }
    if (unmountEvents.length > 0) {
      console.log('\n⚠️  UNMOUNT DETECTED - Component is unmounting!')
    }
    if (domRemovals.length > 0) {
      console.log('\n⚠️  DOM REMOVALS DETECTED - React is removing DOM nodes!')
    }

    console.log('\n✅ Diagnostic test complete')
  })
})
