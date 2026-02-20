import { test, expect } from '../fixtures/extension'
import type { Page, FrameLocator } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { setupTestPage } from './utils/test-helpers'
import { createExperiment } from './helpers/ve-experiment-setup'

const TEST_PAGE_URL = '/visual-editor-test.html'

const SCREENSHOTS_DIR = path.join(__dirname, '../../test-results/ai-chat-fix')
const LOG_FILE = path.join(SCREENSHOTS_DIR, 'test-execution.log')

function log(message: string) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}`
  console.log(logMessage)

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }
  fs.appendFileSync(LOG_FILE, logMessage + '\n')
}

interface ComponentMetrics {
  renderCount: number
  domRemovalCount: number
  domAdditionCount: number
  mountCount: number
  unmountCount: number
  errors: string[]
  componentExists: boolean
  componentVisible: boolean
  plasmoChildCount: number
}


async function captureMetrics(
  page: Page,
  sidebar: FrameLocator,
  consoleHistory: string[]
): Promise<ComponentMetrics> {
  const renderLogs = consoleHistory.filter(log =>
    log.includes('"event":"RENDER"') && log.includes('AIDOMChangesPage')
  )

  const domRemovalLogs = consoleHistory.filter(log =>
    log.includes('DOM NODES REMOVED') || log.includes('"removedNodes"')
  )

  const domAdditionLogs = consoleHistory.filter(log =>
    log.includes('DOM NODES ADDED') || log.includes('"addedNodes"')
  )

  const mountLogs = consoleHistory.filter(log =>
    log.includes('"event":"MOUNT"') && log.includes('AIDOMChangesPage')
  )

  const unmountLogs = consoleHistory.filter(log =>
    log.includes('"event":"UNMOUNT"') && log.includes('AIDOMChangesPage')
  )

  const errorLogs = consoleHistory.filter(log => {
    const lower = log.toLowerCase()
    if (!lower.includes('error') || log.includes('ErrorBoundary')) return false
    if (lower.includes('failed to load resource')) return false
    if (lower.includes('err_name_not_resolved')) return false
    if (lower.includes('err_file_not_found')) return false
    if (lower.includes('favicon.ico')) return false
    return true
  })

  let componentExists = false
  let componentVisible = false
  let plasmoChildCount = 0

  try {
    componentExists = await sidebar.locator('[data-ai-dom-changes-page]').count() > 0
    if (componentExists) {
      componentVisible = await sidebar.locator('[data-ai-dom-changes-page]').isVisible({ timeout: 1000 })
    }

    const plasmoData = await sidebar.locator('#__plasmo').evaluate((el) => {
      return el ? el.children.length : 0
    }, { timeout: 1000 })
    plasmoChildCount = plasmoData
  } catch (e) {
    log(`Failed to capture component state: ${e.message}`)
  }

  return {
    renderCount: renderLogs.length,
    domRemovalCount: domRemovalLogs.length,
    domAdditionCount: domAdditionLogs.length,
    mountCount: mountLogs.length,
    unmountCount: unmountLogs.length,
    errors: errorLogs,
    componentExists,
    componentVisible,
    plasmoChildCount
  }
}

test.describe('AI Chat Fix Verification', () => {
  let consoleHistory: string[] = []
  let clickTime: number = 0

  test.beforeEach(async ({ page }) => {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
    }

    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE)
    }

    consoleHistory = []
    clickTime = 0

    page.on('console', (msg) => {
      const entry = `${msg.type()}: ${msg.text()}`
      consoleHistory.push(entry)
    })

    page.on('pageerror', (err) => {
      const entry = `PAGE ERROR: ${err.message}`
      consoleHistory.push(entry)
      console.error(entry)
    })

    log('Test setup complete')
  })

  test('AI Chat Page should render and stay stable', async ({ page, context, extensionUrl }) => {
    log('========== STARTING AI CHAT FIX TEST ==========')

    const { sidebar } = await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    log(`Page loaded: ${TEST_PAGE_URL}`)

    await sidebar.locator('#experiments-heading').waitFor({ state: 'visible', timeout: 10000 })
    log('Extension UI loaded')

    const experimentName = await createExperiment(sidebar)
    log(`Created experiment: ${experimentName}`)

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-experiment-created.png'),
      fullPage: true
    })

    log('Scrolling to DOM Changes section in editor')
    await sidebar.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02-experiment-editor.png'),
      fullPage: true
    })

    const baselineMetrics = await captureMetrics(page, sidebar, consoleHistory)
    log('Baseline metrics captured:')
    log(JSON.stringify(baselineMetrics, null, 2))

    log('Looking for "Generate with AI" button')
    const generateButton = sidebar.locator('#generate-with-ai-button').first()

    await generateButton.waitFor({ state: 'visible', timeout: 10000 })
    log('Found "Generate with AI" button')

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-before-click.png'),
      fullPage: true
    })

    log('========== CLICKING "Generate with AI" BUTTON ==========')
    clickTime = Date.now()
    await generateButton.click()
    log(`Button clicked at ${clickTime}`)

    log('Waiting 100ms for initial render...')
    await page.waitForFunction(() => true, { timeout: 100 }).catch(() => {})

    const metrics100ms = await captureMetrics(page, sidebar, consoleHistory)
    log('Metrics at 100ms:')
    log(JSON.stringify(metrics100ms, null, 2))

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04-after-100ms.png'),
      fullPage: true
    })

    log('Waiting 500ms for stabilization...')
    await page.waitForFunction(() => true, { timeout: 400 }).catch(() => {})

    const metrics500ms = await captureMetrics(page, sidebar, consoleHistory)
    log('Metrics at 500ms:')
    log(JSON.stringify(metrics500ms, null, 2))

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-after-500ms.png'),
      fullPage: true
    })

    log('Waiting 1 second...')
    await page.waitForFunction(() => true, { timeout: 500 }).catch(() => {})

    const metrics1s = await captureMetrics(page, sidebar, consoleHistory)
    log('Metrics at 1s:')
    log(JSON.stringify(metrics1s, null, 2))

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-after-1s.png'),
      fullPage: true
    })

    log('Waiting 2 seconds (final check)...')
    await page.waitForFunction(() => true, { timeout: 1000 }).catch(() => {})

    const finalMetrics = await captureMetrics(page, sidebar, consoleHistory)
    log('Final metrics at 2s:')
    log(JSON.stringify(finalMetrics, null, 2))

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '07-final-2s.png'),
      fullPage: true
    })

    log('========== TEST RESULTS ==========')
    log(`Component exists: ${finalMetrics.componentExists}`)
    log(`Component visible: ${finalMetrics.componentVisible}`)
    log(`Render count: ${finalMetrics.renderCount}`)
    log(`DOM removals: ${finalMetrics.domRemovalCount}`)
    log(`Mount count: ${finalMetrics.mountCount}`)
    log(`Unmount count: ${finalMetrics.unmountCount}`)
    log(`Plasmo child count: ${finalMetrics.plasmoChildCount}`)
    log(`Errors: ${finalMetrics.errors.length}`)

    let failureReason = ''
    let testPassed = true

    if (!finalMetrics.componentExists) {
      failureReason = 'Component does not exist in DOM'
      testPassed = false
    } else if (!finalMetrics.componentVisible) {
      failureReason = 'Component exists but is not visible'
      testPassed = false
    } else if (finalMetrics.renderCount > 10) {
      failureReason = `RENDER LOOP DETECTED: ${finalMetrics.renderCount} renders in 2 seconds`
      testPassed = false
    } else if (finalMetrics.domRemovalCount > 5) {
      failureReason = `DOM THRASHING DETECTED: ${finalMetrics.domRemovalCount} removals in 2 seconds`
      testPassed = false
    } else if (finalMetrics.unmountCount > finalMetrics.mountCount) {
      failureReason = `Component unmounted more than mounted (${finalMetrics.unmountCount} unmounts vs ${finalMetrics.mountCount} mounts)`
      testPassed = false
    } else if (finalMetrics.plasmoChildCount === 0) {
      failureReason = 'Plasmo div is empty (no children)'
      testPassed = false
    } else if (finalMetrics.errors.length > 0) {
      failureReason = `Errors detected: ${finalMetrics.errors[0]}`
      testPassed = false
    }

    const summary = {
      testPassed,
      failureReason,
      metrics: {
        baseline: baselineMetrics,
        at100ms: metrics100ms,
        at500ms: metrics500ms,
        at1s: metrics1s,
        final: finalMetrics
      },
      analysis: {
        renderStability: finalMetrics.renderCount <= 3 ? 'GOOD' : finalMetrics.renderCount <= 10 ? 'WARNING' : 'FAIL',
        domStability: finalMetrics.domRemovalCount <= 1 ? 'GOOD' : finalMetrics.domRemovalCount <= 5 ? 'WARNING' : 'FAIL',
        componentLifecycle: finalMetrics.mountCount === 1 && finalMetrics.unmountCount === 0 ? 'GOOD' : 'WARNING',
        visibility: finalMetrics.componentVisible ? 'GOOD' : 'FAIL'
      }
    }

    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, 'test-summary.json'),
      JSON.stringify(summary, null, 2)
    )

    log('========== TEST SUMMARY ==========')
    log(JSON.stringify(summary, null, 2))
    log('==================================')

    if (!testPassed) {
      log(`TEST FAILED: ${failureReason}`)
      log('Review screenshots and console logs for details')
      log(`Screenshots: ${SCREENSHOTS_DIR}`)
      log(`Console logs: ${LOG_FILE}`)
    } else {
      log('TEST PASSED: AI Chat component rendered successfully and remained stable')
      log(`Render count: ${finalMetrics.renderCount} (target: <3, acceptable: <10)`)
      log(`DOM removals: ${finalMetrics.domRemovalCount} (target: <2, acceptable: <5)`)
    }

    expect(finalMetrics.componentExists, 'Component should exist in DOM').toBe(true)
    expect(finalMetrics.componentVisible, 'Component should be visible').toBe(true)
    expect(finalMetrics.renderCount, 'Should not have excessive renders (indicates loop)').toBeLessThan(10)
    expect(finalMetrics.domRemovalCount, 'Should not have excessive DOM removals (indicates thrashing)').toBeLessThan(5)
    expect(finalMetrics.plasmoChildCount, 'Plasmo div should have children').toBeGreaterThan(0)

    if (finalMetrics.renderCount > 3) {
      log(`WARNING: Render count (${finalMetrics.renderCount}) is higher than ideal (<3)`)
      log('This suggests some instability but not a complete failure')
    }

    if (finalMetrics.domRemovalCount > 1) {
      log(`WARNING: DOM removal count (${finalMetrics.domRemovalCount}) is higher than ideal (<2)`)
      log('This suggests React is re-mounting but not in an infinite loop')
    }
  })

  test('Component should not unmount/remount in a loop', async ({ page, context, extensionUrl }) => {
    log('========== TESTING FOR UNMOUNT/REMOUNT LOOP ==========')

    const { sidebar } = await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    await sidebar.locator('#experiments-heading').waitFor({ state: 'visible', timeout: 10000 })

    await createExperiment(sidebar)
    await sidebar.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()

    const generateButton = sidebar.locator('#generate-with-ai-button').first()
    await generateButton.waitFor({ state: 'visible', timeout: 10000 })

    let mountEvents = 0
    let unmountEvents = 0

    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('"event":"MOUNT"') && text.includes('AIDOMChangesPage')) {
        mountEvents++
        log(`MOUNT event detected (total: ${mountEvents})`)
      }
      if (text.includes('"event":"UNMOUNT"') && text.includes('AIDOMChangesPage')) {
        unmountEvents++
        log(`UNMOUNT event detected (total: ${unmountEvents})`)
      }
    })

    log('Clicking "Generate with AI" and monitoring for 3 seconds')
    await generateButton.click()

    await page.waitForFunction(() => true, { timeout: 3000 }).catch(() => {})

    log(`========== LIFECYCLE EVENTS ==========`)
    log(`Mount events: ${mountEvents}`)
    log(`Unmount events: ${unmountEvents}`)
    log(`======================================`)

    const componentExists = await sidebar.locator('[data-ai-dom-changes-page]').count() > 0
    log(`Component exists after click: ${componentExists}`)

    // Some extension iframe consoles don't propagate to the top-level page console
    // In that case, mountEvents can be 0 even when the component rendered.
    if (mountEvents === 0) {
      log('Mount events not captured; falling back to DOM existence check')
      expect(componentExists, 'Component should exist in DOM').toBe(true)
    } else {
      expect(mountEvents, 'Should mount exactly once').toBe(1)
    }

    expect(unmountEvents, 'Should not unmount during test').toBe(0)

    if (mountEvents > 1) {
      log(`FAILURE: Component mounted ${mountEvents} times (expected: 1)`)
      log('This indicates the component is being unmounted and remounted')
    }

    if (unmountEvents > 0) {
      log(`FAILURE: Component unmounted ${unmountEvents} times (expected: 0)`)
      log('This indicates instability in component lifecycle')
    }
  })
})
