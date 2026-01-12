import { test, expect } from '../fixtures/extension'
import { Page, FrameLocator } from '@playwright/test'
import { injectSidebar, setupTestPage } from './utils/test-helpers'
import * as fs from 'fs'
import * as path from 'path'

const SCREENSHOTS_DIR = path.join(__dirname, '../../test-results/ai-chat-diagnostics')

interface DiagnosticSnapshot {
  timestamp: number
  timeFromClick: number
  iframe: {
    exists: boolean
    accessible: boolean
  }
  plasmoDiv: {
    exists: boolean
    childCount: number
    innerHTML: string
  }
  aiComponent: {
    exists: boolean
    visible: boolean
    heading: boolean
  }
  consoleLogs: {
    renderCount: number
    domRemovalCount: number
    errors: string[]
    reactErrors: string[]
  }
}

interface DiagnosticReport {
  testStartTime: number
  clickTime: number
  snapshots: DiagnosticSnapshot[]
  failureCategory: string
  recommendation: string
  consoleHistory: string[]
}

test.describe('AI Chat Component Mount - Diagnostic Test', () => {
  let consoleHistory: string[] = []
  let clickTime: number = 0
  let testStartTime: number = 0

  test.beforeEach(async ({ page }) => {
    // Ensure screenshots directory exists
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
    }

    testStartTime = Date.now()
    consoleHistory = []

    // Capture all console messages
    page.on('console', (msg) => {
      const timestamp = Date.now() - testStartTime
      const entry = `[${timestamp}ms] ${msg.type()}: ${msg.text()}`
      consoleHistory.push(entry)
      console.log(entry)
    })

    // Capture console errors from frame
    page.on('pageerror', (err) => {
      const timestamp = Date.now() - testStartTime
      const entry = `[${timestamp}ms] PAGE ERROR: ${err.message}`
      consoleHistory.push(entry)
      console.error(entry)
    })
  })

  async function captureSnapshot(
    page: Page,
    sidebar: FrameLocator,
    label: string
  ): Promise<DiagnosticSnapshot> {
    const timestamp = Date.now()
    const timeFromClick = clickTime > 0 ? timestamp - clickTime : 0

    console.log(`\n========== SNAPSHOT: ${label} (${timeFromClick}ms from click) ==========`)

    // Check iframe existence and accessibility
    const iframeExists = await page.locator('#absmartly-sidebar-iframe').count() > 0
    let iframeAccessible = false

    if (iframeExists) {
      try {
        await sidebar.locator('body').evaluate(() => true, { timeout: 1000 })
        iframeAccessible = true
      } catch {
        iframeAccessible = false
      }
    }

    // Check Plasmo div state
    let plasmoExists = false
    let plasmoChildCount = 0
    let plasmoInnerHTML = ''

    if (iframeAccessible) {
      try {
        const plasmoData = await sidebar.locator('#__plasmo').evaluate((el) => {
          if (!el) return null
          return {
            childCount: el.children.length,
            innerHTML: el.innerHTML.substring(0, 500)
          }
        }, { timeout: 1000 })

        if (plasmoData) {
          plasmoExists = true
          plasmoChildCount = plasmoData.childCount
          plasmoInnerHTML = plasmoData.innerHTML
        }
      } catch (e) {
        console.log(`Failed to check Plasmo div: ${e.message}`)
      }
    }

    // Check AI component state
    let aiComponentExists = false
    let aiComponentVisible = false
    let aiHeadingExists = false

    if (iframeAccessible) {
      try {
        aiComponentExists = await sidebar.locator('[data-ai-dom-changes-page]').count() > 0
        if (aiComponentExists) {
          aiComponentVisible = await sidebar.locator('[data-ai-dom-changes-page]').isVisible({ timeout: 1000 })
        }
        aiHeadingExists = await sidebar.locator('text=AI DOM Changes Generator').count() > 0
      } catch (e) {
        console.log(`Failed to check AI component: ${e.message}`)
      }
    }

    // Analyze console logs
    const renderLogs = consoleHistory.filter(log => log.includes('AIDOMChangesPage] RENDER START'))
    const domRemovalLogs = consoleHistory.filter(log => log.includes('DOM NODES REMOVED'))
    const errorLogs = consoleHistory.filter(log => log.includes('ERROR') || log.includes('Error'))
    const reactErrorLogs = consoleHistory.filter(log =>
      log.includes('React') ||
      log.includes('commitDeletionEffects') ||
      log.includes('unmount')
    )

    const snapshot: DiagnosticSnapshot = {
      timestamp,
      timeFromClick,
      iframe: {
        exists: iframeExists,
        accessible: iframeAccessible
      },
      plasmoDiv: {
        exists: plasmoExists,
        childCount: plasmoChildCount,
        innerHTML: plasmoInnerHTML
      },
      aiComponent: {
        exists: aiComponentExists,
        visible: aiComponentVisible,
        heading: aiHeadingExists
      },
      consoleLogs: {
        renderCount: renderLogs.length,
        domRemovalCount: domRemovalLogs.length,
        errors: errorLogs,
        reactErrors: reactErrorLogs
      }
    }

    // Log snapshot summary
    console.log(JSON.stringify({
      label,
      timeFromClick: `${timeFromClick}ms`,
      iframe: snapshot.iframe,
      plasmo: {
        exists: snapshot.plasmoDiv.exists,
        childCount: snapshot.plasmoDiv.childCount
      },
      aiComponent: snapshot.aiComponent,
      logs: {
        renders: snapshot.consoleLogs.renderCount,
        domRemovals: snapshot.consoleLogs.domRemovalCount,
        errors: snapshot.consoleLogs.errors.length
      }
    }, null, 2))

    // Take screenshot
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${label.replace(/\s+/g, '-')}.png`)
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`Screenshot saved: ${screenshotPath}`)
    } catch (e) {
      console.warn(`Failed to take screenshot: ${e.message}`)
    }

    return snapshot
  }

  function categorizeFailure(snapshots: DiagnosticSnapshot[]): { category: string, recommendation: string } {
    const latest = snapshots[snapshots.length - 1]

    // Check progression over time
    const iframeRemovedEarly = snapshots.some((s, i) => i > 0 && !s.iframe.exists)
    const plasmoEmptiedEarly = snapshots.some((s, i) => i > 0 && s.plasmoDiv.exists && s.plasmoDiv.childCount === 0)
    const componentNeverRendered = latest.consoleLogs.renderCount === 0
    const componentRenderedThenRemoved = latest.consoleLogs.renderCount > 0 && !latest.aiComponent.exists
    const renderLoop = latest.consoleLogs.renderCount > 10
    const domRemovalLoop = latest.consoleLogs.domRemovalCount > 5

    if (iframeRemovedEarly) {
      return {
        category: 'iframe_removed',
        recommendation: 'Investigate content script or Plasmo framework. Check content.ts and sidebar injection logic. The iframe is being removed from the DOM.'
      }
    }

    if (!latest.iframe.accessible) {
      return {
        category: 'iframe_inaccessible',
        recommendation: 'Investigate iframe security/CORS. Check if iframe is being recreated or blocked by browser security.'
      }
    }

    if (!latest.plasmoDiv.exists) {
      return {
        category: 'plasmo_div_missing',
        recommendation: 'Investigate Plasmo framework mount point. The #__plasmo div is missing entirely.'
      }
    }

    if (plasmoEmptiedEarly || (latest.plasmoDiv.exists && latest.plasmoDiv.childCount === 0)) {
      return {
        category: 'plasmo_div_empty',
        recommendation: 'React unmounted without remounting. Check ExtensionUI view state management and conditional rendering. Look for unstable dependencies in useEffect or callbacks.'
      }
    }

    if (componentNeverRendered) {
      return {
        category: 'component_never_rendered',
        recommendation: 'AIDOMChangesPage never renders. Check ExtensionUI routing logic, aiDomContext state, and conditional rendering. Verify view === "ai-dom-changes" is set correctly.'
      }
    }

    if (componentRenderedThenRemoved) {
      return {
        category: 'component_rendered_then_unmounted',
        recommendation: 'Component renders then unmounts. Check for unstable props/callbacks, useEffect infinite loops, or ErrorBoundary silently catching. Review useCallback dependencies and ref patterns.'
      }
    }

    if (renderLoop) {
      return {
        category: 'render_loop_detected',
        recommendation: `RENDER LOOP: Component rendered ${latest.consoleLogs.renderCount} times! Check for unstable callbacks (missing useCallback), state updates in render, or useEffect with unstable dependencies.`
      }
    }

    if (domRemovalLoop) {
      return {
        category: 'dom_removal_loop',
        recommendation: `DOM REMOVAL LOOP: ${latest.consoleLogs.domRemovalCount} removals detected! React is repeatedly removing/adding DOM nodes. Check for IIFE patterns, inline functions in JSX, or unstable component keys.`
      }
    }

    if (latest.aiComponent.exists && latest.aiComponent.visible) {
      return {
        category: 'success',
        recommendation: 'AI component rendered successfully! If user reports blank screen, check CSS (display/visibility), z-index, or parent container styles.'
      }
    }

    if (latest.aiComponent.exists && !latest.aiComponent.visible) {
      return {
        category: 'component_not_visible',
        recommendation: 'Component exists in DOM but not visible. Check CSS display/visibility properties, parent container styles, or z-index issues.'
      }
    }

    return {
      category: 'unknown',
      recommendation: 'Unknown failure mode. Review full console logs and screenshots for clues.'
    }
  }

  test('Main Diagnostic: Click Generate with AI and capture state progression', async ({ page, context, extensionUrl }) => {
    console.log('\n========== STARTING DIAGNOSTIC TEST ==========\n')

    await page.goto('http://localhost:3456/visual-editor-test.html')
    console.log('[Test] Page loaded')

    // Inject sidebar using helper
    const sidebar = await injectSidebar(page, extensionUrl)
    console.log('[Test] Extension initialized')

    // Wait for sidebar to load - wait for experiment list or empty state
    await Promise.race([
      sidebar.locator('.experiment-item').first().waitFor({ state: 'visible', timeout: 15000 }),
      sidebar.locator('text=/No experiments/i').waitFor({ state: 'visible', timeout: 15000 })
    ]).catch(() => {})
    console.log('[Test] Sidebar visible')

    // Baseline snapshot - before any interaction
    const snapshots: DiagnosticSnapshot[] = []
    snapshots.push(await captureSnapshot(page, sidebar, '01-baseline'))

    // Find first experiment in the list
    const firstExperiment = sidebar.locator('.experiment-item').first()
    await firstExperiment.waitFor({ state: 'visible', timeout: 20000 })
    console.log('[Test] Found first experiment')

    // Click on the experiment to open detail view
    await firstExperiment.click()
    await page.waitForFunction(() => true, { timeout: 2000 }).catch(() => {})
    console.log('[Test] Clicked experiment')

    snapshots.push(await captureSnapshot(page, sidebar, '02-experiment-detail'))

    // Find "Generate with AI" button
    const generateButton = sidebar.locator('#generate-with-ai-button').first()
    await generateButton.waitFor({ state: 'visible', timeout: 10000 })
    console.log('[Test] Found "Generate with AI" button')

    snapshots.push(await captureSnapshot(page, sidebar, '03-before-click'))

    // Click the button and start capturing
    console.log('\n========== CLICKING "Generate with AI" BUTTON ==========\n')
    clickTime = Date.now()
    await generateButton.click()
    console.log('[Test] Button clicked at', clickTime)

    // Capture snapshots at critical intervals
    // 50ms - immediate after click
    await page.waitForFunction(() => true, { timeout: 50 }).catch(() => {})
    snapshots.push(await captureSnapshot(page, sidebar, '04-after-50ms'))

    // 100ms - early React render
    await page.waitForFunction(() => true, { timeout: 50 }).catch(() => {})
    snapshots.push(await captureSnapshot(page, sidebar, '05-after-100ms'))

    // 200ms - component mount
    await page.waitForFunction(() => true, { timeout: 100 }).catch(() => {})
    snapshots.push(await captureSnapshot(page, sidebar, '06-after-200ms'))

    // 500ms - stabilization
    await page.waitForFunction(() => true, { timeout: 300 }).catch(() => {})
    snapshots.push(await captureSnapshot(page, sidebar, '07-after-500ms'))

    // 1000ms - should be stable
    await page.waitForFunction(() => true, { timeout: 500 }).catch(() => {})
    snapshots.push(await captureSnapshot(page, sidebar, '08-after-1000ms'))

    // 2000ms - final check
    await page.waitForFunction(() => true, { timeout: 1000 }).catch(() => {})
    snapshots.push(await captureSnapshot(page, sidebar, '09-after-2000ms'))

    // Categorize the failure
    const { category, recommendation } = categorizeFailure(snapshots)

    // Generate diagnostic report
    const report: DiagnosticReport = {
      testStartTime,
      clickTime,
      snapshots,
      failureCategory: category,
      recommendation,
      consoleHistory
    }

    // Save report to file
    const reportPath = path.join(SCREENSHOTS_DIR, 'diagnostic-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\nDiagnostic report saved: ${reportPath}`)

    // Print summary
    console.log('\n========== DIAGNOSTIC SUMMARY ==========')
    console.log(`Failure Category: ${category}`)
    console.log(`Recommendation: ${recommendation}`)
    console.log(`Total Renders: ${snapshots[snapshots.length - 1].consoleLogs.renderCount}`)
    console.log(`DOM Removals: ${snapshots[snapshots.length - 1].consoleLogs.domRemovalCount}`)
    console.log(`Errors: ${snapshots[snapshots.length - 1].consoleLogs.errors.length}`)
    console.log(`Screenshots: ${SCREENSHOTS_DIR}`)
    console.log('=========================================\n')

    // Test "passes" regardless - we're gathering diagnostics
    // But log whether the component actually mounted
    const success = category === 'success'
    if (!success) {
      console.error(`\n🚨 DIAGNOSTIC TEST DETECTED ISSUE: ${category}`)
      console.error(`📋 NEXT STEPS: ${recommendation}\n`)
    } else {
      console.log('\n✅ Component mounted successfully!')
    }

    // Optional: Assert if you want test to fail on issues
    // expect(success).toBe(true)
  })

  test('Iframe Removal Monitor: Detect if iframe is removed during interaction', async ({ page, context, extensionUrl }) => {
    console.log('\n========== IFRAME REMOVAL MONITOR TEST ==========\n')

    await page.goto('http://localhost:3456/visual-editor-test.html')

    // Inject sidebar using helper
    const sidebar = await injectSidebar(page, extensionUrl)
    console.log('[Test] Extension initialized')

    // Wait for sidebar to load - wait for experiment list or empty state
    await Promise.race([
      sidebar.locator('.experiment-item').first().waitFor({ state: 'visible', timeout: 15000 }),
      sidebar.locator('text=/No experiments/i').waitFor({ state: 'visible', timeout: 15000 })
    ]).catch(() => {})
    console.log('[Test] Sidebar loaded')

    // Set up iframe removal detector
    let iframeRemoved = false
    let removalTime = 0

    await page.evaluate(() => {
      const iframe = document.querySelector('#absmartly-sidebar-iframe')
      if (!iframe) return

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.removedNodes.length > 0) {
            for (const node of Array.from(mutation.removedNodes)) {
              if (node === iframe || (node as Element).id === 'absmartly-sidebar-iframe') {
                console.error('🚨 IFRAME REMOVED FROM DOM!', {
                  timestamp: Date.now(),
                  mutation: {
                    type: mutation.type,
                    target: (mutation.target as Element).tagName
                  }
                })
                ;(window as any).__iframeRemoved = true
                ;(window as any).__removalTime = Date.now()
              }
            }
          }
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      console.log('[Test] Iframe removal monitor installed')
    })

    // Navigate to AI page
    const firstExperiment = sidebar.locator('.experiment-item').first()
    await firstExperiment.waitFor({ state: 'visible', timeout: 20000 })
    await firstExperiment.click()
    await page.waitForFunction(() => true, { timeout: 2000 }).catch(() => {})

    const generateButton = sidebar.locator('#generate-with-ai-button').first()
    await generateButton.waitFor({ state: 'visible', timeout: 10000 })

    const clickTime = Date.now()
    await generateButton.click()
    console.log('[Test] Clicked Generate with AI at', clickTime)

    // Wait and check
    await page.waitForFunction(() => true, { timeout: 3000 }).catch(() => {})

    // Check if iframe was removed
    const removalData = await page.evaluate(() => {
      return {
        removed: (window as any).__iframeRemoved || false,
        time: (window as any).__removalTime || 0
      }
    })

    if (removalData.removed) {
      const timeSinceClick = removalData.time - clickTime
      console.error(`\n🚨 IFRAME WAS REMOVED ${timeSinceClick}ms AFTER CLICKING!`)
      console.error('This confirms the iframe is being removed from the DOM.')
      console.error('Investigation area: content.ts, sidebar injection logic, or Plasmo HMR\n')
    } else {
      console.log('\n✅ Iframe remained in DOM throughout the test')
    }

    // This test always passes - it's informational
  })
})
